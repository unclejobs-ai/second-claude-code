#!/usr/bin/env bash
# SCC Artifact Viewer — stop script
# Usage: bash stop-server.sh [--session-dir DIR]

set -euo pipefail

SESSION_DIR="${SCC_SESSION_DIR:-/tmp/scc-session}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session-dir)
      SESSION_DIR="${2:-}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

STATE_DIR="${SESSION_DIR}/state"
PID_FILE="${STATE_DIR}/server.pid"
INFO_FILE="${STATE_DIR}/server-info.json"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

if [[ ! -f "$PID_FILE" ]]; then
  rm -f "$INFO_FILE"
  printf '{"ok":true,"status":"not-running","session_dir":"%s"}\n' "$(json_escape "$SESSION_DIR")"
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"

if [[ -z "$PID" ]] || ! kill -0 "$PID" 2>/dev/null; then
  rm -f "$PID_FILE" "$INFO_FILE"
  printf '{"ok":true,"status":"stale","session_dir":"%s"}\n' "$(json_escape "$SESSION_DIR")"
  exit 0
fi

kill "$PID" 2>/dev/null || true

for _ in {1..50}; do
  if ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$PID_FILE" "$INFO_FILE"
    printf '{"ok":true,"status":"stopped","pid":%s,"session_dir":"%s"}\n' "$PID" "$(json_escape "$SESSION_DIR")"
    exit 0
  fi
  sleep 0.1
done

printf '{"ok":false,"status":"still-running","pid":%s,"session_dir":"%s"}\n' "$PID" "$(json_escape "$SESSION_DIR")"
exit 1
