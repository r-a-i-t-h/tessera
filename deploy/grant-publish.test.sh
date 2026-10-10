#!/bin/bash
# Path rules for deploy/grant-publish.sh. Ownership changes need root on the VPS.
set -euo pipefail

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
# shellcheck source=deploy/grant-publish.sh
source "$ROOT/deploy/grant-publish.sh"

fail() { printf 'grant-publish.test: %s\n' "$*" >&2; exit 1; }

assert_eq() {
  local want=$1 got=$2 label=$3
  [[ "$got" == "$want" ]] || fail "$label: expected [$want] got [$got]"
}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

instance=$tmp/opt/tessera/www
data=$instance/data
parent=$tmp/var/www
mkdir -p "$data" "$parent"

same_or_inside "$instance" "$instance" || fail "same path"
same_or_inside "$instance" "$data" || fail "child path"
if same_or_inside "$instance" "${instance}-other"; then
  fail "prefix must not match a longer name"
fi
if same_or_inside "$data" "$parent"; then
  fail "unrelated paths"
fi

got=$(live_path_error "$parent/hall" "$data" "$instance")
assert_eq "$parent/hall" "$got" "missing leaf under an existing parent"

got=$(live_path_error "$parent//hall/" "$data" "$instance")
assert_eq "$parent/hall" "$got" "collapsed slashes"

got=$(live_path_error "$parent" "$data" "$instance")
assert_eq "$parent" "$got" "existing directory"

got=$(live_path_error "www" "$data" "$instance" || true)
assert_eq "Publish to must be an absolute path." "$got" "relative"

got=$(live_path_error "$parent/../www/hall" "$data" "$instance" || true)
assert_eq "Publish to must not include . or .. path segments." "$got" "dot segment"

got=$(live_path_error "/" "$data" "$instance" || true)
assert_eq "Refusing to change /." "$got" "root"

got=$(live_path_error "$data/public" "$data" "$instance" || true)
assert_eq "Publish to must be outside the Tessera instance at ${instance}, and must not contain it." "$got" "inside site data"

outside=$tmp/sites/hall
mkdir -p "$outside"
got=$(live_path_error "$outside/public" "$outside" "$instance" || true)
assert_eq "Publish to must be outside this site directory (${outside}), and must not contain it." "$got" "data outside the instance"

got=$(live_path_error "$instance/backup" "$data" "$instance" || true)
assert_eq "Publish to must be outside the Tessera instance at ${instance}, and must not contain it." "$got" "inside instance"

got=$(live_path_error "$tmp" "$data" "$instance" || true)
assert_eq "Publish to must be outside the Tessera instance at ${instance}, and must not contain it." "$got" "contains instance"

got=$(live_path_error "$parent/nope/hall" "$data" "$instance" || true)
assert_eq "Parent directory does not exist: $parent/nope" "$got" "missing parent"

ln -s "$parent" "$tmp/link"
got=$(live_path_error "$tmp/link" "$data" "$instance" || true)
assert_eq "Publish to must be a real directory, not a symlink." "$got" "symlink"

printf 'x\n' >"$tmp/file"
got=$(live_path_error "$tmp/file" "$data" "$instance" || true)
assert_eq "Publish to must be a directory." "$got" "file"

unit=$tmp/tessera-www.service
printf '%s\n' '[Service]' 'User=tessera' 'Group=tessera' >"$unit"
assert_eq "tessera" "$(unit_field "$unit" User)" "unit user"
assert_eq "tessera" "$(unit_field "$unit" Group)" "unit group"
valid_account tessera || fail "tessera should be a valid account"
if valid_account '../tessera'; then
  fail "path-like account"
fi

printf 'grant-publish.test: ok\n'
