#!/bin/bash
# usage-tracker.sh — Log skill usage for analytics
# Usage: ./usage-tracker.sh <skill-name> [duration_ms]

SKILL_NAME="${1:?Usage: usage-tracker.sh <skill-name> [duration_ms]}"
DURATION="${2:-0}"
DATA_DIR="${CLAUDE_PLUGIN_DATA:-$(cd "$(dirname "$0")" && pwd)/../.data}"
LOG_FILE="$DATA_DIR/usage.jsonl"

# Validate skill name: alphanumeric, colon, hyphen, underscore only
if ! [[ "$SKILL_NAME" =~ ^[a-zA-Z0-9:_-]+$ ]]; then
  echo '{"error":"invalid skill name"}' >&2
  exit 1
fi

# Validate duration is numeric
if ! [[ "$DURATION" =~ ^[0-9]+$ ]]; then
  DURATION=0
fi

mkdir -p "$DATA_DIR"

# Append usage entry
printf '{"skill":"%s","timestamp":"%s","duration_ms":%d}\n' \
  "$SKILL_NAME" \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$DURATION" >> "$LOG_FILE"
