---
description: "Check phase -- systematic debugging with root cause investigation"
argument-hint: "<error description or symptoms>"
---

Invoke the `/second-claude-code:investigate` command for systematic root-cause debugging through the `investigate` skill.

## Context
- Current git status: !`git status --short`
- Recent commits: !`git log --oneline -10`
- Current branch: !`git branch --show-current`

## Arguments
- Required: error description, stack trace, or symptom description

## Your task
Perform the investigation now using the plugin's loaded `investigate` skill and the provided arguments.

- Return the debug report directly.
- Do not say that you are invoking or have invoked a skill.
