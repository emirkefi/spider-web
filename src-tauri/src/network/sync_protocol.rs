use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use anyhow::{Context, Result};
use iroh::{
    endpoint::Connection,
    protocol::{AcceptError, ProtocolHandler},
    Endpoint, EndpointAddr,
};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::network::crdt::BoardCrdtState;
use crate::network::EventSink;

/// Custom ALPN protocol identifier for CRDT state catch-up over QUIC streams.
pub const SYNC_ALPN: &[u8] = b"/spiderweb/sync/1.0";

/// Maximum allowed catch-up payload size (16 MiB).
const MAX_SYNC_PAYLOAD_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncWireMessage {
    ExchangeRequest {
        board_id: String,
        sender_id: String,
        state: BoardCrdtState,
    },
    ExchangeResponse {
        board_id: String,
        responder_id: String,
        state: BoardCrdtState,
        records_merged_on_responder: usize,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatchupResult {
    pub board_id: String,
    pub remote_peer_id: String,
    pub records_received: usize,
    pub records_sent: usize,
    pub total_records: usize,
    pub lamport_clock: u64,
}

/// Protocol handler mounted on `iroh::protocol::Router` for `SYNC_ALPN`.
#[derive(Clone, Debug)]
pub struct SyncProtocolHandler {
    pub node_id: String,
    pub data_dir: PathBuf,
    pub boards: Arc<RwLock<HashMap<String, BoardCrdtState>>>,
    pub event_sink: Arc<dyn EventSink>,
}

impl ProtocolHandler for SyncProtocolHandler {
    async fn accept(&self, connection: Connection) -> Result<(), AcceptError> {
        let remote_id = connection.remote_id().to_string();
        debug!(remote = %remote_id, "Accepted incoming SYNC_ALPN connection");

        let (mut send, mut recv) = connection.accept_bi().await?;

        // 1. Read incoming ExchangeRequest from the joining/reconnecting peer
        let req_bytes = recv
            .read_to_end(MAX_SYNC_PAYLOAD_BYTES)
            .await
            .map_err(AcceptError::from_err)?;

        let req: SyncWireMessage =
            serde_json::from_slice(&req_bytes).map_err(AcceptError::from_err)?;

        match req {
            SyncWireMessage::ExchangeRequest {
                board_id,
                sender_id,
                state: remote_state,
            } => {
                let (merged_state, updated_count) = {
                    let mut boards = self.boards.write().await;
                    let board = boards
                        .entry(board_id.clone())
                        .or_insert_with(|| BoardCrdtState::new(&board_id));
                    let count = board.merge_remote_state(&remote_state);
                    let _ = board.save_to_disk(&self.data_dir).await;
                    (board.clone(), count)
                };

                info!(
                    board_id = %board_id,
                    peer = %sender_id,
                    updated_count,
                    "Completed responder side of SYNC_ALPN catch-up"
                );

                // If we learned new records from the peer, notify our local React UI
                if updated_count > 0 {
                    let snapshot = merged_state.export_snapshot();
                    self.event_sink.emit_json(
                        "board://state-synced",
                        serde_json::json!({
                            "boardId": board_id,
                            "remotePeerId": sender_id,
                            "updatedCount": updated_count,
                            "snapshot": snapshot,
                        }),
                    );
                }

                self.event_sink.emit_json(
                    "network://peer-event",
                    serde_json::json!({
                        "type": "alpn_catchup_served",
                        "boardId": board_id,
                        "peerId": sender_id,
                        "recordsMerged": updated_count,
                        "totalRecords": merged_state.records.len(),
                    }),
                );

                // 2. Send back our merged CRDT state so the peer gets everything they missed
                let resp = SyncWireMessage::ExchangeResponse {
                    board_id,
                    responder_id: self.node_id.clone(),
                    state: merged_state,
                    records_merged_on_responder: updated_count,
                };
                let resp_bytes = serde_json::to_vec(&resp).map_err(AcceptError::from_err)?;
                send.write_all(&resp_bytes)
                    .await
                    .map_err(AcceptError::from_err)?;
                send.finish()?;

                // Wait until the initiator closes the connection after reading the response
                let _ = tokio::time::timeout(Duration::from_secs(5), connection.closed()).await;
            }
            _ => {
                warn!("Unexpected message variant on incoming SYNC_ALPN stream");
            }
        }

        Ok(())
    }
}

/// Dials a peer over `SYNC_ALPN`, opens a bidirectional QUIC stream, and exchanges
/// full CRDT state for `board_id` so both peers catch up on any offline changes.
pub async fn initiate_catchup_sync(
    endpoint: &Endpoint,
    peer_addr: impl Into<EndpointAddr>,
    board_id: &str,
    data_dir: &PathBuf,
    boards: &Arc<RwLock<HashMap<String, BoardCrdtState>>>,
    event_sink: &Arc<dyn EventSink>,
) -> Result<CatchupResult> {
    let peer_addr = peer_addr.into();
    let remote_peer_id = peer_addr.id.to_string();

    let local_state = {
        let mut guard = boards.write().await;
        guard
            .entry(board_id.to_string())
            .or_insert_with(|| BoardCrdtState::new(board_id))
            .clone()
    };

    let conn = endpoint
        .connect(peer_addr, SYNC_ALPN)
        .await
        .context("failed to connect to peer via SYNC_ALPN")?;

    let (mut send, mut recv) = conn
        .open_bi()
        .await
        .context("failed to open bidirectional QUIC stream for catch-up")?;

    let req = SyncWireMessage::ExchangeRequest {
        board_id: board_id.to_string(),
        sender_id: endpoint.id().to_string(),
        state: local_state.clone(),
    };
    let req_bytes = serde_json::to_vec(&req)?;
    send.write_all(&req_bytes).await?;
    send.finish()?;

    let resp_bytes = recv
        .read_to_end(MAX_SYNC_PAYLOAD_BYTES)
        .await
        .context("failed to read ExchangeResponse from peer")?;

    let resp: SyncWireMessage =
        serde_json::from_slice(&resp_bytes).context("invalid ExchangeResponse JSON")?;

    conn.close(0u8.into(), b"sync-complete");

    match resp {
        SyncWireMessage::ExchangeResponse {
            board_id: resp_board_id,
            responder_id,
            state: remote_merged_state,
            records_merged_on_responder,
        } => {
            let (updated_locally, snapshot, total_records, lamport_clock) = {
                let mut guard = boards.write().await;
                let board = guard
                    .entry(resp_board_id.clone())
                    .or_insert_with(|| BoardCrdtState::new(&resp_board_id));
                let updated = board.merge_remote_state(&remote_merged_state);
                let _ = board.save_to_disk(data_dir).await;
                (
                    updated,
                    board.export_snapshot(),
                    board.records.len(),
                    board.lamport_clock,
                )
            };

            info!(
                board_id = %resp_board_id,
                peer = %responder_id,
                updated_locally,
                records_merged_on_responder,
                "Initiator completed SYNC_ALPN catch-up exchange"
            );

            // Emit state-synced event so React updates tasks/projects/team immediately
            event_sink.emit_json(
                "board://state-synced",
                serde_json::json!({
                    "boardId": resp_board_id,
                    "remotePeerId": responder_id,
                    "updatedCount": updated_locally,
                    "snapshot": snapshot,
                }),
            );

            event_sink.emit_json(
                "network://peer-event",
                serde_json::json!({
                    "type": "alpn_catchup_completed",
                    "boardId": resp_board_id,
                    "peerId": responder_id,
                    "recordsReceived": updated_locally,
                    "recordsSent": records_merged_on_responder,
                    "totalRecords": total_records,
                }),
            );

            Ok(CatchupResult {
                board_id: resp_board_id,
                remote_peer_id,
                records_received: updated_locally,
                records_sent: records_merged_on_responder,
                total_records,
                lamport_clock,
            })
        }
        _ => anyhow::bail!("unexpected response variant on SYNC_ALPN stream"),
    }
}
