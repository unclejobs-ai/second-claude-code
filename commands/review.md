---
description: "Check/Verify phase -- multi-perspective review with consensus gate"
argument-hint: [target] [--preset content|strategy|code|quick|full]
---

Invoke the `/second-claude-code:review` command for multi-perspective quality review through the `review` skill.

## Context
- Current git status: !`git status --short`
- Current staged files: !`git diff --cached --stat`

## Arguments
- Optional: file path to review (defaults to staged files)
- `--preset content|strategy|code|quick|full` (default: content)

## Your task
Perform the review now using the plugin's loaded `review` skill and the provided arguments.

- Return the actual review report directly.
- Do not say that you are invoking or have invoked a skill.
