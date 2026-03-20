---
name: review
description: "Use when reviewing content, strategy, or code with parallel specialized reviewers"
---

# Review

Run parallel reviewers with distinct roles, then merge their findings through a consensus gate.

## When to Use

- Pre-publish content checks
- Strategy or plan validation
- Code review
- Any prompt like "review this" or "is this good?"

## Reviewers

| Reviewer | Model | Focus |
|----------|-------|-------|
| `deep-reviewer` | opus | logic, structure, completeness |
| `devil-advocate` | sonnet | weakest points and blind spots |
| `fact-checker` | haiku | claims, numbers, sources |
| `tone-guardian` | haiku | voice and audience fit |
| `structure-analyst` | haiku | organization and readability |

## Presets

| Preset | Reviewers |
|--------|-----------|
| `content` | deep-reviewer + devil-advocate + tone-guardian |
| `strategy` | deep-reviewer + devil-advocate + fact-checker |
| `code` | deep-reviewer + devil-advocate + structure-analyst |
| `quick` | devil-advocate + fact-checker |
| `full` | all 5 reviewers |

## Consensus Gate

- 3-reviewer presets (`content`, `strategy`, `code`): pass with 2/3 approvals
- 2-reviewer preset (`quick`): pass only with 2/2 unanimous approval
- 5-reviewer preset (`full`): pass with 3/5 approvals
- Any `Critical` finding forces `MUST FIX` regardless of threshold
- Final verdicts: `APPROVED`, `MINOR FIXES`, `NEEDS IMPROVEMENT`, `MUST FIX`
- `NEEDS IMPROVEMENT` = threshold not met but no Critical findings (substantive rework needed)

## Severity Calibration

Three levels: **Critical** (ship-blocking), **Major** (significant gap), **Minor** (polish). See `references/consensus-gate.md` for detailed criteria and examples.

## Workflow

1. Dispatch preset reviewers in parallel with independent context. Each reviewer receives ONLY the content to review and their role prompt — never another reviewer's findings.
2. Collect structured findings with severity levels.
3. Deduplicate overlapping findings (see Deduplication Rules below).
4. Apply the consensus gate and return a single report.

## Deduplication Rules

See `references/consensus-gate.md` for the full deduplication protocol. Key rule: severity conflicts use the higher severity with a noted disagreement.

## Output

Each finding MUST include all four fields: location, severity, description, and fix suggestion.

```markdown
# Review Report
## Verdict: {APPROVED | MINOR FIXES | NEEDS IMPROVEMENT | MUST FIX}
Consensus: {X}/{Y}

## Findings

### Critical
- **[reviewer(s)]** `{file:line | Section > Subsection | paragraph N}` — {description with evidence} → **Fix:** {specific actionable suggestion}

### Major
- **[reviewer(s)]** `{location}` — {description} → **Fix:** {specific suggestion}

### Minor
- **[reviewer(s)]** `{location}` — {description} → **Fix:** {specific suggestion}
```

**Format rules**:
- Location must be precise enough to find the issue without re-reading the whole document. Use `file:line` for code, `Section > Subsection` or `paragraph N` for prose.
- Fix suggestion must be a concrete action ("Change X to Y", "Add Z after line N"), never vague ("improve this", "consider revising").
- If multiple reviewers flagged the same finding, list all in the `[reviewer(s)]` tag.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--preset` | `content\|strategy\|code\|quick\|full` | `content` |
| `--threshold` | number | `0.67` |
| `--strict` | flag | off |
| `--external` | flag | off |

## External Reviewers

When `--external` is set, detects installed external CLIs and dispatches a cross-model review in parallel. See `references/consensus-gate.md` for detection order and configuration. Silently ignored if no CLI is found.

## Gotchas

- Keep reviewers independent so they do not converge too easily.
- Require exact locations for findings.
- `fact-checker` cannot claim verification without source URLs.

## Subagents

```yaml
deep-reviewer: { model: opus, constraint: "cite exact sections or lines" }
devil-advocate: { model: sonnet, constraint: "attack exactly 3 weak points when applicable" }
fact-checker: { model: haiku, tools: [WebSearch], constraint: "include URLs for verified claims" }
tone-guardian: { model: haiku, constraint: "check voice against guide and audience" }
structure-analyst: { model: haiku, constraint: "check flow, hierarchy, and redundancy" }
```
