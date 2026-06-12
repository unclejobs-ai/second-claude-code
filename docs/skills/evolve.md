# Evolve

> The ouroboros maintainer loop — evolve a recurring-failure prompt asset against a maintainer-authored structural check.

`evolve` sits on top of `loop`. It does not optimize anything itself; it selects *which* asset is structurally weak from real PDCA failures, takes a maintainer-authored check, and hands the asset to the unmodified `loop` engine.

## Quick Example

```bash
/second-claude-code:evolve list-failures
/second-claude-code:evolve harvest <id> --assertion '/second-claude-code:'
/second-claude-code:evolve run evolve-<id>
```

**What happens:** `list-failures` scans real `gate_fail` events and surfaces assets whose failures recur (`recurrence ≥ 3`). The maintainer hand-authors a static regex; `harvest` records it and writes a validated suite to `benchmarks/loop/evolve-<id>.json`. `run` shells out to `loop`, which evolves the asset on an isolated `codex/loop-...` branch. The maintainer reviews `winner.diff` and merges manually.

## Subcommands

| Subcommand | Purpose |
|------------|---------|
| `list-failures [--min-recurrence N] [--asset PATH]` | Surface assets that crossed the recurrence threshold |
| `show-failure <id>` | Inspect one provenance record and its prior ratified checks |
| `harvest <id> --assertion '<regex>[,<regex>]' [--target PATH]` | Attach the maintainer check and generate the suite |
| `run <name>` | Run the unmodified loop engine, then report holdout regressions (advisory) |
| `resume <run_id>` | Delegate to the loop engine's resume |

## Two Separated Concerns

- **Provenance** — a real logged failure decides *which* asset to evolve. Harvested mechanically from `gate_fail` events via `config/evolve-asset-map.json`.
- **Authorship** — the *maintainer* decides *what* the check is. Never derived from the failure, never written by the optimized model class. This is the core safeguard against a self-improvement loop gaming a benchmark it invented.

## v1 Scope

The loop's mutations are five fixed text substitutions (`should`→`must`, `can`→`must`, a legacy command-prefix rewrite, whitespace trim, blank-line collapse). They **rewrite** existing text; they never **add** new content. A candidate can only win when one of those substitutions flips the maintainer's regex from fail to pass. A check that demands a missing heading or a new section can never promote under v1 — it ends `min_delta_not_met` and needs manual editing instead.

## Safety Gates

- Maintainer authorship is a **procedural control**: the runner stamps `check_author: "maintainer"` and refuses an empty `--assertion`, but cannot distinguish a human regex from a model one. Never let the agent invent it.
- Generated `min_delta` is pinned to the bundled `0.02` floor; `evolve run` refuses anything below it.
- Targets are restricted to the v1 loop allowlist and a safe charset, so a target can never carry shell metacharacters into the generated command.
- Every loop hard gate (syntax, manifest, contract-smoke, allowed-targets, critic-output) applies unchanged — `evolve` edits no engine code.
- `evolve run` refuses to start unless `scripts/evolve-scorer.mjs` and the target asset are committed to `HEAD` (loop worktrees are built from `HEAD`).

## State and Artifacts

- Provenance ledger: `${CLAUDE_PLUGIN_DATA}/evolve/failures.jsonl` (local-only)
- Asset attribution map: `config/evolve-asset-map.json`
- Generated suites: `benchmarks/loop/evolve-*.json`
- Run artifacts: `.captures/loop-<run_id>/` (owned by the loop engine)

## Design Notes

The full design — including the adversarial review that blocked the naive "failures become benchmarks" idea and forced the structural-conformance reframe — is in [docs/proposals/evolve-ouroboros-spec.md](../proposals/evolve-ouroboros-spec.md).
