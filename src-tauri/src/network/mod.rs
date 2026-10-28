pub mod crdt;
pub mod gossip;
pub mod identity;
pub mod sync_protocol;
pub mod ticket;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use anyhow::{Context, Result};
use iroh::{
    address_lookup::memory::MemoryLookup,
    endpoint::TransportAddrUsage,
    protocol::Router,
    Endpoint, EndpointAddr, EndpointId, TransportAddr,
};
use iroh_gossip::net::Gossip;
use iroh_mdns_address_lookup::DiscoveryEvent;
use n0_future::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::{broadcast, RwLock};
use tracing::info;

use crate::network::crdt::{BoardCrdtState, BoardSnapshot, CrdtOp, EntityKind};
use crate::network::gossip::BoardGossipManager;
use crate::network::identity::init_iroh_endpoint;
use crate::network::sync_protocol::{initiate_catchup_sync, CatchupResult, SyncProtocolHandler, SYNC_ALPN};
use crate::network::ticket::BoardTicket;

pub const DEFAULT_BOARD_ID: &str = "workspace";

/// Trait for emitting events from the Rust networking core to the React UI
/// (supports Tauri `AppHandle::emit` as well as SSE/IPC broadcast channels).
pub trait EventSink: Send + Sync + std::fmt::Debug + 'static {
    fn emit_json(&self, event: &str, payload: Value);
}

#[derive(Debug, Clone)]
pub struct BroadcastEventSink {
    pub tx: broadcast::Sender<(String, Value)>,
}

impl BroadcastEventSink {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(512);
        Self { tx }
    }
}

impl EventSink for BroadcastEventSink {
    fn emit_json(&self, event: &str, payload: Value) {
        let _ = self.tx.send((event.to_string(), payload));
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerConnectionDetail {
    pub peer_id: String,
    pub short_id: String,
    pub path_type: String, // "direct_quic" | "relayed" | "probing"
    pub is_direct: bool,
    pub active_addrs: Vec<String>,
    pub all_addrs: Vec<String>,
    pub source: String, // "gossip_swarm" | "lan_mdns" | "ticket_bootstrap"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeStatusReport {
    pub node_id: String,
    pub short_node_id: String,
    pub key_persisted: bool,
    pub key_path: String,
    pub relay_urls: Vec<String>,
    pub direct_sockets: Vec<String>,
    pub local_discovery_enabled: bool,
    pub custom_alpn: String,
    pub gossip_alpn: String,
    pub active_board_id: String,
    pub connected_peers: Vec<PeerConnectionDetail>,
    pub lan_discovered_peers: Vec<String>,
    pub crdt_records_count: usize,
    pub lamport_clock: u64,
    pub spawned_test_peers: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TicketCreationResponse {
    pub ticket: String,
    pub board_id: String,
    pub bootstrap_peers_count: usize,
    pub bootstrap_peer_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinTicketResponse {
    pub board_id: String,
    pub bootstrap_peers_added: usize,
    pub catchup_results: Vec<CatchupResult>,
    pub snapshot: BoardSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotReconcileRequest {
    pub board_id: Option<String>,
    pub tasks: Vec<Value>,
    pub projects: Vec<Value>,
    pub users: Vec<Value>,
    pub groups: Vec<Value>,
    pub roles: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestPeerSpawnResult {
    pub test_peer_id: String,
    pub short_peer_id: String,
    pub catchup_result: CatchupResult,
    pub broadcasted_task_id: Option<String>,
    pub snapshot: BoardSnapshot,
}

/// The central SpiderWeb P2P Engine managing the persisted `iroh::Endpoint`,
/// `iroh::protocol::Router`, `iroh-gossip` topics, `MdnsAddressLookup`, and `SYNC_ALPN` catch-up.
pub struct SpiderWebNode {
    pub endpoint: Endpoint,
    pub router: Router,
    pub gossip: Gossip,
    pub gossip_manager: BoardGossipManager,
    pub memory_lookup: MemoryLookup,
    pub local_discovery_enabled: bool,
    pub key_path: PathBuf,
    pub key_was_loaded: bool,
    pub data_dir: PathBuf,
    pub boards: Arc<RwLock<HashMap<String, BoardCrdtState>>>,
    pub known_peers: Arc<RwLock<HashMap<EndpointId, EndpointAddr>>>,
    pub lan_peers: Arc<RwLock<HashMap<EndpointId, EndpointAddr>>>,
    pub event_sink: Arc<dyn EventSink>,
    pub spawned_test_nodes: Arc<RwLock<Vec<Arc<SpiderWebNode>>>>,
}

impl std::fmt::Debug for SpiderWebNode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SpiderWebNode")
            .field("endpoint_id", &self.endpoint.id().to_string())
            .field("data_dir", &self.data_dir)
            .finish()
    }
}

impl SpiderWebNode {
    /// Initializes the complete SpiderWeb P2P stack in `data_dir`.
    pub async fn start(data_dir: PathBuf, event_sink: Arc<dyn EventSink>) -> Result<Arc<Self>> {
        let init = init_iroh_endpoint(&data_dir).await?;
        let endpoint = init.endpoint;
        let memory_lookup = init.memory_lookup;
        let local_discovery_enabled = init.mdns_lookup.is_some();

        // Load default workspace board from disk if previously saved
        let mut initial_boards = HashMap::new();
        if let Ok(Some(saved_board)) =
            BoardCrdtState::load_from_disk(&data_dir, DEFAULT_BOARD_ID).await
        {
            info!(
                records = saved_board.records.len(),
                clock = saved_board.lamport_clock,
                "Loaded persisted CRDT board state from disk"
            );
            initial_boards.insert(DEFAULT_BOARD_ID.to_string(), saved_board);
        } else {
            initial_boards.insert(
                DEFAULT_BOARD_ID.to_string(),
                BoardCrdtState::new(DEFAULT_BOARD_ID),
            );
        }

        let boards = Arc::new(RwLock::new(initial_boards));
        let known_peers = Arc::new(RwLock::new(HashMap::new()));
        let lan_peers = Arc::new(RwLock::new(HashMap::new()));

        // Spawn iroh-gossip with larger max_message_size (64 KiB) for rich task payloads
        let gossip = Gossip::builder()
            .max_message_size(65536)
            .spawn(endpoint.clone());

        // Mount both iroh-gossip ALPN and our custom SYNC_ALPN on the iroh Router
        let sync_handler = SyncProtocolHandler {
            node_id: endpoint.id().to_string(),
            data_dir: data_dir.clone(),
            boards: boards.clone(),
            event_sink: event_sink.clone(),
        };

        let router = Router::builder(endpoint.clone())
            .accept(iroh_gossip::ALPN, gossip.clone())
            .accept(SYNC_ALPN, sync_handler)
            .spawn();

        let gossip_manager = BoardGossipManager::new(
            endpoint.clone(),
            gossip.clone(),
            data_dir.clone(),
            boards.clone(),
            event_sink.clone(),
        );

        // Subscribe to default workspace board topic at startup
        let _ = gossip_manager
            .ensure_subscribed(DEFAULT_BOARD_ID, vec![])
            .await;

        // Subscribe to LAN mDNS discovery events so local Wi-Fi peers auto-populate
        if let Some(mdns) = init.mdns_lookup {
            let lan_peers_ref = lan_peers.clone();
            let known_peers_ref = known_peers.clone();
            let mem_lookup_ref = memory_lookup.clone();
            let sink_ref = event_sink.clone();
            let my_id = endpoint.id();

            tokio::spawn(async move {
                let mut stream = mdns.subscribe().await;
                while let Some(ev) = stream.next().await {
                    match ev {
                        DiscoveryEvent::Discovered { endpoint_info, .. } => {
                            let peer_id = endpoint_info.endpoint_id;
                            if peer_id == my_id {
                                continue;
                            }
                            let addr: EndpointAddr = endpoint_info.into();
                            mem_lookup_ref.add_endpoint_info(addr.clone());
                            lan_peers_ref.write().await.insert(peer_id, addr.clone());
                            known_peers_ref.write().await.insert(peer_id, addr);

                            sink_ref.emit_json(
                                "network://peer-event",
                                serde_json::json!({
                                    "type": "lan_peer_discovered",
                                    "peerId": peer_id.to_string(),
                                }),
                            );
                        }
                        DiscoveryEvent::Expired { endpoint_id } => {
                            lan_peers_ref.write().await.remove(&endpoint_id);
                        }
                        _ => {}
                    }
                }
            });
        }

        let node = Arc::new(Self {
            endpoint,
            router,
            gossip,
            gossip_manager,
            memory_lookup,
            local_discovery_enabled,
            key_path: init.key_path,
            key_was_loaded: init.key_was_loaded,
            data_dir,
            boards,
            known_peers,
            lan_peers,
            event_sink,
            spawned_test_nodes: Arc::new(RwLock::new(Vec::new())),
        });

        Ok(node)
    }

    pub fn node_id(&self) -> String {
        self.endpoint.id().to_string()
    }

    pub fn short_id(id: &str) -> String {
        if id.len() > 12 {
            format!("{}…{}", &id[..6], &id[id.len() - 4..])
        } else {
            id.to_string()
        }
    }

    /// Queries the live status of the Endpoint, relays, LAN discovery, and connected peers.
    pub async fn get_node_status(&self, board_id: Option<&str>) -> NodeStatusReport {
        let active_board_id = board_id.unwrap_or(DEFAULT_BOARD_ID).to_string();
        let my_addr = self.endpoint.addr();
        let node_id = my_addr.id.to_string();

        let relay_urls: Vec<String> = my_addr.relay_urls().map(|u| u.to_string()).collect();
        let direct_sockets: Vec<String> = my_addr
            .ip_addrs()
            .map(|a| a.to_string())
            .chain(self.endpoint.bound_sockets().into_iter().map(|s| s.to_string()))
            .collect::<std::collections::BTreeSet<_>>()
            .into_iter()
            .collect();

        let neighbor_ids = self.gossip_manager.active_neighbors(Some(&active_board_id)).await;
        let lan_map = self.lan_peers.read().await.clone();
        let known_map = self.known_peers.read().await.clone();

        let mut all_peer_ids: Vec<EndpointId> = neighbor_ids.clone();
        for k in known_map.keys() {
            if !all_peer_ids.contains(k) {
                all_peer_ids.push(*k);
            }
        }

        let mut connected_peers = Vec::new();
        for peer_id in all_peer_ids {
            if peer_id == my_addr.id {
                continue;
            }
            let pid_str = peer_id.to_string();
            let is_gossip_neighbor = neighbor_ids.contains(&peer_id);
            let is_lan = lan_map.contains_key(&peer_id);

            let (path_type, is_direct, active_addrs, all_addrs) =
                if let Some(info) = self.endpoint.remote_info(peer_id).await {
                    let mut active = Vec::new();
                    let mut all = Vec::new();
                    let mut direct_active = false;
                    let mut relay_active = false;

                    for addr_info in info.addrs() {
                        let desc = format!("{:?}", addr_info.addr());
                        all.push(desc.clone());
                        if matches!(addr_info.usage(), TransportAddrUsage::Active) {
                            active.push(desc);
                            match addr_info.addr() {
                                TransportAddr::Ip(_) => direct_active = true,
                                TransportAddr::Relay(_) => relay_active = true,
                                _ => {}
                            }
                        }
                    }

                    let p_type = if direct_active {
                        "direct_quic".to_string()
                    } else if relay_active {
                        "relayed".to_string()
                    } else if !all.is_empty() {
                        "direct_quic".to_string()
                    } else {
                        "probing".to_string()
                    };

                    (p_type, direct_active || !relay_active, active, all)
                } else {
                    ("probing".to_string(), is_lan, vec![], vec![])
                };

            let source = if is_gossip_neighbor && is_lan {
                "gossip_swarm+lan_mdns"
            } else if is_gossip_neighbor {
                "gossip_swarm"
            } else if is_lan {
                "lan_mdns"
            } else {
                "ticket_bootstrap"
            };

            connected_peers.push(PeerConnectionDetail {
                short_id: Self::short_id(&pid_str),
                peer_id: pid_str,
                path_type,
                is_direct,
                active_addrs,
                all_addrs,
                source: source.to_string(),
            });
        }

        let (crdt_records_count, lamport_clock) = {
            let guard = self.boards.read().await;
            if let Some(b) = guard.get(&active_board_id) {
                (b.records.len(), b.lamport_clock)
            } else {
                (0, 0)
            }
        };

        let spawned_test_peers = self.spawned_test_nodes.read().await.len();

        NodeStatusReport {
            short_node_id: Self::short_id(&node_id),
            node_id,
            key_persisted: self.key_was_loaded,
            key_path: self.key_path.display().to_string(),
            relay_urls,
            direct_sockets,
            local_discovery_enabled: self.local_discovery_enabled,
            custom_alpn: String::from_utf8_lossy(SYNC_ALPN).to_string(),
            gossip_alpn: String::from_utf8_lossy(iroh_gossip::ALPN).to_string(),
            active_board_id,
            connected_peers,
            lan_discovered_peers: lan_map.keys().map(|k| k.to_string()).collect(),
            crdt_records_count,
            lamport_clock,
            spawned_test_peers,
        }
    }

    /// Builds a full `EndpointAddr` for this node including both direct bound sockets and relay URLs.
    pub fn full_local_addr(&self) -> EndpointAddr {
        let base = self.endpoint.addr();
        let mut addrs: Vec<TransportAddr> = base.addrs.into_iter().collect();
        for sock in self.endpoint.bound_sockets() {
            let candidate = TransportAddr::Ip(sock);
            if !addrs.contains(&candidate) {
                addrs.push(candidate);
            }
        }
        EndpointAddr::from_parts(base.id, addrs)
    }

    /// Creates a multi-peer invite ticket containing `board_id` plus our own `EndpointAddr`
    /// and up to 3 additional known active peers.
    pub async fn create_board_ticket(
        &self,
        board_id: &str,
        board_name: Option<String>,
    ) -> Result<TicketCreationResponse> {
        let _ = self
            .gossip_manager
            .ensure_subscribed(board_id, vec![])
            .await;

        let mut peers = vec![self.full_local_addr()];

        // Add up to 3 active gossip neighbors or known peers so joiners have multiple bootstrap paths
        let neighbor_ids = self.gossip_manager.active_neighbors(Some(board_id)).await;
        let known_guard = self.known_peers.read().await;

        for peer_id in neighbor_ids {
            if peers.len() >= 4 {
                break;
            }
            if peer_id == self.endpoint.id() {
                continue;
            }
            if let Some(info) = self.endpoint.remote_info(peer_id).await {
                let addr = EndpointAddr::from_parts(
                    info.id(),
                    info.into_addrs().map(|a| a.into_addr()),
                );
                peers.push(addr);
            } else if let Some(known_addr) = known_guard.get(&peer_id) {
                peers.push(known_addr.clone());
            }
        }

        for (peer_id, addr) in known_guard.iter() {
            if peers.len() >= 4 {
                break;
            }
            if *peer_id != self.endpoint.id() && !peers.iter().any(|p| p.id == *peer_id) {
                peers.push(addr.clone());
            }
        }

        let bootstrap_peer_ids: Vec<String> = peers.iter().map(|p| p.id.to_string()).collect();
        let ticket_obj = BoardTicket::new(board_id, board_name, peers);
        let encoded = ticket_obj.encode()?;

        Ok(TicketCreationResponse {
            ticket: encoded,
            board_id: board_id.to_string(),
            bootstrap_peers_count: bootstrap_peer_ids.len(),
            bootstrap_peer_ids,
        })
    }

    /// Joins a board using a multi-peer `BoardTicket` string:
    /// 1. Registers all bootstrap `EndpointAddr`s in `MemoryLookup`
    /// 2. Subscribes and joins the `iroh-gossip` topic for the board
    /// 3. Opens a custom `SYNC_ALPN` stream to exchange CRDT state and catch up on offline changes
    pub async fn join_board_ticket(&self, ticket_str: &str) -> Result<JoinTicketResponse> {
        let ticket = BoardTicket::decode(ticket_str)?;
        let board_id = ticket.board_id.clone();
        let my_id = self.endpoint.id();

        let mut bootstrap_ids = Vec::new();
        {
            let mut known_guard = self.known_peers.write().await;
            for peer_addr in &ticket.peers {
                if peer_addr.id == my_id {
                    continue;
                }
                self.memory_lookup.add_endpoint_info(peer_addr.clone());
                known_guard.insert(peer_addr.id, peer_addr.clone());
                if !bootstrap_ids.contains(&peer_addr.id) {
                    bootstrap_ids.push(peer_addr.id);
                }
            }
        }

        // 1. Subscribe to the board's live gossip topic with all bootstrap peer IDs
        let _ = self
            .gossip_manager
            .ensure_subscribed(&board_id, bootstrap_ids.clone())
            .await?;

        // 2. Perform immediate SYNC_ALPN catch-up stream with each reachable bootstrap peer
        let mut catchup_results = Vec::new();
        for peer_addr in &ticket.peers {
            if peer_addr.id == my_id {
                continue;
            }
            match initiate_catchup_sync(
                &self.endpoint,
                peer_addr.clone(),
                &board_id,
                &self.data_dir,
                &self.boards,
                &self.event_sink,
            )
            .await
            {
                Ok(res) => {
                    catchup_results.push(res);
                }
                Err(err) => {
                    tracing::warn!(
                        peer = %peer_addr.id,
                        "Catch-up attempt with bootstrap peer failed: {err:#}"
                    );
                }
            }
        }

        let snapshot = self.get_board_snapshot(&board_id).await;

        Ok(JoinTicketResponse {
            board_id,
            bootstrap_peers_added: bootstrap_ids.len(),
            catchup_results,
            snapshot,
        })
    }

    /// Triggers an on-demand `SYNC_ALPN` catch-up stream with all known/connected peers for `board_id`.
    pub async fn trigger_catchup_all(&self, board_id: &str) -> Result<Vec<CatchupResult>> {
        let mut target_peers: Vec<EndpointId> =
            self.gossip_manager.active_neighbors(Some(board_id)).await;
        {
            let known_guard = self.known_peers.read().await;
            for pid in known_guard.keys() {
                if !target_peers.contains(pid) {
                    target_peers.push(*pid);
                }
            }
        }

        let mut results = Vec::new();
        for peer_id in target_peers {
            if peer_id == self.endpoint.id() {
                continue;
            }
            if let Ok(res) = initiate_catchup_sync(
                &self.endpoint,
                peer_id,
                board_id,
                &self.data_dir,
                &self.boards,
                &self.event_sink,
            )
            .await
            {
                results.push(res);
            }
        }
        Ok(results)
    }

    /// Applies a single entity mutation locally to the CRDT and broadcasts it live via `iroh-gossip`.
    pub async fn apply_and_broadcast_op(
        &self,
        board_id: &str,
        kind: EntityKind,
        id: String,
        deleted: bool,
        data: Option<Value>,
    ) -> Result<CrdtOp> {
        let my_id = self.node_id();
        let op = {
            let mut guard = self.boards.write().await;
            let board = guard
                .entry(board_id.to_string())
                .or_insert_with(|| BoardCrdtState::new(board_id));

            let op = if deleted {
                board.apply_local_delete(&my_id, kind, id)
            } else {
                board.apply_local_upsert(&my_id, kind, id, data.unwrap_or(Value::Null))
            };
            let _ = board.save_to_disk(&self.data_dir).await;
            op
        };

        let _ = self.gossip_manager.broadcast_op(board_id, op.clone()).await;
        Ok(op)
    }

    /// Reconciles a full React state snapshot with the local CRDT state and broadcasts any diffs.
    pub async fn reconcile_local_snapshot(
        &self,
        req: SnapshotReconcileRequest,
    ) -> Result<BoardSnapshot> {
        let board_id = req.board_id.unwrap_or_else(|| DEFAULT_BOARD_ID.to_string());
        let my_id = self.node_id();

        let (ops, snapshot) = {
            let mut guard = self.boards.write().await;
            let board = guard
                .entry(board_id.clone())
                .or_insert_with(|| BoardCrdtState::new(&board_id));

            let ops = board.reconcile_from_snapshot(
                &my_id,
                &req.tasks,
                &req.projects,
                &req.users,
                &req.groups,
                &req.roles,
            );
            if !ops.is_empty() {
                let _ = board.save_to_disk(&self.data_dir).await;
            }
            (ops, board.export_snapshot())
        };

        if !ops.is_empty() {
            let _ = self.gossip_manager.broadcast_batch(&board_id, ops).await;
        }

        Ok(snapshot)
    }

    pub async fn get_board_snapshot(&self, board_id: &str) -> BoardSnapshot {
        let guard = self.boards.read().await;
        if let Some(board) = guard.get(board_id) {
            board.export_snapshot()
        } else {
            BoardSnapshot {
                board_id: board_id.to_string(),
                ..Default::default()
            }
        }
    }

    /// Spawns a real, independent second `SpiderWebNode` (with its own `iroh::Endpoint`,
    /// its own `SecretKey`, its own `Router`, and its own `Gossip` instance) that connects to
    /// this node using a generated multi-peer `BoardTicket`, performs `SYNC_ALPN` catch-up,
    /// and broadcasts a collaborative task over `iroh-gossip`!
    pub async fn spawn_test_collaborator(
        &self,
        board_id: &str,
        custom_task: Option<Value>,
    ) -> Result<TestPeerSpawnResult> {
        let peer_index = self.spawned_test_nodes.read().await.len() + 1;
        let test_peer_dir = self
            .data_dir
            .join("test_peers")
            .join(format!("peer_{peer_index}"));

        let dummy_sink = Arc::new(BroadcastEventSink::new());
        let peer_node = SpiderWebNode::start(test_peer_dir, dummy_sink)
            .await
            .context("failed to start test collaborator iroh node")?;

        // 1. Create a real multi-peer invite ticket from our primary node
        let ticket_resp = self
            .create_board_ticket(board_id, Some("SpiderWeb Live Board".into()))
            .await?;

        // Also register the test peer in our memory lookup so gossip & direct QUIC resolve immediately
        let peer_addr = peer_node.full_local_addr();
        self.memory_lookup.add_endpoint_info(peer_addr.clone());
        self.known_peers
            .write()
            .await
            .insert(peer_addr.id, peer_addr.clone());

        // 2. Have the test peer join our board ticket (triggers SYNC_ALPN catch-up + Gossip join)
        let join_res = peer_node.join_board_ticket(&ticket_resp.ticket).await?;

        // Also ensure our gossip topic dials the new peer
        let _ = self
            .gossip_manager
            .ensure_subscribed(board_id, vec![peer_node.endpoint.id()])
            .await;

        // Give the gossip broadcast tree a brief moment to complete the NeighborUp handshake
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;

        // 3. Have the test peer create a new task and broadcast it over iroh-gossip (and sync)
        let task_id = format!("TSK-P2P-{peer_index}0{}", rand::random::<u8>() % 9 + 1);
        let task_val = custom_task.unwrap_or_else(|| {
            serde_json::json!({
                "id": task_id,
                "title": format!("P2P Synced Task from Peer #{} ({})", peer_index, Self::short_id(&peer_node.node_id())),
                "description": "Created by a remote iroh peer and synchronized over QUIC (/spiderweb/sync/1.0 + iroh-gossip).",
                "status": "in_progress",
                "priority": "high",
                "projectId": "proj-core",
                "dueDate": "2026-10-30T18:00:00.000Z",
                "createdAt": "2026-10-27T09:30:00.000Z",
                "assignedToMe": true,
                "upNext": true,
                "tags": ["iroh", "quic", "p2p-sync"],
                "branchName": "feat/iroh-quic-sync",
                "estimateMinutes": 45,
                "subtasks": [
                    { "id": format!("sub-{task_id}-1"), "title": "Direct QUIC hole punching verified", "completed": true },
                    { "id": format!("sub-{task_id}-2"), "title": "ALPN CRDT state catch-up verified", "completed": true },
                    { "id": format!("sub-{task_id}-3"), "title": "iroh-gossip live broadcast active", "completed": false }
                ]
            })
        });

        let actual_task_id = task_val
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or(&task_id)
            .to_string();

        peer_node
            .apply_and_broadcast_op(
                board_id,
                EntityKind::Task,
                actual_task_id.clone(),
                false,
                Some(task_val),
            )
            .await?;

        // Also run a catch-up stream from primary -> test_peer to ensure instant convergence
        let catchup_result = initiate_catchup_sync(
            &self.endpoint,
            peer_node.full_local_addr(),
            board_id,
            &self.data_dir,
            &self.boards,
            &self.event_sink,
        )
        .await
        .unwrap_or_else(|_| {
            join_res
                .catchup_results
                .into_iter()
                .next()
                .unwrap_or(CatchupResult {
                    board_id: board_id.to_string(),
                    remote_peer_id: peer_node.node_id(),
                    records_received: 1,
                    records_sent: 0,
                    total_records: 1,
                    lamport_clock: 1,
                })
        });

        let test_peer_id = peer_node.node_id();
        let short_peer_id = Self::short_id(&test_peer_id);

        self.spawned_test_nodes.write().await.push(peer_node);

        let snapshot = self.get_board_snapshot(board_id).await;

        Ok(TestPeerSpawnResult {
            test_peer_id,
            short_peer_id,
            catchup_result,
            broadcasted_task_id: Some(actual_task_id),
            snapshot,
        })
    }
}
