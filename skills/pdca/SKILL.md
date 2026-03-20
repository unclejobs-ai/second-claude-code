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
| "고쳐", "개선해", improve, fix, refine, iterate | **Act** (Refine) | action router → loop |
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
└── ACT (action router → loop)
    ├── Action Router (root cause classification)
    │   ├── SOURCE/ASSUMPTION/FRAMEWORK → PLAN
    │   ├── COMPLETENESS/FORMAT → DO
    │   └── EXECUTION_QUALITY → LOOP
    └── Ditto (editor): /scc:loop
        └── Gate: Target met? → EXIT
```

## Phase Gates

Load the relevant checklist from `references/` at each transition. Gates are mandatory — do NOT skip.

### Plan → Do

Load `references/plan-phase.md` for the full checklist. Key requirements:
- Question Protocol resolved (asked or skipped)
- Research Brief exists with 3+ sources
- Analysis artifact exists (structured framework output)
- Gaps documented

**Fail action**: Re-run research with `--depth deep` or target specific gaps.

### Do → Check

Load `references/do-phase.md` for the full checklist. Key requirements:
- Artifact exists (draft, analysis, or report)
- Artifact is complete (not outline-only, no TODO/TBD)
- Plan findings are integrated (not ignored)
- Format followed

**Fail action**: Complete missing sections before proceeding.

### Check → Act

Load `references/check-phase.md` for the full checklist. Routing:
- `APPROVED` → **EXIT**. Ship it.
- `MINOR FIXES` → Act with light touch (top 3 fixes only)
- `NEEDS IMPROVEMENT` → Act with full loop
- `MUST FIX` → Act targeting critical findings first

### Act → (Exit or Cycle)

Load `references/act-phase.md` for the full checklist. The Action Router classifies findings:
- Root cause in research/assumptions → cycle back to **Plan**
- Root cause in completeness/format → cycle back to **Do**
- Root cause in execution quality → run **Loop**
- Target met → **EXIT** with final artifact

## Workflow (Full PDCA)

1. **Plan**: Question Protocol → Dispatch research (Eevee). Then analyze (Alakazam + Mewtwo).
2. **Plan→Do Gate**: Verify brief + analysis quality.
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
| `--no-questions` | skip Question Protocol | `false` |

Note: `--constraints` referenced in do-phase.md and act-phase.md is a write-skill flag passed through by the PDCA orchestrator, not a PDCA-level option.

## State

Save cycle state to `${CLAUDE_PLUGIN_DATA}/state/pdca-active.json`:

```json
{
  "topic": "...",
  "current_phase": "do",
  "completed": ["plan"],
  "cycle_count": 1,
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
  "assumptions": []
}
```

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
