# Architecture

Second Claude Code is structured as a PDCA-native knowledge-work system.
The product-facing phases are `Gather → Produce → Verify → Refine`, which map
directly to `Plan → Do → Check → Act`.

| PDCA | Product Phase | Primary Skills |
|------|---------------|----------------|
| Plan | Gather | `research`, `analyze`*, `hunt`, `collect` |
| Do | Produce | `analyze`*, `write`, `pipeline` |
| Check | Verify | `review` |
| Act | Refine | `loop` |
| **Orchestrator** | **Full Cycle** | **`pdca`** |

The `pdca` meta-skill orchestrates the full cycle with quality gates between each phase transition.
It auto-detects which phase to enter from natural language and chains the appropriate skills.

*`analyze` spans both phases: in Plan it synthesizes research findings; in Do it can apply a different framework for the production artifact.

## Directory Structure

```
second-claude/
├── .claude-plugin/plugin.json    # Plugin manifest (v0.2.0)
├── skills/                       # 9 skills (SKILL.md each)
│   ├── pdca/                     # PDCA cycle orchestrator (meta-skill)
│   │   └── references/           # Phase gates + action router + question protocol
│   ├── research/                 # Autonomous deep research
│   ├── write/                    # Content production
│   ├── analyze/                  # Strategic framework analysis (15 frameworks)
│   ├── review/                   # Multi-perspective quality gate
│   ├── loop/                     # Iterative improvement
│   ├── collect/                  # Knowledge collection (PARA)
│   ├── pipeline/                 # Custom workflow builder
│   └── hunt/                     # Skill discovery
├── agents/                       # 16 specialized subagents (Pokemon-themed)
├── commands/                     # 9 slash command wrappers
├── hooks/                        # Auto-routing + context injection
│   ├── hooks.json                # Hook configuration
│   ├── prompt-detect.mjs         # Natural language auto-router
│   ├── session-start.mjs         # Session banner + state init
│   └── session-end.mjs           # Cleanup
├── references/                   # Design principles, consensus gate
├── templates/                    # Output templates
├── scripts/                      # Shell utilities
└── config/                       # User configuration
```

| Directory | Role |
|-----------|------|
| `skills/` | Each skill has a `SKILL.md` (short, context-efficient) plus a `references/` subdirectory for deep documentation. Progressive disclosure in action. |
| `skills/pdca/` | Meta-skill with phase gate checklists, Action Router, and Question Protocol in `references/`. |
| `agents/` | 16 Pokemon-themed subagent definitions across 3 model tiers. See Agent Roster below. |
| `commands/` | Thin wrappers that route `/second-claude-code:*` invocations to the matching skill. |
| `hooks/` | Session lifecycle hooks and the two-layer auto-routing engine (PDCA compound patterns + single-skill patterns). |
| `references/` | Shared knowledge: design principles, consensus gate spec, PARA method. |

---

## Agent Roster — Pokemon Edition

16 specialized subagents across 3 model tiers, themed as Pokemon.
Each Pokemon is chosen because its characteristics match the agent's role.

### Production Agents (Plan / Do)

| Agent | Pokemon | Model | PDCA Phase | Role | Why This Pokemon |
|-------|---------|-------|------------|------|------------------|
| researcher | **Eevee** | haiku | Gather | Web search + multi-source data collection | Adapts anywhere, evolves in many directions |
| analyst | **Alakazam** | sonnet | Produce | Pattern recognition + data synthesis | IQ 5000, two spoons = cross-data analysis |
| strategist | **Mewtwo** | sonnet | Produce | Strategic framework application | Ultimate strategic mind |
| writer | **Smeargle** | opus | Produce | Long-form content creation | The painter — masters any technique |
| editor | **Ditto** | opus | Refine | Content editing + quality improvement | Transforms the original into a better form |

### Review Agents (Check)

| Agent | Pokemon | Model | PDCA Phase | Role | Why This Pokemon |
|-------|---------|-------|------------|------|------------------|
| deep-reviewer | **Xatu** | opus | Verify | Logic, structure, and completeness | Sees past and future simultaneously = structural flaw detection |
| devil-advocate | **Absol** | sonnet | Verify | Attacks weakest points and blind spots | The disaster-sensing Pokemon, warns of danger |
| fact-checker | **Porygon** | haiku | Verify | Verifies claims, numbers, and sources | Digital native, data-driven binary judgment |
| tone-guardian | **Jigglypuff** | haiku | Verify | Voice and audience fit | THE voice Pokemon, sensitive to tone |
| structure-analyst | **Unown** | haiku | Verify | Organization and readability | Letter-shaped, obsessed with structure |

### Pipeline & Hunt Agents

| Agent | Pokemon | Model | PDCA Phase | Role | Why This Pokemon |
|-------|---------|-------|------------|------|------------------|
| orchestrator | **Arceus** | sonnet | Produce | Pipeline orchestration | Creator god, coordinates everything |
| step-executor | **Machamp** | sonnet | Produce | Single pipeline step execution | Four arms, gets things done |
| searcher | **Noctowl** | haiku | Gather | External source search | Nocturnal scout, sharp eyes |
| inspector | **Magnezone** | sonnet | Gather | Skill candidate inspection | Magnetic scanner, attracts details |
| evaluator | **Deoxys** | sonnet | Gather | Skill candidate scoring | Analysis form, adaptive evaluation |
| connector | **Abra** | haiku | Extend | Knowledge linking | Teleport = connects distant concepts |

### Model Distribution

| Tier | Count | Use |
|------|-------|-----|
| opus | 3 | Deep review, long-form writing, editorial |
| sonnet | 7 | Analysis, strategy, orchestration, adversarial review |
| haiku | 6 | Search, data collection, fact-checking, classification |

---

## PDCA Agent Mapping

The agents map to the PDCA quality cycle with the Action Router in Act phase:

```
┌──────────────────────────────────────────────────────────────┐
│                      PDCA Cycle v2                           │
│                                                              │
│  Gather (Plan)     → Eevee (researcher), Noctowl (searcher) │
│    research → analyze  Magnezone (inspector), Abra           │
│    + Question Protocol (connector)                           │
│                                                              │
│  Produce (Do)      → Alakazam (analyst), Mewtwo (strategist) │
│    pure execution     Smeargle (writer), Arceus              │
│                       (orchestrator), Machamp (step-executor)│
│                                                              │
│  Verify (Check)    → Xatu (deep-reviewer), Absol             │
│    parallel review    (devil-advocate), Porygon              │
│                       (fact-checker), Jigglypuff             │
│                       (tone-guardian), Unown                  │
│                       (structure-analyst)                    │
│                                                              │
│  Refine (Act)      → Ditto (editor)                          │
│    Action Router:     Route to Plan, Do, or Loop             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Supporting commands reinforce the same loop:

- `pdca` orchestrates the full cycle with quality gates and the Action Router
- `collect` keeps source material and notes available for the next planning cycle
- `hunt` expands the system when the current skill set is not enough
- `pipeline` automates full Gather → Produce → Verify → Refine runs

---

## PDCA Phase Gates

The `pdca` meta-skill enforces quality gates at each phase transition:

```
Plan ──[Gate: Brief exists? Analysis exists? Sources ≥3?]──→ Do
  Do ──[Gate: Artifact complete? Format OK? Research used?]──→ Check
Check ──[Gate: Verdict routing]──→ Act (or Exit if APPROVED)
  Act ──[Action Router: classify root cause]──→ Plan / Do / Loop
Loop ──[Gate: Target met?]──→ Exit (or present options)
```

### Action Router (Act Phase)

The Action Router classifies review findings by root cause before routing:

| Finding Category | Route | Rationale |
|-----------------|-------|-----------|
| SOURCE_GAP, ASSUMPTION_ERROR, FRAMEWORK_MISMATCH | Plan | Fundamental issues need more research |
| COMPLETENESS_GAP, FORMAT_VIOLATION | Do | Execution issues need rewrite |
| EXECUTION_QUALITY | Loop | Polish issues need iteration |

### Question Protocol (Plan Phase)

Limits interactive dialogue to max 3 scope-clarifying questions:
- Skipped when context is sufficient, `--no-questions` is set, or in automation mode
- Unanswered questions → save assumptions and proceed
- Act→Plan return skips questions (research gap already identified)

Phase gate checklists live in `skills/pdca/references/`.
The `hooks/prompt-detect.mjs` auto-router has a PDCA compound layer that detects
multi-phase intent (e.g., "알아보고 써줘") and routes to `/second-claude-code:pdca`
before falling through to single-skill matching.

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

## Cross-Model Review (MMBridge) — Optional

The `--external` flag on `/second-claude-code:review` adds cross-model review via MMBridge.
**This is entirely optional** — the review skill works fully without MMBridge installed.

| Reviewer | Provider | Strength |
|----------|----------|----------|
| kimi-reviewer | Kimi (K2.5) | Deep web research, BrowseComp 60.6% |
| qwen-reviewer | Qwen | Security analysis |
| gemini-reviewer | Gemini | Design and visual review |
| codex-reviewer | Codex | Code-focused one-shot review |

Each external reviewer operates through MMBridge's context-aware multi-turn protocol. Results are merged into the consensus gate alongside internal reviewers.

### MMBridge Flow

```
Review Dispatch
├── Internal (always)
│   ├── Xatu / deep-reviewer (opus)
│   ├── Absol / devil-advocate (sonnet)
│   ├── Porygon / fact-checker (haiku)
│   ├── Jigglypuff / tone-guardian (haiku)
│   └── Unown / structure-analyst (haiku)
│
├── External (--external flag)
│   ├── kimi-reviewer (via mmbridge)
│   ├── qwen-reviewer (via mmbridge)
│   ├── gemini-reviewer (via mmbridge)
│   └── codex-reviewer (via mmbridge)
│
└── Consensus Gate
    ├── Merge internal + external findings
    ├── Deduplicate overlapping issues
    ├── Apply severity calibration
    └── Emit verdict: APPROVED | MINOR FIXES | NEEDS IMPROVEMENT | MUST FIX
```
