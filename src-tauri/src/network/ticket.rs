use anyhow::{bail, Context, Result};
use data_encoding::BASE32_NOPAD;
use iroh::{EndpointAddr, EndpointId};
use iroh_gossip::TopicId;
use serde::{Deserialize, Serialize};

pub const TICKET_PREFIX: &str = "swb1:";

/// A multi-peer board invitation ticket.
///
/// Contains the target `board_id` and 1..=4 bootstrap peers (`EndpointAddr`s, including
/// their `EndpointId`, home `RelayUrl`, and direct LAN/WAN IP socket addresses).
/// Including multiple known peers makes it much more likely a joiner can connect even
/// if the original inviter goes offline or is behind strict NAT.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BoardTicket {
    pub version: u8,
    pub board_id: String,
    pub board_name: Option<String>,
    pub peers: Vec<EndpointAddr>,
}

impl BoardTicket {
    pub fn new(
        board_id: impl Into<String>,
        board_name: Option<String>,
        peers: Vec<EndpointAddr>,
    ) -> Self {
        Self {
            version: 1,
            board_id: board_id.into(),
            board_name,
            peers,
        }
    }

    /// Deterministically derives the 32-byte `iroh_gossip::TopicId` for this board.
    pub fn topic_id(&self) -> TopicId {
        derive_board_topic(&self.board_id)
    }

    /// Returns all unique bootstrap `EndpointId`s in this ticket.
    pub fn bootstrap_ids(&self) -> Vec<EndpointId> {
        let mut ids = Vec::new();
        for addr in &self.peers {
            if !ids.contains(&addr.id) {
                ids.push(addr.id);
            }
        }
        ids
    }

    /// Serializes the ticket into a compact `swb1:<base32>` string.
    pub fn encode(&self) -> Result<String> {
        let json_bytes = serde_json::to_vec(self).context("failed to serialize BoardTicket")?;
        let encoded = BASE32_NOPAD.encode(&json_bytes).to_lowercase();
        Ok(format!("{TICKET_PREFIX}{encoded}"))
    }

    /// Parses a `swb1:<base32>` ticket string back into a `BoardTicket`.
    pub fn decode(input: &str) -> Result<Self> {
        let trimmed = input.trim();
        let payload = trimmed
            .strip_prefix(TICKET_PREFIX)
            .or_else(|| trimmed.strip_prefix("SWB1:"))
            .or_else(|| trimmed.strip_prefix("spiderweb-board:"))
            .unwrap_or(trimmed);

        let bytes = BASE32_NOPAD
            .decode(payload.to_ascii_uppercase().as_bytes())
            .context("invalid base32 encoding in board ticket")?;

        let ticket: Self =
            serde_json::from_slice(&bytes).context("invalid BoardTicket JSON payload")?;

        if ticket.board_id.trim().is_empty() {
            bail!("BoardTicket is missing board_id");
        }

        Ok(ticket)
    }
}

/// Derives a 32-byte `TopicId` for `iroh-gossip` from a human-readable `board_id`.
pub fn derive_board_topic(board_id: &str) -> TopicId {
    let hash = blake3::hash(format!("spiderweb:gossip:topic:v1:{board_id}").as_bytes());
    TopicId::from_bytes(*hash.as_bytes())
}
