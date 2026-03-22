---
description: "Plan/Gather phase -- deep autonomous research on any topic"
argument-hint: "AI agent landscape 2026"
---

Invoke the `/second-claude-code:research` command to perform deep research through the `research` skill.

## Context
- Cached research briefs: !`ls .captures/research-*.md 2>/dev/null | wc -l | xargs echo "Cached research briefs:"`

## Arguments
- First argument: research topic (required)
- `--depth shallow|medium|deep` (default: medium)
- `--sources web|academic|news` (default: web)

## Your task
Perform the research now using the plugin's loaded `research` skill and the provided arguments.

- Return the final research brief directly.
- Do not say that you are invoking or have invoked a skill.
