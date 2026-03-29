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
| `--domain` | `code\|content\|analysis\|pipeline` | `code` |

The `--domain` flag (new in v1.0.0) selects domain-specific stage contracts, Definition of Done criteria, and rollback targets for each phase transition.

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

## Cycle Memory

The PDCA orchestrator integrates with the cycle memory layer (new in v1.0.0) to persist phase artifacts, metrics, and cross-cycle insights.

- **Auto-save on transition**: When `pdca_transition` fires, the completed phase's artifact is saved to `.data/cycles/cycle-NNN/{phase}.md`.
- **Auto-save on end**: When `pdca_end_run` fires, cycle metrics (domain, verdict, durations) are persisted to `metrics.json`.
- **Read-Before-Act**: At `pdca_start_run`, the 10 most recent insights (weight ≥ 0.1) are loaded into the run context.
- **Self-Evolution**: Critical insights recorded 3+ times auto-generate gotcha proposals.

### Cycle Memory MCP Tools

| Tool | Params | Returns |
|------|--------|---------|
| `pdca_get_cycle_history` | `cycle_id?: number`, `last_n?: number` | `{ cycles: [{ id, plan, do, check, act, metrics }] }` |
| `pdca_save_insight` | `cycle_id: number` (required), `insight: string` (required), `category: "process"\|"technical"\|"quality"` (required), `severity: "info"\|"warning"\|"critical"` (required) | `{ total_insights: number, repeated_count: number }` |
| `pdca_get_insights` | `category?: string`, `last_n?: number` (default 20), `min_weight?: number` (0–1) | `{ insights: [{ cycle_id, timestamp, category, severity, text, weight }] }` |

Insights use a 30-day linear time-decay. The `weight` field ranges from 1.0 (just recorded) to 0.0 (30+ days old). Use `min_weight` to filter stale insights.

## Full Reference

- [PDCA SKILL.md](../../skills/pdca/SKILL.md) — Full orchestrator specification
- [Phase gates](../../skills/pdca/references/) — Detailed checklists for each transition
- [Architecture](../architecture.md) — Agent roster and system design
