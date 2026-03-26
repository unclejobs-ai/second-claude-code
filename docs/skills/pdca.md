# PDCA

> Full Plan → Do → Check → Act cycle orchestrator with quality gates, Action Router, and 16 Pokemon-themed agents.

## Quick Example

```
Research and write a report on AI agent frameworks
```

**What happens:** The PDCA orchestrator detects compound intent (research + write), enters the full cycle, and chains Plan (research + analyze) → Do (write) → Check (review) → Act (loop or route back) with quality gates between each transition.

## Real-World Example

**Input:**
```
/second-claude-code:pdca "AI agent market report" --depth deep
```

**Process:**
1. **Plan**: Question Protocol asks up to 3 clarifying questions. Eevee (researcher) runs deep web research. Alakazam (analyst) + Mewtwo (strategist) structure findings.
2. **Plan→Do Gate**: Verifies research brief with 3+ sources and analysis artifact.
3. **Do**: Smeargle (writer) produces the report in pure execution mode using Plan artifacts.
4. **Do→Check Gate**: Verifies artifact is complete, format followed, plan findings integrated.
5. **Check**: 5 reviewers (Xatu, Absol, Porygon, Jigglypuff, Unown) run parallel review with consensus gate.
6. **Check→Act Gate**: APPROVED → ship. Others → Action Router.
7. **Act**: Action Router classifies findings by root cause:
   - Source/assumption gaps → back to **Plan**
   - Completeness/format issues → back to **Do**
   - Execution quality → **Loop** (Ditto editor)
8. Cycle repeats until target met or max iterations reached.

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--phase` | `plan\|do\|check\|act\|full` | auto-detect |
| `--depth` | `shallow\|medium\|deep` | `medium` |
| `--target` | verdict or score | `APPROVED` |
| `--max` | max Act iterations | `3` |
| `--no-questions` | skip Question Protocol | `false` |

## How It Works

![PDCA Cycle](../images/pdca-cycle.svg)

### Phase Gates

| Gate | Requirements |
|------|-------------|
| Plan → Do | Research Brief exists, 3+ sources, analysis artifact complete |
| Do → Check | Artifact exists and complete (no TODO/TBD), plan findings integrated |
| Check → Act | Verdict routing: APPROVED exits, others route to Act |
| Act → Exit/Cycle | Action Router classifies root cause → Plan, Do, or Loop |

### Action Router

Classifies review findings by root cause before routing:

| Finding Category | Route | Rationale |
|-----------------|-------|-----------|
| SOURCE_GAP, ASSUMPTION_ERROR, FRAMEWORK_MISMATCH | Plan | Research needs strengthening |
| COMPLETENESS_GAP, FORMAT_VIOLATION | Do | Execution needs rework |
| EXECUTION_QUALITY | Loop | Polish iteration needed |

### Question Protocol

At Plan entry, the orchestrator asks up to 3 scope-clarifying questions:
- Skipped when context is sufficient or `--no-questions` is set
- Unanswered questions → save assumptions and proceed
- Act→Plan return skips questions (research gap already identified)

## Gotchas

- **Gates are mandatory** — Do NOT skip them. They prevent garbage-in-garbage-out.
- **Do without Plan** — Only valid if user explicitly has source material ready.
- **Not everything is Loop** — Use the Action Router to classify root causes. Research gaps go to Plan, not Loop.
- **Token cost** — Full PDCA with deep research is token-intensive. The orchestrator warns at start.
- **"Just write it"** — That's Do only. Don't force full PDCA when user wants a single phase.
- **Single-phase invocation** — Pauses at the next gate for user decision.

## Works With

| Skill | Relationship |
|-------|-------------|
| research | Called during Plan phase for data collection |
| analyze | Called during Plan phase for structured analysis |
| write | Called during Do phase in pure execution mode |
| review | Called during Check phase with parallel reviewers |
| refine | Called during Act phase when Action Router routes to Refine |
| workflow | Can automate full PDCA cycles |

## Full Reference

- [PDCA SKILL.md](../../skills/pdca/SKILL.md) — Full orchestrator specification
- [Phase gates](../../skills/pdca/references/) — Detailed checklists for each transition
- [Architecture](../architecture.md) — Agent roster and system design
