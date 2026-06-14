# Deep Interview Protocol

## Phase 0: threshold resolution

Resolve `gjc.deepInterview.ambiguityThreshold` before any user-facing interview text, state write, topology question, or score. Precedence is project settings, user settings, then default `0.05`. Persist both `threshold` and `threshold_source`.

## Phase 1: initialization

Create interview state with a prompt-safe initial idea, inferred language, project type, threshold metadata, empty rounds, and pending topology. Brownfield interviews must gather repository facts before asking the user about codebase choices.

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

## Phase 4: spec crystallization

When ambiguity is at or below threshold, or the user accepts early-exit risk, render the final spec. Include metadata, clarity breakdown, topology, goal, constraints, non-goals, acceptance criteria, resolved assumptions, technical context, ontology, convergence, and transcript.

## Phase 5: approval bridge

Return pending approval options. The recommended path is ralplan consensus refinement. Ultragoal or team execution requires explicit selection after the spec exists. Deep Interview itself does not implement.
