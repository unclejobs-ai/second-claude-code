---
description: "Ouroboros maintainer loop -- evolve a recurring-failure prompt asset against a maintainer-authored structural check"
argument-hint: list-failures | harvest <id> --assertion '/scc:' | run evolve-<id>
---

Invoke the `/scc:evolve` command to run the plugin's loaded `evolve` skill.

## Context
- Eligible failures: !`node scripts/evolve-runner.mjs list-failures 2>/dev/null || echo '{"eligible":0,"failures":[]}'`
- Active loop state: !`cat .data/state/loop-active.json 2>/dev/null || echo "No active loop"`

## Subcommands
- `list-failures [--min-recurrence N] [--asset PATH]`
- `show-failure <id>`
- `harvest <id> --assertion '<regex>[,<regex>]' [--target PATH]`
- `run evolve-<id> [--budget N] [--max-generations N] [--parallel N]`
- `resume <run_id>`

## Your task
Perform the requested evolve action now using the plugin's loaded `evolve` skill and the provided arguments.

- Use `node scripts/evolve-runner.mjs` for failure discovery, harvest, run setup, and resume bookkeeping.
- NEVER author the `--assertion` yourself. The maintainer hand-authors every structural check; evolve only surfaces which asset is weak. If the maintainer has not provided a check, ask for one — do not invent it.
- Only act on assets with a real recurring gate failure. Keep targets inside the v1 allowlist: `skills/**/SKILL.md`, `agents/*.md`, `commands/*.md`, `templates/*.md`.
- Never merge a winner automatically. Winners land on the isolated loop branch; report `winner.diff` and let the maintainer merge.
- Return the actual failure list, harvest result, or run summary directly.
- Do not say that you are invoking or have invoked a skill.
