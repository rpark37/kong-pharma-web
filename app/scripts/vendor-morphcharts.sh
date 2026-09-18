#!/usr/bin/env bash
# Vendors the MorphCharts libraries (core, spec, webgpuraytrace) and the client sample
# assets from a pinned upstream commit into this workspace.
#
# Usage:  scripts/vendor-morphcharts.sh            # clones upstream at the pinned commit
#         MORPHCHARTS_SRC=/path/to/checkout scripts/vendor-morphcharts.sh   # reuse a local clone
#
# To update: change COMMIT below, re-run, review the diff, then `npm run vendor:build`.
set -euo pipefail

REPO="https://github.com/microsoft/morphcharts.git"
COMMIT="508deab66bb7e2dffe7f7cfc45ee6a06c4b6d8e9"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$HERE/vendor/morphcharts"
PUBLIC="$HERE/public"

SRC="${MORPHCHARTS_SRC:-}"
TMP=""
if [[ -z "$SRC" ]]; then
  TMP="$(mktemp -d)"
  git clone --filter=blob:none --no-checkout "$REPO" "$TMP/morphcharts" >/dev/null
  git -C "$TMP/morphcharts" sparse-checkout set --no-cone \
    '/core/src/**' '/core/package.json' '/core/tsconfig.json' \
    '/spec/src/**' '/spec/package.json' '/spec/tsconfig.json' \
    '/renderers/webgpuraytrace/src/**' '/renderers/webgpuraytrace/package.json' '/renderers/webgpuraytrace/tsconfig.json' \
    '/tsconfig-base.json' '/globals.d.ts' '/LICENSE' \
    '/client/wwwroot/public/samples/specs/**' '/client/wwwroot/public/samples/images/*_640x360.jpg' \
    '/client/wwwroot/public/data/random_walk_*.csv' '/client/wwwroot/public/data/hierarachy_levels_4_rows_110.csv'
  git -C "$TMP/morphcharts" checkout --quiet "$COMMIT"
  SRC="$TMP/morphcharts"
fi

ACTUAL="$(git -C "$SRC" rev-parse HEAD)"
if [[ "$ACTUAL" != "$COMMIT" ]]; then
  echo "warning: source checkout is at $ACTUAL, expected $COMMIT" >&2
fi

rm -rf "$DEST"
mkdir -p "$DEST/core" "$DEST/spec" "$DEST/renderers/webgpuraytrace"
cp -R "$SRC/core/src" "$DEST/core/src"
cp "$SRC/core/package.json" "$SRC/core/tsconfig.json" "$DEST/core/"
cp -R "$SRC/spec/src" "$DEST/spec/src"
cp "$SRC/spec/package.json" "$SRC/spec/tsconfig.json" "$DEST/spec/"
cp -R "$SRC/renderers/webgpuraytrace/src" "$DEST/renderers/webgpuraytrace/src"
cp "$SRC/renderers/webgpuraytrace/package.json" "$SRC/renderers/webgpuraytrace/tsconfig.json" "$DEST/renderers/webgpuraytrace/"
cp "$SRC/tsconfig-base.json" "$SRC/globals.d.ts" "$SRC/LICENSE" "$DEST/"

cat > "$DEST/UPSTREAM.json" <<JSON
{
  "repository": "$REPO",
  "commit": "$ACTUAL",
  "vendoredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "license": "MIT",
  "paths": ["core", "spec", "renderers/webgpuraytrace", "client/wwwroot/public/samples", "client/wwwroot/public/data"]
}
JSON

# Client sample assets: specs, 640x360 thumbnails, and the small CSVs the specs reference.
rm -rf "$PUBLIC/samples" "$PUBLIC/data/morphcharts"
mkdir -p "$PUBLIC/samples/specs" "$PUBLIC/samples/images" "$PUBLIC/data"
cp "$SRC"/client/wwwroot/public/samples/specs/*.json "$PUBLIC/samples/specs/"
cp "$SRC"/client/wwwroot/public/samples/images/*_640x360.jpg "$PUBLIC/samples/images/"
for f in random_walk_count_100.csv random_walk_series_100_count_10.csv random_walk_series_10_count_100.csv hierarachy_levels_4_rows_110.csv; do
  cp "$SRC/client/wwwroot/public/data/$f" "$PUBLIC/data/$f"
done

if [[ -n "$TMP" ]]; then rm -rf "$TMP"; fi
echo "vendored morphcharts@$ACTUAL into $DEST"
