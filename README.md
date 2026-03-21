[English](README.md) | [한국어](README.ko.md)

![version](https://img.shields.io/badge/version-0.3.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)

---

# Second Claude Code — Knowledge Work OS

You type *"Research AI agents and write a report."*

Thirty seconds later, an Eevee researcher is crawling the web. An Alakazam analyst is finding patterns in what comes back. A Smeargle writer drafts 3,000 words — and before you even see it, five reviewers are already arguing about your draft. Xatu checks the logic. Absol attacks the weak points. Porygon fact-checks every number.

**One command. Full cycle. No duct tape between plugins.**

![Skill Wheel](docs/images/hero.svg)

---

## Quick Start

**1. Install**

```bash
claude plugin add github:EungjePark/second-claude-code
```

**2. Verify** — start a new session and look for:

```
# Second Claude Code — Knowledge Work OS
9 commands for all knowledge work:
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

## What Actually Happens

Most plugins do one thing. Research here, writing there, review somewhere else — none of them talk to each other. You end up being the glue.

Second Claude Code runs a **quality loop** instead. Every piece of content goes through the same cycle that manufacturing figured out decades ago: **Plan → Do → Check → Act.**

Here's what that looks like in practice:

```
You: "Research AI agents and write a report"

[Plan]  Eevee + Noctowl crawl 20+ sources, Alakazam synthesizes findings
        ↓ quality gate: research brief reviewed before writing starts
[Do]    Smeargle writes a full draft using the research
        ↓ quality gate: draft goes to review, not to you
[Check] 5 reviewers in parallel — logic, facts, tone, structure, weak points
        ↓ consensus gate: 2/3 must pass, any Critical = blocked
[Act]   Action Router reads the feedback:
        → research gap? Back to Plan.
        → missing section? Back to Do.
        → polish issue? Ditto loops and refines.

You get the final draft. Reviewed. Fact-checked. Refined.
```

![PDCA Cycle](docs/images/pdca-cycle.svg)

Without this plugin, you'd run `/research`, copy the output, paste it into a writing prompt, then manually ask for feedback, then manually apply it. Five context switches. With Second Claude Code, it's one prompt.

---

## Choose Your Skill

| I want to... | Skill | What happens |
|---|---|---|
| Full research→write→review→improve cycle | `pdca` | Chains everything with quality gates |
| Investigate a topic | `research` | Autonomous deep research with source synthesis |
| Apply 15 strategic frameworks (SWOT, Porter, RICE...) | `analyze` | Strategic analysis with structured output |
| Write an article, report, or newsletter | `write` | Research + draft + review in one command |
| Get multi-perspective feedback | `review` | 3-5 parallel reviewers with consensus voting |
| Iteratively improve to a target score | `loop` | Refine until reviewers pass |
| Save a URL, note, or excerpt | `collect` | PARA-classified knowledge capture |
| Chain skills into a reusable workflow | `pipeline` | Custom automation builder |
| Find a skill you don't have | `hunt` | Discover and install new capabilities |

Commands use the `/second-claude-code:` prefix. Or just type naturally — the auto-router handles it.

---

## Auto-Routing

No commands to memorize. Type what you want in English or Korean.

```
"Research and write about AI agents"       →  pdca (full cycle)
"Write an article about vibe coding"       →  write
"Analyze this market with SWOT"            →  analyze
"Review this draft"                        →  review
"더 좋게 다듬어"                            →  loop
"이 링크 저장해줘"                          →  collect
"보안 감사 스킬 있어?"                      →  hunt
```

The router uses two layers: compound patterns ("research **and** write") trigger full PDCA cycles. Single-skill intent goes directly to that skill. Earliest match wins. ~77 English + ~50 Korean trigger patterns total.

> Full Korean routing examples: see [한국어 README](README.ko.md).

---

## The Review System

This is where it gets interesting. Most AI writing tools generate and hand it to you. Second Claude Code generates, then **attacks its own output** before you see it.

`/second-claude-code:review` dispatches 3-5 specialized agents in parallel:

| Reviewer | Pokemon | Model | What they do |
|---|---|---|---|
| Deep Reviewer | Xatu | opus | Structural logic, completeness, argument flow |
| Devil's Advocate | Absol | sonnet | Finds the weakest point and hits it |
| Fact Checker | Porygon | haiku | Verifies every number, claim, and source |
| Tone Guardian | Jigglypuff | haiku | Checks voice consistency and audience fit |
| Structure Analyst | Unown | haiku | Readability, organization, scan-ability |

Why Pokemon? Each one maps to a real trait. Xatu sees past and future (structural foresight). Absol senses disaster (vulnerability detection). Porygon is literally digital (data-native fact checking). It's memorable, and memorable names mean you actually remember what each reviewer does.

**Consensus gate:** 2/3 pass = APPROVED. Any Critical finding = MUST FIX. No exceptions.

![Review Flow](docs/images/review-flow.svg)

<details>
<summary><strong>Review presets</strong></summary>

| Preset | Reviewers | Best for |
|---|---|---|
| `content` | Xatu + Absol + Jigglypuff | Articles, blogs, newsletters |
| `strategy` | Xatu + Absol + Porygon | PRDs, SWOTs, strategy docs |
| `code` | Xatu + Porygon + Unown | Code review |
| `quick` | Absol + Porygon | Fast validation |
| `full` | all 5 | Final pre-publish pass |

**External reviewers (optional):** `--external` adds cross-model review via MMBridge (Kimi, Qwen, Gemini, Codex). Requires separate MMBridge setup.

</details>

---

## Skill Composition

Skills call each other. A single prompt can trigger a full cycle.

| Pattern | Chain | Use case |
|---|---|---|
| Full PDCA | research → analyze → write → review → loop | End-to-end content |
| Quick Check | review → loop | Polish an existing draft |
| Plan Only | research → analyze | Strategic analysis |
| Autopilot | `pipeline run autopilot --topic "..."` | One-command production |

`/second-claude-code:write` auto-invokes research and review internally. One command, research-backed, review-verified output.

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

Each framework is a standalone reference doc in `skills/analyze/references/frameworks/`. The skill auto-selects based on your prompt, or you can specify directly:

```bash
/second-claude-code:analyze porter "cloud infrastructure market"
/second-claude-code:analyze rice --input features.md
/second-claude-code:analyze lean-canvas "my startup idea"
```

</details>

<details>
<summary><strong>Architecture — 16 Pokemon agents across 3 model tiers</strong></summary>

| Phase | Pokemon | Role | Model |
|---|---|---|---|
| **Plan** | Eevee | Researcher — web search, data collection | haiku |
| | Noctowl | Search specialist | haiku |
| **Do** | Alakazam | Analyst — pattern recognition, synthesis | sonnet |
| | Mewtwo | Strategist — framework analysis | sonnet |
| | Smeargle | Writer — long-form content | opus |
| | Arceus | Master — general-purpose execution | sonnet |
| **Check** | Xatu | Deep reviewer — logic, structure | opus |
| | Absol | Devil's advocate — attacks weak points | sonnet |
| | Porygon | Fact checker — numbers, sources | haiku |
| | Jigglypuff | Tone guardian — voice, audience | haiku |
| | Unown | Structure analyst — readability | haiku |
| **Act** | Ditto | Editor — content refinement | opus |
| **Infra** | Machamp | Pipeline step executor | sonnet |
| | Magnezone | Skill candidate inspector | sonnet |
| | Deoxys | Skill candidate scorer | sonnet |
| | Abra | Knowledge connector | haiku |

Optional cross-model review via MMBridge (Kimi, Qwen, Gemini, Codex) — works without it.

![Agent Roster](docs/images/agent-roster.svg)

```
second-claude/
├── skills/     # 9 skills (SKILL.md + references/)
│   └── pdca/   # Orchestrator with Action Router + Question Protocol
├── agents/     # 16 Pokemon-themed subagents
├── commands/   # 9 slash command wrappers
├── hooks/      # Auto-routing + context injection
├── references/ # Design principles, consensus gate
├── templates/  # Output templates
├── scripts/    # Shell utilities
└── config/     # User configuration
```

[Full architecture docs →](docs/architecture.md)

</details>

<details>
<summary><strong>Design Philosophy</strong></summary>

Three principles that matter:

1. **Few but Deep** — 9 skills, not 80. Each one is internally rich with references, gotchas, and quality gates. Small surface area, infinite combinations through composition.

2. **PDCA-Native** — Every output cycles through Verify and Refine before shipping. The same cycle that produces content also improves the skills themselves. This is not a suggestion — it's enforced by quality gates.

3. **Action Router** — When review fails, the system doesn't blindly loop. It classifies the root cause: research gap → back to Plan. Missing section → back to Do. Polish issue → Loop. Not everything is a Loop problem.

Six more principles (context-efficient, zero-dependency, progressive disclosure, gotchas-first, state-in-files, composable) are documented in [docs/architecture.md](docs/architecture.md).

</details>

---

## Configuration

Copy `config/config.example.json` to your plugin data directory and customize:

```jsonc
{
  "defaults": {
    "research_depth": "medium",     // "shallow" | "medium" | "deep"
    "write_voice": "peer-mentor",   // writing tone
    "review_preset": "content",     // "content" | "strategy" | "code" | "quick" | "full"
    "loop_max_iterations": 3,       // max rounds before stopping
    "publish_target": "file"        // "file" | "notion"
  },
  "quality_gate": {
    "consensus_threshold": 0.67,    // fraction of reviewers that must pass
    "external_reviewers": []        // ["kimi", "qwen", "gemini", "codex"] via MMBridge
  }
}
```

All settings are optional — defaults apply when no config file exists.

---

## Known Limitations

- **Auto-routing false positives** — Ambiguous prompts can misfire ("save this file" → `collect`). Use explicit `/second-claude-code:*` commands when needed.
- **Haiku context limits** — Porygon, Jigglypuff, Unown may hit "Prompt is too long" with many plugins active. Disable unused plugins to reduce system prompt size.
- **Non-Claude platforms experimental** — OpenClaw, Codex, Gemini CLI support exists but isn't fully validated.
- **No streaming** — Subagent results arrive after completion. Long operations may appear silent until done.
- **Review output in English** — Reviewers produce English findings regardless of input language. Korean output planned.

---

## Compatibility

| Platform | Install | Status |
|---|---|---|
| **Claude Code** (primary) | `claude plugin add github:EungjePark/second-claude-code` | Tested |
| **OpenClaw** | Standard ACP protocol — auto-detected | Experimental |
| **Codex** | SKILL.md compatible | Experimental |
| **Gemini CLI** | SKILL.md compatible | Experimental |

---

## Contributing

Issues and pull requests welcome at [github.com/EungjePark/second-claude-code](https://github.com/EungjePark/second-claude-code).

Built by [Park Eungje](https://github.com/EungjePark). MIT License.

---

<details>
<summary><strong>Changelog</strong></summary>

### v0.3.0 — PDCA v2, Action Router, Pokemon agents (current)

- **PDCA v2 orchestrator** with Action Router — review failures route by root cause (Plan/Do/Loop), not blind iteration
- **Question Protocol** — PDCA asks clarifying questions before researching, unless `--no-questions` is set
- **16 Pokemon-themed subagents** across 3 model tiers (opus/sonnet/haiku)
- **5 parallel reviewers** with consensus gate and 5 presets (content/strategy/code/quick/full)
- **Hook-based auto-routing** — ~77 English + ~50 Korean trigger patterns
- **Auto-capture** — research, write, and analyze outputs auto-save to `.captures/`
- **19 routing tests** for false positive regression coverage

### v0.2.0 — Security hardening, English localization

- Security hardening across hooks and skills (13 audit findings resolved)
- English localization of all skill docs and README
- Marketplace manifest for `claude plugin add` install
- Skill hardening pass (9/10 target across all 8 domain skills; pdca promoted to 9th in v0.3.0)

### v0.1.0 — Initial release

- 8 domain skills + 1 orchestrator (research, write, analyze, review, loop, collect, pipeline, hunt)
- 15 strategic frameworks for `/analyze`
- PARA-based knowledge collection
- Pipeline builder for repeatable workflows

</details>
