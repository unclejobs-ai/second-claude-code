---
name: refine
description: "Use when iteratively improving a draft until it meets a review target"
effort: medium
---

## Iron Law

> **A fix without a review is not a fix.**

## Red Flags

- "I fixed the wording but the meaning is basically the same" → STOP, because refinement must preserve the author's intent — changing meaning during polish is an unauthorized rewrite.
- "The score went up so the fix must be good" → STOP, because you must compare verdicts between iterations, not just scores — a higher score with new Critical findings is a regression.
- "Let me do one more pass, I can make it even better" → STOP, because the plateau rule (same verdict for 2 consecutive iterations) exists to prevent infinite loops — stop when improvement stalls.
- "I'll skip the completion gate, the last review was already APPROVED" → STOP, because the final `/scc:review --preset quick` check is mandatory — never declare done without it.
- "The reviewers disagreed so I'll just pick the feedback I like" → STOP, because reviewer consensus drives refinement priority — Critical and Major findings from any reviewer must be addressed before Minor ones.

# Refine

Run review-fix cycles until a draft meets a target score or verdict, with resumable state on disk.

## When to Use

- A draft exists but is not good enough yet
- The user wants a specific quality bar
- Another skill produced output that needs iterative refinement

## Workflow

1. Read the current file and record a baseline hash. If `--dod` is provided, parse the semicolon-separated string into a numbered criteria list and store in state as `dod_criteria`.
2. Run `/second-claude-code:review` — this MUST dispatch actual subagents per the review skill spec. Do NOT simulate review inline or merge reviewer perspectives into one pass. When `--dod` is active, inject the following block into each reviewer's context alongside any `--promise` text:
   ```
   ## DoD Checklist — evaluate each criterion independently
   1. [criterion text]
   2. [criterion text]
   ...
   For EACH criterion, append a line: `DoD-N: PASS` or `DoD-N: FAIL — <reason>`
   ```
   After reviewers return, extract `DoD-N: PASS/FAIL` lines and compute per-criterion consensus (majority across reviewers). Store results in state `dod_results`.
3. Apply fixes. When `--dod` is active, **prioritize FAIL DoD criteria first** (up to 3 total including general feedback). If all DoD criteria already pass, fall back to the standard top-3 general feedback.
4. Re-run `/second-claude-code:review` (with DoD checklist re-injected) and keep the new baseline only if the verdict improves; otherwise revert. If mmbridge was used in the original review, run `mmbridge resume` before dispatching the full re-review to get the external reviewer's preliminary assessment of fixes (see MMBridge Refinement Enhancement below). Revert strategy:
   - **Before reverting a git-tracked file**: run `git diff --name-only <file>`. If the file shows uncommitted user changes that are NOT from this refine iteration (i.e., changes that predate `baseline_hash`), **warn the user and abort the revert** unless they explicitly confirm. Never silently overwrite uncommitted work.
   - **Path validation**: confirm the file path resolves within the project root — reject any path containing `../` traversal or resolving outside the working directory.
   - For git-tracked files with no external uncommitted changes: use `git checkout -- <file>`.
   - For non-git files (e.g., in `${CLAUDE_PLUGIN_DATA}`): restore from `baseline_content` in `refine-active.json`.
5. Stop when the target is met, `--max` is reached, or the verdict **plateaus** (same verdict for 2 consecutive iterations with no severity reduction). When `--dod` is active, the target is only considered met when **all DoD criteria pass** AND the score/verdict target is satisfied.
6. **Completion gate**: Before declaring done, run `/second-claude-code:review` with `--preset quick` (a parameter passed to `/scc:review`, not a refine option) one final time (with DoD checklist if active). Only exit on `APPROVED` or `MINOR FIXES` **and all DoD criteria PASS**. If it returns `MUST FIX` or `NEEDS IMPROVEMENT`, or any DoD criterion is FAIL, continue refining.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--max` | `1-10` | `3` |
| `--target` | score (e.g., 4.5) or verdict (e.g., APPROVED) | `APPROVED` |
| `--promise` | text injected into each reviewer's context as a constraint | none |
| `--dod` | semicolon-separated success criteria checklist (e.g. `"no factual errors; every section has examples"`) | none |
| `--file` | path to the draft to iterate on | required |
| `--review` | path to initial review report (skips first review cycle) | none |

When called from a pipeline with `input_from`, the first file is the draft (`--file`) and the second (if present) is the initial review report (`--review`).

## State

> **Data directory**: `${CLAUDE_PLUGIN_DATA}` is set by the plugin system. If unavailable, fall back to `.data/` relative to the plugin root. Before writing state files, verify the directory exists with `mkdir -p`.

Save active state to `${CLAUDE_PLUGIN_DATA}/state/refine-active.json` with:

```json
{"goal":"...","file":"...","current_iteration":2,"max":3,"verdicts":["NEEDS IMPROVEMENT","APPROVED"],"scores":[],"baseline_hash":"...","baseline_content":null,"is_git_tracked":true,"feedback_log":[],"dod_criteria":["no factual errors","every section has examples"],"dod_results":[[true,false],[true,true]]}
```

- `dod_criteria`: array of criterion strings parsed from `--dod`. Empty array when `--dod` is not used.
- `dod_results`: array of arrays — one boolean array per iteration, positionally matching `dod_criteria`. `true` = PASS (majority of reviewers agreed), `false` = FAIL.

- `baseline_content`: stores the full file content when `is_git_tracked` is false (non-git files cannot be reverted via `git checkout`)
- `is_git_tracked`: set at step 1 by running `git ls-files --error-unmatch <file>`. Determines the revert strategy.

## MMBridge Refinement Enhancement

When mmbridge is detected (see `references/mmbridge-integration.md`) and the previous review cycle used `--external`, the refine skill can leverage mmbridge's session continuity for smarter iterations.

### Followup — Clarifying Review Findings

When a review finding is ambiguous or the editor needs more context before fixing:

```bash
mmbridge followup --tool kimi --prompt "<specific question about a finding>" --latest --json > /tmp/mmbridge-followup-${RUN_ID}.json
```

- `--latest`: reuses the most recent review session for this project
- Use this BEFORE applying fixes when a Critical or Major finding's intent is unclear
- Parse the followup JSON response and provide it to the editor alongside the original finding

### Resume — Re-review After Fixes

After the editor applies fixes (Step 3), before dispatching a full internal re-review (Step 4):

```bash
mmbridge resume --action followup -y --json > /tmp/mmbridge-resume-${RUN_ID}.json
```

- This asks the original external reviewer to evaluate the fixes against its earlier findings
- The resume result is merged as supplemental context into the next `/scc:review` cycle
- If resume indicates all external findings are addressed, it counts as a positive signal for the consensus gate

### When to Use

- **Followup**: when a review finding (especially from `[external: mmbridge]`) lacks actionable detail
- **Resume**: at every re-review cycle if mmbridge was used in the original review
- **Skip both**: if the original review did not use `--external`, or if mmbridge is not installed

### Cost Note

Followup and resume reuse existing mmbridge sessions — they are cheaper than dispatching a full new review.

## Output

Return the final draft plus an iteration log showing verdict progression and major changes. When `--dod` is active, append DoD status per iteration:

```
Round 0 (baseline):  2.0/5  ||||..............  MUST FIX
  DoD: [x] no factual errors  [ ] every section has examples

Round 1 (post-edit): 3.8/5  |||||||||||||||...  MINOR FIXES  (+1.8)
  DoD: [x] no factual errors  [x] every section has examples  ✓ ALL PASS
```

## Gotchas

- Do not claim improvement without comparing verdicts between iterations.
- Revert through `git checkout -- <file>` for git-tracked files, or restore from `baseline_content` for non-git files. Never rely on memory alone. Always check `git diff --name-only <file>` before reverting — abort with a warning if uncommitted user changes are detected outside this refine pass's own edits.
- Never revert a file whose path contains `../` or resolves outside the project root.
- Do not simulate review inline — always dispatch through `/second-claude-code:review`.
- Stop early if the verdict stops improving across iterations.
- The completion gate is mandatory — never skip the final `/second-claude-code:review --preset quick` check.

## Subagents

```yaml
reviewer: { skill: /second-claude-code:review, constraint: "return score plus ranked feedback" }
editor: { model: opus, tools: [Read, Edit], constraint: "apply only the top 3 feedback items" }
```
