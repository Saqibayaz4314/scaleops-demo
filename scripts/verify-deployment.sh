#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# verify-deployment.sh — Verify application health after deploy
#
# Usage:
#   bash scripts/verify-deployment.sh <alb-dns-or-url> [expected-version]
#
# Examples:
#   bash scripts/verify-deployment.sh http://my-alb.us-east-1.elb.amazonaws.com
#   bash scripts/verify-deployment.sh http://my-alb.us-east-1.elb.amazonaws.com abc1234
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ALB_URL="${1:-}"
EXPECTED_VERSION="${2:-}"
MAX_WAIT=300   # 5 minutes
INTERVAL=10

if [ -z "$ALB_URL" ]; then
  echo "Usage: $0 <alb-url> [expected-version]"
  exit 1
fi

# Normalise — strip trailing slash
ALB_URL="${ALB_URL%/}"

echo "=== ScaleOps Deployment Verification ==="
echo "Target:   $ALB_URL"
echo "Version:  ${EXPECTED_VERSION:-'(any)'}"
echo ""

# ── 1. Wait for health check ──
echo "--- Checking /api/health ---"
ELAPSED=0
while true; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$ALB_URL/api/health" || echo "000")
  echo "  HTTP $HTTP_CODE (${ELAPSED}s elapsed)"

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✅ /api/health OK"
    break
  fi

  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo "  ❌ Timed out waiting for health check"
    exit 1
  fi

  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

# ── 2. Check /api/info ──
echo ""
echo "--- Checking /api/info ---"
INFO=$(curl -sf --max-time 10 "$ALB_URL/api/info" || echo '{}')
echo "$INFO" | python3 -m json.tool 2>/dev/null || echo "$INFO"

# Verify version if expected
if [ -n "$EXPECTED_VERSION" ]; then
  DEPLOYED_VERSION=$(echo "$INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('appVersion',''))" 2>/dev/null || echo "")
  if echo "$DEPLOYED_VERSION" | grep -q "$EXPECTED_VERSION"; then
    echo "  ✅ Version match: $DEPLOYED_VERSION"
  else
    echo "  ⚠️  Version mismatch — expected=$EXPECTED_VERSION actual=$DEPLOYED_VERSION"
    echo "     (Instances may still be refreshing — check ASG status)"
  fi
fi

# ── 3. Check /api/metrics ──
echo ""
echo "--- Checking /api/metrics ---"
METRICS=$(curl -sf --max-time 10 "$ALB_URL/api/metrics" || echo '{}')
echo "$METRICS" | python3 -m json.tool 2>/dev/null || echo "$METRICS"

echo ""
echo "=== Verification complete ✅ ==="
echo ""
echo "Useful links:"
echo "  Health:  $ALB_URL/api/health"
echo "  Info:    $ALB_URL/api/info"
echo "  Metrics: $ALB_URL/api/metrics"
