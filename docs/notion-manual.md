**English** | [한국어](notion-manual.ko.md)

# Second Claude Code — User Manual

> A practical, human-first guide to choosing an entry point

Display name **Second Claude Code**. Plugin id **`scc`**. Public slash prefix **`/scc:`**. Source
[unclejobs-ai/second-claude-code](https://github.com/unclejobs-ai/second-claude-code). Plugin
version **3.1.0**: 16 skills (`skills/*/SKILL.md`), 19 command markdown files plus
`commands/version.mjs`, 17 agents, 10 hook events, and 3 MCP servers (`pdca-state`, optional Playwright, optional
MMBridge).

## 1. Start with the smallest useful entry point

Second Claude Code is a plugin for Claude Code, with Codex and Grok install paths. Choose the
smallest match:

| Need | Entry point |
|---|---|
| Gather and synthesize sources | `/scc:research` |
| Produce an article, report, newsletter, or supported format | `/scc:write` |
| Check an existing draft or code artifact | `/scc:review` |
| Apply findings and iterate | `/scc:refine` |
| One gated Gather → Draft → Check → Cut pass (God Hands, the orchestrator) | `/scc:godhands` |
| A reusable named pipeline (slash-only named replay) | `/scc:workflow` |
| Independent similar units in parallel (slash-only parallel split) | `/scc:batch` |

The one orchestrator is `/scc:godhands`. `/scc:pdca` is the slash-only compat name. `/scc:workflow` is named replay (slash) and `/scc:batch` is
an independent parallel split (slash). They are not three equal default orchestrators.

The `/scc:*` forms above are Claude Code slash commands. Codex exposes the **16 skills**, not every
`/scc` command: request a skill by name or describe the work in natural language. Tool-only
commands (`viewer`, `unblock`, `standard-check`) and `commands/version.mjs` are Claude command
wrappers, not extra Codex skills.

Natural language can be handled by Claude Code's normal skill flow. SCC's prompt hook does not
auto-dispatch a skill or command. Use the slash form when you want explicit control:

```text
/scc:research "AI agent frameworks" --depth medium
/scc:write --format report --skip-research notes.md
/scc:review proposal.md --preset content
/scc:refine proposal.md --max 3
```

Direct skill use is valid; Hands is optional.

**Review ownership.** Direct `/scc:write` runs an internal `/scc:review` unless you pass
`--skip-review`. God Hands **Check** is a separate review phase. Calling `/scc:write` and then
`/scc:godhands` double-reviews unless Draft skips write's internal pass (`--skip-review`). Use
`--skip-research` only when real source material is already supplied.

In 3.1.0, every skill sets `user-invocable: false` so each `/scc:*` name appears once (the command).

## 2. Install, update, or migrate

Install from the **GitHub marketplace** for this repository. Do not add a local checkout directory
as the marketplace.

The plugin version on disk and in `CHANGELOG.md` is **3.1.0**. GitHub
**Latest Release** is **[v3.1.0](https://github.com/unclejobs-ai/second-claude-code/releases/tag/v3.1.0)**.
Marketplace install follows `main` or that tag. Uninstall leftover `second-claude-code` / old `scc` caches first.

### Claude Code

```bash
claude plugin marketplace add unclejobs-ai/second-claude-code
claude plugin install scc
```

Open a new Claude Code session, then verify:

```bash
claude plugin list
```

### Codex

```bash
codex plugin marketplace add unclejobs-ai/second-claude-code --ref main
codex plugin add scc@scc
```

Restart Codex after installing or refreshing the marketplace. Codex uses the native manifest and
plugin-relative MCP paths; it does not require `CLAUDE_PLUGIN_ROOT`. Codex does not mirror every
Claude `/scc:*` slash command — 16 skills only.

To refresh an existing Codex install:

```bash
codex plugin marketplace upgrade scc
codex plugin add scc@scc
```

### Grok

```bash
grok plugin install unclejobs-ai/second-claude-code --trust
```

`--trust` is required so hooks and MCP servers load. `walnut.manifest.yaml` is the Walnut listing.
There is no `.grok-plugin/` on `origin/main` yet; do not document a Grok marketplace directory that
is not on that branch.

### Updating v3 (Claude)

```bash
claude plugin update scc
```

Restart Claude Code after the update. Version 3 commands use the `scc` namespace, for example
`/scc:write`.

### Migrating an older installation

The namespace and plugin cache key changed in v3. If the old entry appears in
`claude plugin list`, remove it and install `scc`:

```bash
claude plugin uninstall second-claude-code
claude plugin install scc
```

If that old entry is absent, skip the uninstall step. Reopen Claude Code before invoking commands
from the new namespace.

### Keep runtime data when replacing the plugin

By default runtime data is under `.data/` in the plugin directory. Point `CLAUDE_PLUGIN_DATA` at a
durable directory to keep Hands runs, memory, soul data, and preferences across replacement:

```bash
export CLAUDE_PLUGIN_DATA="$HOME/.scc-data"
```

The plugin ships **3 MCP servers**: bundled `pdca-state`, plus optional Playwright and optional
MMBridge. `pdca-state` is a self-contained bundle. Fresh startup does not require `npm install`,
downloading dependencies, or a local `node_modules` directory for that server. Playwright and
MMBridge have separate setup and availability. Codex keeps both optional servers disabled by
default; enable either one explicitly in Codex MCP settings when needed.

## 3. First tasks

### Research a topic

```text
/scc:research "the current state of AI education" --depth medium
```

Research uses Jina Search as its primary path. The depth contract is:

| Depth | Contract |
|---|---|
| `shallow` | Exactly 3 Jina Search calls; no deep reads |
| `medium` | Exactly 5 Jina Search calls; up to 2 Jina Reader deep reads |
| `deep` | 10+ Jina Search calls; unlimited Jina Reader reads; bounded gap-fill rounds |

If Jina is unavailable, the skill can use WebSearch/WebFetch and then available unblock or
Playwright fallbacks. Credentials and rate limits determine which path succeeds. See the
[research guide](skills/research.md) for source validation and limitations.

### Write from supplied material

```text
/scc:write --format report --skip-research research-brief.md
```

Supported formats and their content floors are defined in the [write guide](skills/write.md). The
writer's **internal** `/scc:review` is on by default. Pass `--skip-review` when another owner
already has review: God Hands Check, a workflow review step, or a standalone `/scc:review`. Do not skip
research unless real sources are already in the request.

### Review an existing artifact

```text
/scc:review proposal.md --preset strategy
```

Review runs a panel of 2–5 specialized reviewers. The preset controls the panel and vote rule;
Critical findings block the result. Review can be used alone, without a Hands run.

### Refine from findings

```text
/scc:refine proposal.md --max 3
```

Refine applies review findings and stops at the target or configured limit. It does not promise a
particular number of iterations or a particular completion time.

## 4. The 16 skills and 3 tool-only commands

| Skill | Use it for |
|---|---|
| `coach` | Resolve a fork between defensible directions and record a project standard |
| `research` | Multi-round, source-backed research and synthesis |
| `analyze` | Applying one of 15 strategic frameworks (model-invocable for God Hands Gather) |
| `write` | Format-specific content production |
| `review` | Multi-perspective review with consensus voting |
| `refine` | Iterative revision toward a target |
| `collect` | PARA-organized knowledge capture |
| `workflow` | Reusable skill pipelines |
| `discover` | Candidate skill discovery and scored recommendations |
| `godhands` | Public orchestrator: gated Gather → Draft → Check → Cut |
| `pdca` | Slash-only compat name for Hands. Runtime and MCP stay `pdca_*` |
| `translate` | English ↔ Korean translation with format and voice preserved |
| `batch` | Parallel decomposition of homogeneous work |
| `soul` | Persistent preference and behavior profile synthesis |
| `loop` | Fixed-suite prompt optimization (maintainer-only) |
| `evolve` | Recurring-failure asset evolution (maintainer-only) |

| Tool-only command | Use it for |
|---|---|
| `/scc:viewer` | Open or export run artifacts and provenance |
| `/scc:unblock` | Try the adaptive 9-phase URL fallback chain |
| `/scc:standard-check` | Check one artifact against recorded project standards |

Those three have command wrappers and no `SKILL.md` (`skills/unblock/` keeps the fetch engine).
`commands/version.mjs` is the version helper beside the 19 command markdown files. Codex does not
surface the tool-only commands as extra skills.

Browse the [skill index](skills/) for each guide and the [document index](README.md) for related
architecture and command references.

## 5. Built-in orchestrator and slash-only replay

`/scc:godhands` is the built-in orchestrator. `/scc:pdca` is slash-only compat. `/scc:workflow` and `/scc:batch` are slash-only, not aliases and not peer orchestrators.

| Pick | When | What it is not |
|---|---|---|
| `/scc:godhands` (built-in orchestrator) | One request needs gated Gather → Draft → Check → Cut | Not a saved pipeline, not parallel units |
| `/scc:workflow` (slash-only named replay) | The same skill chain should be named, reused, scheduled, or run in the background | Not Hands runtime gates; not auto-routed |
| `/scc:batch` (slash-only parallel split) | Homogeneous work splits into 2–10 independent units that can run in parallel | Not sequential handoff; dependent units belong in an explicit `/scc:workflow` |

**Autopilot** (`/scc:workflow run autopilot`) approximates God Hands as a pipeline: research → analyze
→ write (`--skip-research --skip-review`) → review → refine. That write step skips internal
review so the later review step owns Check-like work. Autopilot does **not** run the Hands state
gates (`sources_count >= 5`, Plan Mode approval, and the other runtime checks on `pdca-state`). Use `/scc:godhands`
when you need those gates; use autopilot when you want a reusable named pipeline.

`quick-draft` is research → write (no analysis, no review). `quality-gate` is review → refine on
an existing file.

## 6. Review presets

| Preset | Reviewers | Typical use |
|---|---|---|
| `content` | Deep + Advocate + Tone | Articles, blogs, newsletters |
| `strategy` | Deep + Advocate + Facts | PRDs, SWOTs, strategy documents |
| `code` | Deep + Facts + Structure | Code review |
| `security` | Deep + Facts + Structure | Security audit |
| `academic` | Deep + Facts + Structure + Advocate | Papers and research outputs |
| `quick` | Advocate + Facts | A smaller panel |
| `full` | All 5 | Broadest built-in panel |

This is a 2–5 reviewer system. A preset is not a timing guarantee. `--external` is opt-in and may
send the artifact to configured external providers; review the data boundary before using it.

Built-in vote thresholds are `quick` 2/2, the 3-reviewer presets 2/3, `academic` 3/4, and `full`
3/5. A Critical finding blocks regardless of the vote.

## 7. How Hands works

Choose `/scc:godhands` when one request needs all phases **and** the runtime gates. Spoken Korean
may be 신의 손 or 신의 손. The English command is `godhands`. Runtime state and MCP tools stay
`pdca_*` (`.data/state/pdca-active.json`, `skills/pdca/references`). `/scc:pdca` is slash-only
compat.

```text
Gather → research and analyze a brief
Draft  → write from the approved plan (--skip-research --skip-review)
Check  → run the selected review preset  ← this is God Hands Check
Cut    → route research, execution, or polish gaps
```

Draft is pure execution. Write's default internal review is skipped so Check owns review. If you
already ran `/scc:write` without `--skip-review`, do not wrap that draft in a full Hands pass
unless you want a second review.

The state runtime enforces a defined gate subset:

| Transition | Runtime-enforced checks include |
|---|---|
| Plan → Do | Required fields, `sources_count >= 5`, Plan Mode approval |
| Do → Check | Artifact exists, sections are complete, plan findings are integrated |
| Check → Act | At least 2 reviewers and a standard verdict value |
| Act → next phase/exit | Valid decision and root-cause category, within cycle limits |

Skill guidance is broader than the runtime subset. Research method, source quality, reviewer roles,
format requirements, and style rules guide the relevant agents; they do not cause prompt-hook
dispatch, and every narrative condition is not independently enforced by `pdca-state`. See the
[Hands skill guide](skills/godhands.md) for the public pass and the [PDCA skill guide](skills/pdca.md)
for phase schemas and routing.

For code work, the **Code Engineering Lane** adds stricter acceptance, isolation, validator
evidence, and handoff guidance on top of these same gates. It is a specialization of Hands, not a
second runtime.

## 8. Standards and session state

`/scc:coach` stores settled decisions in your project under:

```text
.scc/standards/<id>/STANDARD.md
```

The record keeps the chosen direction, rejected options, reopening conditions, and checks.
`/scc:standard-check artifact.md` reports `PASS`, `FAIL`, `UNPROVEN`, or `UNCHECKED`; the checker
does not certify its own adversarial result.

Lifecycle hooks restore state, report literal triggers from active standards, aggregate reviewer
results, and save summaries. They do not select or invoke skills from a prompt.

The plugin registers **3 MCP servers**. `pdca-state` is always bundled. Playwright and MMBridge are
optional. Orchestrator results from `pdca-state` are advisory and never execute an external skill
or command.

Soul observations are daily files at `soul/observations/YYYY-MM-DD.jsonl` (hooks,
`soul_record_observation`, and `/scc:soul`). Trust the dated files.

## 9. Further reading and FAQ

### Does this replace Claude Code?

No. Claude Code is the primary host. Codex and Grok can install the same plugin with their own
CLIs. Codex still exposes 16 skills rather than every `/scc` command.

### Does it support Korean?

Yes. Use Korean, English, or a mixture. Use `/scc:translate` when you need an explicit translation
workflow.

### Does it cost money?

The plugin is MIT-licensed. Claude Code, Codex, Grok, and any external providers still follow
their own pricing, credentials, and usage policies. Multiple reviewers or deeper research can use
more tokens.

### Which GitHub Release should I install?

**v3.1.0** is Latest. Marketplace `main` and that tag match this tree. If an old
`second-claude-code` or duplicate `scc` entry is listed, uninstall both and reinstall.

### Where are the detailed references?

- [README](../README.md) — overview and quick start
- [Skill guides](skills/) — syntax and contracts for each skill
- [Architecture](architecture.md) — runtime boundaries and state model
- [Changelog](../CHANGELOG.md) — release and migration notes
- [Document index](README.md) — command and document map

### Archive / delete (document index)

Leave these on disk for this run. The [document index](README.md) should mark them as
archive/delete candidates:

- `translations/` — one-off translation workspace, not product docs
- `docs/RELEASE-v*` — historical release notes; current history is `CHANGELOG.md`

*Version 3.1.0 | MIT License*
