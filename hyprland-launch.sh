#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure the Rust iroh P2P networking core is running on 127.0.0.1:17420
for CANDIDATE in \
  "$HOME/.local/bin/spiderweb-core" \
  "$SCRIPT_DIR/spiderweb-core" \
  "$SCRIPT_DIR/src-tauri/target/release/spiderweb-core" \
  "$SCRIPT_DIR/src-tauri/target/debug/spiderweb-core"; do
  if [ -x "$CANDIDATE" ]; then
    CORE_BIN="$CANDIDATE"
    break
  fi
done

if [ -n "$CORE_BIN" ] && ! pgrep -f "spiderweb-core" >/dev/null 2>&1; then
  "$CORE_BIN" >/tmp/spiderweb-iroh-core.log 2>&1 &
fi

# Launch the standalone native GTK4/Wayland SpiderWeb binary
if [ -x "$HOME/.local/bin/spiderweb" ]; then
  exec "$HOME/.local/bin/spiderweb" "$@"
else
  exec "$SCRIPT_DIR/spiderweb" "$@"
fi
