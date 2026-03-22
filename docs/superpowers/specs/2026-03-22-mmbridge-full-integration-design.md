# MMBridge Full Integration — Phase 1 Design

**Date**: 2026-03-22
**Scope**: research, security, gate (Phase 1 of 3)
**Architecture**: mmbridge-first — auto-detect and use if installed, graceful fallback if not

---

## Motivation

MMBridge CLI has 9 commands but only `review` is integrated. The remaining commands
(`research`, `debate`, `security`, `gate`, `diff`, `followup`, `resume`, `handoff`, `memory`)
map naturally to PDCA phases. Phase 1 tackles the three highest-impact integrations.

## Phased Rollout

| Phase | Commands | PDCA Stage | Priority |
|-------|----------|------------|----------|
| **1 (this spec)** | `research`, `security`, `gate` | Plan, Check | Immediate |
| 2 | `debate`, `followup`, `resume` | Plan depth, Act loop | Next |
| 3 | `diff`, `handoff`, `memory` | Check viz, session handoff | Later |

---

## 1. Common Layer

### File: `references/mmbridge-integration.md`

Shared rules referenced by all skills that use mmbridge.

**Detection**:
- Run `which mmbridge` via Bash once per skill invocation
- Result is cached for the skill's lifetime
- If not found: silently skip all mmbridge calls, proceed with internal agents only

**RUN_ID generation**:
- If inside a PDCA cycle: use the PDCA `run_id` from `pdca-active.json`
- If standalone (no active PDCA run): generate `date +%s` (Unix timestamp)

**Invocation pattern**:
```bash
mmbridge <command> [options] --stream --export /tmp/mmbridge-<command>-${RUN_ID}.md
```

**`--tool` flag**: `mmbridge research` and `mmbridge security` handle model selection internally (no `--tool` needed). Only `mmbridge review` uses `--tool kimi`. If future mmbridge versions add `--tool` to other commands, prefer `--tool kimi` for consistency.

**Timeout per command**:
- `research`: 300s (multi-model web search is slow)
- `security`: 180s (codebase analysis)
- `review`: 120s (default)
- `gate`: 60s (lightweight coverage check)

**Cleanup**: Delete the export file after successful parsing, or at end of skill invocation regardless of outcome.

**Error handling**:
- Exit non-zero → log error, proceed without mmbridge result
- Timeout: 120s default. If mmbridge hangs, kill and proceed.
- mmbridge failure NEVER blocks the pipeline

**Parallel execution**:
- mmbridge calls are ALWAYS dispatched in parallel with internal agents
- Results are merged at the skill's existing merge point

**Refactor**: The existing `review` skill's External Reviewers section (lines 135-171 of `skills/review/SKILL.md`)
will be refactored to reference this common guide, eliminating duplicated detection/error logic.

---

## 2. Research Integration

**Skill**: `/scc:research`
**MMBridge command**: `mmbridge research`

### Current flow
```
researcher(sonnet) → analyst(sonnet) → [optional 2nd round] → writer(sonnet)
```

### New flow (mmbridge detected)
```
┌─ researcher(sonnet): WebSearch x5-10 ─────────┐
│                                                 ├─→ analyst: merge all sources + gap analysis
└─ mmbridge research "<topic>" --type code-aware ─┘
        │
        └─ exports to /tmp/mmbridge-research-{RUN_ID}.md
```

### Integration rules

1. Dispatch `mmbridge research` in parallel with internal researcher (Step 1 of current flow)
2. Analyst receives mmbridge export as supplemental source material alongside internal findings
3. mmbridge findings count toward the `sources_count` gate requirement (Plan→Do gate needs ≥3). Counting rule: each distinct cited URL from the mmbridge export counts as 1 source (not the invocation itself)
4. `--depth shallow`: skip mmbridge (cost vs value too low for shallow research)
5. `--depth medium|deep`: mmbridge enabled
6. `--type` mapping: if research topic relates to current codebase, use `--type code-aware`; otherwise `--type open`

### Changes to `skills/research/SKILL.md`

- Add "MMBridge Enhancement" section after "Internal Flow"
- Modify Step 1 to dispatch mmbridge in parallel
- Modify Step 3 (analyst) to merge mmbridge results
- Add mmbridge sources to verification step (Step 6)

---

## 3. Security Integration

**Skill**: `/scc:review`
**MMBridge command**: `mmbridge security`

### New preset: `security`

| Preset | Internal Reviewers | External (mmbridge) |
|--------|-------------------|---------------------|
| `security` | deep-reviewer + fact-checker + structure-analyst | `mmbridge security` |

### Flow
```
┌─ deep-reviewer(opus): architecture security analysis ─┐
│─ fact-checker(sonnet): known CVE / dependency check   ─┤
│─ structure-analyst(haiku): config & permission audit  ─┼─→ consensus gate
└─ mmbridge security --scope all                        ─┘
```

### Integration rules

1. New `--preset security` dispatches security-focused internal reviewers. Add `--external` to also dispatch `mmbridge security`
2. `--scope` passthrough: `/scc:review --preset security --scope auth` → `mmbridge security --scope auth`
3. `--compliance` passthrough: `/scc:review --preset security --compliance GDPR,SOC2` → `mmbridge security --compliance GDPR,SOC2`
4. CWE severity mapping (same 3-tier scheme as internal):
   - `CRITICAL` → Critical
   - `HIGH` → Major
   - `MEDIUM` → Minor
   - `LOW` → Minor
5. mmbridge security findings are deduplicated against internal findings using existing dedup rules
6. mmbridge security counts as 1 additional voter in consensus gate
7. `--preset security` still requires `--external` to trigger mmbridge (consistent with other presets)

### Changes to `skills/review/SKILL.md`

- Add `security` to Presets table
- Add security-specific reviewer instructions for each internal reviewer
- Add mmbridge security dispatch section (parallel with internal reviewers)
- Add CWE severity mapping table

---

## 4. Gate Integration

**Skill**: `/scc:pdca` (phase gates)
**MMBridge command**: `mmbridge gate`

### Current gates
Phase gates are checklist-based, validated by the orchestrator reading reference files.

### New: mmbridge gate as advisory signal

At the Check→Act transition:
```
Internal consensus gate evaluation
        ↓
mmbridge gate --mode review --format json
        ↓
{coverage_score, covered_files, uncovered_files, recommendation}
        ↓
Advisory signal: logged to PDCA state, displayed to user
```

### Integration rules

1. `mmbridge gate` runs AFTER internal consensus gate completes (sequential, not parallel)
2. Result is **advisory only** — does not override consensus gate verdict
3. If coverage is low, emit warning: "mmbridge gate: {n} files uncovered by review"
4. Gate result is recorded in PDCA state via `pdca_transition` metadata
5. `--mode` follows the review context: `review` for content, `security` for security preset, `architecture` for structural reviews. The Check phase output must include a `review_preset` field in CheckOutput schema for this mapping

### Changes to `skills/pdca/references/check-phase.md`

- Add "MMBridge Gate Advisory" section
- Gate checklist gets one new optional item: "mmbridge gate coverage check"

---

## 5. Review Skill Refactor

The existing External Reviewers section in `skills/review/SKILL.md` (lines 135-171) contains
detection, dispatch, and error handling logic that will be duplicated by research and security
integrations. Refactor to:

1. Move detection/invocation/error rules to `references/mmbridge-integration.md`
2. Review skill's External Reviewers section becomes a short reference:
   "For mmbridge detection, invocation, and error handling, see `references/mmbridge-integration.md`."
3. Keep review-specific logic (finding merge, severity mapping, voter counting) in the review skill

---

## Phase 2: Debate + Followup/Resume (implemented)

### 6. Debate Integration

**Skill**: `/scc:analyze`
**MMBridge command**: `mmbridge debate`

At `--depth thorough`, dispatch `mmbridge debate` in parallel with the internal devil-advocate challenge round. The debate proposition is the key thesis from the strategist's analysis.

- `mmbridge debate "<proposition>" --rounds 2 --stream --export /tmp/mmbridge-debate-${RUN_ID}.md`
- `AGAINST` arguments merge into challenge round as additional attack vectors
- `FOR` arguments that contradict internal findings are noted as "disputed by external model"
- Skipped at `quick` and `standard` depth (cost vs value)

### 7. Followup/Resume Integration

**Skill**: `/scc:refine`
**MMBridge commands**: `mmbridge followup`, `mmbridge resume`

Leverages mmbridge's session continuity for smarter refine iterations:

- **Followup**: When a `[external: mmbridge]` review finding is ambiguous, clarify with `mmbridge followup --tool kimi --prompt "<question>" --latest`
- **Resume**: Before each re-review cycle, run `mmbridge resume --action followup -y` to get the external reviewer's preliminary assessment of fixes
- Both reuse existing mmbridge sessions — cheaper than full re-review

---

## Phase 3: Diff + Handoff + Memory (implemented)

### 8. Diff Visualization

**Skill**: `/scc:review`
**MMBridge command**: `mmbridge diff`

After review completes on `code` or `security` presets, offer annotated diff view. Display enhancement only — does not affect consensus gate.

### 9. Session Handoff

**Skill**: `/scc:pdca`
**MMBridge command**: `mmbridge handoff`

On PDCA APPROVED exit, generate a handoff artifact summarizing the full cycle. Saved to `.captures/pdca-handoff-${RUN_ID}.md`.

### 10. Cross-Session Memory

**Skill**: `/scc:pdca` (Plan phase)
**MMBridge command**: `mmbridge memory search`

At Plan phase entry, query prior PDCA findings for relevant context. Results are "Prior Context" for the researcher — not counted as fresh sources.

---

## Non-Goals

- Any mmbridge configuration UI or settings
- Automatic mmbridge installation or updates

---

## Files Changed (estimated)

| File | Change |
|------|--------|
| `references/mmbridge-integration.md` | **NEW** — common mmbridge layer |
| `skills/research/SKILL.md` | Add mmbridge research parallel dispatch |
| `skills/review/SKILL.md` | Add `security` preset + refactor external section |
| `skills/review/references/consensus-gate.md` | Add security severity mapping |
| `skills/pdca/references/check-phase.md` | Add mmbridge gate advisory |
| `skills/pdca/references/phase-schemas.md` | Add `review_preset` to CheckOutput |
| `references/consensus-gate.md` | Update external section to reference common layer |
| `docs/architecture.md` | Update Cross-Model Review section |

## Success Criteria

1. `/scc:research "topic"` with mmbridge installed → mmbridge research runs in parallel, analyst merges results
2. `/scc:review --preset security` → mmbridge security + internal reviewers, consensus gate works
3. PDCA Check→Act transition → mmbridge gate advisory logged
4. All three: mmbridge not installed → identical behavior to current (no errors, no warnings)
