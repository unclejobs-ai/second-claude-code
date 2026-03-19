# Review Gotchas

## Common failure patterns in review

### 1. Groupthink among reviewers
**Symptom**: All reviewers respond with "Looks good" and little else
**Fix**: Give each reviewer independent context and prevent them from seeing other outputs.

### 2. Fake fact-checking
**Symptom**: "This statistic is correct" with no real verification
**Fix**: The `fact-checker` must use WebSearch. No source URL means `UNVERIFIED`.

### 3. Generic feedback
**Symptom**: "Overall good, but needs improvement" with no usable detail
**Fix**: Require exact locations: `file:line` for code and section/paragraph references for content.

### 4. Severity inflation
**Symptom**: Every issue gets marked `Critical`
**Fix**: Reserve `Critical` for ship-blocking problems only and apply the severity rubric consistently.

### 5. Rewriting instead of reviewing
**Symptom**: The reviewer rewrites the entire document instead of identifying issues
**Fix**: Reviewers identify problems only. The `editor` agent owns revisions.
