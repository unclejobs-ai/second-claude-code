# Changelog Archive (v1.2.0 and older)

Moved from [CHANGELOG.md](../CHANGELOG.md) — see that file for v1.3.0+.

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
- **Artifact Viewer** — local web UI that renders PDCA pipeline outputs as interactive artifacts
- **Viewer skill** — `/second-claude-code:viewer` command to start the artifact viewer for any PDCA session
- **Viewer server** — zero-dependency Node.js HTTP + WebSocket server with SPA fallback

### Changed
- Version surfaces aligned to `1.1.0` across plugin manifest, package metadata, and documentation

## [1.0.0] - 2026-03-29

### Added
- **PDCA Cycle Memory** — structured memory that persists across PDCA cycles
- **3 new MCP tools**: `pdca_get_cycle_history`, `pdca_save_insight`, `pdca_get_insights`
- **Domain-aware PDCA starts** — `pdca_start_run` accepts a `domain` parameter

### Fixed
- CI debug step removed, AGENTS.md path references, test count alignment, stage contracts version, cycle memory hardening

### Changed
- Total test count: 194 → 323

## [0.9.0] - 2026-03-29

### Added
- MetaClaw PRM agent effectiveness tracker

### Fixed
- CI lock initialization, portable spin wait

## [0.8.0] - 2026-03-29

### Added
- Stage contracts wired to runtime, optional MMBridge MCP, MMBridge Adapter Protocol, anti-fabrication layer

## [0.7.0] - 2026-03-29

### Added
- HTML cycle report generator, terminal ANSI summary, File Mutation Queue, MAD confidence scoring, loop budget limits, iterative compaction

### Changed
- PDCA transition supports `PIVOT` and `REFINE` paths

## [0.6.0] - 2026-03-29

### Added
- Iron Laws + Red Flags for all skills, stage contracts, review threshold resolver, regression coverage

### Fixed
- Consensus gate rounding, score gate validation, quick preset threshold, compaction state, session-start banner, release hygiene

## [0.5.8] - 2026-03-28

- `translate` skill added, MCP server modularized (1311→553 lines)

## [0.5.7] - 2026-03-28

- MCP server test suite (72 tests), `pdca_list_runs`, academic review preset, confidence scoring, benchmark CI

## [0.5.6] - 2026-03-25

- Refine DoD (`--dod`) flag for success criteria checklists

## [0.5.5] - 2026-03-24

- MMBridge CLI alignment, reference file deduplication, soul templates

## [0.5.4] - 2026-03-23

- Daemon listing surfaces, workflow Phase 3, security fixes (path traversal, prompt injection)

## [0.5.3] - 2026-03-23

- Companion daemon foundation, project memory layer, Hermes boundary notes

## [0.5.0] - 2026-03-22

- Soul system (`/scc:soul`), Playwright MCP, effort frontmatter, dynamic context injection

## [0.4.0] - 2026-03-22

- Critic Schema, phase output schemas, StuckDetector, MCP State Server, worktree isolation, Action Router Korean

## [0.3.0] - 2026-03-21

- PDCA v2 with Action Router, Question Protocol, Pokemon agent rename, 16 agents

## [0.2.0] - 2026-03-20

- Security hardening, English localization, Korean README, marketplace manifest

## [0.1.0] - 2026-03-19

- Initial release: 8 skills, 10 subagents, SessionStart/UserPromptSubmit hooks, 15 strategic frameworks
