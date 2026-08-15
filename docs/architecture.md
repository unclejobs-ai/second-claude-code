**English** | [한국어](architecture.ko.md)

# Architecture

## Runtime Boundary

Second Claude Code is intentionally a Claude Code plugin, not a standalone agent runtime.

- `soul` is the persistent identity layer for user preferences and behavioral patterns.
- Project recall belongs to PDCA recovery state, MMBridge memory, handoff artifacts, and session resume.
- External skill discovery remains approval-first.

This boundary is deliberate. Hermes-style runtime features can inspire individual subsystems, but the plugin should not embed a second agent OS inside the Claude Code execution model.

---

Second Claude Code is structured as a PDCA-native knowledge-work system.
The product-facing phases are `Gather → Produce → Verify → Refine`, which map
directly to `Plan → Do → Check → Act`.

| PDCA | Product Phase | Primary Skills |
|------|---------------|----------------|
| Requirements | Clarify | `coach` |
| Plan | Gather | `research`, `analyze`*, `discover`, `collect` |
| Do | Produce | `analyze`*, `write`, `workflow`, `batch` |
| Check | Verify | `review` |
| Act | Refine | `refine` |
| **Optimization** | **Evolve** | **`loop`**, `evolve` |
| **Orchestrator** | **Full Cycle** | **`pdca`** |
| **Identity** | **Extend** | **`soul`** |

The `pdca` meta-skill orchestrates the full cycle with quality gates between each phase transition.
It auto-detects which phase to enter from natural language and chains the appropriate skills.

*`analyze` spans both phases: in Plan it synthesizes research findings; in Do it can apply a different framework for the production artifact.

Three commands sit outside the skill list: `/scc:viewer`, `/scc:unblock`, and `/scc:standard-check`. They execute and make no judgment, and a judgment-free entry in the skill list costs the model a choice without giving it one.

## Decision Standards

A session ends and its reasoning goes with it. The next session re-proposes an option that already lost, and nothing on disk says otherwise. Standards are the fix: one record per settled fork, written by the project, read by every session that follows.

| Concern | Where it lives |
|---|---|
| Root resolution, plugin-path refusal | `scripts/lib/project-root.mjs` |
| Interview state (resumable, atomic write) | `scripts/lib/coach-state.mjs` → `<project>/.scc/state/coach.json` |
| Standard record (render, write, list, retire) | `scripts/lib/standard-record.mjs` → `<project>/.scc/standards/<id>/STANDARD.md` |
| Reviewer verdicts on adversarial checks | `scripts/lib/adversarial-log.mjs` → `<project>/.scc/checks/adversarial.jsonl` |
| Interview and record commands | `scripts/coach-runner.mjs` |
| Compliance runner | `scripts/standard-check.mjs`, checkers in `scripts/lib/standard-checkers.mjs` |

```mermaid
flowchart LR
    FORK["fork with 2+ defensible directions"] --> RECORD["coach-runner record-fork"]
    RECORD --> STD[".scc/standards/&lt;id&gt;/STANDARD.md"]
    STD --> CHECK["standard-check &lt;artifact&gt;"]
    CHECK --> PASS["pass / FAIL / UNPROVEN / UNCHECKED"]
    STD --> RETIRE["coach-runner supersede"]
    RETIRE --> OLD["status: superseded, file kept"]
    CHECK -.->|adversarial| VERDICT["coach-runner record-verdict"]
    VERDICT --> LOG[".scc/checks/adversarial.jsonl"]
```

Four invariants hold this together.

**A record is retired, never deleted.** `supersede` flips `status: active` to `superseded` and leaves the file. The rejected options and why they lost stay readable, which is the only thing that stops a later session from re-proposing them. A replacement is written first, carrying `supersedes: "<old id>"`, so a colliding id aborts while the existing standard is still active.

**A check is data, not code.** Standards live in the user's project and travel through its repository. Five fixed checkers — `regex-absent`, `regex-present`, `length-between`, `similarity-below`, `frontmatter-equals` — take structured arguments. A `run:`-style field, an unknown checker id, and an unknown field are all refused with an error rather than skipped, because an author who believes a check is enforced while the runner steps over it is worse off than one with no check at all.

**A checker must be able to say no.** Each one ships a fixture in this repository that it must reject, and the suite fails if a checker starts passing its own fixture. The fixtures live here rather than in the user's project, because a project-supplied fixture would be another input crossing the trust boundary.

**Nobody stamps their own work.** An `adversarial` check stays `UNPROVEN` until a reviewer's answer is on file, bound to the sha256 of the artifact they actually read — edit the artifact and the answers return to unproven. Verdicts are recorded through the coach runner, never through `standard-check`, so the tool that grades the work is not the tool that records passing grades. A standard with no checks reports `UNCHECKED`: visible, not verified, and never a pass.

The runner refuses to write anywhere inside the plugin install. An earlier release resolved the project root from `import.meta.url` and filed user specifications into the plugin cache; `project-root.mjs` now rejects that path, symlinks and case variants included.

### Code Engineering Lane

Code work keeps the same PDCA cycle but runs through a stricter `domain=code` lane. This lane absorbs `engineering-discipline`'s plan/implementation/validation separation and `Hyper-Waterfall`'s issue/branch/stage-report/PR external memory pattern as a code-specific contract.

The point is not to add a second runtime. It tightens the existing Plan -> Do -> Check -> Act gates: Plan defines executable acceptance criteria and impact scope, Do isolates non-trivial work in a branch or worktree and records stage reports when needed, Check requires validator/reviewer evidence instead of worker self-report, and Act finishes cleanup, simplification, measured performance claims, and PR or local handoff state.

## Directory Structure

```
second-claude/
├── .claude-plugin/plugin.json    # Plugin manifest — MCP servers: pdca-state (31 tools), playwright (optional), mmbridge (optional)
├── skills/                       # 15 skills (SKILL.md each)
│   ├── coach/                    # Fork settlement (topology, scoring, standards under .scc/)
│   ├── pdca/                     # PDCA cycle orchestrator (meta-skill)
│   │   └── references/           # Phase gates + action router + question protocol
│   ├── research/                 # Autonomous deep research (WebFetch + Playwright fallback)
│   │   └── references/           # research-methodology.md, playwright-guide.md
│   ├── write/                    # Content production
│   ├── analyze/                  # Strategic framework analysis (15 frameworks)
│   ├── review/                   # Multi-perspective quality gate
│   ├── refine/                   # Iterative improvement
│   ├── collect/                  # Knowledge collection (PARA)
│   ├── workflow/                 # Custom workflow builder
│   ├── discover/                 # Skill discovery
│   ├── loop/                     # Karpathy-style prompt optimization loop
│   ├── evolve/                   # Ouroboros maintainer loop (harvest failures → maintainer check → loop)
│   ├── batch/                    # Parallel task decomposition and execution
│   │   └── references/           # Decomposition guide, split strategies, merge patterns
│   ├── soul/                     # User identity profile synthesis
│   │   └── references/           # Observation signals, synthesis algorithm, templates
│   ├── translate/                # Soul-aware EN↔KO translation
│   └── unblock/                  # Engine only — no SKILL.md; ships as /scc:unblock
│       ├── engine/               # CLI + chain + 10 probes + orchestrator
│       └── references/           # waf-detection, tls-impersonation, archive-fallbacks, eevee-flow
├── agents/                       # 17 specialized subagents (Pokemon-themed)
├── commands/                     # 18 slash commands — 15 skill wrappers + 3 tools
├── hooks/                        # Auto-routing + context injection (7 files, 8 events)
│   ├── hooks.json                # Hook configuration
│   ├── session-start.mjs         # Session startup context (PDCA, soul, orchestrator, daemon)
│   ├── prompt-detect.mjs         # Intent detection + dynamic plugin dispatch injection
│   └── lib/                      # Shared hook modules
│       ├── plugin-discovery.mjs  # Runtime plugin scanner + dispatch guide generator [NEW 1.4.0]
│       ├── soul-observer.mjs     # Soul signal detection + readiness/retro utilities
│       ├── event-log.mjs         # PDCA event sourcing (append-only JSONL)
│       └── ...                   # file-mutex-sync, project-memory, review-config, report-generator, companion-daemon, utils
├── mcp/
│   ├── pdca-state-server.mjs     # 31-tool MCP server (27 core + 4 orchestrator [NEW 1.4.0])
│   └── lib/
│       ├── orchestrator-handlers.mjs  # orchestrator_* tool handlers [NEW 1.4.0]
│       ├── soul-handlers.mjs          # soul_* tool handlers (inc. retro, synthesis, readiness)
│       ├── cycle-memory.mjs           # Cycle memory persistence (phase snapshots, insights, metrics)
│       └── ...                        # pdca-handlers, memory-handlers, etc.
├── references/                   # Design principles, consensus gate
├── templates/                    # Output templates
├── scripts/                      # coach-runner, standard-check, viewer-session, export-artifact, evolve-runner
└── config/                       # User configuration
```

| Directory | Role |
|-----------|------|
| `skills/` | Each skill has a `SKILL.md` (short, context-efficient) plus a `references/` subdirectory for deep documentation. Progressive disclosure in action. |
| `skills/pdca/` | Meta-skill with phase gate checklists, Action Router, and Question Protocol in `references/`. |
| `agents/` | 17 Pokemon-themed subagent definitions across 3 model tiers. See Agent Roster below. |
| `commands/` | Thin wrappers that route `/scc:*` invocations to the matching skill. |
| `hooks/` | 7 hook files registered across 8 events: auto-routing, subagent init/stop, session lifecycle, compaction, and quality gates. |
| `references/` | Shared knowledge: design principles, consensus gate spec, PARA method. |

---

## Agent Roster — Pokemon Edition

17 specialized subagents across 3 model tiers, themed as Pokemon.
Each Pokemon is chosen because its characteristics match the agent's role.

### Production Agents (Plan / Do)

| Agent | Pokemon | Model | PDCA Phase | Role | Why This Pokemon |
|-------|---------|-------|------------|------|------------------|
| researcher | **Eevee** | sonnet | Gather | Web search + multi-source data collection | Adapts anywhere, evolves in many directions |
| analyst | **Alakazam** | sonnet | Produce | Pattern recognition + data synthesis | IQ 5000, two spoons = cross-data analysis |
| strategist | **Mewtwo** | sonnet | Produce | Strategic framework application | Ultimate strategic mind |
| writer | **Smeargle** | opus | Produce | Long-form content creation | The painter — masters any technique |
| editor | **Ditto** | opus | Refine | Content editing + quality improvement | Transforms the original into a better form |

### Review Agents (Check)

| Agent | Pokemon | Model | PDCA Phase | Role | Why This Pokemon |
|-------|---------|-------|------------|------|------------------|
| deep-reviewer | **Xatu** | opus | Verify | Logic, structure, and completeness | Sees past and future simultaneously = structural flaw detection |
| devil-advocate | **Absol** | sonnet | Verify | Attacks weakest points and blind spots | The disaster-sensing Pokemon, warns of danger |
| fact-checker | **Porygon** | sonnet | Verify | Verifies claims, numbers, and sources | Digital native, data-driven binary judgment |
| tone-guardian | **Jigglypuff** | sonnet | Verify | Voice and audience fit | THE voice Pokemon, sensitive to tone |
| structure-analyst | **Unown** | sonnet | Verify | Organization and readability | Letter-shaped, obsessed with structure |

### Pipeline & Discover Agents

| Agent | Pokemon | Model | PDCA Phase | Role | Why This Pokemon |
|-------|---------|-------|------------|------|------------------|
| orchestrator | **Arceus** | sonnet | Produce | Pipeline orchestration | Creator god, coordinates everything |
| step-executor | **Machamp** | sonnet | Produce | Single pipeline step execution | Four arms, gets things done |
| searcher | **Noctowl** | haiku | Gather | External source search | Nocturnal scout, sharp eyes |
| inspector | **Magnezone** | sonnet | Gather | Skill candidate inspection | Magnetic scanner, attracts details |
| evaluator | **Deoxys** | sonnet | Gather | Skill candidate scoring | Analysis form, adaptive evaluation |
| connector | **Abra** | haiku | Extend | Knowledge linking | Teleport = connects distant concepts |

### Soul Agents

| Agent | Pokemon | Model | Phase | Role | Why This Pokemon |
|-------|---------|-------|-------|------|------------------|
| soul-keeper | **Pikachu** | opus | Extend | User identity synthesis | The iconic companion — knows the trainer better than anyone |

### Model Distribution

| Tier | Count | Use |
|------|-------|-----|
| opus | 4 | Deep review, long-form writing, editorial, soul synthesis |
| sonnet | 11 | Research, analysis, strategy, orchestration, adversarial review, fact-checking, tone-checking, structure analysis |
| haiku | 2 | Search and knowledge linking — collection, not judgment |

---

## PDCA Agent Mapping

The agents map to the PDCA quality cycle with the Action Router in Act phase:

```mermaid
flowchart TD
    subgraph PLAN["Gather (Plan)"]
        direction LR
        P1[Eevee — researcher]
        P2[Noctowl — searcher]
        P3[Magnezone — inspector]
        P4[Abra — connector]
    end

    subgraph DO["Produce (Do)"]
        direction LR
        D1[Alakazam — analyst]
        D2[Mewtwo — strategist]
        D3[Smeargle — writer]
        D4[Arceus — orchestrator]
        D5[Machamp — step-executor]
    end

    subgraph CHECK["Verify (Check)"]
        direction LR
        C1[Xatu — deep-reviewer]
        C2[Absol — devil-advocate]
        C3[Porygon — fact-checker]
        C4[Jigglypuff — tone-guardian]
        C5[Unown — structure-analyst]
    end

    subgraph ACT["Refine (Act)"]
        direction LR
        A1[Ditto — editor]
        AR{Action Router}
    end

    PLAN -->|"research → analyze + Question Protocol"| DO
    DO -->|"pure execution"| CHECK
    CHECK -->|"parallel review"| ACT
    AR -->|"Plan"| PLAN
    AR -->|"Do"| DO
    AR -->|"Refine"| ACT
```

Supporting commands reinforce the same loop:

- `pdca` orchestrates the full cycle with quality gates and the Action Router
- `/scc:loop` runs fixed benchmark suites to evolve prompt assets in isolated winner branches
- `collect` keeps source material and notes available for the next planning cycle
- `discover` expands the system when the current skill set is not enough
- `workflow` automates full Gather → Produce → Verify → Refine runs
- `batch` decomposes large homogeneous tasks into parallel units executed concurrently in isolated worktrees
- `soul` builds and maintains a persistent user identity profile from observed behavioral signals
- `viewer` starts the local artifact viewer for saved PDCA/session artifacts and returns a browser URL

### Artifact Viewer Lifecycle

```mermaid
flowchart LR
    CMD["/scc:viewer"] --> RUNNER[scripts/viewer-session.mjs]
    RUNNER --> START[ui/scripts/start-server.sh]
    START --> SERVER[server.cjs background process]
    SERVER --> META[server.pid + server-info.json]
    SERVER --> API["/api/state + WebSocket"]
    API --> UI[Browser artifact viewer]
    STOP[ui/scripts/stop-server.sh] --> SERVER
    SERVER --> IDLE[30-minute idle shutdown]
```

The viewer command is intentionally a thin wrapper: it delegates to the skill, which starts the zero-dependency Node server in the background, records runtime metadata for follow-up commands, streams artifact state through HTTP/WebSocket, and shuts down through either the stop script or the idle timeout.

### Loop Runner Architecture

The maintainer-facing `loop` command adds a second optimization loop around the plugin's own prompt assets:

- Suite manifests live in `benchmarks/loop/*.json` and declare `allowed_targets`, weighted `cases`, budget, and `min_delta`.
- `scripts/loop-runner.mjs` creates an isolated `codex/loop-<suite>-<run_id>` branch plus run worktree, then evaluates the baseline and every candidate under the exact same suite budget.
- Candidate worktrees are temporary. Only the winning patch is copied back into the isolated run branch, and the main workspace remains untouched.
- Active state is persisted in `.data/state/loop-active.json`, while `.captures/loop-<run_id>/` stores the leaderboard, score history, summary, case logs, and winner diff.
- Session hooks surface loop state in startup banners, compaction restoration, and `HANDOFF.md`, so long-running optimization runs can be resumed safely.

---

## PDCA Phase Gates (v1.3.0 Hardened)

The `pdca` meta-skill enforces measurable, contract-based gates at each phase transition. As of v1.3.0, every gate requires specific numeric or boolean fields rather than soft "looks complete" judgments:

```
Plan  ──[Gate: brief_char_count ≥ 3,000, sources ≥ 5, facts ≥ 8,
              quotes ≥ 1, comparison_tables ≥ 1, media ≥ 1,
              meets_brief_floor: true]──→ Do
Do    ──[Gate: meets_length_floor: true (format-specific minimum),
              meets_section_floor: true, references_count ≥ 3,
              plan_findings_integrated: true, sections_complete: true]──→ Check
Check ──[Gate: distinct_models ≥ 2, external_model_count ≥ 1,
              diversity_score ≥ 0.6, false_consensus_check_passed: true,
              verdict ∈ {APPROVED, MINOR FIXES, NEEDS IMPROVEMENT, MUST FIX}]──→ Act (or Exit if APPROVED)
Act   ──[5+ Rule fires? → full rewrite | else Action Router classifies]──→ Plan / Do / Refine
Refine ──[Gate: Target met? DoD all PASS?]──→ Exit (or present options)
```

### Length Floors (Do Gate)

The Do phase fails the gate when the artifact does not meet a format-specific length contract. Sub-skills are re-dispatched with explicit scope direction (which Plan finding to expand, what new sub-section to add) rather than vague "make it longer" instructions.

| Format | Min chars (body) | Target | Min sections | Sub-skill in Do |
|--------|-----------------|--------|--------------|----------------|
| Threads article (@unclejobs.ai) | 4,000 | 5,000-7,000 | 6 | `/threads` |
| Korean tech newsletter | 10,000 | 12,000-15,000 | 6 topics | `/newsletter` |
| Generic article | 4,000 | 5,000-7,000 | 5 H2 | `/scc:write` |
| Strategy/analysis report | 5,000 | 6,000-9,000 | 6 sections | `/scc:write` |
| SWOT/RICE/OKR doc | 3,000 | 4,000-5,000 | 4 quadrants | `/scc:analyze` |
| Shorts script (60-90s) | 1,800 | 2,200-2,800 | 12 scenes | `/academy-shorts` |
| Card news (carousel) | 8-10 cards | 9-12 cards | hook + body + CTA | `/card-news` |
| PRD | 4,000 | 5,000-7,000 | 7 sections | `/scc:write --format prd` |
| Code review report | 2,500 | 3,500-5,000 | 5 dimensions | `/scc:review` |
| Research brief | 3,000 | 4,000-6,000 | n/a | `/scc:research` |
| Meeting notes | 2,000 | 2,500-3,500 | 5 sections | `/scc:write --format decision` |

Full table and calibration principles in `skills/pdca/references/do-phase.md`.

### Domain Auto-Routing (Pre-Do Sub-Skill Selection)

When PDCA enters the Do phase, the dispatcher matches the user prompt against trigger keywords and picks the most specialized sub-skill. Greedy matching is the rule: pick the most specialized sub-skill that fits, never the generic one when a specialized one exists.

| Triggers | Sub-skill |
|---------|-----------|
| 스레드 / threads / @unclejobs.ai | `/threads` |
| 뉴스레터 / newsletter | `/newsletter` |
| 쇼츠 / shorts / 릴스 / Reels | `/academy-shorts` |
| 카드뉴스 / card news / 캐러셀 | `/card-news` |
| (no specialized match) | `/scc:write` (fallback) |

Sub-skill input/output contracts and failure handling are documented in `skills/pdca/references/domain-pipeline-integration.md` (284 lines).

### Reviewer Independence (Check Gate)

Whoever helped produce something does not get to certify it. Agent reuse breaks this quietly: the
critic roster and the agents an upstream phase borrows come from the same pool, so one name can
shape a decision and then vote on the work that decision governs — adversarial in form, self-review
in substance.

The discriminator is the active run's phase, not a heuristic. A reviewer-named agent starting while
`pdca-active.json` reports any phase other than `check` was borrowed upstream; `subagent-start`
records it in `state/upstream-participants.json`.

At aggregation, an excluded reviewer keeps its report — the findings are still findings — and loses
its vote. If exclusion leaves the panel short, consensus is `BLOCKED — QUORUM SHORT` and names who
was barred and how many independent reviewers are missing. Quorum is never reached by relaxing an
exclusion, because a rule that bends to fit the headcount is not a rule. The list is cleared once
consensus is computed, so a name borrowed upstream once is not barred from every review thereafter.

The standards side carries the same invariant: a fork file records `participants`, and
`record-verdict` refuses a verdict from anyone on that list.

### Reviewer Diversity (Check Gate)

The Check phase enforces reviewer model diversity to prevent false consensus:

- **Minimum 2 reviewers** (3 for `--depth deep`)
- **Maximum 1 reviewer per model** — two reviewers on the same model produce correlated errors, not independent perspectives
- **At least 1 external model** for `content`, `strategy`, `full` presets — Codex GPT-5.4, Kimi K2.5, Qwen, Gemini, or Droid
- **Diversity score ≥ 0.6** when more than 2 reviewers run — `distinct_models / total_reviewers`

When all reviewers return APPROVED with average score > 0.9 and no critical findings, the cycle does NOT exit. Instead, an adversarial pass with an unused external model is automatically dispatched. Catches Goodhart-style "everyone said it's fine" failure modes.

### 5+ Rule (Patch vs Full Rewrite)

The Act phase checks the 5+ Rule before plurality routing. The rule fires a full rewrite (instead of patching) when finding density crosses a threshold.

Three trigger conditions, any one fires the rule:

1. **Hard credibility trigger**: any `P0_count ≥ 1` — single credibility-killer forces rewrite
2. **Volume + spread trigger** (BOTH required):
   - `P0_count + P1_count ≥ 5` total findings, AND
   - Findings span ≥ 3 distinct quality categories (factual, source integrity, voice, structure, length, reader value)
3. (Otherwise) no rule fire — normal Action Router plurality routing

Calibrated from initial OR logic after observing over-trigger on a 4-finding patch set spanning 3 categories — clearly surgical patch territory but flagged as full rewrite. Switching to AND for the volume+spread path resolved the over-trigger; the hard credibility path is preserved separately because credibility damage compounds even when surface fixes look small.



### Action Router (Act Phase)

The Action Router classifies review findings by root cause before routing:

| Finding Category | Route | Rationale |
|-----------------|-------|-----------|
| SOURCE_GAP, ASSUMPTION_ERROR, FRAMEWORK_MISMATCH | Plan | Fundamental issues need more research |
| COMPLETENESS_GAP, FORMAT_VIOLATION | Do | Execution issues need rewrite |
| EXECUTION_QUALITY | Refine | Polish issues need iteration |

### Transition Contract

`pdca_transition` enforces the cycle as a state machine. Only these moves exist, and both backward routes cost a cycle, so `max_cycles` bounds the whole run rather than just re-planning.

```mermaid
stateDiagram-v2
    [*] --> plan
    plan --> do: plan_to_do gate
    do --> check: do_to_check gate
    check --> act: check_to_act gate
    act --> plan: re-plan — full reset, cycle++
    act --> do: re-execute — plan kept, cycle++
    act --> [*]: pdca_end_run

    note right of plan
        A re-plan clears everything
        cycle-scoped: gates, verdict,
        counts, sources.
    end note

    note right of do
        A re-execute keeps the plan gate,
        its approval and its sources, and
        clears only what Do and Check
        produced — so the rerun must pass
        review again.
    end note
```

| From → To | Cycle cost | What survives |
|---|---|---|
| `act → plan` | +1, capped by `max_cycles` | Run identity, artifacts, cumulative counters |
| `act → do` | +1, capped by `max_cycles` | The above, plus `plan_to_do`, plan approval, and `sources_count` |

Anything else raises `Illegal transition`. The `act → do` route exists because the Action Router classifies COMPLETENESS_GAP and FORMAT_VIOLATION as execution problems — without it, a third of the router's decisions would have nowhere to go.

### Definition of Done — Refine Gate (0.5.6)

The `refine` skill accepts an optional `--dod` flag: a semicolon-separated checklist of success criteria. When active:

1. DoD criteria are injected into each reviewer's context as a structured checklist
2. Reviewers evaluate each criterion as `DoD-N: PASS` or `DoD-N: FAIL` alongside their normal review
3. Per-criterion consensus is computed (majority across reviewers)
4. The editor prioritizes FAIL criteria before general feedback (up to 3 fixes per round)
5. Refine exits only when **all DoD criteria PASS** AND the score/verdict target is met

This prevents the "score is high but the specific thing I asked for isn't done" failure mode. Without `--dod`, refine behaves exactly as before.

### Question Protocol (Plan Phase)

Limits interactive dialogue to max 3 scope-clarifying questions:
- Skipped when context is sufficient, `--no-questions` is set, or in automation mode
- Unanswered questions → save assumptions and proceed
- Act→Plan return skips questions (research gap already identified)

Phase gate checklists live in `skills/pdca/references/`.
The `hooks/prompt-detect.mjs` auto-router has a PDCA compound layer that detects
multi-phase intent (e.g., "알아보고 써줘") and routes to `/scc:pdca`
before falling through to single-skill matching.

---

## Lifecycle Hooks

7 hook files registered across 8 events in `hooks/hooks.json` (`compaction.mjs` serves both PreCompact and PostCompact):

| Event | Hook file | Behavior |
|-------|-----------|----------|
| `SessionStart` | `session-start.mjs` | Session banner + PDCA state initialization |
| `UserPromptSubmit` | `prompt-detect.mjs` | External plugin dispatch + PDCA compound + single-skill patterns |
| `SubagentStart` | `subagent-start.mjs` | Review session context injection (added in 0.5.1) |
| `SubagentStop` | `subagent-stop.mjs` | Reviewer consensus aggregation |
| `Stop` | `session-end.mjs` | Session cleanup |
| `StopFailure` | `stop-failure.mjs` | Check-phase quality gate enforcement (added in 0.5.1) |
| `PreCompact` | `compaction.mjs` | PDCA state snapshot before context compression |
| `PostCompact` | `compaction.mjs` | PDCA state restoration after context compression |

`PreCompact` and `PostCompact` share the same `compaction.mjs` file. It snapshots PDCA cycle state before context window compression and restores it after, preventing mid-cycle state loss.

---

## Agent Team Integration

PDCA phases leverage parallel execution where possible:

```yaml
team_name: pdca-{topic-slug}
lead: Arceus (orchestrator, sonnet)
phases:
  plan:
    parallel_agents:
      - Eevee (researcher): "angle-1 research"
      - Eevee (researcher): "angle-2 research"  # deep depth only
    sequential:
      - Alakazam + Mewtwo: analyze (merged research results)
  do:
    agent: Smeargle (writer, opus)
  check:
    parallel_agents:  # review skill handles parallelism internally
      - Xatu, Absol, Porygon, Jigglypuff, Unown
  act:
    agent: Ditto (editor, opus)  # loop internal editing
```

- Plan phase dispatches 2 research angles in parallel when `--depth deep`
- Check phase runs 5 reviewers in parallel (handled by review skill)
- File ownership: each agent writes to separate output files

---

## MMBridge Integration — Optional

MMBridge CLI provides multi-model AI capabilities across multiple PDCA phases.
When installed, it auto-enhances research, review, and phase gates.
**Entirely optional** — all skills work fully without MMBridge.

For detection, invocation, and error handling rules, see `references/mmbridge-integration.md`.

### Integration Points

| PDCA Phase | MMBridge Command | Skill | Behavior |
|-----------|-----------------|-------|----------|
| **Plan** | `mmbridge research` | `/scc:research` | Parallel multi-model research, merged into analyst input |
| **Check** | `mmbridge review` | `/scc:review --external` | Cross-model code review, +1 consensus voter |
| **Check** | `mmbridge security` | `/scc:review --preset security --external` | CWE-classified security audit |
| **Plan** | `mmbridge debate` | `/scc:analyze` | Multi-model adversarial challenge at thorough depth |
| **Check→Act** | `mmbridge gate` | `/scc:pdca` | Advisory coverage check at phase transition |
| **Act** | `mmbridge followup` | `/scc:refine` | Clarify ambiguous external review findings |
| **Act** | `mmbridge resume` | `/scc:refine` | External re-assessment after fixes |
| **Check** | `mmbridge diff` | `/scc:review` | Annotated diff view for code/security presets |
| **Plan** | `mmbridge memory` | `/scc:pdca` | Cross-session context from prior cycles |
| **Exit** | `mmbridge handoff` | `/scc:pdca` | Session summary artifact on APPROVED exit |

### External Reviewers

| Reviewer | Provider | Strength |
|----------|----------|----------|
| kimi-reviewer | Kimi (K2.5) | Deep web research, BrowseComp 60.6% |
| qwen-reviewer | Qwen | Security analysis |
| gemini-reviewer | Gemini | Design and visual review |
| codex-reviewer | Codex | Code-focused one-shot review |

### Review Flow

```
Review Dispatch
├── Internal (always)
│   ├── Xatu / deep-reviewer (opus)
│   ├── Absol / devil-advocate (sonnet)
│   ├── Porygon / fact-checker (sonnet)
│   ├── Jigglypuff / tone-guardian (sonnet)
│   └── Unown / structure-analyst (sonnet)
│
├── External — review (--external flag)
│   └── mmbridge review --tool kimi
│
├── External — security (--preset security --external)
│   └── mmbridge security --scope all
│
└── Consensus Gate
    ├── Merge internal + external findings
    ├── Deduplicate overlapping issues
    ├── Apply severity calibration
    ├── mmbridge gate advisory (if available)
    └── Emit verdict: APPROVED | MINOR FIXES | NEEDS IMPROVEMENT | MUST FIX
```

### Research Flow

```
Research Dispatch
├── Internal (always)
│   └── researcher(sonnet) → WebSearch x5-10
│
├── External (mmbridge detected, depth medium+)
│   └── mmbridge research --type code-aware
│
└── Analyst Merge
    ├── Internal findings + mmbridge findings
    ├── Gap analysis
    └── Writer synthesis → Research Brief
```

---

## Memory Boundary

Second Claude Code keeps two memory layers separate on purpose:

- `soul` stores persistent user identity and preference signals.
- Project recall comes from PDCA recovery state plus MMBridge continuity features such as memory search, handoff, and resume.

This project can borrow ideas from standalone agent runtimes, but it should not embed a second runtime inside the Claude Code plugin model.

## Cycle Memory

The cycle memory module (`mcp/lib/cycle-memory.mjs`) provides durable cross-cycle knowledge that survives session boundaries. It stores phase artifacts, metrics, and structured insights under `.data/cycles/`.

### Storage Layout

```
.data/cycles/
├── cycle-001/
│   ├── plan.md          # Phase artifact snapshot
│   ├── do.md
│   ├── check.md
│   ├── act.md
│   ├── metrics.json     # Cycle-level metrics (domain, verdict, durations)
│   └── events.jsonl     # Append-only event log
├── cycle-002/
│   └── ...
├── insights.json        # Cross-cycle structured insights with time-decay weights
└── proposals/           # Auto-generated gotcha proposals (self-evolution)
    └── gotchas-{category}.md
```

### Integration Points

| Handler | Trigger | Behavior |
|---------|---------|----------|
| `handleStartRun` | `pdca_start_run` | Read-Before-Act: loads 10 most recent insights (weight ≥ 0.1) into run context |
| `handleTransition` | `pdca_transition` | Auto-saves completed phase artifact to `cycle-NNN/{phase}.md` |
| `handleEndRun` | `pdca_end_run` | Persists cycle metrics to `cycle-NNN/metrics.json` |

### MCP Tools (3 new)

| Tool | Params | Returns |
|------|--------|---------|
| `pdca_get_cycle_history` | `cycle_id?`, `last_n?` | `{ cycles: [{ id, plan, do, check, act, metrics }] }` |
| `pdca_save_insight` | `cycle_id`, `insight`, `category`, `severity` | `{ total_insights, repeated_count }` |
| `pdca_get_insights` | `category?`, `last_n?`, `min_weight?` | `{ insights: [{ cycle_id, timestamp, category, severity, text, weight }] }` |

### Self-Evolution

Insights use a 30-day linear time-decay for weight. When a critical insight repeats 3+ times, `saveInsight` automatically writes a gotcha proposal to `.data/proposals/gotchas-{category}.md`. These proposals surface recurring failure patterns as actionable checklists that can be promoted to permanent project gotchas.

---

## Playwright MCP — Optional Browser Research

The `playwright` MCP server is registered in `.claude-plugin/plugin.json` as an optional dependency. It provides a real Chromium browser to the researcher agent (Eevee) for URLs that `WebFetch` cannot read.

**This is entirely optional** — the research skill works fully without Playwright installed.

### When it activates

```
researcher: WebFetch(url) → empty / error
                 │
                 └─ Playwright available?
                      ├─ yes → browser_navigate(url)
                      │         browser_snapshot()   ← accessibility tree
                      │         parse + extract content
                      └─ no  → log in Gaps & Limitations, continue
```

The `--interactive` flag on `/scc:research` forces Playwright for every URL, bypassing WebFetch entirely. Useful for SPA dashboards or news sites with heavy JavaScript rendering.

### Cost control

Max **3 Playwright navigations per research round**. Exceeding the cap triggers a hard stop on further navigations; remaining URLs are noted in Gaps & Limitations.

### Accessibility tree advantage

`browser_snapshot()` returns a structured accessibility tree rather than raw HTML. Token cost is 80-90% lower than equivalent HTML for the same information. The researcher extracts headings, paragraphs, and table cells directly from the tree — navigation chrome and ads are structurally excluded.

See `skills/research/references/playwright-guide.md` for full tool reference and patterns.

---

<details>
<summary><strong>Release History</strong></summary>

## What's New in 1.4.0

**Cross-Plugin Orchestration** — Second Claude Code can now discover and command *every* Claude Code plugin you have installed. The orchestrator operates through three layers:

### Layer 1: Runtime Plugin Discovery

`hooks/lib/plugin-discovery.mjs` scans `~/.claude/plugins/installed_plugins.json` at session start and inspects each plugin's filesystem:

```
Plugin filesystem          → Capability extraction
─────────────────────────────────────────────────
.claude-plugin/plugin.json → name, version, description, mcpServers
skills/*/SKILL.md          → skill names + descriptions (frontmatter parsed)
commands/*.md              → command names + descriptions
agents/*.md                → agent names
.mcp.json                  → alternative MCP server declarations
```

Discovery itself has no hardcoded registry: plugins appear and disappear as the user installs and uninstalls them, and the capability map is rebuilt every session. Preference is separate — `INTENT_PROFILES` pins a preferred plugin per lifecycle intent, overridable with `plugin-preferences.json` in `CLAUDE_PLUGIN_DATA`.

### Layer 2: Intent Scoring and Dispatch Planning

`getDispatchPlan()` converts a keyword or PDCA phase into an intent profile, scores every installed plugin skill/command, and returns ranked invocation instructions:

| Input | Intent | Current top dispatch with the verified plugin set |
|-------|--------|---------------------------------------------------|
| `phase=plan` | `plan` | `Skill: claude-mem:knowledge-agent` |
| `phase=do` | `frontend-design` | `Skill: frontend-design:frontend-design` |
| `phase=check` | `review` | `Skill: coderabbit:code-review` |
| `phase=act` | `commit` | `/commit-commands:commit` |
| `posthog event analysis` | `generic` | `Skill: posthog:exploring-autocapture-events` |

Preferred-plugin scoring keeps common lifecycle intents stable, while generic scoring still lets newly installed plugins win when their skill or command text strongly matches the prompt. Short keywords use word-boundary checks so `bug` does not accidentally match `debugging`.

### Layer 3: Proactive Auto-Dispatch

The orchestrator operates at three touchpoints:

```
User types "리뷰해줘"
  ↓
prompt-detect hook (UserPromptSubmit)
  ├── Calls getDispatchPlan(keyword="리뷰해줘")
  ├── Top dispatch: Skill: coderabbit:code-review
  └── Injects [ORCHESTRATOR]: invoke that Skill before self-processing
  ↓
External plugin result returns
  ↓
Claude integrates result into the final answer
```

PDCA still uses the same dispatcher when a full cycle enters a phase:

```
PDCA enters Check phase
  ├── orchestrator_route phase=check
  ├── Discovers: coderabbit (code-review), codex (review), agent-teams (team-review)
  └── Auto-dispatches top pick: "Skill: coderabbit:code-review"
  ↓
Result returned → PDCA proceeds to Act phase
  ├── orchestrator_route phase=act
  └── Auto-dispatches: "/commit-commands:commit"
```

### MCP Tools (orchestrator_*)

| Tool | Purpose | Auto-Dispatch |
|------|---------|---------------|
| `orchestrator_list_plugins` | Full ecosystem inventory | No |
| `orchestrator_get_plugin` | Single plugin deep inspection | No |
| `orchestrator_route` | Keyword/phase → matching plugins | **Yes** — returns `Skill:` strings |
| `orchestrator_health` | Ecosystem readiness check | No |

### New Subsystems

```
hooks/lib/plugin-discovery.mjs       — Filesystem scanner + capability mapper + dispatch guide generator
mcp/lib/orchestrator-handlers.mjs    — 4 MCP tool handler implementations
```

### What Changed in Session-Start

The old passive "Plugin Orchestrator" list was replaced with an **Active Plugin Dispatch** section that pre-computes per-phase routing:

```
## Active Plugin Dispatch
📋 plan → Skill: claude-mem:knowledge-agent
🔨 do → Skill: frontend-design:frontend-design
🔍 check → Skill: coderabbit:code-review
🚀 act → /commit-commands:commit
```

### What Changed in prompt-detect

The old 900-token hardcoded `<skill-check>` block was replaced with `generateDispatchGuide()` — a dynamically generated table built from live plugin discovery. In addition, prompt-detect now calls `getDispatchPlan()` for each substantive prompt. If the top external match is a known lifecycle intent or a strong generic plugin match, it injects an `[ORCHESTRATOR]` instruction that requires invoking that Skill/command before self-processing. When plugins change, both the guide and the immediate dispatch target change automatically.

---

## Earlier releases

1.3.0 and before are recorded in [CHANGELOG.md](../CHANGELOG.md). They were duplicated here for several releases, and the copies drifted from the real one.

</details>
