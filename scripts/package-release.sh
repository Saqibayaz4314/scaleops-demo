#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# package-release.sh — Build and package the Next.js standalone artifact
#
# Usage:
#   bash scripts/package-release.sh <git-sha>
#
# Expects:
#   - npm run build has been run (or run it here)
#   - .next/standalone/, .next/static/, public/ exist
#
# Produces:
#   /tmp/scaleops-release/scaleops-demo-<sha>.tar.gz
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo "local")
fi

echo "Packaging release: $VERSION"

WORK_DIR="/tmp/scaleops-release-work"
OUT_DIR="/tmp/scaleops-release"
PACKAGE_DIR="$WORK_DIR/scaleops-demo-$VERSION"
TARBALL="$OUT_DIR/scaleops-demo-$VERSION.tar.gz"

rm -rf "$WORK_DIR" "$OUT_DIR"
mkdir -p "$PACKAGE_DIR" "$OUT_DIR"

# ── Copy Next.js standalone server ──
if [ ! -d ".next/standalone" ]; then
  echo "❌ .next/standalone not found. Run 'npm run build' first."
  exit 1
fi

cp -r .next/standalone/. "$PACKAGE_DIR/standalone/"

# ── Copy static assets (required for standalone) ──
mkdir -p "$PACKAGE_DIR/.next/static"
cp -r .next/static/. "$PACKAGE_DIR/.next/static/"

# ── Copy public assets ──
if [ -d "public" ]; then
  mkdir -p "$PACKAGE_DIR/public"
  cp -r public/. "$PACKAGE_DIR/public/"
fi

# ── Write version manifest ──
cat > "$PACKAGE_DIR/version.json" <<EOF
{
  "version": "$VERSION",
  "buildTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "nodeVersion": "$(node --version 2>/dev/null || echo 'unknown')"
}
EOF

# ── Create tarball ──
echo "Creating tarball at $TARBALL..."
tar -czf "$TARBALL" -C "$WORK_DIR" "scaleops-demo-$VERSION"

SIZE=$(du -sh "$TARBALL" | cut -f1)
echo "✅ Artifact: $TARBALL ($SIZE)"
echo "   Verify: tar -tzf '$TARBALL' | head -20"

rm -rf "$WORK_DIR"
