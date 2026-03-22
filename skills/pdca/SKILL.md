---
name: pdca
description: "PDCA cycle orchestrator — auto-detects phase and chains skills with quality gates between transitions"
---

# PDCA — Knowledge Work Cycle Orchestrator

Meta-skill that runs the Plan → Do → Check → Act cycle.
Each phase gates into the next. No gate skipping.

## When to Use

- User wants end-to-end knowledge work (research + write + review + improve)
- User mentions a PDCA phase explicitly ("plan this", "check this")
- Complex work requiring multiple skills in sequence
- User says "알아보고 써줘", "research and write", or similar multi-phase requests

## Phase Detection

| Signal | Phase | Skills Chained |
|--------|-------|---------------|
| "조사해", "알아봐", plan, research, explore | **Plan** (Gather) | research → analyze |
| "써", "만들어", "분석해", create, write, build | **Do** (Produce) | write (pure execution) |
| "검토해", "리뷰해", review, check, verify | **Check** (Verify) | review |
| "고쳐", "개선해", improve, fix, refine, iterate | **Act** (Refine) | action router → refine |
| "알아보고 써줘", "end-to-end", "full report" | **Full PDCA** | All phases in sequence |

When a single phase is detected, run that phase and pause at its gate.
When full PDCA is detected, run all phases with gates between each.

## Architecture

```
User Prompt → prompt-detect.mjs (Layer 1: compound → /scc:pdca)

PDCA Orchestrator
│
├── PLAN (research → analyze)
│   ├── Question Protocol (max 3 Qs → unanswered = save assumptions)
│   ├── Eevee (researcher): data collection
│   └── Alakazam (analyst) + Mewtwo (strategist): structured analysis
│       └── Gate: Brief + Analysis exist? Sources ≥3?
│
├── DO (pure execution)
│   └── Smeargle (writer): /scc:write --skip-research --skip-review
│       └── Gate: Artifact complete? Format OK?
│
├── CHECK (unchanged)
│   └── Xatu + Absol + Porygon + Jigglypuff + Unown: /scc:review
│       └── Gate: Verdict routing
│
└── ACT (action router → refine)
    ├── Action Router (root cause classification)
    │   ├── SOURCE/ASSUMPTION/FRAMEWORK → PLAN
    │   ├── COMPLETENESS/FORMAT → DO
    │   └── EXECUTION_QUALITY → REFINE
    └── Ditto (editor): /scc:refine
        └── Gate: Target met? → EXIT
```

## Phase Output Schemas

Each phase produces a typed output object that must be validated before the gate is passed.
Full schema definitions, field rules, and validation failure actions are in `references/phase-schemas.md`.

| Phase | Schema | Key Constraint |
|-------|--------|---------------|
| Plan | `PlanOutput` | `sources_count >= 3`, `dod` non-empty, both artifact paths must exist on disk |
| Do | `DoOutput` | `plan_findings_integrated: true`, `sections_complete: true`, artifact file must exist |
| Check | `CheckOutput` | verdict is one of 4 standard values, at least 2 reviewers, `average_score` in [0.0, 1.0] |
| Act | `ActOutput` | decision is one of `exit|plan|do|refine`, `improvements_applied` non-empty when not exiting |

**Validation rule**: Missing required fields are gate failures, not warnings. A phase that cannot produce a complete, valid output has not completed its job.

## Phase Gates

Load the relevant checklist from `references/` at each transition. Gates are mandatory — do NOT skip.

### Plan → Do

Load `references/plan-phase.md` for the full checklist. Key requirements:
- Question Protocol resolved (asked or skipped)
- Research Brief exists with 3+ sources
- Analysis artifact exists (structured framework output)
- Gaps documented
- **Plan Mode briefing completed** — user reviewed and approved via EnterPlanMode/ExitPlanMode

**Validate output against PlanOutput schema before proceeding.** Gate fails if any required field is missing or `sources_count < 3`.

**Permission**: Set `permissionMode: plan` before dispatching Plan phase agents. Research is read-only — no artifact files should be written during Plan (except state file updates).

**Fail action**: Re-run research with `--depth deep` or target specific gaps.
**Rejected in Plan Mode**: Re-run Plan with user feedback as explicit constraints.

### Do → Check

Load `references/do-phase.md` for the full checklist. Key requirements:
- Artifact exists (draft, analysis, or report)
- Artifact is complete (not outline-only, no TODO/TBD)
- Plan findings are integrated (not ignored)
- Format followed

**Validate output against DoOutput schema before proceeding.** Gate fails if `plan_findings_integrated` is false or `sections_complete` is false.

**Permission**: Set `permissionMode: acceptEdits` before dispatching Do phase agents. Writing the artifact requires file access.

**Worktree**: Do phase artifacts are written in `worktree-pdca-do`. Pass the branch name to Check so Act can merge or discard it based on verdict.

**Fail action**: Complete missing sections before proceeding.

### Check → Act

Load `references/check-phase.md` for the full checklist. Routing:
- `APPROVED` → **EXIT**. Ship it.
- `MINOR FIXES` → Act with light touch (top 3 fixes only)
- `NEEDS IMPROVEMENT` → Act with full refine
- `MUST FIX` → Act targeting critical findings first

**Validate output against CheckOutput schema before proceeding.** Gate fails if fewer than 2 reviewers responded or verdict is not a standard value.

**Permission**: Set `permissionMode: plan` before dispatching Check phase agents. Reviewers must NOT modify the artifact they are reviewing — read-only access enforces review independence.

### Act → (Exit or Cycle)

Load `references/act-phase.md` for the full checklist. The Action Router classifies findings:
- Root cause in research/assumptions → cycle back to **Plan**
- Root cause in completeness/format → cycle back to **Do**
- Root cause in execution quality → run **Loop**
- Target met → **EXIT** with final artifact

**Validate output against ActOutput schema before proceeding.** Gate fails if `decision` is not a valid value or `root_cause_category` is empty.

**Permission**: Set `permissionMode: acceptEdits` before dispatching Act phase agents. Applying corrections to the artifact requires file access.

**Cycle limit**: Before starting any re-cycle (Act routing back to Plan or Do), check `cycle_count` against `max_cycles`. If `cycle_count >= max_cycles`, do NOT start another cycle. Notify the user: "max_cycles에 도달했습니다 — 현재 결과물로 종료합니다." Present the best artifact produced so far and exit.

## Workflow (Full PDCA)

1. **Plan**: Question Protocol → Dispatch research (Eevee). Then analyze (Alakazam + Mewtwo). Then **EnterPlanMode** to brief the user — write plan file with research summary + analysis highlights + proposed Do approach. **ExitPlanMode** to get approval. On rejection: re-run Plan with feedback.
2. **Plan→Do Gate**: Verify brief + analysis quality + Plan Mode approval received.
3. **Do**: Dispatch write (Smeargle) with `--skip-research --skip-review`. Pure execution using Plan artifacts.
4. **Do→Check Gate**: Verify artifact completeness.
5. **Check**: Dispatch review (Xatu, Absol, Porygon, Jigglypuff, Unown) with appropriate preset.
6. **Check→Act Gate**: Read verdict. Route to Act or Exit.
7. **Act**: Action Router classifies findings → route to Plan, Do, or Loop.
8. **Act→Exit Gate**: Check target. Exit or present options.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--phase` | `plan\|do\|check\|act\|full` | auto-detect |
| `--depth` | `shallow\|medium\|deep` | `medium` |
| `--target` | verdict or score | `APPROVED` |
| `--max` | max Act iterations | `3` |
| `--max-cycles` | max full PDCA re-cycles (Act→Plan→Do→Check) | `3` |
| `--no-questions` | skip Question Protocol | `false` |

Note: `--constraints` referenced in do-phase.md and act-phase.md is a write-skill flag passed through by the PDCA orchestrator, not a PDCA-level option.

## Stuck Detection

Pattern-based detection that identifies specific behavioral loops before they
waste cycles. Run the check at every phase transition. See
`references/stuck-detection.md` for full signal definitions, root causes, and
remediation steps.

### Pattern 1: Plan Churn

- **Trigger**: `cycle_count >= 3` AND `"do"` is not in `completed[]`
- **Meaning**: Plan is being rewritten repeatedly without committing to Do
- **Action**: Force transition to Do with current plan; append uncertainty
  note; set `stuck_flags: ["plan_churn"]`

### Pattern 2: Check Avoidance

- **Trigger**: `"do"` in `completed[]` AND `artifacts.check_report` is null
  when attempting to transition from Do to Act, OR agent tries to enter Act
  without dispatching a review
- **Meaning**: Check phase was skipped or produced no output
- **Action**: Block Act transition; inject Plan's DoD as a verification
  checklist; require `/scc:review` dispatch; set `stuck_flags: ["check_avoidance"]`

### Pattern 3: Scope Creep

- **Trigger**: Do artifact scope diverges significantly from Plan scope at the
  Do→Check gate (additions not in Plan OR omissions the Plan required)
- **Meaning**: Execution drifted beyond the agreed scope
- **Action**: Alert user with planned-vs-actual comparison; wait for choice
  (accept divergence or revert to Plan scope); set `stuck_flags: ["scope_creep"]`

### Interaction with `max_cycles`

Both mechanisms may fire in the same run. Stuck patterns fire at specific
phase boundaries (earlier and more targeted); `max_cycles` is a hard ceiling
across all cycles. If both trigger simultaneously, report both and exit with
the best artifact.

## State Management via MCP

When the `pdca-state` MCP server is available, use its tools instead of reading
and writing `pdca-active.json` directly. The MCP tools handle atomic writes and
enforce the single-active-run constraint server-side.

| Operation | MCP Tool | Direct fallback |
|-----------|----------|----------------|
| Read active state | `mcp__pdca-state__pdca_get_state` | read `pdca-active.json` |
| Start a new run | `mcp__pdca-state__pdca_start_run` | write `pdca-active.json` |
| Move to next phase | `mcp__pdca-state__pdca_transition` | update `current_phase` + `completed` |
| Validate a gate | `mcp__pdca-state__pdca_check_gate` | manual checklist |
| Record stuck flags | `mcp__pdca-state__pdca_update_stuck_flags` | append to `stuck_flags` |
| End the run | `mcp__pdca-state__pdca_end_run` | write completed, delete active |

`pdca_transition` accepts an `artifacts` object — pass any artifact paths
produced in the current phase so the state stays in sync:

```json
{
  "target_phase": "do",
  "artifacts": {
    "plan_research": ".captures/research-topic-2026-03-20.md",
    "plan_analysis": ".captures/analyze-topic-2026-03-20.md"
  }
}
```

`pdca_check_gate` returns `{ "passed": true/false, "missing": [...] }`.
A non-empty `missing` array means the gate has failed — resolve each item
before calling `pdca_transition`.

## State

Save cycle state to `${CLAUDE_PLUGIN_DATA}/state/pdca-active.json`:

> **Single-active-run constraint**: Only one PDCA run may be active at a time per data directory. Concurrent execution is not supported — `pdca-active.json` is a single file and would collide. If a stale `pdca-active.json` is detected at startup (different `run_id`), notify the user before overwriting.

```json
{
  "run_id": "uuid-v4-generated-at-run-start",
  "session_id": "claude-session-id-of-the-session-that-last-wrote-this-file",
  "session_history": [
    { "session_id": "...", "phase_completed": "plan", "timestamp": "2026-03-22T10:00:00Z" }
  ],
  "topic": "...",
  "current_phase": "do",
  "completed": ["plan"],
  "cycle_count": 1,  // increments each time the agent transitions into Plan phase (fresh start or re-cycle from Act)
  "max_cycles": 3,
  "artifacts": {
    "plan_research": ".captures/research-topic-2026-03-20.md",
    "plan_analysis": ".captures/analyze-topic-2026-03-20.md",
    "do": null,
    "check_report": null,
    "act_final": null
  },
  "gates": {
    "plan_to_do": "passed",
    "do_to_check": null,
    "check_to_act": null
  },
  "check_verdict": null,
  "action_router_history": [],
  "assumptions": [],
  "stuck_flags": [],
  "scope_creep_detail": {
    "planned_scope": null,
    "actual_scope": null,
    "additions": [],
    "omissions": []
  }
}
```

### Session Fields

| Field | Type | Purpose |
|-------|------|---------|
| `session_id` | `string \| null` | Claude Code session ID (`CLAUDE_SESSION_ID`) of the session that last wrote this file. Set by the session-end hook. |
| `session_history` | `Array<{ session_id, phase_completed, timestamp }>` | Ordered record of every session that advanced the cycle. Appended (never overwritten) by the session-end hook. |

## Output

At each gate, report:
- Phase completed + result summary
- Gate verdict (pass/fail + reason)
- Next phase recommendation
- "Continue to [next phase]?" prompt (unless full PDCA mode)

At cycle end:
- Full artifact chain (research → analysis → draft → review → final)
- Action Router decisions (if any)
- Verdict progression across iterations
- Total phases and token cost estimate

## Gotchas

- Do NOT skip gates. They prevent garbage-in-garbage-out.
- Do NOT run Do without Plan unless user explicitly has source material ready.
- Do NOT declare complete without Check phase verdict.
- Do NOT route all Act findings to Loop — use the Action Router to classify root causes.
- Full PDCA with deep research = significant token cost. Warn user at start.
- If user says "just write it" — that's Do only. Don't force full PDCA.
- Single-phase invocation pauses at the next gate for user decision.
- `--no-questions` skips the Question Protocol entirely — useful for automation.
- **Auto-routing via prompt-detect**: when entering PDCA from natural conversation (not explicit `/scc:pdca`), announce: "이건 리서치→작성→리뷰 전체 사이클이 필요하니 PDCA로 진행한다." Then start with Question Protocol as normal.
- **Plan Mode in automation (`--no-questions`)**: skip Plan Mode briefing — approval flow doesn't apply when running headless.
- **Cycle limit is hard**: when `cycle_count >= max_cycles`, never silently start another cycle. Notify and exit with best artifact.
- **run_id collision**: at startup, if `pdca-active.json` already exists with a different `run_id`, warn the user before overwriting — a prior run may still be in progress.
- **Permission mode transitions are mandatory**: switch `permissionMode` at each phase boundary — Plan/Check use `plan` (read-only), Do/Act use `acceptEdits` (file access). Forgetting to switch is the most common integration error. The pattern is: read-only → write → read-only → write.
- **Plan Churn is not a user error**: if Plan has been entered 3+ times without Do starting, force Do rather than asking the user again — more questions will only deepen the loop.
- **Check Avoidance is silent by default**: the agent will not announce it is skipping Check — always verify `artifacts.check_report` is populated before entering Act.
- **Scope Creep requires a user decision**: do NOT auto-accept divergence or auto-revert. Present the comparison and wait for user decision. If no response, continue waiting — do not auto-accept or auto-revert. Log the user's decision in the Check phase context.
- **stuck_flags are additive**: a run can accumulate multiple flags (e.g., `["plan_churn", "scope_creep"]`). Each flag fires at most once per run — do not re-evaluate a flag already set.
- **Do phase worktree lifecycle**: the `worktree-pdca-do` branch is auto-cleaned if Do produces no file changes. If changes exist and Check returns MUST FIX, the orchestrator discards the worktree (`git worktree remove --force worktree-pdca-do`) for a clean restart — no stale artifacts carry forward.
- **Session resume vs. HANDOFF.md**: `claude --resume {session_id}` restores the full conversation context of a prior session — richer than the compressed HANDOFF.md summary. For complex cycles spanning 3+ sessions, session resume is strongly recommended over relying on the summary alone. The HANDOFF.md "Session Resume" section always lists the exact command.
