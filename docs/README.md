# Documentation

This is the human map for **Second Claude Code** (plugin id `scc`, slash
commands `/scc:*`, GitHub
[unclejobs-ai/second-claude-code](https://github.com/unclejobs-ai/second-claude-code)).
Version **3.1.2** on disk.

The plugin ships **16 skills** and **3 tool-only commands**. The default
auto-router is `/scc:godhands`, `/scc:research`, `/scc:write`, `/scc:review`,
`/scc:refine`, and `/scc:coach`. Folded skills stay on disk; call them with
`/scc:<name>`. The one orchestrator is `/scc:godhands`. `/scc:pdca` is the
slash-only compat name. `/scc:workflow` is named
replay (slash) and `/scc:batch` is an independent parallel split (slash). It
does not auto-dispatch a skill from every prompt.

Start with the [English manual](notion-manual.md) or the
[Korean manual](notion-manual.ko.md). Directory architecture is locked in
[directory-map.md](directory-map.md). The full file inventory, including
archive candidates, is in [DOCUMENT-INDEX.md](DOCUMENT-INDEX.md).

## Product docs

| Doc | English | 한국어 |
|---|---|---|
| User manual | [notion-manual.md](notion-manual.md) | [notion-manual.ko.md](notion-manual.ko.md) |
| Install and overview | [README.md](../README.md) | [README.ko.md](../README.ko.md) |
| Directory map (locked) | [directory-map.md](directory-map.md) | — |
| Architecture | [architecture.md](architecture.md) | [architecture.ko.md](architecture.ko.md) |
| Trajectory / Artifact | [methodology.md](methodology.md) | [methodology.ko.md](methodology.ko.md) |
| Orchestrator architecture | [orchestrator-architecture.md](orchestrator-architecture.md) | [orchestrator-architecture.ko.md](orchestrator-architecture.ko.md) |
| Skill guides | [skills/README.md](skills/README.md) | [skills/README.ko.md](skills/README.ko.md) |
| Agent roster (17 agents) | [agents/README.md](../agents/README.md) | — |
| Working contract | [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md) | — |
| Changelog `[3.0.0]`–`[3.1.2]` | [CHANGELOG.md](../CHANGELOG.md) | — |

Marketplace listing: [walnut.manifest.yaml](../walnut.manifest.yaml). Claude and
Codex manifests live under `.claude-plugin/` and `.codex-plugin/`.

## One orchestrator plus two slash utilities

Default auto-router: `/scc:godhands`, `/scc:research`, `/scc:write`, `/scc:review`,
`/scc:refine`, `/scc:coach`. `analyze` is God Hands Gather, not a top-level chooser
row. Tools: `/scc:viewer`, `/scc:unblock`, `/scc:standard-check`. Slash-only
(still on disk): `collect`, `discover`, `translate`, `batch`, `workflow`,
`soul`, `loop`, `evolve`, `pdca`.

`/scc:godhands` is the only orchestrator. `/scc:pdca` is slash-only compat.
`/scc:workflow` is named replay (slash).
`/scc:batch` is an independent parallel split (slash). Do not present them as
three equal orchestrators. Autopilot is a named `/scc:workflow` preset, not a
rival orchestrator. God Hands still slash-chains research, analyze, write, review,
and refine. If Draft mentions `/scc:workflow`, that is an explicit slash, not an
auto-route.

| You want | Use | Do not use it as |
|---|---|---|
| One gated Gather → Draft → Check → Cut pass with runtime transition gates | `/scc:godhands` | A saved reusable pipeline, or independent parallel units |
| A reusable saved pipeline of `/scc:*` steps | `/scc:workflow` | God Hands phase gates. Slash-only named replay. The `autopilot` preset (research → analyze → write → review → refine) approximates God Hands as a sequential pipeline; it does not run God Hands gates |
| 2–10 independent units in parallel worktrees | `/scc:batch` | Sequential work (`workflow`) or one gated God Hands pass (`godhands`). Slash-only parallel split |

`write` runs an internal `/scc:review` unless `--skip-review`. God Hands Check is a
separate review. Direct `/scc:write` plus `/scc:godhands` double-reviews unless Draft
uses `--skip-review`.

## 16 skills

Each skill has an English and Korean guide. Use the slash command shown in the
guide when you want an explicit entry point. Names match the 16 `SKILL.md`
directories on disk. Auto-router: `coach`, `godhands`, `refine`, `research`,
`review`, `write`. God Hands Gather (not a chooser): `analyze`. Slash-only: `batch`,
`collect`, `discover`, `evolve`, `loop`, `pdca`, `soul`, `translate`, `workflow`.

| Skill | Routing | Use when | English | 한국어 |
|---|---|---|---|---|
| `coach` | Auto-router | A request has more than one defensible direction and no active standard covers it | [guide](skills/coach.md) | [가이드](skills/coach.ko.md) |
| `research` | Auto-router | Researching a topic through iterative web exploration and synthesis | [guide](skills/research.md) | [가이드](skills/research.ko.md) |
| `analyze` | God Hands Gather (not a chooser) | Applying a strategic framework such as SWOT, RICE, OKR, or GTM | [guide](skills/analyze.md) | [가이드](skills/analyze.ko.md) |
| `write` | Auto-router | Producing newsletters, articles, reports, shorts, or social content | [guide](skills/write.md) | [가이드](skills/write.ko.md) |
| `review` | Auto-router | Reviewing content, strategy, or code with parallel specialized reviewers | [guide](skills/review.md) | [가이드](skills/review.ko.md) |
| `refine` | Auto-router | Iteratively improving a draft until it meets a review target | [guide](skills/refine.md) | [가이드](skills/refine.ko.md) |
| `collect` | Slash-only | Collecting URLs, notes, files, or excerpts into structured PARA knowledge | [guide](skills/collect.md) | [가이드](skills/collect.ko.md) |
| `workflow` | Slash-only | Chaining `/scc:*` commands into a reusable pipeline | [guide](skills/workflow.md) | [가이드](skills/workflow.ko.md) |
| `discover` | Slash-only | Current skills cannot handle a task and new skills are needed | [guide](skills/discover.md) | [가이드](skills/discover.ko.md) |
| `godhands` | Auto-router (the orchestrator) | Running a gated Gather → Draft → Check → Cut pass | [guide](skills/godhands.md) | [가이드](skills/godhands.ko.md) |
| `pdca` | Slash-only (compat) | Compat name for Hands. Runtime and MCP stay `pdca_*` | [guide](skills/pdca.md) | [가이드](skills/pdca.ko.md) |
| `translate` | Slash-only | Translating between English and Korean with formatting preserved | [guide](skills/translate.md) | [가이드](skills/translate.ko.md) |
| `batch` | Slash-only | Decomposing large work into independent parallel units | [guide](skills/batch.md) | [가이드](skills/batch.ko.md) |
| `soul` | Slash-only | Observing patterns and synthesizing a persistent identity profile | [guide](skills/soul.md) | [가이드](skills/soul.ko.md) |
| `loop` | Slash-only | Benchmarking prompt assets (maintainer-only) | [guide](skills/loop.md) | [가이드](skills/loop.ko.md) |
| `evolve` | Slash-only | Evolving a recurring-failure prompt asset (maintainer-only) | [guide](skills/evolve.md) | [가이드](skills/evolve.ko.md) |

## 3 tool-only commands

These are **commands, not skills**. They execute utilities and do not make a
quality judgment. `skills/unblock/` keeps the fetch engine and has no
`SKILL.md`.

| Command | Use when | English | 한국어 |
|---|---|---|---|
| `/scc:viewer` | Open or export run artifacts and provenance | [guide](skills/viewer.md) | [가이드](skills/viewer.ko.md) |
| `/scc:unblock` | Recover readable content from a blocked or JS-heavy URL | [guide](skills/unblock.md) | [가이드](skills/unblock.ko.md) |
| `/scc:standard-check` | Run recorded project standards against one artifact | [guide](skills/standard-check.md) | [가이드](skills/standard-check.ko.md) |

## MCP servers

The plugin registers **3 MCP servers**: shipped `pdca-state`, and optional
`playwright` and `mmbridge`. Count servers in user docs, not the internal tool
list on `pdca-state`.

For installation, updates, migration, research depth, review presets, and the
distinction between runtime-enforced gates and skill guidance, start with the
[user manual](notion-manual.md).
