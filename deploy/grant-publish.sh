#!/bin/bash
# Give the Tessera process user ownership of one publish target.
#
# node-vps-kit runs the process as a system user. The default account is
# tessera (User= and Group= in /etc/systemd/system/tessera-<name>.service).
# An install that passed -User has that name in the unit instead. Publish
# replaces the files inside the target and leaves the directory in place.
# It does not create a missing path and it does not run as root.
#
# This script creates the final directory when its parent already exists,
# gives the tree to the unit user, and keeps it readable by other accounts
# so nginx (www-data) can serve it. /var/www itself stays as it is. A parent
# the process user cannot search gets an execute-only ACL, so the user can
# walk to this folder without listing its siblings.
#
# The folder should contain only the published site. Publish deletes every
# other entry in it.
#
# Run once per site, as root:
#
#   sudo /opt/tessera/<name>/current/deploy/grant-publish.sh /var/www/<site>
#   sudo /opt/tessera/<name>/current/deploy/grant-publish.sh <name> /var/www/<site>
#
set -euo pipefail

say() { printf 'grant-publish: %s\n' "$*"; }
warn() { printf 'grant-publish: %s\n' "$*" >&2; }
die() { warn "$*"; exit 1; }

quote() { printf '%q' "$1"; }

# Collapse repeated slashes and one trailing slash. Relative paths fail.
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

has_dot_segment() {
  local rest=${1#/} part
  while [[ -n "$rest" ]]; do
    part=${rest%%/*}
    if [[ "$part" == "." || "$part" == ".." ]]; then
      return 0
    fi
    if [[ "$rest" == */* ]]; then
      rest=${rest#*/}
    else
      rest=""
    fi
  done
  return 1
}

# True when target is root or a directory inside root.
same_or_inside() {
  local root=$1 target=$2
  [[ "$root" == "$target" ]] && return 0
  [[ "$target" == "$root"/* ]] && return 0
  return 1
}

# Print a reason and return 1 when this path must not be a publish target.
# A missing final directory is allowed when its parent exists.
live_path_error() {
  local raw=$1 data=$2 instance=$3
  local live parent
  if ! live=$(collapse_path "$raw"); then
    printf '%s\n' "Publish to must be an absolute path."
    return 1
  fi
  if [[ "$live" == "/" ]]; then
    printf '%s\n' "Refusing to change /."
    return 1
  fi
  if has_dot_segment "$live"; then
    printf '%s\n' "Publish to must not include . or .. path segments."
    return 1
  fi
  if same_or_inside "$instance" "$live" || same_or_inside "$live" "$instance"; then
    printf '%s\n' "Publish to must be outside the Tessera instance at ${instance}, and must not contain it."
    return 1
  fi
  if same_or_inside "$data" "$live" || same_or_inside "$live" "$data"; then
    printf '%s\n' "Publish to must be outside this site directory (${data}), and must not contain it."
    return 1
  fi
  if [[ -L "$live" ]]; then
    printf '%s\n' "Publish to must be a real directory, not a symlink."
    return 1
  fi
  if [[ -e "$live" && ! -d "$live" ]]; then
    printf '%s\n' "Publish to must be a directory."
    return 1
  fi
  if [[ ! -d "$live" ]]; then
    parent=$(dirname "$live")
    if [[ -L "$parent" || ! -d "$parent" ]]; then
      printf '%s\n' "Parent directory does not exist: ${parent}"
      return 1
    fi
  fi
  printf '%s\n' "$live"
}

env_value() {
  local file=$1 key=$2 line
  line=$(awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$file" || true)
  line=${line%$'\r'}
  line=${line#"${line%%[![:space:]]*}"}
  line=${line%"${line##*[![:space:]]}"}
  printf '%s\n' "$line"
}

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

valid_account() {
  [[ "$1" =~ ^[a-zA-Z_][a-zA-Z0-9._-]*$ ]] || [[ "$1" =~ ^[0-9]+$ ]]
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

# Echo the instance directory. The optional argument is a name or a path.
resolve_instance() {
  local arg=${1:-} script_dir found env
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
  die "could not find an instance env file. Run it from /opt/tessera/<name>/current or pass the instance name."
}

data_root_of() {
  local instance=$1 data
  data=$(env_value "$instance/env" TESSERA_DATA)
  if [[ -z "$data" ]]; then
    data="$instance/data"
  fi
  if ! collapse_path "$data" >/dev/null; then
    die "TESSERA_DATA in $instance/env must be an absolute path"
  fi
  collapse_path "$data"
}

as_user() {
  local user=$1
  shift
  su -s /bin/sh "$user" -c "$*"
}

# Print the nearest parent the account cannot search.
blocking_parent() {
  local user=$1 dir=$2 current
  current=$(dirname "$dir")
  while [[ -n "$current" && "$current" != "/" ]]; do
    if ! as_user "$user" "test -x $(quote "$current")"; then
      printf '%s\n' "$current"
      return 0
    fi
    current=$(dirname "$current")
  done
  return 1
}

ensure_traverse() {
  local user=$1 dir=$2 blocked
  while blocked=$(blocking_parent "$user" "$dir"); do
    [[ -n "$blocked" && "$blocked" != "/" ]] || die "$user cannot search a parent of $dir"
    say "letting $user search $blocked"
    if ! command -v setfacl >/dev/null 2>&1; then
      die "$user cannot reach $dir through $blocked. Install the acl package and re-run, or run: chmod o+x $(quote "$blocked")"
    fi
    setfacl -m "u:${user}:--x" -- "$blocked"
    if ! as_user "$user" "test -x $(quote "$blocked")"; then
      die "$user still cannot search $blocked"
    fi
  done
}

nginx_user() {
  local conf=/etc/nginx/nginx.conf user=""
  if [[ -f "$conf" ]]; then
    user=$(awk '$1 == "user" { gsub(/;/, "", $2); print $2; exit }' "$conf")
  fi
  if [[ -z "$user" ]] && id www-data >/dev/null 2>&1; then
    user=www-data
  fi
  printf '%s\n' "$user"
}

apply_owner() {
  local dir=$1 user=$2 group=$3
  # -P leaves symlinks unfollowed. -xdev stays on this filesystem.
  # Publish can unlink a symlink once the directory is writable.
  find -P "$dir" -xdev \( -type d -o -type f \) -exec chown -- "$user:$group" {} + \
    || die "could not give $user ownership of $dir"
  find -P "$dir" -xdev -type d -exec chmod u+rwx,go+rx {} + \
    || die "could not set directory permissions on $dir"
  find -P "$dir" -xdev -type f -exec chmod u+rw,go+r {} + \
    || die "could not set file permissions on $dir"
}

grant_publish() {
  local instance=$1 raw=$2
  local name data live user group unit web nonempty link

  [[ -f "$instance/env" ]] || die "no env file in $instance"
  name=$(basename "$instance")
  data=$(data_root_of "$instance")

  if ! live=$(live_path_error "$raw" "$data" "$instance"); then
    die "$live"
  fi

  unit="/etc/systemd/system/tessera-${name}.service"
  [[ -f "$unit" ]] || die "no unit file at $unit"
  user=$(unit_field "$unit" User)
  group=$(unit_field "$unit" Group)
  valid_account "$user" || die "User= in $unit is missing or not an account name"
  id "$user" >/dev/null 2>&1 || die "user $user from $unit is not on this machine"
  if [[ -z "$group" ]]; then
    group=$(id -gn "$user")
  fi
  valid_account "$group" || die "Group= in $unit is not an account name"
  getent group "$group" >/dev/null 2>&1 || id -Gn "$user" | tr ' ' '\n' | grep -Fxq "$group" \
    || die "group $group from $unit is not on this machine"

  if [[ ! -d "$live" ]]; then
    say "creating $live"
    mkdir -m 0755 -- "$live"
  else
    nonempty=$(find -P "$live" -mindepth 1 -maxdepth 1 -print -quit || true)
    if [[ -n "$nonempty" ]]; then
      warn "$live is not empty. Publish removes everything inside this directory."
    fi
  fi
  link=$(find -P "$live" -xdev -type l -print -quit || true)
  if [[ -n "$link" ]]; then
    warn "$live contains a symlink. Publish removes the link and leaves its target alone."
  fi

  say "instance $name, user $user, directory $live"
  apply_owner "$live" "$user" "$group"
  ensure_traverse "$user" "$live"

  if ! as_user "$user" "test -w $(quote "$live") && test -x $(quote "$live")"; then
    die "$user still cannot write $live"
  fi

  web=$(nginx_user)
  if [[ -n "$web" ]] && id "$web" >/dev/null 2>&1; then
    if as_user "$web" "test -r $(quote "$live") && test -x $(quote "$live")"; then
      say "$web can read $live"
    else
      warn "$web cannot read $live. A parent directory is blocking nginx."
    fi
  fi

  say "owned by ${user}:${group}. Set Publish to to $live"
}

main() {
  local instance raw
  if [[ "$(id -u)" -ne 0 ]]; then
    die "run with sudo"
  fi
  command -v su >/dev/null 2>&1 || die "su is not available"
  case $# in
    1)
      raw=$1
      instance=$(resolve_instance)
      ;;
    2)
      raw=$2
      instance=$(resolve_instance "$1")
      ;;
    *)
      die "usage: grant-publish.sh [<name>] <publish-directory>"
      ;;
  esac
  grant_publish "$instance" "$raw"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
