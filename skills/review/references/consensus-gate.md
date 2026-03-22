# Review: Detailed Protocols

## Verdict Definitions

The consensus gate applies two conditions in order: score-based gate first, vote-count gate second.

**Score-based gate (primary)**:

| Verdict | Score Condition | Finding Condition |
|---------|----------------|-------------------|
| `APPROVED` | average score `>= 0.7` | No Critical findings, no Major findings, vote threshold met |
| `MINOR FIXES` | average score `>= 0.7` | No Critical findings, Minor findings only, vote threshold met |
| `NEEDS IMPROVEMENT` | average score `< 0.7` OR vote threshold not met | No Critical findings |
| `MUST FIX` | any value | Any Critical finding from any reviewer |

Any single Critical finding forces `MUST FIX` regardless of average score or vote threshold.

**Vote-count gate (secondary)**:

Applied only when score-based condition is met (no Critical findings, score `>= 0.7`):

| Preset | Reviewers (N) | Required Approvals | Formula |
|--------|---------------|-------------------|---------|
| `content` | 3 | 2 | `ceil(0.67 * 3) = 2` |
| `strategy` | 3 | 2 | `ceil(0.67 * 3) = 2` |
| `code` | 3 | 2 | `ceil(0.67 * 3) = 2` |
| `quick` | 2 | 2 | `ceil(0.67 * 2) = 2` (both must approve) |
| `full` | 5 | 4 | `ceil(0.67 * 5) = 4` |

Override with `--threshold`: e.g., `--threshold 0.5` with 3 reviewers requires `ceil(0.5 * 3) = 2`.

## Score Aggregation

Each reviewer emits a numeric score `0.0–1.0` per `references/critic-schema.md`. After all reviewers complete, compute:

```
average_score = sum(scores) / count(reviewers)
```

Store per-reviewer scores in the review aggregation block for cross-cycle comparison:

```markdown
## Score Aggregation

| Reviewer | Score | Verdict |
|----------|-------|---------|
| deep-reviewer | 0.00 | APPROVED |
| devil-advocate | 0.00 | MINOR FIXES |
| fact-checker | 0.00 | NEEDS IMPROVEMENT |
| **Average** | **0.00** | — |
```

This block is appended to the final Review Report before the overall Verdict is declared. Tracking scores across review cycles enables measurement of quality improvement over iterations.

## Severity Calibration

| Severity | Criteria | Concrete Examples |
|----------|----------|-------------------|
| **Critical** | Ship-blocking. Factual falsehood, security hole, legal risk, data loss, or broken core functionality. | Wrong number/statistic cited as fact; SQL injection vector; missing license attribution; API returns 500 on happy path |
| **Major** | Significant gap or flaw that undermines the goal but does not break correctness outright. | Missing required section in a deliverable; logic branch with no error handling; misleading diagram; accessibility violation (WCAG A) |
| **Minor** | Polish issue. Does not affect correctness or completeness, but degrades quality. | Tone inconsistency in one paragraph; typo in non-critical text; inconsistent naming convention; suboptimal but functional code pattern |

Rule of thumb: if the finding would cause a reader/user to reach a **wrong conclusion**, it is Critical. If it would cause **incomplete understanding**, it is Major. If it would cause **mild friction**, it is Minor.

## Deduplication Rules

When multiple reviewers flag the same or overlapping issue:

1. **Same location, same issue**: Keep the finding with the most specific evidence (exact quote, line number, or data). Credit all agreeing reviewers in the `[reviewers]` tag. Agreeing reviewers still count as individual approvals for the consensus gate.
2. **Same issue, different locations**: Keep each as a separate finding — they are distinct occurrences.
3. **Overlapping but different angles**: Keep both if they suggest different fixes. Merge only if one strictly subsumes the other.
4. **Severity conflict on the same finding**: Use the higher severity and note the disagreement (e.g., `[deep-reviewer: Critical, tone-guardian: Major]`).

## External Reviewers

When `--external` is set, the review skill detects installed external CLIs and dispatches a review to the first available one. This provides a cross-model perspective.

Detection order:
1. `mmbridge` — multi-model bridge (preferred)
2. `kimi` — Kimi reviewer
3. `codex` — OpenAI Codex CLI
4. `gemini` — Google Gemini CLI

The external review runs in parallel with internal reviewers. Its findings are merged into the consensus gate as an additional voter. Configure available reviewers in `config.example.json` under `quality_gate.external_reviewers`.

If no external CLI is detected, `--external` is silently ignored.
