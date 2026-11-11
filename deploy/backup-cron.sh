#!/bin/bash
# Install or remove one nightly crontab entry that runs deploy/backup-all-sites.sh
# for every Tessera instance under /opt/tessera/.
#
# Environment:
#   TESSERA_BACKUP_CRON_SCHEDULE   cron schedule (default: 0 3 * * *)
#   TESSERA_BACKUP_CRON_USER       crontab owner when run with sudo (default: tessera)
#
# Examples:
#   sudo deploy/backup-cron.sh install
#   sudo deploy/backup-cron.sh remove
#   deploy/backup-cron.sh status
#
set -euo pipefail

MARKER='# tessera-backup-cron'
DEFAULT_SCHEDULE='0 3 * * *'
DEFAULT_USER='tessera'

say() { printf 'backup-cron: %s\n' "$*"; }
warn() { printf 'backup-cron: %s\n' "$*" >&2; }
die() { warn "$*"; exit 1; }

read_crontab() {
  local user=${1:-}
  if [[ -n "$user" ]]; then
    crontab -u "$user" -l 2>/dev/null || true
  else
    crontab -l 2>/dev/null || true
  fi
}

write_crontab() {
  local user=${1:-} body=$2
  if [[ -n "$user" ]]; then
    printf '%s\n' "$body" | crontab -u "$user" -
  else
    printf '%s\n' "$body" | crontab -
  fi
}

cron_line() {
  local schedule=$1 script=$2
  printf '%s %s %s\n' "$schedule" "$script" "$MARKER"
}

has_marker() {
  grep -Fq "$MARKER" <<<"$1"
}

strip_marker_lines() {
  grep -Fv "$MARKER" <<<"$1" | sed -e '/^[[:space:]]*$/d' || true
}

resolve_cron_user() {
  local user=${TESSERA_BACKUP_CRON_USER:-$DEFAULT_USER}
  if [[ "$(id -u)" -ne 0 ]]; then
    printf '%s\n' ""
    return 0
  fi
  if ! id "$user" >/dev/null 2>&1; then
    die "account $user is not on this machine (set TESSERA_BACKUP_CRON_USER)"
  fi
  printf '%s\n' "$user"
}

install_job() {
  local user=$1
  local schedule script line existing body
  schedule=${TESSERA_BACKUP_CRON_SCHEDULE:-$DEFAULT_SCHEDULE}
  script=$(CDPATH= cd -- "$(dirname "$0")" && pwd -L)
  script="$script/backup-all-sites.sh"
  [[ -f "$script" ]] || die "missing $script"
  line=$(cron_line "$schedule" "$script")
  existing=$(read_crontab "$user")
  body=$(strip_marker_lines "$existing")
  if [[ -n "$body" ]]; then
    body=$(printf '%s\n%s\n' "$body" "$line")
  else
    body="$line"
  fi
  write_crontab "$user" "$body"
  say "installed crontab for ${user:-$(whoami)}"
  say "$line"
}

remove_job() {
  local user=$1
  local existing body
  existing=$(read_crontab "$user")
  if ! has_marker "$existing"; then
    say "no tessera backup cron job for ${user:-$(whoami)}"
    return 0
  fi
  body=$(strip_marker_lines "$existing")
  if [[ -n "$body" ]]; then
    write_crontab "$user" "$body"
  else
    if [[ -n "$user" ]]; then
      crontab -u "$user" -r 2>/dev/null || true
    else
      crontab -r 2>/dev/null || true
    fi
  fi
  say "removed tessera backup cron job for ${user:-$(whoami)}"
}

show_status() {
  local user=$1
  local existing
  existing=$(read_crontab "$user")
  if has_marker "$existing"; then
    grep -F "$MARKER" <<<"$existing" | while IFS= read -r line; do
      say "installed: $line"
    done
  else
    say "not installed for ${user:-$(whoami)}"
  fi
}

main() {
  local action=${1:-} user
  case "$action" in
    install|remove|cancel|status) ;;
    *)
      die "usage: backup-cron.sh <install|remove|cancel|status>"
      ;;
  esac

  user=$(resolve_cron_user)

  case "$action" in
    install)
      install_job "$user"
      ;;
    remove|cancel)
      remove_job "$user"
      ;;
    status)
      show_status "$user"
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
