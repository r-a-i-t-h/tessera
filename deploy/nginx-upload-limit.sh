#!/bin/bash
# Raise client_max_body_size for one Tessera instance.
#
# node-vps-kit writes one nginx server file per instance
# (/etc/nginx/sites-available/tessera-<name>, or conf.d) and does not
# rewrite it on update. The 1m default is what rejects a library upload
# with "Request Entity Too Large" before the API sees it. Setting the
# limit in the http block would raise it for every site on this nginx,
# so this script edits only the server that proxies this instance.
#
# Run once per Tessera instance, as root:
#
#   sudo /opt/tessera/<name>/current/deploy/nginx-upload-limit.sh
#   sudo /opt/tessera/<name>/current/deploy/nginx-upload-limit.sh <name>
#
# The API allows 100 MiB per request unless TESSERA_UPLOAD_MAX_TOTAL_BYTES
# is set. Nginx is set 5 MiB higher so multipart overhead still reaches
# the API. A backup of the conf file is kept until nginx -t and the
# restart both succeed. On any error the backup is left in place.
set -euo pipefail

say() { printf 'nginx-upload-limit: %s\n' "$*"; }
warn() { printf 'nginx-upload-limit: %s\n' "$*" >&2; }
die() { warn "$*"; exit 1; }

backup=""
real=""
work=""

finish() {
  local status=$?
  if [[ -n "$work" ]]; then
    rm -rf "$work"
  fi
  if [[ $status -ne 0 && -n "$backup" && -f "$backup" ]]; then
    warn "stopped. The original conf is still at $backup"
    if [[ -n "$real" ]]; then
      warn "the edited file is $real"
      warn "restore with: cp -a $(printf '%q' "$backup") $(printf '%q' "$real")"
    fi
  fi
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

env_value() {
  local file=$1 key=$2
  awk -F= -v key="$key" '$1 == key { print $2; exit }' "$file" | tr -d '[:space:]'
}

# Bytes for an nginx size token. 0 means unlimited.
nginx_size_bytes() {
  local raw=$1 number suffix
  raw=$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')
  [[ "$raw" =~ ^([0-9]+)([kmg]?)$ ]] || return 1
  number=${BASH_REMATCH[1]}
  suffix=${BASH_REMATCH[2]}
  case "$suffix" in
    k) echo $((number * 1024)) ;;
    m) echo $((number * 1024 * 1024)) ;;
    g) echo $((number * 1024 * 1024 * 1024)) ;;
    *) echo "$number" ;;
  esac
}

# Print the edited conf. Sets changed=1 when a directive was added or raised.
# Only blocks that proxy_pass to $port are touched.
rewrite_conf() {
  local file=$1
  local -a lines depth_before depth_after
  local -a block_starts block_ends block_insert
  local line d opens closes i j code start end body_depth bytes value
  local marked=" " k indent next skip replaced

  lines=()
  while IFS= read -r line || [[ -n "${line:-}" ]]; do
    lines+=("$line")
  done < "$file"
  [[ ${#lines[@]} -gt 0 ]] || die "$file is empty"

  d=0
  for i in "${!lines[@]}"; do
    depth_before[i]=$d
    code=${lines[i]%%#*}
    opens=$(printf '%s' "$code" | tr -cd '{')
    closes=$(printf '%s' "$code" | tr -cd '}')
    d=$((d + ${#opens} - ${#closes}))
    [[ $d -ge 0 ]] || die "extra closing brace in $file near line $((i + 1))"
    depth_after[i]=$d
  done

  block_starts=()
  block_ends=()
  block_insert=()
  for i in "${!lines[@]}"; do
    code=${lines[i]%%#*}
    [[ "$code" =~ proxy_pass[[:space:]]+https?://(127\.0\.0\.1|localhost):${port}([^0-9]|$) ]] || continue

    start=-1
    j=$i
    while [[ $j -ge 0 ]]; do
      code=${lines[j]%%#*}
      if [[ ${depth_before[j]} -lt ${depth_before[i]} && "$code" =~ ^[[:space:]]*server[[:space:]]*\{ ]]; then
        start=$j
        break
      fi
      j=$((j - 1))
    done
    if [[ $start -lt 0 ]]; then
      j=$i
      while [[ $j -ge 0 ]]; do
        code=${lines[j]%%#*}
        if [[ ${depth_before[j]} -lt ${depth_before[i]} && "$code" =~ ^[[:space:]]*location[[:space:]] && "$code" == *"{"* ]]; then
          start=$j
          break
        fi
        j=$((j - 1))
      done
    fi
    [[ $start -ge 0 ]] || die "proxy_pass for port $port in $file is not inside a server or location block"
    [[ "$marked" == *" $start "* ]] && continue
    marked+="$start "

    end=-1
    for j in "${!lines[@]}"; do
      [[ $j -le $start ]] && continue
      if [[ ${depth_after[j]} -eq ${depth_before[start]} ]]; then
        end=$j
        break
      fi
    done
    [[ $end -gt $start ]] || die "block starting at line $((start + 1)) of $file does not close"

    # A directive on the block itself covers every location inside it.
    # One that is already large enough (or 0, unlimited) is left alone.
    body_depth=$((depth_before[start] + 1))
    insert=1
    for ((j = start + 1; j < end; j++)); do
      code=${lines[j]%%#*}
      code=${code//;/}
      [[ "$code" =~ ^[[:space:]]*client_max_body_size[[:space:]]+[0-9]+[kKmMgG]?[[:space:]]*$ ]] || continue
      [[ ${depth_before[j]} -eq $body_depth ]] || continue
      insert=0
    done
    block_starts+=("$start")
    block_ends+=("$end")
    block_insert+=("$insert")
  done

  [[ ${#block_starts[@]} -gt 0 ]] || die "found proxy_pass for port $port in the running config but not in $file"

  changed=0
  for i in "${!lines[@]}"; do
    skip=0
    for k in "${!block_starts[@]}"; do
      [[ "$i" -eq "${block_starts[k]}" && "${block_insert[k]}" -eq 1 ]] || continue
      printf '%s\n' "${lines[i]}"
      if [[ $((i + 1)) -lt ${#lines[@]} ]]; then
        next=${lines[i + 1]}
      else
        next=""
      fi
      indent=${next%%[![:space:]]*}
      [[ -n "$indent" ]] || indent="    "
      printf '%sclient_max_body_size %s;\n' "$indent" "$target_token"
      changed=1
      skip=1
      break
    done
    [[ "$skip" -eq 1 ]] && continue

    code=${lines[i]%%#*}
    code=${code//;/}
    replaced=0
    if [[ "$code" =~ ^([[:space:]]*)client_max_body_size[[:space:]]+([0-9]+[kKmMgG]?)[[:space:]]*$ ]]; then
      indent=${BASH_REMATCH[1]}
      value=${BASH_REMATCH[2]}
      for k in "${!block_starts[@]}"; do
        [[ "$i" -gt "${block_starts[k]}" && "$i" -lt "${block_ends[k]}" ]] || continue
        bytes=$(nginx_size_bytes "$value") || die "cannot parse client_max_body_size on line $((i + 1)) of $file"
        if [[ "$bytes" != "0" && "$bytes" -lt "$target_bytes" ]]; then
          printf '%sclient_max_body_size %s;\n' "$indent" "$target_token"
          changed=1
          replaced=1
        fi
        break
      done
    fi
    [[ "$replaced" -eq 1 ]] && continue
    printf '%s\n' "${lines[i]}"
  done
}

main() {
  trap finish EXIT

  if [[ "$(id -u)" -ne 0 ]]; then
    die "run with sudo"
  fi
  command -v nginx >/dev/null 2>&1 || die "nginx is not installed"
  command -v systemctl >/dev/null 2>&1 || die "systemctl is not available"

  local instance="" script_dir name port api_total overhead mib target_m
  local dump current line code conf fixed

  if [[ $# -ge 1 ]]; then
    if [[ -f "$1/env" ]]; then
      instance=$1
    elif [[ -f "/opt/tessera/$1/env" ]]; then
      instance=/opt/tessera/$1
    else
      die "no instance env file for $1"
    fi
  else
    script_dir=$(CDPATH= cd -- "$(dirname "$0")" && pwd -L)
    instance=$(find_instance_from "$script_dir" || true)
    if [[ -z "$instance" ]]; then
      instance=$(find_instance_from "$(pwd -L)" || true)
    fi
    if [[ -z "$instance" ]]; then
      shopt -s nullglob
      local found=(/opt/tessera/*/env)
      shopt -u nullglob
      if [[ ${#found[@]} -eq 1 ]]; then
        instance=$(dirname "${found[0]}")
      elif [[ ${#found[@]} -gt 1 ]]; then
        warn "several Tessera instances. Pass the instance name:"
        local env
        for env in "${found[@]}"; do
          warn "  $(basename "$(dirname "$env")")"
        done
        exit 1
      else
        die "could not find an instance env file. Run it from /opt/tessera/<name>/current or pass the instance name."
      fi
    fi
  fi

  name=$(basename "$instance")
  port=$(env_value "$instance/env" PORT)
  [[ "$port" =~ ^[0-9]+$ ]] || die "PORT is missing in $instance/env"

  api_total=$(env_value "$instance/env" TESSERA_UPLOAD_MAX_TOTAL_BYTES)
  if [[ -z "$api_total" ]]; then
    api_total=$((100 * 1024 * 1024))
  fi
  [[ "$api_total" =~ ^[0-9]+$ && "$api_total" -ge 1 ]] || die "TESSERA_UPLOAD_MAX_TOTAL_BYTES in $instance/env is not a positive integer"

  overhead=$((5 * 1024 * 1024))
  mib=$((1024 * 1024))
  target_m=$(( (api_total + overhead + mib - 1) / mib ))
  target_bytes=$((target_m * mib))
  target_token="${target_m}m"
  say "instance $name, port $port, client_max_body_size $target_token"

  work=$(mktemp -d)
  if ! dump=$(nginx -T 2>"$work/nginx-t.err"); then
    cat "$work/nginx-t.err" >&2
    die "nginx -t failed while reading the configuration"
  fi
  conf=""
  current=""
  while IFS= read -r line || [[ -n "${line:-}" ]]; do
    if [[ "$line" =~ ^#\ configuration\ file\ (.+):$ ]]; then
      current=${BASH_REMATCH[1]}
      continue
    fi
    code=${line%%#*}
    if [[ "$code" =~ proxy_pass[[:space:]]+https?://(127\.0\.0\.1|localhost):${port}([^0-9]|$) ]]; then
      [[ -n "$current" ]] || die "proxy_pass for port $port appeared before any configuration file header"
      if [[ -n "$conf" && "$conf" != "$current" ]]; then
        die "port $port is proxied from both $conf and $current"
      fi
      conf=$current
    fi
  done <<< "$dump"

  [[ -n "$conf" ]] || die "no nginx proxy_pass to 127.0.0.1:$port (instance $name)"
  [[ -f "$conf" ]] || die "nginx listed $conf but that file is not there"
  real=$(readlink -f "$conf")
  say "editing $real"

  fixed="$work/fixed.conf"
  changed=0
  rewrite_conf "$real" >"$fixed"

  if [[ "$changed" -eq 0 ]]; then
    say "already ${target_token} or higher in $real"
    exit 0
  fi

  # /tmp, not next to the conf: sites-enabled/* would load a copy sitting beside it.
  backup=$(mktemp /tmp/nginx-upload-limit.XXXXXX)
  say "copying $real to $backup"
  cp -a "$real" "$backup"
  say "writing client_max_body_size $target_token into $real"
  cat "$fixed" >"$real"

  say "testing nginx configuration"
  nginx -t
  say "restarting nginx"
  systemctl restart nginx
  say "removing $backup"
  rm -f "$backup"
  backup=""
  say "done"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
