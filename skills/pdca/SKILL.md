---
name: pdca
description: "Use when running a PDCA cycle across research, production, review, and refinement"
effort: high
---

## Iron Law

> **No skipping. Always proceed P→D→C→A in order.**

## Red Flags

- "I can write tests later" → STOP. Write them now.
- "This change is too small to review" → STOP. Small bugs become P0 incidents.
- "I don't need to check previous cycle insights" → STOP. You will repeat the same mistake.
- "This is good enough" → STOP. Check the checklist.
- "No time to follow every step" → STOP. Skipped steps cost 3x more later.

# PDCA — Knowledge Work Cycle Orchestrator

Meta-skill that runs the Plan → Do → Check → Act cycle.
Each phase gates into the next. No gate skipping.

## When to Use

- User wants end-to-end knowledge work (research + write + review + improve)
- User mentions a PDCA phase explicitly ("plan this", "check this")
- Complex work requiring multiple skills in sequence
- User says "알아보고 써줘", "research and write", or similar multi-phase requests

## PDCA Is the Main Orchestrator. Sub-Skills Are Building Blocks.

**PDCA always runs.** It is the top-level orchestrator for all knowledge work. The Plan→Do→Check→Act cycle wraps every task. Sub-skills (`/threads`, `/newsletter`, `/academy-shorts`, `/card-news`, `/scc:write`, `/scc:research`, `/scc:review`, `/scc:refine`) are **building blocks that PDCA calls inside its phases** — they are not replacements for PDCA, and they do not run on their own outside a PDCA cycle.

```
PDCA Cycle (always running)
  ├─ Plan  → calls /scc:research (or domain research) + /scc:analyze
  ├─ Do    → calls the appropriate sub-skill based on output format
  │           ├─ Threads content?      → /threads handles its own internal phases inside Do
  │           ├─ Newsletter?           → /newsletter handles its own phases inside Do
  │           ├─ Shorts script?        → /academy-shorts handles its own phases inside Do
  │           ├─ Card news?            → /card-news handles its own phases inside Do
  │           └─ Generic content?      → /scc:write
  ├─ Check → calls /scc:review (always, regardless of which sub-skill ran in Do)
  └─ Act   → calls /scc:refine or routes back to Plan/Do via Action Router
```

The key principle: **the user only invokes PDCA**. PDCA decides which sub-skill to dispatch in each phase. The sub-skill produces its phase output and returns control to PDCA, which then enforces the gate, runs Check, and routes Act findings.

### Do-Phase Sub-Skill Selection

When PDCA enters the Do phase, it picks the most specialized sub-skill that matches the artifact format:

| Output Format | Sub-Skill PDCA Dispatches | What That Sub-Skill Owns Internally |
|---------------|--------------------------|-------------------------------------|
| Threads article (@unclejobs.ai) | `/threads` | Its 8-phase pipeline (parse→research→draft→edit→cross-review→proofread→final QA→publish), voice-guide enforcement, Notion publishing |
| Korean tech newsletter | `/newsletter` | Its 7-phase pipeline, Notion/Beehiiv publishing |
| Shorts script (60-90s) | `/academy-shorts` | Research → script → editor pipeline with MMBridge review |
| Card news (carousel) | `/card-news` | Card news template + Playwright render pipeline |
| Generic article/report/blog/social | `/scc:write` | Pure execution from Plan artifacts |

**Key trigger keywords for sub-skill selection** (PDCA scans the user's prompt and the Plan output's `dod` field):

- "스레드", "threads", "@unclejobs.ai", URL 기반 한국어 콘텐츠 → `/threads` in Do
- "뉴스레터", "newsletter", "주간 뉴스레터" → `/newsletter` in Do
- "쇼츠", "shorts", "릴스", "Reels", "9:16", "60초 영상" → `/academy-shorts` in Do
- "카드뉴스", "card news", "인스타 카드", "캐러셀" → `/card-news` in Do
- Anything else → `/scc:write` in Do

### Why PDCA Wraps Sub-Skills (Doesn't Hand Off)

The Plan and Check phases add value that no sub-skill provides on its own:

- **Plan adds upstream rigor**: Question Protocol, source minimums, framework analysis, DoD definition. Without Plan, sub-skills work on whatever scope the user happened to specify, which is often incomplete.
- **Check adds downstream rigor**: Multi-reviewer parallel validation, fact-checking, structural analysis, cross-model review. Without Check, sub-skills self-approve their own output, which misses systematic blind spots.
- **Act adds correction loop**: Action Router classifies failures by root cause (research gap vs format gap vs polish gap) and routes back to the right phase. Without Act, the user has to manually decide what to fix.

A sub-skill running on its own = single-shot generation with the sub-skill's internal checks only.
PDCA wrapping a sub-skill = upstream Plan rigor + sub-skill's internal pipeline + downstream Check + Act loop. Strictly more validation.

### When Sub-Skills Have Their Own Internal Phases

`/threads`, `/newsletter`, `/academy-shorts` each have multi-phase internal pipelines (e.g., `/threads` has 8 phases). When PDCA dispatches them in the Do phase, **all of those internal phases run inside the Do phase**. The sub-skill's internal phases are the implementation of "Do" for that format.

For the full sub-skill dispatch protocol (input contract, output contract, failure handling, integration points), see `references/domain-pipeline-integration.md`.

This means a full PDCA run on a threads article looks like:

```
PDCA Plan  →  /scc:research + /scc:analyze (gather sources, build framework)
PDCA Do    →  /threads (which internally runs its own 8 phases including the
              sub-skill's research, draft, edit, cross-review, proofread, final QA,
              publish — all gated by /threads' own contracts)
PDCA Check →  /scc:review (parallel reviewers, even though /threads already did
              its own cross-review — PDCA's Check adds an outside perspective)
PDCA Act   →  Action Router classifies any Check findings and routes to Plan,
              Do, or Refine
```

PDCA's Check is **not redundant** with the sub-skill's internal review — they catch different things. The sub-skill's internal review checks for domain-specific issues (e.g., voice-guide violations). PDCA's Check looks at the result from outside the domain pipeline and catches the issues the domain pipeline cannot see itself.

### Past Failure That Motivated This Architecture

A user asked for a threads article. PDCA was invoked but the orchestrator interpreted PDCA's abstract phases as a license to self-process — it skipped both `/threads` (the right Do-phase sub-skill) and `/scc:review` (the Check phase). Result: a 3,000-character article with no cross-review, no fact-check, no second model perspective. When the work was redone with PDCA explicitly dispatching `/threads` in Do and `/scc:review` in Check, three P0 factual errors surfaced (a math inconsistency, a wrong feature description, an incorrect currency conversion). The lesson: PDCA's value comes from the wrapping (Plan + Check + Act around whatever the Do phase produces), and skipping that wrapping is what makes outputs short and weak. **Always run the full cycle. Always wrap. Never let the orchestrator self-process when a sub-skill exists.**

## Phase Detection (Only Runs After Domain Routing Returns "no match")

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

Each phase outputs a validated schema before the gate is passed. See `references/phase-schemas.md` for full field rules and validation failure actions. Missing required fields are gate failures, not warnings.

## Phase Gates

Load the relevant checklist from `references/` at each transition. Gates are mandatory — do NOT skip.

| Gate | Reference | Permission | Key Failure Condition |
|------|-----------|------------|----------------------|
| Plan → Do | `references/plan-phase.md` | `plan` (read-only) | `sources_count < 3`, Plan Mode not approved, any PlanOutput field missing |
| Do → Check | `references/do-phase.md` | `acceptEdits` | `plan_findings_integrated: false`, `sections_complete: false`, artifact absent |
| Check → Act | `references/check-phase.md` | `plan` (read-only) | Fewer than 2 reviewers, verdict not a standard value |
| Act → Exit/Cycle | `references/act-phase.md` | `acceptEdits` | `decision` invalid, `root_cause_category` empty |

**Permission pattern**: read-only (`plan`) → write (`acceptEdits`) → read-only → write. Switch at every phase boundary.

**Check → Act routing**: `APPROVED` → EXIT | `MINOR FIXES` → Act light touch | `NEEDS IMPROVEMENT` → Act full refine | `MUST FIX` → Act critical-first.

**Cycle limit**: If `cycle_count >= max_cycles`, do NOT start another cycle. Notify: "max_cycles에 도달했습니다 — 현재 결과물로 종료합니다." Exit with best artifact.

**Worktree**: Do artifacts written in `worktree-pdca-do`. If Check returns MUST FIX, orchestrator discards the worktree for a clean restart.

## Workflow (Full PDCA)

1. **Plan**: Question Protocol → research (Eevee) → analyze (Alakazam + Mewtwo) → **EnterPlanMode** (brief user) → **ExitPlanMode** (get approval). On rejection: re-run with feedback.
2. **Gate**: brief + analysis quality + Plan Mode approval.
3. **Do**: write (Smeargle) `--skip-research --skip-review` using Plan artifacts.
4. **Gate**: artifact completeness.
5. **Check**: review (Xatu, Absol, Porygon, Jigglypuff, Unown) with appropriate preset.
6. **Gate**: verdict → Act or Exit.
7. **Act**: Action Router → Plan / Do / Loop.
8. **Gate**: target met → Exit or present options.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--phase` | `plan\|do\|check\|act\|full` | auto-detect |
| `--depth` | `shallow\|medium\|deep` | `medium` |
| `--target` | verdict or score | `APPROVED` |
| `--max` | max Act iterations | `3` |
| `--max-cycles` | max full PDCA re-cycles (Act→Plan→Do→Check) | `3` |
| `--no-questions` | skip Question Protocol | `false` |

Note: `--constraints` is a write-skill flag passed through by the orchestrator (see do-phase.md, act-phase.md).

## Stuck Detection

Run at every phase transition. See `references/stuck-detection.md` for full signal definitions, root causes, and remediation steps.

| Pattern | Trigger | Action |
|---------|---------|--------|
| **Plan Churn** | `cycle_count >= 3` AND `"do"` not in `completed[]` | Force Do with current plan; append uncertainty note |
| **Check Avoidance** | `"do"` in `completed[]` AND `artifacts.check_report` is null before entering Act | Block Act; inject DoD checklist; require review dispatch |
| **Scope Creep** | Do artifact scope diverges significantly from Plan scope at Do→Check gate | Alert user with planned-vs-actual comparison; wait for choice |

If both stuck patterns and `max_cycles` trigger simultaneously, report both and exit with the best artifact.

## State

State persisted in `.data/state/pdca-active.json`. See `references/state-schema.md` for full schema, field definitions, and single-active-run constraint.

MCP tools (when `pdca-state` server is available): `pdca_get_state`, `pdca_start_run`, `pdca_transition`, `pdca_check_gate`, `pdca_update_stuck_flags`, `pdca_end_run`.

## Output

At each gate: phase summary + gate verdict (pass/fail + reason) + next phase recommendation + "Continue to [next phase]?" prompt (unless full PDCA mode).

At cycle end: full artifact chain, Action Router decisions, verdict progression, total phases + token cost estimate.

## Notifications

When Channels are configured (via `.data/channels.json` or `TELEGRAM_CHAT_ID` env), PDCA emits
notifications at phase transitions and review verdicts. Opt-in via `--notify` flag or by
creating `.data/channels.json` from the `.data/channels.json.example` template.

See `references/channels-integration.md` for event formats, configuration fields, and
the notification payload pattern used by `hooks/session-end.mjs`.

## Subagents (Conceptual Roles, Not Direct Dispatch Targets)

**Important**: The Pokemon names below are **conceptual role labels**, not Agent tool `subagent_type` values. PDCA does NOT dispatch them directly via the Agent tool. Instead, the chained skills (`/scc:research`, `/scc:write`, `/scc:review`, `/scc:refine`) handle these roles internally — they map each role to the appropriate concrete subagent or model.

If you (the orchestrator) try to call `Agent(subagent_type: "eevee")`, it will fail. Always go through the chained skill, never bypass to a Pokemon role.

```yaml
# Roles handled inside /scc:research
researcher: { model: sonnet, role: eevee, purpose: "collect sources with citations, minimum 3 distinct sources" }
analyst: { model: sonnet, role: alakazam, purpose: "apply frameworks with evidence, no generic claims" }
strategist: { model: sonnet, role: mewtwo, purpose: "strategic synthesis, challenge assumptions" }

# Role handled inside /scc:write
writer: { model: opus, role: smeargle, purpose: "produce artifact from plan, skip-research skip-review" }

# Roles handled inside /scc:review (parallel dispatch)
deep-reviewer: { model: opus, role: xatu, purpose: "thorough quality review with structured critic output" }
devil-advocate: { model: sonnet, role: absol, purpose: "attack weakest points, find logical gaps" }
fact-checker: { model: sonnet, role: porygon, purpose: "verify claims against sources, flag unsupported statements" }
structure-analyst: { model: haiku, role: jigglypuff, purpose: "check organization, flow, format compliance" }
consistency-checker: { model: haiku, role: unown, purpose: "cross-reference internal consistency, flag contradictions" }

# Role handled inside /scc:refine
editor: { model: opus, role: ditto, purpose: "apply top 3 fixes per iteration, verify improvement" }

# Orchestration meta-role (the PDCA orchestrator itself)
orchestrator: { model: sonnet, role: arceus, purpose: "enforce gates, manage phase transitions, never skip phases, prefer domain hand-off over self-processing" }
```

**How PDCA actually executes**: The orchestrator calls `/scc:research`, `/scc:write`, `/scc:review`, `/scc:refine` as Skill invocations. Each of those skills internally dispatches the right subagents (`general-purpose`, `code-reviewer`, etc.) using the Agent tool. PDCA never bypasses this layer.

## Gotchas

- Do NOT skip gates. They prevent garbage-in-garbage-out.
- Do NOT run Do without Plan unless user explicitly has source material ready.
- Do NOT declare complete without Check phase verdict.
- Do NOT route all Act findings to Loop — use the Action Router to classify root causes.
- Full PDCA with deep research = significant token cost. Warn user at start.

See `gotchas.md` for extended gotchas (stuck detection, worktree lifecycle, permission transitions, session resume, automation mode).

## MMBridge Session Handoff

When mmbridge is detected (see `references/mmbridge-integration.md`) and the PDCA cycle exits with `APPROVED`, generate a handoff artifact.

### When to Trigger

- PDCA cycle reaches EXIT (APPROVED verdict from Check phase)
- mmbridge is installed
- Do NOT trigger on partial cycles or early exits

### Command

```bash
mmbridge handoff --write .captures/pdca-handoff-${RUN_ID}.md
```

### Output

The handoff artifact summarizes:
- What was researched (Plan phase sources and findings)
- What was produced (Do phase artifact path and type)
- What reviewers found (Check phase verdict and key findings)
- What was refined (Act phase changes, if any)

Present the handoff path to the user:
> "PDCA cycle complete. Handoff artifact saved to `.captures/pdca-handoff-${RUN_ID}.md`"

### Usage

The handoff artifact serves two purposes:
1. **New session briefing**: Load into a fresh Claude session for continuity
2. **Team communication**: Share with colleagues as a work summary

This is an **optional convenience** — the PDCA cycle is complete regardless of whether the handoff succeeds.

## MMBridge Embrace (Full-Cycle Acceleration)

When mmbridge is detected, the PDCA orchestrator can optionally delegate the full cycle to `mmbridge embrace` for parallel multi-model acceleration.

### When to Use

- `--depth deep` with full PDCA: embrace provides multi-model research and debate in parallel with internal agents
- Large-scope tasks where multi-model perspectives add value
- NOT for `--depth shallow` or single-phase runs

### Dispatch

At the start of a full PDCA cycle, if mmbridge is detected and depth is `deep`:

```bash
mmbridge embrace "<task summary>" --json --non-interactive > /tmp/mmbridge-embrace-${RUN_ID}.json
```

- `--non-interactive`: auto-proceed through checkpoints (PDCA orchestrator manages gates, not embrace)
- `--skip-phases`: use when specific PDCA phases should not have embrace acceleration (e.g., `--skip-phases security` if not a code project)

### Merge Points

Embrace results are merged at multiple PDCA phases:
- **Plan**: embrace research findings → supplemental sources for Eevee
- **Check**: embrace review findings → additional voter in consensus gate
- **Act**: embrace security findings → additional input for action router

### Cost Note

`mmbridge embrace` runs multiple models across multiple phases. Only activate at `deep` depth. Warn user about estimated cost at PDCA start.
