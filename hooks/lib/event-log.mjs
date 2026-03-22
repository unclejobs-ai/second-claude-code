/**
 * PDCA Event Log — Lightweight append-only event sourcing for PDCA cycles.
 *
 * Events are written to .data/events/pdca-{run_id}.jsonl (one JSON object per line).
 *
 * Event types:
 *   cycle_start     — new PDCA run initialized
 *   cycle_end       — run completed or aborted
 *   phase_start     — entered a phase
 *   phase_end       — leaving a phase
 *   gate_check      — gate evaluation triggered
 *   gate_pass       — gate passed
 *   gate_fail       — gate failed (missing conditions captured)
 *   artifact_created — artifact path recorded in state
 *   review_started  — check phase reviewer added
 *   review_completed — check phase review verdict set
 *   stuck_detected  — stuck flags appended
 *   error           — unexpected error or crash captured
 */

import { appendFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derive the events directory from the data root.
 * @param {string} dataDir
 * @returns {string}
 */
function eventsDir(dataDir) {
  return join(dataDir, "events");
}

/**
 * Derive the JSONL file path for a given run ID.
 * @param {string} dataDir
 * @param {string} runId
 * @returns {string}
 */
function eventFile(dataDir, runId) {
  return join(eventsDir(dataDir), `pdca-${runId}.jsonl`);
}

/**
 * Ensure the events directory exists.
 * @param {string} dataDir
 */
function ensureEventsDir(dataDir) {
  mkdirSync(eventsDir(dataDir), { recursive: true });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Append a typed event to the run's JSONL log.
 *
 * @param {string} dataDir - Root data directory (e.g. .data)
 * @param {string} runId   - UUID of the current PDCA run
 * @param {{ type: string, phase?: string, action?: string, data?: unknown }} event
 * @returns {{ ts: string, type: string, run_id: string }}
 */
export function logEvent(dataDir, runId, event) {
  if (typeof dataDir !== "string" || dataDir.trim() === "") {
    throw new Error("logEvent: dataDir must be a non-empty string");
  }
  if (typeof runId !== "string" || runId.trim() === "") {
    throw new Error("logEvent: runId must be a non-empty string");
  }
  if (!event || typeof event.type !== "string" || event.type.trim() === "") {
    throw new Error("logEvent: event.type must be a non-empty string");
  }

  ensureEventsDir(dataDir);

  const record = {
    ts: new Date().toISOString(),
    run_id: runId,
    type: event.type,
    ...(event.phase !== undefined && { phase: event.phase }),
    ...(event.action !== undefined && { action: event.action }),
    ...(event.data !== undefined && { data: event.data }),
  };

  appendFileSync(eventFile(dataDir, runId), JSON.stringify(record) + "\n", "utf8");

  return { ts: record.ts, type: record.type, run_id: runId };
}

/**
 * Read all events for a run, with optional filtering.
 *
 * @param {string} dataDir
 * @param {string} runId
 * @param {{ type?: string, phase?: string, date_from?: string, date_to?: string }} [filters]
 * @returns {object[]}
 */
export function readEvents(dataDir, runId, filters = {}) {
  const path = eventFile(dataDir, runId);

  if (!existsSync(path)) {
    return [];
  }

  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(`readEvents: cannot read ${path}: ${err.message}`);
  }

  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  /** @type {object[]} */
  const events = [];

  for (const line of lines) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      // Skip malformed lines
      continue;
    }

    if (filters.type && obj.type !== filters.type) continue;
    if (filters.phase && obj.phase !== filters.phase) continue;
    if (filters.date_from && String(obj.ts || "") < filters.date_from) continue;
    if (filters.date_to && String(obj.ts || "") > filters.date_to) continue;

    events.push(obj);
  }

  return events;
}

/**
 * Compute aggregate statistics for a run from its event log.
 *
 * @param {string} dataDir
 * @param {string} runId
 * @returns {{
 *   total_events: number,
 *   duration_ms: number | null,
 *   events_per_phase: Record<string, number>,
 *   gate_pass_count: number,
 *   gate_fail_count: number,
 *   stuck_event_count: number,
 *   error_count: number,
 *   cost_estimate: { events: number, approx_tokens: number }
 * }}
 */
export function getEventStats(dataDir, runId) {
  const events = readEvents(dataDir, runId);

  if (events.length === 0) {
    return {
      total_events: 0,
      duration_ms: null,
      events_per_phase: {},
      gate_pass_count: 0,
      gate_fail_count: 0,
      stuck_event_count: 0,
      error_count: 0,
      cost_estimate: { events: 0, approx_tokens: 0 },
    };
  }

  // Duration: first event → last event
  const timestamps = events.map((e) => new Date(e.ts).getTime()).filter((t) => !isNaN(t));
  const duration_ms =
    timestamps.length >= 2
      ? Math.max(...timestamps) - Math.min(...timestamps)
      : null;

  // Events per phase
  /** @type {Record<string, number>} */
  const events_per_phase = {};
  for (const e of events) {
    if (e.phase) {
      events_per_phase[e.phase] = (events_per_phase[e.phase] ?? 0) + 1;
    }
  }

  const gate_pass_count = events.filter((e) => e.type === "gate_pass").length;
  const gate_fail_count = events.filter((e) => e.type === "gate_fail").length;
  const stuck_event_count = events.filter((e) => e.type === "stuck_detected").length;
  const error_count = events.filter((e) => e.type === "error").length;

  // Cost estimate: rough token heuristic (1 event ≈ 50 tokens in context)
  const approx_tokens = events.length * 50;

  return {
    total_events: events.length,
    duration_ms,
    events_per_phase,
    gate_pass_count,
    gate_fail_count,
    stuck_event_count,
    error_count,
    cost_estimate: { events: events.length, approx_tokens },
  };
}

/**
 * List all run IDs that have an event log in the given data directory.
 * @param {string} dataDir
 * @returns {string[]}
 */
export function listRunIds(dataDir) {
  const dir = eventsDir(dataDir);
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.startsWith("pdca-") && f.endsWith(".jsonl"))
    .map((f) => f.slice("pdca-".length, -".jsonl".length));
}
