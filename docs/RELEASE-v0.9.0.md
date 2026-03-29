# Second Claude Code — v0.9.0 Release Notes

> **Released**: 2026-03-29
> **Commits**: 18 (v0.5.8 → v0.9.0)
> **Changes**: 65 files, +6,932 / -164 lines
> **Tests**: 194 → 323 (+129), CI green
> **Reviews**: 7+ rounds (Codex gpt-5.4 × 12, mmbridge kimi × 6)

---

## What Changed — Executive Summary

v0.9.0 transforms Second Claude Code from a functional PDCA plugin into a **self-correcting, observable, quality-gated knowledge work system**. The core PDCA loop now has visual output, autonomous decision-making, cross-process safety, and multi-model review infrastructure.

---

## v0.6.0 — Philosophy & Foundation

### Skill Philosophy System
All 13 skills now have behavioral guardrails:
- **Iron Law**: One non-negotiable principle per skill (e.g., review: "mmbridge failure NEVER blocks the pipeline")
- **Red Flags**: "If you're thinking this, STOP" — prevents AI from rationalizing shortcuts

### Stage Contracts
`config/stage-contracts.json` defines formal I/O contracts per PDCA phase:
- Domain-aware: separate contracts for `code` vs `content` workflows
- DoD (Definition of Done) per phase
- Rollback targets for failure recovery
- Wired to runtime: `pdca_transition` and `pdca_start_run` load and enforce contracts (via new `domain` parameter)

### Consensus Gate Fix (P0)
Three critical bugs in the review voting system:
1. `Math.ceil(0.67 × 3) = 3` → required 3/3 (unanimity). Fixed to `Math.round` → 2/3
2. High average score alone could bypass vote count. Now requires **both** score AND votes
3. Quick preset (2 reviewers) used generic 0.67 threshold. Fixed to 1.0 (unanimous)

New `hooks/lib/review-config.mjs` resolves preset-specific thresholds.

### Bugfixes
- `walnut.manifest.yaml`: version 0.5.7→0.5.8, skills 12→13
- 8 ghost `{references}` directories removed
- `translate/references/glossary.md` created
- Playwright MCP pinned to `@0.0.68`

---

## v0.7.0 — Visualization & Decision Making

### HTML Cycle Reports
`hooks/lib/report-generator.mjs` generates self-contained HTML dashboards:
- Traffic-light phase status (green/yellow/red)
- Chart.js score trend line
- Mermaid PDCA flow diagram with gate colors
- Issue summary and next actions
- Auto-generated on session-end when PDCA cycle completes act phase

### Terminal ANSI Summary
```
┌──────── PDCA Cycle #7 ─────────┐
│ Plan ✓  Do ✓  Check ⚠  Act ✓  │
│ Time: 12m  Issues: 2  Score: 83│
└────────────────────────────────┘
```

### PIVOT/REFINE Decision Loop
`pdca_transition` now evaluates 3-way decisions at Check→Act:
- **PROCEED**: All criteria met, advance to Act
- **REFINE**: Warnings only, retry current phase (max 3)
- **PIVOT**: Critical issues, roll back to Plan (max 2)

`refine_count` and `pivot_count` tracked in run state. `act_decision` persisted for `act_to_exit` gate.

### File Mutation Queue
`hooks/lib/file-mutex-sync.mjs`: Cross-process file locking using O_EXCL lockfiles.
- Solves reviewer aggregation race condition (subagent-start + subagent-stop concurrent writes)
- Stale lock detection (30s threshold)
- Exponential backoff with portable spin wait

### Loop Runner Enhancements
- **MAD Confidence Scoring**: After 3+ runs, `confidence = |best_improvement| / MAD`. Levels: strong (≥2.0), marginal (1.0-2.0), noise (<1.0)
- **Cost/Time Budget Limits**: `--cost-limit` and `--time-limit` for controlled termination
- Preserves existing termination logic (plateau, winner_promoted, min_delta_not_met, budget_exhausted)

### Iterative Compaction
PostCompact now injects:
- Accumulated insights from `cycles/insights.md` (cross-cycle learning)
- Previous compaction summary (context survives multiple compressions)
- Workflow-active.json preserved alongside PDCA/loop/pipeline state

---

## v0.8.0 — Bridge & Automation Infrastructure

### mmbridge MCP Server
Registered in `plugin.json` as third MCP server (optional: true).
Enables programmatic access to mmbridge's 9 tools.

### Adapter Protocol
`hooks/lib/mmbridge-adapter.mjs` (390 lines):
- `MmBridgeAdapter`: Base class (review, gate, embrace)
- `MmBridgeCliAdapter`: Real CLI invocation with `--json`
- `MmBridgeStubAdapter`: Configurable mocks for testing
- `MmBridgeRecordingAdapter`: JSONL record + replay for offline CI

### Anti-Fabrication Layer
`hooks/lib/fact-checker.mjs` (119 lines):
- `extractClaims()`: Regex extraction of numeric claims ("30% improvement", "score: 0.85")
- `verifyClaims()`: Cross-reference against actual metrics with configurable tolerance
- Nested metrics support for deep object structures

---

## v0.9.0 — Observability & CI

### MetaClaw PRM (Agent Effectiveness Tracker)
`hooks/lib/agent-tracker.mjs` (150 lines):
- Records agent contributions per PDCA phase
- Outcomes: helped / neutral / hurt
- Auto-computes `best_at` and `struggles_with` per agent
- `getTopAgentsForPhase()` for routing optimization

### CI Compatibility
- `readFileSync("/dev/stdin")` → `readFileSync(0)` (fd 0) for GitHub Actions Ubuntu
- `ensureDir(STATE_DIR)` before lock creation
- Portable spin wait (no SharedArrayBuffer dependency)

---

## Security

Three security fixes applied and verified:
1. **HTML Injection**: `escapeHtml()` added to report-generator for all user-controlled values
2. **ENOENT**: `mkdirSync(recursive)` before lockfile creation in file-mutex-sync
3. **Cross-platform stdin**: fd 0 instead of /dev/stdin for CI environments

Triple security review: manual audit + Codex gpt-5.4 + mmbridge kimi security mode.
No P0 security issues in final review.

---

## Test Coverage

| Category | Before | After | Delta |
|---|---|---|---|
| Hooks | 28 | 85 | +57 |
| MCP | 102 | 128 | +26 |
| Contracts | 11 | 14 | +3 |
| Runtime | 16 | 20 | +4 |
| Integration | 3 | 3 | 0 |
| Benchmarks | 9 | 17 | +8 |
| E2E | 5 | 5 | 0 |
| Skill Tests | 26 | 0 | -26 |
| **Total** | **194** | **323** | **+129** |

---

## New Files

### Core Modules (9)
- `hooks/lib/report-generator.mjs` — HTML cycle reports
- `hooks/lib/file-mutex.mjs` — Async per-file lock
- `hooks/lib/file-mutex-sync.mjs` — Sync cross-process lock
- `hooks/lib/review-config.mjs` — Preset threshold resolver
- `hooks/lib/mmbridge-adapter.mjs` — Adapter protocol
- `hooks/lib/fact-checker.mjs` — Anti-fabrication
- `hooks/lib/agent-tracker.mjs` — MetaClaw PRM
- `config/stage-contracts.json` — Domain-aware contracts
- `skills/translate/references/glossary.md` — EN↔KO glossary

### Test Files (13)
- `tests/hooks/subagent-stop.test.mjs` (8 tests)
- `tests/hooks/compaction.test.mjs` (8 tests)
- `tests/hooks/subagent-start.test.mjs` (6 tests)
- `tests/hooks/stop-failure.test.mjs` (5 tests)
- `tests/hooks/report-generator.test.mjs` (6 tests)
- `tests/hooks/file-mutex.test.mjs` (5 tests)
- `tests/hooks/fact-checker.test.mjs` (10 tests)
- `tests/hooks/mmbridge-adapter.test.mjs` (15 tests)
- `tests/hooks/agent-tracker.test.mjs` (7 tests)
- `tests/mcp/pdca-transition-decision.test.mjs` (5 tests)
- `tests/mcp/soul-handlers.test.mjs` (12 tests)
- `tests/mcp/memory-handlers.test.mjs` (9 tests)
- `tests/runtime/hermes-examples.test.mjs`

### Documentation (8)
- `docs/plans/2026-03-28-v06-v09-integrated-improvement-plan.md` (1,167 lines)
- `docs/RELEASE-v0.9.0.md` (this file)
- `references/hermes/README.md`
- Hermes integration docs (operations, prompts, examples)

---

## Analysis Sources

This release was informed by deep analysis of 5 external systems:
1. **Hermes Agent** — Memory system, progressive disclosure, phase-gated workflows, zero-context standard
2. **AutoResearchClaw** — Stage contracts, PIVOT/REFINE, self-evolution, anti-fabrication
3. **Pi Coding Agent** — File mutation queue, iterative compaction, tool self-declaration
4. **pi-autoresearch** — Auto-resume, MAD confidence, ASI (actionable side information)
5. **External Research** — LangSmith, CrewAI, Aider, promptfoo patterns

---

## Breaking Changes

None. All changes are additive. Existing workflows continue to work unchanged.

---

## Known Limitations

- `withFileLockSync` timeout path can force-break non-stale locks under extreme contention
- mmbridge MCP server requires Node 25+ (node:sqlite FTS5) — optional, degrades gracefully
- `loadContracts()` cache check has minor redundancy (non-functional)
