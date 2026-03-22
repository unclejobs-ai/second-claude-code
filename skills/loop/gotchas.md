# Loop Gotchas

## Common failure patterns in iterative improvement with variant selection

### 1. Improvement claimed without score comparison
**Symptom**: "Improved the draft" with no critic score recorded
**Fix**: After every editor pass (including each best-of variant), run `/second-claude-code:review --preset quick` and record the numeric score. Revert if the score does not improve from baseline.

### 2. Best-of variants run sequentially instead of in parallel
**Symptom**: Variant 2's editor sees output from Variant 1, causing convergence
**Fix**: All N variant editors must be dispatched in parallel with independent context. Each receives only the original file and the review report — never another variant's diff or output.

### 3. Latest variant selected instead of best-scoring variant
**Symptom**: Loop exits with the most recent edit, ignoring a higher-scoring earlier result
**Fix**: Track `best_score` and `best_variant_path` in `loop-active.json`. The completion gate always runs on the highest-scoring result, not the most recent.

### 4. Temperature escalation triggered prematurely
**Symptom**: Iteration 1 uses diverge or minimize strategy before standard has been tried
**Fix**: Escalation strategies activate only on failure (score did not improve). Iteration 1 always uses the standard strategy regardless of `--temperature-escalation`.

### 5. Cost runaway from `--best-of` misuse
**Symptom**: `--best-of 5` enabled from iteration 1, multiplying token usage by 5x per iteration
**Fix**: Use `--best-of` only after single-path iteration has plateaued (same verdict 2+ consecutive iterations). Prefer `--best-of 2` or `3`.

### 6. Revert overwrites uncommitted user changes
**Symptom**: A revert wipes changes the user made manually outside this loop run
**Fix**: Run `git diff --name-only <file>` before reverting. If external uncommitted changes are detected (baseline hash does not match), abort with a warning and require user confirmation before proceeding.

### 7. Plateau detection skipped when escalation is on
**Symptom**: Loop continues indefinitely even after all escalation strategies are exhausted
**Fix**: When `--temperature-escalation` is enabled and all three strategies (standard, diverge, minimize) have been tried without improvement, treat it as a plateau and stop. Escalation strategies do not extend the plateau grace period past `--max`.

### 8. Score ties resolved by variant order instead of recency
**Symptom**: Variant 1 is kept over Variant 3 when scores are equal, because it was listed first
**Fix**: On score ties, prefer the most recently completed variant (fresher context). Recency is the explicit tiebreaker.
