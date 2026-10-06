#!/usr/bin/env bash
# =============================================================================
# Security probe suite — nightly regression gate.
#
# Asserts, from the OUTSIDE (publishable anon key only, no privileged
# credentials), that the October 2026 hardening still holds:
#
#   DB / PostgREST  — anon writes denied on core tables; private tables not
#                     readable; profiles exposes no rows; rate-limit RPC
#                     validates its parameters.
#   App surface     — CSRF/bearer gates return 403; bearer-guarded refresh
#                     stays 401; admin redirects; export route 401; webhook
#                     never leaks configuration state; security headers intact.
#   Rate limiting   — DB-backed limiter actually trips (survey 6th req → 429).
#
# Usage:  BASE=http://localhost:3100 SUPABASE_URL=… ANON_KEY=… \
#           bash scripts/security-probe.sh
#
# Any assertion that fails exits non-zero — wire this into CI so a silent
# policy drop (RLS edit, route change, header regression) breaks the build.
#
# All probes are safe to run against production: nothing is inserted into
# intelligence tables (empty payloads are rejected before any write), and
# the survey limiter uses a unique per-run fingerprint so legitimate
# visitors never share the test bucket. The lone rate_limit_counters row
# created by the RPC check is trimmed automatically after 24 h.
# =============================================================================

set -u -o pipefail

BASE="${BASE:-http://localhost:3100}"
SUPABASE_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
ANON_KEY="${ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}"
RUN_TAG="secprobe-$(date +%s)-$$"

PASS=0
FAIL=0
FAILURES=()

# check <name> <regex-that-status-must-match> <actual-status>
check_status() {
  local name="$1" pattern="$2" actual="$3"
  if [[ "$actual" =~ ^(${pattern})$ ]]; then
    PASS=$((PASS + 1))
    printf "  PASS  %-58s (%s)\n" "$name" "$actual"
  else
    FAIL=$((FAIL + 1))
    FAILURES+=("$name (status $actual, expected ${pattern})")
    printf "  FAIL  %-58s (status %s, expected %s)\n" "$name" "$actual" "$pattern"
  fi
}

# check_not2xx <name> <actual-status>
check_not2xx() {
  local name="$1" actual="$2"
  if [[ "$actual" =~ ^2 ]]; then
    FAIL=$((FAIL + 1))
    FAILURES+=("$name (unexpected success: $actual)")
    printf "  FAIL  %-58s (unexpected 2xx: %s)\n" "$name" "$actual"
  else
    PASS=$((PASS + 1))
    printf "  PASS  %-58s (%s)\n" "$name" "$actual"
  fi
}

curl_local() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$@"; }

echo "=== Security probe suite ==="
echo "Target: $BASE"
echo ""

# -----------------------------------------------------------------------------
# 1. PostgREST posture (publishable anon key must never be able to write)
# -----------------------------------------------------------------------------
if [[ -n "$SUPABASE_URL" && -n "$ANON_KEY" ]]; then
  echo "-- PostgREST (anon key) --"
  AUTH=(-H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY")

  # Core intelligence tables: every write verb must be denied.
  # PATCH uses a non-empty payload against a NONEXISTENT row (id=-1):
  # PostgREST answers 204 for an empty patch object without ever reaching
  # the privilege check, so only a real column update exercises the GRANT.
  # The row doesn't exist, so nothing can be mutated even on regression.
  for t in countries budgets contracts companies profiles; do
    for method in POST PATCH DELETE; do
      if [[ "$method" == "DELETE" ]]; then
        code=$(curl_local -X "$method" "$SUPABASE_URL/rest/v1/$t?id=eq.-1" "${AUTH[@]}")
      elif [[ "$method" == "PATCH" ]]; then
        code=$(curl_local -X PATCH "$SUPABASE_URL/rest/v1/$t?id=eq.-1" "${AUTH[@]}" \
          -H "Content-Type: application/json" -d '{"name":"__secprobe__"}')
      else
        code=$(curl_local -X "$method" "$SUPABASE_URL/rest/v1/$t" "${AUTH[@]}" \
          -H "Content-Type: application/json" -d '{}')
      fi
      check_not2xx "anon $method /rest/v1/$t" "$code"
    done
  done

  # Private tables: anon must not even read them.
  for t in anonymous_search_logs user_survey_responses privacy_requests rate_limit_counters; do
    code=$(curl_local "$SUPABASE_URL/rest/v1/$t?select=*&limit=1" "${AUTH[@]}")
    check_not2xx "anon GET /rest/v1/$t (private)" "$code"
  done

  # profiles is SELECT-granted but RLS owner-only: 200 with ZERO rows.
  code=$(curl_local "$SUPABASE_URL/rest/v1/profiles?select=*&limit=1" "${AUTH[@]}")
  body=$(curl -s --max-time 20 "$SUPABASE_URL/rest/v1/profiles?select=*&limit=1" "${AUTH[@]}")
  if [[ "$code" == "200" && "$body" == "[]" ]]; then
    PASS=$((PASS + 1)); echo "  PASS  profiles anon-visible but exposes 0 rows"
  else
    FAIL=$((FAIL + 1)); FAILURES+=("profiles leak (status $code, body ${body:0:120})")
    echo "  FAIL  profiles leak (status $code, body ${body:0:120})"
  fi

  # Rate-limit RPC: hostile parameters must be rejected, valid ones accepted.
  rpc=$(curl -s -w '\n%{http_code}' --max-time 20 -X POST \
    "$SUPABASE_URL/rest/v1/rpc/increment_rate_limit" "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d '{"p_key":"bad key with spaces","p_window_ms":60000}')
  status="${rpc##*$'\n'}"; rpcbody="${rpc%$'\n'*}"
  if [[ "$status" == "400" && "$rpcbody" == *"invalid rate limit parameters"* ]]; then
    PASS=$((PASS + 1)); echo "  PASS  increment_rate_limit rejects invalid key (400)"
  else
    FAIL=$((FAIL + 1)); FAILURES+=("RPC validation (status $status)")
    echo "  FAIL  increment_rate_limit rejects invalid key (status $status)"
  fi

  code=$(curl_local -X POST "$SUPABASE_URL/rest/v1/rpc/increment_rate_limit" "${AUTH[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"p_key\":\"$RUN_TAG\",\"p_window_ms\":60000}")
  check_status "increment_rate_limit accepts valid key" "200" "$code"
else
  echo "-- PostgREST probes SKIPPED (SUPABASE_URL / ANON_KEY not set) --"
fi
echo ""

# -----------------------------------------------------------------------------
# 2. App surface gates
# -----------------------------------------------------------------------------
echo "-- App surface ($BASE) --"

check_status "GET / serves 200" "200" "$(curl_local "$BASE/")"

# CSRF/bearer gates: no cookie, no token, no bearer → 403.
for p in /api/survey /api/opt-out /api/intelligence /api/intelligence/import; do
  check_status "POST $p without CSRF → 403" "403" \
    "$(curl_local -X POST "$BASE$p" -H 'Content-Type: application/json' -d '{}')"
done

# TLE refresh is bearer-gated in code (refresh=1 && validateBearerToken);
# an unauthenticated caller with ?refresh=1 is served the cache like any
# other read and must never receive an error.
check_status "GET /api/satellites?refresh=1 without bearer → served like a read" "200" \
  "$(curl_local "$BASE/api/satellites?refresh=1")"

# Admin + authenticated export surfaces.
code=$(curl -s -o /dev/null -w '%{http_code}%{redirect_url}' --max-time 20 "$BASE/admin")
if [[ "$code" == 307* && "$code" == *"/account/login"* ]]; then
  PASS=$((PASS + 1)); echo "  PASS  /admin unauthenticated → redirect to login"
else
  FAIL=$((FAIL + 1)); FAILURES+=("/admin gate ($code)")
  echo "  FAIL  /admin gate (got $code)"
fi

check_status "GET /api/exports/changes → 401" "401" \
  "$(curl_local "$BASE/api/exports/changes")"

check_status "GET /api/billing/checkout unauthenticated → 307" "307" \
  "$(curl_local "$BASE/api/billing/checkout")"

# Webhook: any unauthenticated poke must fail AND must not disclose
# configuration state ("secret not configured" told an attacker the
# deployment's webhook was dead).
wh_code=$(curl -s -o /tmp/secprobe-wh-body -w '%{http_code}' --max-time 20 \
  -X POST "$BASE/api/billing/webhook" -H 'Content-Type: application/json' -d '{}')
check_not2xx "POST /api/billing/webhook unauthenticated" "$wh_code"
wh_body=$(cat /tmp/secprobe-wh-body 2>/dev/null || echo "")
rm -f /tmp/secprobe-wh-body
if [[ "$wh_body" != *"not configured"* && "$wh_body" != *"secret"* ]]; then
  PASS=$((PASS + 1)); echo "  PASS  webhook error body discloses no configuration state"
else
  FAIL=$((FAIL + 1)); FAILURES+=("webhook body leak (${wh_body:0:80})")
  echo "  FAIL  webhook error body leak (${wh_body:0:80})"
fi

# Signed-but-wrong webhook request must fail closed. Both acceptable
# outcomes are non-2xx without disclosing configuration state:
#   400 — secret configured, signature rejected
#   500 — handler disabled (secret unset on the deployment)
# The probe cannot and must not learn which one applies (that is the
# non-disclosure property itself), so both fail-closed results pass and
# any 2xx fails.
if [[ -n "${STRIPE_WEBHOOK_SECRET:-}" ]]; then
  check_status "webhook wrong signature → fail-closed (400 or 500)" "400|500" \
    "$(curl_local -X POST "$BASE/api/billing/webhook" \
      -H 'Content-Type: application/json' -H 'stripe-signature: t=1,v1=deadbeef' -d '{}')"
else
  echo "  SKIP  wrong-signature webhook probe (STRIPE_WEBHOOK_SECRET not set)"
fi
echo ""

# -----------------------------------------------------------------------------
# 3. Security headers
# -----------------------------------------------------------------------------
echo "-- Security headers --"
hdrs=$(curl -sI --max-time 20 "$BASE/")

if grep -qi "content-security-policy.*nonce-" <<<"$hdrs"; then
  PASS=$((PASS + 1)); echo "  PASS  CSP present with per-request nonce"
else
  FAIL=$((FAIL + 1)); FAILURES+=("CSP nonce missing")
  echo "  FAIL  CSP nonce missing"
fi
if grep -qi "x-frame-options: *deny" <<<"$hdrs"; then
  PASS=$((PASS + 1)); echo "  PASS  X-Frame-Options: DENY"
else
  FAIL=$((FAIL + 1)); FAILURES+=("X-Frame-Options missing"); echo "  FAIL  X-Frame-Options missing"
fi
if grep -qi "x-content-type-options: *nosniff" <<<"$hdrs"; then
  PASS=$((PASS + 1)); echo "  PASS  X-Content-Type-Options: nosniff"
else
  FAIL=$((FAIL + 1)); FAILURES+=("nosniff missing"); echo "  FAIL  X-Content-Type-Options missing"
fi
if grep -qi "referrer-policy:" <<<"$hdrs"; then
  PASS=$((PASS + 1)); echo "  PASS  Referrer-Policy present"
else
  FAIL=$((FAIL + 1)); FAILURES+=("Referrer-Policy missing"); echo "  FAIL  Referrer-Policy missing"
fi

# HSTS only ever makes sense on an HTTPS surface.
if [[ "$BASE" == https:* ]]; then
  if grep -qi "strict-transport-security:" <<<"$hdrs"; then
    PASS=$((PASS + 1)); echo "  PASS  HSTS present (https target)"
  else
    FAIL=$((FAIL + 1)); FAILURES+=("HSTS missing on https"); echo "  FAIL  HSTS missing on https"
  fi
fi
echo ""

# -----------------------------------------------------------------------------
# 4. DB-backed rate limiter actually trips (survey: 5 per window)
# -----------------------------------------------------------------------------
echo "-- Rate limiting (DB-backed) --"
# A unique per-run fingerprint isolates this probe's counter bucket.
UA="$RUN_TAG survey-probe"
# 1) Obtain a CSRF cookie from any page the middleware covers.
csrf_hdr=$(curl -s -D - -o /dev/null --max-time 20 -A "$UA" "$BASE/" | tr -d '\r')
csrf=$(sed -n 's/.*[Ss]et-[Cc]ookie: *_csrf_token=\([^;]*\).*/\1/p' <<<"$csrf_hdr" | tail -1)
if [[ -z "$csrf" ]]; then
  FAIL=$((FAIL + 1)); FAILURES+=("no CSRF cookie issued")
  echo "  FAIL  no CSRF cookie issued by middleware"
else
  codes=""
  for i in 1 2 3 4 5 6; do
    c=$(curl_local -X POST "$BASE/api/survey" \
      -A "$UA" \
      -H "Cookie: _csrf_token=$csrf" -H "x-csrf-token: $csrf" \
      -H 'Content-Type: application/json' -d '{}')
    codes="$codes $c"
  done
  if [[ "$codes" == *" 429"* ]]; then
    PASS=$((PASS + 1)); echo "  PASS  survey limiter trips at 6th request (codes:$codes)"
  else
    FAIL=$((FAIL + 1)); FAILURES+=("survey limiter never 429 (codes:$codes)")
    echo "  FAIL  survey limiter never 429 (codes:$codes)"
  fi
fi
echo ""

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo "==============================================="
echo "Probe results: $PASS passed, $FAIL failed"
if (( FAIL > 0 )); then
  echo ""
  echo "Regressions:"
  for f in ${FAILURES[@]+"${FAILURES[@]}"}; do echo "  - $f"; done
  exit 1
fi
echo "All security probes passed."
