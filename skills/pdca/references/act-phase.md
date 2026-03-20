# Act Phase (Refine) — Checklist

The Act phase uses an **Action Router** to classify review findings by root cause
and route to the appropriate phase — not always Loop.

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
| EXECUTION_QUALITY | **LOOP** | Polish issues — iterative improvement |

### Classification Flow

1. Extract Critical and Major findings from review report
2. Classify each finding by signal keywords (see `references/action-router.md`)
3. Tally: PLAN_ISSUES vs DO_ISSUES vs LOOP_ISSUES
4. Route by plurality (highest count wins)
5. Near-tie (within 5pt) → ask user (2 questions max) → route to highest-count category
6. Exact tie → PLAN > DO > LOOP (most conservative wins)

## Route: Act → PLAN

1. Snapshot artifact as `{filename}-v{N}.md`
2. Extract specific research gaps from findings
3. Formulate targeted research questions
4. Re-enter Plan with gap-focused research (Question Protocol skipped — gap is known)
5. Update state: `current_phase: "plan"`, increment `cycle_count`

## Route: Act → DO

1. Compile findings as constraints list
2. Re-execute: `/scc:write --skip-research --skip-review --constraints {findings}`
3. Proceed directly to Check after Do (skip Plan and Loop)

## Route: Act → LOOP

1. Set loop parameters based on verdict (use `--target` from PDCA invocation, default: APPROVED):
   - MINOR FIXES: `--max 1 --target {pdca_target}`
   - NEEDS IMPROVEMENT: `--max 3 --target {pdca_target}`
   - MUST FIX: `--max 5 --target {pdca_target}`
2. Dispatch: `/scc:loop --file {artifact} --review {report} --max {N} --target {pdca_target}`
3. Loop runs review-fix cycles internally

## Gate Checklist (Act → Exit or Cycle)

### Outcome 1: Target Met

- [ ] Final verdict meets `--target` threshold (default: APPROVED)
- [ ] Verdict improved from initial Check phase
- [ ] No new Critical findings introduced

Note: When `--target APPROVED` (default), only APPROVED triggers exit. MINOR FIXES exits only when `--target` is explicitly set to `MINOR FIXES` or lower.

**Action**: **EXIT**. Ship the final artifact.

Report:
- Iteration count and verdict progression
- Final artifact path
- Key improvements made

### Outcome 2: Target Not Met, Progress Made

- [ ] Verdict improved but didn't reach target
- [ ] Iterations exhausted
- [ ] No regression

**Action**: Present options:
1. **Continue** — Increase iterations and keep going
2. **Pivot** — Return to Plan with new research angle
3. **Accept** — Ship at current quality with gaps documented

### Outcome 3: Target Not Met, No Progress

- [ ] Verdict did NOT improve across iterations
- [ ] OR verdict regressed

**Action**: **STOP**. Present diagnosis:
- Root cause classification from Action Router
- Why fixes aren't resolving the issues
- Recommended pivot based on dominant finding category

## Cycle Reset (Act → Plan)

1. Save current artifact as `{filename}-v{N}.md`
2. Summarize what worked and what didn't
3. Identify the specific research gap
4. Re-enter Plan with targeted research question
5. Update state: increment `cycle_count`

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Correct Approach |
|-------------|--------------|-----------------|
| Looping >5 times without improvement | Diminishing returns, token waste | Stop and diagnose via Action Router |
| Routing everything to LOOP | Ignores root cause — research gaps can't be polished away | Use Action Router classification |
| Skipping Action Router | Misses fundamental issues | Always classify before routing |
| Cycling back to Plan without diagnosis | Repeats the same mistake | Must identify what was missing |
| Fixing Minor issues when Critical exists | Critical findings block shipping | Address Critical first |

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
Round 1: NEEDS IMPROVEMENT (→LOOP) → Round 2: MINOR FIXES (→DO) → Round 3: APPROVED

## Key Improvements
- {what changed between versions}
```
