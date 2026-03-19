# Usability Review: second-claude-code Plugin

**Reviewer**: Usability Reviewer (Opus 4.6)
**Date**: 2026-03-20
**Scope**: All 8 SKILL.md files, 8 EN docs, 8 KO docs, README.md, README.ko.md
**Perspective**: First-time user who just installed the plugin

---

## Executive Summary

The plugin is impressively well-documented for a v0.2.0 project. The "8 commands for all knowledge work" framing is immediately graspable, the README establishes a clear mental model, and the doc pages include real-world examples with actual output excerpts -- a rarity for plugin documentation. The Korean localization is thorough and reads naturally.

The most significant gaps are: (1) no guidance on what happens when things go wrong at the user level (error messages, recovery steps), (2) the progressive complexity ramp from Quick Example to advanced flags is inconsistent across skills, (3) several auto-routing patterns will produce false positives on common English words, and (4) the SKILL.md files and doc pages have subtle inconsistencies that could confuse a user who reads both.

**Finding count by severity**: 7 Critical, 14 Major, 12 Minor

---

## 1. First-Use Clarity

### README.md

```
[CRITICAL] README.md:Quick Start — install command not verifiable by user — add a verification step that actually confirms the plugin loaded (e.g., "Run `/second-claude-code:hunt` and expect a response listing your 8 local skills")
```

The verify step (step 2) tells the user to "look for the context injection" but shows a truncated snippet with `...`. A first-time user does not know what the full banner looks like, whether it appears at the top of the session, or what to do if it does not appear. The step needs a concrete, pass/fail verification action.

```
[MAJOR] README.md:Quick Start — "Try it" example uses natural language but the auto-router is hook-based, which requires the hook to be registered — add a note about what happens if auto-routing does not fire (e.g., "If auto-routing does not trigger, use the explicit command: /second-claude-code:research ...")
```

```
[MAJOR] README.md:Compatibility — "OpenClaw: auto-detected", "Codex: SKILL.md standard compatible", "Gemini CLI: SKILL.md standard compatible" — these claims lack any installation instructions or verification steps for non-Claude platforms — either add platform-specific Quick Start sections or explicitly mark them as untested/experimental
```

```
[MINOR] README.md:The 8 Commands — the write example uses `newsletter "The future of vibe coding"` but the command wrapper (commands/write.md) expects `<format> <topic>` as two separate arguments, creating ambiguity about whether the format is required or auto-detected — clarify in README example whether format is optional
```

### README.ko.md

```
[MINOR] README.ko.md:Quick Start — the verification banner shown in step 2 is in English ("# Second Claude Code -- Knowledge Work OS"), which may confuse a Korean user who expects Korean — either show the Korean banner variant or note that the banner is English-only
```

---

## 2. Example Quality

### Strong examples (positive findings)

The `docs/skills/` pages are the plugin's strongest usability asset. Every skill doc page follows the same template (Quick Example, Real-World Example with process steps, Output excerpt, Options, How It Works diagram, Gotchas, Works With). This consistency reduces cognitive load. The real-world examples include concrete numbers, source names, and iteration logs that make the output tangible.

### Issues

```
[CRITICAL] docs/skills/loop.md:Quick Example — `/second-claude-code:loop --target 4.5 --max 3` is shown without a file argument — the user has no idea what file will be improved — add the target file to the example (e.g., `--target 4.5 --max 3 draft.md`) or explain that it operates on the most recently discussed file
```

```
[MAJOR] docs/skills/pipeline.md:Quick Example — `/second-claude-code:pipeline create "weekly-report" research -> analyze -> write` uses arrow syntax that is never defined anywhere — the SKILL.md uses JSON definitions instead — clarify whether the arrow syntax is real shorthand or just illustrative pseudocode
```

The pipeline SKILL.md defines JSON step objects with `skill`, `args`, `output`, and `input_from` fields, but the doc page shows a natural language shorthand (`research -> analyze -> write`). A user who reads the doc page first will try the shorthand; a user who reads the SKILL.md first will try JSON. Neither document explains the relationship between these two input modes.

```
[MAJOR] docs/skills/hunt.md:Real-World Example — the output shows install commands like `claude install antonbabenko/terraform-skill` without pinned versions — but the SKILL.md explicitly requires version pinning — the doc example should match the SKILL.md behavior and show pinned versions (e.g., `claude install antonbabenko/terraform-skill@v1.2.0`)
```

```
[MAJOR] docs/skills/review.md:Real-World Example — output excerpt shows a table format (`| # | Finding | Reviewers | Severity |`) that differs from the SKILL.md's prescribed markdown format (`### Critical / ### Major / ### Minor` with bullet points) — align the doc example with the SKILL.md output spec
```

```
[MINOR] docs/skills/collect.md:Quick Example — `/second-claude-code:collect https://sdk.vercel.ai/docs` — the URL is a specific Vercel product page; a more universal example (e.g., a Wikipedia article or a widely known blog post) would be more relatable for first-time users who may not use Vercel
```

```
[MINOR] docs/skills/analyze.md:Quick Example — `Analyze second-claude vs superpowers using SWOT` — "superpowers" is an internal reference that means nothing to a new user — use a more universal example like `Analyze Slack vs Discord using SWOT`
```

---

## 3. Error Paths

This is the weakest dimension across the entire plugin documentation. None of the 8 skill doc pages describe what happens when things go wrong from the user's perspective.

```
[CRITICAL] All doc pages — no doc page explains user-facing error messages or recovery steps — for each skill, add a "Troubleshooting" or "Common Errors" section with at least 2-3 entries like: "Error: No WebSearch tool available → The research skill requires web search access. Ensure your Claude Code session has internet access enabled."
```

```
[CRITICAL] docs/skills/pipeline.md — no guidance on what happens when a pipeline step fails mid-run — the SKILL.md mentions `on_fail: abort|skip|retry` but the doc page never explains what the user sees when a step aborts, or how to resume a halted pipeline — add a "When Things Go Wrong" section with recovery steps
```

```
[MAJOR] docs/skills/loop.md — the skill uses `git checkout -- <file>` for revert, but there is no warning that the user's working directory must be a git repo with the file committed — a user working in a non-git directory or with uncommitted files will hit an unrecoverable error — add a prerequisite note
```

```
[MAJOR] docs/skills/research.md — no explanation of what happens when WebSearch is unavailable (e.g., in an offline environment or when the MCP tool is not configured) — the SKILL.md mentions "validate fetched content is readable" but the doc page says nothing about the no-internet case
```

```
[MAJOR] docs/skills/review.md — `--external` flag "silently ignored" if no CLI is detected — this is a usability anti-pattern; the user will not know whether external review ran or not — recommend the skill log a visible message like "External review skipped: no supported CLI found"
```

```
[MINOR] docs/skills/collect.md — no mention of what happens when the target URL returns a 404, 403, or timeout — add a note about fetch failure behavior
```

---

## 4. Progressive Complexity

### Good

The SKILL.md files follow a clear progression: short description > when to use > workflow > options > gotchas > subagents. The doc pages follow: Quick Example > Real-World Example > Options > How It Works > Gotchas > Works With. This layering supports progressive discovery.

### Issues

```
[MAJOR] skills/pipeline/SKILL.md — the pipeline skill is the most complex (variables, defaults, parallel groups, presets, resumption), but the doc page (docs/skills/pipeline.md) covers only basic sequential usage — the doc page mentions "No runtime variables" as a gotcha while the SKILL.md extensively documents `{{variable}}` syntax, `--var key=value`, built-in variables, and resolution rules — the doc page is significantly out of sync with the SKILL.md
```

This is the most severe SKILL.md-vs-doc divergence in the entire plugin. The SKILL.md describes `{{topic}}`, `{{date}}`, `{{output_dir}}`, `{{run_id}}`, custom variables, default declarations, and resolution rules. The doc page says "Static args do not support runtime variables yet." A user reading the doc page will not discover the variable system at all. A user reading the SKILL.md will expect it to work but find no user-facing examples of how to use variables.

```
[MAJOR] docs/skills/pipeline.md:Presets — only lists `autopilot` preset — the SKILL.md lists 3 presets (autopilot, quick-draft, quality-gate) — add the missing presets to the doc page
```

```
[MINOR] docs/skills/analyze.md — the depth levels are `quick|standard|thorough` in the options table, but the SKILL.md also mentions these map to depth 1/2/3 and that `deep` maps to `--depth thorough` — this mapping is useful for advanced users and should appear in the doc page
```

```
[MINOR] docs/skills/review.md — the `--threshold` option accepts a number but neither the doc page nor the SKILL.md explains what valid range is or how it interacts with reviewer counts — add an example like `--threshold 0.5` with explanation
```

---

## 5. Korean UX

### Strong

The Korean docs are not machine-translated. They read like they were written by a native Korean developer. Key observations:

- Technical terms use the standard Korean developer lexicon (e.g., "서브에이전트", "디스패치", "프리셋", "컨텍스트", "인라인").
- Korean-specific natural language examples are provided separately (e.g., "이 아티클을 4.5/5로 올려" for loop, "우리 SaaS 제품을 SWOT 분석해" for analyze).
- The auto-routing triggers use natural Korean verb endings ("조사해", "써줘", "분석해", "리뷰해") that match how Korean developers actually talk to AI tools.

### Issues

```
[MINOR] README.ko.md:Auto-routing — the Korean trigger table lists `수집` and `수집해` as separate entries for collect — `수집해` already contains `수집`, so the shorter form will always match first via substring — this is not wrong but may confuse a user reading the table who expects them to be distinct
```

```
[MINOR] docs/skills/loop.ko.md — "수확 체감은 정상입니다" translates to "diminishing harvest is normal" — the more standard Korean economics term would be "수확체감(체감)의 법칙" or simply "개선 폭 감소는 정상입니다" (reduction in improvement magnitude is normal) for better readability — current phrasing is understandable but slightly unusual
```

```
[MINOR] docs/skills/*.ko.md — Mermaid diagram labels remain in English across all Korean doc pages (e.g., "User Query", "Raw Findings", "Completion gate") — while Korean developers generally read English technical labels, consider localizing at least the high-level node labels for consistency with the surrounding Korean prose
```

```
[MINOR] docs/skills/pipeline.ko.md — "정적 인자는 아직 런타임 변수를 지원하지 않습니다" (Static args do not support runtime variables yet) — this contradicts the SKILL.md which extensively documents variable support — the Korean doc inherited the English doc's stale information
```

---

## 6. Discoverability

### Auto-routing

```
[CRITICAL] hooks/prompt-detect.mjs — the pattern "search" routes to research, but "search" is an extremely common English word that will false-positive on unrelated queries like "search for a file", "search this codebase", or "search and replace" — narrow the pattern to "search for information", "search about", or "research" only
```

```
[CRITICAL] hooks/prompt-detect.mjs — "check" routes to review, "save" routes to collect, "tool" routes to hunt, "better" routes to loop — these are all extremely common English words that will false-positive on routine coding tasks — "check if this compiles", "save this file", "which tool should I use", "make this variable name better" — add word-boundary or context constraints, or require two matching patterns before routing
```

```
[MAJOR] hooks/prompt-detect.mjs — route order matters (first match wins), but there is no disambiguation when a prompt matches multiple skills — "write a research article" matches both research ("research") and write ("write", "article") — currently research wins because it is first, but the user likely wants write — add a multi-match disambiguation strategy or prioritize by strongest signal
```

```
[MINOR] README.md:Auto-Routing — claims "~40 English and ~35 Korean trigger patterns" but the actual prompt-detect.mjs contains approximately 25 English patterns and 28 Korean patterns — update the counts or clarify that additional patterns exist elsewhere
```

### Skill discovery within the plugin

```
[MAJOR] README.md — no "Which skill should I use?" decision tree or flowchart — the 8-command table is organized by category (Discover/Create/Quality/Manage) which helps, but a user with a specific task ("I have a draft and want to make it better") needs a task-oriented guide — add a "Choose Your Skill" section with 5-6 common task descriptions mapped to the right skill
```

---

## 7. Cross-Document Consistency

```
[CRITICAL] skills/pipeline/SKILL.md vs docs/skills/pipeline.md — the SKILL.md documents 3 presets (autopilot, quick-draft, quality-gate), extensive variable system ({{topic}}, {{date}}, custom vars, defaults), and `show`/`delete` subcommands — the doc page only shows autopilot, says "no runtime variables", and does not mention show/delete — this is the most severe content divergence in the project
```

```
[MAJOR] skills/hunt/SKILL.md vs docs/skills/hunt.md — the SKILL.md requires full score breakdown tables with rationale for every candidate (Scoring Transparency section) — the doc example only shows a simple table without the weighted breakdown — align the example output
```

```
[MAJOR] skills/review/SKILL.md — defines `NEEDS IMPROVEMENT` as a verdict ("threshold not met but no Critical findings") — the README.md omits this verdict entirely, showing only APPROVED, MINOR FIXES, and MUST FIX — add NEEDS IMPROVEMENT to the README
```

```
[MINOR] config/config.example.json — version is "0.1.0" while the plugin is at v0.2.0 — update config version to match
```

```
[MINOR] skills/write/SKILL.md — default language is `ko` — this is fine for a Korean-authored plugin, but neither the README nor the doc page mentions this default, which will surprise English-speaking users who get Korean output unexpectedly — document the default language prominently
```

---

## Summary Table

| Dimension | Score (1-5) | Key Gap |
|-----------|-------------|---------|
| First-use clarity | 3.5 | Verification step is not actionable; compatibility claims unsubstantiated |
| Example quality | 4.0 | Real-world examples are excellent; some SKILL.md/doc mismatches |
| Error paths | 1.5 | Almost no error documentation anywhere |
| Progressive complexity | 3.0 | Pipeline doc is severely out of sync; others are decent |
| Korean UX | 4.5 | Natural and thorough; minor Mermaid label and terminology issues |
| Discoverability | 3.0 | Auto-router has false-positive risk; no task-oriented decision tree |

---

## Top 5 Recommended Actions (Priority Order)

1. **Add error/troubleshooting sections to all 8 doc pages.** This is the largest gap. Each doc needs 2-3 common failure scenarios with user-facing error text and recovery steps.

2. **Sync pipeline doc page with SKILL.md.** The variable system, 2 missing presets, and `show`/`delete` subcommands need to be documented in the user-facing doc page. Remove the "no runtime variables" gotcha.

3. **Tighten auto-routing patterns.** Replace single common words ("search", "check", "save", "tool", "better") with multi-word phrases or require 2+ pattern matches before routing. Add disambiguation for multi-skill matches.

4. **Add a "Choose Your Skill" decision tree to README.** Map 5-6 common user tasks to the right skill entry point. This is more useful than category-based organization for first-time users.

5. **Align doc examples with SKILL.md specs.** Hunt output needs pinned versions. Review output format needs to match the prescribed markdown structure. Pipeline arrow syntax needs to be explained or removed.
