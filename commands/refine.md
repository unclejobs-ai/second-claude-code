---
description: "Use when the user asks to fix, rewrite, polish, or improve a draft against review feedback until every note is addressed (fix this per the feedback, apply the review notes, tighten this, make it pass). Act/Refine phase -- iterative improvement until quality target met"
argument-hint: '"raise this to 4.5/5" --max 3'
---

Invoke the `/scc:refine` command for iterative improvement through the `refine` skill.

## Context
- Active refine loop: !`cat "${CLAUDE_PLUGIN_DATA:-${CLAUDE_PLUGIN_ROOT}/.data}/state/refine-active.json" 2>/dev/null || echo "No active loop"`

## Arguments
- First argument: improvement goal (quoted string)
- `--max N` (max iterations, default: 3)
- `--target "condition"` (termination condition, default: /scc:review APPROVED)
- `--promise "text"` (completion promise for each iteration)
- `--dod "criteria"` (semicolon-separated Definition of Done checklist; reviewers evaluate each criterion as PASS/FAIL per iteration)

## Your task
Perform the iterative improvement now using the plugin's loaded `refine` skill and the provided arguments.

- Return the actual refine result, not a plan to run it.
- Do not say that you are invoking or have invoked a skill.
