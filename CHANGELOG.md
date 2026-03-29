# Changelog

All notable changes to second-claude-code are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

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
- **Session-start banner completeness** — banner now includes `translate`, restoring 13/13 commands
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
