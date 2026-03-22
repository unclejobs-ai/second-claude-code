# PDCA Observability — Event System Reference

The PDCA event system provides append-only structured logging for every cycle.
Events flow to `.data/events/pdca-{run_id}.jsonl` and are queryable via MCP tools.

---

## Event Types and Fields

Every event has the following base fields:

| Field    | Type   | Description                          |
|----------|--------|--------------------------------------|
| `ts`     | string | ISO 8601 timestamp                   |
| `run_id` | string | UUID of the PDCA run                 |
| `type`   | string | Event type (see below)               |
| `phase`  | string | Current PDCA phase (plan/do/check/act), when applicable |
| `action` | string | Sub-action name, when applicable     |
| `data`   | object | Event-specific payload               |

### cycle_start
Fired when `pdca_start_run` completes.
```json
{ "type": "cycle_start", "phase": "plan", "data": { "topic": "...", "max_cycles": 3 } }
```

### cycle_end
Fired when `pdca_end_run` completes. Includes the full event stats snapshot.
```json
{ "type": "cycle_end", "data": { "completed_phases": [...], "cycle_count": 1, "check_verdict": "approved", "event_stats": {...} } }
```

### phase_start / phase_end
Fired by `pdca_transition` around every phase change.
```json
{ "type": "phase_start", "phase": "do", "data": { "cycle_count": 1 } }
{ "type": "phase_end",   "phase": "plan", "data": { "artifacts_set": ["plan_research"] } }
```

### gate_check
Fired each time `pdca_check_gate` is called. Always accompanied by `gate_pass` or `gate_fail`.
```json
{ "type": "gate_check", "action": "plan_to_do", "data": { "passed": false, "missing": ["sources_min_3"] } }
```

### gate_pass / gate_fail
One of these always follows a `gate_check`.
```json
{ "type": "gate_pass", "action": "plan_to_do" }
{ "type": "gate_fail", "action": "plan_to_do", "data": { "missing": ["plan_mode_approved"] } }
```

### artifact_created
Log manually via `logEvent` when an artifact path is recorded outside normal transition flow.
```json
{ "type": "artifact_created", "phase": "do", "data": { "key": "do", "path": "..." } }
```

### review_started / review_completed
Log manually when a reviewer is added (check phase).
```json
{ "type": "review_started", "phase": "check", "data": { "reviewer": "Xatu", "reviewer_count": 1 } }
{ "type": "review_completed", "phase": "check", "data": { "verdict": "approved", "reviewer_count": 2 } }
```

### stuck_detected
Fired by `pdca_update_stuck_flags` when new (previously unseen) flags are added.
```json
{ "type": "stuck_detected", "phase": "plan", "data": { "new_flags": ["plan_churn"], "all_flags": ["plan_churn"] } }
```

### error
Fired by the `StopFailure` hook on API error or rate-limit crash.
```json
{ "type": "error", "action": "stop_failure", "data": { "crashed_at": "...", "current_phase": "do", "recovery_file": "..." } }
```

---

## Querying Events via MCP

### Fetch all events for a run
```
pdca_get_events(run_id: "<uuid>")
```

### Filter by type
```
pdca_get_events(run_id: "<uuid>", type: "gate_fail")
```

### Filter by phase with limit
```
pdca_get_events(run_id: "<uuid>", phase: "check", limit: 20)
```

### Get analytics for the active run (omit run_id)
```
pdca_get_analytics()
```

### Get analytics for a specific run
```
pdca_get_analytics(run_id: "<uuid>")
```

Analytics response shape:
```json
{
  "run_id": "...",
  "summary": {
    "total_events": 42,
    "duration_ms": 3600000,
    "events_per_phase": { "plan": 12, "do": 8, "check": 15, "act": 7 },
    "gate_pass_count": 3,
    "gate_fail_count": 2,
    "stuck_event_count": 1,
    "error_count": 0
  },
  "phase_durations": {
    "plan": { "count": 1, "avg_duration_ms": 900000 },
    "do":   { "count": 1, "avg_duration_ms": 1200000 }
  },
  "gate_stats": {
    "plan_to_do": { "pass": 1, "fail": 2, "pass_rate": 0.33 }
  }
}
```

---

## Analytics Patterns

### Bottleneck identification
Compare `phase_durations.avg_duration_ms` across phases to find where cycles spend the most time.
A plan phase taking >2x the median suggests `plan_churn` or insufficient research.

### Gate quality score
`gate_pass_count / (gate_pass_count + gate_fail_count)` gives a first-attempt gate pass rate.
A rate below 0.5 on `plan_to_do` indicates systematic gaps in plan-phase exit criteria.

### Stuck frequency
`stuck_event_count > 1` in a single run signals a systemic loop rather than a one-off issue.
Cross-reference stuck flags (`plan_churn`, `check_avoidance`, `scope_creep`) against phase event counts.

### Cycle duration trends
Across multiple runs, compare `duration_ms` to identify whether quality is improving (shorter cycles
with higher gate pass rates) or degrading (longer cycles with repeated failures).

---

## Crash Recovery

When Claude Code terminates abnormally (API error, rate limit), the `StopFailure` hook fires:

1. Reads `pdca-active.json`
2. Writes `pdca-crash-recovery.json` with a `crashed_at` timestamp
3. Logs an `error` event to the run's JSONL file

On next `SessionStart`, if `pdca-crash-recovery.json` exists, the session-start hook surfaces:

> PDCA crash recovery available: "{topic}" was in {phase} phase at {timestamp}.
> Run `/second-claude-code:pdca` to resume or delete the file to discard.

Running `/second-claude-code:pdca` detects the recovery file and resumes from the saved state.
Delete `pdca-crash-recovery.json` manually to discard and start fresh.

---

## Future: Laminar / OTLP Export (Design, Not Yet Implemented)

The event JSONL format is designed for forward compatibility with structured telemetry pipelines.

**Planned integration points:**

1. **OTLP Span mapping** — Each PDCA run maps to an OpenTelemetry trace; each phase is a span.
   `cycle_start` → trace start; `phase_start`/`phase_end` → child spans; `cycle_end` → trace end.

2. **Laminar** — `logEvent` could post events to the Laminar `/v1/traces` endpoint when
   `LAMINAR_API_KEY` is set, enabling visual trace inspection for each PDCA cycle.

3. **Export command** — A future `pdca_export_trace(run_id, format: "otlp"|"jaeger")` MCP tool
   would read the JSONL file and serialize it into the chosen wire format.

4. **Deferral rationale** — Implementing OTLP now adds an external dependency and complicates
   offline/air-gapped usage. The local JSONL store is sufficient for all current analytics needs
   and can be exported on demand once a target telemetry backend is chosen.
