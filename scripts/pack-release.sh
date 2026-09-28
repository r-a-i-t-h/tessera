#!/bin/sh
# Build a deployable tarball: one Node process (bundled API) plus the editor
# UI it serves. Seed is a template. Instance data (TESSERA_DATA) is not included.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

if [ ! -f package.json ]; then
  echo "pack-release: run from the repo (package.json missing)" >&2
  exit 1
fi

VERSION=${VERSION:-}
if [ -z "$VERSION" ]; then
  VERSION=$(node -p "require('./package.json').version || '0.0.0'")
fi
case "$VERSION" in
  v*) TAG=$VERSION ;;
  *) TAG="v$VERSION" ;;
esac

echo "pack-release: installing dependencies"
npm ci

echo "pack-release: building editor ($TAG)"
npm run build -w @r-a-i-t-h/tessera-editor -w @r-a-i-t-h/tessera-editor-api

if [ ! -f apps/editor/dist/index.html ]; then
  echo "pack-release: apps/editor/dist/index.html missing after build" >&2
  exit 1
fi
if [ ! -x node_modules/esbuild/bin/esbuild ]; then
  echo "pack-release: esbuild missing after install" >&2
  exit 1
fi

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

DEST="$STAGE/tessera"
mkdir -p "$DEST/dist" "$DEST/spa"

echo "pack-release: bundling server"
# npm packages stay external. Bundling yaml breaks its dynamic require("process").
node_modules/esbuild/bin/esbuild apps/editor-api/src/server.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --target=node20 \
  --external:hono \
  --external:@hono/node-server \
  --external:yaml \
  --external:zod \
  --outfile="$DEST/dist/server.js"

if [ ! -f "$DEST/dist/server.js" ]; then
  echo "pack-release: dist/server.js missing after bundle" >&2
  exit 1
fi

cp -R apps/editor/dist/. "$DEST/spa/"
cp -R apps/editor-api/seed "$DEST/seed"
mkdir -p "$DEST/seed/examples"
for name in pure ineffable millersark willow; do
  if [ -f "sites/$name/meta.json" ]; then
    tar -czf "$DEST/seed/examples/$name.tar.gz" \
      --exclude=users \
      --exclude=history \
      --exclude=.sessions.json \
      --exclude=node_modules \
      --exclude=backup \
      -C "sites/$name" .
  fi
done
cp -R deploy "$DEST/deploy"
printf '%s\n' "$TAG" >"$DEST/VERSION"

node - "$DEST/package.json" <<'EOF'
const { readFileSync, writeFileSync } = require("node:fs");
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const names = ["@hono/node-server", "hono", "yaml", "zod"];
const dependencies = {};
for (const name of names) {
  const version = lock.packages["node_modules/" + name]?.version;
  if (!version) {
    console.error("pack-release: lockfile missing " + name);
    process.exit(1);
  }
  dependencies[name] = version;
}
writeFileSync(
  process.argv[2],
  JSON.stringify(
    {
      name: "tessera",
      private: true,
      type: "module",
      engines: { node: ">=20" },
      dependencies,
    },
    null,
    2,
  ) + "\n",
);
EOF

echo "pack-release: production node_modules"
(
  cd "$DEST"
  npm install --omit=dev
)
rm -f "$DEST/package-lock.json"

chmod 755 "$DEST/deploy/post-update.sh" "$DEST/deploy/migrate.sh"
if [ -d "$DEST/deploy/migrations" ]; then
  find "$DEST/deploy/migrations" -name '*.sh' -exec chmod 755 {} +
fi
find "$DEST" -name '*.map' -delete

OUT_DIR="$ROOT/dist-release"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/tessera.tar.gz"
NAMED="$OUT_DIR/tessera-$TAG.tar.gz"

tar -czf "$OUT" -C "$STAGE" tessera
cp "$OUT" "$NAMED"

echo "pack-release: wrote $OUT"
echo "pack-release: wrote $NAMED"
ls -lh "$OUT" "$NAMED"
