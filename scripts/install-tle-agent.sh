#!/bin/bash
#
# Install (or re-install) the hourly TLE-refresh LaunchAgent.
#
# macOS TCC denies launchd-spawned jobs access to ~/Desktop, so this
# installer copies everything the agent needs OUT of the project folder:
#
#   scripts/tle-refresh.sh          → ~/Library/Application Support/dip-tle-refresh/
#   BSS_API_TOKEN (from .env.local) → ~/.config/dip/tle.env   (chmod 600)
#   scripts/com.lrose.dip-tle-refresh.plist → ~/Library/LaunchAgents/
#
# Idempotent: safe to re-run any time (e.g. after rotating BSS_API_TOKEN).
# Uninstall: launchctl bootout gui/$(id -u)/com.lrose.dip-tle-refresh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="$HOME/Library/Application Support/dip-tle-refresh"
ENV_DIR="$HOME/.config/dip"
PLIST_SRC="$PROJECT_DIR/scripts/com.lrose.dip-tle-refresh.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.lrose.dip-tle-refresh.plist"
LABEL="com.lrose.dip-tle-refresh"

# 1. Script copy (TCC-safe location).
mkdir -p "$INSTALL_DIR"
cp "$PROJECT_DIR/scripts/tle-refresh.sh" "$INSTALL_DIR/tle-refresh.sh"
chmod +x "$INSTALL_DIR/tle-refresh.sh"

# 2. Token env file (600, outside Desktop).
TOKEN=$(grep '^BSS_API_TOKEN=' "$PROJECT_DIR/.env.local" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -z "$TOKEN" ]; then
  echo "ERROR: BSS_API_TOKEN not found in $PROJECT_DIR/.env.local" >&2
  exit 1
fi
mkdir -p "$ENV_DIR"
umask 077
printf 'BSS_API_TOKEN=%s\n' "$TOKEN" > "$ENV_DIR/tle.env"
umask 022

# 3. Plist into LaunchAgents (write via temp file — file managers can't
#    write outside the project, so this copy IS the install step).
if [ "$PLIST_SRC" != "$PLIST_DST" ]; then
  mkdir -p "$HOME/Library/LaunchAgents"
  cp "$PLIST_SRC" "$PLIST_DST"
fi
plutil -lint "$PLIST_DST"

# 4. (Re)load the agent.
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
launchctl enable "gui/$(id -u)/$LABEL"

echo "Installed. Test now with:"
echo "  launchctl kickstart gui/\$(id -u)/$LABEL && tail -1 /tmp/dip-tle-refresh.log"
