# Discover Gotchas

## Common failure patterns in skill discovery

### 1. Fabricated skill names
**Symptom**: "There is a skill called terraform-security-audit" when it does not exist
**Fix**: Recommend only from real search results and include the source for each result.

### 2. Outdated packages
**Symptom**: Recommending packages last updated years ago with broken dependencies
**Fix**: Prefer packages updated within the last year and flag older results clearly.

### 3. Installing too eagerly
**Symptom**: Running `npx skills add` without user approval
**Fix**: Require explicit approval before installation and show the install target first.

### 4. Overly broad queries
**Symptom**: Searching for "coding" and getting thousands of useless results
**Fix**: Narrow the query with domain-specific 2-3 word combinations.
