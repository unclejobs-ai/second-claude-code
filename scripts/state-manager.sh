#!/usr/bin/env bash
set -euo pipefail

# State Manager — Second Claude Knowledge Work OS
#
# Structured JSON state read/write/clear utility.
# Wraps file I/O for ${CLAUDE_PLUGIN_DATA}/state/ so skills
# reference this script instead of raw file operations.
#
# Adopted from oh-my-claudecode state-tools pattern.
#
# Usage:
#   state-manager.sh read  <key>
#   state-manager.sh write <key> <json-value>
#   state-manager.sh clear <key>
#   state-manager.sh list
#   state-manager.sh exists <key>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${CLAUDE_PLUGIN_DATA:-${PLUGIN_ROOT}/.data}"
STATE_DIR="${DATA_DIR}/state"

# Ensure state directory exists
mkdir -p "$STATE_DIR"

cmd="${1:-help}"
key="${2:-}"

state_file() {
  echo "${STATE_DIR}/${key}.json"
}

lock_dir() {
  echo "${STATE_DIR}/.${key}.lock"
}

# Advisory file locking via mkdir (atomic on all filesystems, portable macOS/Linux)
# Usage: with_lock <fn>   (uses global $key for lock name)
with_lock() {
  local fn="$1" ld retries=0
  ld="$(lock_dir)"
  while ! mkdir "$ld" 2>/dev/null; do
    retries=$((retries + 1))
    if [ "$retries" -ge 50 ]; then
      # Stale lock check: remove if older than 30s
      if [ -d "$ld" ] && find "$ld" -maxdepth 0 -mmin +0.5 -print -quit 2>/dev/null | grep -q .; then
        rmdir "$ld" 2>/dev/null || true
      else
        echo '{"error":"failed to acquire lock"}' >&2
        return 1
      fi
    fi
    sleep 0.1
  done
  # Ensure lock is released on exit
  trap 'rmdir "'"$ld"'" 2>/dev/null' EXIT
  "$fn"
  local rc=$?
  rmdir "$ld" 2>/dev/null
  trap - EXIT
  return $rc
}

# Atomic write: write to temp, then mv into place
atomic_write() {
  local target="$1" content="$2"
  local tmp
  tmp="$(mktemp "${STATE_DIR}/.tmp.XXXXXX")"
  echo "$content" > "$tmp"
  mv "$tmp" "$target"
}

validate_key() {
  if [ -z "$key" ]; then
    echo '{"error":"key is required"}' >&2
    exit 1
  fi
  # Positive allowlist: alphanumeric, hyphens, underscores only
  if ! [[ "$key" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo '{"error":"key must be alphanumeric with hyphens/underscores only"}' >&2
    exit 1
  fi
}

case "$cmd" in
  read)
    validate_key
    _do_read() {
      local file
      file="$(state_file)"
      if [ -f "$file" ]; then
        cat "$file"
      else
        echo "null"
      fi
    }
    with_lock _do_read
    ;;

  write)
    validate_key
    value="${3:-}"
    if [ -z "$value" ]; then
      echo '{"error":"value is required for write"}' >&2
      exit 1
    fi
    # Validate JSON before writing (uses node since it is already a hard requirement)
    if ! echo "$value" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{JSON.parse(d)}catch{process.exit(1)}})" 2>/dev/null; then
      echo '{"error":"value is not valid JSON"}' >&2
      exit 1
    fi
    _do_write() {
      atomic_write "$(state_file)" "$value"
      echo '{"ok":true}'
    }
    with_lock _do_write
    ;;

  clear)
    validate_key
    _do_clear() {
      local file
      file="$(state_file)"
      if [ -f "$file" ]; then
        rm "$file"
        echo '{"ok":true,"deleted":true}'
      else
        echo '{"ok":true,"deleted":false}'
      fi
    }
    with_lock _do_clear
    ;;

  list)
    if [ -d "$STATE_DIR" ]; then
      first=true
      printf '['
      for f in "$STATE_DIR"/*.json; do
        [ -f "$f" ] || continue
        $first || printf ','
        first=false
        printf '"%s"' "$(basename "$f" .json)"
      done
      printf ']\n'
    else
      printf '[]\n'
    fi
    ;;

  exists)
    validate_key
    file="$(state_file)"
    if [ -f "$file" ]; then
      echo '{"exists":true}'
    else
      echo '{"exists":false}'
    fi
    ;;

  help|*)
    echo "Usage: state-manager.sh <read|write|clear|list|exists> [key] [value]"
    echo ""
    echo "Commands:"
    echo "  read  <key>          Read state for key (returns JSON or null)"
    echo "  write <key> <json>   Write JSON value to key"
    echo "  clear <key>          Delete state for key"
    echo "  list                 List all state keys"
    echo "  exists <key>         Check if key exists"
    echo ""
    echo "State directory: ${STATE_DIR}"
    ;;
esac
