# Hermes Operations

This document is the operator playbook for running Hermes against this repository
with the bundled skillpack.

## Recommended Default

Use `external-coding-supervisor` as the primary skill for coding work that needs:

- one write-capable implementation agent
- at least one read-only reviewer
- mmbridge quality checks after the implementation pass

Use `acpx-orchestrator` only when you explicitly want raw fan-out without a
quality gate in the same command.

Use `mmbridge-quality` for standalone review, security, gate, or handoff tasks.

## Execution Order

1. Hermes receives the user task.
2. Hermes selects `external-coding-supervisor`.
3. Hermes runs `node scripts/hermes-external-run.mjs run '<json>'`.
4. Hermes reads `.data/external-runs/acpx/<run_id>/summary.md`.
5. Hermes decides whether to:
   - accept the run
   - request a narrow corrective implementation pass
   - run an extra standalone `mmbridge-quality` step

## Standard Read Order

Always inspect artifacts in this order:

1. `summary.md`
2. `manifest.json`
3. `mmbridge-gate.json`
4. `mmbridge-review.json`
5. per-role `result.json`
6. raw stdout/stderr only if the structured files are insufficient

## Decision Rules

### Accept

Accept when:

- `impl` succeeded
- `mmbridge.gate.status` is `pass`
- no reviewer surfaced a concrete blocker

### Request corrective implementation

Request a new implementation pass when:

- `impl` failed
- `mmbridge.gate.status` is `fail`
- the review role reports a concrete regression

### Request narrow follow-up

Request a narrow follow-up instead of full rerun when:

- only docs output is weak
- gate status is `warn` and the warnings are local and concrete
- review and gate disagree but neither indicates a blocker

## Prompt Pattern

When Hermes invokes a run, keep the user-facing prompt short and move role
discipline into the role templates.

Good:

```text
Implement the requested pagination change, verify it, and produce operator notes.
```

Bad:

```text
Implement it but maybe also rewrite the docs and think hard about architecture and
also compare alternatives and maybe patch the tests if needed.
```

## Safety Rules

- Never give write access to more than one role in a single run.
- Never auto-merge reviewer ideas into the implementation result.
- Never accept a failed or skipped gate without explicit operator override.
- Never skip reading `summary.md`.
