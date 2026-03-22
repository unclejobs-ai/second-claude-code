#!/bin/bash
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

capabilities=()
declare -A cli_paths

# ── Core tools ────────────────────────────────────────────────────────────────

# Check for web fetch (curl)
if command -v curl &>/dev/null; then
  capabilities+=("web-fetch")
  cli_paths["web-fetch"]="$(which curl)"
fi

# Check for git
if command -v git &>/dev/null; then
  capabilities+=("git")
  cli_paths["git"]="$(which git)"
fi

# Check for Node.js
# Minimum recommended: Node.js 18 LTS (required by several skill scripts)
if command -v node &>/dev/null; then
  capabilities+=("node")
  cli_paths["node"]="$(which node)"
fi

# Check for npx (skills.sh)
# Minimum recommended: npm 7+ (npx bundled)
if command -v npx &>/dev/null; then
  capabilities+=("npx-skills")
  cli_paths["npx-skills"]="$(which npx)"
fi

# ── External reviewer / model CLIs ────────────────────────────────────────────
# These CLIs are used by the review and PDCA orchestration skills.
# Minimum version requirements should be documented in the respective skill's
# SKILL.md once stable version floors are established per CLI.

if command -v mmbridge &>/dev/null; then
  capabilities+=("mmbridge")
  cli_paths["mmbridge"]="$(which mmbridge)"
fi
if command -v kimi &>/dev/null; then
  capabilities+=("kimi")
  cli_paths["kimi"]="$(which kimi)"
fi
if command -v codex &>/dev/null; then
  capabilities+=("codex")
  cli_paths["codex"]="$(which codex)"
fi
if command -v gemini &>/dev/null; then
  capabilities+=("gemini")
  cli_paths["gemini"]="$(which gemini)"
fi

# ── Data / search tools ───────────────────────────────────────────────────────

# Check for firecrawl
if command -v firecrawl &>/dev/null; then
  capabilities+=("firecrawl")
  cli_paths["firecrawl"]="$(which firecrawl)"
fi

# ── Output ────────────────────────────────────────────────────────────────────

capabilities_json="$(printf '"%s",' "${capabilities[@]}" | sed 's/,$//')"

paths_json=""
for key in "${!cli_paths[@]}"; do
  paths_json+="\"${key}\": \"${cli_paths[$key]}\","
done
paths_json="${paths_json%,}"

printf '{"capabilities": [%s], "paths": {%s}}' "$capabilities_json" "$paths_json"
