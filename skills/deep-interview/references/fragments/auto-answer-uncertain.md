---
kind: skill-fragment
parent: deep-interview
name: auto-answer-uncertain
---

# Auto Answer Uncertain Fragment

Internal-only prompt fragment for Deep Interview. This file is not a public skill, command, or `skill://` route.

## Purpose

When the user explicitly asks the agent to decide or opts out of an interview question, return one tentative answer that can be scored with a clarity cap and surfaced as an assumption when it would cross the threshold.

## Input Contract

The caller supplies:
- the opted-out question;
- prompt-safe transcript summary;
- locked topology;
- current scores and gaps;
- any auto-research candidates used for the round.

## Output Contract

Return exactly this shape:

```json
{
  "answer": "one decisive tentative answer",
  "rationale": "why this answer follows from the available context",
  "confidence": "low|medium|high",
  "uncertainty": "explicit uncertainty and what could change the answer"
}
```

Rules:
- Return one answer only.
- Never claim user confirmation.
- Low or medium confidence must remain an unresolved gap for scoring.
- High confidence still remains tentative until the user confirms threshold-crossing assumptions.
- Do not edit files, mutate state, call workflow skills, or delegate execution.
