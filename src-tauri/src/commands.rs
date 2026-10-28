use std::sync::Arc;
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use tracing::{info, warn};

use crate::network::{
    crdt::EntityKind, SnapshotReconcileRequest, SpiderWebNode, DEFAULT_BOARD_ID,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastOpArgs {
    pub board_id: Option<String>,
    pub kind: EntityKind,
    pub id: String,
    #[serde(default)]
    pub deleted: bool,
    pub data: Option<Value>,
}

/// Dispatches an IPC command from React (used by both Tauri command handlers and the local IPC bridge).
pub async fn dispatch_command(
    node: &Arc<SpiderWebNode>,
    command: &str,
    args: Value,
) -> Result<Value> {
    match command {
        "get_node_status" => {
            let board_id = args.get("boardId").and_then(|v| v.as_str());
            let status = node.get_node_status(board_id).await;
            Ok(serde_json::to_value(status)?)
        }
        "create_board_ticket" => {
            let board_id = args
                .get("boardId")
                .and_then(|v| v.as_str())
                .unwrap_or(DEFAULT_BOARD_ID);
            let board_name = args
                .get("boardName")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let res = node.create_board_ticket(board_id, board_name).await?;
            Ok(serde_json::to_value(res)?)
        }
        "join_board_ticket" => {
            let ticket = args
                .get("ticket")
                .and_then(|v| v.as_str())
                .context("missing `ticket` argument")?;
            let res = node.join_board_ticket(ticket).await?;
            Ok(serde_json::to_value(res)?)
        }
        "broadcast_board_op" => {
            let parsed: BroadcastOpArgs = serde_json::from_value(args)
                .context("invalid arguments for broadcast_board_op")?;
            let board_id = parsed
                .board_id
                .unwrap_or_else(|| DEFAULT_BOARD_ID.to_string());
            let op = node
                .apply_and_broadcast_op(&board_id, parsed.kind, parsed.id, parsed.deleted, parsed.data)
                .await?;
            Ok(serde_json::to_value(op)?)
        }
        "reconcile_board_snapshot" => {
            let parsed: SnapshotReconcileRequest = serde_json::from_value(args)
                .context("invalid arguments for reconcile_board_snapshot")?;
            let snapshot = node.reconcile_local_snapshot(parsed).await?;
            Ok(serde_json::to_value(snapshot)?)
        }
        "get_board_snapshot" => {
            let board_id = args
                .get("boardId")
                .and_then(|v| v.as_str())
                .unwrap_or(DEFAULT_BOARD_ID);
            let snapshot = node.get_board_snapshot(board_id).await;
            Ok(serde_json::to_value(snapshot)?)
        }
        "trigger_peer_catchup" => {
            let board_id = args
                .get("boardId")
                .and_then(|v| v.as_str())
                .unwrap_or(DEFAULT_BOARD_ID);
            let results = node.trigger_catchup_all(board_id).await?;
            Ok(serde_json::to_value(results)?)
        }
        "spawn_test_peer" => {
            let board_id = args
                .get("boardId")
                .and_then(|v| v.as_str())
                .unwrap_or(DEFAULT_BOARD_ID);
            let custom_task = args.get("customTask").cloned();
            let res = node.spawn_test_collaborator(board_id, custom_task).await?;
            Ok(serde_json::to_value(res)?)
        }
        other => bail!("unknown command: {other}"),
    }
}

/// Runs a lightweight local loopback IPC server (`127.0.0.1:<port>`) supporting:
/// - `POST /invoke/<command>` -> executes `dispatch_command` and returns JSON
/// - `GET /events` -> Server-Sent Events (SSE) stream pushing `board://state-synced`,
///   `board://remote-op`, and `network://peer-event` to React in real time.
pub async fn start_local_ipc_bridge(
    node: Arc<SpiderWebNode>,
    events_tx: broadcast::Sender<(String, Value)>,
    port: u16,
) -> Result<()> {
    let addr = format!("127.0.0.1:{port}");
    let listener = TcpListener::bind(&addr)
        .await
        .with_context(|| format!("failed to bind local IPC bridge on {addr}"))?;

    info!("SpiderWeb Rust IPC bridge listening on http://{addr}");

    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, _)) => {
                    let node_ref = node.clone();
                    let tx_ref = events_tx.clone();
                    tokio::spawn(async move {
                        if let Err(err) = handle_ipc_connection(stream, node_ref, tx_ref).await {
                            tracing::debug!("IPC connection closed: {err:#}");
                        }
                    });
                }
                Err(err) => {
                    warn!("IPC accept error: {err:#}");
                }
            }
        }
    });

    Ok(())
}

async fn handle_ipc_connection(
    mut stream: TcpStream,
    node: Arc<SpiderWebNode>,
    events_tx: broadcast::Sender<(String, Value)>,
) -> Result<()> {
    let mut reader = BufReader::new(&mut stream);
    let mut request_line = String::new();
    if reader.read_line(&mut request_line).await? == 0 {
        return Ok(());
    }

    let parts: Vec<&str> = request_line.trim().split_whitespace().collect();
    if parts.len() < 2 {
        return Ok(());
    }
    let method = parts[0];
    let path = parts[1];

    let mut content_length: usize = 0;
    loop {
        let mut line = String::new();
        reader.read_line(&mut line).await?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            break;
        }
        if let Some((k, v)) = trimmed.split_once(':') {
            if k.trim().eq_ignore_ascii_case("content-length") {
                content_length = v.trim().parse().unwrap_or(0);
            }
        }
    }

    // CORS Preflight
    if method.eq_ignore_ascii_case("OPTIONS") {
        let resp = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Length: 0\r\n\r\n";
        stream.write_all(resp.as_bytes()).await?;
        return Ok(());
    }

    // Real-time Server-Sent Events stream for Tauri/React event listeners
    if method.eq_ignore_ascii_case("GET") && path.starts_with("/events") {
        let headers = "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: keep-alive\r\nAccess-Control-Allow-Origin: *\r\n\r\n";
        stream.write_all(headers.as_bytes()).await?;
        stream.flush().await?;

        let mut rx = events_tx.subscribe();
        // Send initial ready event
        let init_msg = format!(
            "data: {}\n\n",
            serde_json::json!({
                "event": "network://connected",
                "payload": { "nodeId": node.node_id() }
            })
        );
        stream.write_all(init_msg.as_bytes()).await?;
        stream.flush().await?;

        while let Ok((event_name, payload)) = rx.recv().await {
            let envelope = serde_json::json!({
                "event": event_name,
                "payload": payload,
            });
            let frame = format!("data: {envelope}\n\n");
            if stream.write_all(frame.as_bytes()).await.is_err() {
                break;
            }
            let _ = stream.flush().await;
        }
        return Ok(());
    }

    // Command invoke endpoint: POST /invoke/<command>
    if method.eq_ignore_ascii_case("POST") && path.starts_with("/invoke/") {
        let cmd_name = path.trim_start_matches("/invoke/").trim();
        let mut body_buf = vec![0u8; content_length];
        if content_length > 0 {
            reader.read_exact(&mut body_buf).await?;
        }

        let args: Value = if body_buf.is_empty() {
            serde_json::json!({})
        } else {
            serde_json::from_slice(&body_buf).unwrap_or_else(|_| serde_json::json!({}))
        };

        drop(reader);

        match dispatch_command(&node, cmd_name, args).await {
            Ok(result) => {
                let body = serde_json::to_vec(&serde_json::json!({
                    "ok": true,
                    "data": result,
                }))?;
                let header = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\n\r\n",
                    body.len()
                );
                stream.write_all(header.as_bytes()).await?;
                stream.write_all(&body).await?;
            }
            Err(err) => {
                let body = serde_json::to_vec(&serde_json::json!({
                    "ok": false,
                    "error": format!("{err:#}"),
                }))?;
                let header = format!(
                    "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\n\r\n",
                    body.len()
                );
                stream.write_all(header.as_bytes()).await?;
                stream.write_all(&body).await?;
            }
        }
        return Ok(());
    }

    let not_found = "HTTP/1.1 404 Not Found\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: 0\r\n\r\n";
    stream.write_all(not_found.as_bytes()).await?;
    Ok(())
}
