use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Arc;
use anyhow::{Context, Result};
use bytes::Bytes;
use iroh::{Endpoint, EndpointId};
use iroh_gossip::{
    api::{Event, GossipSender},
    net::Gossip,
};
use n0_future::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::network::crdt::{BoardCrdtState, CrdtOp};
use crate::network::sync_protocol::initiate_catchup_sync;
use crate::network::ticket::derive_board_topic;
use crate::network::EventSink;

/// Wire payload broadcast over `iroh-gossip` topics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum GossipWireMessage {
    Op {
        sender_id: String,
        op: CrdtOp,
    },
    BatchOps {
        board_id: String,
        sender_id: String,
        ops: Vec<CrdtOp>,
    },
    Presence {
        board_id: String,
        sender_id: String,
        user_name: String,
        timestamp_ms: u64,
    },
}

pub struct ActiveTopicSwarm {
    pub board_id: String,
    pub sender: GossipSender,
    pub neighbors: Arc<RwLock<HashSet<EndpointId>>>,
}

#[derive(Clone)]
pub struct BoardGossipManager {
    pub endpoint: Endpoint,
    pub gossip: Gossip,
    pub data_dir: PathBuf,
    pub boards: Arc<RwLock<HashMap<String, BoardCrdtState>>>,
    pub topics: Arc<RwLock<HashMap<String, ActiveTopicSwarm>>>,
    pub event_sink: Arc<dyn EventSink>,
}

impl BoardGossipManager {
    pub fn new(
        endpoint: Endpoint,
        gossip: Gossip,
        data_dir: PathBuf,
        boards: Arc<RwLock<HashMap<String, BoardCrdtState>>>,
        event_sink: Arc<dyn EventSink>,
    ) -> Self {
        Self {
            endpoint,
            gossip,
            data_dir,
            boards,
            topics: Arc::new(RwLock::new(HashMap::new())),
            event_sink,
        }
    }

    /// Subscribes to a board's gossip topic (or joins additional bootstrap peers if already subscribed).
    pub async fn ensure_subscribed(
        &self,
        board_id: &str,
        bootstrap_peers: Vec<EndpointId>,
    ) -> Result<GossipSender> {
        let my_id = self.endpoint.id();
        let filtered_bootstrap: Vec<EndpointId> = bootstrap_peers
            .into_iter()
            .filter(|id| *id != my_id)
            .collect();

        {
            let topics_guard = self.topics.read().await;
            if let Some(existing) = topics_guard.get(board_id) {
                if !filtered_bootstrap.is_empty() {
                    let _ = existing.sender.join_peers(filtered_bootstrap).await;
                }
                return Ok(existing.sender.clone());
            }
        }

        let topic_id = derive_board_topic(board_id);
        let topic = self
            .gossip
            .subscribe(topic_id, filtered_bootstrap.clone())
            .await
            .context("failed to subscribe to iroh-gossip topic")?;

        let (sender, mut receiver) = topic.split();
        let neighbors = Arc::new(RwLock::new(HashSet::new()));

        {
            let mut topics_guard = self.topics.write().await;
            topics_guard.insert(
                board_id.to_string(),
                ActiveTopicSwarm {
                    board_id: board_id.to_string(),
                    sender: sender.clone(),
                    neighbors: neighbors.clone(),
                },
            );
        }

        // Spawn background listener for this board's gossip stream
        let board_id_owned = board_id.to_string();
        let endpoint = self.endpoint.clone();
        let data_dir = self.data_dir.clone();
        let boards = self.boards.clone();
        let event_sink = self.event_sink.clone();
        let neighbors_clone = neighbors.clone();

        tokio::spawn(async move {
            info!(board_id = %board_id_owned, %topic_id, "Started iroh-gossip topic listener");
            while let Some(res) = receiver.next().await {
                match res {
                    Ok(Event::NeighborUp(peer_id)) => {
                        info!(board_id = %board_id_owned, %peer_id, "Gossip NeighborUp");
                        neighbors_clone.write().await.insert(peer_id);

                        event_sink.emit_json(
                            "network://peer-event",
                            serde_json::json!({
                                "type": "neighbor_up",
                                "boardId": board_id_owned,
                                "peerId": peer_id.to_string(),
                            }),
                        );

                        // Automatically run SYNC_ALPN catch-up over a dedicated QUIC stream
                        // when a gossip neighbor comes online so offline history is reconciled!
                        let ep_clone = endpoint.clone();
                        let b_id = board_id_owned.clone();
                        let d_dir = data_dir.clone();
                        let boards_ref = boards.clone();
                        let sink_ref = event_sink.clone();
                        tokio::spawn(async move {
                            if let Err(err) = initiate_catchup_sync(
                                &ep_clone,
                                peer_id,
                                &b_id,
                                &d_dir,
                                &boards_ref,
                                &sink_ref,
                            )
                            .await
                            {
                                debug!(%peer_id, "Auto catch-up on NeighborUp note: {err:#}");
                            }
                        });
                    }
                    Ok(Event::NeighborDown(peer_id)) => {
                        info!(board_id = %board_id_owned, %peer_id, "Gossip NeighborDown");
                        neighbors_clone.write().await.remove(&peer_id);

                        event_sink.emit_json(
                            "network://peer-event",
                            serde_json::json!({
                                "type": "neighbor_down",
                                "boardId": board_id_owned,
                                "peerId": peer_id.to_string(),
                            }),
                        );
                    }
                    Ok(Event::Received(msg)) => {
                        let delivered_from = msg.delivered_from.to_string();
                        match serde_json::from_slice::<GossipWireMessage>(&msg.content) {
                            Ok(GossipWireMessage::Op { sender_id, op }) => {
                                let (applied, snapshot) = {
                                    let mut guard = boards.write().await;
                                    let board = guard
                                        .entry(board_id_owned.clone())
                                        .or_insert_with(|| BoardCrdtState::new(&board_id_owned));
                                    let applied = board.apply_remote_op(&op);
                                    if applied {
                                        let _ = board.save_to_disk(&data_dir).await;
                                    }
                                    (applied, board.export_snapshot())
                                };

                                if applied {
                                    event_sink.emit_json(
                                        "board://remote-op",
                                        serde_json::json!({
                                            "boardId": board_id_owned,
                                            "senderId": sender_id,
                                            "deliveredFrom": delivered_from,
                                            "op": op,
                                            "snapshot": snapshot,
                                        }),
                                    );
                                }
                            }
                            Ok(GossipWireMessage::BatchOps {
                                board_id: b_id,
                                sender_id,
                                ops,
                            }) => {
                                let (applied_count, snapshot) = {
                                    let mut guard = boards.write().await;
                                    let board = guard
                                        .entry(b_id.clone())
                                        .or_insert_with(|| BoardCrdtState::new(&b_id));
                                    let mut count = 0;
                                    for op in &ops {
                                        if board.apply_remote_op(op) {
                                            count += 1;
                                        }
                                    }
                                    if count > 0 {
                                        let _ = board.save_to_disk(&data_dir).await;
                                    }
                                    (count, board.export_snapshot())
                                };

                                if applied_count > 0 {
                                    event_sink.emit_json(
                                        "board://state-synced",
                                        serde_json::json!({
                                            "boardId": b_id,
                                            "remotePeerId": sender_id,
                                            "updatedCount": applied_count,
                                            "snapshot": snapshot,
                                        }),
                                    );
                                }
                            }
                            Ok(GossipWireMessage::Presence {
                                board_id: b_id,
                                sender_id,
                                user_name,
                                timestamp_ms,
                            }) => {
                                event_sink.emit_json(
                                    "network://peer-event",
                                    serde_json::json!({
                                        "type": "presence",
                                        "boardId": b_id,
                                        "peerId": sender_id,
                                        "userName": user_name,
                                        "timestampMs": timestamp_ms,
                                    }),
                                );
                            }
                            Err(err) => {
                                warn!("Failed to parse incoming gossip message: {err:#}");
                            }
                        }
                    }
                    Ok(Event::Lagged) => {
                        warn!(board_id = %board_id_owned, "Gossip receiver lagged; catch-up will reconcile");
                    }
                    Err(err) => {
                        warn!(board_id = %board_id_owned, "Gossip stream ended: {err:#}");
                        break;
                    }
                }
            }
        });

        Ok(sender)
    }

    /// Broadcasts a single `CrdtOp` over the board's `iroh-gossip` topic.
    pub async fn broadcast_op(&self, board_id: &str, op: CrdtOp) -> Result<()> {
        let sender = self.ensure_subscribed(board_id, vec![]).await?;
        let wire = GossipWireMessage::Op {
            sender_id: self.endpoint.id().to_string(),
            op,
        };
        let bytes = serde_json::to_vec(&wire)?;
        sender
            .broadcast(Bytes::from(bytes))
            .await
            .context("failed to broadcast CRDT op over iroh-gossip")?;
        Ok(())
    }

    /// Broadcasts a batch of `CrdtOp`s (chunked safely under max_message_size).
    pub async fn broadcast_batch(&self, board_id: &str, ops: Vec<CrdtOp>) -> Result<()> {
        if ops.is_empty() {
            return Ok(());
        }
        let sender = self.ensure_subscribed(board_id, vec![]).await?;
        let my_id = self.endpoint.id().to_string();

        for op in ops {
            let wire = GossipWireMessage::Op {
                sender_id: my_id.clone(),
                op,
            };
            if let Ok(bytes) = serde_json::to_vec(&wire) {
                let _ = sender.broadcast(Bytes::from(bytes)).await;
            }
        }
        Ok(())
    }

    /// Lists all active gossip neighbor `EndpointId`s across a board (or all boards).
    pub async fn active_neighbors(&self, board_id: Option<&str>) -> Vec<EndpointId> {
        let mut set = HashSet::new();
        let topics_guard = self.topics.read().await;
        for (b_id, swarm) in topics_guard.iter() {
            if let Some(target) = board_id {
                if b_id != target {
                    continue;
                }
            }
            let n_guard = swarm.neighbors.read().await;
            for peer_id in n_guard.iter() {
                set.insert(*peer_id);
            }
        }
        set.into_iter().collect()
    }
}
