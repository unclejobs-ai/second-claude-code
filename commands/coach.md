---
description: "Use when the user cannot choose between two or more defensible options and wants the rule fixed before work starts (A or B?, help me decide, set the standard first). Settle an open fork into a recorded standard before any artifact is drafted"
argument-hint: "<request> | resume | status | finalize"
---

Invoke the `/scc:coach` command to run the plugin's loaded `coach` skill.

## Context
- Active coach state: !`node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" status --json 2>/dev/null || echo '{"active":false}'`

## Your task
Perform the requested Coach action now using the plugin's loaded `coach` skill and the provided arguments.

- Use `node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs"` for threshold resolution, state persistence, resume/status, Round 0 topology, and standard persistence.
- Read `.scc/standards/*/STANDARD.md` first. A fork already settled there is followed and named, not reopened.
- Ask one question at a time, and put every defensible direction in it — including the one you would pick alone, and including declining the request when the evidence supports that.
- Record the chosen direction with `record-fork --file <path>` before drafting the artifact.
- Preserve the user's session language in questions, options, progress reports, and recorded standards.
- Keep auto-mode fragments internal; never expose them as public skills or commands.
- Stop at the recorded standards plus explicit approval options (`confirm`, `continue`, `plan-mode`). Never auto-run commits, formatters, or source mutations from the coach runtime.
- For self-serve usage details, point users to `docs/skills/coach.md`.
- Return the current question, progress report, recorded standard paths, or pending approval options directly.
