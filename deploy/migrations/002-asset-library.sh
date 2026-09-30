#!/bin/sh
# Rewrite media and folder records into the asset library and stamp schemaVersion 2.
set -eu

[ -n "${TESSERA_DATA:-}" ] || {
  echo "002-asset-library: TESSERA_DATA is required" >&2
  exit 1
}

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
node "$ROOT/scripts/migrate-library.mjs" "$TESSERA_DATA"

node -e '
const fs = require("fs");
const path = require("path");
const metaPath = path.join(process.env.TESSERA_DATA, "meta.json");
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
meta.schemaVersion = 2;
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
'
