# Changelog

All notable changes to second-claude-code are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [1.4.0] - 2026-05-02

### Added — Cross-Plugin Orchestration (Phase 6)

- **Plugin Discovery Engine** (`hooks/lib/plugin-discovery.mjs`) — runtime scan of `~/.claude/plugins/installed_plugins.json` builds a dynamic capability map of all user-installed Claude Code plugins. Discovers skills, commands, MCP servers, and agents from any plugin's filesystem structure. No hardcoded registry — plugins appear and disappear as the user installs/uninstalls them.
- **4 New Orchestrator MCP Tools** (`mcp/lib/orchestrator-handlers.mjs`):
  - `orchestrator_list_plugins` — discover all installed plugins with full capability listings
  - `orchestrator_get_plugin` — detailed info on a specific plugin (skills, commands, MCP, agents, version, install path)
  - `orchestrator_route` — route task keywords or PDCA phases (plan/do/check/act) to matching external plugins. Returns actionable `Skill: plugin-skillname` dispatch instructions with auto-recommended top pick
  - `orchestrator_health` — ecosystem health check (plugin count, skill count, MCP availability)
- **Dynamic Dispatch Guide** — `generateDispatchGuide()` replaces the old hardcoded `<skill-check>` block in `prompt-detect.mjs` with a dynamically-generated per-phase plugin dispatch table. When plugins are installed or removed, the dispatch guide updates automatically. Each entry includes the exact `Skill: plugin-skillname` invocation string.
- **Active Plugin Dispatch in Session-Start** — session-start now injects a proactive `## Active Plugin Dispatch` section showing per-phase plugin routing. The orchestrator pre-computes which plugins handle which PDCA phases so Claude doesn't have to guess.
- **Actionable Auto-Dispatch** — `orchestrator_route` responses include a `dispatch` array with the top 10 most relevant `Skill:` / `/command:` invocation strings. Auto-recommendation tells Claude the top pick (e.g., `"Auto-dispatch top pick: Skill: coderabbit-code-review"`).
- **PDCA Phase Auto-Routing** — check phase → coderabbit/codex/agent-teams/caveman, act phase → commit-commands/caveman, do phase → frontend-design/frontend-design-pro, plan phase → claude-mem/agent-teams

### Added — Soul Feedback Binding (Phase 5)

- **3 New Soul MCP Tools**:
  - `soul_retro` — collect git shipping metrics across projects (commits, streak, peak hours, commit size profiles, trend detection). Supports explicit project paths or auto-detection of sibling git repos with recent commits
  - `soul_get_synthesis_context` — prepare recency-weighted observations, shipping retro entries, current profile, drift pre-check, and readiness assessment for the soul proposal phase
  - `soul_get_readiness` — lightweight threshold check (30 observations OR 10 sessions = synthesis ready)
- **Soul Feedback Loop Binding in Session-Start** — replaces basic soul injection with a full feedback loop gauge showing visual progress bars, retro/shipping summary, and synthesis call-to-action
- **Soul Readiness & Retro Utilities** (`hooks/lib/soul-observer.mjs`) — `readSoulReadiness()` and `readLatestRetro()` for lightweight hook-side soul state queries without importing MCP handlers

### Fixed

- Retro trend detection: `raw_text` field now checked as fallback when `raw_context` is missing
- Explicit empty `projects: []` no longer triggers auto-detection of sibling repos
- Retro observations now include `category: "shipping"` for proper filtering in `soul_get_observations`
- Session-start command banner deduplication: soul command references from feedback binding section no longer cause test failures

### Verification

- **354 tests** (343 pass, 0 fail, 1 skipped) — 12 new tests for orchestrator handlers, 9 new tests for soul handlers
- Verified against 14 real Claude Code plugins (67 discovered skills, 3 MCP servers)
- `orchestrator_route phase=check` correctly dispatches → `Skill: coderabbit-code-review`
- `orchestrator_route phase=act` correctly dispatches → `/commit-commands:commit-push-pr`

## [1.3.0] - 2026-04-07

### Added

- **PDCA Domain Auto-Routing** — `skills/pdca/SKILL.md` now detects domain trigger keywords (스레드/threads, 뉴스레터/newsletter, 쇼츠/shorts, 카드뉴스/card news) and dispatches the matching specialized sub-skill inside the Do phase. PDCA stays in charge as the orchestrator; sub-skills are building blocks called inside its phases. Greedy matching ensures the most specialized sub-skill always wins over generic `/scc:write`.
- **Hard length floors per format** — `references/do-phase.md` defines minimum + target character counts for 11 output formats. The Do gate now fails if the artifact is below the floor, preventing sparse output from reaching the reviewer. Floors range from 1,800 chars (shorts script) to 10,000 chars (Korean newsletter), all calibrated against reader-value, source-utilization, and AI-hedge prevention benchmarks.
- **Plan brief floors** — `references/plan-phase.md` raises source minimum from 3 to 5, adds discrete fact count (≥8), named quote count (≥1), comparison table count (≥1), media inventory count (≥1, for content briefs). Brief char count floor of 3,000 prevents thin Plan→thin Do failure chains.
- **Reviewer model diversity rule** — `references/check-phase.md` requires at least 2 distinct models with at least 1 external model (Codex, Kimi, Qwen, Gemini, Droid) for `content`/`strategy`/`full` presets. Diversity score must be ≥0.6 when more than 2 reviewers run. Prevents false consensus by structurally enforcing independent perspectives.
- **False consensus detection** — when all reviewers return APPROVED with average score >0.9 and no critical findings, an adversarial pass with an unused external model is automatically dispatched before exit. Catches Goodhart-style "everyone said it's fine" failure mode.
- **5+ Rule for patch vs full rewrite (calibrated AND logic)** — `references/act-phase.md` adds a hard rewrite trigger when (a) any P0 finding exists OR (b) `p0+p1 ≥ 5` AND findings span ≥3 categories. Calibrated from initial OR logic after observing over-trigger on surgical 4-finding patch sets in real verification runs. Examples table covers 10 finding configurations.
- **Sub-skill input/output contracts** — new `references/domain-pipeline-integration.md` (284 lines) standardizes how PDCA's Do dispatcher invokes sub-skills (`/threads`, `/newsletter`, `/academy-shorts`, `/card-news`, `/scc:write`). Defines input contract, DoOutput verification, failure handling (4 failure modes), and integration points with adjacent phases.
- **Pokemon role label clarification** — `skills/pdca/SKILL.md` Subagents block now explicitly states that role labels (Eevee, Smeargle, Xatu, etc.) are conceptual and not direct Agent tool dispatch targets. Real subagent dispatch happens inside `/scc:research`, `/scc:write`, `/scc:review`, `/scc:refine`. Prevents past failure mode where the orchestrator tried to call `Agent(subagent_type: "eevee")` and silently fell back to self-processing.
- **Expanded DoOutput schema** — `references/phase-schemas.md` adds `char_count` (body only), `section_count`, `meets_length_floor`, `meets_section_floor`, `references_count` to DoOutput. Added `brief_char_count`, `facts_count`, `quotes_count`, `comparison_tables_count`, `media_inventory_count`, `meets_brief_floor` to PlanOutput. Added `distinct_models_count`, `external_model_count`, `diversity_score`, `false_consensus_check_passed`, `p0_count`, `p1_count`, `p2_count` to CheckOutput. PDCA verifies all of these independently from the sub-skill's self-report.

### Changed

- **PDCA framing** — SKILL.md replaces the implicit "PDCA hands off to sub-skills" framing with an explicit "PDCA is the main orchestrator, sub-skills are building blocks called inside its phases" architecture. Sub-skill internal phases now run inside PDCA's Do phase rather than replacing PDCA. PDCA's Check still runs independently after the sub-skill's internal review (different perspective, different blind spots).
- **Do phase Skill Selection table** — replaced single `/scc:write` row with greedy matching algorithm that prioritizes domain-specific sub-skills (`/threads`, `/newsletter`, `/academy-shorts`, `/card-news`) before falling back to generic `/scc:write`.
- **Check phase reviewer requirements** — minimum reviewer count remains 2, but model diversity is now enforced as a hard contract instead of a soft suggestion. External model requirement is mandatory for content/strategy/full presets.
- **5+ Rule logic** — initial release used OR logic (`volume_threshold OR category_threshold`) which over-triggered on patch-sized 4-finding sets. Calibrated to AND for the volume+spread path and a separate hard credibility path (any P0). Verified against 10 finding configurations; calibrated path passes 6/6 vs original 3/6.
- Version surfaces aligned to `1.3.0` across plugin manifest, package metadata, marketplace, and documentation.

### Fixed

- **Phantom agent dispatch** — past failure mode where the orchestrator interpreted Pokemon role labels in SKILL.md as actual subagent_type values, attempted to dispatch them, silently fell back to self-processing when dispatch failed, and produced sparse output. Fixed by explicit clarification that role labels are conceptual; real dispatch happens inside chained skills.
- **Sparse Do output approval** — past failure mode where `word_count > 0` was the only Do gate check, allowing 1,500-char articles to pass and reach the reviewer who then "approved" structurally insufficient artifacts. Fixed by introducing format-specific length floors that fail the Do gate before any reviewer is dispatched.
- **Single-reviewer false consensus** — past failure mode where 2 internal Claude reviewers both said APPROVED on the same model and the cycle exited prematurely. Fixed by enforcing distinct models AND at least 1 external model for content presets.

### Verification Cycle (2026-04-07)

A verification PDCA cycle was run on a generic topic (no domain trigger) to test the strengthening end-to-end. Baseline comparison is "pre-v1.3.0 soft-gate behavior" (v1.0.0 through v1.2.0 did not touch PDCA phase gates):

| Metric | pre-v1.3.0 baseline | v1.3.0 actual | Improvement |
|--------|---------------------|---------------|-------------|
| Plan brief char count | 0 (no brief produced) | 7,981 | +∞ |
| Plan facts catalogued | 0 | 14 | +14 |
| Plan sources cited | 0 | 12 | +9 over floor |
| Plan named quotes | 0 | 2 | floor ×2 |
| Do article char count (body) | ~1,500 (estimated, self-processed) | 6,962 | +364% |
| Do H2 sections | 1-2 | 7 | +250% |
| Do references count | 0-3 | 10 | +233% |
| Reviewer count | 0 (self-review) | 2 (parallel) | — |
| External model reviewers | 0 | 1 (Codex GPT-5.4) | — |
| Cross-review P1 findings caught | 0 | 4 | — |
| Diversity score | n/a | 1.0 | meets ≥0.6 |

The verification cycle also revealed an over-trigger in the initial 5+ Rule OR logic, which was immediately corrected to AND logic in the same release.

## [1.2.0] - 2026-04-06

### Added
- **Dashboard artifact type** — composite `dashboard` artifact combining KPI cards, charts, and markdown in configurable grid layouts (`2x2`, `3x1`, `1x2`, etc.)
- **KPI card component** — large numbers with change rate indicators, color coding (green/red/gray), and trend arrows for at-a-glance metrics
- **Grid layout system** — artifacts positioned in responsive grids (`2x2`, `3x1`, `2x1`) instead of single-column stacking, with column span support
- **Phase preview cards** — thumbnail summaries of each phase's artifacts visible in timeline view before clicking
- **Concurrent chart + markdown display** — charts and text render side-by-side in the artifact grid without tab switching
- **Chart hover tooltips** — interactive tooltips on all Nivo chart types (bar, line, pie, radar) with dark-themed styling
- **Artifact type icons** — visual indicators for each artifact type in card headers
- **Animated transitions** — Framer Motion enter/exit animations on artifacts, phase indicators, and connection status

### Changed
- **Viewer source code** — complete `ui/src` Vite + React + TypeScript project replacing the opaque pre-built bundle
  - Modular component architecture: 13 components across 4 directories
  - Type-safe artifact system with discriminated union types
  - Code-split builds: Nivo, Shiki (lazy-loaded), and vendor chunks
  - Path alias (`@/`) for clean imports
- **Shiki lazy loading** — syntax highlighter loaded on-demand, reducing initial bundle from 1MB to 262KB
- **Server improvements** — CORS headers, SPA fallback routing, API endpoints (`/api/state`, `/api/artifacts`), 5-minute idle auto-stop
- Version surfaces aligned to `1.2.0` across plugin manifest, package metadata, marketplace, and documentation

## [1.1.0] - 2026-04-06

### Added
- **Artifact Viewer** — local web UI that renders PDCA pipeline outputs as interactive artifacts (`ui/dist/`, `ui/scripts/server.cjs`)
  - 4 artifact types: markdown, chart (bar/line/pie/radar via Nivo), flow diagram (SVG), code (Shiki syntax highlighting)
  - WebSocket real-time updates via `fs.watch` on session artifact directory
  - Responsive layout: desktop split panel (768px+), mobile draggable bottom sheet
  - Auto-stop after 30 minutes idle or when parent Claude Code process exits
  - Owner PID monitoring for automatic cleanup
- **Viewer skill** — `/second-claude-code:viewer` command to start the artifact viewer for any PDCA session
- **Viewer server** — zero-dependency Node.js HTTP + WebSocket server with SPA fallback, RFC 6455 frame encoding, and path traversal prevention

### Changed
- Version surfaces aligned to `1.1.0` across plugin manifest, package metadata, and documentation

## [1.0.0] - 2026-03-29

### Added
- **PDCA Cycle Memory** — structured memory that persists across PDCA cycles (`mcp/lib/cycle-memory.mjs`, 230+ lines)
  - Per-cycle directories with phase markdown (plan/do/check/act.md), events.jsonl, metrics.json
  - Zero-context standard: each file readable without prior context
  - 30-day time decay on insights (weight 1.0 → 0.0)
  - Category classification (process/technical/quality) with severity levels
  - Critical insight repetition (3+) triggers gotchas proposal in `.data/proposals/` (append, not overwrite)
  - `cycle_id` validation (integer 0-9999, path traversal prevention)
  - Graceful JSON parsing fallback on corrupted state files
- **3 new MCP tools**: `pdca_get_cycle_history`, `pdca_save_insight`, `pdca_get_insights`
- **Domain-aware PDCA starts** — `pdca_start_run` now accepts a `domain` parameter (`code`, `content`, `analysis`, `pipeline`) to enforce specialized stage contracts from the first phase
- **Full stage contracts for analysis and pipeline domains** — `config/stage-contracts.json` now defines I/O contracts, DoD, and rollback targets for all 4 domains across all 4 PDCA phases
- **MCP handler test coverage** — 8 new test files: cycle-memory (14), daemon-handlers (6), session-handlers (4), loop-handlers (4), pdca-analytics (6)

### Fixed
- **CI debug step removed** — stale "Debug hook subprocess" step removed from GitHub Actions workflow
- **AGENTS.md path references** — corrected `.Codex-plugin` → `.claude-plugin`, added `daemon/*.mjs` to syntax check
- **Test count alignment** — all documentation surfaces now reflect actual test counts
- **Stage contracts version** — bumped from stale `0.6.0` to `1.0.0`
- **Cycle memory hardening** — path traversal prevention, malformed JSON resilience, correct critical-only gotcha trigger, negative last_n guard

### Changed
- Total test count: 194 → 323 (`322` passing, `1` skipped)
- Version surfaces aligned to `1.0.0` across plugin manifest, marketplace, package metadata, manuals, and CHANGELOG

## [0.9.0] - 2026-03-29

### Added
- **MetaClaw PRM agent effectiveness tracker** — added tracking for PRM agent performance and effectiveness over time

### Fixed
- **CI lock initialization** — `ensureDir` now runs before lock acquisition to avoid startup races
- **Portable spin wait** — spin-wait behavior is now portable across environments for more reliable CI execution

### Changed
- Total test count: 194 → 323 (`322` passing, `1` skipped in the current suite)
- Version surfaces aligned to `0.9.0` across plugin manifest, marketplace, package metadata, manuals, and CHANGELOG

## [0.8.0] - 2026-03-29

### Added
- **Stage contracts wired to runtime** — `loadContracts`, `getDoD`, and `getPhaseContract` now load `config/stage-contracts.json` at runtime
- **Optional MMBridge MCP registration** — `mmbridge` server added to `.claude-plugin/plugin.json` as an optional MCP dependency
- **MMBridge Adapter Protocol** — `Cli`, `Stub`, and `Recording` adapters added for controlled integration and testing
- **Anti-fabrication layer** — `fact-checker.mjs` added to harden factual verification
- **Soul and memory handler coverage** — new tests added for soul handlers and memory handlers

## [0.7.0] - 2026-03-29

### Added
- **HTML cycle report generator** — rich cycle reports with Chart.js, Mermaid, and dark-theme presentation
- **Terminal ANSI session summary** — session-end hook now emits an ANSI summary box in the terminal
- **File Mutation Queue** — synchronous cross-process coordination with async per-file execution
- **MAD-based confidence scoring** — loop benchmarks now use median absolute deviation for more robust confidence scoring
- **Loop budget limits** — cost and time caps added to the loop runner
- **Iterative compaction** — compaction preserves prior insights and previous summaries across repeated passes

### Changed
- **PDCA transition logic** — `pdca_transition` now supports `PIVOT` and `REFINE` decision paths

## [0.6.0] - 2026-03-29

### Added
- **Iron Laws + Red Flags for all 13 skills** — English safety and rigor guidance added across every skill
- **Stage Contracts** — added `config/stage-contracts.json` with domain-aware contracts for code vs. content workflows
- **Review threshold resolver** — `hooks/lib/review-config.mjs` centralizes preset threshold resolution
- **Translate glossary reference** — added `translate/references/glossary.md`
- **Regression coverage for hook flows** — 4 new test files for `subagent-stop`, `compaction`, `subagent-start`, and `stop-failure`

### Fixed
- **Consensus gate rounding** — corrected `Math.ceil` → `Math.round` so 2/3 consensus no longer requires 3/3
- **Score gate validation** — gate now requires both score and vote count before passing
- **Quick preset threshold** — `quick` preset now requires unanimous approval (`0.67` → `1.0`)
- **Compaction state preservation** — `workflow-active.json` is now preserved through compaction
- **Session-start banner completeness** — banner now includes `investigate` and `translate`, restoring 14/14 commands
- **Release hygiene** — fixed manifest `0.5.8` drift, 13-skill metadata, ghost directories, glossary issues, and Playwright pinning to `@0.0.68`

## [0.5.8] - 2026-03-28

### Added
- **`translate` skill** — bidirectional EN↔KO translation with `--style` (formal/casual/technical), `--format` (preserve/plain/markdown), glossary support, and soul-aware tone adaptation
- **`walnut.manifest.yaml`** — structured manifest for walnut integration

### Changed
- **MCP server modularization** — `pdca-state-server.mjs` refactored from 1311→553 lines; 6 handler modules extracted to `mcp/lib/` for maintainability
- **Translate routing patterns** — auto-router updated with translate skill trigger patterns (EN+KR)
- Skills: 12 → 13 (added translate), total tests: 194
- Version surfaces aligned to `0.5.8` across plugin manifest, READMEs, CLAUDE.md, and CHANGELOG

## [0.5.7] - 2026-03-28

### Added
- **MCP server test suite (72 tests)** — comprehensive coverage for pdca-state-server including transitions, gates, analytics, and edge cases
- **`pdca_list_runs` MCP tool** — query PDCA run history from the state server
- **`auto_gate` on `pdca_transition`** — automatic gate evaluation on phase transitions
- **Academic review preset** — specialized reviewer configuration for academic papers and research outputs
- **Confidence scoring** — routing decisions now include confidence scores for observability and correction
- **Routing correction soul observation** — soul system captures routing corrections for long-term learning
- **Benchmark CI** — automated benchmark suite in CI pipeline

### Fixed
- **package.json alignment** — version and metadata fields corrected
- **Audit cleanup** — resolved outstanding audit findings
- **Skill count fix** — corrected skill count reporting in session-start
- **Metadata fix** — aligned metadata across plugin surfaces
- **CI MCP coverage** — MCP server tests included in CI pipeline
- **Routing guard fix** — prevented false-positive routing on ambiguous prompts

### Changed
- Total test count: 87 → 194 (107 new tests including 72 MCP server tests)
- Version surfaces aligned to `0.5.7` across plugin manifest, READMEs, CLAUDE.md, and CHANGELOG

## [0.5.6] - 2026-03-25

### Added
- **Refine DoD (`--dod`) flag** — semicolon-separated success criteria checklist for the `refine` skill. Reviewers evaluate each criterion as PASS/FAIL per iteration; editor prioritizes failing criteria; refine exits only when all DoD criteria pass alongside the verdict target. Inspired by independent verification patterns. No behavior change without `--dod`.

### Changed
- Version surfaces aligned to `0.5.6` across plugin manifest, READMEs, architecture docs, and CHANGELOG

## [0.5.5] - 2026-03-24

### Fixed
- **MMBridge CLI alignment** — corrected invocation patterns across all skills to match mmbridge v0.6.3 CLI; `--export` now used only for `review`, other commands use `--json`, `--write`, or stdout redirect
- **Reference file deduplication** — synced 5 diverged reference file pairs between top-level and skill-level `references/` to the newer version
- **mmbridge gate invocation** — fixed `--format json --export` to `--format json >` in `check-phase.md`
- **mmbridge memory search flag** — fixed `--format json` to `--json` in `plan-phase.md`
- **MMBridge Embrace output format** — unified `pdca` SKILL.md and `mmbridge-integration.md` to both use `--json`

### Added
- **mmbridge-integration.md per-command table** — replaced incorrect universal `--export` pattern with per-command invocation table
- **resume command** (120s timeout) and **embrace command** (600s timeout) added to mmbridge-integration.md
- **PDCA Subagents section** — consolidated 11-agent YAML block added to `pdca` SKILL.md
- **MMBridge Embrace integration** — `pdca` skill documents `mmbridge embrace` for full-cycle multi-model acceleration at `--depth deep`
- **Soul templates** — `developer`, `writer`, `researcher` templates for the soul identity system

### Changed
- Version surfaces aligned to `0.5.5` across plugin manifest, marketplace, READMEs, and CLAUDE.md

## [0.5.4] - 2026-03-23

### Added
- **Daemon listing surfaces**: `list-jobs` / `list-runs` in the local daemon CLI plus matching MCP tools for job/run inspection
- **Workflow Phase 3 surface**: workflow docs and command wrapper now cover background runs, recurring scheduling, and session recall

### Fixed
- **Background run path traversal**: `run_id` is now normalized and rejected when it contains path segments or unsafe characters
- **Project memory prompt injection**: instruction-like memory entries are blocked on write and redacted on read before session-start injection
- **Notification regression under daemon heartbeat**: stdout notification contract remains active even when daemon queue mirroring is enabled
- **Prompt routing false positives**: engineering prompts no longer misroute to PDCA, refine, or workflow while schedule/background/recall prompts route correctly
- **Workflow state compatibility**: `session-start` again restores legacy `pipeline-active.json` state
- **Marketplace release metadata**: marketplace and plugin manifests are version-aligned for GitHub-based plugin delivery

## [0.5.3] - 2026-03-23

### Added
- **Companion daemon foundation**: local daemon CLI and state helpers for scheduling, background runs, notification routing, and session recall indexing
- **Project memory layer**: hook-side project memory snapshot/index helpers plus session-start context injection
- **Hermes boundary notes**: explicit operating guidance on borrowing runtime patterns without embedding a second runtime

### Changed
- Version surfaces aligned to `0.5.3` across the plugin manifest, READMEs, manuals, and agent-facing docs
- Architecture docs now describe the plugin/runtime boundary and the companion daemon substrate separately

## [0.5.0] - 2026-03-22

### Added
- **Soul system**: 10th skill (`/scc:soul`) — personal identity profile for voice, tone, and anti-patterns
- **Pikachu agent**: soul-profile writer agent (agents/pikachu.md)
- **SOUL.md**: user-generated identity document at `.data/soul/SOUL.md`
- **STYLE.md**: bilingual voice guide template at `.data/soul/templates/STYLE.md`
- **effort frontmatter**: skill-level effort hints (`low | medium | high`) injected into context
- **Dynamic context injection**: SOUL.md Tone Rules + Anti-Patterns fed into tone-guardian (Jigglypuff) and write skill voice resolution
- **Playwright MCP**: optional `@playwright/mcp` server registered in `.claude-plugin/plugin.json`. Researcher agent falls back to `browser_navigate` + `browser_snapshot` (accessibility tree) when `WebFetch` fails on JS-heavy or dynamic URLs. Gracefully degrades when not installed.
- **`--interactive` flag on research skill**: forces Playwright for all URL fetches (useful for SPAs and dashboards)
- **`playwright-guide.md`**: quick-reference for Playwright MCP tools and research usage patterns (`skills/research/references/`)
- **Playwright Fallback section**: decision tree + cost controls added to `skills/research/references/research-methodology.md`

### Fixed
- SubagentStop Critic Score aggregation dropping reviewers on partial output
- MCP `act` tool incorrectly triggering plan-mode instead of acceptEdits
- Atomic writes: temp-file + rename pattern preventing partial-write corruption
- SKILL.md bloat: pdca SKILL.md reduced 56% (excess prose removed)

### Changed
- 16 → 17 agents (Pikachu added)
- pdca SKILL.md: 56% size reduction via prose pruning
- write skill: Soul-Aware Voice Resolution priority ladder (--voice > SOUL.md > STYLE.md > format default)
- review skill: tone-guardian context includes SOUL.md Tone Rules and Anti-Patterns when available
- Jigglypuff (tone-guardian): personal soul rules take priority over generic voice guidelines

## [0.4.0] - 2026-03-22

### Added
- **Critic Schema**: Structured reviewer output with 0.0-1.0 scoring, severity-tagged findings, and score-based consensus (>= 0.7 + no Critical = APPROVED)
- **Phase Output Schemas**: PlanOutput/DoOutput/CheckOutput/ActOutput JSON schemas with gate validation
- **Phase-Scoped Permission Modes**: plan↔acceptEdits alternation enforcing read-only Plan/Check, writable Do/Act
- **StuckDetector**: 3 PDCA anti-patterns detected at runtime (Plan Churn, Check Avoidance, Scope Creep)
- **Stop Hook Quality Gate**: Blocks session termination when PDCA Check phase is incomplete
- **SubagentStop Hook**: Automatic reviewer consensus aggregation on subagent completion
- **Compaction Hooks**: PreCompact/PostCompact preserve PDCA state across context compression
- **Worktree Isolation**: Do phase runs in isolated git worktree with merge/discard per verdict
- **n_critic_runs**: Temperature escalation (standard→diverge→minimize) + best-of-N parallel variant selection
- **MCP State Server**: 6-tool stdio MCP server for PDCA state management (get/start/transition/check_gate/end/update_stuck)
- **Agent Teams Review**: --team-review option with challenge round for interactive reviewer deliberation
- **Session Resume**: session_id/session_history tracking with `claude --resume` suggestion in HANDOFF.md
- **Agent Auto Memory**: Eevee, Smeargle, Xatu accumulate learnings across sessions via `memory: project`
- **Action Router Korean**: Korean signal keywords for all classification categories + confidence threshold

### Fixed
- **CRITICAL**: Review `code` preset mismatch between SKILL.md and consensus-gate.md
- **HIGH**: Pipeline --topic/--var flag injection vulnerability
- `--constraints` flag missing from write skill Options table
- PDCA max_cycles ceiling (was unbounded, now default 3)
- `sanitize()` missing pipe, quote, and double-dash characters
- Korean hunt route false-positive patterns (방법, 어떻게 해)
- Loop revert destroying uncommitted changes without warning
- Research "cached per session" false documentation claim
- PDCA state missing run_id for concurrent execution
- Generic skill-check injecting ~400 tokens on every turn
- 6 support agents missing name/color frontmatter standardization
- readJsonSafe silently swallowing parse errors
- HANDOFF.md not written on clean PDCA completion
- External reviewer CLI PATH integrity unverified

### Changed
- SKILL.md size limit: 120 lines → 1000 words (resolves contradiction)
- Consensus gate: vote-count primary → score-based primary with vote-count secondary
- Review verdicts: added NEEDS IMPROVEMENT between MINOR FIXES and MUST FIX
- research SKILL.md: Gotchas and Subagents sections restored inline
- analyze SKILL.md: dual-phase behavior documented + --context plan|do option
- collect SKILL.md: Search Mode section for discoverability

## [0.3.0] - 2026-03-21

### Breaking
- Agent files renamed from role-based to Pokemon names (e.g., `researcher.md` → `eevee.md`)

### Added
- PDCA Wrapper v2: Action Router classifies review findings by root cause before routing
- Question Protocol for Plan phase (max 3 scope-clarifying questions, `--no-questions` flag)
- Pre-Flight Check in Do phase prevents execution without Plan artifacts
- `skills/pdca/references/action-router.md` — root cause classification matrix
- `skills/pdca/references/question-protocol.md` — question budget and skip conditions
- 9th design principle: Action Router
- Agent Team Integration section in architecture docs

### Changed
- Plan phase chains research → analyze (Eevee → Alakazam + Mewtwo)
- Do phase becomes pure executor (`--skip-research --skip-review`)
- Act phase uses Action Router: SOURCE/ASSUMPTION → Plan, COMPLETENESS/FORMAT → Do, EXECUTION_QUALITY → Loop
- Plurality routing replaces 50% threshold; PLAN > DO > LOOP tiebreaker for exact ties
- `--target` propagated from PDCA to Loop dispatch (no longer hardcoded APPROVED)
- State schema expanded: `check_report`, `act_final`, `check_verdict`, full gate tracking
- 16 agents renamed to Pokemon (Eevee, Alakazam, Mewtwo, Smeargle, Ditto, Xatu, Absol, Porygon, Jigglypuff, Unown, Arceus, Machamp, Noctowl, Magnezone, Deoxys, Abra)
- Version bumped to 0.3.0 across all manifests, READMEs, and badges
- READMEs updated with Pokemon-themed Mermaid diagrams and Action Router branching
- Design principles expanded from 7 to 9

## [0.2.0] - 2026-03-20

### Breaking
- Renamed `capture` skill to `collect` — command is now `/second-claude-code:collect`
- Collect skill now saves dual format: `.json` (machine) + `.md` (human-readable)

### Added
- Comprehensive README overhaul with Mermaid diagrams and shields.io badges
- Korean README (README.ko.md) for the Korean developer community
- Hero SVG skill wheel diagram (docs/images/hero.svg)
- VHS tape script for terminal demo recording (docs/demo.tape)

### Changed
- README restructured into 13 sections (~315 lines, up from 125)
- Loop command example changed from "newsletter" to "article"
- Added `<details>` sections for frameworks table and architecture tree
- Language toggle between English and Korean versions

## [0.1.0] - 2026-03-19

### Added
- Initial release with 8 killer skills
- `/scc:research` — autonomous deep research with iterative web exploration
- `/scc:write` — content production (newsletter, article, shorts, report, social, card-news)
- `/scc:analyze` — strategic framework analysis (15+ frameworks)
- `/scc:review` — multi-perspective quality gate with 3-5 parallel reviewers
- `/scc:loop` — iterative improvement engine with review-driven feedback
- `/scc:collect` — knowledge collection with PARA classification
- `/scc:pipeline` — custom workflow builder for skill chaining
- `/scc:hunt` — dynamic skill discovery and installation
- 10 specialized subagents (researcher, analyst, writer, editor, strategist, deep-reviewer, devil-advocate, fact-checker, tone-guardian, structure-analyst)
- SessionStart hook with context injection and state restoration
- UserPromptSubmit hook with auto-routing (natural language → skill)
- Reference docs: design principles, lineage, consensus gate, PARA method
- Templates: newsletter, research brief, SWOT analysis
