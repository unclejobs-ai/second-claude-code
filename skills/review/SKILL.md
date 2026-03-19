---
name: review
description: "Multi-perspective quality gate — 3 parallel reviewers with consensus"
---

# Review

Dispatch 3+ parallel reviewers with different roles, then synthesize through a consensus gate.

## When to Use

- Quality check before publishing any content
- Auto-called by `/scc:write` after drafting
- Code review, strategy validation, or fact-checking
- User asks "is this good?" or "review this"

## Default Reviewers (3 parallel subagents)

| Reviewer | Model | Focus |
|----------|-------|-------|
| **deep-reviewer** | opus | Logic, structure, completeness, argument flow |
| **devil-advocate** | sonnet | Attack weakest 3 points, find blind spots |
| **fact-checker** | haiku | Verify numbers, sources, claims, URLs |

All reviewers run in parallel with independent context. No reviewer sees another's output until synthesis.

## Presets

| Preset | Reviewers | Use Case |
|--------|-----------|----------|
| `content` | deep-reviewer + devil-advocate + tone-guardian | Newsletter, article, shorts |
| `strategy` | deep-reviewer + devil-advocate + fact-checker | Analysis, reports, plans |
| `code` | deep-reviewer + fact-checker + structure-analyst | Code review, PRs |
| `quick` | devil-advocate + fact-checker | Fast check, 2 reviewers only |
| `full` | all 5 reviewers | High-stakes content |

### Additional Reviewers (used in `full` preset)

| Reviewer | Model | Focus |
|----------|-------|-------|
| **tone-guardian** | haiku | Voice consistency, audience fit, readability |
| **structure-analyst** | haiku | Organization, flow, redundancy, formatting |

## Consensus Gate

```
Pass condition:  2/3 reviewers mark APPROVED (or 3/5 for full)
Block condition: ANY reviewer flags a Critical severity item

Result:
  APPROVED     — all pass, no Critical items
  MINOR FIXES  — passes consensus but has Major/Minor items
  MUST FIX     — fails consensus OR has any Critical item
```

Severity levels:
- **Critical**: Factual error, logical contradiction, missing mandatory section, broken claim
- **Major**: Weak argument, tone mismatch, structural issue, unsupported claim
- **Minor**: Style suggestion, wording improvement, optional enhancement

## Internal Flow

```
input (content to review)
        │
        ├──► deep-reviewer(opus)     ──► findings
        ├──► devil-advocate(sonnet)  ──► findings
        └──► fact-checker(haiku)     ──► findings
                    │
                    ▼
            synthesizer ──[merge + consensus gate]──► Review Report
```

### Step-by-Step

1. **Dispatch reviewers**: Send content to all preset reviewers in parallel. Each reviewer gets independent context -- no shared state.
2. **Collect findings**: Each reviewer returns a structured finding list with severity tags.
3. **Synthesize**: Merge all findings. Deduplicate overlapping issues. Apply consensus gate logic.
4. **Produce report**: Output unified review report with verdict.

## Output Format

```markdown
# Review Report
## Verdict: {APPROVED | MINOR FIXES | MUST FIX}
Consensus: {X}/{Y} reviewers passed

## Findings by Severity
### Critical
- [{reviewer}] {finding} — {evidence/citation}
### Major
- [{reviewer}] {finding} — {evidence/citation}
### Minor
- [{reviewer}] {finding} — {evidence/citation}

## Per-Reviewer Summary
(verdict + key finding per reviewer, claims verified X/Y for fact-checker)
```

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--preset` | `content\|strategy\|code\|quick\|full` | `content` | Reviewer set |
| `--threshold` | number | `0.67` | Consensus ratio to pass |
| `--strict` | flag | off | Any Major also blocks (not just Critical) |

## Cost Estimates

| Preset | Approximate Cost | Reviewers |
|--------|-----------------|-----------|
| `quick` | ~$0.05 | 2 (haiku + sonnet) |
| `content` | ~$0.30 | 3 (opus + sonnet + haiku) |
| `strategy` | ~$0.30 | 3 (opus + sonnet + haiku) |
| `code` | ~$0.30 | 3 (opus + haiku + haiku) |
| `full` | ~$0.40 | 5 (opus + sonnet + 3x haiku) |

## Gotchas

| Failure Mode | Mitigation |
|-------------|------------|
| Reviewers agree too easily | Independent context enforced. No reviewer sees another's output. Prompts explicitly say "find problems, not confirmations." |
| Fact-checker hallucinates verification | fact-checker must provide actual source URLs for verified claims. "Verified" without a URL is rejected. |
| Reviews too generic | Code reviews require `file:line` citations. Content reviews require paragraph/section references. Generic "could be improved" is flagged. |
| Devil-advocate is performative | Must produce exactly 3 specific counter-arguments with reasoning. Vague objections are rejected. |
| All items marked Minor | If all items are Minor, deep-reviewer re-evaluates whether any should be Major. Calibration step. |

## Patterns Absorbed

- **Octopus 75% consensus gate**: Supermajority required, any Critical blocks
- **Superpowers 4-reviewer pattern**: Role-specialized parallel review with synthesis
- **Tw93 verification loop**: Iterative check until quality threshold met

## Subagent Dispatch

```yaml
deep-reviewer:    { model: opus,   tools: [],          constraint: "cite specific sections" }
devil-advocate:   { model: sonnet, tools: [],          constraint: "attack exactly 3 weakest points" }
fact-checker:     { model: haiku,  tools: [WebSearch], constraint: "provide source URLs for every claim" }
tone-guardian:    { model: haiku,  tools: [],          constraint: "check voice against guide" }
structure-analyst: { model: haiku, tools: [],          constraint: "check flow and redundancy" }
```

## Integration

- Auto-called by `/scc:write` after drafting (content preset)
- Can be called standalone on any content or code
- Verdict feeds back to the calling skill for revision decisions
