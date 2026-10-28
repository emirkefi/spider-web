use std::path::{Path, PathBuf};
use anyhow::{Context, Result};
use iroh::{
    address_lookup::memory::MemoryLookup,
    endpoint::presets,
    Endpoint, SecretKey,
};
use iroh_mdns_address_lookup::MdnsAddressLookup;
use tracing::info;

pub struct InitializedEndpoint {
    pub endpoint: Endpoint,
    pub memory_lookup: MemoryLookup,
    pub mdns_lookup: Option<MdnsAddressLookup>,
    pub key_path: PathBuf,
    pub key_was_loaded: bool,
}

/// Loads or creates a persisted 32-byte Ed25519 SecretKey so the user's NodeId / EndpointId
/// stays stable across restarts.
pub async fn load_or_create_secret_key(data_dir: &Path) -> Result<(SecretKey, PathBuf, bool)> {
    tokio::fs::create_dir_all(data_dir)
        .await
        .context("failed to create app data directory")?;

    let key_path = data_dir.join("iroh_identity.key");

    if key_path.exists() {
        let raw = tokio::fs::read(&key_path)
            .await
            .context("failed to read persisted iroh_identity.key")?;

        if raw.len() == 32 {
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&raw);
            let key = SecretKey::from_bytes(&arr);
            return Ok((key, key_path, true));
        }
    }

    let key = SecretKey::generate();
    tokio::fs::write(&key_path, key.to_bytes())
        .await
        .context("failed to persist iroh_identity.key")?;

    Ok((key, key_path, false))
}

/// Creates the application's single iroh Endpoint using:
/// 1. Persisted SecretKey
/// 2. Default `presets::N0` (public N0 relays + Pkarr/DNS global discovery)
/// 3. `MdnsAddressLookup` (`iroh-mdns-address-lookup`) for LAN/Wi-Fi discovery without internet
/// 4. `MemoryLookup` for out-of-band multi-peer invite tickets
pub async fn init_iroh_endpoint(data_dir: &Path) -> Result<InitializedEndpoint> {
    let (secret_key, key_path, key_was_loaded) = load_or_create_secret_key(data_dir).await?;
    let memory_lookup = MemoryLookup::new();

    let endpoint = Endpoint::builder(presets::N0)
        .secret_key(secret_key)
        .address_lookup(memory_lookup.clone())
        .bind()
        .await
        .context("failed to bind iroh Endpoint")?;

    // Attach mDNS local network discovery (LAN / same Wi-Fi without internet)
    let mdns_lookup = match MdnsAddressLookup::builder()
        .service_name("spiderweb-v1")
        .build(endpoint.id())
    {
        Ok(mdns) => {
            if let Ok(lookup_services) = endpoint.address_lookup() {
                lookup_services.add(mdns.clone());
            }
            info!("Local LAN mDNS discovery enabled (service: _spiderweb-v1._udp.local)");
            Some(mdns)
        }
        Err(err) => {
            tracing::warn!("mDNS local discovery could not bind multicast socket: {err:#}");
            None
        }
    };

    info!(
        endpoint_id = %endpoint.id(),
        persisted = key_was_loaded,
        "iroh Endpoint initialized with N0 preset + LAN discovery"
    );

    Ok(InitializedEndpoint {
        endpoint,
        memory_lookup,
        mdns_lookup,
        key_path,
        key_was_loaded,
    })
}
