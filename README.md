[English](README.md) | [한국어](README.ko.md)

![version](https://img.shields.io/badge/version-3.1.1-blue)
![license](https://img.shields.io/badge/license-MIT-green)

# Second Claude Code

**God Hands.** Extra hands that find, analyze, plan, decompose, benchmark, and improve. The AI workflow that does not skip Check.

`/scc:godhands` finds, analyzes, plans, drafts, checks, and cuts. That is the whole product.

| | |
|---|---|
| Display name | **Second Claude Code** |
| Method | **God Hands** (`/scc:godhands`) |
| Plugin id | **`scc`** |
| Slash namespace | **`/scc:*`** |
| GitHub | **[unclejobs-ai/second-claude-code](https://github.com/unclejobs-ai/second-claude-code)** |

Second Claude Code is a knowledge-work plugin for Claude Code, Codex, and Grok.
This tree is **16 skills**, **19 command markdown files** plus `commands/version.mjs`,
**17 agents**, **10 hook events**, and **3 MCP servers** (`pdca-state`, optional Playwright, optional MMBridge).
The default auto-router is `/scc:godhands`, `/scc:research`, `/scc:write`,
`/scc:review`, `/scc:refine`, and `/scc:coach`. Folded skills stay on disk;
call them with `/scc:<name>`. The one orchestrator is `/scc:godhands`.
`/scc:pdca` is the slash-only compat name.
`/scc:workflow` is named replay (slash) and `/scc:batch` is an independent
parallel split (slash).

It does not auto-dispatch a skill from every prompt. Claude Code's normal skill/command
flow can select a matching skill from its description; use a slash command when you
need a predictable entry point. Codex and Grok expose the 16 skills by name and do
not mirror every Claude slash command.

[![Second Claude Code — God Hands](docs/images/thumbnail.png)](https://github.com/unclejobs-ai/second-claude-code)

**This tree is 3.1.1. GitHub Latest Release is [v3.1.1](https://github.com/unclejobs-ai/second-claude-code/releases/tag/v3.1.1).**
Install from marketplace **`main`** or that release. Uninstall any leftover
`second-claude-code` / old `scc` cache first.

**Start here:** [User manual](docs/notion-manual.md) · [Skill index](docs/skills/) ·
[Command and document index](docs/README.md) · [Architecture](docs/architecture.md) ·
[Orchestrators](docs/orchestrator-architecture.md)

## Install

Use the host that you actually run. All three pull **`main`**, which is 3.1.1.
The GitHub Latest Release tag is **`v3.1.1`**.

### Claude Code

```bash
claude plugin marketplace add unclejobs-ai/second-claude-code
claude plugin install scc
```

Start a new Claude Code session after installing. Check with:

```bash
claude plugin list
```

You should see plugin id **`scc`**. Commands look like `/scc:godhands` and `/scc:write`.

To update an existing v3 Claude install:

```bash
claude plugin update scc
```

Restart Claude Code after an update.

On Claude Code, both `commands/` and `skills/` register. 3.1.0 sets
`user-invocable: false` on every skill so each `/scc:*` name appears once (the command).

### Codex

```bash
codex plugin marketplace add unclejobs-ai/second-claude-code --ref main
codex plugin add scc@scc
```

`--ref main` is required so Codex follows current `main` (v3.1.1), not an older Release zip.
Restart Codex after installing or refreshing the marketplace.

Codex uses `.codex-plugin/plugin.json` and plugin-relative MCP paths. It does not
need `CLAUDE_PLUGIN_ROOT`. Request an installed skill by name, or describe the
task; Codex does not mirror every `/scc:*` command.

To refresh an existing Codex install:

```bash
codex plugin marketplace upgrade scc
codex plugin add scc@scc
```

### Grok

```bash
grok plugin install unclejobs-ai/second-claude-code --trust
```

`--trust` is required. This repository has **`.grok-plugin/plugin.json`** and
**`walnut.manifest.yaml`** (Walnut listing, version 3.1.1). Grok installs from
GitHub **`main`** or the **v3.1.1** Release. After install,
request skills by name the same way Codex does.

### Migrating a pre-v3 Claude install

The v3 cache key is `scc`, not `second-claude-code`. If the old entry is listed:

```bash
claude plugin uninstall second-claude-code
claude plugin install scc
```

If `second-claude-code` is not listed, skip uninstall and run the normal `scc`
install. Reopen the session before using `/scc:*`.

## Durable data

Runtime data is runs, cycle memory, soul observations, workflows, and plugin
preferences. Project decision standards live in the project (`.scc/`), not here.

| Host provides | Data directory |
|---|---|
| `CLAUDE_PLUGIN_DATA` | that absolute path |
| otherwise | `<plugin-root>/.data` |

`<plugin-root>` is `CLAUDE_PLUGIN_ROOT` when the host sets it. Otherwise it is the
plugin root associated with the current skill — the directory two levels above
that skill's `SKILL.md`. Codex and Grok often omit the Claude-only variables; the
skills resolve this host-neutral fallback before any script or state path.

The default `.data/` directory sits inside the plugin install. Replacing the
plugin deletes it. Point `CLAUDE_PLUGIN_DATA` at a path outside the install if
you want that state to survive updates:

```bash
export CLAUDE_PLUGIN_DATA="$HOME/.scc-data"
```

Standards are unaffected: they are written under the project as
`.scc/standards/<id>/STANDARD.md`.

## MCP servers

The plugin ships **3 MCP servers**:

| Server | Default | Notes |
|---|---|---|
| `pdca-state` | on | Self-contained bundle. Fresh install does not need `npm install`, a startup download, or a local `node_modules` for this server. |
| Playwright | optional | Separate setup. Codex keeps it disabled until you enable it. |
| MMBridge | optional | Separate setup. Codex keeps it disabled until you enable it. |

The public surface is these 3 servers, not a separate tool catalog to install.
`pdca-state` also exposes many tools for PDCA state, cycle memory, soul data,
project memory, session recall, and advisory cross-plugin plans; those tools
inspect and advise. They do not execute an external skill for you.

## Choose an entry point

`/scc:*` is the Claude Code surface. In Codex and Grok, use the skill name in
the same row.

Default auto-router: `/scc:godhands`, `/scc:research`, `/scc:write`, `/scc:review`,
`/scc:refine`, `/scc:coach`. `analyze` is God Hands Gather (`/scc:analyze`); it is not
a top-level chooser. Folded skills stay on disk — call them with `/scc:<name>`.

These are easy to mix up. They are not substitutes.

| You want to… | Use | Not this |
|---|---|---|
| Produce one draft (article, report, newsletter, …) | `/scc:write` | Not a gated pass. Internal review runs unless you pass `--skip-review`. |
| Iterate an existing file toward a target | `/scc:refine` | Not production from scratch. Each round reviews, then edits. |
| Run a gated gather → draft → check → cut pass | `/scc:godhands` | Not a saved pipeline. Check is an independent review phase. |

| You want to… | Use |
|---|---|
| Research a topic and save a brief | `/scc:research` |
| Review an existing artifact | `/scc:review` |
| Settle a fork and record a project standard | `/scc:coach` |

### Tools

| You want to… | Use |
|---|---|
| Judgment-free utility | `/scc:viewer`, `/scc:unblock`, or `/scc:standard-check` |

### One orchestrator plus two slash utilities

`/scc:godhands` is the only orchestrator. `/scc:workflow` is named replay (slash).
`/scc:batch` is an independent parallel split (slash). They are not three equal
orchestrators. Autopilot is a named `/scc:workflow` preset, not a rival
orchestrator. God Hands still slash-chains `/scc:research`, `/scc:analyze`,
`/scc:write`, `/scc:review`, and `/scc:refine`. If Draft mentions `/scc:workflow`,
that is an explicit slash, not an auto-route.

| You want to… | Use | Kind |
|---|---|---|
| One gated gather → draft → check → cut pass | `/scc:godhands` | Orchestrator (auto-router) |
| Save and replay a named step list (or run autopilot) | `/scc:workflow` | Slash-only named replay. Autopilot *approximates* God Hands (research → analyze → write → review → refine) but does **not** enforce God Hands gates. |
| Split homogeneous work into independent parallel units | `/scc:batch` | Slash-only parallel split. Units must not depend on each other. Sequential work belongs to `workflow` or `godhands`. |

Slash-only (still on disk): `collect`, `discover`, `translate`, `batch`,
`workflow`, `soul`, `loop`, `evolve`.

### `write --skip-review` vs God Hands Check

`write` runs an internal `/scc:review` (default `quick` preset) unless you pass
`--skip-review`. That pass is part of the write skill, not a hook.

Hands **Check** is a **separate** review. The Draft phase is supposed to call write
with `--skip-research --skip-review` so Check owns quality. If you invoke
`/scc:write` and then wrap the same draft in `/scc:godhands` without skipping, you
review twice.

The same rule applies when you chain them yourself:

- Direct `/scc:write` — leave internal review on, or skip it only when another
  step will review.
- `/scc:godhands` — Draft skips write's internal review; Check reviews.
- `/scc:workflow` autopilot — a named `/scc:workflow` preset, not a rival
  orchestrator. It already passes `--skip-research --skip-review` on write,
  then runs `/scc:review` and `/scc:refine`. Do not add a God Hands Check on top
  unless you want a third pass.

`--skip-research` is appropriate only when real source material is already
supplied (or Plan/workflow already produced it).

```text
/scc:research "AI agent frameworks" --depth medium
/scc:write --format report --skip-research report-notes.md
/scc:write --format report --skip-research --skip-review draft.md
/scc:review draft.md --preset content
/scc:refine draft.md --max 3
/scc:godhands "AI agent market report" --depth deep
/scc:workflow run autopilot --topic "edge computing"
/scc:batch --topic "10-part series on AI infrastructure" --skill write --parallel 3
```

## Research depth

`research` uses Jina Search as its primary search path. If Jina is unavailable or
a page cannot be read, it falls back through WebSearch/WebFetch and the unblock
or Playwright paths when available. Credentials, rate limits, and optional
integrations affect which path is available; no particular provider or result
count is guaranteed beyond the selected depth contract.

| Depth | Search contract |
|---|---|
| `shallow` | Exactly 3 Jina Search calls; no deep-read round |
| `medium` | Exactly 5 Jina Search calls, plus up to 2 Jina Reader deep reads |
| `deep` | 10+ Jina Search calls, unlimited Jina Reader deep reads, and bounded gap-fill rounds |

When the legacy WebSearch/WebFetch engine is explicitly selected or Jina is
unavailable, the equivalent search/read calls use that fallback engine. See the
[research guide](docs/skills/research.md) for source validation and gap handling.

## The 16 skills and 3 tool-only commands

The skills make judgments or produce work. The three tool-only commands execute a
utility and do not occupy a skill slot. `skills/unblock/` still ships the fetch
engine; it has no `SKILL.md`.

Auto-router: `coach`, `godhands`, `refine`, `research`, `review`, `write`. God Hands Gather
(not a chooser): `analyze`. Slash-only: `batch`, `collect`, `discover`,
`evolve`, `loop`, `soul`, `translate`, `workflow`. Slash-only compat: `pdca`.

| Skill | Purpose | Routing |
|---|---|---|
| `godhands` | Orchestrate a gated gather → draft → check → cut pass | Auto-router (the orchestrator) |
| `coach` | Settle a choice between defensible directions and record it as a project standard | Auto-router |
| `research` | Search, validate sources, identify gaps, and produce a research brief | Auto-router |
| `analyze` | Apply one of 15 strategic frameworks | God Hands Gather (not a chooser) |
| `write` | Produce a format-specific, research-backed draft | Auto-router |
| `review` | Run a selected 2–5 reviewer panel and consensus gate | Auto-router |
| `refine` | Apply findings and iterate toward a target | Auto-router |
| `collect` | Capture URLs, notes, or excerpts into PARA-organized knowledge | Slash-only |
| `workflow` | Build and run reusable skill pipelines | Slash-only |
| `discover` | Find and score candidate skills; installation needs explicit approval | Slash-only |
| `pdca` | Slash-only compat name for Hands. MCP state stays `pdca_*` | Slash-only compat |
| `translate` | Translate between English and Korean while preserving format and voice | Slash-only |
| `batch` | Split homogeneous work into independent parallel units | Slash-only |
| `soul` | Synthesize a persistent profile of user preferences and patterns | Slash-only |
| `loop` | Optimize prompt assets against fixed suites (maintainer-only) | Slash-only |
| `evolve` | Evolve recurring-failure assets against maintainer-authored checks (maintainer-only) | Slash-only |

| Tool-only command | Purpose |
|---|---|
| `/scc:viewer` | Open or export a run's artifact and provenance |
| `/scc:unblock` | Run the adaptive 9-phase fallback chain for blocked URLs |
| `/scc:standard-check` | Apply recorded project standards to one artifact |

The [skill guides](docs/skills/) contain command syntax, options, examples, and
limitations. Slash-only skills stay on disk and are never auto-routed; call them
with `/scc:<name>`. Maintainer-only `loop` and `evolve` stay in that slash-only
set. The public `/scc:loop` command optimizes prompt assets against a fixed
benchmark suite; it is a direct maintainer entry point.

## Review presets

Review panels contain 2–5 specialized reviewers. The preset controls both
reviewer coverage and the vote threshold; a Critical finding blocks the result
regardless of votes.

The built-in thresholds are `quick` 2/2, the 3-reviewer presets 2/3, `academic`
3/4, and `full` 3/5. These are consensus rules, not a promise that every review
will finish or pass.

| Preset | Reviewers | Best for |
|---|---|---|
| `content` | Deep + Advocate + Tone | Articles, blogs, newsletters |
| `strategy` | Deep + Advocate + Facts | PRDs, SWOTs, strategy docs |
| `code` | Deep + Facts + Structure | Code review |
| `security` | Deep + Facts + Structure | Security audit |
| `academic` | Deep + Facts + Structure + Advocate | Papers and research outputs |
| `quick` | Advocate + Facts | A small review panel |
| `full` | All 5 | Broadest built-in panel |

Example: `/scc:review draft.md --preset academic`.

## Hands and its gates

Hands is an explicit orchestration path, not a requirement for every request.
Runtime state and MCP tools stay `pdca_*`.

```text
Gather → research and analyze a brief
Draft  → produce the artifact from the approved plan
         (write --skip-research --skip-review)
Check  → review with the selected 2–5 reviewer preset
Cut    → route gaps to Gather, Draft, or Refine
```

The runtime-enforced gate subset is the source of truth for whether a phase may
transition:

| Transition | Runtime checks include |
|---|---|
| Plan → Do | Required plan fields, `sources_count >= 5`, and Plan Mode approval |
| Do → Check | Artifact exists, required sections are complete, and plan findings are integrated |
| Check → Act | At least 2 reviewers and a standard verdict value |
| Act → next phase/exit | A valid decision and root-cause category, plus cycle limits |

Skill guidance is broader than this runtime subset. Research methodology, source
quality, reviewer roles, format instructions, and writing style are instructions
to the skill and its agents; they are not a prompt hook that dispatches work,
and not every narrative condition is independently enforced by the state MCP
server. Read the [Hands guide](docs/skills/godhands.md) for the public name and the
[PDCA guide](docs/skills/pdca.md) for the engine contracts.

For code work, the **Code Engineering Lane** adds stricter acceptance, isolation,
validator evidence, and handoff guidance on top of these same gates. It is a
specialization of PDCA, not a second runtime.

## Standards that survive sessions

`/scc:coach` can record a settled choice in your project:

```text
.scc/standards/<id>/STANDARD.md
```

The record keeps the chosen direction, rejected alternatives, reopening
conditions, and checks. Sessions can read active standards later, and
`/scc:standard-check artifact.md` reports whether one artifact meets them.
Checks can return `PASS`, `FAIL`, `UNPROVEN`, or `UNCHECKED`; the checker does
not invent a passing judgment for an adversarial check.

## State, integrations, and background work

Lifecycle hooks restore state, report active-standard literal triggers, collect
reviewer results, and save session summaries. They do not choose or invoke a
skill from a user prompt.

Cross-plugin discovery is advisory: orchestrator tools inspect installed
capabilities and return a ranked plan. They do not execute an external skill or
command. Invoke any suggested external capability explicitly and review its data
boundary first.

Background handoff returns a Claude Code command; it does not execute queued
work itself:

```bash
claude --bg "/scc:workflow run weekly-digest"
claude agents
```

## Configuration

All fields are optional. Place the file where your project or plugin
configuration expects it:

```jsonc
{
  "defaults": {
    "research_depth": "medium",     // shallow | medium | deep
    "write_voice": "peer-mentor",
    "review_preset": "content",     // content | strategy | code | security | academic | quick | full
    "refine_max_iterations": 3,
    "publish_target": "file"        // file | notion
  },
  "quality_gate": {
    "consensus_threshold": 0.67,
    "external_reviewers": []
  }
}
```

## Further reading

- [User manual](docs/notion-manual.md) — step-by-step entry and examples
- [Skill guides](docs/skills/) — one page per skill
- [Command and document index](docs/README.md)
- [Architecture](docs/architecture.md) — runtime boundaries and state model
- [Orchestrator architecture](docs/orchestrator-architecture.md) — advisory routing
- [Changelog](CHANGELOG.md) · [Issues](https://github.com/unclejobs-ai/second-claude-code/issues)

Issues and pull requests are welcome. Built by [Unclejobs](https://github.com/unclejobs-ai).

*Version 3.1.1 | GitHub Latest Release [v3.1.1](https://github.com/unclejobs-ai/second-claude-code/releases/tag/v3.1.1) | MIT License*
