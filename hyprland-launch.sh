#!/usr/bin/env bash
# Ensure the Rust iroh P2P networking core is running on 127.0.0.1:17420
CORE_BIN="/home/umbra/Projects/Coding/spider-web/src-tauri/target/debug/spiderweb-core"
if [ -x "$CORE_BIN" ] && ! pgrep -f "spiderweb-core" >/dev/null 2>&1; then
  "$CORE_BIN" >/tmp/spiderweb-iroh-core.log 2>&1 &
fi

# Launch the standalone native GTK4/Wayland SpiderWeb binary
exec /home/umbra/Projects/Coding/spider-web/spiderweb "$@"

