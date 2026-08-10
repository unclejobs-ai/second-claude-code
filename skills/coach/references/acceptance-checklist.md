# Coach Acceptance Checklist

Use this before declaring a Coach change complete.

## Runtime

- [ ] Threshold resolution records both value and source before state initialization.
- [ ] Standards already on file are read before the first question.
- [ ] Round 0 topology confirmation happens before ambiguity scoring.
- [ ] Multi-component runs preserve every active component in state and rendered output.
- [ ] Weakest-target selection rotates tied weak components away from the last targeted component.
- [ ] Korean or other session-language state is passed through questions, reports, options, and standards.
- [ ] `record-fork` writes one `.scc/standards/<id>/STANDARD.md` and appends the id to state.
- [ ] Finalization returns recorded standard ids and pending approval options only.

## Auto-mode

- [ ] Auto-research fragment is `kind: skill-fragment` and internal-only.
- [ ] Auto-answer fragment is `kind: skill-fragment` and internal-only.
- [ ] Validators reject malformed containers, invalid confidence, blank required fields, and extra keys without throwing.
- [ ] Valid research and answer responses pass.
- [ ] Invalid fragment output increments diagnostics and returns to the manual flow.

## Docs and public surface

- [ ] Command and skill point to `docs/skills/coach.md`.
- [ ] English and Korean docs explain purpose, flow, scoring, state, artifacts, safety gates, and troubleshooting.
- [ ] Reference docs cover protocol, scoring, fixtures, troubleshooting, example transcript, and this checklist.
- [ ] `SKILL.md` states the recipe rather than a prohibition list, and stays under 500 words.
- [ ] The skill description states triggers only and does not summarize the workflow.
- [ ] Public command and skill counts stay at 18, while the agent roster stays 17.
- [ ] Internal fragments are not public commands, skills, or routes.

## Verification

- [ ] `node --check scripts/coach-runner.mjs` passes.
- [ ] Coach runtime and contract tests pass.
- [ ] Existing skill contracts and session-start tests pass.
- [ ] Full project test suite passes before final aggregate completion.
