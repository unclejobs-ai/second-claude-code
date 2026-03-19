# Architecture Review: second-claude-code Plugin

**Reviewer**: Architecture Reviewer (Opus 4.6)
**Date**: 2026-03-20
**Scope**: All 8 SKILL.md files, consensus-gate.md, design-principles.md, prompt-detect.mjs
**Cross-referenced**: agents/*.md, commands/*.md, templates/*.json, config.example.json, session-start.mjs, para-method.md

---

## Executive Summary

The plugin architecture is well-designed: 8 skills with clear boundaries, a composable pipeline system, and a principled consensus gate. However, the review uncovered **3 Critical**, **7 High**, **6 Medium**, and **5 Low** findings across five review dimensions. The most urgent issues are: (1) a phantom `--query` flag referenced in the pipeline example that does not exist in the research skill, (2) contradictory storage paths between the collect skill and its reference document, and (3) severity label mismatch between the review skill and its agent definitions.

---

## Dimension 1: Skill Boundaries

### Findings

```
[Medium] skills/analyze/SKILL.md:devil-advocate — Analyze defines its own devil-advocate
subagent that duplicates the review skill's devil-advocate reviewer role. When a pipeline
runs analyze then review, the same adversarial pass happens twice with potentially
different model tiers (sonnet in analyze, sonnet in review — same here, but the framing
and output format differ).
— Fix: Document the intentional overlap explicitly in analyze's SKILL.md. Add a note
  that analyze's devil-advocate produces challenge output as part of the analysis artifact,
  while review's devil-advocate operates independently on the final deliverable. Consider
  adding a --skip-challenge flag mention in pipeline preset docs when review follows analyze.
```

```
[Low] skills/hunt/SKILL.md — Hunt's "When to Use" includes "a pipeline references a
missing capability" but no mechanism in pipeline/SKILL.md detects or reports missing
capabilities. The pipeline skill simply aborts on step failure.
— Fix: Add a note in pipeline's on_fail documentation that when a skill is not found,
  the error message should suggest running /scc:hunt. Or add a "skill not found" error
  handler to the orchestrator spec.
```

```
[Low] skills/collect/SKILL.md vs skills/research/SKILL.md — Research mentions "Output
cached per session to avoid redundant searches" (line 144) but no caching mechanism is
specified anywhere. Collect stores knowledge to disk but research has no formal cache
contract.
— Fix: Either remove the caching claim from research SKILL.md or specify the caching
  mechanism (e.g., write research briefs to a session-scoped temp directory and check
  before re-searching).
```

```
[Medium] skills/write/SKILL.md — Write only specifies writer and editor subagents,
but its workflow calls /scc:research (which has 3 subagents) and /scc:review (which
has 3-5 subagents). The effective subagent count for a single write invocation can
reach 10+. This is not documented and may surprise users expecting a lightweight
operation.
— Fix: Add a "Cost Profile" or "Effective Agents" section to write/SKILL.md noting
  that a full write invocation (without --skip-research/--skip-review) dispatches
  ~8-10 subagents across 3 skills.
```

---

## Dimension 2: Composition Contracts

### Findings

```
[Critical] skills/pipeline/SKILL.md:152 — The pipeline definition example uses a
"--query" flag for the research skill:
  "args": "--depth deep --sources web,news,academic --query \"{{topic}}\" --lang {{lang}}"
But the research skill's Options table defines no --query flag. The research skill
accepts --depth, --sources, and --lang only. This means the market-scan pipeline
example is broken as written — the --query flag would be silently ignored or cause
an error.
— Fix: Either (a) add a --query flag to research/SKILL.md's Options table, or
  (b) change the pipeline example to pass the topic as a positional argument or
  through the input_from mechanism. The same issue appears in the autopilot template
  which passes no topic at all — it needs {{topic}} injection too.
```

```
[High] templates/autopilot-pipeline.json — The autopilot preset does not use {{topic}}
or any variable placeholders in its step args. The research step has args "--depth medium"
with no topic. The pipeline/SKILL.md states autopilot accepts --topic, but the actual
template file has no {{topic}} placeholder to resolve. Running this preset with --topic
would silently ignore the topic.
— Fix: Update autopilot-pipeline.json to include {{topic}} in the research step args,
  e.g., "args": "--depth medium --topic \"{{topic}}\"". Also verify that --topic is a
  valid research skill flag (it is not currently listed in the research Options table).
```

```
[High] skills/write/SKILL.md + skills/pipeline/SKILL.md — Write's workflow step 1 says
"Run /scc:research unless source material is already provided" but there is no documented
mechanism for write to detect whether source material is "already provided." When called
from a pipeline with input_from, write receives a file path — but write/SKILL.md does not
document an --input or input_from parameter. The pipeline passes input_from at the
orchestrator level, but write itself has no spec for consuming piped input.
— Fix: Add an --input flag to write/SKILL.md, or document that when write is called from
  a pipeline with input_from, the orchestrator injects the file content as context and
  --skip-research is implied.
```

```
[High] skills/loop/SKILL.md — Loop's workflow says "Read the current file and record a
baseline hash" but the skill defines no --file or --input flag. When called from a
pipeline (e.g., autopilot), loop receives input_from: ["draft.md", "review-report.md"]
but loop/SKILL.md has no spec for multi-file input. The loop skill also does not document
how it knows which file is the draft to iterate on vs. the review report to use as
feedback.
— Fix: Add --file and --review flags to loop/SKILL.md's Options table. Document that
  when receiving multiple input_from files, the first is the draft and the second is
  the initial review report.
```

```
[Medium] skills/analyze/SKILL.md — Analyze's workflow says "load
skills/analyze/references/frameworks/{framework}.md" but the actual framework files
exist at that path for all 15 listed frameworks (verified via glob). However, analyze
also has --with-research which calls /scc:research, and the research output format
(Research Brief) differs from what strategist expects as input. No format adapter is
specified.
— Fix: Document that when --with-research is set, the research brief output is passed
  to the strategist subagent as supplementary context alongside the framework template.
  Clarify the expected input contract for the strategist.
```

---

## Dimension 3: Subagent Consistency

### Findings

```
[Critical] agents/deep-reviewer.md vs skills/review/SKILL.md — The deep-reviewer
agent definition uses severity labels "Critical / Warning / Suggestion" in its output
format template (lines 41-51), but the review skill's consensus gate and output format
use "Critical / Major / Minor" (review/SKILL.md lines 80-88). The severity calibration
table in review/SKILL.md explicitly defines Critical, Major, and Minor with concrete
criteria. If the deep-reviewer agent follows its own template, its "Warning" findings
will not map to the review skill's "Major" category, potentially breaking the consensus
gate logic.
— Fix: Update agents/deep-reviewer.md to use Critical / Major / Minor severity labels
  matching review/SKILL.md's Severity Calibration table. The mapping "Warning -> Major"
  and "Suggestion -> Minor" is obvious but should be explicit, not left to inference.
```

```
[High] agents/tone-guardian.md + agents/structure-analyst.md — Neither agent uses the
review skill's severity taxonomy (Critical/Major/Minor). The tone-guardian outputs
"Aligned / Mostly aligned / Misaligned" verdicts. The structure-analyst outputs
"Clear / Needs reordering / Needs significant restructuring." These verdict scales
do not map to the review skill's consensus gate which expects per-finding severity
ratings. The review skill's output format requires each finding to have a severity
(Critical/Major/Minor), but these agents produce findings without severity tags.
— Fix: Add a severity classification requirement to both agents' output format:
  each issue must be tagged Critical, Major, or Minor per the review skill's
  Severity Calibration table. The overall verdict can remain agent-specific for
  internal use, but individual findings need standardized severity for the
  consensus gate merge.
```

```
[High] agents/devil-advocate.md — The devil-advocate agent outputs "Overall Resilience:
Fragile / Defensible / Strong" but the review skill expects per-finding severity tags.
The agent finds exactly 3 weaknesses but does not classify them as Critical/Major/Minor.
The review skill's deduplication rules reference severity conflicts between reviewers
(line 68: "[deep-reviewer: Critical, tone-guardian: Major]") which requires all
reviewers to produce severity-tagged findings.
— Fix: Add severity tagging to devil-advocate's output format for each weakness,
  in addition to the overall resilience verdict. Each weakness should be classified
  as Critical, Major, or Minor.
```

```
[Medium] skills/research/SKILL.md — Research defines three subagents (researcher,
analyst, writer) but the agents/ directory has separate researcher.md, analyst.md,
and writer.md files. The research SKILL.md's "writer" subagent (line 28, synthesis
role) conflicts with agents/writer.md which is defined as "Professional Content Writer"
for long-form content. These are different roles sharing the same name. When the
research skill dispatches a "writer" subagent, it may pick up the wrong agent
definition.
— Fix: Rename the research skill's synthesis subagent to "synthesizer" to avoid
  name collision with the content writer agent used by the write skill.
```

```
[Low] skills/write/SKILL.md — Write specifies writer and editor both at opus tier.
For the write skill alone, that is 2 opus-tier subagents per invocation (the most
expensive tier). Combined with the opus deep-reviewer from review (called in step 3),
a single /scc:write call uses 3 opus subagents minimum. The design-principles.md
says nothing about cost budgets, but this may be unexpectedly expensive.
— Fix: Consider whether the write skill's writer subagent could use sonnet instead
  of opus. If opus quality is justified, add a cost warning to write/SKILL.md.
```

---

## Dimension 4: State Management

### Findings

```
[Critical] skills/collect/SKILL.md vs references/para-method.md vs
references/design-principles.md — Three different storage path conventions:
  - collect/SKILL.md (line 44): ${CLAUDE_PLUGIN_DATA}/knowledge/{category}/
  - para-method.md (line 44): $CLAUDE_PLUGIN_DATA/captures/
  - design-principles.md (line 35): $CLAUDE_PLUGIN_DATA/captures/
The collect skill uses "knowledge/" but both reference documents say "captures/".
The config.example.json also uses "knowledge/". This means either the skill
implementation or the reference documents are wrong. If both are consulted during
development, the storage path will be inconsistent.
— Fix: Align all three to a single canonical path. Recommended: update
  para-method.md and design-principles.md to use "knowledge/" (matching the
  skill and config), since "knowledge/" is more descriptive than "captures/" for
  PARA-organized content. Alternatively, pick one and update all references.
```

```
[High] skills/loop/SKILL.md + skills/pipeline/SKILL.md — Both skills save active
state to ${CLAUDE_PLUGIN_DATA}/state/ but with different file names:
  - loop: state/loop-active.json
  - pipeline: state/pipeline-active.json
This is fine for single concurrent operations, but there is no spec for what happens
when a pipeline runs a loop step. The pipeline's active state says "step 5 running"
while the loop's active state tracks its own iterations. If the session crashes
mid-loop-within-pipeline, session-start.mjs restores both states independently
(verified in session-start.mjs lines 47-72), but there is no documented relationship
between them. Resuming the pipeline would re-run step 5, which would start a new loop
ignoring any loop progress.
— Fix: Document the nested state relationship. When loop runs inside a pipeline,
  the loop state should include a pipeline_run_id field linking it to the parent
  pipeline. On pipeline resume, check if loop-active.json exists with a matching
  run_id before restarting the loop step.
```

```
[Medium] skills/pipeline/SKILL.md — Pipeline state uses "resolved_vars" to preserve
variables on resume (line 196), which is well-designed. However, the pipeline state
does not include per-step completion status. The "current_step" field (line 185) only
tracks position, not which steps succeeded. If step 2 of 5 fails and the pipeline
retries, it will re-run from step 2 — but there is no record of step 1's output
being valid. If step 1's output file was deleted between runs, the retry would fail
with a confusing "input file not found" error.
— Fix: Add a "completed_steps" array to the pipeline state schema that records
  each completed step's output file path and a hash. On resume, validate that
  prior step outputs still exist before continuing.
```

---

## Dimension 5: Hook Integration

### Findings

```
[High] hooks/prompt-detect.mjs — The hook uses first-match-wins routing (line 187:
"break" after first match). Route order matters: "review" patterns are checked before
"write" patterns. This means "review this draft" correctly routes to review, but
"write a review of competitor X" would route to review instead of write because
"review" appears in the input and is checked first.
— Fix: Add disambiguation logic. When multiple routes match, prefer the one with
  the strongest signal (e.g., keyword position — earlier in the sentence = more likely
  the intent). Alternatively, reorder routes so broader skills (write, research) come
  after narrower ones, and add negative patterns (e.g., "write" should not match if
  "review" is the main verb). A lightweight approach: check if the matching keyword
  appears as the first verb-like word in the sentence.
```

```
[Medium] hooks/prompt-detect.mjs:158 — The "collect" route includes the pattern "clip"
which may conflict with the user's CLAUDE.md clipboard workflow (clip command for
analyzing clipboard images). A user saying "clip" to analyze a screenshot would be
misrouted to the collect skill.
— Fix: Remove "clip" from the collect patterns, or add a disambiguation check:
  if "clip" appears alone (not as part of "clipping" or "clip this URL"), do not
  route to collect.
```

```
[Low] hooks/prompt-detect.mjs — The hook does not cover framework names for the
analyze skill comprehensively. It includes "swot", "rice", "okr", "prd", "lean canvas",
"porter", "pestle", "persona", "journey", "pricing" but is missing: "ansoff",
"battlecard", "value-prop", "north-star", "gtm". These 5 frameworks are listed in
analyze/SKILL.md but have no routing patterns.
— Fix: Add the missing framework names to the analyze route's patterns array:
  "ansoff", "battlecard", "value-prop", "value proposition", "north-star",
  "north star", "gtm", "go-to-market", "go to market".
```

```
[Low] hooks/prompt-detect.mjs — The hunt route matches on "how do i" and "how can i"
which are extremely generic patterns. A user asking "how do I format a table in
markdown" would route to hunt (skill discovery) when they likely want a direct answer.
— Fix: Add a qualifier: only route to hunt when "how do i" is followed by a
  skill-related word (e.g., "how do I [verb] with [noun]" where noun suggests a
  capability gap). Alternatively, make hunt the lowest-priority fallback route
  that only fires if no other route matched.
```

---

## Cross-Cutting Findings

```
[High] design-principles.md:20 — Principle 3 says "Keep SKILL.md under 120 lines"
but 5 of 8 skills exceed this limit:
  - analyze: 132 lines
  - collect: 131 lines
  - hunt: 150 lines
  - pipeline: 221 lines
  - research: 144 lines
Pipeline at 221 lines is nearly double the stated limit.
— Fix: Either raise the limit to 150 lines (acknowledging that pipeline and hunt
  need more space due to their complexity), or refactor the longer skills to move
  sections like Scoring Transparency (hunt), Variable Resolution (pipeline), and
  Data Conflict Resolution (research) into reference documents.
```

---

## Summary Table

| Severity | Count | Key Themes |
|----------|-------|------------|
| Critical | 3 | Phantom --query flag, severity label mismatch, storage path contradiction |
| High | 7 | Missing input contracts, agent severity taxonomy, route ambiguity, line limit violation |
| Medium | 6 | Subagent overlap, cost transparency, state nesting, missing framework routes |
| Low | 5 | Hunt routing false positives, research caching claim, missing pipeline error handler |

## Recommended Priority

1. **Immediate** (before next release): Fix the 3 Critical issues -- they cause runtime failures or data corruption.
2. **Next sprint**: Address the 7 High issues -- they cause subtle composition bugs and agent output mismatches.
3. **Backlog**: Medium and Low findings improve robustness but do not block functionality.
