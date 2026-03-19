# Review Skill Retest v2

**Date**: 2026-03-20
**Previous score**: 8/10
**Target**: 9/10

## Changes Applied

### 1. Finding Deduplication Rules (SKILL.md, new section)
Added explicit four-rule dedup criteria:
- Same location/issue: keep most specific evidence, credit all reviewers
- Same issue/different locations: keep as separate findings
- Overlapping angles: keep both unless one subsumes the other
- Severity conflict: use higher severity, note disagreement

### 2. Severity Calibration Table (SKILL.md, new section)
Added concrete calibration table with:
- Critical/Major/Minor definitions with real examples (not abstract)
- Rule of thumb: wrong conclusion = Critical, incomplete understanding = Major, mild friction = Minor

### 3. Reviewer Independence Enforcement (SKILL.md workflow + gotchas.md #6)
- Workflow step 1 now explicitly states: "Each reviewer receives ONLY the content to review and their role prompt -- never another reviewer's findings"
- New gotcha #6 "Cross-contamination between reviewers" with symptom/fix pattern

### 4. Action Item Format (SKILL.md output section)
Standardized output template requiring four fields per finding:
- Location (file:line or Section > Subsection or paragraph N)
- Severity (via section grouping)
- Description with evidence
- Concrete fix suggestion (never vague)

Added format rules enforcing precise locations and actionable fixes.

### Bonus: New gotchas added
- #7: Vague fix suggestions (symptom + fix)
- #8: Duplicate findings inflate severity (symptom + fix, links to dedup rules)

## Self-Assessment

| Criterion | Before (v1) | After (v2) | Notes |
|-----------|-------------|------------|-------|
| Deduplication | Implicit ("deduplicate and synthesize") | Explicit 4-rule system | Prevents double-counting and severity inflation |
| Severity calibration | Named levels only | Concrete examples + rule of thumb | Reviewers can now self-calibrate consistently |
| Reviewer independence | Mentioned in consensus-gate ref | Enforced in workflow step + dedicated gotcha | Closes cross-contamination loophole |
| Output format | Loose (reviewer + finding + evidence) | Strict 4-field template with format rules | Eliminates vague "improve this" findings |
| Gotchas coverage | 5 patterns | 8 patterns | Three new failure modes documented |

**Estimated score: 9/10**

Remaining gap to 10/10: could add automated validation (e.g., a post-review linter that rejects findings missing location or fix fields), and concrete examples of a complete review report as a reference artifact.
