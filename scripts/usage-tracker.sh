#!/bin/bash
# usage-tracker.sh — Log skill usage for analytics
# Usage: ./usage-tracker.sh <skill-name> [duration_ms]

SKILL_NAME="${1:?Usage: usage-tracker.sh <skill-name> [duration_ms]}"
DURATION="${2:-0}"
DATA_DIR="${CLAUDE_PLUGIN_DATA:-$(dirname "$0")/../.data}"
LOG_FILE="$DATA_DIR/usage.jsonl"

mkdir -p "$DATA_DIR"

# Append usage entry
printf '{"skill":"%s","timestamp":"%s","duration_ms":%s}\n' \
  "$SKILL_NAME" \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$DURATION" >> "$LOG_FILE"
