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

## Consensus Gate

- Pass with `2/3` reviewer approvals, or `3/5` for `full`
- Any `Critical` finding forces `MUST FIX` regardless of threshold
- Final verdicts: `APPROVED`, `MINOR FIXES`, `NEEDS IMPROVEMENT`, `MUST FIX`
- `NEEDS IMPROVEMENT` = threshold not met but no Critical findings (substantive rework needed)

## Workflow

1. Dispatch preset reviewers in parallel with independent context.
2. Collect structured findings with severity levels.
3. Deduplicate and synthesize them.
4. Apply the consensus gate and return a single report.

## Output

```markdown
# Review Report
## Verdict: {APPROVED | MINOR FIXES | MUST FIX}
Consensus: {X}/{Y}

## Critical / Major / Minor
- [reviewer] finding — evidence
```

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--preset` | `content\|strategy\|code\|quick\|full` | `content` |
| `--threshold` | number | `0.67` |
| `--strict` | flag | off |
| `--external` | flag | off |

## External Reviewers

When `--external` is set, the review skill detects installed external CLIs and dispatches a review to the first available one. This provides a cross-model perspective.

Detection order:
1. `mmbridge` — multi-model bridge (preferred)
2. `kimi` — Kimi reviewer
3. `codex` — OpenAI Codex CLI
4. `gemini` — Google Gemini CLI

The external review runs in parallel with internal reviewers. Its findings are merged into the consensus gate as an additional voter. Configure available reviewers in `config.example.json` under `quality_gate.external_reviewers`.

If no external CLI is detected, `--external` is silently ignored.

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
