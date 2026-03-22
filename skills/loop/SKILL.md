---
name: loop
description: "Use when running review-fix cycles on a file until it meets a quality target, with variant-based recovery on plateau"
---

# Loop

Run review-fix cycles on a draft until it meets a target verdict, with temperature escalation and best-of selection to escape plateaus.

## When to Use

- A draft plus an initial review report already exist
- The user or an upstream skill (PDCA Act, workflow) needs iterative improvement
- Single-pass editing plateaued at the same verdict across 2+ iterations

## Workflow

1. Read the target file and record a baseline hash. Determine whether the file is git-tracked via `git ls-files --error-unmatch <file>`.
2. If `--review` is provided, load that report as the first findings set. Otherwise run `/second-claude-code:review` to generate an initial report.
3. For each iteration (up to `--max`):
   a. Select the editor prompt strategy based on iteration number and `--temperature-escalation` (see Temperature Escalation below).
   b. If `--best-of N` is greater than 1, run N variants in parallel (see Best-of Selection below). Otherwise run a single edit pass.
   c. After editing, run `/second-claude-code:review --preset quick` to score the result.
   d. If the new score is lower than the previous score: revert the file (see Revert Strategy) and log the regression. Do NOT update the baseline.
   e. If the new score is equal to or higher: update the baseline hash and log the verdict.
4. Stop when:
   - The target verdict is met (`--target`), or
   - `--max` iterations are exhausted, or
   - Verdict plateaus (same verdict for 2 consecutive iterations with no Critical-count reduction) AND `--temperature-escalation` is off.
5. **Completion gate**: Run `/second-claude-code:review --preset quick` on the **best variant** (highest critic score), not necessarily the latest. Exit only on `APPROVED` or `MINOR FIXES`. If the final review returns `MUST FIX` or `NEEDS IMPROVEMENT`, continue refining up to `--max` remaining budget.

### Revert Strategy

- **Git-tracked files**: `git checkout -- <file>`.
- **Non-git files**: restore from `baseline_content` stored in `loop-active.json`.
- **Before reverting**: run `git diff --name-only <file>`. If uncommitted changes that predate this loop's baseline are detected, warn the user and abort the revert unless they confirm. Never silently overwrite work.
- **Path validation**: reject any path containing `../` or resolving outside the project root.

## Temperature Escalation

Enabled with `--temperature-escalation`. Changes the editor's prompt strategy per iteration:

| Iteration | Strategy | Editor Instruction |
|-----------|----------|--------------------|
| 1 | Standard | Apply the top findings from the review report as written. |
| 2 (on failure) | Diverge | "Try a fundamentally different approach — reframe the argument, restructure the sections, or change the angle entirely. Do not repeat the same fixes from iteration 1." |
| 3+ (on continued failure) | Minimize | "Minimize changes. Fix only the single top Critical or highest-severity finding. Do not touch anything else." |

"Failure" means the iteration did not improve the score or verdict compared to the previous baseline.

When `--temperature-escalation` is off (default), all iterations use the standard strategy.

## Best-of Selection

Enabled with `--best-of N` where N > 1. On any single iteration, instead of a single edit pass, dispatch N editor subagents in parallel, each using a distinct prompt strategy:

| Variant | Prompt Strategy |
|---------|----------------|
| Variant 1 | Standard: apply the top findings literally |
| Variant 2 | Reframe: restructure or change the approach |
| Variant 3+ | Minimize: fix only the top critical finding |

After all N variants complete:

1. Run `/second-claude-code:review --preset quick` on each variant independently.
2. Compare scores from each reviewer's Critic Output block.
3. Keep the variant with the highest score. Discard all others — revert discarded variants using the Revert Strategy.
4. If scores are equal, prefer the most recently completed variant (fresher context).
5. Update the baseline with the winning variant.

The iteration log records: variant count, each variant's score, and which variant was selected.

### Best Result Selection

After all iterations complete, if multiple attempts were made across iterations (via `--best-of` or `--temperature-escalation`), select the result with the highest critic score from any attempt across all iterations. If scores are equal, prefer the most recent attempt. This is the artifact that advances to the completion gate review.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--file` | path to the draft to iterate on | required |
| `--review` | path to initial review report (skips first review cycle) | none |
| `--max` | `1-10` | `3` |
| `--target` | verdict (`APPROVED`, `MINOR FIXES`, `NEEDS IMPROVEMENT`) or score (e.g., `0.8`) | `APPROVED` |
| `--promise` | text injected into each editor's context as a hard constraint | none |
| `--temperature-escalation` | flag | off |
| `--best-of` | `1-5` | `1` |

## State

> **Data directory**: `${CLAUDE_PLUGIN_DATA}` is set by the plugin system. If unavailable, fall back to `.data/` relative to the plugin root. Before writing state files, verify the directory exists with `mkdir -p`.

Save active state to `${CLAUDE_PLUGIN_DATA}/state/loop-active.json`:

```json
{
  "goal": "...",
  "file": "...",
  "current_iteration": 2,
  "max": 3,
  "target": "APPROVED",
  "temperature_escalation": false,
  "best_of": 1,
  "verdicts": ["NEEDS IMPROVEMENT", "MINOR FIXES"],
  "scores": [0.61, 0.74],
  "best_score": 0.74,
  "best_variant_path": "...",
  "baseline_hash": "...",
  "baseline_content": null,
  "is_git_tracked": true,
  "feedback_log": []
}
```

- `baseline_content`: stores full file content when `is_git_tracked` is false.
- `best_score` / `best_variant_path`: updated after each iteration to track the globally best result seen.

## Output

Return the final artifact plus an iteration log:

```markdown
# Loop Complete

**File**: {path}
**Iterations**: {N}
**Final Verdict**: {verdict}
**Best Score**: {score}

## Verdict Progression

| Iteration | Strategy | Variants | Score | Verdict | Action |
|-----------|----------|----------|-------|---------|--------|
| 1 | standard | 1 | 0.61 | NEEDS IMPROVEMENT | kept |
| 2 | diverge | 3 | 0.74 | MINOR FIXES | kept (variant 2 won) |

## Key Changes
- {what changed and why it improved the score}
```

## Gotchas

- Do not claim improvement without comparing critic scores between iterations.
- Revert through `git checkout -- <file>` for git-tracked files, or restore from `baseline_content` for non-git files. Never rely on memory alone.
- Always run `git diff --name-only <file>` before reverting — abort with a warning if uncommitted user changes are detected outside this loop's own edits.
- Never revert a file whose path contains `../` or resolves outside the project root.
- Do not simulate review inline — always dispatch through `/second-claude-code:review`.
- Stop early if the verdict stops improving AND `--temperature-escalation` is off.
- The completion gate runs on the **best variant**, not the latest. Score comparison is the source of truth.
- **Temperature escalation increases cost proportionally.** Each escalated strategy adds a full editor pass plus a review pass. Use `--best-of` only when single-path iteration plateaus (same verdict 2+ times); do not enable it preemptively.
- When using `--best-of`, all N variants must be run in parallel — never sequentially — to avoid the winning variant biasing later ones.
- `--best-of` greater than 3 rarely improves outcomes and always increases cost. Prefer `--best-of 2` or `3` for plateau recovery.

## Subagents

```yaml
reviewer: { skill: /second-claude-code:review, constraint: "return score plus ranked findings per critic-schema.md" }
editor: { model: sonnet, tools: [Read, Edit], constraint: "apply only the top 3 findings; respect --promise constraint if set" }
variant_editor_N: { model: sonnet, tools: [Read, Edit], constraint: "use assigned prompt strategy; do not share context with other variants" }
```
