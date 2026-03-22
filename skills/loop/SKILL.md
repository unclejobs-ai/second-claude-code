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
4. Re-run `/second-claude-code:review` and keep the new baseline only if the verdict improves; otherwise revert. Revert strategy:
   - **Before reverting a git-tracked file**: run `git diff --name-only <file>`. If the file shows uncommitted user changes that are NOT from this loop iteration (i.e., changes that predate `baseline_hash`), **warn the user and abort the revert** unless they explicitly confirm. Never silently overwrite uncommitted work.
   - **Path validation**: confirm the file path resolves within the project root — reject any path containing `../` traversal or resolving outside the working directory.
   - For git-tracked files with no external uncommitted changes: use `git checkout -- <file>`.
   - For non-git files (e.g., in `${CLAUDE_PLUGIN_DATA}`): restore from `baseline_content` in `loop-active.json`.
5. Stop when the target is met, `--max` is reached, or the verdict **plateaus** (same verdict for 2 consecutive iterations with no severity reduction).
6. **Completion gate**: Before declaring done, run `/second-claude-code:review` with `--preset quick` (a parameter passed to `/scc:review`, not a loop option) one final time. Only exit on `APPROVED` or `MINOR FIXES`. If it returns `MUST FIX` or `NEEDS IMPROVEMENT`, continue the loop.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--max` | `1-10` | `3` |
| `--target` | score (e.g., 4.5) or verdict (e.g., APPROVED) | `APPROVED` |
| `--promise` | text injected into each reviewer's context as a constraint | none |
| `--file` | path to the draft to iterate on | required |
| `--review` | path to initial review report (skips first review cycle) | none |

When called from a pipeline with `input_from`, the first file is the draft (`--file`) and the second (if present) is the initial review report (`--review`).

## State

> **Data directory**: `${CLAUDE_PLUGIN_DATA}` is set by the plugin system. If unavailable, fall back to `.data/` relative to the plugin root. Before writing state files, verify the directory exists with `mkdir -p`.

Save active state to `${CLAUDE_PLUGIN_DATA}/state/loop-active.json` with:

```json
{"goal":"...","file":"...","current_iteration":2,"max":3,"verdicts":["NEEDS IMPROVEMENT","APPROVED"],"scores":[],"baseline_hash":"...","baseline_content":null,"is_git_tracked":true,"feedback_log":[]}
```

- `baseline_content`: stores the full file content when `is_git_tracked` is false (non-git files cannot be reverted via `git checkout`)
- `is_git_tracked`: set at step 1 by running `git ls-files --error-unmatch <file>`. Determines the revert strategy.

## Output

Return the final draft plus an iteration log showing verdict progression and major changes.

## Gotchas

- Do not claim improvement without comparing verdicts between iterations.
- Revert through `git checkout -- <file>` for git-tracked files, or restore from `baseline_content` for non-git files. Never rely on memory alone. Always check `git diff --name-only <file>` before reverting — abort with a warning if uncommitted user changes are detected outside this loop's own edits.
- Never revert a file whose path contains `../` or resolves outside the project root.
- Do not simulate review inline — always dispatch through `/second-claude-code:review`.
- Stop early if the verdict stops improving across iterations.
- The completion gate is mandatory — never skip the final `/second-claude-code:review --preset quick` check.

## Subagents

```yaml
reviewer: { skill: /second-claude-code:review, constraint: "return score plus ranked feedback" }
editor: { model: opus, tools: [Read, Edit], constraint: "apply only the top 3 feedback items" }
```
