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
| `code` | deep-reviewer + fact-checker + structure-analyst |
| `quick` | devil-advocate + fact-checker |
| `full` | all 5 reviewers |

## Critic Output Format

Every reviewer MUST structure their output according to `references/critic-schema.md`. Each review must include:

1. **Verdict** — `APPROVED | MINOR FIXES | NEEDS IMPROVEMENT | MUST FIX`
2. **Score** — float `0.0` to `1.0` per the scale in `references/critic-schema.md`
3. **Findings** — structured table with severity, category, location, description, and suggestion for each issue
4. **Summary** — one sentence overall assessment

Unstructured prose output is not accepted. Each reviewer emits the `## Critic Output` block defined in `references/critic-schema.md`.

## Consensus Gate

**Score-based consensus** (primary gate):
- Pass condition: average score across reviewers `>= 0.7` AND no Critical findings from any reviewer
- Any Critical finding forces `MUST FIX` regardless of average score or threshold count

**Vote-count gate** (secondary gate, used when score-based gate passes):
- 3-reviewer presets (`content`, `strategy`, `code`): pass with 2/3 approvals
- 2-reviewer preset (`quick`): pass only with 2/2 unanimous approval
- 5-reviewer preset (`full`): pass with 3/5 approvals

**Final verdicts**: `APPROVED`, `MINOR FIXES`, `NEEDS IMPROVEMENT`, `MUST FIX`
- `NEEDS IMPROVEMENT` = threshold not met but no Critical findings (substantive rework needed)

**Score tracking**: store per-reviewer scores in the review aggregation block for cycle comparison. See `references/consensus-gate.md` for the aggregation format.

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

## Score Aggregation

| Reviewer | Score | Verdict |
|----------|-------|---------|
| {reviewer-name} | {0.00} | {APPROVED \| MINOR FIXES \| NEEDS IMPROVEMENT \| MUST FIX} |
| **Average** | **{0.00}** | — |

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
| `--team-review` | flag | off |

## Team Review Workflow

When `--team-review` is set, the standard parallel dispatch is replaced by an Agent Team with deliberation:

1. Team lead creates a team with the 5 reviewer teammates (Xatu, Absol, Porygon, Jigglypuff, Unown).
2. Each reviewer independently reviews the artifact — no shared context at this stage (same isolation guarantee as standard mode).
3. All findings are shared across the team.
4. **Challenge round** (2 minutes max): each reviewer may dispute or reinforce other reviewers' findings. A dispute requires citing a specific counter-finding with evidence. A reinforcement counts as corroboration and raises that finding's weight.
5. Team lead aggregates the challenged findings: disputed findings are downgraded one severity level unless a third reviewer sides with the original; reinforced findings are locked at their current severity.
6. Consensus is computed from challenge-adjusted findings using the standard gate (`average score >= 0.7`, no Critical findings).
7. Team is shut down. Output conforms to the standard Review Report format.

## External Reviewers

When `--external` is set, detects installed external CLIs and dispatches a cross-model review in parallel. See `references/consensus-gate.md` for detection order and configuration. Silently ignored if no CLI is found.

## Gotchas

- Keep reviewers independent so they do not converge too easily.
- Require exact locations for findings.
- `fact-checker` cannot claim verification without source URLs.
- **Team review costs ~2–3x more than standard review** due to the challenge round. Use only for high-stakes content: `--depth deep` PDCA cycles or final-pass `full` preset reviews. Standard review is the default for all other cases.

## Subagents

```yaml
deep-reviewer: { model: opus, constraint: "cite exact sections or lines" }
devil-advocate: { model: sonnet, constraint: "attack exactly 3 weak points when applicable" }
fact-checker: { model: haiku, tools: [WebSearch], constraint: "include URLs for verified claims" }
tone-guardian: { model: haiku, constraint: "check voice against guide and audience" }
structure-analyst: { model: haiku, constraint: "check flow, hierarchy, and redundancy" }
```
