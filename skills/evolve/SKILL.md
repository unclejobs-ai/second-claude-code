---
name: evolve
description: "Use when a prompt asset keeps causing the same PDCA gate failure and you want to evolve it against a maintainer-authored structural check"
effort: high
---

## Iron Law

> **Every evolve check is hand-authored by the maintainer — never by the optimized model class — and it scores structural conformance of the prompt asset, not runtime behavior. The maintainer's merge review of `winner.diff` is the final behavioral gate.**

## Red Flags

- "I'll write a check for what the asset should do" → STOP. The agent must NEVER author the assertion. The maintainer hand-authors every regex; evolve only surfaces *which* asset is weak. A model-authored check is self-deception — the optimizer games a benchmark it invented.
- "This asset feels weak, evolve it" → STOP. evolve only targets assets with a real, recurring logged gate failure (`recurrence ≥ 3`). No provenance, no target.
- "Lower min_delta so it promotes" → STOP. Generated suites pin `min_delta` to the `0.02` floor; evolve refuses to run below it.
- "Score went up, so it's better" → STOP. The score only proves the asset matches the maintainer's regex. Behavior is verified by reading `winner.diff` before merge.
- "It scored higher, merge it" → STOP. Winners land on the isolated `codex/loop-*` branch; merging to main is a manual maintainer decision.

# Evolve

The ouroboros maintainer loop. It closes the self-improvement ring: PDCA runs → Check gate fails → failure logged → `evolve harvest` surfaces the weak asset → the maintainer authors a structural check → the unmodified `loop` engine evolves the asset on an isolated branch → the maintainer merges → the next PDCA run starts stronger.

evolve is a **target-selection + check-authoring layer on top of `loop`**. It runs no optimizer of its own and relaxes no loop gate.

## When to Use

- The same PDCA gate (`sources_min_3`, `min_two_reviewers`, …) keeps failing across runs and the root cause is the *producing prompt asset*, not the individual run.
- The maintainer can express the desired structure as static regexes.
- A fixed loop engine + promotion gates already exist (they do).

## v1 Scope — what can actually promote

The loop's mutations are five fixed text substitutions: `should`→`must`, `can`→`must`, a legacy command-prefix rewrite to `/scc:`, trailing-whitespace trim, blank-line collapse. **None add content.** A candidate beats baseline only when the maintainer's regex flips fail→pass *because a substitution fired* — i.e. the asset still holds a `should` / `can` / legacy-prefix token the regex wants rewritten.

A check requiring **new** content the asset lacks (a missing heading, an added section) can never be satisfied by v1 mutations — every candidate stays byte-identical and the run ends `min_delta_not_met`. Those need manual editing or a future mutation set. Author assertions inside the promotable space.

## Subcommands

| Command | Purpose |
|---------|---------|
| `list-failures [--min-recurrence N] [--asset PATH]` | Scan real `gate_fail` events, surface assets that crossed the recurrence threshold. |
| `show-failure <id>` | Inspect one provenance record + prior ratified checks for that asset. |
| `harvest <id> --assertion '<regex>[,<regex>]' [--target PATH]` | Attach the **maintainer-authored** check and generate `benchmarks/loop/evolve-<id>.json`. |
| `run <name>` | Shell out to the unmodified `loop` engine, then report any holdout regression (advisory). |
| `resume <run_id>` | Delegate to `loop-runner.mjs resume`. |

## Workflow

1. `node scripts/evolve-runner.mjs list-failures` — which assets recur. Provenance only, never a check.
2. Decide the structural property, inside the v1 promotable space above. **The maintainer authors the regex.** The agent must not invent it.
3. `node scripts/evolve-runner.mjs harvest <id> --assertion '/scc:'` — a normalization check (the legacy long command prefix is rewritten to the canonical `/scc:` namespace). Writes a validated suite with the check inline (base64) so the worktree needs no extra file.
4. Commit `scripts/evolve-scorer.mjs` and the target asset, then `node scripts/evolve-runner.mjs run evolve-<id>` — runs the loop on an isolated branch; prior ratified checks ride along as weight-0 holdouts. (Refuses if either is missing from `HEAD`.)
5. Read `.captures/loop-<runId>/winner.diff`. Merge to main manually only if genuinely better.

## Hard Gates

- **Maintainer authorship is a procedural control, not a code gate.** The runner stamps `check_author: "maintainer"` and refuses an empty `--assertion`, but cannot tell a human regex from a model one. The "never model-authored" guarantee rests on this skill plus your review — never let the agent invent the assertion.
- Generated `min_delta` is pinned to `0.02`; `evolve run` refuses below it. (Invoking `loop-runner.mjs run evolve-*` directly bypasses this — always use `evolve run`.)
- Targets stay in the v1 scope (`skills/**/SKILL.md`, `agents/*.md`, `commands/*.md`, `templates/*.md`), restricted to a safe charset so they cannot carry shell metacharacters into the generated command.
- Inherited loop gates (syntax, manifest, contract-smoke, allowed-targets, critic-output) apply unchanged — evolve edits no engine code. evolve does **not** validate a suite's case-command safety (a baseline loop property); only run suites evolve itself generated.

## State

- Provenance ledger: `${CLAUDE_PLUGIN_DATA}/evolve/failures.jsonl` (local-only)
- Asset attribution map: `config/evolve-asset-map.json`
- Generated suites: `benchmarks/loop/evolve-*.json`
- Run artifacts: `.captures/loop-<run_id>/` (owned by the loop engine)

## Gotchas

- **Slash-only.** No `prompt-detect.mjs` routing. A self-mutating loop must never trigger autonomously, and is never daemon-scheduled.
- **v1 scores structure, not behavior**, bounded by the loop's fixed mutations. Calling it "failure reproduction" would be false — it is structural-conformance evolution against a maintainer-authored check.
- Do not author the assertion from a model's guess. Do not merge a winner without reading `winner.diff`.
