---
description: "God Hands -- gated gather, draft, check, and cut"
argument-hint: '"AI agent market report" or --phase plan "topic" or --no-questions'
---

Invoke the `/scc:godhands` command to run a gated knowledge-work pass through the `godhands` skill.

## Context
- Active PDCA state: !`cat "${CLAUDE_PLUGIN_DATA:-${CLAUDE_PLUGIN_ROOT}/.data}/state/pdca-active.json" 2>/dev/null || echo "No active PDCA"`

## Arguments
- First argument: topic or subject (required for a full pass or gather phase)
- `--phase plan|do|check|act|full` (default: auto-detect from context)
- `--depth shallow|medium|deep` (default: medium, applies to Gather)
- `--target` verdict or score (default: APPROVED, applies to Cut)
- `--max` max Cut iterations (default: 3)
- `--no-questions` skip the Question Protocol in Gather (useful for automation)

## Your task
Run the God Hands pass using the plugin's loaded `godhands` skill and the provided arguments.

- Auto-detect the phase from user intent if `--phase` is not specified.
- Execute phase gates between transitions — do not skip them.
- For a full pass: Gather → Draft → Check → Cut with gates between each.
- For a single phase: run that phase and pause at its gate for user decision.
- Gather chains research → analyze with an optional Question Protocol (max 3 questions).
- Draft runs write in pure execution mode (`--skip-research --skip-review`).
- Cut uses the Action Router to classify findings before routing to Gather, Draft, or refine.
- Runtime state and MCP tools remain `pdca_*`. `/scc:pdca` is the compat alias.
- Do not say that you are invoking or have invoked a skill.
