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

### 6. Cross-contamination between reviewers
**Symptom**: Later reviewers echo the same phrasing or framing as earlier reviewers; findings converge suspiciously
**Fix**: Each reviewer receives ONLY the content to review and their role prompt. They must NOT receive other reviewers' findings, summaries, or verdicts — not even across rounds. The main session merges findings after all reviewers have completed independently.

### 7. Vague fix suggestions
**Symptom**: Findings say "improve this section" or "consider revising" without actionable specifics
**Fix**: Every finding must include a concrete fix suggestion: "Change X to Y", "Add error handling for case Z", "Move paragraph 3 before paragraph 2". If the reviewer cannot propose a specific fix, they must state why (e.g., "requires domain expertise to determine correct value").

### 8. Duplicate findings inflate severity
**Symptom**: Three reviewers flag the same typo, making it look like three separate issues
**Fix**: Apply deduplication rules from SKILL.md. Merge identical findings, credit all agreeing reviewers, but count the issue only once in the report. Agreeing reviewers still count as individual voters for consensus.
