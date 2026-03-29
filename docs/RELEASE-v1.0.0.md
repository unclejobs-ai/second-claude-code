# Release Notes — v1.0.0

**Date**: 2025-06-29

v1.0.0 is the first major release of Second Claude Code. It introduces durable cycle memory, domain-aware PDCA contracts, and comprehensive MCP handler test coverage. Test count grew from 194 to 323.

---

## 1. Cycle Memory

### Design

New module `mcp/lib/cycle-memory.mjs` (230 lines) provides cross-session persistence for PDCA cycles. Each cycle gets a directory under `.data/cycles/cycle-NNN/` containing:

- `plan.md`, `do.md`, `check.md`, `act.md` — phase artifact snapshots
- `metrics.json` — cycle-level metrics (domain, verdict, durations, event stats)
- `events.jsonl` — append-only event log for audit trails

Cross-cycle insights are stored in `.data/cycles/insights.json` with structured metadata (category, severity, timestamp, text, weight).

### Wiring into PDCA Handlers

Three integration points connect cycle memory to the existing PDCA state machine:

| Handler | Hook | Behavior |
|---------|------|----------|
| `handleStartRun` | Run initialization | **Read-Before-Act**: loads 10 most recent insights (weight ≥ 0.1) into run context so new cycles start with accumulated learnings |
| `handleTransition` | Phase transition | Auto-saves completed phase artifact to `cycle-NNN/{phase}.md`; non-fatal on failure |
| `handleEndRun` | Run completion | Persists cycle metrics to `cycle-NNN/metrics.json`; non-fatal on failure |

All cycle memory operations are wrapped in try/catch — failures never block PDCA state transitions.

### MCP Tools (3 new)

| Tool | Description |
|------|-------------|
| `pdca_get_cycle_history` | Load a specific cycle or the most recent N cycles with phase markdown and metrics |
| `pdca_save_insight` | Persist a structured insight with category/severity for later recall |
| `pdca_get_insights` | Query insights with optional category filter and minimum decayed weight threshold |

Total MCP tool count: **21 → 24**.

### Self-Evolution

Insights use a 30-day linear time-decay for weight (1.0 = just recorded, 0.0 = 30+ days old). When a critical insight is recorded 3+ times, `saveInsight` automatically generates a gotcha proposal under `.data/proposals/gotchas-{category}.md`. These proposals surface recurring failure patterns as actionable checklists that can be promoted to permanent project gotchas.

---

## 2. Domain-Aware Contracts

`pdca_start_run` now accepts a `domain` parameter with four values:

| Domain | Use Case |
|--------|----------|
| `code` | Software development (default) |
| `content` | Content creation and writing |
| `analysis` | Research and analytical work |
| `pipeline` | Workflow and pipeline orchestration |

Each domain selects stage-specific contracts that define:
- **Definition of Done (DoD)** criteria per phase
- **Rollback targets** when a phase fails
- **Max retries** before escalation

The domain is persisted in run state and included in cycle metrics.

---

## 3. MCP Handler Test Coverage

Comprehensive test suites were added for all MCP handler modules:

| Test file | Coverage |
|-----------|----------|
| `tests/mcp/cycle-memory.test.mjs` | cycle-memory.mjs — saveCyclePhase, getCycleHistory, saveInsight, getInsights, saveCycleMetrics, appendCycleEvent, time-decay, gotcha proposals, path traversal hardening |
| `tests/mcp/pdca-handlers.test.mjs` | pdca-handlers.mjs — handleStartRun (domain param, read-before-act), handleTransition (auto-save), handleEndRun (metrics persistence), handleGetState, handleCheckGate, handleUpdateStuckFlags |
| `tests/mcp/pdca-state-server.test.mjs` | Server tool registration, input validation, error handling |

---

## 4. Hardening

- **Path traversal prevention**: `cycle_id` is validated as an integer 0–9999 and zero-padded, preventing directory traversal via crafted cycle IDs
- **Input validation**: `category` restricted to `process|technical|quality`, `severity` to `info|warning|critical`, `insight` must be non-empty string
- **Non-fatal saves**: All cycle memory writes are wrapped in try/catch to prevent blocking PDCA transitions on I/O errors
- **Atomic file writes**: State files use atomic write-then-rename pattern to prevent corruption

---

## 5. Test Progression

| Metric | Before | After |
|--------|--------|-------|
| Total tests | 194 | 323 |
| Passing | 194 | 322 |
| Skipped | 0 | 1 |
| Test files | — | +3 new MCP handler test files |

The 1 skipped test is an intentional placeholder for a future feature.

---

## File Changes Summary

### New Files
- `mcp/lib/cycle-memory.mjs` — Cycle memory persistence module (230 lines)
- `tests/mcp/cycle-memory.test.mjs` — Cycle memory test suite
- `docs/RELEASE-v1.0.0.md` — This file

### Modified Files
- `mcp/pdca-state-server.mjs` — 3 new tool registrations, tool count 21 → 24
- `mcp/lib/pdca-handlers.mjs` — Read-Before-Act in handleStartRun, auto-save in handleTransition/handleEndRun, domain parameter support
- `docs/architecture.md` — Cycle Memory section, tool count update
- `docs/architecture.ko.md` — Same in Korean
- `docs/skills/pdca.md` — MCP tools, domain param, Cycle Memory subsection
- `docs/skills/pdca.ko.md` — Same in Korean
- `CLAUDE.md` — v1.0.0 updates
- `AGENTS.md` — v1.0.0 updates
