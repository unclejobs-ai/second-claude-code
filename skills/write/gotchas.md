# Write Gotchas

## Common failure patterns in content writing

### 1. Generic voice
**Symptom**: Every draft sounds the same, like a stock assistant response
**Fix**: Always load the voice guide from `references/voice-guides/` before writing.

### 2. Skipping research
**Symptom**: Writing from prior model knowledge and missing current evidence
**Fix**: `/second-claude-code:research` is mandatory unless explicit sources are provided.

### 3. Too little substance
**Symptom**: A newsletter or article stops before the core argument is developed
**Fix**: Enforce format minimums: newsletter 2000, article 3000, report 4000, shorts 300.

### 4. Missing CTA
**Symptom**: The conclusion ends without a next action
**Fix**: Require a specific CTA in every format.

### 5. Padding
**Symptom**: Repeating the same point in different words just to hit the length target
**Fix**: Every paragraph must add new information or insight. Delete repetition.
