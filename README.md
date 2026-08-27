[English](README.md) | [한국어](README.ko.md)

![version](https://img.shields.io/badge/version-3.0.3-blue)
![license](https://img.shields.io/badge/license-MIT-green)

# Second Claude Code

Second Claude Code is a Claude Code plugin with Codex support for research, writing, analysis, review, and revision.
It provides **15 skills** and **3 tool-only commands**. Use one skill directly, or explicitly
choose `/scc:pdca` when you want the Plan → Do → Check → Act cycle with phase gates.

It does not auto-dispatch a skill from every prompt. Claude Code's normal skill/command flow can
select a matching skill from its description; use a slash command when you need a predictable entry
point.

[![Second Claude Code — PDCA loop](docs/images/thumbnail.png)](https://www.scenesteller.com/studio/share/G2vdkxkjpj)

**Start here:** [User manual](docs/notion-manual.md) · [Skill index](docs/skills/) ·
[Command and document index](docs/README.md) · [Architecture](docs/architecture.md)

## Install

Run the supported marketplace flow:

```bash
claude plugin marketplace add unclejobs-ai/second-claude-code
claude plugin install scc
```

Start a new Claude Code session after installing. Check the installation with:

```bash
claude plugin list
```

To update an existing v3 installation:

```bash
claude plugin update scc
```

Restart Claude Code after an update. Version 3 uses the `scc` command namespace, so commands look
like `/scc:write` and `/scc:review`.

For Codex, install from the same marketplace:

```bash
codex plugin marketplace add unclejobs-ai/second-claude-code --ref main
codex plugin add scc@scc
```

Restart Codex after installing or refreshing the marketplace. Codex uses the native manifest and
plugin-relative MCP paths; it does not require `CLAUDE_PLUGIN_ROOT`.

To update an existing Codex installation:

```bash
codex plugin marketplace upgrade scc
codex plugin add scc@scc
```

If you are migrating from a pre-v3 installation, remove the old cached plugin and install the new
name. If the old entry is present, run:

```bash
claude plugin uninstall second-claude-code
claude plugin install scc
```

If `second-claude-code` is not listed, leave it uninstalled and run the normal `scc` install.
Reopen the session before using the new namespace.

Runtime data defaults to `.data/` in the plugin directory. Set `CLAUDE_PLUGIN_DATA` to a durable
path if you want runs, cycle memory, soul data, and preferences to survive plugin replacement:

```bash
export CLAUDE_PLUGIN_DATA="$HOME/.scc-data"
```

The `pdca-state` MCP server is shipped as a self-contained bundle. A fresh install does not need
`npm install`, a startup dependency download, or a local `node_modules` directory for that server.
Playwright and MMBridge are separate optional MCP integrations and may have their own setup.
Codex keeps both disabled by default; enable either one explicitly in the Codex MCP settings when
you need it.

## Choose an entry point

The `/scc:*` commands below are Claude Code entry points. In Codex, request the matching installed
skill by name or describe the task in natural language; Codex exposes the 15 skills but does not
mirror every Claude slash command.

| You want to… | Use |
|---|---|
| Research a topic and save a brief | `/scc:research` |
| Write an article, report, newsletter, or other supported format | `/scc:write` |
| Review an existing artifact | `/scc:review` |
| Revise from review findings | `/scc:refine` |
| Run all four PDCA phases | `/scc:pdca` |
| Use a judgment-free utility | `/scc:viewer`, `/scc:unblock`, or `/scc:standard-check` |

Natural-language requests are fine when Claude Code's normal skill flow selects the entry point.
For direct use, include the command explicitly:

```text
/scc:research "AI agent frameworks" --depth medium
/scc:write --format report --skip-research report-notes.md
/scc:review proposal.md --preset content
/scc:refine proposal.md --max 3
```

`write` runs its own internal review by default. Use `--skip-review` when you deliberately want
writing without that pass. `--skip-research` is appropriate when you have already supplied real
source material. A direct skill invocation does not have to be wrapped in PDCA.

## Research depth

`research` uses Jina Search as its primary search path. If Jina is unavailable or a page cannot be
read, it falls back through WebSearch/WebFetch and the unblock or Playwright paths when available.
Credentials, rate limits, and optional integrations affect which path is available; no particular
provider or result count is guaranteed beyond the selected depth contract.

| Depth | Search contract |
|---|---|
| `shallow` | Exactly 3 Jina Search calls; no deep-read round |
| `medium` | Exactly 5 Jina Search calls, plus up to 2 Jina Reader deep reads |
| `deep` | 10+ Jina Search calls, unlimited Jina Reader deep reads, and bounded gap-fill rounds |

When the legacy WebSearch/WebFetch engine is explicitly selected or Jina is unavailable, the
equivalent search/read calls use that fallback engine. See the [research guide](docs/skills/research.md)
for source validation and gap handling.

## The 15 skills and 3 tool-only commands

The skills make judgments or produce work. The three tool-only commands execute a utility and do
not occupy a skill slot.

| Skill | Purpose |
|---|---|
| `coach` | Settle a choice between defensible directions and record it as a project standard |
| `research` | Search, validate sources, identify gaps, and produce a research brief |
| `analyze` | Apply one of 15 strategic frameworks |
| `write` | Produce a format-specific, research-backed draft |
| `review` | Run a selected 2–5 reviewer panel and consensus gate |
| `refine` | Apply findings and iterate toward a target |
| `collect` | Capture URLs, notes, or excerpts into PARA-organized knowledge |
| `workflow` | Build and run reusable skill pipelines |
| `discover` | Find and score candidate skills; installation needs explicit approval |
| `pdca` | Orchestrate Plan → Do → Check → Act |
| `translate` | Translate between English and Korean while preserving format and voice |
| `batch` | Split homogeneous work into independent parallel units |
| `soul` | Synthesize a persistent profile of user preferences and patterns |
| `loop` | Optimize prompt assets against fixed suites (maintainer-only) |
| `evolve` | Evolve recurring-failure assets against maintainer-authored checks (maintainer-only) |

| Tool-only command | Purpose |
|---|---|
| `/scc:viewer` | Open or export a run's artifact and provenance |
| `/scc:unblock` | Run the adaptive 9-phase fallback chain for blocked URLs |
| `/scc:standard-check` | Apply recorded project standards to one artifact |

The [skill guides](docs/skills/) contain command syntax, options, examples, and limitations. The
maintainer-only `loop` and `evolve` entries are never auto-routed. The public `/scc:loop` command
optimizes prompt assets against a fixed benchmark suite; it is a direct maintainer entry point.

## Review presets

Review panels contain 2–5 specialized reviewers. The preset controls both reviewer coverage and
the vote threshold; a Critical finding blocks the result regardless of votes.

The built-in thresholds are `quick` 2/2, the 3-reviewer presets 2/3, `academic` 3/4, and `full`
3/5. These are consensus rules, not a promise that every review will finish or pass.

| Preset | Reviewers | Best for |
|---|---|---|
| `content` | Deep + Advocate + Tone | Articles, blogs, newsletters |
| `strategy` | Deep + Advocate + Facts | PRDs, SWOTs, strategy docs |
| `code` | Deep + Facts + Structure | Code review |
| `security` | Deep + Facts + Structure | Security audit |
| `academic` | Deep + Facts + Structure + Advocate | Papers and research outputs |
| `quick` | Advocate + Facts | A small review panel |
| `full` | All 5 | Broadest built-in panel |

Use a preset directly, for example `/scc:review draft.md --preset academic`. Review can be run
alone, or omitted from a direct write with `--skip-review`; PDCA's independent Check phase remains
separate when PDCA is selected.

## PDCA and its gates

PDCA is an explicit orchestration path, not a requirement for every request:

```text
Plan  → research and analyze a brief
Do    → produce the artifact from the approved plan
Check → review with the selected 2–5 reviewer preset
Act   → route gaps to Plan, Do, or Refine
```

The runtime-enforced gate subset is the source of truth for whether a phase may transition:

| Transition | Runtime checks include |
|---|---|
| Plan → Do | Required plan fields, `sources_count >= 5`, and Plan Mode approval |
| Do → Check | Artifact exists, required sections are complete, and plan findings are integrated |
| Check → Act | At least 2 reviewers and a standard verdict value |
| Act → next phase/exit | A valid decision and root-cause category, plus cycle limits |

Skill guidance is broader than this runtime subset. Research methodology, source quality, reviewer
roles, format instructions, and writing style are instructions to the skill and its agents; they
are not a prompt hook that dispatches work, and not every narrative condition is independently
enforced by the state MCP server. Read the [PDCA guide](docs/skills/pdca.md) for the full contracts.

For code work, the **Code Engineering Lane** adds stricter acceptance, isolation, validator evidence,
and handoff guidance on top of these same gates. It is a specialization of PDCA, not a second
runtime.

## Standards that survive sessions

`/scc:coach` can record a settled choice in your project:

```text
.scc/standards/<id>/STANDARD.md
```

The record keeps the chosen direction, rejected alternatives, reopening conditions, and checks.
Sessions can read active standards later, and `/scc:standard-check artifact.md` reports whether one
artifact meets them. Checks can return `PASS`, `FAIL`, `UNPROVEN`, or `UNCHECKED`; the checker does
not invent a passing judgment for an adversarial check.

## State, integrations, and background work

Lifecycle hooks restore state, report active-standard literal triggers, collect reviewer results,
and save session summaries. They do not choose or invoke a skill from a user prompt. The bundled
`pdca-state` server exposes 31 MCP tools for PDCA state, cycle memory, soul data, project memory,
session recall, and advisory plugin orchestration.

Cross-plugin discovery is advisory: orchestrator tools inspect installed capabilities and return a
ranked plan. They do not execute an external skill or command. Invoke any suggested external
capability explicitly and review its data boundary first.

Background handoff returns a Claude Code command; it does not execute queued work itself:

```bash
claude --bg "/scc:workflow run weekly-digest"
claude agents
```

## Configuration

All fields are optional. Place the file where your project or plugin configuration expects it:

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
- [Changelog](CHANGELOG.md) · [Issues](https://github.com/unclejobs-ai/second-claude-code/issues)

Issues and pull requests are welcome. Built by [Unclejobs](https://github.com/unclejobs-ai).

*Version 3.0.3 | MIT License*
