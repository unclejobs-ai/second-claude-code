---
name: state-schema
description: "PDCA run state schema — full JSON definition, field reference, MCP tool table, and single-active-run constraint"
---

# PDCA State Schema

State is persisted to `${CLAUDE_PLUGIN_DATA}/state/pdca-active.json`.

> **Single-active-run constraint**: Only one PDCA run may be active at a time per data directory. `pdca-active.json` is a single file — concurrent runs collide. If a stale `pdca-active.json` is detected at startup (different `run_id`), notify the user before overwriting.

## Full Schema

```json
{
  "run_id": "uuid-v4-generated-at-run-start",
  "session_id": "claude-session-id-of-the-session-that-last-wrote-this-file",
  "session_history": [
    { "session_id": "...", "phase_completed": "plan", "timestamp": "2026-03-22T10:00:00Z" }
  ],
  "topic": "...",
  "current_phase": "do",
  "completed": ["plan"],
  "cycle_count": 1,
  "max_cycles": 3,
  "artifacts": {
    "plan_research": ".captures/research-topic-2026-03-20.md",
    "plan_analysis": ".captures/analyze-topic-2026-03-20.md",
    "do": null,
    "check_report": null,
    "act_final": null
  },
  "gates": {
    "plan_to_do": "passed",
    "do_to_check": null,
    "check_to_act": null
  },
  "check_verdict": null,
  "action_router_history": [],
  "assumptions": [],
  "stuck_flags": [],
  "scope_creep_detail": {
    "planned_scope": null,
    "actual_scope": null,
    "additions": [],
    "omissions": []
  }
}
```

## Field Reference

| Field | Type | Purpose |
|-------|------|---------|
| `run_id` | `string` | UUID v4 generated at run start. Used for collision detection. |
| `session_id` | `string \| null` | `CLAUDE_SESSION_ID` of the session that last wrote this file. Set by session-end hook. |
| `session_history` | `Array<{ session_id, phase_completed, timestamp }>` | Ordered record of every session that advanced the cycle. Appended, never overwritten. |
| `topic` | `string` | Human-readable description of the run subject. |
| `current_phase` | `string` | One of: `plan`, `do`, `check`, `act`. |
| `completed` | `string[]` | Ordered list of phases that have passed their gate. |
| `cycle_count` | `number` | Increments each time the agent transitions into Plan phase (fresh start or re-cycle from Act). |
| `max_cycles` | `number` | Hard ceiling on total PDCA cycles. Default: 3. |
| `artifacts` | `object` | Paths to phase outputs. Null until each phase completes. |
| `gates` | `object` | Gate status per transition. Values: `"passed"`, `"failed"`, or `null`. |
| `check_verdict` | `string \| null` | Final Check phase verdict. One of: `APPROVED`, `MINOR FIXES`, `NEEDS IMPROVEMENT`, `MUST FIX`. |
| `action_router_history` | `object[]` | Log of Action Router classification decisions across Act cycles. |
| `assumptions` | `string[]` | Unanswered questions from Question Protocol saved as assumptions. |
| `stuck_flags` | `string[]` | Active stuck pattern flags. Values: `plan_churn`, `check_avoidance`, `scope_creep`. Additive — set once per run. |
| `scope_creep_detail` | `object` | Populated when `scope_creep` flag fires. Records planned vs. actual scope comparison. |

## MCP Tools

When `pdca-state` MCP server is available, use its tools instead of reading/writing `pdca-active.json` directly. MCP tools handle atomic writes and enforce the single-active-run constraint server-side.

| Operation | MCP Tool | Direct fallback |
|-----------|----------|----------------|
| Read active state | `mcp__pdca-state__pdca_get_state` | read `pdca-active.json` |
| Start a new run | `mcp__pdca-state__pdca_start_run` | write `pdca-active.json` |
| Move to next phase | `mcp__pdca-state__pdca_transition` | update `current_phase` + `completed` |
| Validate a gate | `mcp__pdca-state__pdca_check_gate` | manual checklist |
| Record stuck flags | `mcp__pdca-state__pdca_update_stuck_flags` | append to `stuck_flags` |
| End the run | `mcp__pdca-state__pdca_end_run` | write completed, delete active |

`pdca_transition` accepts an `artifacts` object — pass any artifact paths produced in the current phase:

```json
{
  "target_phase": "do",
  "artifacts": {
    "plan_research": ".captures/research-topic-2026-03-20.md",
    "plan_analysis": ".captures/analyze-topic-2026-03-20.md"
  }
}
```

`pdca_check_gate` returns `{ "passed": true/false, "missing": [...] }`. A non-empty `missing` array is a gate failure — resolve each item before calling `pdca_transition`.
