---
description: "Run a Socratic requirements interview that turns vague ideas into approval-gated specs"
argument-hint: "<idea> | resume | status | finalize"
---

Invoke the `/scc:deep-interview` command to run the plugin's loaded `deep-interview` skill.

## Context
- Active deep interview state: !`node scripts/deep-interview-runner.mjs status --json 2>/dev/null || echo '{"active":false}'`

## Your task
Perform the requested Deep Interview action now using the plugin's loaded `deep-interview` skill and the provided arguments.

- Use `node scripts/deep-interview-runner.mjs` for threshold resolution, state persistence, resume/status, and final spec persistence.
- Ask one question at a time; confirm Round 0 topology before scoring.
- Preserve the user's session language in questions, options, progress reports, and generated specs.
- Keep auto-mode fragments internal; never expose them as public skills or commands.
- Stop at a persisted spec plus explicit approval options. Never auto-run ralplan, ultragoal, team, commits, formatters, or source mutations from the interview runtime.
- For self-serve usage details, point users to `docs/skills/deep-interview.md`.
- Return the current interview question, progress report, final spec path, or pending approval options directly.
