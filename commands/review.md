---
description: "Multi-perspective quality review with consensus gate"
---

Invoke the `scc:review` skill for multi-perspective quality review.

## Context
- Current git status: !`git status --short`
- Current staged files: !`git diff --cached --stat`

## Arguments
- Optional: file path to review (defaults to staged files)
- `--preset content|strategy|code|quick|full` (default: content)

## Task
Use the Skill tool to invoke `scc:review` with the provided target and preset.
