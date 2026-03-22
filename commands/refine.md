---
description: "Act/Refine phase -- iterative improvement until quality target met"
argument-hint: "raise this to 4.5/5" --max 3
---

Invoke the `/second-claude-code:refine` command for iterative improvement through the `refine` skill.

## Context
- Active refine loop: !`cat .data/state/refine-active.json 2>/dev/null || echo "No active loop"`

## Arguments
- First argument: improvement goal (quoted string)
- `--max N` (max iterations, default: 3)
- `--target "condition"` (termination condition, default: /second-claude-code:review APPROVED)
- `--promise "text"` (completion promise for each iteration)

## Your task
Perform the iterative improvement now using the plugin's loaded `refine` skill and the provided arguments.

- Return the actual refine result, not a plan to run it.
- Do not say that you are invoking or have invoked a skill.
