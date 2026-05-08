**English** | [한국어](notion-manual.ko.md)

# Second Claude Code — User Manual

> A practical guide for getting started

---

## 1. What Is Second Claude Code?

Second Claude Code is a plugin for Claude Code. It handles the full cycle of knowledge work — research, writing, analysis, review, and revision — from a single prompt.

**TL;DR:** You type one request. The plugin breaks it into phases (research, write, review, improve), runs each phase with a specialized agent, and delivers a reviewed final output. No copy-paste between tools. No manual handoffs.

| Without the plugin | With Second Claude Code |
|---|---|
| Research in one window, copy output, open new chat for writing | One prompt handles research through review in one flow |
| Write a draft, wait a day for feedback | 5 specialized reviewers return feedback in under a minute |
| Find a SWOT template, fill each quadrant manually | "Run a SWOT analysis on X" — selects from 15 built-in frameworks |
| Iterate with "fix this" / "also fix that" / "you forgot earlier feedback" | Set a quality target — the system iterates until it passes |

---

## 2. Installation

### Prerequisites

Claude Code must already be installed. If you do not have it yet, follow the [Claude Code installation guide](https://docs.anthropic.com/en/docs/claude-code/overview).

### Install the Plugin

Open your terminal and run:

```bash
claude plugin add github:unclejobs-ai/second-claude-code
```

### Verify

Start a new Claude Code session. You should see this in the context injection:

```
# Second Claude Code
15 commands for all knowledge work:
```

If it does not appear, run `claude plugin list` to confirm the plugin is installed.

---

## 3. Use Cases

### Market Research Report

**Prompt:** `Research the current state of the AI education market. Include market size, major players, and growth projections. Write it as a structured report.`

The system crawls 20+ sources, synthesizes a research brief, drafts a 3,000+ word report, and runs it through 5 reviewers before delivering the final output. Research, writing, and review happen in one flow — no separate sessions.

### Competitor SWOT Analysis

**Prompt:** `Run a SWOT comparison of Coursera, Udemy, and Skillshare. Include differentiation points for our service.`

The `analyze` skill selects from 15 built-in strategic frameworks (SWOT, Porter's Five Forces, RICE, PESTLE, and more). One prompt replaces finding a template and filling each quadrant manually.

### Newsletter or Blog Post

**Prompt:** `Write a newsletter about "3 ways non-developers can use AI agents." Target audience: working professionals interested in AI.`

Research, drafting, and review happen automatically. The output is 2,000+ words in newsletter format (hook, 3-4 sections, actionable closing).

### Quality Review of an Existing Draft

**Prompt:** `Review this proposal draft. Focus on logical gaps, missing evidence, and tone consistency. [paste draft or specify file path]`

Five specialized reviewers run in parallel (see Section 6 for details). At least 2 out of 3 must pass. Any Critical-severity finding blocks the output. You get five perspectives in under a minute.

### Iterative Refinement

**Prompt:** `Refine this draft until it passes review. Maximum 3 iterations.`

The `refine` skill reads the review feedback, applies fixes, and re-submits. If quality stops improving between iterations, it stops early.

### Workflow Automation

**One-time setup:** `Create a workflow called "weekly newsletter." Step 1: Research. Step 2: Write. Step 3: Review. Step 4: Refine.`

**Each week:** `Run the weekly newsletter workflow. This week's topic: "prompt engineering trends."`

Four prompts in a specific order, every week, replaced by one.

---

## 4. The 15 Skills

You do not need to memorize skill names. Type your request in natural language and the auto-router selects the right skill. If you want explicit control, use slash commands like `/second-claude-code:write`.

Both English and Korean prompts work. The system has 100+ Korean trigger patterns and 100+ English trigger patterns built in. You can mix languages freely.

| Skill | What it does | When to use | Example prompt |
|---|---|---|---|
| `research` | Crawls 20+ sources, finds patterns, produces a structured brief | Digging deep into a topic | "Research the current state of AI regulation in the EU" |
| `analyze` | Applies strategic frameworks: SWOT, Porter, RICE, PESTLE, OKR, and more (15 built-in) | Structured strategic thinking | "Run a SWOT analysis on our product vs. competitors" |
| `write` | Produces research-backed drafts with automatic review | Articles, reports, newsletters, social content | "Write a newsletter about remote work productivity tips" |
| `review` | Runs 5 parallel reviewers with consensus voting | Checking a draft from multiple perspectives | "Review this proposal for logical gaps and tone" |
| `refine` | Iterative revision loop — fixes issues and re-submits until reviewers approve | Improving a draft until it passes | "Refine this draft until it passes review. Max 3 iterations" |
| `collect` | Captures URLs, notes, or excerpts into PARA-organized knowledge | Saving references for later use | "Save this link about transformer architectures" |
| `workflow` | Chains multiple skills into a reusable pipeline | Automating recurring multi-step tasks | "Create a workflow: research, write, review, refine" |
| `discover` | Searches the marketplace for new capabilities with safety scoring | Finding skills for tasks not covered | "Find a skill that helps with email marketing copy" |
| `pdca` | Orchestrates the full Plan-Do-Check-Act cycle from one prompt | End-to-end knowledge work in one shot | "Research AI agents and write a comprehensive report" |
| `investigate` | Root-cause debugging for errors and unexpected behavior | Something is broken and you need to know why | "Investigate why the API returns 500 on large payloads" |
| `translate` | EN-KO translation with style control (literal / natural / creative) | Translating content while preserving formatting | "Translate this article to Korean in a natural tone" |
| `batch` | Decomposes large tasks into independent parallel units | Processing many similar items at once | "Batch-analyze these 10 competitor landing pages" |
| `soul` | Observes your patterns and synthesizes a persistent identity profile | Adapting the system to your style over time | "Show my soul profile" or "Propose a soul evolution" |
| `viewer` | Opens a local web UI to view PDCA pipeline outputs as artifacts | Inspecting results from a completed pipeline | "Open the artifact viewer" |
| `loop` | Benchmarks and evolves prompt assets through optimization iterations | Systematically improving prompt quality | "Loop this prompt suite against the benchmark until score > 85" |

---

## 5. How PDCA Works

PDCA stands for **Plan, Do, Check, Act**. It is a quality cycle borrowed from manufacturing. The idea is simple: plan what to do, do it, check if it is good enough, then act on the feedback. This plugin uses PDCA to connect its skills into one automated pipeline.

![PDCA Cycle](images/pdca-cycle.svg)

### A concrete example

Say you type: **"Research AI agents and write a report."**

Here is what happens at each phase:

**Plan** — Eevee (the adaptive researcher) crawls sources and finds patterns. Alakazam (the strategist) structures the research into a brief. The gate: a research brief must exist before writing starts.

**Do** — Smeargle (the writer) produces a full draft grounded in the research. The gate: the draft goes to review, not to you.

**Check** — Five specialized reviewers run in parallel (see Section 6). The gate: at least 2 out of 3 must pass. Any Critical finding blocks the output.

**Act** — The Action Router reads the review feedback and decides what to do next:
- Research gap found? Route back to **Plan** (more research needed).
- Missing section? Route back to **Do** (more writing needed).
- Polish issue? Route to **Refine**, then re-submit to **Check**.
- Everything passed? Ditto (the adapter) formats and delivers the final output.

You receive the result only after it has been reviewed and, if needed, revised.

### Why this matters

The Action Router is what distinguishes PDCA from a simple retry loop. When review finds a problem, the router classifies the root cause and sends work back to the correct phase. A research gap goes back to research, not to a generic rewrite. That targeted re-routing is why the second pass produces meaningfully better output than the first.

---

## 6. The Reviewers (Pokemon Agents)

![Agent Roster](images/agent-roster.svg)

When a draft enters the **Check** phase, five specialized reviewers evaluate it in parallel. Each reviewer is named after a Pokemon whose traits match its role:

| Reviewer | Code Name | Why this Pokemon | What it checks |
|---|---|---|---|
| Deep Reviewer | **Xatu** | Xatu sees past and future simultaneously — it catches structural flaws | Logic flow, argument completeness, structural coherence |
| Devil's Advocate | **Absol** | Absol senses disasters before they happen — it finds weak spots | The weakest point in the draft, then attacks it |
| Fact Checker | **Porygon** | Porygon is a digital-native Pokemon — built for data processing | Every number, claim, and cited source |
| Tone Guardian | **Jigglypuff** | Jigglypuff's soothing voice requires perfect pitch — it catches tone shifts | Voice consistency and audience fit |
| Structure Analyst | **Unown** | Unown exists as letter forms — it understands document structure deeply | Readability, organization, section flow |

**Consensus rule:** At least 2 out of 3 reviewers must pass for the draft to be approved. If any reviewer flags a Critical-severity issue, the draft is blocked regardless of the vote count.

**Beyond the reviewers**, the full agent roster includes:
- **Eevee** (Plan) — Adaptive researcher that evolves its approach based on what it finds
- **Alakazam** (Plan) — Strategic structurer that organizes research into actionable briefs
- **Smeargle** (Do) — Dedicated writer running on the Opus model tier for long-form content
- **Ditto** (Act) — Universal adapter that formats and delivers the final output

---

## 7. Frequently Asked Questions

### What is Claude Code?

Claude Code is a terminal-based AI tool made by Anthropic. It runs in your terminal and can read and write files on your machine. Second Claude Code is a plugin that runs on top of it — it does not work on its own.

### Do I have to write prompts in English?

No. Both Korean and English are supported. You can use either language or mix them in the same conversation.

### Does this cost money?

The plugin itself is free and open source (MIT license). However, Claude Code API costs apply as usual. Because the plugin runs multiple sub-agents (researchers, writers, reviewers) per prompt, token usage is higher than a single-turn conversation.

To reduce costs:
- Set `review_preset` to `quick` (2 reviewers instead of 5)
- Set `research_depth` to `shallow` for lighter research passes

### Will this conflict with my other plugins?

Generally, no. Watch for context window usage: many active plugins with large context injections can take up space. Deactivate plugins you are not using to free up room.

### Can it write long-form content?

Yes. The `write` skill targets 3,000+ words for articles, 4,000+ words for reports, and 2,000+ words for newsletters. Long-form writing uses Smeargle, the dedicated writer agent running on the Opus model tier.

---

## 8. Further Reading

- **GitHub**: [github.com/unclejobs-ai/second-claude-code](https://github.com/unclejobs-ai/second-claude-code)
- **README (English)**: [README.md](https://github.com/unclejobs-ai/second-claude-code/blob/main/README.md)
- **README (Korean)**: [README.ko.md](https://github.com/unclejobs-ai/second-claude-code/blob/main/README.ko.md)
- **Questions**: Open an issue on GitHub or ask in the community.

---

*Version 1.4.2 | MIT License*
