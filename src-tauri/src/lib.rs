pub mod commands;
pub mod network;

use std::path::PathBuf;

/// Resolves the storage directory for the SpiderWeb node.
/// Respects `SPIDERWEB_DATA_DIR` so multiple peer instances can run side-by-side on one machine.
pub fn resolve_data_dir(port: u16) -> PathBuf {
    if let Ok(custom) = std::env::var("SPIDERWEB_DATA_DIR") {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    let base = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from(".spiderweb-data"))
        .join("spiderweb");

    if port != 17420 {
        base.join(format!("node-{port}"))
    } else {
        base
    }
}
