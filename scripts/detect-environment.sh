#!/usr/bin/env bash
# detect-environment.sh — Detect available capabilities for Second Claude
# Called by session-start hook to determine what tools/CLIs are available
#
# Output format: {"capabilities": [...], "paths": {...}}
#   capabilities — array of capability tokens recognised by the skill system
#   paths        — map of capability token → absolute resolved path of the CLI
#
# Minimum version requirements for external reviewer CLIs should be documented
# alongside each check below. Version ranges are not validated here — this
# script only confirms presence and resolves the path. If a CLI is present but
# too old, the skill invoking it is responsible for surfacing the error.

# Uses parallel arrays (path_keys / path_vals) instead of declare -A to remain
# compatible with bash 3.x (macOS ships bash 3.2 as /bin/bash).

capabilities=()
path_keys=()
path_vals=()

# ── Core tools ────────────────────────────────────────────────────────────────

# Check for web fetch (curl)
if command -v curl &>/dev/null; then
  capabilities+=("web-fetch")
  path_keys+=("web-fetch")
  path_vals+=("$(command -v curl)")
fi

# Check for git
if command -v git &>/dev/null; then
  capabilities+=("git")
  path_keys+=("git")
  path_vals+=("$(command -v git)")
fi

# Check for Node.js
# Minimum recommended: Node.js 18 LTS (required by several skill scripts)
if command -v node &>/dev/null; then
  capabilities+=("node")
  path_keys+=("node")
  path_vals+=("$(command -v node)")
fi

# Check for npx (skills.sh)
# Minimum recommended: npm 7+ (npx bundled)
if command -v npx &>/dev/null; then
  capabilities+=("npx-skills")
  path_keys+=("npx-skills")
  path_vals+=("$(command -v npx)")
fi

# ── External reviewer / model CLIs ────────────────────────────────────────────
# These CLIs are used by the review and PDCA orchestration skills.
# Minimum version requirements should be documented in the respective skill's
# SKILL.md once stable version floors are established per CLI.

if command -v mmbridge &>/dev/null; then
  capabilities+=("mmbridge")
  path_keys+=("mmbridge")
  path_vals+=("$(command -v mmbridge)")
fi
if command -v kimi &>/dev/null; then
  capabilities+=("kimi")
  path_keys+=("kimi")
  path_vals+=("$(command -v kimi)")
fi
if command -v codex &>/dev/null; then
  capabilities+=("codex")
  path_keys+=("codex")
  path_vals+=("$(command -v codex)")
fi
if command -v gemini &>/dev/null; then
  capabilities+=("gemini")
  path_keys+=("gemini")
  path_vals+=("$(command -v gemini)")
fi

# ── Data / search tools ───────────────────────────────────────────────────────

# Check for firecrawl
if command -v firecrawl &>/dev/null; then
  capabilities+=("firecrawl")
  path_keys+=("firecrawl")
  path_vals+=("$(command -v firecrawl)")
fi

# ── Output ────────────────────────────────────────────────────────────────────

capabilities_json="$(printf '"%s",' "${capabilities[@]}" | sed 's/,$//')"

paths_json=""
for i in "${!path_keys[@]}"; do
  paths_json+="\"${path_keys[$i]}\": \"${path_vals[$i]}\","
done
paths_json="${paths_json%,}"

printf '{"capabilities": [%s], "paths": {%s}}' "$capabilities_json" "$paths_json"
