#!/usr/bin/env bash
# SCC Artifact Viewer — launch script
# Usage: bash start-server.sh [--session-dir DIR] [--dist-dir DIR] [--port PORT]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="${SCRIPT_DIR}/../dist"
SESSION_DIR="${SCC_SESSION_DIR:-/tmp/scc-session}"
PORT="3847"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session-dir)
      SESSION_DIR="${2:-}"
      shift 2
      ;;
    --dist-dir)
      DIST_DIR="${2:-}"
      shift 2
      ;;
    --port)
      PORT="${2:-}"
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
LOG_FILE="${STATE_DIR}/server.log"

mkdir -p "${STATE_DIR}"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    if [[ -f "$INFO_FILE" ]]; then
      cat "$INFO_FILE"
      exit 0
    fi
    printf '{"ok":true,"status":"running","url":"http://localhost:%s","pid":%s}\n' "$PORT" "$PID"
    exit 0
  fi
  rm -f "$PID_FILE" "$INFO_FILE"
fi

node "${SCRIPT_DIR}/server.cjs" \
  --session-dir "${SESSION_DIR}" \
  --dist-dir "${DIST_DIR}" \
  --port "${PORT}" \
  --pid-file "${PID_FILE}" \
  --info-file "${INFO_FILE}" \
  > "${LOG_FILE}" 2>&1 &

SERVER_PID="$!"

for _ in {1..50}; do
  if [[ -f "$INFO_FILE" ]]; then
    cat "$INFO_FILE"
    exit 0
  fi

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    ERROR_OUTPUT="$(tail -n 20 "$LOG_FILE" 2>/dev/null || true)"
    printf '{"ok":false,"status":"failed","pid":%s,"error":%s}\n' \
      "$SERVER_PID" \
      "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1] || ""))' "$ERROR_OUTPUT")"
    exit 1
  fi

  sleep 0.1
done

printf '{"ok":false,"status":"timeout","pid":%s}\n' "$SERVER_PID"
exit 1
