---
description: "Check/Verify phase -- multi-perspective review with consensus gate"
argument-hint: draft.md --preset content
---

Invoke the `/second-claude-code:review` command for multi-perspective quality review through the `review` skill.

## Context
- Current git status: !`git status --short`
- Current staged files: !`git diff --cached --stat`
- Active review state: !`cat .data/state/review-aggregation.json 2>/dev/null || echo "No active review"`

## Arguments
- Optional: file path to review (defaults to staged files)
- `--preset content|strategy|code|quick|full` (default: content)

## Your task
Perform the review now using the plugin's loaded `review` skill and the provided arguments.

- Return the actual review report directly.
- Do not say that you are invoking or have invoked a skill.
