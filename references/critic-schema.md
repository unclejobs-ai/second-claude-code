# Critic Output Schema

Every reviewer agent MUST structure their output using this schema. Unstructured prose feedback is not accepted — it cannot be aggregated, scored, or compared across review cycles.

---

## Verdict

One of four values:

| Verdict | Meaning |
|---------|---------|
| `APPROVED` | Publication-ready. All findings are Nitpick-level or none at all. |
| `MINOR FIXES` | One pass of targeted edits needed. No Critical findings; only Warnings or Nitpicks. |
| `NEEDS IMPROVEMENT` | Substantive rework required. Multiple Warnings or gaps in coverage. |
| `MUST FIX` | One or more Critical findings. Cannot advance until resolved. |

---

## Score

A float `0.0` to `1.0` representing overall quality at the time of review.

| Range | Interpretation |
|-------|---------------|
| `0.9 – 1.0` | Publication-ready |
| `0.7 – 0.89` | Minor improvements needed |
| `0.5 – 0.69` | Significant rework needed |
| `0.0 – 0.49` | Fundamental issues |

Score and Verdict must be consistent: a score below `0.7` cannot produce `APPROVED` or `MINOR FIXES`.

---

## Findings

Each finding MUST include all five fields:

| Field | Type | Description |
|-------|------|-------------|
| `severity` | `Critical \| Warning \| Nitpick` | Impact level |
| `category` | one of `[accuracy, completeness, structure, tone, evidence, logic]` | Root cause domain |
| `location` | string | Specific section, paragraph number, or `file:line` reference |
| `description` | string | What is wrong and why it matters |
| `suggestion` | string | Concrete, actionable fix — never vague ("improve this" is rejected) |

### Severity Definitions

| Severity | Criteria |
|----------|----------|
| **Critical** | Ship-blocking. Factual falsehood, security issue, legal risk, broken logic, or missing core content. Forces `MUST FIX`. |
| **Warning** | Significant gap that undermines quality but does not break correctness outright. Maps to `NEEDS IMPROVEMENT`. |
| **Nitpick** | Polish issue. Does not affect correctness or completeness. Maps to `MINOR FIXES` or `APPROVED`. |

### Category Definitions

| Category | Covers |
|----------|--------|
| `accuracy` | Factual correctness of claims, numbers, dates, attribution |
| `completeness` | Missing sections, unexplained gaps, absent required content |
| `structure` | Organization, flow, hierarchy, redundancy |
| `tone` | Voice consistency, audience fit, register |
| `evidence` | Source quality, claim support, citation gaps |
| `logic` | Argument coherence, internal contradictions, unsupported leaps |

---

## Summary

One sentence. States the overall assessment and primary blocker (if any). Must be non-empty.

---

## Required Output Block

Every reviewer MUST emit this exact markdown block at the end of their response:

```markdown
## Critic Output

**Verdict**: APPROVED | MINOR FIXES | NEEDS IMPROVEMENT | MUST FIX
**Score**: 0.00

### Findings

| # | Severity | Category | Location | Description | Suggestion |
|---|----------|----------|----------|-------------|------------|
| 1 | Critical \| Warning \| Nitpick | category | location | description | suggestion |

### Summary
One sentence overall assessment.
```

If there are no findings, write an empty table row: `| — | — | — | — | — | — |`

---

## Aggregation Rules (for consensus gate)

- **Average score**: computed across all reviewer scores for the cycle.
- **Consensus pass condition**: average score `>= 0.7` AND no Critical findings from any reviewer.
- **Critical override**: any single Critical finding forces `MUST FIX` regardless of average score.
- **Score storage**: each reviewer's score is stored in the review aggregation block under `scores.<reviewer-name>` for cross-cycle comparison.
