use std::path::PathBuf;
use std::sync::Arc;
use anyhow::Result;
use spiderweb_core::network::{
    crdt::EntityKind, BroadcastEventSink, SpiderWebNode, DEFAULT_BOARD_ID,
};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("spiderweb_core=info,iroh=warn")
        .init();

    let args: Vec<String> = std::env::args().collect();
    let temp_dir = std::env::temp_dir().join(format!("spiderweb-cli-peer-{}", std::process::id()));
    let sink = Arc::new(BroadcastEventSink::new());
    let node = SpiderWebNode::start(PathBuf::from(&temp_dir), sink.clone()).await?;

    println!("=========================================================");
    println!(" SpiderWeb P2P CLI Peer");
    println!(" NodeId : {}", node.node_id());
    println!(" Sockets: {:?}", node.endpoint.bound_sockets());
    println!("=========================================================");

    if let Some(ticket) = args.get(1) {
        println!("Joining board via ticket: {}...", &ticket[..ticket.len().min(36)]);
        let res = node.join_board_ticket(ticket).await?;
        println!(
            "Connected! Board: '{}' | Bootstrap Peers: {} | Synced Tasks: {} | Projects: {}",
            res.board_id,
            res.bootstrap_peers_added,
            res.snapshot.tasks.len(),
            res.snapshot.projects.len()
        );

        if let Some(task_title) = args.get(2) {
            let task_id = format!("TSK-CLI-{}", rand::random::<u16>() % 900 + 100);
            let new_task = serde_json::json!({
                "id": task_id,
                "title": task_title,
                "description": "Created from spiderweb-peer-cli over iroh QUIC + iroh-gossip",
                "status": "todo",
                "priority": "urgent",
                "projectId": "proj-core",
                "dueDate": "2026-10-30T18:00:00.000Z",
                "createdAt": "2026-10-27T09:30:00.000Z",
                "assignedToMe": true,
                "upNext": true,
                "tags": ["cli-peer", "iroh"],
                "estimateMinutes": 30,
                "subtasks": []
            });
            node.apply_and_broadcast_op(
                &res.board_id,
                EntityKind::Task,
                task_id.clone(),
                false,
                Some(new_task),
            )
            .await?;
            println!("Broadcasted new task '{task_id}' ({task_title}) to swarm!");
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
    } else {
        let ticket = node
            .create_board_ticket(DEFAULT_BOARD_ID, Some("CLI Seed Board".into()))
            .await?;
        println!("Generated Invite Ticket:\n{}", ticket.ticket);
        println!("\nUsage: cargo run --bin spiderweb-peer-cli -- <swb1:ticket> [\"Optional New Task Title\"]");
    }

    let _ = node.router.shutdown().await;
    Ok(())
}
