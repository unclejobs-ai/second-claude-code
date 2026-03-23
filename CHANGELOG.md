# Changelog

All notable changes to second-claude-code are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

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
