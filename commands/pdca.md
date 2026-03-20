---
description: "PDCA cycle -- orchestrate Plan→Do→Check→Act with quality gates"
argument-hint: "AI agent market report" or --phase plan "topic"
---

Invoke the `/second-claude-code:pdca` command to run a full or partial PDCA knowledge work cycle through the `pdca` skill.

## Arguments
- First argument: topic or subject (required for full cycle or plan phase)
- `--phase plan|do|check|act|full` (default: auto-detect from context)
- `--depth shallow|medium|deep` (default: medium, applies to Plan phase)
- `--target` verdict or score (default: APPROVED, applies to Act phase)
- `--max` max Act iterations (default: 3)

## Your task
Run the PDCA cycle using the plugin's loaded `pdca` skill and the provided arguments.

- Auto-detect the phase from user intent if `--phase` is not specified.
- Execute phase gates between transitions — do not skip them.
- For full PDCA: run Plan → Do → Check → Act with gates between each.
- For single phase: run that phase and pause at its gate for user decision.
- Do not say that you are invoking or have invoked a skill.
