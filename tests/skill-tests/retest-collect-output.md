# Collect Skill Retest

**Previous score**: 8/10
**Weakness addressed**: "subagent delegation not performed"
**Target score**: 9/10

## Changes Applied

### 1. Subagent dispatch requirement (SKILL.md workflow + subagents section)
- Workflow steps 2-4 rewritten: analyst and connector are now explicitly required to be dispatched as separate subagents
- Connector receives only raw source + knowledge base path, never analyst output
- Fallback documented: sequential execution with explicit context barriers if dispatch is unavailable
- Subagent YAML now includes `dispatch: required` field

### 2. Markdown output template (SKILL.md dual output section)
- Exact `.md` template added with YAML frontmatter (`title`, `source`, `source_type`, `category`, `tags`, `collected_at`)
- Body sections: Summary, Key Points (numbered 1-3), Connections (with target + specific concept)

### 3. Connection quality gate (SKILL.md new section)
- Table with 3 good examples and 3 bad examples
- Rule: must name a specific principle, pattern, or concept — not a topic or domain
- Empty array allowed when no specific connection exists

### 4. Search ranking weights (SKILL.md search section)
- Exact tag match: 10
- Title substring: 7
- Key point match: 4
- Summary match: 2
- Scores summed for multiple matches; ties broken by `collected_at` (newest first)

## Gotchas Added

- #6 Inline subagent execution: symptom + fix for bias from shared context
- #7 Missing markdown dual output: symptom + fix for template compliance
- #8 Unranked search results: symptom + fix with exact scoring weights

## Self-Assessment: 9/10

| Criterion | Before | After | Notes |
|-----------|--------|-------|-------|
| Subagent delegation | Missing | Explicit dispatch requirement with fallback | Primary weakness resolved |
| Output format | Described but no template | Exact markdown template provided | Eliminates ambiguity |
| Connection quality | "Do not create vague connections" | Quality gate table with good/bad examples + empty array escape | Actionable |
| Search behavior | "returns ranked matches" (no ranking defined) | Weighted scoring with 4 tiers | Deterministic |
| Workflow clarity | 5 generic steps | 5 steps with dispatch responsibilities named | Executable |

**Remaining gap for 10/10**: No integration test or executable validation script to verify subagent dispatch actually happens at runtime. This would require runtime instrumentation beyond skill definition scope.
