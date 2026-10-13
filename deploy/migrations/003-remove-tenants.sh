#!/bin/sh
# Drop tenant records; articles belong to blogs via parentId. Stamps schemaVersion: 3.
set -eu

[ -n "${TESSERA_DATA:-}" ] || {
  echo "003-remove-tenants: TESSERA_DATA is required" >&2
  exit 1
}

ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO=$(CDPATH= cd -- "$ROOT/../.." && pwd)
SCRIPT="$REPO/apps/editor-api/scripts/migrate-003-remove-tenants.ts"

node --experimental-strip-types "$SCRIPT" "$TESSERA_DATA"
