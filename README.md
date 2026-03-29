[English](README.md) | [한국어](README.ko.md)

![version](https://img.shields.io/badge/version-0.9.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)

---

# Second Claude Code — Work OS for Knowledge Work

You type one prompt. Researchers crawl 20+ sources. An analyst finds patterns. A writer drafts 3,000 words — and before you even see it, five reviewers are already tearing the draft apart. One checks the logic. Another attacks the weak points. A third fact-checks every number.

**One prompt. Full cycle. No duct tape between plugins.**

This isn't a coding assistant. It's a work OS — it runs the full knowledge-work cycle autonomously: **Plan → Do → Check → Act.** Research, analysis, writing, and quality assurance in a single automated loop.

[![Second Claude Code — Knowledge Work OS](docs/images/thumbnail.png)](https://www.scenesteller.com/studio/share/G2vdkxkjpj)
<sub>Image created with [SceneSteller](https://www.scenesteller.com/studio/share/G2vdkxkjpj)</sub>

![One prompt to finished output](docs/images/hero.svg)

[Docs](docs/architecture.md) · [한국어 문서](docs/architecture.ko.md) · [User Manual](docs/notion-manual.md) · [사용 매뉴얼](docs/notion-manual.ko.md) · [Skill Guides](docs/skills/) · [GitHub Issues](https://github.com/unclejobs-ai/second-claude-code/issues) · [한국어 README](README.ko.md)

---

## What's New in v0.9.0

- **318 tests, green locally** — release docs now reflect the current verified suite size
- **Stage contracts at runtime** — domain-aware DoD and phase contracts now load directly from `config/stage-contracts.json`
- **Cycle reporting upgrades** — HTML cycle reports, Mermaid/Chart.js visuals, and an ANSI summary box at session end
- **Loop hardening** — file mutation queue, MAD-based confidence scoring, cost/time budgets, and iterative compaction
- **Trust + observability** — optional MMBridge MCP registration, anti-fabrication checks, and MetaClaw PRM effectiveness tracking

---

## Quick Start

**1. Install**

```bash
claude plugin add github:unclejobs-ai/second-claude-code
```

**2. Verify** — start a new session and look for this in the context injection:

```
# Second Claude Code — Knowledge Work OS
13 commands for all knowledge work:
```

Nothing? Run `claude plugin list` to check.

**3. Just talk**

```
Research the current state of AI agent frameworks and write a report
```

The auto-router picks the right skill. No slash commands to memorize. Korean works too:

```
AI 에이전트 알아보고 보고서 써줘
```

---

## The Problem This Solves

You've been using AI to write, research, and analyze. Each step works well on its own. The problem is in between — you're the one copying outputs, rephrasing prompts, doing five context switches for one piece of content. Each plugin works alone. Research doesn't know about writing. Writing doesn't know about review. You're the integration layer, and that tax adds up fast.

Second Claude Code eliminates the handoffs. You state the goal once, and the system runs the research, production, review, and revision cycle end to end.

---

## How It Works

### PDCA Execution Model

PDCA (Plan-Do-Check-Act) is the execution model. It's not a metaphor — every prompt runs through these four phases with hard gates between them.

```
You: "Research AI agents and write a report"

[Plan]  Crawl 20+ sources, find patterns, synthesize a structured brief
        ↓ gate: research brief must exist before writing starts
[Do]    Write a full draft grounded in the research
        ↓ gate: draft goes to review, not to you
[Check] 3-5 specialized reviewers run in parallel
        ↓ gate: average score >= 0.7 AND no Critical findings = approved
[Act]   Action Router reads the review feedback:
        → research gap? Back to Plan.
        → missing section? Back to Do.
        → polish issue? Refine and re-submit.

You get the final output. Reviewed. Fact-checked. Refined.
```

The key is the Action Router. When review finds problems, it classifies the root cause and routes back to the right phase. A research gap goes back to research, not to a generic "try again." That's why the second pass through PDCA is dramatically better than the first.

![PDCA Cycle](docs/images/pdca-cycle.svg)

---

### Agent System

17 specialized agents handle each PDCA phase. Each agent has a focused system prompt and limited tool access — a writer doesn't have access to web search, a reviewer doesn't write.

**3 model tiers — cost-optimized, not all opus:**

| Tier | Agents | Assigned work |
|---|---|---|
| **opus** (4 agents) | Xatu, Smeargle, Ditto, Pikachu | Deep reasoning, long-form writing, editing, memory synthesis |
| **sonnet** (9 agents) | Eevee, Alakazam, Mewtwo, Arceus, Absol, Porygon, Machamp, Magnezone, Deoxys | Analysis, strategy, research, review, infrastructure |
| **haiku** (4 agents) | Noctowl, Jigglypuff, Unown, Abra | Search, tone checks, structure, knowledge routing |

Pokemon names are deliberate — when you're reading logs, "Xatu found a logic gap" is easier to track than "reviewer-3 found issue."

**Agent dispatch flow:**

```
User prompt
  ↓
Auto-router (hook: prompt-detect.mjs)
  ↓
PDCA Orchestrator
  ├── Plan: Eevee (sonnet) researches → Alakazam (sonnet) analyzes
  ├── Do:   Smeargle (opus) writes the full draft
  ├── Check: 5 reviewers in parallel
  │          Xatu (opus) ─── logic + completeness
  │          Absol (sonnet) ─ weak points
  │          Porygon (sonnet) fact-check
  │          Jigglypuff (haiku) tone
  │          Unown (haiku) ─── structure
  └── Act:  Action Router → Ditto (opus) edits
```

---

### Quality Gates

Every phase transition is gated. Outputs don't reach you until they've cleared the gate.

Each reviewer emits structured JSON: a score from 0.0 to 1.0, plus findings tagged by severity — **Critical**, **Warning**, or **Nitpick**.

**Consensus logic:**
- Average score >= 0.7 AND no Critical findings → **APPROVED**
- Average score >= 0.7 but Critical findings present → **MUST FIX**
- Average score 0.5–0.7 → **NEEDS IMPROVEMENT** (routes back to Do)
- Average score < 0.5 → **MINOR FIXES** (routes to refine)

A Critical finding blocks the output regardless of score. The Action Router reads the severity distribution to determine which phase to re-enter — not just "try again from scratch."

**Definition of Done (DoD):** The `refine` skill accepts `--dod` — a semicolon-separated checklist of success criteria (e.g., `"no factual errors; every section has examples"`). Reviewers evaluate each criterion as PASS/FAIL per iteration. The editor prioritizes failing criteria, and refine only exits when all DoD criteria pass alongside the verdict target.

---

### Hook System

8 lifecycle hooks run automatically. You don't call them; they fire at the right moment.

| Hook | When it fires | What it does |
|---|---|---|
| **SessionStart** | Session opens | Banner display, PDCA state initialization |
| **UserPromptSubmit** | Every prompt | Auto-router: 2-layer pattern matching (~130 EN+KR triggers) |
| **SubagentStart** | Agent spawns | Review session context injection into agent system prompt |
| **SubagentStop** | Agent completes | Reviewer consensus aggregation, score accumulation |
| **Stop** | Session ends | State cleanup, output save |
| **StopFailure** | Check phase gate fails | Quality gate enforcement — blocks output delivery |
| **PreCompact** | Before context compression | PDCA state serialization |
| **PostCompact** | After context compression | PDCA state restoration, mid-cycle resume |

The two-layer auto-router in `UserPromptSubmit` first checks for PDCA compound patterns (prompts that request research + writing + review together), then falls back to single-skill patterns. This ordering matters — "research and write" should route to `pdca`, not to `research` alone. Routing decisions now include **confidence scoring** for observability — corrections are captured as soul observations for long-term learning.

---

### MCP State Layer

A dedicated `pdca-state` MCP server (stdio transport, modular architecture with 6 handler modules in `mcp/lib/`) manages persistent state across the session.

**21 tools** across PDCA state, soul, project memory, daemon control, and session recall surfaces.

**Core PDCA tools:**

| Tool | Purpose |
|---|---|
| `get` | Read current PDCA state |
| `start` | Initialize a new cycle |
| `transition` | Advance to next phase (with `auto_gate` evaluation) |
| `check_gate` | Evaluate gate conditions |
| `list_runs` | Query PDCA run history |
| `end` | Complete the cycle |
| `update_stuck` | Record a stuck/failed cycle |

**Event sourcing:** Every PDCA cycle is logged — phase transitions, gate decisions, review scores, action routes. You can query run history and spot recurring failure patterns.

**Crash recovery:** If the session restarts mid-cycle (context compression, network drop), `PostCompact` restores the last known state and resumes from where it stopped — not from the beginning.

**Playwright MCP** (optional): enables browser automation for JavaScript-heavy research targets. Separate setup required.

### Memory Boundary

Second Claude Code keeps two memory layers separate on purpose:

- `soul` stores persistent user identity and preference signals.
- Project recall comes from PDCA recovery state plus MMBridge continuity features such as memory search, handoff, and resume.

This project can borrow ideas from standalone agent runtimes, but it should not embed a second runtime inside the Claude Code plugin model.

---

## Pick Your Skill

You don't need to think about phases or cycles. Just say what you want.

I use `write` when I have a topic and want a finished piece by the end of the conversation. I use `review` when I already have a draft and want independent feedback before publishing. For anything bigger — research *then* write *then* review — `pdca` handles the whole thing.

| I want to... | Skill | What you get |
|---|---|---|
| Run the full research → write → review → improve cycle | `pdca` | Researched, reviewed, refined output — one prompt |
| Dig into a topic | `research` | 20+ sources crawled, patterns synthesized, brief delivered |
| Apply strategic frameworks — SWOT, Porter, RICE, and more | `analyze` | Structured strategic analysis from 15 built-in frameworks |
| Write an article, report, or newsletter | `write` | Research-backed, review-verified output |
| Get 3-5 independent perspectives on a draft | `review` | Parallel review with consensus voting |
| Refine a draft to a target score | `refine` | Iterative improvement until reviewers pass — supports `--dod` for structured success criteria |
| Benchmark and evolve prompt assets | `loop` | Fixed-suite optimization with isolated winner branches |
| Save a URL, note, or excerpt | `collect` | PARA-classified knowledge capture |
| Chain skills into a reusable workflow | `workflow` | Custom multi-step automation |
| Find and install new capabilities | `discover` | Skill discovery and installation |
| Let the system learn your preferences | `soul` | Adaptive personalization across sessions |
| Translate between English and Korean | `translate` | Soul-aware EN↔KO translation with style and format control |
| Break a large task into parallel units | `batch` | Parallel decomposition and reassembly |

Every skill responds to natural language. Slash commands work too: `/second-claude-code:write`, `/second-claude-code:review`, `/second-claude-code:translate`, etc. ~130 trigger patterns across English and Korean.

### Karpathy-Style Loop for Maintainers

`loop` is the maintainer-facing optimization surface. It does not route from normal user prompts in v1. Instead, it runs a fixed benchmark suite against prompt assets such as `skills/**/SKILL.md`, `commands/*.md`, `agents/*.md`, and `templates/*.md`, then promotes the best candidate only inside an isolated `codex/loop-...` branch.

Typical flow:

```bash
/second-claude-code:loop list-suites
/second-claude-code:loop show-suite write-core
/second-claude-code:loop run write-core --targets skills/write/SKILL.md,commands/write.md --parallel 2 --max-generations 2
```

The run writes resumable state to `.data/state/loop-active.json` and captures artifacts in `.captures/loop-<run_id>/`, including the leaderboard, score history, and winner diff.

```
"Research and write about AI agents"       →  pdca (full cycle)
"Write an article about vibe coding"       →  write
"SWOT으로 분석해"                           →  analyze
"Review this draft"                        →  review
```

---

## The Review System

Ever published something and found an obvious flaw ten minutes later?

Most AI tools generate and hand it to you. Second Claude Code generates, then **reviews its own output** before you see it. Every output passes through a multi-agent review — 3-5 specialized reviewers running in parallel, each covering a different quality dimension:

| Reviewer | What it checks |
|---|---|
| **Deep Reviewer** (Xatu) | Logic, completeness, argument flow |
| **Devil's Advocate** (Absol) | Finds the weakest point and attacks it |
| **Fact Checker** (Porygon) | Every number, claim, and source |
| **Tone Guardian** (Jigglypuff) | Voice consistency, audience fit |
| **Structure Analyst** (Unown) | Readability, organization, flow |

**Consensus gate:** average score >= 0.7 AND no Critical findings = approved. Any Critical finding = must fix. No exceptions, even if you're in a hurry.

I run `full` before publishing anything externally. For internal drafts, `quick` is enough — the advocate and fact checker catch the worst problems in under a minute.

![Review Flow](docs/images/review-flow.svg)

<details>
<summary><strong>Review presets</strong></summary>

| Preset | Reviewers | Best for |
|---|---|---|
| `content` | Deep + Advocate + Tone | Articles, blogs, newsletters |
| `strategy` | Deep + Advocate + Facts | PRDs, SWOTs, strategy docs |
| `code` | Deep + Facts + Structure | Code review |
| `security` | Deep + Facts + Structure | Security audit (CWE classification, OWASP Top 10) |
| `academic` | Deep + Facts + Structure | Academic papers, research outputs, citations |
| `quick` | Advocate + Facts | Fast validation |
| `full` | all 5 | Final pre-publish pass |

`--external` adds cross-model review via MMBridge (Kimi, Qwen, Gemini, Codex). Requires separate setup.

</details>

---

## How It Thinks

Three ideas drive the system's design:

**Thirteen skills, not eighty.** Each one is deep — references, gotchas, quality gates built in. You never wonder which of 80 skills to pick. Say what you want, and one of thirteen handles it.

**Every output gets reviewed.** This isn't a suggestion. Quality gates block you from skipping review. A draft that hasn't passed the consensus gate doesn't reach you.

**Failures get routed, not retried.** When review finds problems, the Action Router classifies the root cause. Research gap? Back to Plan. Missing section? Back to Do. Polish issue? Refine. Not every problem is a refine problem — treating them all the same wastes cycles.

---

## Skill Composition

Skills call each other. That's where the system becomes more than the sum of its parts.

| Pattern | What happens | Good for |
|---|---|---|
| Full PDCA | research → analyze → write → review → refine | Publish a researched article |
| Quick Check | review → refine | Polish an existing draft |
| Plan Only | research → analyze | Understand a market before committing |
| Autopilot | `workflow run autopilot --topic "..."` | End-to-end with no intervention |

I use Full PDCA for anything external-facing. For internal notes, `write` alone is enough — it still runs research and review internally.

---

## Agent Roster

17 agents across 3 model tiers. Model distribution: 4 opus / 9 sonnet / 4 haiku.

Each agent is named after a Pokemon whose trait maps to its role — memorable names make the system debuggable when you're reading logs.

| Phase | Agent | Role | Model |
|---|---|---|---|
| **Plan** | Eevee | Researcher — web search, data collection | sonnet |
| | Noctowl | Search specialist | haiku |
| | Alakazam | Analyst — pattern recognition, synthesis | sonnet |
| | Mewtwo | Strategist — framework analysis | sonnet |
| **Do** | Smeargle | Writer — long-form content | opus |
| | Arceus | Master — general-purpose execution | sonnet |
| **Check** | Xatu | Deep reviewer — logic, structure | opus |
| | Absol | Devil's advocate — attacks weak points | sonnet |
| | Porygon | Fact checker — numbers, sources | sonnet |
| | Jigglypuff | Tone guardian — voice, audience | haiku |
| | Unown | Structure analyst — readability | haiku |
| **Act** | Ditto | Editor — content refinement | opus |
| **Infra** | Machamp | Pipeline step executor | sonnet |
| | Magnezone | Skill candidate inspector | sonnet |
| | Deoxys | Skill candidate scorer | sonnet |
| | Abra | Knowledge connector | haiku |
| | Pikachu | Soul keeper — user behavior synthesis | opus |

![Agent Roster](docs/images/agent-roster.svg)

[Full architecture docs →](docs/architecture.md)

---

## Configuration

Works out of the box. One JSON file to tune.

```jsonc
{
  "defaults": {
    "research_depth": "medium",     // "shallow" | "medium" | "deep"
    "write_voice": "peer-mentor",   // writing tone
    "review_preset": "content",     // "content" | "strategy" | "code" | "quick" | "full"
    "refine_max_iterations": 3,     // max rounds before stopping
    "publish_target": "file"        // "file" | "notion"
  },
  "quality_gate": {
    "consensus_threshold": 0.67,    // fraction of reviewers that must pass
    "external_reviewers": []        // ["kimi", "qwen", "gemini", "codex"] via MMBridge
  }
}
```

Every field is optional. Delete what you don't care about. I set `refine_max_iterations` to 2 for quick tasks and 5 for anything going to a client.

---

## Design Decisions & Trade-offs

Every limitation is a choice.

- **Auto-routing handles ~95% of prompts correctly.** For edge cases, explicit `/second-claude-code:*` commands give full control.
- **Lightweight agents keep costs low** for high-volume tasks like fact-checking. Trade-off: with many plugins active, context limits can be tight. Disable unused plugins to keep headroom.
- **Claude Code is the primary platform,** fully tested. OpenClaw, Codex, and Gemini CLI work via standard protocols but are experimental.
- **Subagent results arrive after completion,** not incrementally. Streaming partial results would break the quality gate model.
- **Review findings are in English** regardless of input language. Korean output is planned.

If one of these bothers you, [open an issue](https://github.com/unclejobs-ai/second-claude-code/issues). The reasoning might change with new evidence.

---

## Compatibility

Built for Claude Code. Compatible with anything that reads SKILL.md or speaks ACP.

| Platform | Install | Status |
|---|---|---|
| **Claude Code** (primary) | `claude plugin add github:unclejobs-ai/second-claude-code` | Tested |
| **OpenClaw** | Standard ACP protocol — auto-detected | Experimental |
| **Codex** | SKILL.md compatible | Experimental |
| **Gemini CLI** | SKILL.md compatible | Experimental |

---

## Contributing

Issues and pull requests welcome at [github.com/unclejobs-ai/second-claude-code](https://github.com/unclejobs-ai/second-claude-code).

Built by [Unclejobs](https://github.com/unclejobs-ai). MIT License.

---

<details>
<summary><strong>15 Strategic Frameworks</strong></summary>

`/second-claude-code:analyze` supports 15 built-in frameworks:

| Category | Frameworks |
|---|---|
| **Strategy** | ansoff, porter, pestle, north-star, value-prop |
| **Planning** | prd, okr, lean-canvas, gtm, battlecard |
| **Prioritization** | rice, pricing |
| **Analysis** | swot, persona, journey-map |

Each framework lives in `skills/analyze/references/frameworks/`. The skill auto-selects from your prompt, or you can specify:

```bash
/second-claude-code:analyze porter "cloud infrastructure market"
/second-claude-code:analyze rice --input features.md
```

</details>

<details>
<summary><strong>Changelog</strong></summary>

### v0.9.0 — MetaClaw Tracking, CI Portability, 318 Tests

- **MetaClaw PRM effectiveness tracker** — release now records PRM agent effectiveness signals
- **CI portability fixes** — `ensureDir` runs before lock creation and spin-wait behavior is portable across environments
- **Suite growth** — total tests now sit at **318** (`317` passing, `1` skipped)

### v0.8.0 — Runtime Contracts, MMBridge, Anti-Fabrication

- **Stage contracts wired to runtime** — `loadContracts`, `getDoD`, and `getPhaseContract` now load domain-aware contracts directly
- **Optional MMBridge MCP registration** — `.claude-plugin/plugin.json` can register `mmbridge` as an optional server
- **MMBridge Adapter Protocol** — `Cli`, `Stub`, and `Recording` adapters added for integration and testing
- **Anti-fabrication layer** — `fact-checker.mjs` strengthens factual verification
- **Coverage expansion** — soul handler and memory handler tests added

### v0.7.0 — Cycle Reports, Mutation Queue, Benchmark Hardening

- **HTML cycle reports** — Chart.js + Mermaid reporting with a dark-theme presentation
- **ANSI terminal summary** — session-end now emits a concise terminal summary box
- **PIVOT / REFINE decisions** — `pdca_transition` handles richer decision paths
- **File Mutation Queue** — synchronized cross-process coordination with async per-file execution
- **Benchmark robustness** — MAD-based confidence scoring, loop budgets, and iterative compaction

### v0.6.0 — Stage Contracts, Gate Fixes, Skill Guardrails

- **Iron Laws + Red Flags** — English rigor guidance added to all 13 skills
- **Stage Contracts** — introduced `config/stage-contracts.json` for code vs. content workflows
- **Critical gate fixes** — corrected consensus rounding, score/vote validation, and quick-preset unanimity
- **Workflow preservation fixes** — compaction preserves `workflow-active.json`, and session-start restores all 13 commands including `translate`
- **Regression coverage** — new tests added for `subagent-stop`, `compaction`, `subagent-start`, and `stop-failure`

### v0.5.0 — Soul System, Batch Parallelism, Event Sourcing

- **Dynamic Soul System** — 3-mode persistent memory: manual / learning / hybrid. Learns user preferences across sessions
- **Batch Parallel Decomposition** — large tasks split into parallel units and reassembled
- **Event Sourcing + Analytics** — PDCA runs are event-logged with query, analytics, and crash recovery
- **Playwright Dynamic Web Research** — JavaScript-heavy page navigation for modern sites
- **Channels Notifications** — completion alerts to Slack, Telegram, or email
- **7 lifecycle hooks** — pre/post hooks for each PDCA phase, plus crash recovery
- **11 MCP tools** — state management, analytics, and cross-session context
- **17 subagents** across 3 model tiers (4 opus / 7 sonnet / 6 haiku)
- **2 new skills**: `soul` and `batch`

### v0.3.0 — PDCA v2, Action Router

- **PDCA v2 orchestrator** with Action Router — review failures route by root cause
- **Question Protocol** — asks clarifying questions before researching (`--no-questions` to skip)
- **16 subagents** across 3 model tiers
- **5 parallel reviewers** with consensus gate and 5 presets
- **Hook-based auto-routing** — ~130 trigger patterns (English + Korean)
- **Auto-capture** — outputs auto-save to `.captures/`

### v0.2.0 — Security hardening, English localization

- Security hardening across hooks and skills (13 audit findings resolved)
- English localization of all skill docs and README
- Marketplace manifest for `claude plugin add` install

### v0.1.0 — Initial release

- 8 domain skills + 1 orchestrator
- 15 strategic frameworks for `/analyze`
- PARA-based knowledge collection
- Workflow builder for repeatable automation

</details>
