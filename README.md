[English](README.md) | [한국어](README.ko.md)

![version](https://img.shields.io/badge/version-0.5.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)

---

# Second Claude Code — Your Second Claude

You type *"Research AI agents and write a report."*

Thirty seconds later, Eevee is crawling the web. Alakazam finds patterns in what comes back. Smeargle drafts 3,000 words — and before you even see it, five reviewers are already tearing your draft apart. Xatu checks the logic. Absol attacks the weak points. Porygon fact-checks every number.

What just happened? **One prompt. Full cycle. No duct tape between plugins.**

![One prompt to finished output](docs/images/hero.svg)

Want to try it?

---

## Quick Start

**1. Install**

```bash
claude plugin add github:unclejobs-ai/second-claude-code
```

**2. Verify** — start a new session and look for this in the context injection:

```
# Second Claude Code — Your Second Claude
11 commands for all knowledge work:
```

Nothing? Run `claude plugin list` to check.

**3. Just talk**

I usually start with something like:

```
Research the current state of AI agent frameworks and write a report
```

The auto-router picks the right skill. No slash commands to memorize. Korean works too:

```
AI 에이전트 알아보고 보고서 써줘
```

So what's actually happening under the hood?

---

## The Problem This Solves

You've been using AI to write, research, and analyze. It's good at all of those things. I spent months doing exactly this — prompt, copy output, paste it into the next prompt, ask for feedback, manually apply it. It works. Sort of.

So what's the problem? Each plugin works alone. Research doesn't know about writing. Writing doesn't know about review. You're the integration layer — copying outputs, rephrasing prompts, doing five context switches for one piece of content.

Second Claude Code fixes that. It's not a toolkit. It's your second Claude — an autonomous collaborator that thinks in phases, catches its own mistakes, and won't ship anything it hasn't reviewed.

Here's what happens when you type a single prompt:

```
You: "Research AI agents and write a report"

[Plan]  Eevee + Noctowl crawl 20+ sources, Alakazam synthesizes
        ↓ gate: research brief must exist before writing starts
[Do]    Smeargle writes a full draft from the research
        ↓ gate: draft goes to review, not to you
[Check] 5 reviewers in parallel — logic, facts, tone, structure, weak points
        ↓ gate: 2/3 must pass. Any Critical finding = blocked.
[Act]   Action Router reads the feedback:
        → research gap? Back to Plan.
        → missing section? Back to Do.
        → polish issue? Ditto refines and re-submits.

You get the final draft. Reviewed. Fact-checked. Refined.
```

![PDCA Cycle](docs/images/pdca-cycle.svg)

---

## What's New in v0.5.0

Five things that changed how this actually works in practice:

**Soul System — memory that builds on itself.** Three modes: `manual` (you tell it what to remember), `learning` (it observes and infers), `hybrid` (both). After a few sessions, the system knows your preferred writing tone, the topics you return to, the feedback patterns you repeat. You stop re-explaining yourself.

**Batch Parallel Decomposition.** Some tasks are just too big for a single linear run. `batch` breaks them into independent units, runs them in parallel, and reassembles the results. A 10-part competitive analysis that would take 40 minutes serially finishes in 8.

**Event Sourcing + Analytics.** Every PDCA cycle is now event-logged — phase transitions, gate decisions, review scores, action routes. You can query your run history, see which phases fail most, and resume mid-cycle after a crash instead of starting over.

**Playwright Dynamic Web Research.** Eevee now navigates JavaScript-heavy pages, handles login-walled content, and executes dynamic interactions. Research on modern SaaS sites, dashboards, and SPAs works the way you'd expect.

**Channels Notifications.** Pikachu dispatches completion alerts to Slack, Telegram, or email. Start a long PDCA run, close your laptop, get a ping when it's done. 7 lifecycle hooks, 11 MCP tools powering the new state layer.

---

## Pick Your Skill

You don't need to think about phases or cycles. Just say what you want.

I use `write` when I have a topic and want a finished article by the end of the conversation. I use `review` when I already have a draft and want five opinions before publishing. For anything bigger — research *then* write *then* review — `pdca` handles the whole thing.

Which skill fits your next task?

| I want to... | Skill | What you get |
|---|---|---|
| Run the full research→write→review→improve cycle | `pdca` | A researched, reviewed, refined article — one prompt |
| Dig into a topic | `research` | 20+ sources crawled, patterns found, brief delivered |
| Apply 15 frameworks — SWOT, Porter, RICE, and more | `analyze` | Structured strategic analysis |
| Write an article, report, or newsletter | `write` | Research-backed, review-verified output |
| Get 3-5 perspectives on a draft | `review` | Parallel review with consensus voting |
| Refine a draft to a target score | `refine` | Iterative improvement until reviewers pass |
| Save a URL, note, or excerpt | `collect` | PARA-classified knowledge capture |
| Chain skills into a reusable workflow | `workflow` | Custom automation |
| Discover a skill you don't have | `discover` | Discover and install new skills |
| Let the system learn who you are | `soul` | Learns who you are across sessions |
| Break a large task into parallel units | `batch` | Decompose large tasks into parallel units |

Every skill responds to natural language. If you want precision, slash commands work too: `/second-claude-code:write`, `/second-claude-code:review`, `/second-claude-code:workflow`, `/second-claude-code:discover`, etc. I type in Korean half the time — the router handles both without any config. ~127 trigger patterns total.

```
"Research and write about AI agents"       →  pdca (full cycle)
"Write an article about vibe coding"       →  write
"SWOT으로 분석해"                           →  analyze
"Review this draft"                        →  review
```

The real magic isn't in routing — it's in what happens after your content is written.

---

## The Review System

Ever published something and found an obvious flaw ten minutes later?

Most AI writing tools generate and hand it to you. Second Claude Code generates, then **attacks its own output** before you see it. That's the difference.

`/second-claude-code:review` runs 3-5 specialized agents in parallel:

| Reviewer | Pokemon | Model | What they do |
|---|---|---|---|
| Deep Reviewer | Xatu | opus | Logic, completeness, argument flow |
| Devil's Advocate | Absol | sonnet | Finds the weakest point and hits it |
| Fact Checker | Porygon | haiku | Checks every number, claim, and source |
| Tone Guardian | Jigglypuff | haiku | Voice consistency, audience fit |
| Structure Analyst | Unown | haiku | Readability, organization |

Why Pokemon? Each name maps to a real trait. Xatu sees past and future — structural foresight. Absol senses disaster — vulnerability detection. Porygon is digital-native — data-driven fact checking. Memorable names mean you actually remember who does what.

**Consensus gate:** 2/3 pass = APPROVED. Any Critical finding = MUST FIX. No exceptions, even if you're in a hurry.

I run `full` before publishing anything externally. For internal drafts, `quick` is enough — Absol and Porygon catch the worst problems in under a minute.

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

`--external` adds cross-model review via MMBridge (Kimi, Qwen, Gemini, Codex). Requires separate setup.

</details>

---

## How It Thinks

Most AI tools are reactive — you prompt, they respond. Second Claude Code has opinions about quality, and it enforces them. Three ideas drive everything:

**Eleven skills, not eighty.** Each one is deep — references, gotchas, quality gates built in. You never wonder which of 80 skills to pick. Say what you want, and one of eleven handles it.

**Every output gets reviewed.** This isn't a suggestion. Quality gates block you from skipping review. You literally can't ship a draft that hasn't passed the consensus gate.

**Failures get routed, not retried.** When review finds problems, the Action Router classifies the root cause. Research gap? Back to Plan. Missing section? Back to Do. Polish issue? Refine. Not every problem is a refine problem — and treating them all the same wastes cycles.

Why does this matter in practice? Because the second pass through PDCA is dramatically better than the first. The Action Router makes sure each pass addresses the actual problem.

---

## Skill Composition

Skills call each other. That's where things get interesting.

| Pattern | What happens | Good for |
|---|---|---|
| Full PDCA | research → analyze → write → review → refine | Research a topic and publish a reviewed article |
| Quick Check | review → refine | Polish an existing draft |
| Plan Only | research → analyze | Understand a market before committing |
| Autopilot | `workflow run autopilot --topic "..."` | Set it, go get coffee, come back to a finished piece |

I use Full PDCA for anything external-facing. For internal notes, `write` alone is enough — it still runs research and review internally.

---

## Configuration

Second Claude Code works out of the box. But if you want to tune it — deeper research, different review presets, a custom writing voice — one JSON file covers it.

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

Every field is optional. Delete what you don't care about.

I set `refine_max_iterations` to 2 for quick tasks and 5 for anything going to a client. The default of 3 is a good middle ground.

---

## Design Decisions & Trade-offs

Every limitation here is a choice. Here's why:

- **Auto-routing handles ~95% of prompts correctly.** For edge cases, explicit `/second-claude-code:*` commands give you full control.
- **Haiku agents keep costs low** for high-volume tasks like fact-checking. The trade-off: with many plugins active, context limits can be tight. Disable unused plugins to keep headroom.
- **Claude Code is the primary platform,** fully tested. OpenClaw, Codex, and Gemini CLI work via standard protocols but are experimental.
- **Subagent results arrive after completion,** not incrementally. This is by design — streaming partial results would break the quality gate model.
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

If this plugin saved you time, a star on GitHub means a lot.

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

Each framework lives in `skills/analyze/references/frameworks/`. The skill auto-selects from your prompt, or you can pick one:

```bash
/second-claude-code:analyze porter "cloud infrastructure market"
/second-claude-code:analyze rice --input features.md
```

</details>

<details>
<summary><strong>Meet the Team — 17 agents across 3 model tiers</strong></summary>

Model distribution: 4 opus / 7 sonnet / 6 haiku

| Phase | Pokemon | Role | Model |
|---|---|---|---|
| **Plan** | Eevee | Researcher — web search, data collection | haiku |
| | Noctowl | Search specialist | haiku |
| | Alakazam | Analyst — pattern recognition, synthesis | sonnet |
| | Mewtwo | Strategist — framework analysis | sonnet |
| **Do** | Smeargle | Writer — long-form content | opus |
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
| | Pikachu | Notification dispatcher — channels & alerts | sonnet |

![Agent Roster](docs/images/agent-roster.svg)

[Full architecture docs →](docs/architecture.md)

</details>

<details>
<summary><strong>Changelog</strong></summary>

### v0.5.0 — Soul System, Batch Parallelism, Event Sourcing (current)

- **Dynamic Soul System** — 3-mode memory: manual / learning / hybrid. The system learns who you are across sessions and adapts its behavior accordingly
- **Batch Parallel Decomposition** — large tasks automatically split into parallel units and reassembled. `batch` skill handles the orchestration
- **Event Sourcing + Analytics** — every PDCA run is event-logged. Query your history, spot patterns, recover from crashes mid-cycle
- **Playwright Dynamic Web Research** — Eevee can now execute JavaScript-heavy pages, not just static HTML. Research depth improves significantly on modern sites
- **Channels Notifications** — Pikachu dispatches completion alerts to Slack, Telegram, or email when long tasks finish. Set it and walk away
- **7 lifecycle hooks** — pre/post hooks for each PDCA phase, plus crash recovery
- **11 MCP tools** — state management, analytics, and cross-session context via the PDCA MCP server
- **17 Pokemon-themed subagents** across 3 model tiers (4 opus / 7 sonnet / 6 haiku)
- **2 new skills**: `soul` and `batch`

### v0.3.0 — PDCA v2, Action Router, Pokemon agents

- **PDCA v2 orchestrator** with Action Router — review failures route by root cause, not blind iteration
- **Question Protocol** — PDCA asks clarifying questions before researching (`--no-questions` to skip)
- **16 Pokemon-themed subagents** across 3 model tiers (opus/sonnet/haiku)
- **5 parallel reviewers** with consensus gate and 5 presets
- **Hook-based auto-routing** — ~77 English + ~50 Korean trigger patterns
- **Auto-capture** — outputs auto-save to `.captures/`
- **19 routing tests** for false positive coverage

### v0.2.0 — Security hardening, English localization

- Security hardening across hooks and skills (13 audit findings resolved)
- English localization of all skill docs and README
- Marketplace manifest for `claude plugin add` install
- Skill hardening pass (9/10 target across all 8 domain skills; pdca promoted to 9th in v0.3.0)

### v0.1.0 — Initial release

- 8 domain skills + 1 orchestrator
- 15 strategic frameworks for `/analyze`
- PARA-based knowledge collection
- Pipeline builder for repeatable workflows

</details>
