#!/bin/bash
#
# Install (or re-install) the always-on app server LaunchAgent
# (com.lrose.dip-app): starts at login and restarts on crash, so the
# hourly TLE refresh agent always has something to hit on :3100.
#
# macOS TCC denies launchd jobs access to ~/Desktop, so the installer
# APFS-clones a self-contained production copy of the app (build output,
# node_modules, public assets, .env.local) into
# ~/Library/Application Support/dip-app and serves THAT. The project
# folder stays the source of truth: edit there, then re-run this script
# to redeploy (it rebuilds and re-syncs; downtime is a couple of seconds).
#
#   SKIP_BUILD=1 scripts/install-app-agent.sh   # redeploy without rebuild
#   Uninstall: launchctl bootout gui/$(id -u)/com.lrose.dip-app

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$HOME/Library/Application Support/dip-app"
PLIST_SRC="$PROJECT_DIR/scripts/com.lrose.dip-app.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.lrose.dip-app.plist"
LABEL="com.lrose.dip-app"
NODE_BIN="$(command -v node)"

# 1. Build in the project (cheap; skip with SKIP_BUILD=1).
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "Building…"
  (cd "$PROJECT_DIR" && npm run build > /tmp/dip-app-build.log 2>&1) \
    || { echo "Build failed — see /tmp/dip-app-build.log" >&2; exit 1; }
fi

# 2. Stop the old agent / any stray manual server before syncing.
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
sleep 2
lsof -ti:3100 | xargs kill -9 2>/dev/null || true

# 3. Sync the runtime copy (incremental rsync — after the first run only
#    changed files are copied).
mkdir -p "$APP_DIR"
rsync -a "$PROJECT_DIR/.next" "$APP_DIR/"
rsync -a "$PROJECT_DIR/public" "$APP_DIR/"
rsync -a "$PROJECT_DIR/package.json" "$APP_DIR/"
for f in "$PROJECT_DIR"/next.config.*; do
  [ -e "$f" ] && rsync -a "$f" "$APP_DIR/"
done
# node_modules: incrementally (no --delete; keeps the clone cheap).
rsync -a "$PROJECT_DIR/node_modules" "$APP_DIR/"
# Secrets ride along with owner-only permissions.
rsync -a "$PROJECT_DIR/.env.local" "$APP_DIR/.env.local"
chmod 600 "$APP_DIR/.env.local"

# 4. Install the plist with the real node path baked in.
mkdir -p "$HOME/Library/LaunchAgents"
sed "s|/usr/local/bin/node|$NODE_BIN|" "$PLIST_SRC" > "$PLIST_DST"
plutil -lint "$PLIST_DST"

# 5. Load and verify.
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
launchctl enable "gui/$(id -u)/$LABEL"
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://localhost:3100/map || true)
  [ "$code" = "200" ] && break
  sleep 2
done
if [ "${code:-}" = "200" ]; then
  # Warm the TLE cache so the atlas header shows real counts immediately
  # (the module cache is empty after every deploy).
  TOKEN=$(grep '^BSS_API_TOKEN=' "$APP_DIR/.env.local" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  curl -fsS --max-time 120 -H "Authorization: Bearer $TOKEN" \
    "http://localhost:3100/api/satellites?refresh=1" > /dev/null \
    && echo "TLE cache warmed." || echo "WARNING: TLE cache warm-up failed (hourly agent will retry)." >&2
  echo "App agent installed — serving on http://localhost:3100 (auto-start at login, keepalive on)."
else
  echo "WARNING: agent loaded but /map returned ${code:-no response} — check /tmp/dip-app.launchd.err" >&2
  exit 1
fi
