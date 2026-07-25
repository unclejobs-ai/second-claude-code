# Act Phase (Refine) — Checklist

**Permission Mode**: `acceptEdits`. Applying corrections to the artifact requires file access — the orchestrator must switch from `plan` mode (used in Check) before dispatching Act phase agents.

The Act phase uses an **Action Router** to classify review findings by root cause
and route to the appropriate phase — not always Refine.

## Entry Conditions

- Check phase completed with verdict other than APPROVED
- Review report with actionable findings available
- Artifact file path known and file exists

## Action Router

The Action Router replaces flat "loop everything" with intelligent triage.
See `references/action-router.md` for the full classification matrix.

### Quick Reference

| Root Cause Category | Route | Rationale |
|---------------------|-------|-----------|
| SOURCE_GAP, ASSUMPTION_ERROR, FRAMEWORK_MISMATCH | **PLAN** | Fundamental issues — need more/different research |
| COMPLETENESS_GAP, FORMAT_VIOLATION | **DO** | Execution issues — rewrite with constraints |
| EXECUTION_QUALITY | **REFINE** | Polish issues — iterative improvement |

### Classification Flow

1. Extract Critical and Major findings from review report
2. Classify each finding by signal keywords (see `references/action-router.md`)
3. Tally: PLAN_ISSUES vs DO_ISSUES vs LOOP_ISSUES
4. **Apply 5+ Rule first** (see below) — if triggered, skip plurality routing and go straight to full rewrite
5. Route by plurality (highest count wins)
6. Near-tie (within 5pt) → ask user (2 questions max) → route to highest-count category
7. Exact tie → PLAN > DO > LOOP (most conservative wins)

## 5+ Rule: Patch vs Full Rewrite

**The 5+ Rule overrides the Action Router when finding density crosses a threshold.** Below the threshold, patches work. Above the threshold, patches leave residue and the artifact must be rewritten from scratch.

### Rule Definition (Calibrated 2026-04-07)

The 5+ Rule triggers when **any** of these conditions is met:

1. **Hard credibility trigger**: `P0_count >= 1` (any single credibility-killer finding forces rewrite — broken trust cannot be patched)
2. **Volume + spread trigger** (BOTH conditions required):
   - `P0_count + P1_count >= 5` total findings, **AND**
   - Findings span **3 or more distinct quality categories** from the list below

The two sub-conditions of #2 must both hold. Volume alone (5+ findings in a single category) does NOT fire — that's still patch territory because the fix is concentrated. Spread alone (3 categories with only 4 findings) does NOT fire — that's the calibration we corrected after observing over-triggering on surgical patch sets.

**Quality categories**:
- Factual accuracy (wrong numbers, dates, attributions, math errors)
- Source integrity (vague attributions, unverified claims, broken links, fabricated sources)
- Voice / tone (AI smell, passive voice, forbidden patterns, ending repetition)
- Structure (missing sections, wrong hierarchy, broken format, sub-skill output mis-shaped)
- Length (below floor, above range, unbalanced sections)
- Reader value (unclear, redundant, missing context, no concrete takeaway)

### Calibration Note

The original rule used OR logic: either 5+ findings OR 3+ categories triggered rewrite. In testing (PDCA strengthening v2 verification, 2026-04-07), this was found to over-trigger on patch-sized finding sets. A real run with 4 P1 findings spanning 3 categories (factual + completeness + framing) was clearly surgical patch territory — each finding had a single-sentence fix — yet the OR rule classified it as full rewrite.

Switching to AND for the volume+spread condition fixes the over-trigger. The hard credibility trigger (any P0 → rewrite) is preserved separately because credibility damage compounds even when the surface fix looks small.

### When Triggered: Full Rewrite from Scratch

When the 5+ Rule fires, **do NOT route to REFINE or DO with patches**. Instead:

1. **Snapshot current artifact** as `{filename}-rejected-v{N}.md` for diff comparison later
2. **Re-extract the core message** in one sentence — what is this artifact actually trying to communicate? Write this sentence at the top of a new fresh draft buffer.
3. **Re-enter Plan phase** with the snapshot + finding list as input. The Plan phase reviews whether the original brief was insufficient (which is usually the case when 5+ findings exist downstream).
4. If Plan determines the brief was sufficient → re-enter Do phase with a **clean rewrite mandate**: the writer ignores the rejected draft and starts fresh from the brief, with the finding list as constraints to avoid.
5. The new artifact must pass the same Do gate (length floor, references, etc.) as a fresh write, not a relaxed version.

### Why 5+ Triggers Rewrite (Not More Patches)

Past failure mode: when 5+ P0/P1 findings exist, patching them one-by-one usually introduces new issues at the seams. Each patch changes context for surrounding sentences, which causes downstream issues that the previous review didn't see. Three rounds of patching often produces an artifact with the original 5 findings replaced by 7 new ones.

Full rewrite from scratch, with the finding list as **what to avoid**, produces a coherent artifact in one pass. The cost (one full re-write) is lower than the cost (3-5 patch rounds + re-reviews + still imperfect).

### 5+ Rule Examples (Calibrated)

| Finding count | Categories | Trigger reason | Action |
|--------------|-----------|----------------|--------|
| 2 P0 + 1 P1 | factual, voice | Hard P0 trigger (P0 ≥ 1) | **Full rewrite** |
| 5 P1 | voice only (1 category) | Volume met but spread not met | Plurality routing → likely REFINE |
| 1 P0 + 2 P1 | factual, voice, structure | Hard P0 trigger | **Full rewrite** |
| 4 P1 | factual, completeness, framing | Spread met but volume not met (4 < 5) | Plurality routing → DO/REFINE |
| 8 P1 + 4 P2 | voice, length, reader value | Volume ≥5 AND categories ≥3 | **Full rewrite** |
| 0 P0 + 6 P1 | structure only | Volume met but spread not met | Plurality routing → DO |
| 0 P0 + 5 P1 | factual, voice, structure | Volume met AND spread met | **Full rewrite** |
| 1 P0 | factual only | Hard P0 trigger | **Full rewrite** |
| 0 P0 + 0 P1 + 12 P2 | style polish only | No trigger | Plurality routing → REFINE |
| 4 P1 | factual, completeness, framing, voice (4 categories) | 4 categories but volume 4 < 5 | Plurality routing → DO |

### Anti-Patterns the 5+ Rule Prevents

| Anti-Pattern | Why It's Bad |
|-------------|--------------|
| Patching 7 findings one-by-one | Each patch creates new context drift; 3-5 rounds later, more issues exist than at the start |
| "Just fix the worst 3 and ship" | The remaining 4+ findings are still real problems; shipping is premature |
| Re-running Refine 5 times to chase a moving target | Refine is for polish, not for substance; Refine cannot fix what Do produced wrong |
| Treating 5+ findings as a Refine problem | Almost certainly a Plan or Do problem — Refine cannot rebuild missing scope |

### How the 5+ Rule Interacts with Action Router

The 5+ Rule **fires before** the Action Router runs. If 5+ triggers, the Action Router is bypassed entirely for this iteration — the route is forced to PLAN (with full rewrite mandate). The Action Router resumes its normal role on the next Check after the rewrite.

This prevents the Action Router from over-classifying small subsets of findings into REFINE when the overall artifact needs a much deeper intervention.

## Route: Act → PLAN

1. Snapshot artifact as `{filename}-v{N}.md`
2. Extract specific research gaps from findings
3. **Discard worktree**: `git worktree remove --force worktree-pdca-do` — the artifact is rejected at root; start clean
4. Formulate targeted research questions
5. Re-enter Plan with gap-focused research (Question Protocol skipped — gap is known)
6. Update state: `current_phase: "plan"`, increment `cycle_count`

## Route: Act → DO

1. Compile findings as constraints list
2. **Discard worktree**: `git worktree remove --force worktree-pdca-do` — a fresh Do pass requires a clean branch
3. Re-execute: `/scc:write --skip-research --skip-review --constraints {findings}` (creates a new `worktree-pdca-do`)
4. Proceed directly to Check after Do (skip Plan and Loop)

## Route: Act → REFINE (MINOR FIXES or NEEDS IMPROVEMENT)

1. Set refine parameters based on verdict (use `--target` from PDCA invocation, default: APPROVED):
   - MINOR FIXES: `--max 1 --target {pdca_target}`
   - NEEDS IMPROVEMENT: `--max 3 --target {pdca_target}`
   - MUST FIX: `--max 5 --target {pdca_target}`
2. **Keep worktree** — fixes are applied in place inside `worktree-pdca-do`
3. Dispatch: `/scc:refine --file {artifact} --review {report} --max {N} --target {pdca_target}`
4. Refine runs review-fix cycles internally
5. On refine exit with APPROVED or MINOR FIXES: merge worktree → `git merge --no-ff worktree-pdca-do`, then `git worktree remove worktree-pdca-do`
6. On refine exit with MUST FIX: discard worktree, re-enter Do with full constraints

## Gate Checklist (Act → Exit or Cycle)

### Outcome 1: Target Met

- [ ] Final verdict meets `--target` threshold (default: APPROVED)
- [ ] Verdict improved from initial Check phase
- [ ] No new Critical findings introduced

Note: When `--target APPROVED` (default), only APPROVED triggers exit. MINOR FIXES exits only when `--target` is explicitly set to `MINOR FIXES` or lower.

**Action**: **EXIT**. Ship the final artifact.
**Worktree**: Merge and clean up — `git merge --no-ff worktree-pdca-do` then `git worktree remove worktree-pdca-do`.

Report:
- Iteration count and verdict progression
- Final artifact path
- Key improvements made

### Outcome 2: Target Not Met, Progress Made

- [ ] Verdict improved but didn't reach target
- [ ] Iterations exhausted
- [ ] No regression

**Action**: Present options:
1. **Continue** — Increase iterations and keep going (keep worktree)
2. **Pivot** — Return to Plan with new research angle (discard worktree: `git worktree remove --force worktree-pdca-do`)
3. **Accept** — Ship at current quality with gaps documented (merge worktree: `git merge --no-ff worktree-pdca-do` then `git worktree remove worktree-pdca-do`)

### Outcome 3: Target Not Met, No Progress

- [ ] Verdict did NOT improve across iterations
- [ ] OR verdict regressed

**Action**: **STOP**. Present diagnosis:
- Root cause classification from Action Router
- Why fixes aren't resolving the issues
- Recommended pivot based on dominant finding category

**Worktree**: Discard — `git worktree remove --force worktree-pdca-do`. No usable artifact to preserve.

## Cycle Reset (Act → Plan)

1. Save current artifact as `{filename}-v{N}.md`
2. Summarize what worked and what didn't
3. Identify the specific research gap
4. **Discard worktree**: `git worktree remove --force worktree-pdca-do`
5. Re-enter Plan with targeted research question
6. Update state: increment `cycle_count`

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Correct Approach |
|-------------|--------------|-----------------|
| Refining >5 times without improvement | Diminishing returns, token waste | Stop and diagnose via Action Router |
| Routing everything to REFINE | Ignores root cause — research gaps can't be polished away | Use Action Router classification |
| Skipping Action Router | Misses fundamental issues | Always classify before routing |
| Cycling back to Plan without diagnosis | Repeats the same mistake | Must identify what was missing |
| Fixing Minor issues when Critical exists | Critical findings block shipping | Address Critical first |

## Output to Orchestrator

Output must conform to the **ActOutput schema** (see `references/phase-schemas.md`).
The orchestrator validates all fields before executing the routing decision.

Produce before exiting the Act phase:
- Routing decision → `decision` (one of: `exit|plan|do|refine`)
- Action Router classification result → `root_cause_category` (non-empty)
- Summary of changes applied in this Act pass → `improvements_applied` (non-empty when `decision != "exit"`)
- Constraints to carry forward into next cycle → `next_cycle_constraints` (may be empty when exiting)

## Output

Final report at PDCA cycle end:

```markdown
# PDCA Cycle Complete

## Summary
- Topic: {topic}
- Phases completed: Plan → Do → Check → Act
- Total iterations: {N}
- Action Router decisions: {route history}
- Final verdict: {verdict}

## Artifacts
1. Research Brief: {path}
2. Analysis: {path}
3. Draft: {path}
4. Review Report: {path}
5. Final Version: {path}

## Verdict Progression
Round 1: NEEDS IMPROVEMENT (→REFINE) → Round 2: MINOR FIXES (→DO) → Round 3: APPROVED

## Key Improvements
- {what changed between versions}
```
