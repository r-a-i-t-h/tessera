#!/bin/bash
# Set an editor user's password when you have shell access to the host.
#
# Environment:
#   TESSERA_DATA   instance data directory (required unless passed as the first argument)
#
# Examples:
#   TESSERA_DATA=/opt/tessera/mysite/data deploy/reset-user-password.sh admin 'new-secret'
#   deploy/reset-user-password.sh /opt/tessera/mysite/data admin 'new-secret'
#
# When run as root, the script drops to the tessera systemd User= for that instance
# so user files stay owned by the process account (mode 600). Running node as root
# would leave root-owned secrets and the service would fail to start.
#
# Restart the tessera systemd unit after a reset so in-memory sessions are cleared.
set -euo pipefail

say() { printf 'reset-user-password: %s\n' "$*"; }
err() { printf 'reset-user-password: %s\n' "$*" >&2; exit 1; }
quote() { printf '%q' "$1"; }

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
REPO=$(CDPATH= cd -- "$ROOT/../.." && pwd)

service_user_for_data() {
  local data=$1 name unit user
  if [[ "$data" =~ ^/opt/tessera/([^/]+)/data/?$ ]]; then
    name="${BASH_REMATCH[1]}"
    unit="/etc/systemd/system/tessera-${name}.service"
    if [[ -f "$unit" ]]; then
      user=$(awk '$1 == "User=" { print $2; exit }' "$unit")
      if [[ -n "$user" ]] && id "$user" >/dev/null 2>&1; then
        printf '%s\n' "$user"
        return 0
      fi
    fi
  fi
  return 1
}

run_node() {
  if [ -f "$BUNDLED" ]; then
    exec node "$BUNDLED" "$DATA" "$USER" "$PASS"
  fi
  exec node --experimental-strip-types "$REPO/apps/editor-api/scripts/reset-user-password.ts" "$DATA" "$USER" "$PASS"
}

if [ "$(id -u)" -eq 0 ]; then
  svc=$(service_user_for_data "$DATA") || err "running as root would create root-owned user files; run as the service user (see tessera-*.service User=) or pass TESSERA_DATA as /opt/tessera/<name>/data"
  say "running as $svc"
  if [ -f "$BUNDLED" ]; then
    cmd="exec node $(quote "$BUNDLED") $(quote "$DATA") $(quote "$USER") $(quote "$PASS")"
  else
    cmd="exec node --experimental-strip-types $(quote "$REPO/apps/editor-api/scripts/reset-user-password.ts") $(quote "$DATA") $(quote "$USER") $(quote "$PASS")"
  fi
  exec su -s /bin/sh "$svc" -c "$cmd"
fi

run_node
