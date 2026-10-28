#!/usr/bin/env bash
# Install SpiderWeb native desktop binary, Iroh P2P networking core, icon, & launcher entry
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p "$HOME/.local/bin"
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.local/share/icons/hicolor/scalable/apps"

cp -f "$SCRIPT_DIR/spiderweb" "$HOME/.local/bin/spiderweb"
chmod +x "$HOME/.local/bin/spiderweb"

if [ -f "$SCRIPT_DIR/spiderweb-core" ]; then
  cp -f "$SCRIPT_DIR/spiderweb-core" "$HOME/.local/bin/spiderweb-core"
  chmod +x "$HOME/.local/bin/spiderweb-core"
  echo "✓ Installed Iroh P2P core to: ~/.local/bin/spiderweb-core"
elif [ -f "$SCRIPT_DIR/src-tauri/target/release/spiderweb-core" ]; then
  cp -f "$SCRIPT_DIR/src-tauri/target/release/spiderweb-core" "$HOME/.local/bin/spiderweb-core"
  chmod +x "$HOME/.local/bin/spiderweb-core"
  echo "✓ Installed Iroh P2P core to: ~/.local/bin/spiderweb-core"
elif [ -f "$SCRIPT_DIR/src-tauri/target/debug/spiderweb-core" ]; then
  cp -f "$SCRIPT_DIR/src-tauri/target/debug/spiderweb-core" "$HOME/.local/bin/spiderweb-core"
  chmod +x "$HOME/.local/bin/spiderweb-core"
  echo "✓ Installed Iroh P2P core to: ~/.local/bin/spiderweb-core"
fi

chmod +x "$SCRIPT_DIR/hyprland-launch.sh"

cp -f "$SCRIPT_DIR/public/spider-icon.svg" "$HOME/.local/share/icons/hicolor/scalable/apps/spiderweb.svg"

sed -e "s|Exec=.*|Exec=$HOME/.local/bin/spiderweb|g" \
    -e "s|Icon=.*|Icon=$HOME/.local/share/icons/hicolor/scalable/apps/spiderweb.svg|g" \
    "$SCRIPT_DIR/spiderweb.desktop" > "$HOME/.local/share/applications/spiderweb.desktop"

echo "✓ Installed native binary to: ~/.local/bin/spiderweb"
echo "✓ Installed sharp black spider icon to: ~/.local/share/icons/hicolor/scalable/apps/spiderweb.svg"
echo "✓ Installed desktop entry to: ~/.local/share/applications/spiderweb.desktop"
