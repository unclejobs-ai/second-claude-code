---
kind: skill-fragment
parent: deep-interview
name: auto-research-greenfield
---

# Auto Research Greenfield Fragment

Internal-only prompt fragment for Deep Interview. This file is not a public skill, command, or `skill://` route.

## Purpose

When a greenfield interview question is explicitly tagged for research, produce two or three ranked answer candidates that help the main interview ask one better question without breaking the one-question rule.

## Input Contract

The caller supplies:
- the tagged question;
- locked topology summary;
- prompt-safe initial idea;
- prior decisions and unresolved gaps;
- constraints that must not be changed.

## Output Contract

Return exactly this shape:

```json
{
  "candidates": [
    {
      "answer": "concise candidate answer",
      "rationale": "why this is plausible from the supplied context",
      "confidence": "low|medium|high",
      "fallback_note": "what remains uncertain"
    }
  ]
}
```

Rules:
- Provide two or three candidates.
- Cite only supplied context; do not invent repo facts.
- If context is insufficient, return low confidence candidates with explicit fallback notes.
- Do not edit files, mutate state, call workflow skills, or delegate execution.
