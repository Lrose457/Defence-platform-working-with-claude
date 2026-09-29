#!/bin/bash
#
# Hourly TLE refresh for the Defence Intelligence Platform satellite atlas.
#
# Reads BSS_API_TOKEN from ~/.config/dip/tle.env at run time (the secret is
# never hardcoded here or in the launchd plist). That env file lives outside
# ~/Desktop deliberately: launchd-spawned jobs are denied Desktop access by
# macOS TCC even for the same user, so neither this script (installed copy)
# nor the env file may live in the project folder.
#
# Canonical install (see repo scripts/ for sources):
#   cp scripts/tle-refresh.sh "~/Library/Application Support/dip-tle-refresh/"
#   cp scripts/com.lrose.dip-tle-refresh.plist ~/Library/LaunchAgents/
#
# Installed as LaunchAgent: com.lrose.dip-tle-refresh (hourly at :00).

set -u

LOG_FILE="/tmp/dip-tle-refresh.log"
URL="http://localhost:3100/api/satellites?refresh=1"
ENV_FILE="$HOME/.config/dip/tle.env"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG_FILE"; }

if [ ! -f "$ENV_FILE" ]; then
  log "ERROR: $ENV_FILE not found — reinstall via project scripts/ (see header)"
  exit 1
fi

TOKEN=$(grep '^BSS_API_TOKEN=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -z "$TOKEN" ]; then
  log "ERROR: BSS_API_TOKEN not set in $ENV_FILE"
  exit 1
fi

response=$(mktemp)
http_code=$(curl -sS --max-time 120 -o "$response" -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" "$URL" 2>>"$LOG_FILE")
curl_status=$?

if [ $curl_status -ne 0 ]; then
  log "ERROR: curl failed (exit $curl_status) — is the app running on :3100?"
  rm -f "$response"
  exit 1
fi

if [ "$http_code" != "200" ]; then
  log "ERROR: HTTP $http_code from $URL"
  rm -f "$response"
  exit 1
fi

count=$(python3 -c "import json,sys; print(len(json.load(open(sys.argv[1])).get('data',[])))" "$response" 2>/dev/null || echo "?")
log "OK: refreshed TLE cache, $count satellite records"

# Keep the log from growing without bound: keep the last 2000 lines.
tail -n 2000 "$LOG_FILE" > "$LOG_FILE.tmp" 2>/dev/null && mv "$LOG_FILE.tmp" "$LOG_FILE"

rm -f "$response"
exit 0
