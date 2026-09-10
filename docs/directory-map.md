# Directory map / 디렉터리 맵

**Locked for tree 3.1.0.** File inventory: [DOCUMENT-INDEX.md](DOCUMENT-INDEX.md). Human map: [README.md](README.md). Do not restyle this tree in `architecture.md`.

Second Claude Code is a **plugin**, not a host and not Uncle Code. Public method: **God Hands** (`/scc:godhands`). Runtime state stays `pdca_*`.

이 파일이 디렉터리 아키텍처의 잠금이다. `architecture.md`에 트리를 다시 그리지 마라.

## Layers / 레이어

| Layer | Paths | Role |
|---|---|---|
| Host adapters | `.claude-plugin/`, `.codex-plugin/`, `.grok-plugin/`, `.mcp.json`, `walnut.manifest.yaml` | Install only. Versions must all say **3.1.0** and `16 skills`. |
| Public method | `skills/godhands/`, `commands/godhands.md`, `docs/skills/godhands.md` | Gather → Draft → Check → Cut. Check is never skipped. |
| Runtime gates | `skills/pdca/`, `mcp/`, `hooks/` | `pdca_*` state, phase gates, Action Router. `/scc:pdca` is slash-only compat. |
| Skills | `skills/<name>/SKILL.md` | **16**. Fold with `disable-model-invocation`; do not delete SKILL.md. |
| Engine-only | `skills/unblock/` | No SKILL.md. Ships as `/scc:unblock`. |
| Slash | `commands/*.md` | **19** (16 skill wrappers + 3 tools) plus `commands/version.mjs`. |
| Agents | `agents/*.md` | **17**. Claude Code only. Dispatch YAML `name`, not Pokemon filename. |
| User docs | `README.md`, `docs/` | EN + KO. Guides live in `docs/skills/`; runtime lives in `skills/*/SKILL.md`. |
| Quality lib | `packages/core/` | Host-neutral contracts. Not a plugin install gate. Core **4.0.0** ≠ plugin **3.1.0**. |
| Live viewer | `ui/` | Local projection. Not the shareable Artifact (`scripts/export-artifact.mjs`). |
| Trajectory | `docs/methodology.md`, `scripts/export-artifact.mjs`, `.data/events`, `.data/cycles` | Reconstruct **one** run. Not a second host loop. |
| Archive | `translations/`, `docs/RELEASE-v*`, `docs/superpowers/`, `docs/changelog-archive.md` | Leave on disk. Not current 3.1.0 contracts. |

## Locked counts / 잠긴 수

16 skills · 19 command markdown files · 17 agents · 10 hook events · 3 MCP servers.

Auto-router spine: `godhands`, `research`, `write`, `review`, `refine`, `coach`. `analyze` stays model-invocable for God Hands Gather. Slash-only: `batch`, `collect`, `discover`, `evolve`, `loop`, `pdca`, `soul`, `translate`, `workflow`. Tools: `viewer`, `unblock`, `standard-check`.

## Locked tree / 잠긴 트리

```
second-claude/
├── .claude-plugin/plugin.json     # Claude: scc 3.1.0, 3 MCP servers
├── .codex-plugin/plugin.json      # Codex-native; plugin-relative pdca-state
├── .grok-plugin/plugin.json       # Grok 3.1.0
├── .mcp.json                      # Codex MCP: pdca-state on; playwright/mmbridge off
├── walnut.manifest.yaml           # walnut.world listing 3.1.0
├── AGENTS.md · CLAUDE.md          # Working contract
├── README.md · README.ko.md       # Install + God Hands
├── CHANGELOG.md                   # [3.1.0]; GitHub Latest is v3.1.0
├── skills/                        # 16 SKILL.md + unblock engine
│   ├── godhands/SKILL.md          # Public orchestrator
│   ├── pdca/                      # Compat skill + gate checklists in references/
│   ├── coach/ research/ analyze/ write/ review/ refine/
│   ├── batch/ collect/ discover/ workflow/ soul/ translate/ loop/ evolve/
│   ├── runtime-paths.md           # Host-neutral paths for Codex
│   └── unblock/                   # Engine only — no SKILL.md
├── commands/                      # 19 markdown + version.mjs
│   ├── godhands.md                # Public slash
│   ├── pdca.md                    # Slash-only compat
│   └── viewer.md · unblock.md · standard-check.md
├── agents/                        # 17 Claude subagents (Pokemon filenames, job name)
├── hooks/                         # 8 files, 10 events
│   ├── session-start.mjs          # Restore only
│   ├── session-end.mjs            # Stop = Check/coach gate; SessionEnd = handoff
│   └── lib/                       # event-log, review-*, soul-observer, plugin-discovery
├── mcp/
│   ├── pdca-state-server.bundle.mjs  # Checked-in runtime (say 3 servers, not a tool count)
│   └── pdca-state-server.mjs         # Maintainer source
├── docs/
│   ├── directory-map.md           # This lock
│   ├── DOCUMENT-INDEX.md          # File catalog
│   ├── README.md                  # Human map
│   ├── architecture.md            # Runtime boundary + roster (tree lives here)
│   ├── methodology.md             # Trajectory vs DSH; Artifact HTML
│   ├── notion-manual.md           # User manual
│   ├── orchestrator-architecture.md  # Advisory planner — not a fourth orchestrator
│   └── skills/                    # User guides (EN/KO), not SKILL.md
├── packages/core/                 # TypeScript quality contracts 4.0.0
├── ui/                            # Live viewer (not Artifact)
├── scripts/                       # export-artifact, coach-runner, standard-check, viewer-session
├── templates/                     # autopilot-pipeline.json and format templates
├── config/                        # stage-contracts, evolve-asset-map
└── tests/                         # contracts first (skill-contracts, coach-contracts, release-artifacts)
```

## Do not / 하지 마라

- Do not add a fourth orchestrator or a host loop (no DSH copy, no Uncle Code runtime inside SCC).
- Do not document slash-menu duplicates as current 3.1.0 (`user-invocable: false` is shipped on this tree).
- GitHub Latest Release is **v3.1.0**. Uninstall leftover `second-claude-code` / old `scc` caches.
- Do not advertise “31 MCP tools” in user blurbs. Say **3 servers**.
- Do not move `skills/*/SKILL.md` into `docs/` or treat `docs/skills/` as the runtime.
- Do not delete folded skills. Slash `/scc:<name>` still works.
- Do not treat `ui/` or the live viewer URL as the shareable Artifact.
- Do not restyle this tree inside `architecture.md`. Edit this file, then point.

## Pointers / 포인터

| Want | File |
|---|---|
| Install | [README.md](../README.md) |
| User manual | [notion-manual.md](notion-manual.md) |
| Runtime + roster | [architecture.md](architecture.md) |
| File catalog | [DOCUMENT-INDEX.md](DOCUMENT-INDEX.md) |
| Trajectory / Artifact | [methodology.md](methodology.md) |
| Advisory planner | [orchestrator-architecture.md](orchestrator-architecture.md) |
