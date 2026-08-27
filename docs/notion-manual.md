**English** | [한국어](notion-manual.ko.md)

# Second Claude Code — User Manual

> A practical, human-first guide to choosing an entry point

## 1. Start with the smallest useful entry point

Second Claude Code is a plugin for Claude Code. It provides 15 skills and 3 tool-only commands.
Choose the one that matches the work:

| Need | Entry point |
|---|---|
| Gather and synthesize sources | `/scc:research` |
| Produce an article, report, newsletter, or supported format | `/scc:write` |
| Check an existing draft or code artifact | `/scc:review` |
| Apply findings and iterate | `/scc:refine` |
| Connect research, production, review, and revision with gates | `/scc:pdca` |

Natural language can be handled by Claude Code's normal skill flow. SCC's prompt hook does not
auto-dispatch a skill or command. Use the slash form when you want explicit control:

```text
/scc:research "AI agent frameworks" --depth medium
/scc:write --format report --skip-research notes.md
/scc:review proposal.md --preset content
/scc:refine proposal.md --max 3
```

Direct skill use is valid; PDCA is optional. `write` reviews its draft internally by default. Add
`--skip-review` to intentionally omit that pass, or `--skip-research` when real source material is
already supplied. A PDCA Check, when selected, remains an independent review phase.

## 2. Install, update, or migrate

### Prerequisite

Install [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) first.

### New installation

In a terminal, add the marketplace and install the plugin by its current name:

```bash
claude plugin marketplace add unclejobs-ai/second-claude-code
claude plugin install scc
```

Open a new Claude Code session, then verify:

```bash
claude plugin list
```

### Updating v3

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
durable directory to keep cycle runs, memory, soul data, and preferences across replacement:

```bash
export CLAUDE_PLUGIN_DATA="$HOME/.scc-data"
```

The `pdca-state` MCP server is shipped as a self-contained bundle. Fresh startup does not require
`npm install`, downloading dependencies, or a local `node_modules` directory for that server.
Playwright and MMBridge are optional MCP integrations with separate setup and availability.

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
writer's internal review is on by default; use `--skip-review` only when the workflow deliberately
owns review elsewhere.

### Review an existing artifact

```text
/scc:review proposal.md --preset strategy
```

Review runs a panel of 2–5 specialized reviewers. The preset controls the panel and vote rule;
Critical findings block the result. Review can be used alone, without a PDCA run.

### Refine from findings

```text
/scc:refine proposal.md --max 3
```

Refine applies review findings and stops at the target or configured limit. It does not promise a
particular number of iterations or a particular completion time.

## 4. The 15 skills and 3 tool-only commands

| Skill | Use it for |
|---|---|
| `coach` | Resolve a fork between defensible directions and record a project standard |
| `research` | Multi-round, source-backed research and synthesis |
| `analyze` | Applying one of 15 strategic frameworks |
| `write` | Format-specific content production |
| `review` | Multi-perspective review with consensus voting |
| `refine` | Iterative revision toward a target |
| `collect` | PARA-organized knowledge capture |
| `workflow` | Reusable skill pipelines |
| `discover` | Candidate skill discovery and scored recommendations |
| `pdca` | Explicit Plan → Do → Check → Act orchestration |
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

Browse the [skill index](skills/) for each guide and the [document index](README.md) for related
architecture and command references.

## 5. Review presets

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

## 6. How PDCA works

Choose `/scc:pdca` when one request needs all phases:

```text
Plan  → research and analyze a brief
Do    → write from the approved plan
Check → run the selected review preset
Act   → route research, execution, or polish gaps
```

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
[PDCA skill guide](skills/pdca.md) for phase schemas and routing.

## 7. Standards and session state

`/scc:coach` stores settled decisions in your project under:

```text
.scc/standards/<id>/STANDARD.md
```

The record keeps the chosen direction, rejected options, reopening conditions, and checks.
`/scc:standard-check artifact.md` reports `PASS`, `FAIL`, `UNPROVEN`, or `UNCHECKED`; the checker
does not certify its own adversarial result.

Lifecycle hooks restore state, report literal triggers from active standards, aggregate reviewer
results, and save summaries. They do not select or invoke skills from a prompt. The bundled
`pdca-state` server exposes 31 MCP tools for state, memory, soul data, recall, and advisory
cross-plugin orchestration. Orchestrator results are advisory and never execute an external skill
or command.

## 8. Further reading and FAQ

### Does this replace Claude Code?

No. Claude Code is required; this plugin adds skills, commands, hooks, and MCP tools on top of it.

### Does it support Korean?

Yes. Use Korean, English, or a mixture. Use `/scc:translate` when you need an explicit translation
workflow.

### Does it cost money?

The plugin is MIT-licensed. Claude Code and any external providers still follow their own pricing,
credentials, and usage policies. Multiple reviewers or deeper research can use more tokens.

### Where are the detailed references?

- [README](../README.md) — overview and quick start
- [Skill guides](skills/) — syntax and contracts for each skill
- [Architecture](architecture.md) — runtime boundaries and state model
- [Changelog](../CHANGELOG.md) — release and migration notes

*Version 3.0.2 | MIT License*
