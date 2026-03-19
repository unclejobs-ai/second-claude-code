# Capture Gotchas

## Common failure patterns in knowledge capture

### 1. Verbatim capture
**Symptom**: The full URL content is stored with no reduction step
**Fix**: Force key_points exactly 3 and keep the summary to at most 3 sentences.

### 2. Wrong PARA classification
**Symptom**: Everything gets labeled as a Resource
**Fix**: Apply explicit criteria: Project has a deadline, Area is ongoing, Resource is reference material, Archive is inactive.

### 3. Superficial connections
**Symptom**: "This is related to AI" with no precise shared concept
**Fix**: Every connection must name the exact shared concept or insight. "AI" is too broad to be useful.

### 4. Duplicate capture
**Symptom**: The same URL or content is captured multiple times
**Fix**: Check for duplicate URLs and near-identical titles before saving.

### 5. Unsearchable storage
**Symptom**: The item is stored, but impossible to find later
**Fix**: Require tags, and make sure the title contains the primary search term.
