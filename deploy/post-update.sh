#!/bin/sh
# node-vps-kit runs this after swapping `current` to a new release and before
# systemd restarts the process. It runs as the app user.
#
# Environment (set by the kit — the instance env file is not sourced):
#   TESSERA_DATA    this instance's data directory (never re-seed it)
#   TESSERA_SEED    seed tree from the new release (reference only)
#   TESSERA_BACKUP  data backup from this update
#
# Applies deploy/migrations/NNN-*.sh where NNN is greater than schemaVersion
# in $TESSERA_DATA/meta.json (missing or non-numeric = 0). Exit non-zero to
# abort the update; the previous release directory is kept.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
exec "$ROOT/migrate.sh"
