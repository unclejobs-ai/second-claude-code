# Hermes Operator Prompts

These are ready-to-use operator prompts for Hermes after the bundled skillpack
has been installed.

Default skill: `external-coding-supervisor`

## 1. Bug Fix

Use when the task is a concrete defect with an expected fix and regression test.

### Operator Prompt

```text
Use the `external-coding-supervisor` skill against this repository.

Objective:
- Fix the reported bug on the current branch
- Add or update a regression test
- Run the relevant verification
- Gate the result with mmbridge

Execution rules:
- Use a single write-capable implementation role only
- Keep review and docs roles read-only
- Read `summary.md` first after the run
- If the mmbridge gate warns or fails, do not accept the result silently; explain the concrete issue and propose the next corrective pass

Run the bugfix payload from:
`references/hermes/examples/bugfix-critical-path.json`

Before execution, replace the generic `task` field with the actual bug description in plain language.
After execution, summarize:
1. what changed
2. what was verified
3. what risks remain
```

### Execution Pattern

```bash
node scripts/hermes-external-run.mjs run "$(cat references/hermes/examples/bugfix-critical-path.json)"
```

## 2. Feature Delivery

Use when the task is a bounded feature slice that should land with review and release notes.

### Operator Prompt

```text
Use the `external-coding-supervisor` skill against this repository.

Objective:
- Implement the approved feature slice on the current branch
- Preserve existing behavior outside the requested scope
- Run relevant tests or checks
- Produce release-note quality output and gate the result with mmbridge

Execution rules:
- Keep exactly one implementation role with write access
- Keep review and docs roles read-only
- Prefer the smallest viable implementation that satisfies the requested feature
- Read `summary.md` before inspecting raw role artifacts
- If review or gate output identifies regressions, request a narrow follow-up instead of broad rework

Run the feature payload from:
`references/hermes/examples/feature-delivery.json`

Before execution, replace the generic `task` field with the exact feature request.
After execution, summarize:
1. implementation outcome
2. verification performed
3. user-visible notes
4. follow-up risks or open questions
```

### Execution Pattern

```bash
node scripts/hermes-external-run.mjs run "$(cat references/hermes/examples/feature-delivery.json)"
```

## 3. Security Hardening

Use when the task is defensive change, risk reduction, or hardening of an existing surface.

### Operator Prompt

```text
Use the `external-coding-supervisor` skill against this repository.

Objective:
- Apply the requested security hardening changes
- Preserve intended product behavior
- Run targeted verification
- Gate the result with mmbridge using security-oriented settings

Execution rules:
- Use one write-capable implementation role only
- Keep review and docs roles read-only
- Bias the reviewer toward bypasses, regressions, and missing edge cases
- Treat mmbridge security warnings as actionable until reviewed
- Do not accept the run unless the final summary explains residual risk clearly

Run the security payload from:
`references/hermes/examples/security-hardening.json`

Before execution, replace the generic `task` field with the exact hardening request.
After execution, summarize:
1. what was hardened
2. what remained unchanged intentionally
3. what verification ran
4. what residual risk remains
```

### Execution Pattern

```bash
node scripts/hermes-external-run.mjs run "$(cat references/hermes/examples/security-hardening.json)"
```

## Practical Note

The example JSON files are templates. In actual use, Hermes should either:

- rewrite the `task` value before launching, or
- inline the JSON payload directly in the shell command with the real task text

Do not run the examples unchanged unless the placeholder task text is sufficient
for the current job.
