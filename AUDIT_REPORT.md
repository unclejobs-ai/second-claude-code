# Second-Claude-Code Project Audit
**Generated**: 2026-03-22
**Version Audited**: 0.3.0
**Status**: Production-ready with documented gaps

---

## 1. PLUGIN STRUCTURE

### Plugin Manifest
- **Location**: `.claude-plugin/plugin.json`
- **Name**: `second-claude-code`
- **Version**: 0.3.0
- **Author**: Park Eungje
- **License**: MIT
- **Repository**: https://github.com/EungjePark/second-claude-code

### Directory Layout
```
second-claude-code/
├── .claude-plugin/
│   ├── plugin.json           # Plugin manifest (primary)
│   └── marketplace.json      # Marketplace metadata
├── skills/                    # 9 core skills (SKILL.md each)
│   ├── pdca/                 # Meta-skill orchestrator + phase gates
│   ├── research/             # Autonomous web research
│   ├── analyze/              # Strategic framework analysis
│   ├── write/                # Content production
│   ├── review/               # Quality review gate
│   ├── loop/                 # Iterative improvement
│   ├── collect/              # Knowledge collection (PARA)
│   ├── pipeline/             # Custom workflow builder
│   └── hunt/                 # Skill discovery & installation
├── agents/                    # 16 Pokemon-themed subagent specs
├── commands/                  # 9 slash command wrappers
├── hooks/                     # Session lifecycle + auto-routing
│   ├── hooks.json            # Hook configuration
│   ├── session-start.mjs     # Context injection + state restoration
│   ├── prompt-detect.mjs     # Two-layer auto-router
│   ├── session-end.mjs       # Handoff generation
│   └── lib/utils.mjs         # Shared utilities
├── references/               # Shared design & methodology docs
├── templates/                # Output templates + pipeline presets
├── scripts/                  # Environment detection shell scripts
├── config/                   # Configuration examples
├── docs/                     # User documentation (EN + KO)
└── tests/                    # Test suite (contracts, integration, e2e)
```

### Registered Commands (9 Skills)
All commands are invoked as `/second-claude-code:{skill-name}`:

| Command | SKILL.md Path | Status |
|---------|---------------|--------|
| `pdca` | `skills/pdca/SKILL.md` | ✓ Complete |
| `research` | `skills/research/SKILL.md` | ✓ Complete |
| `analyze` | `skills/analyze/SKILL.md` | ✓ Complete |
| `write` | `skills/write/SKILL.md` | ✓ Complete |
| `review` | `skills/review/SKILL.md` | ✓ Complete |
| `loop` | `skills/loop/SKILL.md` | ✓ Complete |
| `collect` | `skills/collect/SKILL.md` | ✓ Complete |
| `pipeline` | `skills/pipeline/SKILL.md` | ✓ Complete |
| `hunt` | `skills/hunt/SKILL.md` | ✓ Complete |

---

## 2. SKILLS INVENTORY

### Overview
**Total Skills**: 9 (8 domain + 1 orchestrator)
**Principle**: Few but Deep — each skill internally orchestrates multiple subagents and search rounds.

### Skill Definitions

#### PDCA (Meta-Skill)
- **File**: `skills/pdca/SKILL.md`
- **Description**: PDCA cycle orchestrator with auto-phase detection and quality gates
- **Internal Flow**: Auto-detects phase → chains skills → enforces gates between transitions
- **Phase Mapping**:
  - `PLAN` (Gather): research + analyze
  - `DO` (Produce): write (with `--skip-research --skip-review`)
  - `CHECK` (Verify): review
  - `ACT` (Refine): action router → loop
- **Key Features**:
  - Phase-aware gate enforcement (load from `references/plan-phase.md`, `do-phase.md`, `check-phase.md`, `act-phase.md`)
  - Question Protocol (max 3 clarifying questions, optional with `--no-questions`)
  - Plan Mode briefing + approval flow
  - Action Router (root cause classification: SOURCE_GAP → Plan, COMPLETENESS_GAP → Do, EXECUTION_QUALITY → Loop)
  - State persistence: `${CLAUDE_PLUGIN_DATA}/state/pdca-active.json`
- **Options**: `--phase`, `--depth`, `--target`, `--max`, `--no-questions`
- **Reference Documents**:
  - `skills/pdca/references/plan-phase.md` (checklist)
  - `skills/pdca/references/do-phase.md` (checklist)
  - `skills/pdca/references/check-phase.md` (checklist)
  - `skills/pdca/references/act-phase.md` (checklist)
  - `skills/pdca/references/action-router.md` (root cause routing)
  - `skills/pdca/references/question-protocol.md` (question guidelines)

#### Research
- **File**: `skills/research/SKILL.md`
- **Description**: Autonomous multi-round web research with structured synthesis
- **Internal Flow**:
  - Dispatch researcher (haiku) → WebSearch (5-10 queries)
  - Dispatch analyst (sonnet) → gap identification
  - Optional 2nd round if gaps found (depth-dependent)
  - Dispatch writer (sonnet) → synthesis into Research Brief
- **Depth Behavior**:
  - `shallow`: 3 WebSearch calls, no WebFetch, no gap analysis
  - `medium`: 5 WebSearch + 2 WebFetch, one gap round
  - `deep`: 10+ WebSearch, unlimited WebFetch, max 3 gap-fill rounds
- **Key Features**:
  - Coverage requirements (min 3 data points per major topic)
  - Data conflict resolution rules
  - Source domain filtering (`web`, `academic`, `news`)
  - Auto-save to `.captures/research-{slug}-{YYYY-MM-DD}.md`
- **Options**: `--depth`, `--sources`, `--lang`
- **Reference**: `skills/research/references/research-methodology.md`

#### Analyze
- **File**: `skills/analyze/SKILL.md`
- **Description**: Strategic framework analysis with challenge rounds
- **Supported Frameworks** (15 total):
  - SWOT, RICE, OKR, PRD, Lean Canvas, Persona, Journey Map, Pricing
  - GTM, North Star, Porter, PESTLE, Ansoff, Battlecard, Value Prop
- **Internal Flow**:
  - Framework auto-detection (from prompt or `--framework` flag)
  - Gather sources (internal files + web search for external entities)
  - Dispatch strategist (sonnet) → apply framework with evidence
  - Challenge Round 1: dispatch devil-advocate (sonnet) → attack 3 weakest points
  - Challenge Round 2 (deep only): source audit
  - Synthesis with recommended actions
- **Depth Levels**:
  - `quick`: template only, no research, no challenge
  - `standard`: template + challenge round 1
  - `thorough`: full research + 2 challenge rounds
- **Source Requirements**: Min 3 data points per quadrant, inline citations, observable facts (not reputation)
- **Auto-save** to `.captures/analyze-{framework}-{slug}-{YYYY-MM-DD}.md`
- **Options**: `--framework`, `--with-research`, `--depth`, `--skip-challenge`, `--lang`
- **Reference**: `skills/analyze/references/challenge-round.md` + 15 framework templates

#### Write
- **File**: `skills/write/SKILL.md`
- **Description**: Content production with automatic research and review
- **Supported Formats** (6 total):
  - Newsletter (min 2000 words, 6-stage arc), Article (3000), Report (4000, numbered recommendations)
  - Shorts (300 words + CTA), Social (platform-native), Card News (slide-by-slide)
- **Voices** (3 presets):
  - `peer-mentor` (default: newsletter), `expert` (default: report/article), `casual` (default: shorts/social/card-news)
- **Internal Flow**:
  - Run research (unless `--skip-research` or `--input` provided)
  - Load format spec + voice guide
  - Dispatch writer (opus) → draft content
  - Run review (mandatory unless `--skip-review`) with `--preset quick`
  - Dispatch editor (opus) → apply Critical + Major fixes
- **Length Negotiation**: When user length conflicts with format minimum, offer switch to different format or accept user's length with metadata note
- **Auto-save** to `.captures/write-{format}-{slug}-{YYYY-MM-DD}.md`
- **Notion Integration**: `--publish notion` requires Notion MCP connection
- **Options**: `--format`, `--voice`, `--publish`, `--skip-research`, `--skip-review`, `--lang`, `--input`
- **Voice Guides**: `skills/write/references/voice-guides/{peer-mentor,expert,casual}.md`
- **Format Specs**: `skills/write/references/formats/{newsletter,article,report,shorts,social,card-news}.md`

#### Review
- **File**: `skills/review/SKILL.md`
- **Description**: Multi-perspective quality review with parallel specialist reviewers and consensus gate
- **Reviewers** (5 roles):
  - Xatu (deep-reviewer, opus): logic, structure, completeness
  - Absol (devil-advocate, sonnet): weakest 3 points, blind spots
  - Porygon (fact-checker, haiku): claims, numbers, sources (with WebSearch)
  - Jigglypuff (tone-guardian, haiku): voice and audience fit
  - Unown (structure-analyst, haiku): organization and readability
- **Presets**:
  - `content`: Xatu + Absol + Jigglypuff (2/3 threshold)
  - `strategy`: Xatu + Absol + Porygon (2/3 threshold)
  - `code`: Xatu + Absol + Unown (2/3 threshold)
  - `quick`: Absol + Porygon (2/2 unanimous)
  - `full`: all 5 (3/5 threshold)
- **Consensus Gate**:
  - Verdict routing: APPROVED → exit; MINOR FIXES → address; NEEDS IMPROVEMENT → rework; MUST FIX → required
  - Any Critical finding forces MUST FIX
  - Reviewers dispatched independently (no cross-reviewer context)
- **Output Format**: Findings with location, severity (Critical/Major/Minor), description, fix suggestion
- **Severity Calibration**: See `references/consensus-gate.md` for detailed criteria
- **Deduplication**: See `references/consensus-gate.md` for overlapping finding rules
- **External Review** (optional): `--external` flag activates MMBridge cross-model reviewers (Kimi, Qwen, Gemini, Codex)
- **Options**: `--preset`, `--threshold`, `--strict`, `--external`
- **Reference**: `skills/review/references/consensus-gate.md`

#### Loop
- **File**: `skills/loop/SKILL.md`
- **Description**: Iterative improvement until draft meets quality target
- **Internal Flow**:
  - Read current file, record baseline hash + git tracking status
  - Run `/second-claude-code:review` (real dispatch, not inline)
  - Apply top 3 feedback items
  - Re-run review, keep new baseline if verdict improves, else revert
  - Stop if target met, `--max` reached, or verdict plateaus (same for 2 iterations)
  - Completion gate: run `/second-claude-code:review --preset quick` → must get APPROVED or MINOR FIXES
- **Revert Strategy**:
  - Git-tracked files: `git checkout -- <file>`
  - Non-git files: restore from `baseline_content` in `loop-active.json`
- **State Persistence**: `${CLAUDE_PLUGIN_DATA}/state/loop-active.json`
- **Options**: `--max`, `--target`, `--promise`, `--file`, `--review`
- **Gotchas**: Mandatory final review gate, real review dispatch required, git-based revert only

#### Collect
- **File**: `skills/collect/SKILL.md`
- **Description**: Knowledge capture & PARA organization with connection linking
- **Workflow**:
  - Detect source type (URL, text, file, search query)
  - Dispatch analyst (haiku) → extract + reduce to 3 key points + summary
  - Dispatch connector (haiku) → find specific shared concept (independent from analyst)
  - Classify into PARA (Project/Area/Resource/Archive)
  - Save as .json (machine-readable) + .md (YAML frontmatter + prose)
- **PARA Criteria**:
  - `project`: active work with deadline/deliverable
  - `area`: ongoing responsibility
  - `resource`: reference material
  - `archive`: inactive material
- **Connection Quality Gate**: Must name specific principle/pattern, not generic topic
- **Storage**: `${CLAUDE_PLUGIN_DATA}/knowledge/{para-category}/{slug}.{json,md}`
- **Search**: `/second-claude-code:collect --search "query"` with ranking weights
- **Subagent Dispatch**: Both analyst + connector must run as separate subagents (context isolation)
- **Options**: `--tags`, `--category`, `--search`, `--connect`
- **Reference**: `skills/collect/references/para-method.md`

#### Pipeline
- **File**: `skills/pipeline/SKILL.md`
- **Description**: Custom workflow builder for chaining skills with runtime parameterization
- **Subcommands**:
  - `create`: define a pipeline (confirms definition + variables)
  - `run`: execute saved pipeline (accepts `--topic`, `--output_dir`, `--var` flags)
  - `list`: show all pipelines (table with name, step count, last run)
  - `show`: inspect pipeline (resolves variables if `--topic` provided)
  - `delete`: remove a pipeline
- **Variables**: `{{topic}}`, `{{date}}`, `{{output_dir}}`, `{{run_id}}`, custom `--var key=value`
- **Execution Model**:
  - Resolve variables at start (abort if any remain unresolved)
  - Identify parallel groups (consecutive steps with `parallel: true`)
  - Run sequential steps as fresh subagents, pass data via files
  - Save run state after each step
  - Resume from saved state if interrupted
- **Presets** (built-in templates):
  - `autopilot`: research → analyze → write → review → loop (end-to-end)
  - `quick-draft`: research → write (fast first draft)
  - `quality-gate`: review → loop (post-hoc quality check)
- **Constraints**:
  - Max 10 steps per pipeline
  - Every step must declare `output`
  - Circular reference detection at create-time
  - Step compatibility via `input_from` / `output`
  - All `{{variables}}` must resolve
  - Valid skill references required
  - `on_fail: retry` allows 2 retries max (3 total attempts)
- **State**: `${CLAUDE_PLUGIN_DATA}/pipelines/{name}-run.json` + `state/pipeline-active.json`
- **Reference**: `skills/pipeline/references/pipeline-definition.md`

#### Hunt
- **File**: `skills/hunt/SKILL.md`
- **Description**: Skill discovery with external marketplace search (safe, non-auto-install)
- **Workflow**:
  - Check built-in capabilities first (if built-in tools suffice, skip external search)
  - Scan local skills by name/description
  - Search external sources in priority order (GitHub repos → npm → web)
  - Candidate inspection: fetch + read README/SKILL.md for top 3
  - Score on weighted criteria (relevance 30%, popularity 20%, recency 20%, dependencies 15%, trust 15%)
  - Apply build-vs-install threshold (scores <3.0 → recommend custom pipeline)
  - Present ranked options with pinned versions, wait for approval
- **Source Prioritization**:
  - Local `skills/` (Tier 1, trust=5)
  - GitHub repos with SKILL.md (Tier 2, trust=4)
  - npm packages with `claude-code` keyword (Tier 3, trust=3)
  - Web search (Tier 4, trust=2)
- **Safety Checks**:
  - No auto-install (pin exact versions)
  - Flag postinstall scripts, obfuscated code
  - Flag heavy/stale packages, missing LICENSE
  - Degrade gracefully when marketplce CLIs unavailable
- **Output**: Ranked list + save to `${CLAUDE_PLUGIN_DATA}/hunts/{query-slug}.json`
- **Options**: (no flags, natural language triggered)
- **Reference**: `skills/hunt/references/hunt-scoring.md`

### Skill Composition
Skills are composable building blocks. Internal call graph:

```
write
  ├── calls research (unless --skip-research)
  └── calls review (unless --skip-review)

analyze
  ├── calls research (if --with-research)
  └── internal: challenge-round via devil-advocate

pdca
  ├── calls research (Plan phase)
  ├── calls analyze (Plan phase)
  ├── calls write (Do phase, with --skip-research --skip-review)
  ├── calls review (Check phase)
  └── calls loop (Act phase, if needed)

pipeline
  └── calls any skill as step

loop
  └── calls review (for iterative cycles)
```

---

## 3. AGENT INVENTORY

### Overview
**Total Agents**: 16 (Pokemon-themed across 3 model tiers)
**Philosophy**: Each agent is a specialized role optimized for a specific task.

### Complete Agent Roster

#### Production Agents (Plan / Do Phase)

| Agent | Pokemon | Model | File | Role | PDCA Phase |
|-------|---------|-------|------|------|-----------|
| researcher | Eevee | haiku | `agents/eevee.md` | Web search, multi-source data collection | Gather |
| analyst | Alakazam | sonnet | `agents/alakazam.md` | Pattern recognition, data synthesis | Produce |
| strategist | Mewtwo | sonnet | `agents/mewtwo.md` | Strategic framework application | Produce |
| writer | Smeargle | opus | `agents/smeargle.md` | Long-form content production | Produce |
| editor | Ditto | opus | `agents/ditto.md` | Content refinement, targeted edits | Refine |

#### Review Agents (Check Phase)

| Agent | Pokemon | Model | File | Role | PDCA Phase |
|-------|---------|-------|------|------|-----------|
| deep-reviewer | Xatu | opus | `agents/xatu.md` | Logic, structure, completeness | Verify |
| devil-advocate | Absol | sonnet | `agents/absol.md` | Weak points, blind spots | Verify |
| fact-checker | Porygon | haiku | `agents/porygon.md` | Claims, numbers, sources | Verify |
| tone-guardian | Jigglypuff | haiku | `agents/jigglypuff.md` | Voice and audience fit | Verify |
| structure-analyst | Unown | haiku | `agents/unown.md` | Organization, readability | Verify |

#### Pipeline & Hunt Agents

| Agent | Pokemon | Model | File | Role | PDCA Phase |
|-------|---------|-------|------|------|-----------|
| orchestrator | Arceus | sonnet | `agents/arceus.md` | Pipeline orchestration | Produce |
| step-executor | Machamp | sonnet | `agents/machamp.md` | Single pipeline step execution | Produce |
| searcher | Noctowl | haiku | `agents/noctowl.md` | External source search | Gather |
| inspector | Magnezone | sonnet | `agents/magnezone.md` | Skill candidate inspection | Gather |
| evaluator | Deoxys | sonnet | `agents/deoxys.md` | Skill candidate scoring | Gather |
| connector | Abra | haiku | `agents/abra.md` | Knowledge linking (collect) | Extend |

### Model Distribution

| Tier | Count | Use Case |
|------|-------|----------|
| opus (most capable) | 3 | Deep review (Xatu), long-form writing (Smeargle), editorial (Ditto) |
| sonnet (balanced) | 7 | Analysis, strategy, orchestration, adversarial review, pipeline execution, hunting |
| haiku (fast, cheap) | 6 | Search, data extraction, fact-checking, classification, knowledge linking |

### Agent Dispatch Patterns

**Research Skill** (multi-agent sequential):
1. Eevee (researcher, haiku) → WebSearch calls
2. Alakazam (analyst, sonnet) → gap identification
3. Eevee again (if gaps + depth allows) → supplemental research
4. Smeargle (writer, sonnet) → synthesis

**Analyze Skill** (sequential with feedback):
1. Mewtwo (strategist, sonnet) → apply framework
2. Absol (devil-advocate, sonnet) → challenge round 1
3. Mewtwo (if deep depth) → secondary challenge

**Review Skill** (parallel with consensus gate):
- Xatu, Absol, Porygon, Jigglypuff, Unown dispatched in parallel
- Each receives only content, no cross-reviewer context
- Consensus gate merges findings + deduplicates

**Loop Skill** (iterative cycling):
- Ditto (editor, opus) → apply feedback
- Review skill → re-evaluate (not a subagent, a full skill call)

**Collect Skill** (dual independent subagents):
- Analyst (haiku) → extract key points (context isolation required)
- Connector (haiku) → find concept links (must not see analyst output)

**Pipeline Skill** (orchestration):
- Arceus (orchestrator, sonnet) → coordinate step execution
- Machamp (step-executor, sonnet) → execute individual steps

**Hunt Skill** (sequential inspection):
1. Noctowl (searcher, haiku) → external source search
2. Magnezone (inspector, sonnet) → read/verify candidates
3. Deoxys (evaluator, sonnet) → score and rank

---

## 4. HOOK SYSTEM

### Hook Configuration
**File**: `hooks/hooks.json`

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs\"",
            "async": false
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/prompt-detect.mjs\"",
            "async": false
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/session-end.mjs\"",
            "async": true
          }
        ]
      }
    ]
  }
}
```

### Hook 1: SessionStart (`hooks/session-start.mjs`)

**Trigger**: On session startup (startup, resume, clear, compact matchers)

**Responsibilities**:
1. Inject 9-skill overview + routing rules into context
2. Restore active state (if any):
   - Active loop (`loop-active.json`)
   - Active pipeline (`pipeline-active.json`)
   - Active PDCA cycle (`pdca-active.json`)
3. Detect environment capabilities (via `scripts/detect-environment.sh`)

**Output**: Markdown context injection showing:
- Skills table with brief descriptions
- Active loop/pipeline/PDCA state (if any)
- Detected capabilities (git, npm, gh, etc.)

### Hook 2: UserPromptSubmit (`hooks/prompt-detect.mjs`)

**Trigger**: On every user prompt (unless starts with `/`)

**Responsibility**: Two-layer auto-routing to inject skill routing instructions before Claude responds

**Layer 1: PDCA Compound Detection**
- Pattern matching for multi-phase intent (Korean + English)
- Examples: "알아보고", "조사하고 써", "research and write", "review and fix"
- Output: Routes to `/second-claude-code:pdca` with phase hint
- 16 patterns detected (see `prompt-detect.mjs` lines 27-46)

**Layer 2: Single-Skill Detection**
- Pattern matching for single-skill requests
- Korean keywords per skill (ko.research, ko.write, ko.analyze, etc.)
- English keywords per skill
- Routes to specific skill with priority-based matching
- 8 route entries with pattern arrays (see `prompt-detect.mjs` lines 97-138)

**Fallback**: If no match found, still injects generic skill-check guidance (all skills + development skills for context)

**Output**: JSON `additionalContext` containing:
- Specific routing instruction (if matched)
- Generic skill-check guidance (always included as fallback)
- Directs Claude to invoke Skill tool BEFORE responding

### Hook 3: Stop (`hooks/session-end.mjs`)

**Trigger**: On session end

**Responsibility**: Persistence of active state across sessions

**Actions**:
1. Collect active state from `state/` directory:
   - Loop: iteration count, goal, scores
   - Pipeline: name, step, status
   - PDCA: topic, phase, completed phases
2. Generate `HANDOFF.md` with:
   - Active state summary
   - Resumption hints (commands to re-enter state)
3. Append generated timestamp

**Output**: Writes `.data/HANDOFF.md` summarizing what to resume in next session

### Utilities
**File**: `hooks/lib/utils.mjs`

Shared functions:
- `sanitize(str)`: Clean strings for safe output
- `readJsonSafe(path)`: Parse JSON with error handling

---

## 5. MCP INTEGRATIONS

### Current Integrations (Optional)

#### MMBridge (External Reviewers)
- **Optional feature**: `--external` flag on `/second-claude-code:review`
- **Status**: Entirely optional — review skill works fully without it
- **Reviewers** (via MMBridge):
  - kimi-reviewer (Kimi K2.5): Deep web research, BrowseComp 60.6%
  - qwen-reviewer (Qwen): Security analysis
  - gemini-reviewer (Gemini): Design and visual review
  - codex-reviewer (Codex): Code-focused review

#### Notion Integration
- **Optional feature**: `--publish notion` flag on `/second-claude-code:write`
- **Status**: Entirely optional — write skill saves locally without it
- **Requires**: Configured Notion MCP connection (`mcp__claude_ai_Notion__notion-create-pages`)

#### Built-in Tools (Always Available)
- **Read**: File and PDF reading (up to 20 pages per request)
- **Write**: File writing
- **Bash**: Shell command execution
- **WebSearch**: Multi-source web search (primary research tool)
- **WebFetch**: Full-page content extraction (secondary research tool)
- **Glob**: File pattern matching

### No Other External Dependencies
**Design Principle**: Zero Dependency Core

The core 8 workflows run without installing external packages. Optional marketplace discovery (hunt skill) gracefully degrades when external CLIs are unavailable.

---

## 6. KEY WORKFLOWS

### PDCA Cycle Flow (Full End-to-End)

```
User: "Research AI agents and write a report"
                    ↓
            prompt-detect.mjs
            (Layer 1: PDCA compound match)
                    ↓
         /second-claude-code:pdca
                    ↓
        ┌─────────────────────────────┐
        │  PLAN (Gather)              │
        │  - Question Protocol (3 max) │
        │  - Dispatch Eevee → research │
        │  - Dispatch Alakazam → analyze│
        │  - Dispatch Mewtwo → strategy │
        │  ↓ EnterPlanMode briefing    │
        │  ↓ User approval needed      │
        └─────────────────────────────┘
               ↓ Gate: Brief + Analysis
        ┌─────────────────────────────┐
        │  DO (Produce)               │
        │  - Dispatch Smeargle → write │
        │    (--skip-research --skip-review)
        │  - Uses Plan artifacts      │
        └─────────────────────────────┘
               ↓ Gate: Complete artifact
        ┌─────────────────────────────┐
        │  CHECK (Verify)             │
        │  - Dispatch 5 parallel      │
        │    reviewers (Xatu, Absol,  │
        │    Porygon, Jigglypuff,     │
        │    Unown)                   │
        │  - Consensus gate (2/3 pass)│
        └─────────────────────────────┘
               ↓ Gate: Read verdict
        ┌─────────────────────────────┐
        │  ACT (Refine)               │
        │  - Action Router classifies  │
        │    root cause:              │
        │    • SOURCE_GAP → PLAN      │
        │    • COMPLETENESS_GAP → DO  │
        │    • QUALITY → LOOP         │
        │  - Dispatch Ditto → loop    │
        └─────────────────────────────┘
               ↓ Gate: Target met?

        [EXIT with final artifact]
```

### Research Pipeline Flow

```
/second-claude-code:research --depth medium

Phase 1: Initial Search (Eevee - haiku)
  - Execute 5 WebSearch calls (medium = hard cap)
  - Varying query phrasings

Phase 2: Analysis (Alakazam - sonnet)
  - Structure findings
  - Identify gaps + contradictions
  - Apply Data Conflict Resolution

Phase 3: Gap-Fill (conditional)
  - If medium depth + gaps exist:
    - Dispatch Eevee again (3-5 additional searches)
  - If shallow depth: skip entirely
  - If deep: max 3 gap-fill rounds

Phase 4: Synthesis (Smeargle - sonnet)
  - Synthesize findings into Research Brief
  - Verify search count ≤ depth limit
  - Save to .captures/

Output: Research Brief with sources + confidence levels
```

### Writing Pipeline Flow

```
/second-claude-code:write --format article --skip-research

Phase 1: Load Specs
  - Read format spec: skills/write/references/formats/article.md
  - Read voice guide: skills/write/references/voice-guides/expert.md
  - (Or default voice if not specified)

Phase 2: Research (conditional)
  - If --skip-research NOT set AND no --input:
    - Call /research (inherited --lang value)
  - If --skip-research set BUT no --input:
    - Warn user: "No source material provided"

Phase 3: Draft (Smeargle - opus)
  - Follow format rules (3000 word minimum for article)
  - Match voice guide (sentence patterns, vocabulary, tone)
  - Trace every claim back to research brief

Phase 4: Review (mandatory unless --skip-review)
  - Call /review --preset quick
  - Get feedback from reviewers

Phase 5: Edit (if review findings exist)
  - Dispatch Ditto → apply Critical + Major fixes
  - Re-read for coherence

Phase 6: Save
  - Path: .captures/write-{format}-{slug}-{YYYY-MM-DD}.md
  - Tell user the path

Output: Polished final article
```

### Loop (Iterative Improvement) Flow

```
/second-claude-code:loop --file draft.md --target APPROVED --max 3

Iteration N:
  1. Read file, record baseline + git tracking status
  2. Dispatch review (real skill call, not inline)
  3. Get ranked feedback
  4. Apply top 3 items only (Ditto - opus)
  5. Re-run review
  6. If verdict improves → keep changes, update baseline
     If verdict same/worse → revert (git checkout or restore from baseline_content)
  7. Check stop condition:
     - Target met? Exit.
     - Max iterations reached? Exit.
     - Verdict plateaus (same 2 consecutive)? Exit.
  8. Final gate: run /review --preset quick
     - APPROVED or MINOR FIXES? Exit.
     - MUST FIX or NEEDS IMPROVEMENT? Continue loop.

Output: Final draft + iteration log with verdict progression
```

### Review Consensus Gate Flow

```
/second-claude-code:review --preset content

Dispatch Phase (parallel):
  1. Xatu (deep-reviewer, opus) → logic/structure
  2. Absol (devil-advocate, sonnet) → 3 weakest points
  3. Jigglypuff (tone-guardian, haiku) → voice fit

  (Each gets ONLY content, no cross-reviewer context)

Collection Phase:
  - Gather 3 independent review outputs
  - Each finding: location, severity, description, fix

Deduplication Phase:
  - Overlapping findings → merge, keep higher severity
  - Exact duplicates → collapse to single entry

Consensus Gate Phase:
  - Threshold: 2/3 (for 3-reviewer preset)
  - Any Critical finding → MUST FIX (override threshold)
  - Threshold met + no Critical → APPROVED
  - Threshold met + Major issues → MINOR FIXES
  - Threshold NOT met + no Critical → NEEDS IMPROVEMENT
  - Any Critical → MUST FIX

Output Verdict:
  - APPROVED: ship as-is
  - MINOR FIXES: top 3 only (quick refinement)
  - NEEDS IMPROVEMENT: substantial rework needed
  - MUST FIX: critical issues block shipping
```

### Pipeline Execution Flow

```
/second-claude-code:pipeline run autopilot --topic "AI agents" --depth medium

Variable Resolution:
  - {{topic}} → "AI agents"
  - {{date}} → today's date
  - {{output_dir}} → current directory
  - {{run_id}} → "autopilot-{timestamp}"

Step 1: research (input: none)
  - Output: research-brief.md
  - Dispatch Eevee with "{{topic}}" and "--depth {{depth}}"

Step 2: analyze (input_from: research-brief.md)
  - Read research-brief.md
  - Run framework analysis with --with-research
  - Output: analysis.md

Step 3: write (input_from: analysis.md)
  - Read analysis.md
  - Run write with --skip-research --skip-review
  - Output: draft.md

Step 4: review (input_from: draft.md)
  - Read draft.md
  - Run review --preset content
  - Output: review-report.md

Step 5: loop (input_from: [draft.md, review-report.md])
  - Read both files
  - Run loop --max 3 --target APPROVED
  - Output: final.md

State Persistence:
  - After each step: save ${CLAUDE_PLUGIN_DATA}/pipelines/autopilot-run.json
  - Resume from saved step on interrupt

Output: final.md (final reviewed and refined article)
```

### Action Router Classification

From `skills/pdca/references/action-router.md`:

```
Review Finding → Root Cause Classification → Route Decision

Finding: "Research didn't cover X"
→ Root cause: SOURCE_GAP
→ Route: Back to PLAN (run research again)

Finding: "Missing section on implementation"
→ Root cause: COMPLETENESS_GAP
→ Route: Back to DO (rewrite to include section)

Finding: "Argument is weak in section 3"
→ Root cause: EXECUTION_QUALITY
→ Route: LOOP (iterative refinement)

Finding: "Assumption about market size is unverified"
→ Root cause: ASSUMPTION_ERROR
→ Route: Back to PLAN (gather data)

Finding: "Format doesn't match spec"
→ Root cause: FORMAT_VIOLATION
→ Route: Back to DO (reformat)
```

---

## 7. CURRENT LIMITATIONS & GAPS

### Design Limitations (Intentional)

1. **Maximum 10 steps per pipeline** (`skills/pipeline/SKILL.md` line 74)
   - Rationale: Prevent runaway orchestrations
   - Mitigation: Split oversized workflows into smaller pipelines

2. **Max 3 questions in Question Protocol** (`skills/pdca/SKILL.md` line 24)
   - Rationale: Prevent decision-paralysis in planning
   - Mitigation: Unanswered questions → save assumptions and proceed

3. **Max 3 gap-fill rounds in research** (`skills/research/SKILL.md` line 53)
   - Rationale: Prevent infinite research loops
   - Mitigation: Document gaps and proceed to synthesis

4. **Max 3 iterations in loop** (`skills/loop/SKILL.md` line 29, default)
   - Rationale: Prevent diminishing returns
   - Mitigation: Override with `--max` flag

### Known Issues (From HANDOFF.md)

1. **Content Contract Failure**: `skills/analyze/references/frameworks/ansoff.md`
   - Issue: Missing expected final section (`## Recommended Actions` or equivalent)
   - Status: Test is currently failing on this file
   - Impact: Fast test suite is not fully green
   - Expected Fix: Add final section to match other framework templates

### Incomplete Features

1. **Loop Skill - Review Dispatch**
   - **Status**: Documented but needs hardening
   - **Issue**: Review was historically simulated inline
   - **Fix in Progress**: Mandate real review dispatch + git-based revert
   - **File**: `skills/loop/SKILL.md` (Plan 2026-03-20 Task 3)

2. **Analyze Skill - Format Conflicts**
   - **Status**: Not yet fully hardened
   - **Issue**: Write skill format minimums vs user requested length
   - **Fix in Progress**: Explicit negotiation rule
   - **File**: `skills/write/SKILL.md` (Plan 2026-03-20 Task 2)

3. **Consensus Gate - Verdict Ambiguity**
   - **Status**: Spec exists but needs clarification
   - **Issue**: MINOR FIXES verdict too harsh for threshold not met + no Critical
   - **Fix in Progress**: Add NEEDS_IMPROVEMENT verdict
   - **File**: `references/consensus-gate.md` (Plan 2026-03-20 Task 1)

### Missing Documentation

1. **Detailed Skill Pages** (docs/skills/)
   - EN + KO pairs: research, write, analyze, review, loop, collect, pipeline, hunt
   - Status: Partially complete (some exist, others in progress)
   - Priority: High (for user onboarding)

2. **MMBridge Configuration Guide**
   - Status: Not documented (architecture.md mentions it, but no setup guide)
   - Impact: Optional feature, degraded gracefully without it

3. **Hunt Skill Marketplace Examples**
   - Status: Spec exists, no worked examples
   - Impact: Users unsure how to use hunt for discovery

### Test Coverage Gaps

1. **Fast Suite** (`node --test tests/**/*.test.mjs`)
   - Status: Has contract failures (analyze framework templates)
   - Coverage: Skills, hooks, contracts

2. **E2E Suite** (`RUN_CLAUDE_CLI_E2E=1 node --test tests/e2e/...`)
   - Status: Passing (slow, ~60 seconds)
   - Coverage: Real Claude CLI slash commands
   - Commands verified: `/second-claude-code:research`, `review`, `analyze`, `write`

3. **Integration Suite** (`tests/integration/skill-flow.test.mjs`)
   - Status: Exists, detailed coverage unclear
   - Focus: Skill composition and data flow

### External Dependencies

**None in core** (Zero Dependency Core principle).

Optional integrations:
- MMBridge (external reviewers) — gracefully optional
- Notion MCP (write publishing) — gracefully optional
- Built-in tools (Read, WebSearch, Bash) — always available

---

## 8. DIRECTORY STRUCTURE (COMPLETE)

```
second-claude-code/
├── .claude-plugin/
│   ├── plugin.json                 # Primary plugin manifest
│   └── marketplace.json            # Marketplace metadata
│
├── skills/                         # 9 core skills
│   ├── pdca/
│   │   ├── SKILL.md               # Meta-skill definition
│   │   ├── gotchas.md             # Not found (could exist)
│   │   └── references/
│   │       ├── plan-phase.md      # Plan gate checklist
│   │       ├── do-phase.md        # Do gate checklist
│   │       ├── check-phase.md     # Check gate checklist
│   │       ├── act-phase.md       # Act gate checklist
│   │       ├── action-router.md   # Root cause routing logic
│   │       └── question-protocol.md # Question guidelines
│   │
│   ├── research/
│   │   ├── SKILL.md
│   │   ├── gotchas.md
│   │   └── references/
│   │       └── research-methodology.md
│   │
│   ├── analyze/
│   │   ├── SKILL.md
│   │   ├── gotchas.md
│   │   ├── references/
│   │   │   ├── challenge-round.md
│   │   │   └── frameworks/         # 15 framework templates
│   │   │       ├── swot.md
│   │   │       ├── rice.md
│   │   │       ├── okr.md
│   │   │       ├── prd.md
│   │   │       ├── lean-canvas.md
│   │   │       ├── persona.md
│   │   │       ├── journey-map.md
│   │   │       ├── pricing.md
│   │   │       ├── gtm.md
│   │   │       ├── north-star.md
│   │   │       ├── porter.md
│   │   │       ├── pestle.md
│   │   │       ├── ansoff.md
│   │   │       ├── battlecard.md
│   │   │       └── value-prop.md
│   │
│   ├── write/
│   │   ├── SKILL.md
│   │   ├── gotchas.md
│   │   └── references/
│   │       ├── formats/
│   │       │   ├── newsletter.md
│   │       │   ├── article.md
│   │       │   ├── report.md
│   │       │   ├── shorts.md
│   │       │   ├── social.md
│   │       │   └── card-news.md
│   │       └── voice-guides/
│   │           ├── peer-mentor.md
│   │           ├── expert.md
│   │           └── casual.md
│   │
│   ├── review/
│   │   ├── SKILL.md
│   │   ├── gotchas.md
│   │   └── references/
│   │       └── consensus-gate.md
│   │
│   ├── loop/
│   │   ├── SKILL.md
│   │   └── gotchas.md
│   │
│   ├── collect/
│   │   ├── SKILL.md
│   │   ├── gotchas.md
│   │   └── references/
│   │       └── para-method.md
│   │
│   ├── pipeline/
│   │   ├── SKILL.md
│   │   ├── gotchas.md
│   │   └── references/
│   │       └── pipeline-definition.md
│   │
│   └── hunt/
│       ├── SKILL.md
│       ├── gotchas.md
│       └── references/
│           └── hunt-scoring.md
│
├── agents/                         # 16 subagent specs (Pokemon-themed)
│   ├── eevee.md                   # researcher
│   ├── alakazam.md                # analyst
│   ├── mewtwo.md                  # strategist
│   ├── smeargle.md                # writer
│   ├── ditto.md                   # editor
│   ├── xatu.md                    # deep-reviewer
│   ├── absol.md                   # devil-advocate
│   ├── porygon.md                 # fact-checker
│   ├── jigglypuff.md              # tone-guardian
│   ├── unown.md                   # structure-analyst
│   ├── arceus.md                  # orchestrator
│   ├── machamp.md                 # step-executor
│   ├── noctowl.md                 # searcher
│   ├── magnezone.md               # inspector
│   ├── deoxys.md                  # evaluator
│   └── abra.md                    # connector
│
├── commands/                       # 9 slash command wrappers
│   ├── pdca.md
│   ├── research.md
│   ├── analyze.md
│   ├── write.md
│   ├── review.md
│   ├── loop.md
│   ├── collect.md
│   ├── pipeline.md
│   └── hunt.md
│
├── hooks/                          # Session lifecycle + auto-routing
│   ├── hooks.json                 # Hook configuration
│   ├── session-start.mjs          # SessionStart hook
│   ├── prompt-detect.mjs          # UserPromptSubmit hook (auto-router)
│   ├── session-end.mjs            # Stop hook
│   └── lib/
│       └── utils.mjs              # Shared utilities
│
├── references/                     # Shared documentation
│   ├── design-principles.md       # 9 core principles
│   ├── consensus-gate.md          # Review verdicts + deduplication
│   ├── agent-catalog-notes.md     # Agent roster + extensions
│   ├── para-method.md             # PARA knowledge system
│   ├── hunt-scoring.md            # Hunt evaluation weights
│   ├── challenge-round.md         # Analysis challenge protocol
│   ├── research-methodology.md    # Research conflict resolution
│   ├── pipeline-definition.md     # Pipeline schema
│   ├── guidance-schema.md         # Agent authoring guide
│   └── lineage.md                 # Design sources and influences
│
├── templates/                      # Output templates + presets
│   ├── autopilot-pipeline.json    # End-to-end workflow
│   ├── quick-draft.json           # Research + write
│   ├── quality-gate.json          # Review + loop
│   ├── weekly-report-pipeline.json # Custom template
│   ├── research-brief.md          # Output format
│   ├── swot.md                    # Output format
│   └── newsletter.md              # Output format
│
├── scripts/                        # Shell utilities
│   └── detect-environment.sh      # Environment capability detection
│
├── config/                         # Configuration
│   └── config.example.json        # Example configuration
│
├── docs/                           # User documentation
│   ├── architecture.md            # System design overview
│   ├── demo.tape                  # Terminal recording script
│   ├── images/
│   │   ├── hero.svg               # Skill wheel
│   │   ├── agent-roster.svg       # Agent diagram
│   │   └── pdca-cycle.svg         # Cycle diagram
│   │
│   └── skills/                     # Detailed skill pages (EN + KO)
│       ├── research.md
│       ├── research.ko.md
│       ├── write.md
│       ├── write.ko.md
│       ├── analyze.md
│       ├── analyze.ko.md
│       ├── review.md
│       ├── review.ko.md
│       ├── loop.md
│       ├── loop.ko.md
│       ├── collect.md
│       ├── collect.ko.md
│       ├── pipeline.md
│       ├── pipeline.ko.md
│       ├── hunt.md
│       ├── hunt.ko.md
│       └── pdca.md / pdca.ko.md (if exists)
│
├── tests/                          # Test suite
│   ├── hooks/
│   │   ├── session-start.test.mjs
│   │   ├── session-end.test.mjs
│   │   └── prompt-detect.test.mjs
│   │
│   ├── contracts/
│   │   └── skill-contracts.test.mjs  # [FAILING] ansoff.md section
│   │
│   ├── integration/
│   │   └── skill-flow.test.mjs
│   │
│   ├── e2e/
│   │   └── claude-cli-slash.test.mjs  # [PASSING]
│   │
│   ├── runtime/
│   │   └── plugin-smoke.test.mjs
│   │
│   └── skill-tests/                  # Test outputs (reference)
│       ├── research-test-output.md
│       ├── write-test-output.md
│       ├── analyze-test-output.md
│       ├── review-test-output.md
│       ├── loop-test-output.md
│       ├── collect-test-output.md
│       ├── hunt-test-output.md
│       └── pipeline-test-output.md
│
├── .data/                          # Plugin data (runtime)
│   ├── state/
│   │   ├── loop-active.json       # Active loop state
│   │   ├── pipeline-active.json   # Active pipeline state
│   │   └── pdca-active.json       # Active PDCA state
│   │
│   ├── knowledge/                 # PARA knowledge base
│   │   ├── projects/
│   │   ├── areas/
│   │   ├── resources/
│   │   └── archives/
│   │
│   ├── pipelines/                 # Pipeline definitions + runs
│   │   ├── {name}.json            # Pipeline definition
│   │   └── {name}-run.json        # Pipeline execution state
│   │
│   ├── hunts/                     # Hunt search results
│   │   └── {query-slug}.json
│   │
│   ├── HANDOFF.md                 # Session handoff (generated at Stop)
│   └── ...other capture files
│
├── .captures/                      # Output artifacts (generated)
│   ├── research-{slug}-{date}.md
│   ├── analyze-{framework}-{slug}-{date}.md
│   ├── write-{format}-{slug}-{date}.md
│   └── ...other outputs
│
├── .gitignore                      # Git ignore rules
├── LICENSE                         # MIT License
├── README.md                       # English readme
├── README.ko.md                    # Korean readme
├── CHANGELOG.md                    # Version history
├── HANDOFF.md                      # Session state (top-level)
└── AUDIT_REPORT.md                # This file

```

---

## 9. TEST FRAMEWORK

### Test Organization

| Suite | File(s) | Status | Purpose |
|-------|---------|--------|---------|
| **Fast Suite** | `tests/**/*.test.mjs` | ⚠️ Failing | Unit + contract tests |
| **E2E Suite** | `tests/e2e/claude-cli-slash.test.mjs` | ✅ Passing | Real Claude CLI validation |
| **Smoke** | `tests/runtime/plugin-smoke.test.mjs` | Status unclear | Basic plugin health |

### Fast Suite Failures

**File**: `tests/contracts/skill-contracts.test.mjs`

**Failure**: `analyze framework templates use the standardized section layout`
- **Issue**: `skills/analyze/references/frameworks/ansoff.md` missing final section
- **Expected**: `## Recommended Actions` or equivalent
- **Impact**: Blocks all contract tests from passing

**Resolution**: Add final section to ansoff.md template to match other frameworks

### Running Tests

```bash
# Fast suite (local, 1-2 minutes)
node --test tests/**/*.test.mjs

# E2E suite (real Claude CLI, ~60 seconds)
RUN_CLAUDE_CLI_E2E=1 node --test tests/e2e/claude-cli-slash.test.mjs

# All tests
node --test tests/**/*.test.mjs && RUN_CLAUDE_CLI_E2E=1 node --test tests/e2e/...
```

---

## 10. DESIGN PRINCIPLES (Governance)

From `references/design-principles.md`:

### Nine Core Principles

1. **Few but Deep**: 9 skills (8 domain + 1 orchestrator), not eighty. Each skill orchestrates multiple subagents internally. Small surface, high depth.

2. **Gotchas over Instructions**: Every SKILL.md includes a Gotchas section documenting failure modes and mitigations. Spend as much time on gotchas as on happy-path docs.

3. **Progressive Disclosure**: SKILL.md is the quick reference (<120 lines). `references/` directory holds deep dives. Users don't need references to use skills; references exist for those who want to understand or extend.

4. **Context-efficient**: Every token costs money. Skill descriptions <15 tokens. Dynamic context via backtick injection pulls only what's needed. If a skill exceeds 2000 tokens including context, refactor it.

5. **Zero Dependency Core**: Core 8 workflows run without installing packages. Optional marketplace discovery (hunt) gracefully degrades when external CLIs unavailable.

6. **State in Files**: All persistent state lives in JSON within `CLAUDE_PLUGIN_DATA`. No databases, no external services, no environment variables for state. File-based state is inspectable and versionable.

7. **Composable**: 8 core skills are building blocks. `/write` calls `/research` internally. `/loop` wraps any skill in iteration. `/pipeline` chains arbitrary sequences. Composition is the primary extension mechanism.

8. **PDCA-Native**: Every output cycles through Verify (review) and Refine (loop). Skills improve themselves through the cycle they serve. Never declare work complete without a Check verdict.

9. **Action Router**: Review failures route by root cause: research gaps → Plan, execution gaps → Do, polish → Loop. Classification prevents blind iteration on symptoms.

### Principle Interactions

- **Few but deep** + **composable** = small surface, infinite combinations
- **Gotchas** + **progressive disclosure** = safe usage without reading walls of text
- **Context-efficient** + **zero dependency** = fast, cheap, portable
- **State in files** + **zero dependency** = no setup, no infra
- **PDCA-native** + **action router** = intelligent cycle routing, not blind iteration

### Priority When Conflicting

1. Zero Dependency Core (highest)
2. Context-efficient
3. Few but deep
4. Others

---

## 11. KEY REFERENCE DOCUMENTS (Map)

| Document | Path | Purpose |
|----------|------|---------|
| **Architecture Overview** | `docs/architecture.md` | System design, agent roster, PDCA phases |
| **Design Principles** | `references/design-principles.md` | 9 core governance principles |
| **Consensus Gate Spec** | `references/consensus-gate.md` | Review verdict routing, deduplication |
| **PARA Method** | `references/para-method.md` | Knowledge classification system |
| **Research Methodology** | `references/research-methodology.md` | Depth behavior, conflict resolution |
| **Hunt Scoring** | `references/hunt-scoring.md` | Evaluation weights, thresholds |
| **Challenge Round** | `references/challenge-round.md` | Analysis stress-testing protocol |
| **Pipeline Definition** | `references/pipeline-definition.md` | Schema, variables, execution model |
| **Lineage** | `references/lineage.md` | Design influences and sources |
| **Guidance Schema** | `references/guidance-schema.md` | Agent authoring guide |

---

## 12. SUMMARY & RECOMMENDATIONS

### What's Complete ✓
- **Core Architecture**: 9 skills fully defined, spec-compliant
- **Agent System**: 16 specialized agents with clear role definitions
- **Hook System**: Two-layer auto-routing (PDCA compound + single-skill)
- **PDCA Cycle**: Quality gates, phase orchestration, action routing
- **E2E Validation**: Real Claude CLI slash commands verified

### What Needs Attention ⚠️
1. **Fix ansoff.md** template (add final section) to pass contract tests
2. **Harden Loop skill** - mandate real review dispatch (not inline simulation)
3. **Write skill negotiation** - explicit conflict handling for format vs user length
4. **Consensus gate clarification** - add NEEDS_IMPROVEMENT verdict
5. **Complete docs/skills/** pages (EN + KO) for user onboarding

### Quality Metrics
- **Architecture Maturity**: 9/10 (few minor spec clarifications needed)
- **Test Coverage**: 7/10 (E2E passing, fast suite has 1 failure)
- **Documentation**: 8/10 (SKILL.md complete, user guides 80% done)
- **Agent Design**: 9/10 (comprehensive roster, clear role mapping)
- **Composability**: 9/10 (skills chain seamlessly, state persistence solid)

### Next Priority (from docs/plans/2026-03-20)
1. Phase 1: Fix 3 design bugs (2-3 hours)
2. Phase 2: Create detailed skill pages (4-6 hours)
3. Regression testing after fixes
4. Mark v0.3.0 stable

---

**End of Audit Report**
