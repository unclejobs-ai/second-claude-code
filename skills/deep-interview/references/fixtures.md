# Deep Interview Fixtures

## Four-component fixture

Input:

> Build an intake pipeline that ingests CSVs, normalizes records, provides a detailed reviewer UI with inline comments and approvals, and exports audit-ready reports.

Expected Round 0 topology:

1. Ingestion: bring CSV input into the workflow safely.
2. Normalization: transform raw records into the canonical shape.
3. Review UI: let reviewers inspect, comment, and approve work.
4. Export: produce audit-ready reports.

The detailed Review UI must not replace the less-detailed siblings. Later scoring must keep asking until every active component has enough goal, constraint, and success-criteria clarity.

## Korean language fixture

Use escaped Hangul strings in JavaScript tests so repository-wide Hangul policy remains intact while runtime output still proves Korean preservation. The runtime test should assert Korean headings and approval labels after finalization into a temp root.

## Auto-mode validator fixture

Valid research response:

```json
{
  "candidates": [
    {
      "answer": "Option A",
      "rationale": "Supported by supplied context",
      "confidence": "medium",
      "fallback_note": "Needs user confirmation"
    },
    {
      "answer": "Option B",
      "rationale": "Supported by supplied context",
      "confidence": "low",
      "fallback_note": "Insufficient context remains"
    }
  ]
}
```

Invalid cases must return `{ ok: false, errors }` without throwing: non-object response, `candidates` object instead of array, too few candidates, invalid confidence, blank fallback, and extra keys.

## Approval fixture

Finalization should produce a spec path, `pending_approval` state, and option ids `ralplan`, `ultragoal`, `team`, `continue`. It should not emit workflow execution commands.
