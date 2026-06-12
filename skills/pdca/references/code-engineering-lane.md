# Code Engineering Lane

Use this lane when PDCA runs with `domain=code`, or when the user asks for code, refactoring, debugging, tests, CI, or repository changes.

This lane keeps Second Claude's PDCA structure. It absorbs the code-work discipline from `engineering-discipline` and the externalized execution memory from `Hyper-Waterfall` without turning PDCA into a second agent OS.

## What We Borrow

From `engineering-discipline`:

- Clarify before implementation when scope, risk, or acceptance criteria are vague.
- Convert the approved direction into an executable plan before editing.
- Use a worker-validator shape for implementation: one worker makes the change, a separate validator proves it.
- Run an isolated review-work pass before calling code complete.
- Apply clean-ai-slop and simplification before handoff.
- Use systematic debugging for failures instead of random patching.
- Use Rob Pike style measurement for performance claims: baseline, change, measured result.

From `Hyper-Waterfall`:

- Treat durable code work as Issue = Task = Branch = Session when GitHub is available and useful.
- Use a dedicated branch or worktree for non-trivial implementation.
- Write a stage report after each meaningful implementation stage.
- Put a human approval gate before broad multi-stage execution, risky rewrites, or PR handoff.
- Externalize handoff state into an issue comment, PR body, or local report instead of relying on chat memory.

## Lane Contract

| PDCA Phase | Code Engineering Behavior |
|------------|---------------------------|
| Plan | Clarify scope, touched surfaces, constraints, acceptance tests, rollback path, and risk. For durable GitHub work, create or link one issue that names the task. |
| Do | Work on one branch or worktree. Prefer test-first changes for behavior. Keep edits scoped to the approved plan. After each stage, write a stage report with changed files, commands run, failures, and next action. |
| Check | Do not accept worker self-report as proof. Run targeted tests, lint, syntax checks, and an isolated reviewer pass. The reviewer sees the plan, diff, and verification evidence. |
| Act | Fix review findings by root cause. Remove speculative code, clean-ai-slop, simplify naming and control flow, and record final handoff state in the issue, PR, or local report. |

## Hard Gates

- No Do phase without an executable plan for medium or high-risk code work.
- No PASS from the same worker that implemented the change.
- No broad rewrite, multi-stage migration, or PR creation without a human approval gate.
- No performance improvement claim without Rob Pike style measurement.
- No long-running code task without at least one stage report.
- No completion if tests or diagnostics relevant to the touched surface were skipped without a stated reason.

## Stage Report Template

Use this shape for `stage-n-report.md`, an issue comment, or a PR progress note:

```md
# Stage N Report

## Goal
- What this stage was meant to prove or change.

## Changed Surface
- Files, commands, APIs, or docs touched.

## Verification
- Commands run.
- Result summary.
- Known failures and whether they are pre-existing or introduced.

## Decision
- Continue, revise plan, request human approval, or stop.
```

## Dispatch Notes

- Use `investigate` for root-cause debugging before editing unknown failures.
- Use `review` with the `code` preset for the Check phase.
- Use `workflow` only when the user asks for a reusable process artifact.
- Use `loop` only when improving the prompt, workflow, or skill itself, not as a replacement for code verification.
