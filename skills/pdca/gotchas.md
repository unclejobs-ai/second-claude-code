---
name: pdca-gotchas
description: "Full gotchas list for PDCA — extended entries beyond the top-5 kept inline in SKILL.md"
---

# PDCA Gotchas — Extended

These supplement the top-5 inline gotchas in SKILL.md. Read this file when debugging unusual PDCA behavior.

---

## Auto-routing

**Auto-routing via prompt-detect**: when entering PDCA from natural conversation (not explicit `/scc:pdca`), announce: "이건 리서치→작성→리뷰 전체 사이클이 필요하니 PDCA로 진행한다." Then start with Question Protocol as normal.

**Plan Mode in automation (`--no-questions`)**: skip Plan Mode briefing — approval flow does not apply when running headless.

---

## Cycle Management

**Cycle limit is hard**: when `cycle_count >= max_cycles`, never silently start another cycle. Notify and exit with best artifact.

**run_id collision**: at startup, if `pdca-active.json` already exists with a different `run_id`, warn the user before overwriting — a prior run may still be in progress.

---

## Permission Mode Transitions

**Permission mode transitions are mandatory**: switch `permissionMode` at each phase boundary — Plan/Check use `plan` (read-only), Do/Act use `acceptEdits` (file access). Forgetting to switch is the most common integration error. The pattern is: read-only → write → read-only → write.

---

## Stuck Detection Gotchas

**Plan Churn is not a user error**: if Plan has been entered 3+ times without Do starting, force Do rather than asking the user again — more questions will only deepen the loop.

**Check Avoidance is silent by default**: the agent will not announce it is skipping Check — always verify `artifacts.check_report` is populated before entering Act.

**Scope Creep requires a user decision**: do NOT auto-accept divergence or auto-revert. Present the comparison and wait for user decision. If no response, continue waiting — do not auto-accept or auto-revert. Log the user's decision in the Check phase context.

**stuck_flags are additive**: a run can accumulate multiple flags (e.g., `["plan_churn", "scope_creep"]`). Each flag fires at most once per run — do not re-evaluate a flag already set.

---

## Worktree Lifecycle

**Do phase worktree lifecycle**: the `worktree-pdca-do` branch is auto-cleaned if Do produces no file changes. If changes exist and Check returns MUST FIX, the orchestrator discards the worktree (`git worktree remove --force worktree-pdca-do`) for a clean restart — no stale artifacts carry forward.

---

## Session Resume

**Session resume vs. HANDOFF.md**: `claude --resume {session_id}` restores the full conversation context of a prior session — richer than the compressed HANDOFF.md summary. For complex cycles spanning 3+ sessions, session resume is strongly recommended over relying on the summary alone. The HANDOFF.md "Session Resume" section always lists the exact command.
