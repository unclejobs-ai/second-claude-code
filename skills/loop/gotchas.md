# Loop Gotchas

## Common failure patterns in iterative improvement

### 1. Improvement without evidence
**Symptom**: "I improved it" with no score comparison
**Fix**: Compare `/second-claude-code:review` scores every iteration. Revert if the score drops.

### 2. Over-editing
**Symptom**: Rewriting more than half the document in one iteration
**Fix**: Address only the top 3 feedback items per iteration. Save the rest for the next round.

### 3. Infinite loops
**Symptom**: The target score is never reached and the loop continues indefinitely
**Fix**: Always enforce `--max` and stop on plateau conditions.

### 4. Failed reverts
**Symptom**: The draft gets worse and cannot be restored cleanly
**Fix**: Revert through git and record the baseline hash at the start of each iteration.

### 5. Session interruption
**Symptom**: Loop state is lost after the session ends
**Fix**: Save state to `loop-active.json` after every iteration and restore it next session.
