---
name: loop
description: "Use when benchmarking and evolving prompt assets through a fixed-suite optimization loop"
effort: high
---

# Loop

Run a Karpathy-style optimization loop over the plugin's own prompt assets.

## When to Use

- Maintainers want to improve `skills/**/SKILL.md`, `agents/*.md`, `commands/*.md`, or `templates/*.md`
- A fixed benchmark suite with numeric scoring already exists
- Candidate variants should compete under the same time budget and the best variant should be promoted to an isolated branch

## Subcommands

| Command | Purpose |
|---------|---------|
| `list-suites` | List bundled loop suites in `benchmarks/loop/` |
| `show-suite <name>` | Inspect the validated suite manifest |
| `run <name>` | Create an isolated run branch, score a baseline, generate candidates, and promote a winner if `min_delta` is met |
| `resume <run_id>` | Reload the saved loop state from `.data/state/loop-active.json` |

## Workflow

1. Use `node scripts/loop-runner.mjs show-suite <name>` to load the suite and verify the allowed targets.
2. Use `node scripts/loop-runner.mjs run <name> ...` to create the isolated `codex/loop-...` branch and run worktree.
3. Inside that run worktree, create 3-5 prompt variants only within the selected targets.
4. Evaluate every candidate with the suite's fixed case commands. Parse scores from JSON or review-style output only.
5. Keep the top 1-2 elite candidates per generation. Stop when budget is exhausted, `min_delta` is not met, or the loop plateaus.
6. Only promote a winner when all hard gates pass and the score beats baseline by at least `min_delta`.

## Hard Gates

- Selected targets must stay within the suite allowlist and the global v1 mutation scope.
- Contract/runtime smoke checks must still pass when those files exist in the repo.
- Evaluator output must expose a numeric score that can be parsed deterministically.
- Winners are promoted only into the run branch/worktree, never into the current workspace.

## State

- Active state: `${CLAUDE_PLUGIN_DATA}/state/loop-active.json`
- Artifacts: `.captures/loop-<run_id>/`
- Bundled suites: `benchmarks/loop/*.json`

## Gotchas

- Do not add routing for this skill in `prompt-detect.mjs` for v1. It is slash-command only.
- Do not mutate `.mjs`, `docs/`, `README*`, or `tests/` as loop targets.
- Do not declare a winner when baseline remains best or when `min_delta` is not met.
- Do not write to the main worktree directly. The isolated loop branch is the output surface.
