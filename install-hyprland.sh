#!/usr/bin/env bash
# Install SpiderWeb native desktop binary, sharp black spider icon, & launcher entry
set -e

cd /home/umbra/Projects/Coding/spider-web

mkdir -p "$HOME/.local/bin"
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.local/share/icons/hicolor/scalable/apps"

cp -f /home/umbra/Projects/Coding/spider-web/spiderweb "$HOME/.local/bin/spiderweb"
chmod +x "$HOME/.local/bin/spiderweb"
chmod +x /home/umbra/Projects/Coding/spider-web/hyprland-launch.sh

cp -f /home/umbra/Projects/Coding/spider-web/public/spider-icon.svg "$HOME/.local/share/icons/hicolor/scalable/apps/spiderweb.svg"
cp -f /home/umbra/Projects/Coding/spider-web/spiderweb.desktop "$HOME/.local/share/applications/spiderweb.desktop"

echo "✓ Installed native binary to: ~/.local/bin/spiderweb"
echo "✓ Installed sharp black spider icon to: ~/.local/share/icons/hicolor/scalable/apps/spiderweb.svg"
echo "✓ Installed desktop entry to: ~/.local/share/applications/spiderweb.desktop"
