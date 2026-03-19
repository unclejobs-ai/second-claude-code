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

- **APPROVED**: threshold met and no Critical findings from any reviewer
- **MINOR FIXES**: threshold met but non-critical issues remain
- **MUST FIX**: threshold not met, or any Critical finding from any reviewer

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
