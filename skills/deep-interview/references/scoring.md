# Deep Interview Scoring

## Dimensions

| Dimension | Meaning |
|---|---|
| Goal | The primary objective, core entities, and intended outcome are unambiguous. |
| Constraints | Boundaries, non-goals, limitations, and required integrations are clear. |
| Success criteria | A tester could verify success with observable checks. |
| Context | Brownfield-only: the existing system is understood enough to modify safely. |

## Weights

| Type | Formula |
|---|---|
| Greenfield | `ambiguity = 1 - (goal * 0.40 + constraints * 0.30 + criteria * 0.30)` |
| Brownfield | `ambiguity = 1 - (goal * 0.35 + constraints * 0.25 + criteria * 0.25 + context * 0.15)` |

Scores are floats from `0.0` to `1.0`. The default threshold is `0.05` ambiguity unless settings resolve a different value.

## Component coverage

For multi-component topology, score every active component. The overall weakest target is the lowest component/dimension pair after rotation. Deferred components are excluded from ambiguity math but remain visible in the spec.

## Ontology stability

Track key entities each round. Round 1 has no stability ratio. For later rounds, count stable entities by name and changed entities by concept continuity. New and removed entities expose scope drift. If the ontology keeps changing, ask an ontology question before feature questions.

## Auto-answer cap

Architect-assisted answers are tentative. Unless confidence is high and uncertainty is negligible, a dimension improved solely by auto-answer should not exceed `0.85`. If auto-answer would cross the threshold, require explicit user confirmation before spec crystallization.
