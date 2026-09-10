[한국어](pdca.ko.md)

# PDCA

> Slash-only compat for `/scc:godhands`. Runtime stays Plan → Do → Check → Act (`pdca_*`) with explicit transition gates; format and review rules remain skill-level contracts unless a gate names them.

## Quick Example

```
Research and write a report on AI agent frameworks
```

**What happens:** The PDCA skill can orchestrate a compound request through Plan (research + analyze) → Do (write) → Check (review) → Act (refine or route back). Individual skills and commands remain available directly. External capability discovery is optional and advisory; an orchestrator plan does not execute an external skill for you.

## Real-World Example

**Input:**
```
/scc:pdca "AI agent market report" --depth deep
```

**Process:**
1. **Plan**: Question Protocol asks up to 3 clarifying questions. If available, external memory/research dispatch uses `Skill: claude-mem:knowledge-agent`; then Eevee (researcher), Alakazam (analyst), and Mewtwo (strategist) structure findings.
2. **Plan→Do Gate**: The runtime verifies a research brief, at least five counted sources, an analysis artifact, and plan approval. Five counted sources is not a guarantee of five unique usable URLs.
3. **Do**: Smeargle (writer) produces the report in pure execution mode using Plan artifacts. Design-heavy execution can first route to `Skill: frontend-design:frontend-design` when that plugin is the stronger match.
4. **Do→Check Gate**: Verifies artifact is complete, format followed, plan findings integrated.
5. **Check**: The selected review preset dispatches 2–5 reviewers from Xatu (opus), Absol (sonnet), Porygon (sonnet), Jigglypuff (sonnet), and Unown (sonnet), with the review skill's consensus rules. External review is optional.
6. **Check→Act Gate**: APPROVED → ship. Others → Action Router.
7. **Act**: Action Router classifies findings by root cause. Shipping prompts prefer `/commit-commands:commit` when installed:
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

The `--domain` flag selects domain-specific stage contracts, Definition of Done criteria, and rollback targets for each phase transition.

### Code Engineering Lane

When `--domain code` is active, PDCA loads the Code Engineering Lane from `skills/pdca/references/code-engineering-lane.md`. It keeps the normal Plan -> Do -> Check -> Act order while adding code-work discipline: executable acceptance criteria, worker-validator separation, stage reports for long work, human approval gates for broad or risky execution, cleanup/simplification, and issue/PR/local handoff state.

## How It Works

![PDCA Cycle](../images/pdca-cycle.svg)

### Phase Gates

The runtime-enforced transition subset is smaller than the format and review contracts described by
the phase skills. Do not read every documented quality check as an MCP transition requirement.

| Gate | Runtime-enforced subset |
|------|------------------|
| Plan → Do | plan brief exists, `sources_count ≥ 5`, analysis exists, and plan mode is approved |
| Do → Check | artifact exists, artifact is marked complete, and plan findings are integrated |
| Check → Act | a verdict is set and at least two reviewers report |
| Act → Exit/Cycle | an Act decision and root-cause classification are set; route selection remains skill-level behavior |

Format length floors, section checks, reviewer diversity/score checks, and the 5+ rewrite rule are
skill contracts or advisory checks unless the runtime subset above names them explicitly.

### Length Floors by Format (Do Gate)

| Format | Min chars | Target | Sub-skill dispatched |
|--------|-----------|--------|---------------------|
| Newsletter | 10,000 chars | format-specific | `/scc:write --format newsletter` |
| Article | 4,000 chars | format-specific | `/scc:write --format article` |
| Report | 5,000 chars | format-specific | `/scc:write --format report` |
| Shorts | ~1,800 chars | format-specific | `/scc:write --format shorts` |
| Social | platform-optimized | format-specific | `/scc:write --format social` |
| Card news | slide-by-slide | format-specific | `/scc:write --format card-news` |

Full table in `skills/pdca/references/do-phase.md`.

### Domain routing

Use supported write formats explicitly. These are format selections, not hidden command routes;
an external plugin may provide another route only when installed and explicitly selected.

| Requested format | Built-in route |
|---------|-----------|
| newsletter | `/scc:write --format newsletter` |
| article/report/shorts/social/card-news | `/scc:write --format <format>` |
| analysis/strategy | `/scc:analyze` when analysis is requested |

Sub-skill standard: `skills/pdca/references/domain-pipeline-integration.md` (input/output contracts, 4 failure modes).

### Reviewer checks (Check phase)

The review skill can perform reviewer-diversity and false-consensus checks, but the PDCA runtime
transition only requires a verdict and two reported reviewers. Review presets dispatch 2–5 built-in
reviewers; `--external` is optional. Model-diversity and adversarial follow-up are skill-level or
advisory checks, not runtime guarantees.

### 5+ Rule (Act Phase)

Patch vs full rewrite trigger. Runs before Action Router plurality routing.

**Fires on**:
1. Any P0 finding (hard credibility trigger — single P0 forces rewrite)
2. OR (P0+P1 ≥ 5 AND findings span ≥ 3 quality categories) — both conditions required

Calibrated from initial OR logic after observing over-trigger on a 4-finding patch set spanning 3 categories during v1.3.0 verification. New AND logic: 6/6 routing accuracy vs 3/6 under original OR.

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
| external plugins | `getDispatchPlan()` may recommend one; the caller must explicitly invoke it |
| research | Called during Plan phase for data collection |
| analyze | Called during Plan phase for structured analysis |
| write | Called during Do phase in pure execution mode |
| review | Called during Check phase with parallel reviewers |
| refine | Called during Act phase when Action Router routes to Refine |
| workflow | Explicit `/scc:workflow` slash (named replay); not auto-routed from Do |

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
