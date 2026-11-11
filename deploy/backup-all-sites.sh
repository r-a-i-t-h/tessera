#!/bin/bash
# Run deploy/backup-site.sh for every Tessera instance under /opt/tessera/.
#
# When run as root, each backup runs as that instance's systemd User= so
# archives stay owned by the process account. When run as a normal user,
# instances are backed up in the current account (typical nightly cron as tessera).
#
# Environment:
#   TESSERA_ROOT    instance parent directory (default: /opt/tessera)
#
# Examples:
#   deploy/backup-all-sites.sh
#   sudo deploy/backup-all-sites.sh
#
set -euo pipefail

say() { printf 'backup-all-sites: %s\n' "$*"; }
warn() { printf 'backup-all-sites: %s\n' "$*" >&2; }
die() { warn "$*"; exit 1; }

quote() { printf '%q' "$1"; }

TESSERA_ROOT=${TESSERA_ROOT:-/opt/tessera}

unit_field() {
  local file=$1 key=$2
  awk -F= -v key="$key" '
    {
      name = $1
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", name)
      if (name == key) {
        value = $2
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
        print value
        exit
      }
    }
  ' "$file"
}

service_user_for() {
  local instance=$1 name unit user
  name=$(basename "$instance")
  unit="/etc/systemd/system/tessera-${name}.service"
  if [[ -f "$unit" ]]; then
    user=$(unit_field "$unit" User)
    if [[ -n "$user" ]] && id "$user" >/dev/null 2>&1; then
      printf '%s\n' "$user"
      return 0
    fi
  fi
  return 1
}

is_tessera_instance() {
  local dir=$1
  [[ -f "$dir/env" ]] && grep -q '^PORT=' "$dir/env"
}

list_instances() {
  local root=$1 child
  [[ -d "$root" ]] || return 0
  shopt -s nullglob
  for child in "$root"/*; do
    [[ -d "$child" ]] || continue
    is_tessera_instance "$child" || continue
    printf '%s\n' "$child"
  done
  shopt -u nullglob
}

run_one() {
  local instance=$1 name backup_script user cmd
  name=$(basename "$instance")
  backup_script=$(CDPATH= cd -- "$(dirname "$0")" && pwd -L)
  backup_script="$backup_script/backup-site.sh"
  [[ -f "$backup_script" ]] || die "missing $backup_script"
  say "instance $name"
  if [[ "$(id -u)" -eq 0 ]]; then
    if user=$(service_user_for "$instance"); then
      cmd="$(quote "$backup_script") $(quote "$instance")"
      if su -s /bin/sh "$user" -c "$cmd"; then
        return 0
      fi
      return 1
    fi
    warn "no tessera-${name}.service User=; running backup as root"
  fi
  if "$backup_script" "$instance"; then
    return 0
  fi
  return 1
}

main() {
  local -a instances=()
  local instance failed=0 ok=0
  command -v tar >/dev/null 2>&1 || die "tar is required"
  if [[ "$(id -u)" -eq 0 ]]; then
    command -v su >/dev/null 2>&1 || die "su is required when run as root"
  fi
  while IFS= read -r instance; do
    [[ -n "$instance" ]] || continue
    instances+=("$instance")
  done < <(list_instances "$TESSERA_ROOT")
  if [[ ${#instances[@]} -eq 0 ]]; then
    die "no Tessera instances under $TESSERA_ROOT"
  fi
  for instance in "${instances[@]}"; do
    if run_one "$instance"; then
      ok=$((ok + 1))
    else
      warn "backup failed for $(basename "$instance")"
      failed=$((failed + 1))
    fi
  done
  say "finished: $ok ok, $failed failed (${#instances[@]} instance(s))"
  [[ "$failed" -eq 0 ]]
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
