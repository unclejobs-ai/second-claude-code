# Architecture

## What's New in 0.5.0

Two additions shipped in this release (on top of 0.4.0):

1. **Soul System** — 10th skill (`/scc:soul`) builds and maintains a persistent user identity profile. Voice, tone rules, and anti-patterns are injected into the write skill and tone-guardian reviewer.
2. **Playwright MCP** — Optional browser automation server added to `.claude-plugin/plugin.json`. When `WebFetch` fails on a JavaScript-heavy or dynamic URL, the researcher agent falls back to `browser_navigate` + `browser_snapshot` (accessibility tree extraction). Gracefully degrades if the server is not installed.

## What's New in 0.4.0

Five major additions shipped in this release:

1. **MCP State Server** — A 6-tool stdio MCP server (`mcp/pdca-state-server.mjs`) exposes PDCA state to any MCP-aware client. Tools: `get`, `start`, `transition`, `check_gate`, `end`, `update_stuck`.
2. **Critic Schema + Score-Based Consensus** — Reviewers now emit structured JSON (0.0–1.0 score, severity-tagged findings). Consensus gate switches from vote-count to score-primary: >= 0.7 average + no Critical findings = APPROVED.
3. **Six Lifecycle Hooks** — Hook count expanded from 3 to 6: SessionStart, UserPromptSubmit, SubagentStop, Stop, PreCompact, PostCompact. The two new compaction hooks preserve PDCA state across context compression; Stop hook (`hooks/stop.mjs`) blocks exit when Check phase is incomplete.
4. **StuckDetector** — Runtime anti-pattern detection catches Plan Churn, Check Avoidance, and Scope Creep before they waste cycles. Fires on every phase transition.
5. **Worktree Isolation** — Do phase now runs in an isolated `git worktree`. The working tree is merged on APPROVED verdict and discarded on MUST FIX, preventing partial work from polluting the main branch.

---

Second Claude Code is structured as a PDCA-native knowledge-work system.
The product-facing phases are `Gather → Produce → Verify → Refine`, which map
directly to `Plan → Do → Check → Act`.

| PDCA | Product Phase | Primary Skills |
|------|---------------|----------------|
| Plan | Gather | `research`, `analyze`*, `discover`, `collect` |
| Do | Produce | `analyze`*, `write`, `pipeline`, `batch` |
| Check | Verify | `review` |
| Act | Refine | `refine` |
| **Orchestrator** | **Full Cycle** | **`pdca`** |
| **Identity** | **Extend** | **`soul`** |

The `pdca` meta-skill orchestrates the full cycle with quality gates between each phase transition.
It auto-detects which phase to enter from natural language and chains the appropriate skills.

*`analyze` spans both phases: in Plan it synthesizes research findings; in Do it can apply a different framework for the production artifact.

## Directory Structure

```
second-claude/
├── .claude-plugin/plugin.json    # Plugin manifest — MCP servers: pdca-state, playwright (optional)
├── skills/                       # 11 skills (SKILL.md each)
│   ├── pdca/                     # PDCA cycle orchestrator (meta-skill)
│   │   └── references/           # Phase gates + action router + question protocol
│   ├── research/                 # Autonomous deep research (WebFetch + Playwright fallback)
│   │   └── references/           # research-methodology.md, playwright-guide.md
│   ├── write/                    # Content production
│   ├── analyze/                  # Strategic framework analysis (15 frameworks)
│   ├── review/                   # Multi-perspective quality gate
│   ├── refine/                   # Iterative improvement
│   ├── collect/                  # Knowledge collection (PARA)
│   ├── pipeline/                 # Custom workflow builder
│   ├── discover/                 # Skill discovery
│   ├── batch/                    # Parallel task decomposition and execution
│   │   └── references/           # Decomposition guide, split strategies, merge patterns
│   └── soul/                     # User identity profile synthesis
│       └── references/           # Observation signals, synthesis algorithm, templates
├── agents/                       # 17 specialized subagents (Pokemon-themed)
├── commands/                     # 11 slash command wrappers
├── hooks/                        # Auto-routing + context injection (6 hooks)
│   ├── hooks.json                # Hook configuration
│   ├── prompt-detect.mjs         # Natural language auto-router (UserPromptSubmit)
│   ├── session-start.mjs         # Session banner + state init (SessionStart)
│   ├── subagent-stop.mjs         # Reviewer consensus aggregation (SubagentStop)
│   ├── stop.mjs                  # Check-phase quality gate (Stop)
│   ├── pre-compact.mjs           # PDCA state snapshot before compaction (PreCompact)
│   └── post-compact.mjs          # PDCA state restore after compaction (PostCompact)
├── references/                   # Design principles, consensus gate
├── templates/                    # Output templates
├── scripts/                      # Shell utilities
└── config/                       # User configuration
```

| Directory | Role |
|-----------|------|
| `skills/` | Each skill has a `SKILL.md` (short, context-efficient) plus a `references/` subdirectory for deep documentation. Progressive disclosure in action. |
| `skills/pdca/` | Meta-skill with phase gate checklists, Action Router, and Question Protocol in `references/`. |
| `agents/` | 17 Pokemon-themed subagent definitions across 3 model tiers. See Agent Roster below. |
| `commands/` | Thin wrappers that route `/second-claude-code:*` invocations to the matching skill. |
| `hooks/` | Session lifecycle hooks and the two-layer auto-routing engine (PDCA compound patterns + single-skill patterns). |
| `references/` | Shared knowledge: design principles, consensus gate spec, PARA method. |

---

## Agent Roster — Pokemon Edition

17 specialized subagents across 3 model tiers, themed as Pokemon.
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
│    Action Router:     Route to Plan, Do, or Refine           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Supporting commands reinforce the same loop:

- `pdca` orchestrates the full cycle with quality gates and the Action Router
- `collect` keeps source material and notes available for the next planning cycle
- `discover` expands the system when the current skill set is not enough
- `pipeline` automates full Gather → Produce → Verify → Refine runs
- `batch` decomposes large homogeneous tasks into parallel units executed concurrently in isolated worktrees
- `soul` builds and maintains a persistent user identity profile from observed behavioral signals

---

## PDCA Phase Gates

The `pdca` meta-skill enforces quality gates at each phase transition:

```
Plan ──[Gate: Brief exists? Analysis exists? Sources ≥3?]──→ Do
  Do ──[Gate: Artifact complete? Format OK? Research used?]──→ Check
Check ──[Gate: Verdict routing]──→ Act (or Exit if APPROVED)
  Act ──[Action Router: classify root cause]──→ Plan / Do / Refine
Refine ──[Gate: Target met?]──→ Exit (or present options)
```

### Action Router (Act Phase)

The Action Router classifies review findings by root cause before routing:

| Finding Category | Route | Rationale |
|-----------------|-------|-----------|
| SOURCE_GAP, ASSUMPTION_ERROR, FRAMEWORK_MISMATCH | Plan | Fundamental issues need more research |
| COMPLETENESS_GAP, FORMAT_VIOLATION | Do | Execution issues need rewrite |
| EXECUTION_QUALITY | Refine | Polish issues need iteration |

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

The `--interactive` flag on `/second-claude-code:research` forces Playwright for every URL, bypassing WebFetch entirely. Useful for SPA dashboards or news sites with heavy JavaScript rendering.

### Cost control

Max **3 Playwright navigations per research round**. Exceeding the cap triggers a hard stop on further navigations; remaining URLs are noted in Gaps & Limitations.

### Accessibility tree advantage

`browser_snapshot()` returns a structured accessibility tree rather than raw HTML. Token cost is 80-90% lower than equivalent HTML for the same information. The researcher extracts headings, paragraphs, and table cells directly from the tree — navigation chrome and ads are structurally excluded.

See `skills/research/references/playwright-guide.md` for full tool reference and patterns.
