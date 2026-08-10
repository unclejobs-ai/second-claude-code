# Coach Protocol

## Phase 0: threshold resolution

Resolve `scc.coach.ambiguityThreshold` before any user-facing text, state write, topology question, or score. Precedence is project settings, user settings, then default `0.05`. Persist both `threshold` and `threshold_source`.

## Phase 1: initialization

Read `.scc/standards/*/STANDARD.md` first; a fork already settled there is cited rather than reopened. Then create state with a prompt-safe initial idea, inferred language, project type, threshold metadata, empty rounds, and pending topology. Brownfield runs must gather repository facts before asking the user about codebase choices.

## Round 0: topology gate

Enumerate one to six top-level components. Confirm whether to add, remove, merge, split, or defer components. Store normalized components with ids, names, descriptions, status, evidence, clarity scores, and deferrals. Do not score ambiguity before this gate is complete.

## Phase 2: scored interview loop

For each round:

1. Select the active component and dimension with the lowest clarity.
2. Rotate tied weak components away from the most recently targeted component.
3. Ask one question that improves that component/dimension pair.
4. Score all active components across goal, constraints, success criteria, and brownfield context when applicable.
5. Update ambiguity, ontology snapshots, component scores, and `last_targeted_component_id`.
6. Report the score table, topology target, ontology stability, and next target.

## Challenge modes

Use each mode at most once:

- Round 4+: contrarian, to challenge the framing.
- Round 6+: simplifier, to remove accidental complexity.
- Round 8+ with high ambiguity: ontologist, to stabilize the core entity.

## Phase 4: fork recording

Each settled fork becomes one standard. Call `record-fork --file <path>` with the fork id, title, chosen direction, rejected directions and why each lost, payload, `review_when`, and triggers. The runner writes `.scc/standards/<id>/STANDARD.md` and appends the id to state. Record before drafting the artifact, not after.

## Phase 5: approval bridge

`finalize` returns the recorded standard ids and three approval options: `confirm`, `continue`, `plan-mode`. The recommended path is `confirm`. Coach itself does not implement.
