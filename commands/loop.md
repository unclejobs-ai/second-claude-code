---
description: "Act/Refine phase -- iterative improvement until quality target met"
argument-hint: <goal> [options]
---

Invoke the `/second-claude-code:loop` command for iterative improvement through the `loop` skill.

## Arguments
- First argument: improvement goal (quoted string)
- `--max N` (max iterations, default: 3)
- `--target "condition"` (termination condition, default: /second-claude-code:review APPROVED)
- `--promise "text"` (completion promise for each iteration)

## Your task
Perform the iterative improvement now using the plugin's loaded `loop` skill and the provided arguments.

- Return the actual loop result, not a plan to run it.
- Do not say that you are invoking or have invoked a skill.
