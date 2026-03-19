# Consistency Review Report

**Reviewer**: Consistency Reviewer (Opus 4.6)
**Date**: 2026-03-20
**Scope**: Cross-file consistency across all plugin documentation, skills, commands, and manifests

---

## Summary

| Dimension | Findings | Critical | Major | Minor |
|-----------|----------|----------|-------|-------|
| Naming consistency | 5 | 0 | 2 | 3 |
| Number claims | 3 | 0 | 1 | 2 |
| Verdict system | 3 | 0 | 2 | 1 |
| Cross-file references | 3 | 0 | 1 | 2 |
| EN/KO parity | 4 | 0 | 1 | 3 |
| Formatting consistency | 2 | 0 | 0 | 2 |
| Stale content | 4 | 0 | 2 | 2 |
| **Total** | **24** | **0** | **9** | **15** |

---

## 1. Naming Consistency

### [MAJOR] references/design-principles.md:35 — "captures/" path instead of "knowledge/"
The design principles file refers to `$CLAUDE_PLUGIN_DATA/captures/` for the knowledge base, but `skills/collect/SKILL.md` defines the storage path as `$CLAUDE_PLUGIN_DATA/knowledge/{para-category}/{slug}.json`. The "captures" naming is the pre-v0.2.0 convention.
**Fix**: Change `$CLAUDE_PLUGIN_DATA/captures/` to `$CLAUDE_PLUGIN_DATA/knowledge/` in `references/design-principles.md` line 35.

### [MAJOR] references/para-method.md:44-48 — "captures/" directory tree instead of "knowledge/"
The PARA method reference uses the old `$CLAUDE_PLUGIN_DATA/captures/` directory structure. The collect SKILL.md defines `$CLAUDE_PLUGIN_DATA/knowledge/{category}/{slug}.*` as the canonical path.
**Fix**: Replace the Storage Structure section directory tree from `captures/` to `knowledge/` with subdirectories matching the collect SKILL.md (`projects/`, `areas/`, `resources/`, `archives/`).

### [MINOR] references/lineage.md:20 — "capture and knowledge synthesis flow"
The lineage doc uses "capture" as a verb/concept when describing the Ars Contexta patterns. While this could be read as a generic verb (part of the CODE cycle: Capture, Organize, Distill, Express), it may cause confusion given the rename from `capture` to `collect`.
**Fix**: Consider rephrasing to "collection and knowledge synthesis flow" for clarity, or add a parenthetical note that "capture" here refers to the CODE cycle concept, not the old skill name.

### [MINOR] README.ko.md:115 — Korean trigger keywords include "capture" in Korean
The Korean auto-routing table lists `캡처` as a trigger keyword for the `collect` skill. This is acceptable since it is a user-facing trigger (users may type "캡처" to mean "capture/save"), but it should be noted that this is an intentional synonym, not a stale reference.
**Fix**: No change required -- this is a correct user-intent keyword. Document in a comment if desired.

### [MINOR] tests/skill-tests/capture-test-output.md — Test output file still named "capture"
The test output file is named `capture-test-output.md` rather than `collect-test-output.md`. The newer retest uses the correct name (`retest-collect-output.md`).
**Fix**: Rename `capture-test-output.md` to `collect-test-output.md` for consistency, or leave as historical artifact if tests are not actively maintained.

---

## 2. Number Claims

### [MAJOR] CHANGELOG.md:33 — "8 specialized subagents" is incorrect
The v0.1.0 changelog entry lists "8 specialized subagents" and names only 8 (researcher, analyst, writer, editor, strategist, deep-reviewer, devil-advocate, fact-checker). The actual agents/ directory contains 10 files: researcher, analyst, writer, editor, strategist, deep-reviewer, devil-advocate, fact-checker, tone-guardian, structure-analyst. The missing two are tone-guardian and structure-analyst.
**Fix**: Change "8 specialized subagents" to "10 specialized subagents" and add "tone-guardian, structure-analyst" to the list.

### [MINOR] docs/skills/hunt.md:21 and docs/skills/hunt.ko.md:23 — "checked 7 skills" in example
The real-world example says "checked 7 skills in `skills/` (review, analyze, research, write, loop, pipeline, collect)" -- listing 7 skills and omitting `hunt` itself. This is actually correct behavior (hunt would not recommend itself), but could confuse readers who know there are 8 skills total.
**Fix**: Add a parenthetical clarification: "checked 7 skills in `skills/` (excluding hunt itself: review, analyze, research, write, loop, pipeline, collect)."

### [MINOR] README.md:6-8 and README.ko.md:6-8 — Badge claims match reality
Verified: 8 skills (correct -- 8 directories in skills/), 10 agents (correct -- 10 files in agents/), 15 frameworks (correct -- 15 files in skills/analyze/references/frameworks/), 4 platforms (correct -- Claude Code, OpenClaw, Codex, Gemini CLI listed in compatibility section).
**Fix**: No fix needed. All badge claims are accurate.

---

## 3. Verdict System

### [MAJOR] README.md:186-191 and README.ko.md:202-207 — Mermaid diagram shows only 3 verdicts
The review flow Mermaid diagram in both READMEs shows only 3 verdict outcomes: APPROVED, MINOR FIXES, MUST FIX. The canonical 4-verdict system (defined in `skills/review/SKILL.md:41`, `references/consensus-gate.md:25`, and `docs/skills/review.md:73`) includes NEEDS IMPROVEMENT as a distinct fourth verdict. The diagram omits it entirely.
**Fix**: Add a fourth branch to the Mermaid diagram:
```
V -->|threshold not met| NI[NEEDS IMPROVEMENT]
```

### [MAJOR] skills/loop/SKILL.md:38 — "NEEDS_WORK" in JSON example instead of "NEEDS IMPROVEMENT"
The loop state JSON example contains `"verdicts":["NEEDS_WORK","APPROVED"]`. The canonical verdict name is `NEEDS IMPROVEMENT` (or `NEEDS_IMPROVEMENT` if underscored). `NEEDS_WORK` does not exist in the verdict system and appears to be a pre-v0.2.0 artifact.
**Fix**: Change `"NEEDS_WORK"` to `"NEEDS_IMPROVEMENT"` in the JSON example on line 38.

### [MINOR] README.md:191 and README.ko.md:207 — Consensus gate text omits NEEDS IMPROVEMENT
The inline consensus gate description says: "2/3 passes = APPROVED. Any Critical finding = MUST FIX." It does not mention what happens when the threshold is not met and there are no Critical findings (the NEEDS IMPROVEMENT case). While this is simplified for the README, it creates a gap in the documented logic.
**Fix**: Expand to: "2/3 passes = APPROVED (3/5 for `full` preset). Threshold not met, no Critical = NEEDS IMPROVEMENT. Any Critical finding = MUST FIX."

---

## 4. Cross-File References

### [MAJOR] docs/skills/pipeline.md:92-94 and docs/skills/pipeline.ko.md:94-96 — Pipeline presets table shows only `autopilot`
The pipeline SKILL.md defines 3 presets (autopilot, quick-draft, quality-gate) at lines 85-87. The EN and KO doc pages only list `autopilot` in the Presets table. The `quick-draft` and `quality-gate` presets are missing.
**Fix**: Add `quick-draft` and `quality-gate` rows to the Presets table in both `docs/skills/pipeline.md` and `docs/skills/pipeline.ko.md`.

### [MINOR] docs/skills/pipeline.md:102 and docs/skills/pipeline.ko.md:104 — "No runtime variables" gotcha is stale
The pipeline doc gotcha says "Static args do not support runtime variables yet." However, `skills/pipeline/SKILL.md` defines a full variable system with `{{placeholder}}` syntax, built-in variables (`{{topic}}`, `{{date}}`, `{{output_dir}}`, `{{run_id}}`), and custom variables via `--var`. The SKILL.md was updated but the doc was not.
**Fix**: Replace this gotcha with the current variable-aware gotcha: "Always provide `--topic` when running a pipeline that uses `{{topic}}` -- the orchestrator will abort with a clear error if it is missing. Variable resolution happens once at run start."

### [MINOR] docs/skills/hunt.md:87 and docs/skills/hunt.ko.md:89 — "Metadata-only evaluation" gotcha does not reflect Candidate Inspection
The hunt doc's last gotcha says evaluation relies on metadata because "each repo's full source" isn't read. However, `skills/hunt/SKILL.md` now defines a Candidate Inspection step (lines 43-55) where the top 3 candidates have their README/SKILL.md fetched and read. The doc understates the actual inspection depth.
**Fix**: Update to: "Without running the candidate's code, evaluation has limits. Candidate Inspection reads READMEs/SKILL.md for the top 3, but deeper source analysis is recommended for high-risk installs."

---

## 5. EN/KO Parity

### [MAJOR] docs/skills/review.md:45 vs docs/skills/review.ko.md:47 — quick preset threshold column
The EN docs/skills/review.md preset table has a "Threshold" column showing `2/2` for quick. The KO version also has this column with the Korean header "기준". However, the SKILL.md version at `skills/review/SKILL.md:29-35` does NOT have a threshold column in its preset table. The docs are actually more informative than the SKILL.md here. This is not an EN/KO parity issue -- both docs match. But it is an information drift between SKILL.md and docs.
**Fix**: Add a Threshold column to the SKILL.md Presets table, or note that threshold details are in the Consensus Gate section.

### [MINOR] docs/skills/research.ko.md — Missing "Unreadable fetched content" and "Conflicting data points" gotchas
The EN `docs/skills/research.md` lists 5 gotchas. The KO `docs/skills/research.ko.md` also lists 5 gotchas, and they match. However, the SKILL.md lists 9 gotchas (adding "Unreadable fetched content", "Conflicting data points", "Stale sources for current trends", "Coverage gaps at deep depth"). The EN and KO docs are consistent with each other but both omit 4 gotchas from the SKILL.md.
**Fix**: This is acceptable as progressive disclosure (docs show the top gotchas, SKILL.md has the full set). No change required unless full parity with SKILL.md is desired.

### [MINOR] docs/skills/collect.ko.md — Missing "Inline subagent execution" and "Missing markdown dual output" gotchas
Similar to research: the EN and KO docs are consistent with each other (5 gotchas each), but the SKILL.md has 3 additional gotchas (#6 Inline subagent execution, #7 Missing markdown dual output, #8 Unranked search results). The gotchas.md also has 8 entries. Both docs omit the same ones.
**Fix**: No change required for EN/KO parity -- they match. Consider adding the most impactful missing gotchas to both docs if desired.

### [MINOR] README.ko.md:115 — Korean README has unique auto-routing section absent in EN
The Korean README includes a "Korean trigger keywords" table (lines 108-117) and a "Routing examples" section (lines 119-130) that are absent from the English README. The English README has a shorter auto-routing section (lines 103-116) with a mixed EN/KO example block. This is intentional localization (Korean users need more keyword detail), not a parity defect.
**Fix**: No change required. The asymmetry is appropriate localization.

---

## 6. Formatting Consistency

### [MINOR] docs/skills/review.md:40-46 — Presets table includes "Threshold" column not in other preset tables
The review doc adds a "Threshold" column to the Presets table, while the review SKILL.md and README versions do not include this column. This is not a formatting error per se but creates inconsistency between the SKILL.md and doc representations of the same data.
**Fix**: Either add Threshold to SKILL.md and README preset tables, or remove from docs and reference the Consensus Gate section. Pick one approach and use it everywhere.

### [MINOR] commands/*.md — Inconsistent argument format descriptions
Some command files describe arguments positionally ("First argument: format"), while others use option flags ("--depth shallow|medium|deep"). The write command describes both positional and flag arguments. The review command uses git-status backtick injection syntax (`!git status --short`). While functional, the argument documentation format varies across commands.
**Fix**: Standardize command files to use the same template: positional arguments first (with required/optional notation), then flags with defaults.

---

## 7. Stale Content

### [MAJOR] tests/skill-tests/review-test-output.md:26,68,210 — References to "capture" skill
The review test output references the old "capture" skill name in multiple locations: the Mermaid diagram note, the skill enumeration, and the findings table. This test output was generated before the rename.
**Fix**: Since this is a test output file (historical artifact), either regenerate the test with the current skill name or add a note at the top: "Note: This test output pre-dates the capture-to-collect rename in v0.2.0."

### [MAJOR] tests/hooks/session-end.test.mjs:28,57 — "NEEDS WORK" instead of "NEEDS IMPROVEMENT"
The session-end hook test uses `"NEEDS WORK"` as a score value and asserts against it. The canonical verdict name is `"NEEDS IMPROVEMENT"`. This test was written before the 4-verdict system was finalized.
**Fix**: Change `"NEEDS WORK"` to `"NEEDS IMPROVEMENT"` in the test file and update the assertion pattern from `/Scores: NEEDS WORK/` to `/Scores: NEEDS IMPROVEMENT/`.

### [MINOR] references/design-principles.md:35 — "captures/" is stale (also noted in Naming section)
Already covered in Naming Consistency #1. The design principles reference the old storage path.

### [MINOR] CHANGELOG.md:26 — v0.1.0 uses "/scc:" prefix instead of "/second-claude-code:"
The v0.1.0 changelog uses the short prefix `/scc:` (e.g., `/scc:research`, `/scc:write`) while all other documentation uses the full `/second-claude-code:` prefix. The short form may have been the original convention, and the SKILL.md for pipeline also uses `/scc` in its frontmatter description.
**Fix**: Decide on a canonical prefix convention and apply consistently. If `/scc:` is an accepted alias, document this. If not, update the changelog to use the full form.

---

## Recommendations (Priority Order)

### Must Address Before Next Release

1. **Fix verdict system inconsistencies**: Update loop SKILL.md JSON example from `NEEDS_WORK` to `NEEDS_IMPROVEMENT`, add 4th verdict to README Mermaid diagrams, and fix session-end test.
2. **Fix stale "captures/" paths**: Update `references/design-principles.md` and `references/para-method.md` to use `knowledge/` instead of `captures/`.
3. **Fix CHANGELOG agent count**: Change "8 specialized subagents" to "10 specialized subagents" in the v0.1.0 entry.
4. **Sync pipeline doc presets**: Add `quick-draft` and `quality-gate` to both EN and KO pipeline docs.

### Should Address

5. **Update pipeline doc variable gotcha**: Replace "no runtime variables" with current variable system documentation.
6. **Update hunt doc inspection gotcha**: Reflect the Candidate Inspection workflow.
7. **Add NEEDS IMPROVEMENT to README consensus gate text**: Brief mention in both READMEs.

### Nice to Have

8. **Standardize command file argument format**: Use consistent template across all 8 commands.
9. **Rename capture-test-output.md**: Match current skill name.
10. **Clarify lineage "capture" usage**: Disambiguate from old skill name.
11. **Clarify hunt example "7 skills"**: Add parenthetical about excluding hunt itself.

---

## Verification Checklist

| Check | Result |
|-------|--------|
| 8 skills directories exist | PASS (research, write, analyze, review, loop, collect, pipeline, hunt) |
| 8 SKILL.md files exist | PASS |
| 8 gotchas.md files exist | PASS |
| 8 EN doc files exist | PASS |
| 8 KO doc files exist | PASS |
| 8 command files exist | PASS |
| 10 agent files exist | PASS (researcher, analyst, writer, editor, strategist, deep-reviewer, devil-advocate, fact-checker, tone-guardian, structure-analyst) |
| 15 framework files exist | PASS (swot, rice, okr, prd, lean-canvas, persona, journey-map, pricing, gtm, north-star, porter, pestle, ansoff, battlecard, value-prop) |
| 4 platforms listed | PASS (Claude Code, OpenClaw, Codex, Gemini CLI) |
| No "capture" as skill name in active code | PASS (only in changelog, test artifacts, lineage, and Korean trigger keyword) |
| 4-verdict system in review SKILL.md | PASS (APPROVED, MINOR FIXES, NEEDS IMPROVEMENT, MUST FIX) |
| 4-verdict system in consensus-gate.md | PASS |
| 4-verdict system in docs/skills/review.md | PASS |
| 4-verdict system in docs/skills/review.ko.md | PASS |
| 4-verdict system in README Mermaid | FAIL (only 3 shown) |
| Version 0.2.0 consistent across files | PASS (plugin.json, marketplace.json, README badges, README.ko badges, CHANGELOG) |
