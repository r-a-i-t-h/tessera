#!/bin/bash
# Create a dated site archive outside the editor backup folder and rotate old copies.
#
# The editor writes manual backups into the sibling `backup/` directory
# (`TESSERA_BACKUP` overrides it). Scheduled copies go to a separate folder
# so nightly jobs do not mix with archives you keep from the Backups page.
#
# Environment (instance `env` is used when a variable is unset):
#   TESSERA_DATA              site directory to archive
#   TESSERA_SCHEDULED_BACKUP    destination directory (default: sibling scheduled-backup/)
#   TESSERA_SCHEDULED_KEEP      how many dated archives to keep (default: 3)
#
# Examples:
#   deploy/backup-site.sh
#   deploy/backup-site.sh myinstance
#   deploy/backup-all-sites.sh          # every instance under /opt/tessera/
#   TESSERA_SCHEDULED_KEEP=5 deploy/backup-site.sh
#
set -euo pipefail

say() { printf 'backup-site: %s\n' "$*"; }
warn() { printf 'backup-site: %s\n' "$*" >&2; }
die() { warn "$*"; exit 1; }

BACKUP_NAME_RE='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{6}Z\.tar\.gz$'
SESSION_HANDOFF='.sessions.json'

collapse_path() {
  local rest=$1
  [[ "$rest" == /* ]] || return 1
  while [[ "$rest" == *//* ]]; do
    rest=${rest//\/\//\/}
  done
  if [[ "$rest" != "/" ]]; then
    rest=${rest%/}
  fi
  printf '%s\n' "$rest"
}

env_value() {
  local file=$1 key=$2 line
  line=$(awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$file" || true)
  line=${line%$'\r'}
  line=${line#"${line%%[![:space:]]*}"}
  line=${line%"${line##*[![:space:]]}"}
  line=${line#\"}
  line=${line%\"}
  line=${line#\'}
  line=${line%\'}
  printf '%s\n' "$line"
}

find_instance_from() {
  local d=$1
  while [[ -n "$d" && "$d" != "/" ]]; do
    if [[ -f "$d/env" ]] && grep -q '^PORT=' "$d/env"; then
      printf '%s\n' "$d"
      return 0
    fi
    d=$(dirname "$d")
  done
  return 1
}

resolve_instance() {
  local arg=${1:-} script_dir found
  if [[ -n "$arg" ]]; then
    if [[ -f "$arg/env" ]]; then
      collapse_path "$arg" || die "instance path must be absolute: $arg"
      return
    fi
    if [[ "$arg" =~ ^[a-zA-Z0-9_-]+$ && "$arg" != -* && "$arg" != *_ && -f "/opt/tessera/$arg/env" ]]; then
      printf '%s\n' "/opt/tessera/$arg"
      return
    fi
    die "no instance env file for $arg"
  fi

  script_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd -L)
  if found=$(find_instance_from "$script_dir"); then
    printf '%s\n' "$found"
    return
  fi
  if found=$(find_instance_from "$(pwd -L)"); then
    printf '%s\n' "$found"
    return
  fi

  shopt -s nullglob
  local envs=(/opt/tessera/*/env)
  shopt -u nullglob
  if [[ ${#envs[@]} -eq 1 ]]; then
    dirname "${envs[0]}"
    return
  fi
  if [[ ${#envs[@]} -gt 1 ]]; then
    warn "several Tessera instances. Pass the instance name:"
    for env in "${envs[@]}"; do
      warn "  $(basename "$(dirname "$env")")"
    done
    exit 1
  fi
  die "could not find an instance env file. Run from /opt/tessera/<name>/current or pass the instance name."
}

data_root_of() {
  local instance=$1 data from_env
  from_env=$(env_value "$instance/env" TESSERA_DATA)
  if [[ -n "$from_env" ]]; then
    data="$from_env"
  else
    data="$instance/data"
  fi
  if ! collapse_path "$data" >/dev/null; then
    die "TESSERA_DATA in $instance/env must be an absolute path"
  fi
  collapse_path "$data"
}

scheduled_backup_of() {
  local data=$1 instance=$2 from_env dest
  if [[ -n "${TESSERA_SCHEDULED_BACKUP:-}" ]]; then
    dest="$TESSERA_SCHEDULED_BACKUP"
  else
    from_env=$(env_value "$instance/env" TESSERA_SCHEDULED_BACKUP)
    if [[ -n "$from_env" ]]; then
      dest="$from_env"
    else
      dest="$(dirname "$data")/scheduled-backup"
    fi
  fi
  if ! collapse_path "$dest" >/dev/null; then
    die "scheduled backup path must be absolute: $dest"
  fi
  collapse_path "$dest"
}

utc_backup_name() {
  date -u +%Y-%m-%dT%H%M%SZ.tar.gz
}

is_backup_name() {
  [[ "$1" =~ $BACKUP_NAME_RE ]]
}

prune_archives() {
  local dir=$1 keep=$2
  local -a names name path count
  [[ "$keep" =~ ^[0-9]+$ ]] || die "TESSERA_SCHEDULED_KEEP must be a non-negative integer"
  shopt -s nullglob
  names=()
  for path in "$dir"/*.tar.gz; do
    name=$(basename "$path")
    is_backup_name "$name" || continue
    names+=("$name")
  done
  shopt -u nullglob
  if [[ ${#names[@]} -le "$keep" ]]; then
    return 0
  fi
  count=0
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    count=$((count + 1))
    if [[ $count -gt $keep ]]; then
      path="$dir/$name"
      say "removing old archive $name"
      rm -f -- "$path"
    fi
  done < <(printf '%s\n' "${names[@]}" | sort -r)
}

run_backup() {
  local data=$1 dest=$2
  local name partial final
  command -v tar >/dev/null 2>&1 || die "tar is required"
  [[ -d "$data" ]] || die "data directory not found: $data"
  mkdir -p -- "$dest"
  name=$(utc_backup_name)
  final="$dest/$name"
  if [[ -e "$final" ]]; then
    sleep 1
    name=$(utc_backup_name)
    final="$dest/$name"
  fi
  partial="${final}.partial"
  say "archiving $data to $final"
  tar -czf "$partial" \
    --exclude="$SESSION_HANDOFF" \
    --exclude=backup \
    -C "$data" .
  mv -f -- "$partial" "$final"
  say "wrote $final ($(du -h "$final" | awk '{print $1}'))"
}

main() {
  local instance arg=${1:-} data dest keep instance_env
  instance=$(resolve_instance "$arg")
  instance_env="$instance/env"
  [[ -f "$instance_env" ]] || die "no env file in $instance"

  if [[ -n "${TESSERA_DATA:-}" ]]; then
    data="$TESSERA_DATA"
    if ! collapse_path "$data" >/dev/null; then
      die "TESSERA_DATA must be an absolute path"
    fi
    data=$(collapse_path "$data")
  else
    data=$(data_root_of "$instance")
  fi

  if [[ -n "${TESSERA_SCHEDULED_BACKUP:-}" ]]; then
    dest="$TESSERA_SCHEDULED_BACKUP"
    if ! collapse_path "$dest" >/dev/null; then
      die "TESSERA_SCHEDULED_BACKUP must be an absolute path"
    fi
    dest=$(collapse_path "$dest")
  else
    dest=$(scheduled_backup_of "$data" "$instance")
  fi

  if [[ -n "${TESSERA_SCHEDULED_KEEP:-}" ]]; then
    keep="$TESSERA_SCHEDULED_KEEP"
  else
    keep=$(env_value "$instance_env" TESSERA_SCHEDULED_KEEP)
    if [[ -z "$keep" ]]; then
      keep=3
    fi
  fi

  run_backup "$data" "$dest"
  prune_archives "$dest" "$keep"
  say "kept the newest $keep archive(s) in $dest"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
