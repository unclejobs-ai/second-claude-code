# Release Notes — v1.3.0

**Date**: 2026-04-07
**Theme**: PDCA Hard Gates — length floors, reviewer diversity, and the calibrated 5+ Rule

v1.3.0 hardens the PDCA orchestrator with measurable, contract-enforced gates at every phase boundary. The previous version had structural support for Plan→Do→Check→Act but the gates were soft, allowing self-processing fallbacks and sparse output to pass through. v1.3.0 closes those holes with nine specific strengthenings, all verified against a real end-to-end run.

The motivating failure mode: a user invokes PDCA on a content task, the orchestrator interprets the abstract phases as a license to self-process, skips the specialized sub-skill that should have run inside Do, skips reviewer diversity in Check, and produces a 1,500-character "complete" artifact. v1.3.0 makes that path structurally impossible.

---

## 1. PDCA Is the Main Orchestrator (Architecture Clarification)

The architecture documentation now explicitly states that PDCA is the main orchestrator and sub-skills (`/threads`, `/newsletter`, `/academy-shorts`, `/card-news`, `/scc:write`) are building blocks called inside its phases. Sub-skills do not replace PDCA — their internal multi-phase pipelines run inside PDCA's Do phase, gated by the sub-skill's own contracts and wrapped by PDCA's Plan + Check + Act for upstream rigor and downstream validation.

```
PDCA Cycle (always running)
  ├── Plan  → /scc:research + /scc:analyze
  ├── Do    → most specialized sub-skill matched (greedy)
  │           ├── /threads (its 8 internal phases run here)
  │           ├── /newsletter (its 7 internal phases run here)
  │           ├── /academy-shorts (its multi-phase pipeline runs here)
  │           ├── /card-news (template + render)
  │           └── /scc:write (generic fallback)
  ├── Check → /scc:review (parallel diverse reviewers, runs even after sub-skill internal review)
  └── Act   → Action Router or 5+ Rule → Plan/Do/Refine routing
```

PDCA's Check is **not redundant** with the sub-skill's internal review — they catch different things. The sub-skill's internal review focuses on domain-specific issues (voice-guide violations, format compliance). PDCA's Check looks at the result from outside the domain pipeline and surfaces what the domain pipeline cannot see itself.

---

## 2. Domain Auto-Routing (Greedy Sub-Skill Selection)

The Do phase now matches user prompts against domain trigger keywords and dispatches the most specialized sub-skill:

| Trigger keywords | Sub-skill dispatched |
|------------------|---------------------|
| "스레드", "threads", "@unclejobs.ai" | `/threads` (8-phase Korean threads pipeline) |
| "뉴스레터", "newsletter", "주간 뉴스레터" | `/newsletter` (7-phase Korean tech newsletter pipeline) |
| "쇼츠", "shorts", "릴스", "Reels", "9:16", "60초 영상" | `/academy-shorts` |
| "카드뉴스", "card news", "인스타 카드", "캐러셀" | `/card-news` |
| (no specialized match) | `/scc:write` (generic fallback) |

Greedy matching is the rule: pick the most specialized sub-skill that fits, never the generic one when a specialized one exists. A threads article must go through `/threads`, never `/scc:write`, because `/threads` has voice-guide enforcement, cross-review with external models, and a Notion publish step that `/scc:write` does not.

The full algorithm and selection precedence is documented in the new `references/domain-pipeline-integration.md` file.

---

## 3. Hard Length Floors per Format

The Do phase now fails the gate if the artifact is below a format-specific minimum character count and section count. Below the floor, the artifact does not reach the reviewer — the writer is re-dispatched with explicit expansion instructions.

### Length Floors Table (excerpt — see `references/do-phase.md` for the full table)

| Format | Min chars (body) | Target | Min sections |
|--------|-----------------|--------|--------------|
| Threads article (@unclejobs.ai) | 4,000 | 5,000-7,000 | 6 |
| Korean tech newsletter | 10,000 | 12,000-15,000 | 6 topics |
| Generic article | 4,000 | 5,000-7,000 | 5 H2 |
| Strategy/analysis report | 5,000 | 6,000-9,000 | 6 sections |
| SWOT/RICE/OKR | 3,000 | 4,000-5,000 | 4 quadrants |
| Shorts script (60-90s) | 1,800 | 2,200-2,800 | 12 scenes |
| Card news (carousel) | 8-10 cards | 9-12 cards | hook + body + CTA |
| PRD | 4,000 | 5,000-7,000 | 7 sections |
| Code review report | 2,500 | 3,500-5,000 | 5 dimensions |
| Research brief | 3,000 | 4,000-6,000 | (count by facts/sources) |
| Meeting notes | 2,000 | 2,500-3,500 | 5 sections |

### Calibration Principles

Floors are not arbitrary. They are calibrated against three benchmarks:

1. **Reader value floor** — the minimum length at which the format delivers a complete idea, not a teaser
2. **Source utilization floor** — every fact gathered in Plan should appear in the Do output
3. **AI hedge prevention** — language models tend to under-write under vague length guidance; numeric floors force substance commitment

When the writer is re-dispatched after a floor failure, the orchestrator passes a specific scope direction (which Plan findings to expand, what new sub-section to add) rather than a vague "make it longer" prompt. Generic prompts produce filler; specific prompts produce substance.

---

## 4. Plan Brief Floors

The Plan phase gate also gained measurable contracts. Source minimum was raised from 3 to 5, and several new fields are now mandatory:

| Field | Minimum | Notes |
|-------|---------|-------|
| Brief char count (body) | 3,000 | Below = thin Plan → thin Do failure chain |
| Distinct sources | 5 (was 3) | Different publishers, different authors |
| Discrete facts (with date/number/name) | 8 | Each must be specific, not generic |
| Direct named-source quotes | 1 | No anonymous "experts say" |
| Comparison tables (for content briefs) | 1 | Structured table with 3+ rows |
| Acknowledged gaps | 1 | Honest about unknowns |
| Media inventory (for content output) | 1 | Image/screenshot/diagram downloaded or URL verified |

Brief char count is set higher than the Do output floor in some cases because the brief is a **superset** of what ends up in the Do output — the writer should have material to select from, not pad with.

---

## 5. Reviewer Model Diversity Rule

PDCA's Check phase now enforces reviewer model diversity to prevent false consensus:

| Requirement | Threshold | Why |
|-------------|-----------|-----|
| Minimum reviewer count | 2 (3 for `--depth deep`) | Single-reviewer = no consensus check |
| Maximum same-model reviewers | 1 per model | Two reviewers on the same model produce correlated errors |
| External model required | At least 1 for `content`/`strategy`/`full` presets | Internal model perspective alone misses what external models catch |
| Diversity score | ≥ 0.6 (for >2 reviewers) | `distinct_models / total_reviewers` |

Approved external models: Codex GPT-5.4, Kimi K2.5, Qwen, Gemini, Droid (via mmbridge or dedicated reviewer agents).

### False Consensus Detection

When all reviewers return APPROVED with average score >0.9 and no critical findings, the cycle does NOT exit. Instead, an adversarial pass with an unused external model is automatically dispatched. Catches the Goodhart-style "everyone said it's fine" failure mode.

---

## 6. 5+ Rule (Calibrated AND Logic)

The Action Router now checks the 5+ Rule before plurality routing. The 5+ Rule fires a full rewrite (instead of patching) when finding density crosses a threshold.

### Rule Definition

Three trigger conditions, any one fires the rule:

1. **Hard credibility trigger**: any `P0_count ≥ 1` (single credibility-killer forces rewrite)
2. **Volume + spread trigger** (BOTH required):
   - `P0_count + P1_count ≥ 5` total findings, AND
   - Findings span ≥ 3 distinct quality categories
3. (Otherwise) no rule fire — normal Action Router routing

### Calibration

The initial release used OR logic for the volume+spread condition. In testing on a real verification cycle, this over-triggered on a 4-finding patch set spanning 3 categories — clearly surgical patch territory but flagged as full rewrite. The fix: switch to AND for the volume+spread condition. The hard credibility trigger (any P0) is preserved separately because credibility damage compounds even when surface fixes look small.

Calibration verification: 6/6 finding configurations route correctly under the new AND logic, vs 3/6 under the original OR logic.

---

## 7. Sub-Skill Input/Output Contracts (New Reference File)

A new 284-line reference file `references/domain-pipeline-integration.md` standardizes how PDCA's Do dispatcher invokes sub-skills. It defines:

- **Selection algorithm**: greedy specialized → generic fallback
- **Input contract**: every sub-skill receives the same structured input (`research_brief_path`, `analysis_path`, `dod`, `constraints`, `format_target`, `length_floor`, `section_floor`, `skip_research: true`, `skip_review: true`, `worktree`)
- **Output contract**: every sub-skill returns the same `DoOutput` schema, verified independently by PDCA (PDCA does not trust sub-skill self-reports)
- **Failure handling**: 4 failure modes (errors, below-floor output, malformed output, hangs/timeouts) with explicit fallback chains
- **Integration points**: how each sub-skill (`/threads`, `/newsletter`, `/academy-shorts`, `/card-news`) maps its internal phases to PDCA's Do phase

This file is now the authoritative reference for sub-skill integration. SKILL.md links to it.

---

## 8. Pokemon Role Label Clarification

The Subagents block in `skills/pdca/SKILL.md` previously listed conceptual roles using Pokemon names (Eevee, Smeargle, Xatu, Absol, etc.). These were not actual `subagent_type` values, but the format suggested they were dispatchable. Past failure mode: orchestrators tried to call `Agent(subagent_type: "eevee")` which silently failed, and the orchestrator then fell back to self-processing.

Fixed: the Subagents block is now explicitly labeled "Conceptual Roles, Not Direct Dispatch Targets" with a note that real dispatch happens inside `/scc:research`, `/scc:write`, `/scc:review`, `/scc:refine`. The orchestrator is reminded to never bypass the chained-skill layer.

---

## 9. Expanded Phase Output Schemas

`references/phase-schemas.md` now includes measurable verification fields for all three phases:

### PlanOutput additions
- `brief_char_count`, `facts_count`, `quotes_count`, `comparison_tables_count`, `media_inventory_count`, `meets_brief_floor`

### DoOutput additions
- `char_count` (body only), `section_count`, `meets_length_floor`, `meets_section_floor`, `references_count`

### CheckOutput additions
- `distinct_models_count`, `external_model_count`, `diversity_score`, `false_consensus_check_passed`, `p0_count`, `p1_count`, `p2_count`
- `reviewers[].model` (specific model identifier), `reviewers[].is_external`

PDCA verifies all of these independently. Sub-skills cannot game gates by reporting inflated numbers.

---

## Verification Run (2026-04-07)

A real PDCA cycle was executed on a generic topic ("MCP 프로토콜 출시 1년 회고") with no domain trigger to test all gates end-to-end.

### Phase Outputs

| Phase | Output File | Floor | Actual | Pass |
|-------|-------------|-------|--------|------|
| Plan brief | `research-brief.md` | 3,000 chars | 7,981 | ✓ |
| Plan facts | — | 8 | 14 | ✓ |
| Plan sources | — | 5 | 12 | ✓ |
| Plan quotes | — | 1 | 2 | ✓ |
| Plan comparison tables | — | 1 | 2 | ✓ |
| Do article (initial, before Act patches) | `article.md` | 4,000 chars | 6,673 | ✓ |
| Do H2 sections | — | 5 | 7 | ✓ |
| Do references | — | 3 | 10 | ✓ |
| Check reviewers | — | 2 | 2 (sonnet + Codex) | ✓ |
| Check external models | — | 1 | 1 (Codex) | ✓ |
| Check diversity score | — | 0.6 | 1.0 | ✓ |
| Check verdict | — | — | MINOR FIXES (avg 0.885) | — |

### Findings + 5+ Rule Behavior

The Check phase consensus was MINOR FIXES with 4 deduped P1 findings spanning 3 categories (factual, completeness, framing). The initial 5+ Rule OR logic incorrectly fired full rewrite on this 4-finding patch set. This was caught during the verification run and the rule was immediately calibrated to AND logic in the same release. Re-run with the calibrated rule correctly routed to a surgical Do refinement that addressed all 4 P1s in a single pass.

### v1.0.0 → v1.3.0 Improvement

| Metric | v1.0.0 baseline | v1.3.0 actual | Improvement |
|--------|----------------|---------------|-------------|
| Plan brief char count | 0 (no brief) | 7,981 | +∞ |
| Plan facts catalogued | 0 | 14 | +14 |
| Plan sources | 0 | 12 | +12 |
| Do article char count | ~1,500 (self-processed) | 6,962 (after patches) | +364% |
| Do H2 sections | 1-2 | 7 | +250% |
| Do references | 0-3 | 10 | +233% |
| Reviewer count | 0 | 2 | — |
| External model reviewers | 0 | 1 | — |
| Cross-review findings caught | 0 | 4 P1 (all patched) | — |

---

## File Changes Summary

### New Files
- `skills/pdca/references/domain-pipeline-integration.md` — Sub-skill dispatch standard (284 lines)
- `docs/RELEASE-v1.3.0.md` — This file
- `docs/RELEASE-v1.3.0.ko.md` — Korean translation of this file

### Modified Files
- `skills/pdca/SKILL.md` — Domain Auto-Routing section, Sub-Skill architecture clarification, Pokemon role label clarification (+89 lines)
- `skills/pdca/references/plan-phase.md` — Brief floors, expanded gate checklist (+39 lines)
- `skills/pdca/references/do-phase.md` — Length floors table, sub-skill selection algorithm, calibration principles (+121 lines)
- `skills/pdca/references/check-phase.md` — Reviewer model diversity rule, false consensus detection (+61 lines)
- `skills/pdca/references/act-phase.md` — 5+ Rule with calibrated AND logic, examples table (+59 lines)
- `skills/pdca/references/phase-schemas.md` — Expanded PlanOutput, DoOutput, CheckOutput schemas (+59 lines)
- `.claude-plugin/plugin.json` — Version bump 1.0.0 → 1.3.0
- `CHANGELOG.md` — [1.3.0] entry
- `README.md` — PDCA section updates
- `README.ko.md` — Korean equivalent
- `docs/architecture.md` — PDCA section updates
- `docs/architecture.ko.md` — Korean equivalent

### Total lines added
- Approximately 750 lines of new contract enforcement, schemas, examples, and architectural clarification across the PDCA skill directory.

---

## Upgrade Notes

This is a backward-compatible upgrade. Existing PDCA invocations will continue to work — they will simply hit the new gates and either pass them or be re-dispatched with specific expansion instructions. Users who relied on the old soft-gate behavior may see longer cycle times (because gates now trigger refinements that previously slipped through), but the artifact quality will be substantially higher.

If you need the old behavior for testing, there is no opt-out flag — the new gates are mandatory. The old behavior was the failure mode that motivated this release.
