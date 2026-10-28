use std::collections::BTreeMap;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntityKind {
    Task,
    Project,
    User,
    Group,
    Role,
}

impl EntityKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            EntityKind::Task => "task",
            EntityKind::Project => "project",
            EntityKind::User => "user",
            EntityKind::Group => "group",
            EntityKind::Role => "role",
        }
    }
}

/// Last-Write-Wins (LWW) Element Record with Hybrid Logical Clock (Lamport + wall-clock + NodeId tie-breaker)
/// and Tombstone support for conflict-free deletions across offline peers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LwwRecord {
    pub id: String,
    pub kind: EntityKind,
    pub clock: u64,
    pub updated_at_ms: u64,
    pub author_node_id: String,
    pub deleted: bool,
    pub data: Option<Value>,
}

impl LwwRecord {
    pub fn composite_key(kind: EntityKind, id: &str) -> String {
        format!("{}:{}", kind.as_str(), id)
    }

    pub fn key(&self) -> String {
        Self::composite_key(self.kind, &self.id)
    }

    /// Deterministic total ordering for CRDT convergence:
    /// 1. Higher Lamport `clock` wins
    /// 2. Higher `updated_at_ms` wins
    /// 3. Lexicographically higher `author_node_id` wins
    /// 4. If all equal, `deleted = true` wins over `deleted = false`
    pub fn supersedes(&self, existing: &LwwRecord) -> bool {
        (
            self.clock,
            self.updated_at_ms,
            self.author_node_id.as_str(),
            self.deleted,
        ) > (
            existing.clock,
            existing.updated_at_ms,
            existing.author_node_id.as_str(),
            existing.deleted,
        )
    }
}

/// An atomic CRDT operation broadcast over `iroh-gossip` or exchanged during catch-up.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrdtOp {
    pub board_id: String,
    pub record: LwwRecord,
}

/// Materialized board snapshot consumed directly by the React frontend.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardSnapshot {
    pub board_id: String,
    pub lamport_clock: u64,
    pub version_vector: BTreeMap<String, u64>,
    pub tasks: Vec<Value>,
    pub projects: Vec<Value>,
    pub users: Vec<Value>,
    pub groups: Vec<Value>,
    pub roles: Vec<Value>,
}

/// Full replicated CRDT state for a board, exchanged over the custom ALPN catch-up stream.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardCrdtState {
    pub board_id: String,
    pub lamport_clock: u64,
    pub version_vector: BTreeMap<String, u64>,
    pub records: BTreeMap<String, LwwRecord>,
}

impl BoardCrdtState {
    pub fn new(board_id: impl Into<String>) -> Self {
        Self {
            board_id: board_id.into(),
            lamport_clock: 0,
            version_vector: BTreeMap::new(),
            records: BTreeMap::new(),
        }
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }

    /// Creates and applies a local upsert operation (create or update entity).
    pub fn apply_local_upsert(
        &mut self,
        node_id: &str,
        kind: EntityKind,
        id: String,
        data: Value,
    ) -> CrdtOp {
        self.lamport_clock += 1;
        let clock = self.lamport_clock;
        self.version_vector.insert(node_id.to_string(), clock);

        let record = LwwRecord {
            id,
            kind,
            clock,
            updated_at_ms: Self::now_ms(),
            author_node_id: node_id.to_string(),
            deleted: false,
            data: Some(data),
        };

        self.records.insert(record.key(), record.clone());

        CrdtOp {
            board_id: self.board_id.clone(),
            record,
        }
    }

    /// Creates and applies a local tombstone deletion operation.
    pub fn apply_local_delete(&mut self, node_id: &str, kind: EntityKind, id: String) -> CrdtOp {
        self.lamport_clock += 1;
        let clock = self.lamport_clock;
        self.version_vector.insert(node_id.to_string(), clock);

        let record = LwwRecord {
            id,
            kind,
            clock,
            updated_at_ms: Self::now_ms(),
            author_node_id: node_id.to_string(),
            deleted: true,
            data: None,
        };

        self.records.insert(record.key(), record.clone());

        CrdtOp {
            board_id: self.board_id.clone(),
            record,
        }
    }

    /// Applies an incoming `CrdtOp` from a remote peer.
    /// Returns `true` if the operation superseded local state.
    pub fn apply_remote_op(&mut self, op: &CrdtOp) -> bool {
        self.apply_remote_record(&op.record)
    }

    pub fn apply_remote_record(&mut self, incoming: &LwwRecord) -> bool {
        let key = incoming.key();
        let should_apply = match self.records.get(&key) {
            Some(existing) => incoming.supersedes(existing),
            None => true,
        };

        if incoming.clock > self.lamport_clock {
            self.lamport_clock = incoming.clock;
        }
        let entry = self
            .version_vector
            .entry(incoming.author_node_id.clone())
            .or_insert(0);
        if incoming.clock > *entry {
            *entry = incoming.clock;
        }

        if should_apply {
            self.records.insert(key, incoming.clone());
            true
        } else {
            false
        }
    }

    /// Merges a complete remote `BoardCrdtState` (used during custom ALPN catch-up stream).
    /// Returns the number of records that were added or updated.
    pub fn merge_remote_state(&mut self, remote: &BoardCrdtState) -> usize {
        let mut updated_count = 0;
        for record in remote.records.values() {
            if self.apply_remote_record(record) {
                updated_count += 1;
            }
        }
        for (peer_id, peer_clock) in &remote.version_vector {
            let local_entry = self.version_vector.entry(peer_id.clone()).or_insert(0);
            if *peer_clock > *local_entry {
                *local_entry = *peer_clock;
            }
        }
        if remote.lamport_clock > self.lamport_clock {
            self.lamport_clock = remote.lamport_clock;
        }
        updated_count
    }

    /// Seeds or reconciles the CRDT state from a local React snapshot, returning any new `CrdtOp`s
    /// generated for changed items.
    pub fn reconcile_from_snapshot(
        &mut self,
        node_id: &str,
        tasks: &[Value],
        projects: &[Value],
        users: &[Value],
        groups: &[Value],
        roles: &[Value],
    ) -> Vec<CrdtOp> {
        let mut ops = Vec::new();
        ops.extend(self.reconcile_collection(node_id, EntityKind::Task, tasks));
        ops.extend(self.reconcile_collection(node_id, EntityKind::Project, projects));
        ops.extend(self.reconcile_collection(node_id, EntityKind::User, users));
        ops.extend(self.reconcile_collection(node_id, EntityKind::Group, groups));
        ops.extend(self.reconcile_collection(node_id, EntityKind::Role, roles));
        ops
    }

    fn reconcile_collection(
        &mut self,
        node_id: &str,
        kind: EntityKind,
        items: &[Value],
    ) -> Vec<CrdtOp> {
        let mut ops = Vec::new();
        for item in items {
            let Some(id) = item.get("id").and_then(|v| v.as_str()) else {
                continue;
            };
            let key = LwwRecord::composite_key(kind, id);
            let needs_update = match self.records.get(&key) {
                Some(existing) => existing.deleted || existing.data.as_ref() != Some(item),
                None => true,
            };
            if needs_update {
                let op = self.apply_local_upsert(node_id, kind, id.to_string(), item.clone());
                ops.push(op);
            }
        }
        ops
    }

    /// Materializes the current active (non-deleted) entities into a `BoardSnapshot` for React.
    pub fn export_snapshot(&self) -> BoardSnapshot {
        let mut tasks = Vec::new();
        let mut projects = Vec::new();
        let mut users = Vec::new();
        let mut groups = Vec::new();
        let mut roles = Vec::new();

        for record in self.records.values() {
            if record.deleted {
                continue;
            }
            let Some(ref data) = record.data else {
                continue;
            };
            match record.kind {
                EntityKind::Task => tasks.push(data.clone()),
                EntityKind::Project => projects.push(data.clone()),
                EntityKind::User => users.push(data.clone()),
                EntityKind::Group => groups.push(data.clone()),
                EntityKind::Role => roles.push(data.clone()),
            }
        }

        // Sort tasks by createdAt descending for consistent UI order
        tasks.sort_by(|a, b| {
            let ca = a.get("createdAt").and_then(|v| v.as_str()).unwrap_or("");
            let cb = b.get("createdAt").and_then(|v| v.as_str()).unwrap_or("");
            cb.cmp(ca)
        });

        BoardSnapshot {
            board_id: self.board_id.clone(),
            lamport_clock: self.lamport_clock,
            version_vector: self.version_vector.clone(),
            tasks,
            projects,
            users,
            groups,
            roles,
        }
    }

    /// Persists the CRDT state to disk so offline edits survive restarts.
    pub async fn save_to_disk(&self, data_dir: &Path) -> Result<()> {
        let boards_dir = data_dir.join("boards");
        tokio::fs::create_dir_all(&boards_dir).await?;
        let safe_name: String = self
            .board_id
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect();
        let path = boards_dir.join(format!("{safe_name}.crdt.json"));
        let json = serde_json::to_vec_pretty(self)?;
        tokio::fs::write(path, json).await?;
        Ok(())
    }

    /// Loads the persisted CRDT state from disk if present.
    pub async fn load_from_disk(data_dir: &Path, board_id: &str) -> Result<Option<Self>> {
        let safe_name: String = board_id
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect();
        let path = data_dir.join("boards").join(format!("{safe_name}.crdt.json"));
        if !path.exists() {
            return Ok(None);
        }
        let bytes = tokio::fs::read(&path)
            .await
            .context("failed to read persisted board CRDT state")?;
        let state: Self = serde_json::from_slice(&bytes)?;
        Ok(Some(state))
    }
}
