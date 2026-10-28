use std::sync::Arc;
use anyhow::Result;
use spiderweb_core::{
    commands::start_local_ipc_bridge,
    network::{BroadcastEventSink, SpiderWebNode},
    resolve_data_dir,
};
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "spiderweb_core=info,iroh=warn,iroh_gossip=info".into()),
        )
        .init();

    let port: u16 = std::env::var("SPIDERWEB_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(17420);

    let data_dir = resolve_data_dir(port);
    let broadcast_sink = Arc::new(BroadcastEventSink::new());

    info!(
        data_dir = %data_dir.display(),
        ipc_port = port,
        "Starting SpiderWeb Rust Core (iroh + iroh-gossip + SYNC_ALPN)"
    );

    let node = SpiderWebNode::start(data_dir, broadcast_sink.clone()).await?;
    start_local_ipc_bridge(node.clone(), broadcast_sink.tx.clone(), port).await?;

    let status = node.get_node_status(None).await;
    info!(
        node_id = %status.node_id,
        key_persisted = status.key_persisted,
        local_discovery = status.local_discovery_enabled,
        sockets = ?status.direct_sockets,
        "SpiderWeb iroh Endpoint ready"
    );

    // Wait for Ctrl+C and perform graceful iroh Router + Endpoint shutdown
    tokio::signal::ctrl_c().await?;
    info!("Shutting down SpiderWeb iroh Router...");
    let _ = node.router.shutdown().await;
    Ok(())
}
