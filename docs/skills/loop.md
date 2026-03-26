# Loop

> Benchmark and evolve prompt assets with a fixed-suite optimization loop.

## Quick Example

```bash
/second-claude-code:loop run write-core --targets skills/write/SKILL.md,commands/write.md --max-generations 2
```

**What happens:** the loop command validates the `write-core` suite, creates an isolated `codex/loop-...` branch and run worktree, measures the baseline, generates a few candidate variants inside the selected targets, and promotes a winner only if it clears every hard gate and beats baseline by `min_delta`.

## Subcommands

| Subcommand | Purpose |
|------------|---------|
| `list-suites` | List bundled loop suites from `benchmarks/loop/` |
| `show-suite <name>` | Inspect the suite manifest and scoring budget |
| `run <name>` | Execute a full optimization run |
| `resume <run_id>` | Reload the saved loop state |

## Allowed Targets

- `skills/**/SKILL.md`
- `agents/*.md`
- `commands/*.md`
- `templates/*.md`

Anything outside those paths is rejected before scoring begins.

## State and Artifacts

- Active state: `${CLAUDE_PLUGIN_DATA}/state/loop-active.json`
- Run artifacts: `.captures/loop-<run_id>/`
- Winner branch: `codex/loop-<suite>-<run_id>`

Artifacts include:

- `summary.json` for the resumable run snapshot
- `leaderboard.json` for every evaluated candidate
- `score-history.json` for per-generation trends
- `winner.diff` for the promoted patch when a winner clears `min_delta`

## Bundled Suites

| Suite | Focus |
|-------|-------|
| `write-core` | `write` prompt surface and template contracts |
| `review-core` | `review` prompt surface and consensus instructions |

## Run Lifecycle

1. Load and validate the suite manifest from `benchmarks/loop/`.
2. Resolve the selected targets and reject any path outside the v1 allowlist.
3. Create an isolated `codex/loop-...` run branch and worktree from the current HEAD.
4. Score the baseline under the same suite, case set, and timeout budget as every candidate.
5. Generate 3-5 candidate variants per generation, evaluate them with the requested `--parallel` budget, and keep the top 1-2 elites.
6. Stop when a winner beats baseline by `min_delta`, the run plateaus for two generations, or the generation budget is exhausted.

## Status Semantics

- `winner_promoted` means a candidate passed every hard gate and was copied into the isolated run branch.
- `min_delta_not_met` means the best candidate was valid but did not improve enough to win promotion.
- `plateau` means two generations completed without a new best score.

The current workspace stays untouched in every case. Only the isolated loop branch is mutated.
