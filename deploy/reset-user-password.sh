#!/bin/sh
# Set an editor user's password when you have shell access to the host.
#
# Environment:
#   TESSERA_DATA   instance data directory (required unless passed as the first argument)
#
# Examples:
#   TESSERA_DATA=/opt/tessera/mysite/data deploy/reset-user-password.sh admin 'new-secret'
#   deploy/reset-user-password.sh /opt/tessera/mysite/data admin 'new-secret'
#
# Restart the tessera systemd unit after a reset so in-memory sessions are cleared.
set -eu

err() { echo "reset-user-password: $*" >&2; exit 1; }

DATA=${TESSERA_DATA:-}
USER=
PASS=

if [ "$#" -eq 3 ]; then
  DATA=$1
  USER=$2
  PASS=$3
elif [ "$#" -eq 2 ] && [ -n "$DATA" ]; then
  USER=$1
  PASS=$2
else
  err "usage: TESSERA_DATA=/path reset-user-password.sh <username> <new-password>
       reset-user-password.sh <TESSERA_DATA> <username> <new-password>"
fi

[ -n "$DATA" ] || err "TESSERA_DATA is required"
[ -d "$DATA" ] || err "data directory not found: $DATA"
command -v node >/dev/null 2>&1 || err "node is required"

ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
BUNDLED="$ROOT/reset-user-password.mjs"
if [ -f "$BUNDLED" ]; then
  exec node "$BUNDLED" "$DATA" "$USER" "$PASS"
fi

REPO=$(CDPATH= cd -- "$ROOT/../.." && pwd)
exec node --experimental-strip-types "$REPO/apps/editor-api/scripts/reset-user-password.ts" "$DATA" "$USER" "$PASS"
