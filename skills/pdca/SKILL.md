---
name: pdca
description: "PDCA cycle orchestrator — auto-detects phase and chains skills with quality gates between transitions"
---

# PDCA — Knowledge Work Cycle Orchestrator

Meta-skill that runs the Gather → Produce → Verify → Refine cycle.
Each phase gates into the next. No gate skipping.

## When to Use

- User wants end-to-end knowledge work (research + write + review + improve)
- User mentions a PDCA phase explicitly ("plan this", "check this")
- Complex work requiring multiple skills in sequence
- User says "알아보고 써줘", "research and write", or similar multi-phase requests

## Phase Detection

| Signal | Phase | Skills Chained |
|--------|-------|---------------|
| "조사해", "알아봐", plan, research, explore | **Plan** (Gather) | research → collect |
| "써", "만들어", "분석해", create, write, build | **Do** (Produce) | analyze / write / pipeline |
| "검토해", "리뷰해", review, check, verify | **Check** (Verify) | review |
| "고쳐", "개선해", improve, fix, refine, iterate | **Act** (Refine) | loop |
| "알아보고 써줘", "end-to-end", "full report" | **Full PDCA** | All phases in sequence |

When a single phase is detected, run that phase and pause at its gate.
When full PDCA is detected, run all phases with gates between each.

## Phase Gates

Load the relevant checklist from `references/` at each transition. Gates are mandatory — do NOT skip.

### Plan → Do

Load `references/plan-phase.md` for the full checklist. Key requirements:
- Research Brief exists (file or in-context)
- Key sources identified (3+)
- Gaps acknowledged

**Fail action**: Re-run research with higher depth.

### Do → Check

Load `references/do-phase.md` for the full checklist. Key requirements:
- Artifact exists (draft, analysis, or report)
- Artifact is complete (not outline-only)
- Format followed (if write skill was used)

**Fail action**: Complete the missing sections before proceeding.

### Check → Act

Load `references/check-phase.md` for the full checklist. Routing:
- `APPROVED` → **EXIT**. Ship it.
- `MINOR FIXES` → Act with light touch (top 3 fixes only)
- `NEEDS IMPROVEMENT` → Act with full loop
- `MUST FIX` → Act targeting critical findings first

### Act → (Exit or Cycle)

Load `references/act-phase.md` for the full checklist. Decision:
- Target met → **EXIT** with final artifact
- Target NOT met after `--max` → Present 3 options:
  1. Increase `--max` and continue
  2. Restart Plan with new research angle
  3. Accept current quality and ship

## Workflow (Full PDCA)

1. **Plan**: Dispatch `/second-claude-code:research`. Depth based on topic breadth.
2. **Plan→Do Gate**: Verify brief quality.
3. **Do**: Dispatch `/second-claude-code:write` or `/second-claude-code:analyze` based on intent.
4. **Do→Check Gate**: Verify artifact completeness.
5. **Check**: Dispatch `/second-claude-code:review` with appropriate preset.
6. **Check→Act Gate**: Read verdict. Route to Act or Exit.
7. **Act**: Dispatch `/second-claude-code:loop` with review report.
8. **Act→Exit Gate**: Check target. Exit or present options.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--phase` | `plan\|do\|check\|act\|full` | auto-detect |
| `--depth` | `shallow\|medium\|deep` | `medium` |
| `--target` | verdict or score | `APPROVED` |
| `--max` | max Act iterations | `3` |

## State

Save cycle state to `${CLAUDE_PLUGIN_DATA}/state/pdca-active.json`:

```json
{
  "topic": "...",
  "current_phase": "do",
  "completed": ["plan"],
  "artifacts": {
    "plan": ".captures/research-topic-2026-03-20.md",
    "do": null
  },
  "gates": {
    "plan_to_do": "passed"
  }
}
```

## Output

At each gate, report:
- Phase completed + result summary
- Gate verdict (pass/fail + reason)
- Next phase recommendation
- "Continue to [next phase]?" prompt (unless full PDCA mode)

At cycle end:
- Full artifact chain
- Verdict progression across iterations
- Total phases and token cost estimate

## Gotchas

- Do NOT skip gates. They prevent garbage-in-garbage-out.
- Do NOT run Do without Plan unless user explicitly has source material ready.
- Do NOT declare complete without Check phase verdict.
- Full PDCA with deep research = significant token cost. Warn user at start.
- If user says "just write it" — that's Do only. Don't force full PDCA.
- Single-phase invocation pauses at the next gate for user decision.
