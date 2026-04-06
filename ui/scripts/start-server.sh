#!/usr/bin/env bash
# SCC Artifact Viewer — launch script
# Usage: bash start-server.sh [--session-dir DIR] [--dist-dir DIR] [--port PORT]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="${SCRIPT_DIR}/../dist"

exec node "${SCRIPT_DIR}/server.cjs" --dist-dir "${DIST_DIR}" "$@"
