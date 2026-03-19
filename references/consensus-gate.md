# Consensus Gate

The multi-perspective review mechanism used by `/second-claude-code:review` to ensure quality through independent evaluation.

---

## How It Works

Three reviewer subagents are dispatched in parallel. Each receives the content to review but no access to other reviewers' output. This independence prevents groupthink and ensures diverse perspectives.

## Reviewers by Preset

| Preset | Reviewers | Threshold |
|--------|-----------|-----------|
| content | deep-reviewer + devil-advocate + tone-guardian | 2/3 |
| strategy | deep-reviewer + devil-advocate + fact-checker | 2/3 |
| code | deep-reviewer + fact-checker + structure-analyst | 2/3 |
| quick | devil-advocate + fact-checker | 2/2 |
| full | all 5 reviewers | 3/5 |

## Consensus Threshold

- **APPROVED**: threshold met, no Critical or Major findings
- **MINOR FIXES**: threshold met, no Critical findings, but Major or Minor issues remain
- **NEEDS IMPROVEMENT**: threshold NOT met, but no Critical findings — substantive rework needed
- **MUST FIX**: any Critical finding from any reviewer (regardless of threshold)

## Severity Calibration

| Severity | Criteria | Concrete Examples |
|----------|----------|-------------------|
| **Critical** | Ship-blocking. Factual falsehood, security hole, legal risk, data loss, or broken core functionality. | Wrong number/statistic cited as fact; SQL injection vector; missing license attribution; API returns 500 on happy path |
| **Major** | Significant gap or flaw that undermines the goal but does not break correctness outright. | Missing required section in a deliverable; logic branch with no error handling; misleading diagram; accessibility violation (WCAG A) |
| **Minor** | Polish issue. Does not affect correctness or completeness, but degrades quality. | Tone inconsistency in one paragraph; typo in non-critical text; inconsistent naming convention; suboptimal but functional code pattern |

Rule of thumb: if the finding would cause a reader/user to reach a **wrong conclusion**, it is Critical. If it would cause **incomplete understanding**, it is Major. If it would cause **mild friction**, it is Minor.

## Critical Finding Override

Any single reviewer can flag a finding as **Critical**. A Critical finding forces `MUST FIX` regardless of overall consensus. Examples: factual errors, security vulnerabilities, legal risks, missing attribution.

## External Voter

When `--external` is set, the review skill detects an installed external CLI (mmbridge, kimi, codex, or gemini) and dispatches a parallel review. The external review counts as one additional voter, increasing the denominator by 1. For example, a `content` preset with an external voter uses a `2/4` threshold instead of `2/3`. If no external CLI is detected, the flag is silently ignored and the gate operates at its default threshold.

## Conflict Resolution

When reviewers directly contradict each other (one says "add more detail" while another says "too verbose"), the main session mediates. The mediator sees all three reviews, identifies the conflict, and makes a judgment call based on the original brief's goals.

## Cost Optimization

Model tier matches reviewer role to keep review cost proportional:

| Reviewer | Model | Use case |
|----------|-------|----------|
| deep-reviewer | opus | Logic, structure, completeness |
| devil-advocate | sonnet | Adversarial stress test |
| fact-checker | haiku | Claim verification |
| tone-guardian | haiku | Tone and audience fit |
| structure-analyst | haiku | Flow and formatting |

The `quick` preset keeps cost low by using only `devil-advocate` + `fact-checker`.

## Deduplication Rules

When multiple reviewers flag the same or overlapping issue:

1. **Same location, same issue**: Keep the finding with the most specific evidence (exact quote, line number, or data). Credit all agreeing reviewers in the `[reviewers]` tag. Agreeing reviewers still count as individual approvals for the consensus gate.
2. **Same issue, different locations**: Keep each as a separate finding -- they are distinct occurrences.
3. **Overlapping but different angles**: Keep both if they suggest different fixes. Merge only if one strictly subsumes the other.
4. **Severity conflict on the same finding**: Use the higher severity and note the disagreement (e.g., `[deep-reviewer: Critical, tone-guardian: Major]`).

## External Reviewer Detection

Detection order:
1. `mmbridge` -- multi-model bridge (preferred)
2. `kimi` -- Kimi reviewer
3. `codex` -- OpenAI Codex CLI
4. `gemini` -- Google Gemini CLI

The external review runs in parallel with internal reviewers. Its findings are merged into the consensus gate as an additional voter. Configure available reviewers in `config.example.json` under `quality_gate.external_reviewers`.
