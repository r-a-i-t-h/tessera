#!/bin/sh
# Drop tenant records; articles belong to blogs via parentId. Stamps schemaVersion: 3.
set -eu

[ -n "${TESSERA_DATA:-}" ] || {
  echo "003-remove-tenants: TESSERA_DATA is required" >&2
  exit 1
}

ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
# The release tarball has no apps/ tree. pack-release writes this bundle beside the hook.
BUNDLED="$ROOT/003-remove-tenants.mjs"
if [ -f "$BUNDLED" ]; then
  exec node "$BUNDLED" "$TESSERA_DATA"
fi

REPO=$(CDPATH= cd -- "$ROOT/../.." && pwd)
exec node --experimental-strip-types "$REPO/apps/editor-api/scripts/migrate-003-remove-tenants.ts" "$TESSERA_DATA"
