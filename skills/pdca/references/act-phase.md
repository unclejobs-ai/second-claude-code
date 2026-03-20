# Act Phase (Refine) — Checklist

The Act phase iteratively improves the artifact based on Check phase findings.
This closes the PDCA cycle — either by shipping or by cycling back to Plan.

## Entry Conditions

- Check phase completed with verdict other than APPROVED
- Review report with actionable findings available
- Artifact file path known and file exists

## Execution Steps

1. **Prioritize findings**: Order by severity (Critical → Major → Minor).
2. **Set loop parameters**:
   - From MINOR FIXES: `--max 1 --target APPROVED`
   - From NEEDS IMPROVEMENT: `--max 3 --target APPROVED`
   - From MUST FIX: `--max 5 --target APPROVED`
3. **Dispatch loop**: Run `/second-claude-code:loop --file {artifact} --review {report} --max {N} --target APPROVED`.
4. **Monitor progression**: Loop skill runs review-fix cycles internally.
5. **Assess exit condition**: See Gate Checklist below.

## Gate Checklist (Act → Exit or Cycle)

After loop completes, one of three outcomes:

### Outcome 1: Target Met

- [ ] Final verdict is APPROVED or MINOR FIXES
- [ ] Verdict improved from initial Check phase
- [ ] No new Critical findings introduced

**Action**: **EXIT**. Ship the final artifact.

Report:
- Iteration count and verdict progression
- Final artifact path
- Key improvements made

### Outcome 2: Target Not Met, Progress Made

- [ ] Verdict improved but didn't reach target
- [ ] `--max` iterations exhausted
- [ ] No regression (verdict didn't get worse)

**Action**: Present options to user:
1. **Continue** — Increase `--max` and keep iterating
2. **Pivot** — Return to Plan phase with a new research angle
3. **Accept** — Ship at current quality with known gaps documented

### Outcome 3: Target Not Met, No Progress

- [ ] Verdict did NOT improve across iterations
- [ ] OR verdict regressed (got worse)

**Action**: **STOP**. The current approach has hit a ceiling.

Present diagnosis:
- What the reviewers consistently flag
- Why fixes aren't resolving the issues
- Recommended pivot: "The problem may be in Plan (insufficient research) or Do (wrong format/approach), not Act."

## Cycle Reset (Act → Plan)

When the user chooses to cycle back to Plan:

1. Save current artifact as `{filename}-v{N}.md` (version snapshot)
2. Summarize what worked and what didn't
3. Identify the specific research gap that blocked progress
4. Re-enter Plan phase with a targeted research question
5. State: update `pdca-active.json` with `current_phase: "plan"` and increment cycle count

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Correct Approach |
|-------------|--------------|-----------------|
| Looping >5 times without improvement | Diminishing returns, token waste | Stop and diagnose root cause |
| Fixing Minor issues when Critical exists | Critical findings block shipping | Address Critical first |
| Skipping review in loop iterations | No evidence of improvement | Loop skill always dispatches review |
| Declaring "good enough" without final review | Gut feel ≠ evidence | Completion gate is mandatory |
| Cycling back to Plan without diagnosis | Repeats the same mistake | Must identify what was missing |

## Output

Final report at PDCA cycle end:

```markdown
# PDCA Cycle Complete

## Summary
- Topic: {topic}
- Phases completed: Plan → Do → Check → Act
- Total iterations: {N}
- Final verdict: {verdict}

## Artifacts
1. Research Brief: {path}
2. Draft: {path}
3. Review Report: {path}
4. Final Version: {path}

## Verdict Progression
Round 1: NEEDS IMPROVEMENT → Round 2: MINOR FIXES → Round 3: APPROVED

## Key Improvements
- {what changed between versions}
```
