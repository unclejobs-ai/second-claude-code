**English** | [한국어](notion-manual.ko.md)

# Second Claude Code — User Manual

> A practical guide for Fronmpt Academy students

---

## 1. What Is Second Claude Code?

Second Claude Code is a plugin for Claude Code. It handles the full cycle of knowledge work — research, writing, analysis, review, and revision — from a single prompt.

Here is the problem it addresses: when you use AI for a multi-step task like writing a market report, you typically research in one window, copy the results to another, write a draft, paste that draft into yet another conversation for feedback, then manually apply the feedback. Each step works, but the space between steps is manual labor — copy, paste, re-explain context, repeat.

Second Claude Code removes those handoffs. When a research step finishes, the results flow directly into the writing step. When the draft is complete, it goes to review automatically. When review finds issues, they get fixed without you copying feedback back and forth. The context carries through the entire chain.

| Without the plugin | With Second Claude Code |
|---|---|
| Research in ChatGPT, copy output, open new chat for writing, copy again for feedback | One prompt: "Research AI agents and write a report" — research through review in one flow |
| Write a draft, ask a colleague to review, wait a day | 5 specialized reviewers return feedback in under a minute |
| Find a SWOT template, fill each quadrant manually from separate searches | "Run a SWOT analysis on X" — the system picks from 15 built-in frameworks |
| Iterate on quality by prompting 3-4 times: "fix this", "also fix that", "now apply what I said earlier" | Set a target quality threshold and the system iterates until it passes or hits the attempt limit |

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
9 commands for all knowledge work:
```

If it does not appear, run `claude plugin list` to confirm the plugin is installed.

---

## 3. Use Cases

### Use Case 1: Market Research Report

**Situation:** You need a structured report on a market — size, key players, growth outlook — for a business review.

**Prompt:**

```
Research the current state of the AI education market.
Include market size, major players, and growth projections.
Write it as a structured report.
```

**What happens:** The system crawls 20+ sources, synthesizes a research brief, drafts a 3,000+ word report, and runs it through 5 reviewers before delivering the final output.

**Compared to doing it manually:** Research, writing, and verification would be three separate prompting sessions with copy-paste between each. Here it is one prompt.

---

### Use Case 2: Competitor SWOT Analysis

**Situation:** You have an investor meeting next week and need a competitive analysis.

**Prompt:**

```
Run a SWOT comparison of Coursera, Udemy, and Skillshare.
Include differentiation points for our service.
```

**What happens:** The `analyze` skill selects from 15 built-in strategic frameworks (SWOT, Porter's Five Forces, RICE, PESTLE, and others). If SWOT fits best, it uses SWOT. You can also specify a framework explicitly. The output is a structured strategic analysis, not a generic list.

**Compared to doing it manually:** Finding a template, researching each quadrant, formatting the comparison table — typically 30-60 minutes of work per competitor. Here, one prompt.

---

### Use Case 3: Newsletter or Blog Post

**Situation:** You have a topic for this week's newsletter and want a publication-ready draft.

**Prompt:**

```
Write a newsletter about "3 ways non-developers can use AI agents."
Target audience: working professionals interested in AI.
```

**What happens:** The system researches the topic, writes a draft in newsletter format (hook, 3-4 sections, actionable closing), and runs it through review for logic, tone, and factual accuracy. The output is 2,000+ words.

**Compared to doing it manually:** Research (30 min) + drafting (1 hour) + editing (30 min). A 2-hour task in a single prompt.

---

### Use Case 4: Quality Review of an Existing Draft

**Situation:** You have already written a proposal and want to check it for gaps before sending it out.

**Prompt:**

```
Review this proposal draft. Focus on logical gaps, missing evidence, and tone consistency.

[paste draft or specify file path]
```

**What happens:** Five specialized reviewers run in parallel, each covering a different quality dimension:

| Reviewer | Code Name | What It Checks |
|---|---|---|
| Deep Reviewer | Xatu | Logic flow, argument completeness, structural coherence |
| Devil's Advocate | Absol | Finds the weakest point in the draft and attacks it |
| Fact Checker | Porygon | Every number, claim, and cited source |
| Tone Guardian | Jigglypuff | Voice consistency and audience fit |
| Structure Analyst | Unown | Readability, document organization, section flow |

The consensus rule: at least 2 out of 3 reviewers must pass for the draft to be approved. If any reviewer flags a Critical-severity issue, the draft is blocked regardless of the vote count.

**Compared to doing it manually:** Asking a colleague for feedback means one perspective and at least a day of turnaround. Here you get five perspectives in under a minute.

---

### Use Case 5: Iterative Refinement to Target Quality

**Situation:** The review came back with issues. You want the system to fix them and re-submit until the draft passes.

**Prompt:**

```
Refine this draft until it passes review. Maximum 3 iterations.
```

**What happens:** The `refine` skill reads the review feedback, identifies the top 3 priority issues, applies fixes, and re-submits to review. This loop repeats until reviewers approve or the iteration limit is reached. If quality stops improving between iterations, the system stops early to avoid wasting tokens.

**Compared to doing it manually:** The cycle of "fix this" / "now fix that too" / "you forgot the earlier feedback" disappears. The system tracks all open issues across iterations.

---

### Use Case 6: Workflow Automation for Recurring Tasks

**Situation:** You write a weekly newsletter following the same pattern every time: research a topic, write a draft, review it, apply feedback. Running four separate commands each week is tedious.

**Prompt (one-time setup):**

```
Create a workflow called "weekly newsletter."
Step 1: Research the topic
Step 2: Write in newsletter format
Step 3: Review with the content preset
Step 4: Refine based on feedback
```

**Prompt (each week after that):**

```
Run the weekly newsletter workflow. This week's topic: "prompt engineering trends."
```

**What happens:** The saved workflow executes all four steps in sequence. You change the topic each week and reuse the same pipeline.

**Compared to doing it manually:** Four prompts in a specific order, every week, replaced by one.

---

### Use Case 7: Discovering New Skills

**Situation:** You want to know if there is a skill for email marketing copy, but you are not sure what is available.

**Prompt:**

```
Find a skill that helps with email marketing copy.
```

**What happens:** The `discover` skill first checks whether any of the existing built-in skills can handle your request. If none fit, it searches the external marketplace for candidates, scoring them on relevance, popularity, and safety. Installation requires your explicit approval — nothing gets added automatically.

**Compared to doing it manually:** Browsing a plugin marketplace, reading reviews, checking compatibility. The `discover` skill handles the search and evaluation.

---

## 4. The 9 Skills

You do not need to memorize skill names. Type your request in natural language and the auto-router selects the appropriate skill. Routing accuracy is approximately 95%. If you want explicit control, use slash commands like `/second-claude-code:write`.

| When you want to... | Skill | What it does |
|---|---|---|
| Dig deep into a topic | `research` | Crawls 20+ sources, finds patterns, produces a structured brief |
| Apply strategic frameworks | `analyze` | 15 built-in frameworks: SWOT, Porter, RICE, PESTLE, and more |
| Write an article, report, or newsletter | `write` | Research-backed draft with automatic review |
| Review a draft from multiple perspectives | `review` | 5 parallel reviewers with consensus voting |
| Improve a draft until it passes | `refine` | Iterative revision loop with automatic stopping |
| Save a URL, note, or excerpt | `collect` | PARA-based knowledge capture and classification |
| Chain multiple skills into a pipeline | `workflow` | Reusable multi-step automation |
| Find and install new capabilities | `discover` | Marketplace search with relevance and safety scoring |
| Run the full research-write-review-improve cycle | `pdca` | Plan-Do-Check-Act: the complete loop from one prompt |

Both English and Korean prompts work. The system has approximately 50 Korean trigger patterns and 77 English trigger patterns built in. You can mix languages freely.

---

## 5. How PDCA Works

PDCA stands for Plan-Do-Check-Act. It is the execution model that ties the skills together into a single automated loop.

```
You: "Research AI agents and write a report"

[Plan]  Research — crawl sources, find patterns, produce a brief
        Gate: the brief must exist before writing starts
[Do]    Write — produce a full draft grounded in the research
        Gate: the draft goes to review, not to you
[Check] Review — 5 specialized reviewers run in parallel
        Gate: 2/3 must pass. Any Critical finding blocks the output.
[Act]   Route — the Action Router reads review feedback:
        - Research gap? Back to Plan.
        - Missing section? Back to Do.
        - Polish issue? Refine and re-submit to Check.

You receive the final output after it has been reviewed and, if needed, revised.
```

The Action Router is the part that distinguishes this from a simple retry loop. When review identifies a problem, the router classifies the root cause and sends the work back to the correct phase. A research gap goes back to research, not to a generic rewrite. That classification is why the second pass produces meaningfully better output than the first.

---

## 6. Frequently Asked Questions

### What is Claude Code?

Claude Code is a terminal-based AI tool made by Anthropic. Unlike web-based chat interfaces, it runs in your terminal and can read and write files on your machine directly. Second Claude Code is a plugin that runs on top of Claude Code — it does not work on its own.

### Do I have to write prompts in English?

No. Both Korean and English are supported. The system recognizes approximately 50 Korean trigger patterns and 77 English trigger patterns. You can use either language or mix them in the same conversation.

### Does this cost money?

The Second Claude Code plugin itself is free and open source (MIT license). However, Claude Code usage incurs API costs as usual, and those costs apply here too. Because the plugin runs multiple sub-agents (researchers, writers, reviewers) for a single prompt, token usage can be higher than a single-turn conversation.

To reduce costs:
- Set `review_preset` to `quick` (uses 2 reviewers instead of 5)
- Set `research_depth` to `shallow` for lighter research passes

### Will this conflict with my other plugins?

Generally, no. The one thing to watch is context window usage: if you have many active plugins, the combined context injections can take up significant space. Deactivate plugins you are not using to free up room.

### Can it write long-form content?

Yes. The `write` skill targets 3,000+ words for articles, 4,000+ words for reports, and 2,000+ words for newsletters. Long-form writing is handled by a dedicated writer agent running on the opus model tier.

### Why are the reviewers named after Pokemon?

Each Pokemon was chosen because its traits map to the reviewer's role. Xatu sees past and future simultaneously — it catches structural flaws in argument flow. Absol senses disasters before they happen — it finds the weakest point in a draft. Porygon is a digital-native Pokemon — it handles data-driven fact-checking. The names are memorable, and memorable names make it easy to recall which reviewer does what when you are reading review results.

---

## 7. Further Reading

- **GitHub**: [github.com/unclejobs-ai/second-claude-code](https://github.com/unclejobs-ai/second-claude-code)
- **README (English)**: [README.md](https://github.com/unclejobs-ai/second-claude-code/blob/main/README.md)
- **README (Korean)**: [README.ko.md](https://github.com/unclejobs-ai/second-claude-code/blob/main/README.ko.md)
- **Questions**: Open an issue on GitHub or ask in the Fronmpt Academy community.

---

*Version 0.5.5 | MIT License*
