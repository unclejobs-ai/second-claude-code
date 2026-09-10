# Skill guides

These guides are the human-facing reference for `/scc:*`. God Hands is extra
hands that find, analyze, plan, decompose, benchmark, and improve — not a
skill catalog. Check is never skipped.

The documentation map is [docs/README.md](../README.md). The full file
inventory is [DOCUMENT-INDEX.md](../DOCUMENT-INDEX.md).

## What is available

The catalog contains **16 skills** and **3 tool-only commands**. Skill names
match the 16 `SKILL.md` directories on disk.

| Skills | `analyze`, `batch`, `coach`, `collect`, `discover`, `evolve`, `godhands`, `loop`, `pdca`, `refine`, `research`, `review`, `soul`, `translate`, `workflow`, `write` |
| Tools | `standard-check`, `unblock`, `viewer` |

| Kind | Names | What it means |
|---|---|---|
| Auto-router skills | `coach`, `godhands`, `refine`, `research`, `review`, `write` | Default auto-router. These may dispatch agents and apply the contracts documented here. `/scc:godhands` is the only orchestrator. |
| God Hands Gather (not a chooser) | `analyze` | Model-invocable so God Hands Gather can slash-chain `/scc:analyze`. Not a top-level chooser row. |
| Slash-only skills | `batch`, `collect`, `discover`, `evolve`, `loop`, `pdca`, `soul`, `translate`, `workflow` | Still on disk. Call `/scc:<name>`. Not auto-routed. `pdca` is slash-only compat for God Hands. `workflow` is named replay; `batch` is an independent parallel split. |
| Tool-only commands | `standard-check`, `unblock`, `viewer` | Deterministic utilities. They fetch, inspect, check, or serve data. They are **not skills**, do not occupy a skill slot, and do not imply a judgment pass. `/scc:viewer` is a command. |

Each guide has an English file and a Korean counterpart (`*.ko.md`). The two
files are translations of the same contract; examples may use the language of
the guide, but flags, defaults, gates, and safety boundaries must match.

## Choosing a guide

- Default auto-router: `godhands`, `research`, `write`, `review`, `refine`, `coach`.
- God Hands Gather uses `analyze` (`/scc:analyze`); it is not a top-level chooser row.
- Tools: `/scc:viewer`, `/scc:unblock`, `/scc:standard-check`.
- Slash-only (still on disk): `collect`, `discover`, `translate`, `batch`, `workflow`, `soul`, `loop`, `evolve`, `pdca`.
- One orchestrator: `/scc:godhands`. `/scc:pdca` is slash-only compat. `workflow` is named replay (slash). `batch` is an independent parallel split (slash).
- Maintain prompt assets: `loop`, `evolve` (maintainer-only, slash-only).

## One orchestrator plus two slash utilities

`/scc:godhands` is the only orchestrator. `/scc:pdca` is slash-only compat.
`/scc:workflow` and `/scc:batch` stay on
disk as slash-only utilities; they are not rival orchestrators. Autopilot is a
named `/scc:workflow` preset, not a rival orchestrator. God Hands still slash-chains
research, analyze, write, review, and refine. If Draft mentions `/scc:workflow`,
that is an explicit slash, not an auto-route.

| You want | Use | Notes |
|---|---|---|
| One gated Gather → Draft → Check → Cut pass | `/scc:godhands` | Orchestrator (auto-router). Runtime transition gates. Direct skills remain available without wrapping. |
| A reusable saved pipeline of `/scc:*` steps | `/scc:workflow` | Slash-only named replay. The `autopilot` preset (research → analyze → write → review → refine) approximates God Hands as a sequential pipeline. It does not run God Hands phase gates. |
| Independent parallel units in worktrees | `/scc:batch` | Slash-only parallel split. Sequential dependencies belong in `workflow`. A single gated pass belongs in `godhands`. |

`write` runs an internal `/scc:review` unless `--skip-review`. God Hands Check is a
separate review. Direct `/scc:write` plus `/scc:godhands` double-reviews unless Draft
uses `--skip-review`.

## Contract conventions

Examples are illustrative, not promises of fixed scores, source counts, or
review outcomes. A guide calls out whether a behavior is runtime-enforced,
skill-level guidance, or user approval. External installs, paid providers, and
publishing remain opt-in where stated by the command contract.
