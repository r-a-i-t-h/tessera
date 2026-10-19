#!/bin/sh
# Backfill library media addedAt; stamps schemaVersion: 4.
set -eu

[ -n "${TESSERA_DATA:-}" ] || {
  echo "004-library-added-at: TESSERA_DATA is required" >&2
  exit 1
}

ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
# The release tarball has no apps/ tree. pack-release writes this bundle beside the hook.
BUNDLED="$ROOT/004-library-added-at.mjs"
if [ -f "$BUNDLED" ]; then
  exec node "$BUNDLED" "$TESSERA_DATA"
fi

REPO=$(CDPATH= cd -- "$ROOT/../.." && pwd)
exec node --experimental-strip-types "$REPO/apps/editor-api/scripts/migrate-004-library-added-at.ts" "$TESSERA_DATA"
