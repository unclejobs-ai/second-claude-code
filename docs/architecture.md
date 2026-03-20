# Architecture

Second Claude Code is structured as a PDCA-native knowledge-work system.
The product-facing phases are `Gather → Produce → Verify → Refine`, which map
directly to `Plan → Do → Check → Act`.

| PDCA | Product Phase | Primary Skills |
|------|---------------|----------------|
| Plan | Gather | `research`, `hunt`, `collect` |
| Do | Produce | `analyze`, `write`, `pipeline` |
| Check | Verify | `review` |
| Act | Refine | `loop` |
| **Orchestrator** | **Full Cycle** | **`pdca`** |

The `pdca` meta-skill orchestrates the full cycle with quality gates between each phase transition.
It auto-detects which phase to enter from natural language and chains the appropriate skills.

## Directory Structure

```
second-claude/
├── .claude-plugin/plugin.json    # Plugin manifest (v0.2.0)
├── skills/                       # 9 skills (SKILL.md each)
│   ├── pdca/                     # PDCA cycle orchestrator (meta-skill)
│   ├── research/                 # Autonomous deep research
│   ├── write/                    # Content production
│   ├── analyze/                  # Strategic framework analysis (15 frameworks)
│   ├── review/                   # Multi-perspective quality gate
│   ├── loop/                     # Iterative improvement
│   ├── collect/                  # Knowledge collection (PARA)
│   ├── pipeline/                 # Custom workflow builder
│   └── hunt/                     # Skill discovery
├── agents/                       # 16 specialized subagents
├── commands/                     # 8 slash command wrappers
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
| `skills/pdca/` | Meta-skill that orchestrates the full PDCA cycle with phase gate checklists in `references/`. |
| `agents/` | 16 subagent definitions across 3 model tiers. See Agent Roster below. |
| `commands/` | Thin wrappers that route `/second-claude-code:*` invocations to the matching skill. |
| `hooks/` | Session lifecycle hooks and the two-layer auto-routing engine (PDCA compound patterns + single-skill patterns). |
| `references/` | Shared knowledge: design principles, consensus gate spec, PARA method. |

---

## Agent Roster

16 specialized subagents across 3 model tiers:

### Production Agents

| Agent | Model | PDCA Phase | Role |
|-------|-------|------------|------|
| researcher | haiku | Gather | Web search and multi-source data collection |
| analyst | sonnet | Produce | Pattern recognition and data synthesis |
| strategist | sonnet | Produce | Strategic framework application (SWOT, Porter, etc.) |
| writer | opus | Produce | Long-form content creation |
| editor | opus | Refine | Content editing and quality improvement |

### Review Agents

| Agent | Model | PDCA Phase | Role |
|-------|-------|------------|------|
| deep-reviewer | opus | Verify | Logic, structure, and completeness |
| devil-advocate | sonnet | Verify | Attacks weakest points and blind spots |
| fact-checker | haiku | Verify | Verifies claims, numbers, and sources |
| tone-guardian | haiku | Verify | Voice and audience fit |
| structure-analyst | haiku | Verify | Organization and readability |

### Pipeline & Hunt Agents

| Agent | Model | PDCA Phase | Role |
|-------|-------|------------|------|
| orchestrator | sonnet | Produce | Pipeline step sequencing and state persistence |
| step-executor | sonnet | Produce | Single pipeline step execution |
| searcher | haiku | Gather | External source search for skills/packages |
| inspector | sonnet | Gather | Skill candidate README/SKILL.md inspection |
| evaluator | sonnet | Verify | Skill candidate scoring with weighted criteria |
| connector | haiku | Extend | Knowledge linking between new and existing items |

### Model Distribution

| Tier | Count | Use |
|------|-------|-----|
| opus | 3 | Deep review, long-form writing, editorial |
| sonnet | 7 | Analysis, strategy, orchestration, adversarial review |
| haiku | 6 | Search, data collection, fact-checking, classification |

---

## PDCA Agent Mapping

The agents map to the PDCA quality cycle that governs the knowledge work flow:

```
┌─────────────────────────────────────────────────────┐
│                   PDCA Cycle                        │
│                                                     │
│  Gather (Plan)     → researcher, searcher,          │
│                      inspector, connector           │
│                                                     │
│  Produce (Do)      → analyst, strategist, writer,   │
│                      orchestrator, step-executor    │
│                                                     │
│  Verify (Check)    → deep-reviewer, devil-advocate, │
│                      fact-checker, tone-guardian,    │
│                      structure-analyst, evaluator   │
│                                                     │
│  Refine (Act)      → editor                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Supporting commands reinforce the same loop:

- `pdca` orchestrates the full cycle with quality gates between each phase
- `collect` keeps source material and notes available for the next planning cycle
- `hunt` expands the system when the current skill set is not enough
- `pipeline` automates full Gather → Produce → Verify → Refine runs

---

## PDCA Phase Gates

The `pdca` meta-skill enforces quality gates at each phase transition:

```
Plan ──[Gate: Brief exists? Sources ≥3?]──→ Do
  Do ──[Gate: Artifact complete? Format OK?]──→ Check
Check ──[Gate: Verdict routing]──→ Act (or Exit if APPROVED)
  Act ──[Gate: Target met?]──→ Exit (or Cycle back to Plan)
```

Phase gate checklists live in `skills/pdca/references/`.
The `hooks/prompt-detect.mjs` auto-router has a PDCA compound layer that detects
multi-phase intent (e.g., "알아보고 써줘") and routes to `/second-claude-code:pdca`
before falling through to single-skill matching.

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
│   ├── deep-reviewer (opus)
│   ├── devil-advocate (sonnet)
│   ├── fact-checker (haiku)
│   ├── tone-guardian (haiku)
│   └── structure-analyst (haiku)
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
