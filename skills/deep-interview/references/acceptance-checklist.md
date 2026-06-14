# Deep Interview Acceptance Checklist

Use this before declaring a Deep Interview change complete.

## Runtime

- [ ] Threshold resolution records both value and source before interview state initialization.
- [ ] Round 0 topology confirmation happens before ambiguity scoring.
- [ ] Multi-component interviews preserve every active component in state and final spec output.
- [ ] Weakest-target selection rotates tied weak components away from the last targeted component.
- [ ] Korean or other session-language state is passed through questions, reports, options, and specs.
- [ ] Finalization writes a spec path and returns pending approval options only.

## Auto-mode

- [ ] Auto-research fragment is `kind: skill-fragment` and internal-only.
- [ ] Auto-answer fragment is `kind: skill-fragment` and internal-only.
- [ ] Validators reject malformed containers, invalid confidence, blank required fields, and extra keys without throwing.
- [ ] Valid research and answer responses pass.
- [ ] Invalid fragment output increments diagnostics and returns to manual interview flow.

## Docs and public surface

- [ ] Command and skill point to `docs/skills/deep-interview.md`.
- [ ] English and Korean docs explain purpose, flow, scoring, state, artifacts, safety gates, and troubleshooting.
- [ ] Reference docs cover protocol, scoring, fixtures, troubleshooting, example transcript, and this checklist.
- [ ] Public command and skill counts stay at 18, while the agent roster stays 17.
- [ ] Internal fragments are not public commands, skills, or routes.

## Verification

- [ ] `node --check scripts/deep-interview-runner.mjs` passes.
- [ ] Deep Interview runtime and contract tests pass.
- [ ] Existing skill contracts and session-start tests pass.
- [ ] Full project test suite passes before final aggregate completion.
