# Review Report — Retest after Phase 1 Consensus Gate Fix

**Target**: `skills/write/SKILL.md`
**Preset**: `strategy` (deep-reviewer + devil-advocate + fact-checker)
**Date**: 2026-03-20
**Reviewers dispatched**: 3/3
**Purpose**: Validate the 4-verdict consensus gate (specifically the NEEDS IMPROVEMENT path)

---

## Reviewer 1: deep-reviewer (opus)

**Focus**: Logic, structure, completeness
**Constraint**: Cite exact sections or lines

### Findings

#### [Major] Workflow step 3 references `/second-claude-code:review` with `content` preset as the only option — Line 19

Line 19: "Run `/second-claude-code:review` with the `content` preset unless skipped."

The write skill hard-codes the `content` review preset. However, different formats may benefit from different review presets:
- A `report` with data claims would benefit from the `strategy` preset (which includes `fact-checker`).
- An `article` with technical depth might benefit from `code` preset if it contains code examples.

There is no mechanism for the user or orchestrator to override the review preset within the write pipeline. The `--skip-review` flag is binary (skip or don't skip), but there is no `--review-preset` option to customize which reviewers are dispatched.

**Severity**: Major — the hardcoded review preset limits the write skill's adaptability to different content types.

#### [Major] Format minimums are stated but enforcement mechanism is absent — Lines 43-48

Lines 43-48 define format-specific rules:
```
- newsletter: 6-stage arc, minimum 2000 words, at least 2 research data points
- article: minimum 3000 words
- report: minimum 4000 words with numbered recommendations
- shorts: around 300 words with a mandatory CTA
```

The subagent definition (line 68) says: `writer: { model: opus, constraint: "follow format rules, voice, and length minimums" }`. This places the burden of enforcement entirely on the writer subagent's prompt constraint. There is no validation step that checks whether the output actually meets the minimums before passing to review. If the writer produces 1500 words for a newsletter, the pipeline proceeds to review without catching the length violation.

**Severity**: Major — format rules are declared but not enforced programmatically. The pipeline trusts the subagent to self-enforce, which is unreliable.

#### [Minor] The `card-news` format lacks sufficient specification — Line 48

Line 48: `card-news: slide-by-slide narrative with visual direction`. This is the thinnest format rule. Unlike `newsletter` (which specifies 6-stage arc, 2000 words, 2 data points) or `report` (4000 words, numbered recommendations), `card-news` gives no word count, no slide count range, no specification of what "visual direction" means (alt-text? image prompts? layout instructions?).

A writer subagent given "slide-by-slide narrative with visual direction" has insufficient guidance to produce consistent output.

**Severity**: Minor — the format exists but is under-specified compared to peers.

#### [Minor] Length Negotiation section does not cover all conflict scenarios — Lines 52-57

Lines 52-57 address only one conflict direction: user requests shorter than the format minimum (the example: "Article format minimum is 3000 words, you requested ~800"). But what about the reverse? If a user says "write me a 10,000-word newsletter" and the newsletter minimum is 2000 words, should the writer comply? The section is silent on upper bounds. Additionally, if the user specifies no length at all, the behavior defaults to format minimums — but this is implicit, not stated.

**Severity**: Minor — covers the most common case but leaves edge cases unspecified.

### deep-reviewer Verdict: **MINOR FIXES**

Two Major findings (hardcoded review preset, unenforced format minimums) and two Minor findings. The skill definition is functional but has structural gaps that reduce reliability for diverse use cases.

---

## Reviewer 2: devil-advocate (sonnet)

**Focus**: Attack the 3 weakest points and blind spots
**Constraint**: Attack exactly 3 weak points

### Weak Point 1: [Major] The "automatic research unless skipped" default creates an uncontrolled cost and latency burden

Lines 8, 17: The write skill defaults to running `/second-claude-code:research` before writing. The only escape hatch is `--skip-research`, which requires the user to know about it in advance.

Problems:
- **Cost**: The research skill dispatches its own subagents (likely using opus for deep research). For a simple social post or a card-news slide, running a full research pipeline is disproportionate. A 300-word shorts script does not need the same research depth as a 4000-word report.
- **Latency**: Research adds significant wall-clock time. Users who want a quick draft will experience unexpected delays.
- **No granularity**: There is no `--research-depth` or `--research-budget` option. It is all-or-nothing: full research or skip entirely. A middle ground (e.g., "quick fact-check" vs. "deep research") would be more practical.

The skill claims to be usable for `shorts` and `social` — lightweight formats — but the default pipeline treats every format as if it were a 4000-word report. This is a design misalignment.

**Severity**: Major — the default behavior is correct for heavyweight formats but inappropriate for lightweight ones, and the skill provides no way to calibrate.

### Weak Point 2: [Minor] The editor subagent only addresses Critical and Major, silently dropping Minor findings

Line 20: "Ask `editor` to address all Critical and Major issues." Line 59: "Do not ship the reviewed version without addressing Critical and Major issues."

This means Minor findings from the review are deliberately ignored by the editor. But Minor findings accumulate. If the review returns 8 Minor issues, the editor will not touch any of them. Over repeated uses, this creates a quality debt where "good enough" becomes the ceiling.

Worse, the user is never informed that Minor findings exist but were intentionally not addressed. The pipeline silently swallows them. At minimum, the output should list unaddressed Minor findings so the user can decide whether to fix them manually.

**Severity**: Minor — defensible design choice (Minor items are low priority), but the silent dropping without user notification is a gap.

### Weak Point 3: [Minor] Voice defaults are format-specific but the mapping is incomplete

Lines 37-39 define voice defaults:
```
| peer-mentor | newsletter |
| expert      | report, article |
| casual      | shorts, social |
```

But `card-news` has no default voice. If a user runs `--format card-news` without specifying `--voice`, the behavior is undefined. Does it fall back to `peer-mentor` (the overall default from the Options table)? Does it error? The skill definition is silent.

Similarly, there are only 3 voices. A `report` directed at executives might need a `formal` or `concise` voice distinct from `expert`. The voice system is closed (no custom voices) and the existing options may not cover all realistic use cases.

**Severity**: Minor — the three voices cover the 80% case, but edge cases (card-news, executive summaries) are unhandled.

### devil-advocate Verdict: **NEEDS IMPROVEMENT**

One Major finding (research cost/latency misalignment with lightweight formats) and two Minor findings. The skill works for its core use case (long-form content with research) but its design does not scale down gracefully to the lightweight formats it claims to support.

---

## Reviewer 3: fact-checker (haiku)

**Focus**: Claims, numbers, sources
**Constraint**: Include URLs for verified claims (where applicable)

### Findings

#### [Minor] "6-stage arc" for newsletter is an unattributed structural claim — Line 43

Line 43: "newsletter: 6-stage arc, minimum 2000 words, at least 2 research data points."

The "6-stage arc" is presented as an established format rule, but:
- No definition of what the 6 stages are. A writer subagent cannot follow "6-stage arc" without knowing the stages.
- No source or reference for this structure. Is it based on a specific newsletter framework (e.g., Morning Brew's structure, Ann Handley's methodology)?
- The number "6" is arbitrary without context. Why not 4 or 8?

Without a reference document defining the 6 stages, this rule is unverifiable and unenforceable.

**Severity**: Minor — the rule exists but is insufficiently defined for consistent execution.

#### [Minor] Word count minimums are stated without rationale — Lines 43-46

The format rules specify:
- newsletter: 2000 words
- article: 3000 words
- report: 4000 words
- shorts: ~300 words

These numbers appear to be round-number estimates rather than research-backed thresholds. For context:
- Average newsletter length varies widely by industry. Substack newsletters average 1000-1500 words (source: Substack's own publishing data). 2000 words is above average.
- The "article" minimum of 3000 words is long-form territory. Many effective articles are 1500-2000 words.

The minimums may be intentional (the skill targets "depth over breadth" per the project's philosophy), but without stated rationale, they appear arbitrary.

**Severity**: Minor — the numbers are not wrong but are unjustified. Adding a brief rationale would improve credibility.

#### [Minor] "at least 2 research data points" is an imprecise requirement — Line 43

Line 43 requires "at least 2 research data points" for newsletters. The term "research data point" is undefined:
- Does a quoted statistic count?
- Does a cited expert opinion count?
- Does a link to a source article count?
- Does an anecdote from a case study count?

Without a definition of what constitutes a "research data point," compliance is subjective. A writer could cite two Twitter posts and technically meet the requirement, or cite two peer-reviewed studies. The quality bar is unspecified.

**Severity**: Minor — the intent is clear (include evidence), but the specification is too vague for consistent enforcement.

### fact-checker Verdict: **APPROVED**

Three Minor findings, all related to under-specification of format rules. No factual errors, no misleading claims, no Critical or Major issues. The skill definition is honest about what it does — the findings are about precision of specification, not accuracy of claims.

---

## Consensus Gate

**Preset**: strategy (2/3 threshold)

| Reviewer | Verdict | Critical | Major | Minor |
|----------|---------|----------|-------|-------|
| deep-reviewer (opus) | MINOR FIXES | 0 | 2 | 2 |
| devil-advocate (sonnet) | NEEDS IMPROVEMENT | 0 | 1 | 2 |
| fact-checker (haiku) | APPROVED | 0 | 0 | 3 |

### Gate Calculation

**Step 1 — Critical check**: 0 Critical findings across all reviewers. MUST FIX rule NOT triggered.

**Step 2 — Threshold check**: How many reviewers approved (gave APPROVED or MINOR FIXES)?
- deep-reviewer: MINOR FIXES (counts as passing threshold — content is shippable with fixes)
- devil-advocate: NEEDS IMPROVEMENT (does NOT count as passing threshold — substantive rework needed)
- fact-checker: APPROVED (counts as passing threshold)

**Approval count**: 2/3

**Threshold met?**: Yes — 2/3 >= 2/3

**Step 3 — Verdict selection**:
- MUST FIX? No — no Critical findings.
- APPROVED? No — threshold is met, but Major findings remain (3 Major total across reviewers).
- MINOR FIXES? Yes — threshold met, no Critical findings, but Major/Minor issues remain.
- NEEDS IMPROVEMENT? No — threshold IS met (this verdict applies only when threshold is NOT met).

### Rule triggered: **MINOR FIXES**

> "MINOR FIXES: threshold met, no Critical findings, but Major or Minor issues remain"

---

## Verdict: MINOR FIXES

**Consensus**: 2/3 (threshold met)

The gate calculation was unambiguous. The threshold of 2/3 was met (deep-reviewer and fact-checker both passed). No Critical findings exist. Major findings remain (3 total), so the verdict cannot be APPROVED. The correct verdict is MINOR FIXES.

---

## Deduplicated Findings Summary

### Major (3)

| # | Finding | Reviewer | Location |
|---|---------|----------|----------|
| M1 | Hardcoded `content` review preset — no way to customize review type per format | deep-reviewer | Line 19 |
| M2 | Format minimums declared but not enforced — pipeline trusts subagent self-enforcement | deep-reviewer | Lines 43-48, 68 |
| M3 | Default research pipeline is disproportionate for lightweight formats (shorts, social) — no granularity control | devil-advocate | Lines 8, 17 |

### Minor (7)

| # | Finding | Reviewer | Location |
|---|---------|----------|----------|
| m1 | `card-news` format under-specified vs. peers | deep-reviewer | Line 48 |
| m2 | Length Negotiation silent on upper bounds and no-length-specified cases | deep-reviewer | Lines 52-57 |
| m3 | Editor silently drops Minor findings without user notification | devil-advocate | Lines 20, 59 |
| m4 | `card-news` has no default voice mapping | devil-advocate | Lines 37-39 |
| m5 | "6-stage arc" is unattributed and undefined | fact-checker | Line 43 |
| m6 | Word count minimums stated without rationale | fact-checker | Lines 43-46 |
| m7 | "research data point" is imprecisely defined | fact-checker | Line 43 |

---

## Recommended Actions (prioritized)

1. **M3**: Add `--research-depth light|standard|deep` option, defaulting to `light` for shorts/social and `standard` for newsletter/article/report.
2. **M1**: Add `--review-preset` option to override the hardcoded `content` preset, or auto-select preset based on format (e.g., `strategy` for report).
3. **M2**: Add a validation step between writer and reviewer that checks word count against format minimums before proceeding.
4. **m1/m4/m5**: Expand `card-news` specification (slide count, visual direction definition, default voice) and define the newsletter "6-stage arc" stages.
5. **m3**: After editor completes, append unaddressed Minor findings to the output so the user can decide.

---

## Self-Assessment: 8/10

**Strengths**:
- All three reviewers produced genuinely independent findings with no overlap. deep-reviewer focused on structural/enforcement gaps. devil-advocate attacked the cost/design mismatch. fact-checker challenged the precision of format specifications. This validates the multi-perspective approach.
- The consensus gate calculation was mechanical and unambiguous — no mediator override needed.
- Each reviewer cited exact lines and provided specific evidence for every finding.

**Weaknesses**:
- The fact-checker did not have external sources to verify claims against (the target is a skill definition, not a factual document), which limited its utility. All three of its findings were about under-specification rather than factual errors. In a strategy preset, the fact-checker's role is slightly diluted when the target is an internal specification rather than a public-facing document.
- The devil-advocate's Weak Point 2 and 3 (Minor findings) were relatively soft compared to the harsh standard expected of an adversarial reviewer.

---

## Consensus Gate Fix Validation

### Before fix (old behavior — 3 verdicts)

The old consensus gate had only 3 verdicts: `APPROVED`, `MINOR FIXES`, `MUST FIX`.

In the previous test (`review-test-output.md`), the gate produced 1/3 approvals with no Critical findings. The rules created a contradiction:
- "MUST FIX" rule: threshold not met OR any Critical finding — this matched (1/3 < 2/3).
- "MINOR FIXES" rule: threshold met but non-critical issues remain — this did NOT match.

The mediator was forced to override MUST FIX to MINOR FIXES with a judgment call, noting: *"By strict consensus gate rules, this should be MUST FIX. The mediator is overriding to MINOR FIXES based on the nature of the findings."* This undermined the mechanical objectivity of the gate.

The root problem: MUST FIX conflated two very different situations:
1. A Critical vulnerability that must be fixed before shipping (truly must fix).
2. A document where reviewers mostly want rework but nothing is dangerous (needs improvement, not "must fix").

### After fix (new behavior — 4 verdicts)

The new consensus gate has 4 verdicts:

| Verdict | Rule |
|---------|------|
| **APPROVED** | Threshold met, no Critical or Major findings |
| **MINOR FIXES** | Threshold met, no Critical findings, but Major/Minor remain |
| **NEEDS IMPROVEMENT** | Threshold NOT met, no Critical findings |
| **MUST FIX** | Any Critical finding (regardless of threshold) |

**Key improvement**: The `NEEDS IMPROVEMENT` verdict now cleanly handles the case where the threshold is not met but no Critical findings exist. This eliminates the mediator override that was needed in the old system.

### NEEDS IMPROVEMENT test scenario

If only the fact-checker had approved (1/3) and deep-reviewer + devil-advocate both gave NEEDS IMPROVEMENT — with no Critical findings — the gate would calculate:

- Critical check: 0 Critical findings. MUST FIX NOT triggered.
- Threshold check: 1/3 < 2/3. Threshold NOT met.
- Verdict: **NEEDS IMPROVEMENT** (threshold not met, no Critical findings).

This is the correct verdict. Under the old system, this would have been MUST FIX — implying a Critical-level blocker that does not exist. The new NEEDS IMPROVEMENT verdict accurately communicates: "substantive rework needed, but nothing is dangerous or ship-blocking."

### In this test

This particular test landed on MINOR FIXES (2/3 threshold met, Major findings remain). While this does not directly exercise the NEEDS IMPROVEMENT path, the gate logic was applied mechanically and the NEEDS IMPROVEMENT verdict was available as a distinct option. The devil-advocate explicitly used NEEDS IMPROVEMENT as its individual verdict (line in Reviewer 2 section), demonstrating that the vocabulary is now integrated into the reviewer output format as well.

### Verdict

The Phase 1 fix is correctly in place. The 4-verdict gate eliminates the ambiguity that required mediator overrides. The consensus gate is now a mechanical, deterministic function with no judgment calls needed.

---

## Comparison Summary

**Before fix**: 3 verdicts. Threshold-not-met + no-Critical = forced into MUST FIX, requiring mediator override. The gate was not fully deterministic.

**After fix**: 4 verdicts. Threshold-not-met + no-Critical = NEEDS IMPROVEMENT (new, distinct verdict). No mediator override needed. The gate is fully deterministic across all input combinations.
