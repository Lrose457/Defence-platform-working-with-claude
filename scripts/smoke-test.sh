#!/bin/bash
#
# Headless smoke test for the deployed platform (or a dev server).
# Catches the "silent outage" class of failures — e.g. a revoked Supabase
# anon key baking a 404 shell into every SSR page — by asserting that key
# routes return real rendered data, not just a 200.
#
#   scripts/smoke-test.sh              # test http://localhost:3100
#   BASE=http://localhost:3300 scripts/smoke-test.sh
#   SMOKE_SKIP_TLE=1 scripts/smoke-test.sh   # CI: no refresh agent, so the
#                                            # TLE cache is legitimately cold
#
# Exit code 0 = all checks passed.

set -u

BASE="${BASE:-http://localhost:3100}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FAILURES=0

fetch() { # fetch <path> <outfile>
  curl -s -o "$2" -w "%{http_code}" "$BASE$1"
}

check() { # check <label> <condition-result: 0|1>
  if [ "$2" -eq 0 ]; then
    echo "  ok    $1"
  else
    echo "  FAIL  $1"
    FAILURES=$((FAILURES + 1))
  fi
}

text_of() { # visible-text extraction minus scripts/comments
  python3 - "$1" <<'PY'
import re, sys
html = open(sys.argv[1], encoding="utf-8", errors="replace").read()
html = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.S)
html = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.S)
html = re.sub(r"<!--.*?-->", "", html, flags=re.S)
text = re.sub(r"<[^>]+>", " ", html)
print(re.sub(r"\s+", " ", text).strip())
PY
}

visible_len() { # character count of the extracted visible text
  text_of "$1" | wc -c | tr -d ' '
}

echo "Smoke testing $BASE"

# --- /map: atlas shell renders with live data --------------------------------
# The Suspense fallback string stays in the stream even when content follows,
# so the discriminator is visible-text volume: shell-only renders ~900 chars,
# a healthy atlas render ~2000+ (header stats, legend, badges).
code=$(fetch /map "$TMP/map.html")
check "/map returns 200" $([ "$code" = "200" ]; echo $?)
map_text=$(text_of "$TMP/map.html")
case "$map_text" in *"Global Atlas"*) m=0;; *) m=1;; esac
check "/map renders the atlas header" $m
len=$(visible_len "$TMP/map.html")
check "/map streams real content (visible chars: $len)" $([ "$len" -ge 1500 ]; echo $? )

# --- /countries: shell page + lean JSON API (rows render client-side) --------
code=$(fetch /countries "$TMP/idx.html")
check "/countries returns 200" $([ "$code" = "200" ]; echo $?)
idx_text=$(text_of "$TMP/idx.html")
case "$idx_text" in *"Global defence countries"*) m=0;; *) m=1;; esac
check "/countries renders the page shell" $m
code=$(fetch /api/countries "$TMP/api-countries.json")
check "/api/countries returns 200" $([ "$code" = "200" ]; echo $?)
python3 - "$TMP/api-countries.json" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
    rows = d.get("rows") or []
    ok = len(rows) > 100 and any(r.get("name") == "United Kingdom" for r in rows)
    err = d.get("error")
    print(f"  {'ok   ' if ok else 'FAIL '} /api/countries rows={len(rows)} uk_present={ok}{(' error=' + err) if err else ''}")
    sys.exit(0 if ok else 1)
except Exception as exc:
    print(f"  FAIL  /api/countries unparsable: {exc}")
    sys.exit(1)
PY
[ $? -ne 0 ] && FAILURES=$((FAILURES + 1))

# --- /countries/1: full profile streams --------------------------------------
code=$(fetch /countries/1 "$TMP/c1.html")
check "/countries/1 returns 200" $([ "$code" = "200" ]; echo $?)
c1_text=$(text_of "$TMP/c1.html")
case "$c1_text" in *"United Kingdom"*) m=0;; *) m=1;; esac
check "/countries/1 renders the country name" $m
case "$c1_text" in *"Equipment inventory"*) m=0;; *) m=1;; esac
check "/countries/1 renders the inventory section" $m

# --- /hybrid-warfare: longitudinal tracker renders ---------------------------
# Works pre- and post-migration: the header/methodology always render, while
# rows (or the provisioning notice) depend on the 20261010 migration.
code=$(fetch /hybrid-warfare "$TMP/hw.html")
check "/hybrid-warfare returns 200" $([ "$code" = "200" ]; echo $?)
hw_text=$(text_of "$TMP/hw.html")
case "$hw_text" in *"Hybrid Warfare Tracker"*) m=0;; *) m=1;; esac
check "/hybrid-warfare renders the tracker header" $m
case "$hw_text" in *"Definition (sources)"*) m=0;; *) m=1;; esac
check "/hybrid-warfare renders the methodology" $m

# --- satellites: TLE cache healthy -------------------------------------------
code=$(fetch /api/satellites/status "$TMP/status.json")
check "/api/satellites/status returns 200" $([ "$code" = "200" ]; echo $?)
if [ "${SMOKE_SKIP_TLE:-0}" = "1" ]; then
  echo "  skip  TLE cache contents (SMOKE_SKIP_TLE=1)"
else
python3 - "$TMP/status.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
age = d.get("ageHours")
ok = (
    d.get("cached") is True
    and (d.get("count") or 0) > 0
    and age is not None
    and age <= 48
)
print(f"  {'ok   ' if ok else 'FAIL '} TLE cache cached={d.get('cached')} count={d.get('count')} ageHours={age}")
sys.exit(0 if ok else 1)
PY
[ $? -ne 0 ] && FAILURES=$((FAILURES + 1))
fi

# --- summary -----------------------------------------------------------------
if [ "$FAILURES" -gt 0 ]; then
  echo "$FAILURES check(s) failed"
  exit 1
fi
echo "All checks passed"
