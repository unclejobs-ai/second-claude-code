---
name: loop
description: "Use when iteratively improving a draft until it meets a review target"
---

# Loop

Run review-fix cycles until a draft meets a target score or verdict, with resumable state on disk.

## When to Use

- A draft exists but is not good enough yet
- The user wants a specific quality bar
- Another skill produced output that needs iterative refinement

## Workflow

1. Read the current file and record a baseline hash.
2. Run `/second-claude-code:review` — this MUST dispatch actual subagents per the review skill spec. Do NOT simulate review inline or merge reviewer perspectives into one pass.
3. Apply only the top 3 feedback items.
4. Re-run `/second-claude-code:review` and keep the new baseline only if the verdict improves; otherwise revert using `git checkout -- <file>` to the committed baseline.
5. Stop when the target is met, `--max` is reached, or the verdict plateaus.
6. **Completion gate**: Before declaring done, run `/second-claude-code:review` with `--preset quick` (a parameter passed to `/scc:review`, not a loop option) one final time. If it returns `MUST FIX`, continue the loop. Only exit when the gate passes.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--max` | `1-10` | `3` |
| `--target` | score (e.g., 4.5) or verdict (e.g., APPROVED) | `APPROVED` |
| `--promise` | text injected into each reviewer's context as a constraint | none |

## State

Save active state to `${CLAUDE_PLUGIN_DATA}/state/loop-active.json` with:

```json
{"goal":"...","file":"...","current_iteration":2,"max":3,"verdicts":["NEEDS_WORK","APPROVED"],"baseline_hash":"...","feedback_log":[]}
```

## Output

Return the final draft plus an iteration log showing verdict progression and major changes.

## Gotchas

- Do not claim improvement without comparing verdicts between iterations.
- Revert through `git checkout -- <file>`, not in-memory hash comparison. Git is the source of truth.
- Do not simulate review inline — always dispatch through `/second-claude-code:review`.
- Stop early if the verdict stops improving across iterations.
- The completion gate is mandatory — never skip the final `/second-claude-code:review --preset quick` check.

## Subagents

```yaml
reviewer: { skill: /second-claude-code:review, constraint: "return score plus ranked feedback" }
editor: { model: opus, tools: [Read, Edit], constraint: "apply only the top 3 feedback items" }
```
