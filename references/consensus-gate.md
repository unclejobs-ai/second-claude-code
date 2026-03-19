# Consensus Gate

The multi-perspective review mechanism used by `/scc:review` to ensure quality through independent evaluation.

---

## How It Works

Three reviewer subagents are dispatched in parallel. Each receives the content to review but no access to other reviewers' output. This independence prevents groupthink and ensures diverse perspectives.

## Reviewers by Preset

| Preset | Reviewer 1 | Reviewer 2 | Reviewer 3 |
|--------|-----------|-----------|-----------|
| content | deep-reviewer | devil-advocate | tone-guardian |
| strategy | framework-checker | risk-analyst | feasibility-reviewer |
| code | logic-reviewer | security-reviewer | style-reviewer |

## Consensus Threshold

- **APPROVED**: 2 of 3 reviewers approve (no critical findings from any reviewer)
- **REVISE**: 1 or more reviewers reject, or consensus met but non-critical issues remain
- **REJECT**: 2 of 3 reviewers reject

## Critical Finding Override

Any single reviewer can flag a finding as **Critical**. A critical finding triggers mandatory revision regardless of overall consensus. Examples: factual errors, security vulnerabilities, legal risks, missing attribution.

## Conflict Resolution

When reviewers directly contradict each other (one says "add more detail" while another says "too verbose"), the main session mediates. The mediator sees all three reviews, identifies the conflict, and makes a judgment call based on the original brief's goals.

## Cost Optimization

Model tier matches review depth to control costs:

| Review depth | Model | Use case |
|-------------|-------|----------|
| quick | haiku | Typo and format checks |
| content/strategy | sonnet | Standard review |
| full | opus | Publication-grade review |

The `--preset quick` option uses haiku for all three reviewers, keeping costs low for drafts and internal documents.
