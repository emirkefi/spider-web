use std::sync::Arc;
use std::time::Duration;
use anyhow::Result;
use spiderweb_core::network::{
    crdt::EntityKind,
    identity::load_or_create_secret_key,
    BroadcastEventSink, SpiderWebNode, DEFAULT_BOARD_ID,
};

#[tokio::test]
async fn test_persisted_identity_and_full_p2p_sync() -> Result<()> {
    let base_tmp = std::env::temp_dir().join(format!("spiderweb_p2p_test_{}", std::process::id()));
    let dir_a = base_tmp.join("peer_a");
    let dir_b = base_tmp.join("peer_b");
    let dir_c = base_tmp.join("peer_c");

    // 1. Verify persisted SecretKey produces identical EndpointId across restarts
    let (key1, _, loaded1) = load_or_create_secret_key(&dir_a).await?;
    assert!(!loaded1, "First creation should generate a new key");
    let (key2, _, loaded2) = load_or_create_secret_key(&dir_a).await?;
    assert!(loaded2, "Second load should read existing key from disk");
    assert_eq!(
        key1.public(),
        key2.public(),
        "EndpointId must remain stable across restarts"
    );

    // 2. Start Peer A (online first, creates tasks while Peer B is offline)
    let sink_a = Arc::new(BroadcastEventSink::new());
    let node_a = SpiderWebNode::start(dir_a.clone(), sink_a).await?;

    node_a
        .apply_and_broadcast_op(
            DEFAULT_BOARD_ID,
            EntityKind::Task,
            "TSK-OFFLINE-1".to_string(),
            false,
            Some(serde_json::json!({
                "id": "TSK-OFFLINE-1",
                "title": "Created on Peer A while Peer B was offline",
                "status": "todo",
                "priority": "urgent",
                "projectId": "proj-core",
                "createdAt": "2026-10-27T09:00:00Z"
            })),
        )
        .await?;

    node_a
        .apply_and_broadcast_op(
            DEFAULT_BOARD_ID,
            EntityKind::Task,
            "TSK-OFFLINE-2".to_string(),
            false,
            Some(serde_json::json!({
                "id": "TSK-OFFLINE-2",
                "title": "Second offline task on Peer A",
                "status": "in_progress",
                "priority": "high",
                "projectId": "proj-core",
                "createdAt": "2026-10-27T09:01:00Z"
            })),
        )
        .await?;

    // 3. Peer A generates an invite ticket
    let ticket_a = node_a
        .create_board_ticket(DEFAULT_BOARD_ID, Some("Core Engineering".into()))
        .await?;
    assert!(ticket_a.ticket.starts_with("swb1:"));
    assert_eq!(ticket_a.bootstrap_peers_count, 1);

    // 4. Peer B starts up and joins Peer A's ticket -> Custom ALPN (/spiderweb/sync/1.0)
    //    must catch Peer B up on both offline tasks!
    let sink_b = Arc::new(BroadcastEventSink::new());
    let mut rx_b = sink_b.tx.subscribe();
    let node_b = SpiderWebNode::start(dir_b.clone(), sink_b).await?;

    let join_b = node_b.join_board_ticket(&ticket_a.ticket).await?;
    assert_eq!(join_b.snapshot.tasks.len(), 2, "Peer B must receive both offline tasks via SYNC_ALPN catch-up");

    // 5. Verify multi-peer ticket: Peer B now creates a ticket which should include BOTH Peer B and Peer A!
    let ticket_b = node_b
        .create_board_ticket(DEFAULT_BOARD_ID, Some("Core Engineering".into()))
        .await?;
    assert!(
        ticket_b.bootstrap_peers_count >= 2,
        "Ticket from Peer B should contain multiple bootstrap peers (Peer B + Peer A)"
    );

    // 6. Test live `iroh-gossip` broadcast between Peer A and Peer B
    // Ensure Peer A also knows Peer B in its gossip topic
    node_a
        .memory_lookup
        .add_endpoint_info(node_b.full_local_addr());
    let _ = node_a
        .gossip_manager
        .ensure_subscribed(DEFAULT_BOARD_ID, vec![node_b.endpoint.id()])
        .await;

    // Wait briefly for gossip NeighborUp
    tokio::time::sleep(Duration::from_millis(350)).await;

    // Peer A broadcasts a live task move / creation over iroh-gossip
    node_a
        .apply_and_broadcast_op(
            DEFAULT_BOARD_ID,
            EntityKind::Task,
            "TSK-LIVE-GOSSIP".to_string(),
            false,
            Some(serde_json::json!({
                "id": "TSK-LIVE-GOSSIP",
                "title": "Broadcast live over iroh-gossip",
                "status": "in_review",
                "priority": "high",
                "projectId": "proj-core",
                "createdAt": "2026-10-27T09:05:00Z"
            })),
        )
        .await?;

    // Wait up to 3 seconds for Peer B to receive the live gossip op (or catch-up)
    let mut received_live = false;
    let deadline = tokio::time::Instant::now() + Duration::from_secs(3);
    while tokio::time::Instant::now() < deadline {
        let snap = node_b.get_board_snapshot(DEFAULT_BOARD_ID).await;
        if snap.tasks.len() == 3 {
            received_live = true;
            break;
        }
        if let Ok(Ok((ev, _))) = tokio::time::timeout(Duration::from_millis(100), rx_b.recv()).await {
            if ev == "board://remote-op" || ev == "board://state-synced" {
                let snap = node_b.get_board_snapshot(DEFAULT_BOARD_ID).await;
                if snap.tasks.len() == 3 {
                    received_live = true;
                    break;
                }
            }
        }
    }
    assert!(received_live, "Peer B should receive live task update over iroh-gossip");

    // 7. Peer C joins using the multi-peer ticket from Peer B and catches up on all 3 tasks!
    let sink_c = Arc::new(BroadcastEventSink::new());
    let node_c = SpiderWebNode::start(dir_c.clone(), sink_c).await?;
    let join_c = node_c.join_board_ticket(&ticket_b.ticket).await?;
    assert_eq!(
        join_c.snapshot.tasks.len(),
        3,
        "Peer C joining multi-peer ticket must catch up on all 3 tasks"
    );

    // Clean shutdown
    let _ = node_a.router.shutdown().await;
    let _ = node_b.router.shutdown().await;
    let _ = node_c.router.shutdown().await;
    let _ = tokio::fs::remove_dir_all(&base_tmp).await;

    Ok(())
}
