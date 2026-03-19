---
description: "Iterative improvement -- repeat until quality target met"
---

Invoke the `scc:loop` skill for iterative improvement.

## Arguments
- First argument: improvement goal (quoted string)
- `--max N` (max iterations, default: 3)
- `--target "condition"` (termination condition, default: /scc:review APPROVED)
- `--promise "text"` (completion promise for each iteration)

## Task
Use the Skill tool to invoke `scc:loop` with the provided goal and options.
