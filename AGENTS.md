# Second Claude Code — Agent Instructions

Display name **Second Claude Code**. Plugin id **`scc`**. Repo **[unclejobs-ai/second-claude-code](https://github.com/unclejobs-ai/second-claude-code)**. Slash namespace **`/scc:*`**.

Plugin version **3.1.2** (`.claude-plugin/plugin.json`, `CHANGELOG.md`). GitHub **Latest Release is v3.1.2**.

God Hands knowledge work system: **16 skills**, **19 command markdown files** plus `commands/version.mjs`, **17 agents**, **10 hook events**, **3 MCP servers**. `/scc:godhands` is the public orchestrator.

System, developer, and user instructions take precedence over this guide and any skills. Complete authorized work through the relevant verification, keep the user's objective when later messages steer the task, and do not repeat approval already given.

## Install by host

| Host | Install | What you get |
|---|---|---|
| **Claude Code** | `claude plugin marketplace add unclejobs-ai/second-claude-code` then `claude plugin install scc` | Slash commands `/scc:*`, skills, agents, hooks, MCP |
| **Codex** | `codex plugin marketplace add unclejobs-ai/second-claude-code --ref main` then `codex plugin add scc@scc` | The 16 skills and plugin-relative MCP. Does **not** mirror every Claude slash command |
| **Grok** | `grok plugin install unclejobs-ai/second-claude-code --trust` | `.grok-plugin/plugin.json` plus `walnut.manifest.yaml` |

Claude update: `claude plugin update scc`. Codex refresh: `codex plugin marketplace upgrade scc` then `codex plugin add scc@scc`. Restart the host after install or update.

## Catalog

**16 skills** (each has `skills/<name>/SKILL.md`): `analyze`, `batch`, `coach`, `collect`, `discover`, `evolve`, `godhands`, `loop`, `pdca`, `refine`, `research`, `review`, `soul`, `translate`, `workflow`, `write`.

**3 tool-only commands** (no `SKILL.md`): `/scc:viewer`, `/scc:unblock`, `/scc:standard-check`. They execute and make no judgment. `skills/unblock/` still holds the fetch engine.

**19 command markdown files** in `commands/`: the 16 skill wrappers plus those 3 tools. `commands/version.mjs` is extra (not a slash command).

**17 agents** in `agents/*.md`. Filenames are Pokemon labels. Dispatch uses frontmatter `name` — see [agents/README.md](agents/README.md). `Agent(subagent_type: "eevee")` fails; `Agent(subagent_type: "researcher")` is the job.

Public maintainer loop command: `/scc:loop`. `loop` and `evolve` are never auto-routed.

## Host split

- **Claude Code** is the native plugin host: `.claude-plugin/plugin.json`, `commands/`, `agents/`, `hooks/`, `${CLAUDE_PLUGIN_ROOT}` MCP args. Slash `/scc:*` is the predictable entry point.
- **Codex** uses `.codex-plugin/plugin.json` and `.mcp.json` (plugin-relative `pdca-state` path; no `CLAUDE_PLUGIN_ROOT`). Skills resolve host-neutral paths via `skills/runtime-paths.md`. Playwright and MMBridge stay **disabled by default**. Ask for the skill by name or describe the task; do not assume Claude slash commands exist.
- **Grok** uses `.grok-plugin/plugin.json` and `walnut.manifest.yaml`. Do not document a Grok-native command/agent layout that is not on disk.

## Slash surface (3.1.x)

3.1.0 sets `user-invocable: false` on every skill so Claude Code's merged `/` menu shows each `/scc:*` name once (the command). Skills stay model-invocable unless they also set `disable-model-invocation`. Natural-language routing reads the `commands/*.md` frontmatter `description`, not SKILL.md; `evals/` measures it.

## MCP

**3 servers**, not a tool-count blurb:

| Server | Role |
|---|---|
| `pdca-state` | Required. Bundled at `mcp/pdca-state-server.bundle.mjs` |
| `playwright` | Optional |
| `mmbridge` | Optional |

`pdca-state` exposes many tools (PDCA state, cycle memory, soul, project memory, daemon/session, advisory orchestrator). Say **3 servers** in user-facing text unless you are explaining a specific tool.

## Language

Hooks, scripts, and the MCP server runtime are JavaScript ESM (`.mjs`); skills are Markdown (`skills/*/SKILL.md`). That is **not** “no TypeScript”: `packages/core/` is TypeScript (`packages/core/src/index.ts`, checked-in `dist/`) and `ui/` is TypeScript (artifact viewer). `@second-claude/core` is host-neutral quality contracts; the plugin does not activate it as a mandatory workflow gate. User installs must not compile anything.

## Agent dispatch

Pokemon filenames are labels for humans. The Agent tool `subagent_type` is the YAML `name` (researcher, writer, deep-reviewer, …). Call skills, not Pokemon names. Do not rewrite the 17 agent files to rename them.

These agent definitions are **Claude Code subagents**. Codex and Grok do not share this Agent roster.

## Built-in orchestrator and slash-only replay

The auto-router spine is `godhands`, `research`, `write`, `review`, `refine`, and `coach`. Leave `analyze` model-invocable; God Hands Gather slash-chains `/scc:analyze`. Do not pin those chained skills. `pdca` is `disable-model-invocation` (slash-only compat).

**Orchestrator (choose this for a gated pass):** `/scc:godhands` — Gather → Draft → Check → Cut **gates**, MCP run state (`pdca_*`), Action Router, cycle memory. `/scc:pdca` is the slash-only compat name.

**Slash-only** (not auto-routed; files stay; users still call `/scc:<name>`):

| Command | Role |
|---|---|
| **`/scc:workflow`** | Named replay of `/scc` steps, file-to-file, presets, schedule/background. Autopilot approximates God Hands without gates. God Hands Draft may mention this as an **explicit slash**, not auto-route. |
| **`/scc:batch`** | **2–10 independent parallel units** of the same skill, mandatory Approve gate. Sequential work is God Hands or an explicit `/scc:workflow`. |

Also slash-only (folded like `loop` / `evolve`): `collect`, `discover`, `translate`, `soul`, `pdca`. The advisory cross-plugin planner is not a fourth orchestrator.

**Autopilot** (`/scc:workflow run autopilot`) approximates God Hands: research → analyze → write(`--skip-research --skip-review`) → review → refine. It is a saved pipeline, not `pdca_*` state, not phase gates, not the Action Router.

## Write vs God Hands Check (double-review)

`/scc:write` runs internal `/scc:review --preset quick` unless `--skip-review`. God Hands **Check** is a separate independent `/scc:review`. Direct `/scc:write` **plus** `/scc:godhands` double-reviews unless Draft skips (`--skip-research --skip-review`, which God Hands Draft is supposed to pass). Autopilot already skips write's internal review.

## Soul observation path

Hooks and MCP write `soul/observations/YYYY-MM-DD.jsonl` (plus `soul/soul-active.json`). `/scc:soul` counts those daily files. Do not append to the log by hand.

## Project structure

```
.claude-plugin/plugin.json     — Claude manifest (name scc, version, MCP servers)
.codex-plugin/plugin.json      — Codex-native manifest (skills, MCP config)
.mcp.json                      — Codex MCP: plugin-relative pdca-state; playwright/mmbridge disabled
walnut.manifest.yaml           — walnut.world listing
.grok-plugin/plugin.json       — Grok plugin manifest
skills/                        — 16 SKILL.md directories + skills/unblock/ engine (no SKILL.md)
agents/                        — 17 Claude Code subagent files (Pokemon filenames, job `name`)
commands/                      — 19 slash-command markdown files + version.mjs
hooks/                         — 8 hook files across 10 events (Stop + SessionEnd share session-end.mjs)
mcp/pdca-state-server.mjs      — Maintainer source
mcp/pdca-state-server.bundle.mjs — Checked-in runtime artifact
packages/core/                 — TypeScript quality contracts (not a plugin install gate)
ui/                            — TypeScript artifact viewer
docs/                          — Architecture and skill guides (EN/KO bilingual)
```

Hook events: SessionStart, UserPromptSubmit, SubagentStart, SubagentStop, PostToolUse, Stop, SessionEnd, PreCompact, PostCompact, StopFailure. `compaction.mjs` serves PreCompact and PostCompact. `session-end.mjs` serves Stop and SessionEnd.

## Key conventions

- **Bilingual docs**: EN (`.md`) + KO (`.ko.md`) maintained independently, not translated from each other.
- **PDCA jobs** (frontmatter names): Plan (researcher + analyst) → Do (writer) → Check (deep-reviewer + devil-advocate + fact-checker + tone-guardian + structure-analyst) → Act (editor). Pokemon labels: Eevee, Alakazam, Smeargle, Xatu, Absol, Porygon, Jigglypuff, Unown, Ditto.
- **Cycle memory**: phase artifacts and insights in `.data/cycles/` (or `$CLAUDE_PLUGIN_DATA`).
- **Domain-aware PDCA**: `pdca_start_run` accepts `domain` (`code` \| `content` \| `analysis` \| `pipeline`).
- **Runtime data**: defaults to plugin `.data/`. Set `CLAUDE_PLUGIN_DATA` to a durable path so runs, soul, and preferences survive plugin replacement.

## DOCUMENT-INDEX

Active (edit these for current behavior):

| Path | Role |
|---|---|
| [AGENTS.md](AGENTS.md) · [CLAUDE.md](CLAUDE.md) | Agent/host contract (this file) |
| [README.md](README.md) · [README.ko.md](README.ko.md) | Install and entry points |
| [CHANGELOG.md](CHANGELOG.md) | 3.0.0–3.1.2 notes; GitHub Latest Release is v3.1.2 |
| [docs/README.md](docs/README.md) | Command and document index |
| [docs/directory-map.md](docs/directory-map.md) | Locked directory architecture (3.1.0) |
| [docs/DOCUMENT-INDEX.md](docs/DOCUMENT-INDEX.md) | Public file catalog |
| [docs/methodology.md](docs/methodology.md) · [docs/methodology.ko.md](docs/methodology.ko.md) | Trajectory vs DSH; Artifact HTML |
| [docs/notion-manual.md](docs/notion-manual.md) · [docs/notion-manual.ko.md](docs/notion-manual.ko.md) | User manual |
| [docs/architecture.md](docs/architecture.md) · [docs/architecture.ko.md](docs/architecture.ko.md) | Runtime boundary, roster; tree lives in directory-map.md |
| [docs/orchestrator-architecture.md](docs/orchestrator-architecture.md) · [docs/orchestrator-architecture.ko.md](docs/orchestrator-architecture.ko.md) | Advisory cross-plugin routing |
| [docs/skills/](docs/skills/) | 16 skill guides + 3 tool-only guides (EN/KO) |
| [agents/README.md](agents/README.md) | Dispatch names vs Pokemon files |
| [walnut.manifest.yaml](walnut.manifest.yaml) | walnut.world listing |
| [packages/core/README.md](packages/core/README.md) | TypeScript core contracts |

Archive (do not treat as current product docs). `translations/` and `docs/RELEASE-v*` were removed in 3.1.2; git history keeps them.

| Path | Why |
|---|---|
| [docs/changelog-archive.md](docs/changelog-archive.md) | Pre-3.0 changelog dump |

## Verification

```bash
# Syntax check all hooks and MCP server
node --check hooks/*.mjs hooks/lib/*.mjs mcp/*.mjs mcp/lib/*.mjs daemon/*.mjs

# Validate plugin manifest
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"

# Verify all agents have required frontmatter
for f in agents/*.md; do head -1 "$f" | grep -q '^---' || echo "MISSING frontmatter: $f"; done

# Verify all skills have SKILL.md — skills/unblock/ is engine-only by design
for d in skills/*/; do [ -f "${d}SKILL.md" ] || [ "$d" = "skills/unblock/" ] || echo "MISSING SKILL.md: $d"; done

# Run full test suite
npm test

# Regenerate and verify checked-in release artifacts
npm run build:mcp
git diff --exit-code -- mcp/pdca-state-server.bundle.mjs THIRD_PARTY_NOTICES.md
```

## Do Not

- Add install-time compilation. Maintainers regenerate the checked-in MCP bundle and third-party notices with `npm run build:mcp`; user installs must not build or fetch runtime dependencies.
- Claim “no TypeScript” — `packages/core` and `ui` exist.
- Dispatch `Agent` with a Pokemon filename. Use frontmatter `name`.
- Advertise “31 MCP tools” in user blurbs. Say 3 servers.
- Document slash-menu duplicates as current 3.1.0 behavior. 3.1.0 ships `user-invocable: false`.
- GitHub Latest Release is v3.1.2; v3.1.0 is a historical tag.
- Modify agent model tiers without checking `docs/architecture.md` roster table.
- Edit `hooks.json` directly — it is the plugin hook registry; changes affect all users.
- Translate an English file into Korean or vice versa. Keep each language file in its language.
