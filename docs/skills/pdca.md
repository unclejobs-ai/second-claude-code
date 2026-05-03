# PDCA

> Full Plan → Do → Check → Act cycle orchestrator with **hard** quality gates (length floors, reviewer model diversity, calibrated 5+ Rule), external plugin dispatch, Action Router, and 16 Pokemon-themed conceptual roles.

## What's New in v1.4.0

- **Cross-plugin phase dispatch** — PDCA phases now route through the installed plugin ecosystem when a stronger external capability is available.
- **Verified phase top picks** — Plan → `Skill: claude-mem-knowledge-agent`, Do → `Skill: frontend-design-frontend-design`, Check → `Skill: coderabbit-code-review`, Act → `/commit-commands:commit`.
- **Prompt-level external dispatch** — `prompt-detect` calls `getDispatchPlan()` before internal fallback. Strong external matches such as `posthog event analysis` dispatch to the installed plugin first.
- **No hardcoded plugin registry** — plugin capabilities are discovered from `~/.claude/plugins/` at runtime and converted into exact `Skill:` / slash-command invocation strings.
- **Short-keyword safety** — boundary checks prevent small keyword overmatches, such as `bug` accidentally matching inside `debugging`.

See [orchestrator-architecture.md](../orchestrator-architecture.md) for the v1.4.0 dispatch architecture and validation coverage.

## What's New in v1.3.0

- **PDCA is the main orchestrator, sub-skills are building blocks** — `/threads`, `/newsletter`, `/academy-shorts`, `/card-news` run **inside** PDCA's Do phase via greedy domain auto-routing. PDCA's Check still runs after the sub-skill's internal review for an outside-perspective second pass.
- **Hard length floors per format** — Do gate fails below minimum: threads ≥ 4,000 chars, newsletter ≥ 10,000, strategy report ≥ 5,000, shorts script ≥ 1,800. Sub-skill re-dispatched with specific scope expansion instructions.
- **Plan brief floors** — sources raised from 3 to 5, plus 8 facts, 1 named quote, 1 comparison table, 1 media item, 3,000 chars body minimum.
- **Reviewer diversity rule** — Check requires ≥ 2 distinct models and ≥ 1 external (Codex, Kimi, Qwen, Gemini, Droid) for content/strategy/full presets. Diversity score ≥ 0.6. False consensus detection triggers adversarial pass.
- **5+ Rule (calibrated AND logic)** — patch vs full rewrite threshold. Fires on any P0 OR (P0+P1 ≥ 5 AND findings span ≥ 3 categories). Calibrated from initial OR logic after observing over-trigger on real 4-finding patch sets.
- **Pokemon role labels clarified** — Eevee/Smeargle/Xatu are conceptual roles, NOT direct Agent dispatch targets. Real dispatch happens inside `/scc:research`, `/scc:write`, `/scc:review`, `/scc:refine`.

See [RELEASE-v1.3.0.md](../RELEASE-v1.3.0.md) for the full strengthening spec and verification cycle metrics.

## Quick Example

```
Research and write a report on AI agent frameworks
```

**What happens:** The PDCA orchestrator detects compound intent (research + write), enters the full cycle, and chains Plan (research + analyze) → Do (write) → Check (review) → Act (loop or route back) with quality gates between each transition. In v1.4.0, each phase can first dispatch to a stronger installed plugin capability before internal Second Claude skills run.

## Real-World Example

**Input:**
```
/second-claude-code:pdca "AI agent market report" --depth deep
```

**Process:**
1. **Plan**: Question Protocol asks up to 3 clarifying questions. If available, external memory/research dispatch uses `Skill: claude-mem-knowledge-agent`; then Eevee (researcher), Alakazam (analyst), and Mewtwo (strategist) structure findings.
2. **Plan→Do Gate**: Verifies research brief with 3+ sources and analysis artifact.
3. **Do**: Smeargle (writer) produces the report in pure execution mode using Plan artifacts. Design-heavy execution can first route to `Skill: frontend-design-frontend-design` when that plugin is the stronger match.
4. **Do→Check Gate**: Verifies artifact is complete, format followed, plan findings integrated.
5. **Check**: 5 reviewers (Xatu, Absol, Porygon, Jigglypuff, Unown) run parallel review with consensus gate. Code-review prompts prefer `Skill: coderabbit-code-review` when installed.
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

The `--domain` flag (new in v1.0.0) selects domain-specific stage contracts, Definition of Done criteria, and rollback targets for each phase transition.

## How It Works

![PDCA Cycle](../images/pdca-cycle.svg)

### Phase Gates (v1.3.0 Hardened)

Every gate now requires measurable numeric or boolean fields, not soft "looks complete" judgments.

| Gate | Hard Requirements |
|------|------------------|
| Plan → Do | `brief_char_count ≥ 3,000`, `sources_count ≥ 5`, `facts_count ≥ 8`, `quotes_count ≥ 1` (named speaker), `comparison_tables_count ≥ 1`, `media_inventory_count ≥ 1` (for content briefs), `meets_brief_floor: true` |
| Do → Check | `meets_length_floor: true` (format-specific min), `meets_section_floor: true`, `references_count ≥ 3`, `plan_findings_integrated: true`, `sections_complete: true` |
| Check → Act | `distinct_models_count ≥ 2`, `external_model_count ≥ 1` (content/strategy/full presets), `diversity_score ≥ 0.6`, `false_consensus_check_passed: true`, verdict routing: APPROVED exits, others route to Act |
| Act → Exit/Cycle | **5+ Rule first** (P0 ≥ 1 or volume+spread trigger), then Action Router classifies root cause → Plan, Do, or Refine |

### Length Floors by Format (Do Gate)

| Format | Min chars | Target | Sub-skill dispatched |
|--------|-----------|--------|---------------------|
| Threads article | 4,000 | 5,000-7,000 | `/threads` |
| Newsletter | 10,000 | 12,000-15,000 | `/newsletter` |
| Generic article | 4,000 | 5,000-7,000 | `/scc:write` |
| Strategy report | 5,000 | 6,000-9,000 | `/scc:write` |
| SWOT/RICE/OKR | 3,000 | 4,000-5,000 | `/scc:analyze` |
| Shorts script | 1,800 | 2,200-2,800 | `/academy-shorts` |
| Card news | 8-10 cards | 9-12 cards | `/card-news` |
| PRD | 4,000 | 5,000-7,000 | `/scc:write --format prd` |

Full table in `skills/pdca/references/do-phase.md`.

### Domain Auto-Routing

Do phase greedy-matches user prompts against trigger keywords and dispatches the most specialized sub-skill. Specialized always wins over generic.

| Trigger | Sub-skill |
|---------|-----------|
| 스레드, threads, @unclejobs.ai | `/threads` |
| 뉴스레터, newsletter | `/newsletter` |
| 쇼츠, shorts, 릴스 | `/academy-shorts` |
| 카드뉴스, card news, 캐러셀 | `/card-news` |
| (no specialized match) | `/scc:write` |

Sub-skill standard: `skills/pdca/references/domain-pipeline-integration.md` (input/output contracts, 4 failure modes).

### Reviewer Diversity (Check Gate)

Check phase enforces reviewer model diversity to prevent false consensus:

- ≥ 2 distinct models (no two reviewers on the same model)
- ≥ 1 external model for `content`/`strategy`/`full` presets (Codex GPT-5.4, Kimi K2.5, Qwen, Gemini, Droid)
- Diversity score ≥ 0.6 when more than 2 reviewers run
- **False consensus detection**: all reviewers APPROVED with avg > 0.9 and no critical findings → automatic adversarial pass with unused external model

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
| external plugins | Called before internal fallback when `getDispatchPlan()` finds a stronger phase or keyword match |
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
