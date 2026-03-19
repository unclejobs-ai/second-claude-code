# Research Skill Retest: SKILL.md Improvements

Date: 2026-03-20
Previous score: 8/10
Target score: 9/10

## Weaknesses Addressed

### 1. Source Validation (was: "One Korean source returned only minified JS")

**Changes made:**
- Added Step 2 "Validate sources" to the workflow (between researcher dispatch and analyst dispatch), requiring verification that fetched content is readable -- not minified JS/CSS, login walls, error pages, or cookie-consent blockers.
- Added "Unreadable fetched content" row to Gotchas table with explicit reject criteria and replacement search instruction.
- Updated researcher subagent constraint to include "validate fetched content is readable (not minified JS, login walls, error pages)".

**Why this fixes it:** The original skill had no instruction to check whether a WebFetch result was actually usable. The researcher would collect a URL, fetch it, get back garbage, and still count it as a source. Now there is an explicit validation gate that discards bad fetches and triggers replacement searches.

### 2. Cross-Validation / Data Conflict Resolution (was: "GitHub star counts showed inconsistencies")

**Changes made:**
- Added a dedicated "Data Conflict Resolution" section with 5 ordered rules: (1) note discrepancy explicitly, (2) prefer authoritative source, (3) prefer recent source, (4) include both values with annotations when significant, (5) never average conflicting numbers.
- Added "Conflicting data points" row to Gotchas table.
- Updated analyst step to reference the conflict resolution rules.
- Updated analyst and writer subagent constraints to flag and annotate conflicts.

**Why this fixes it:** The original skill had no guidance for what to do when sources disagreed. The analyst would silently pick one value or pass through the inconsistency without comment. Now there is a clear priority chain (authoritative > recent) and a requirement to annotate discrepancies in the final brief.

### 3. Coverage Requirements (was: "Chinese ecosystem coverage was flagged as gap but not pursued")

**Changes made:**
- Added "Coverage Requirements (by depth)" table with minimum thresholds for English sources, non-English sources, and primary sources at each depth level.
- Defined "primary source" explicitly (official docs, whitepapers, peer-reviewed papers, original survey/benchmark data).
- Added "Coverage gaps at deep depth" row to Gotchas table requiring verification against the coverage table before synthesis.
- Updated analyst subagent constraint to "verify coverage requirements by depth".

**Why this fixes it:** The original skill set search count minimums (3/5/10) but had no diversity requirements. A `--depth deep` run could complete with 10 English blog posts and zero primary sources. Now the analyst must check the coverage table and document missing source types as known gaps rather than ignoring them.

### 4. Staleness Check (was: implicit issue with snapshot-timing differences)

**Changes made:**
- Added "Stale sources for current trends" row to Gotchas table: flag sources older than 6 months, prefer last 3 months, note in Gaps & Limitations if only stale sources available.
- Updated researcher subagent constraint to "flag source dates for staleness check".
- Updated analyst subagent constraint to "flag sources older than 6 months on trend topics".
- Updated writer subagent constraint to "note stale sources in Gaps & Limitations".

**Why this fixes it:** The original skill had no temporal awareness. A 2024 blog post about "AI agent trends" would be treated the same as a 2026 survey. Now there is an explicit freshness gate that flags aging sources when the research topic is about current trends.

## Revised Score: 9/10

**Improvement justification (+1):** All four identified weaknesses now have explicit countermeasures embedded in the workflow steps, gotchas table, and subagent constraints. The skill is now self-correcting for source quality (validation), data accuracy (conflict resolution), diversity (coverage requirements), and timeliness (staleness check).

**Remaining -1:** The skill still lacks runtime enforcement -- these are instructions, not programmatic checks. A careless subagent could still skip validation steps. Additionally, the coverage requirements for non-English sources use "if relevant" qualifiers that require judgment, which could be inconsistently applied. A future improvement could add a structured checklist that the analyst must fill out before handing off to the writer.

## Files Modified

- `/Users/parkeungje/project/second-claude/skills/research/SKILL.md` -- all four improvements applied
