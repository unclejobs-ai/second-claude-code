# Question Protocol — Plan Phase

The Question Protocol limits interactive dialogue to the Plan phase.
Maximum 3 questions before proceeding. Designed to clarify scope without blocking execution.

## When to Ask

| Trigger | Question | Options |
|---------|----------|---------|
| Single-word topic | "Which angle?" | (a) Technical (b) Business (c) Market |
| Format not specified | "What format?" | (a) Report (b) Article (c) Newsletter |
| Scope ambiguous | "Broad or deep?" | (a) Full overview (b) Focused deep-dive |

## When to Skip (Zero Questions)

- User provides 2+ sentences of context
- Format is explicit in the prompt (e.g., "write a newsletter about...")
- `--no-questions` flag is set
- Pipeline or automation mode (non-interactive)
- Act→Plan cycle return (research gap already identified)

## Non-Response Behavior

If the user does not address the questions (e.g., changes topic, says "just proceed", or ignores them):

1. Save assumptions to PDCA state:
   ```json
   {
     "assumptions": [
       "Assumed business angle (default for ambiguous topics)",
       "Assumed report format (most common output)"
     ]
   }
   ```
2. State assumptions explicitly: "Proceeding with these assumptions: ..."
3. Continue to research dispatch

## Question Budget by Phase

| Phase | Max Questions | Purpose |
|-------|--------------|---------|
| Plan | 3 | Scope clarification |
| Do | 0 | Pure execution — inputs come from Plan |
| Check | 0 | Automated review — no interaction |
| Act (Router) | 2 | Ambiguous routing classification only |

## Anti-Patterns

- Asking more than 3 questions in Plan (analysis paralysis)
- Asking questions in Do phase (should be resolved in Plan)
- Asking obvious questions when context is clear
- Re-asking questions answered in a previous PDCA cycle
