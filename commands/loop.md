---
description: "Maintainer loop -- benchmark and evolve prompt assets inside isolated branches"
argument-hint: run write-core --targets skills/write/SKILL.md,commands/write.md --max-generations 2
---

Invoke the `/second-claude-code:loop` command to run the plugin's loaded `loop` skill.

## Context
- Available suites: !`node scripts/loop-runner.mjs list-suites 2>/dev/null || echo '{"suites":[]}'`
- Active loop state: !`cat .data/state/loop-active.json 2>/dev/null || echo "No active loop"`

## Subcommands
- `list-suites`
- `show-suite <name>`
- `run <name> [--targets path1,path2] [--budget N] [--parallel N] [--max-generations N]`
- `resume <run_id>`

## Your task
Perform the requested loop action now using the plugin's loaded `loop` skill and the provided arguments.

- Use `node scripts/loop-runner.mjs` for suite discovery, run setup, state handling, and resume bookkeeping.
- Keep mutations inside the v1 allowlist only: `skills/**/SKILL.md`, `agents/*.md`, `commands/*.md`, `templates/*.md`.
- Never overwrite the main workspace directly. Work inside the isolated branch/worktree prepared for the run.
- Return the actual suite list, suite details, or optimization result directly.
- Do not say that you are invoking or have invoked a skill.
