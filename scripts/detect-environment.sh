#!/bin/bash
# detect-environment.sh — Detect available capabilities for Second Claude
# Called by session-start hook to determine what tools/CLIs are available

capabilities=()

# Check for web search
if command -v curl &>/dev/null; then
  capabilities+=("web-fetch")
fi

# Check for git
if command -v git &>/dev/null; then
  capabilities+=("git")
fi

# Check for Node.js
if command -v node &>/dev/null; then
  capabilities+=("node")
fi

# Check for npx (skills.sh)
if command -v npx &>/dev/null; then
  capabilities+=("npx-skills")
fi

# Check for mmbridge (optional external reviewer)
if command -v mmbridge &>/dev/null; then
  capabilities+=("mmbridge")
fi

# Check for firecrawl
if command -v firecrawl &>/dev/null; then
  capabilities+=("firecrawl")
fi

# Output as JSON array
printf '{"capabilities": [%s]}' "$(printf '"%s",' "${capabilities[@]}" | sed 's/,$//')"
