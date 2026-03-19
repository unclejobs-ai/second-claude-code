# Collect Gotchas

## Common failure patterns in knowledge collection

### 1. Verbatim collection
**Symptom**: The full URL content is stored with no reduction step
**Fix**: Force key_points exactly 3 and keep the summary to at most 3 sentences.

### 2. Wrong PARA classification
**Symptom**: Everything gets labeled as a Resource
**Fix**: Apply explicit criteria: Project has a deadline, Area is ongoing, Resource is reference material, Archive is inactive.

### 3. Superficial connections
**Symptom**: "This is related to AI" with no precise shared concept
**Fix**: Every connection must name the exact shared concept or insight. "AI" is too broad to be useful. A connection must pass the quality gate: it names a specific principle, pattern, or concept. If nothing specific exists, use an empty connections array instead of forcing a vague one.

Good: "Both apply the Feynman technique of explaining to simplify"
Bad: "Related to learning" (topic, not concept)

### 4. Duplicate collection
**Symptom**: The same URL or content is collected multiple times
**Fix**: Check for duplicate URLs and near-identical titles before saving.

### 5. Unsearchable storage
**Symptom**: The item is stored, but impossible to find later
**Fix**: Require tags, and make sure the title contains the primary search term.

### 6. Inline subagent execution
**Symptom**: Analyst and connector run in the same context; connections are biased by the analyst's framing instead of being independently derived from the knowledge base
**Fix**: Both analyst and connector MUST be dispatched as separate subagents. The connector receives only the original source and the knowledge base path — never the analyst's summary or key points. If dispatch is unavailable, use explicit context barriers (sequential execution, passing only raw source to connector).

### 7. Missing markdown dual output
**Symptom**: Only .json file is created; .md file is missing or does not follow the template
**Fix**: Every collected item must produce both .json and .md files. The .md file must use YAML frontmatter and follow the exact template defined in SKILL.md.

### 8. Unranked search results
**Symptom**: Search returns results in arbitrary order (e.g., filesystem order)
**Fix**: Apply the weighted scoring system: exact tag match (10), title substring (7), key point match (4), summary match (2). Sum scores for multiple matches in the same item. Sort descending; break ties by collected_at (newest first).
