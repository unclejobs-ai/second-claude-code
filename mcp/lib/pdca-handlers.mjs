/**
 * PDCA state, transition, gate, events, analytics, list_runs handlers.
 */

import { randomUUID } from "crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  renameSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { logEvent, readEvents, getEventStats, listRunIds } from "../../hooks/lib/event-log.mjs";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "../..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? join(PLUGIN_ROOT, ".data");
const STATE_DIR = join(DATA_DIR, "state");
const ACTIVE_FILE = join(STATE_DIR, "pdca-active.json");
const COMPLETED_FILE = join(STATE_DIR, "pdca-last-completed.json");

/** Ensure the state directory exists. */
function ensureStateDir() {
  mkdirSync(STATE_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Atomic file helpers
// ---------------------------------------------------------------------------

/**
 * Read and parse a JSON file. Returns null when the file does not exist.
 * @param {string} path
 * @returns {object | null}
 */
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw new Error(`Failed to read ${path}: ${err.message}`);
  }
}

/**
 * Write JSON atomically: write to a .tmp file, then rename into place.
 * Prevents partial-write corruption on crash.
 * @param {string} path
 * @param {object} data
 */
function writeJsonAtomic(path, data) {
  ensureStateDir();
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, path);
}

// ---------------------------------------------------------------------------
// Stage Contracts (loaded from config/stage-contracts.json)
// ---------------------------------------------------------------------------

const CONTRACTS_PATH = join(PLUGIN_ROOT, "config", "stage-contracts.json");

/** @type {object|null} Cached stage contracts */
let _contracts = null;

/**
 * Load stage contracts. Returns null if file is missing or malformed.
 * Contracts are cached after first load.
 */
function loadContracts() {
  if (_contracts !== undefined && _contracts !== null) return _contracts;
  try {
    _contracts = JSON.parse(readFileSync(CONTRACTS_PATH, "utf8"));
    return _contracts;
  } catch {
    _contracts = null;
    return null;
  }
}

/**
 * Get the DoD (Definition of Done) for a specific phase and domain.
 * @param {string} phase - plan, do, check, act
 * @param {string} [domain="code"] - code, content, analysis, pipeline
 * @returns {string[]} DoD items, empty array if contracts unavailable
 */
function getDoD(phase, domain = "code") {
  const contracts = loadContracts();
  if (!contracts?.contracts?.[phase]) return [];
  const phaseContract = contracts.contracts[phase][domain] || contracts.contracts[phase].code;
  return phaseContract?.dod || [];
}

/**
 * Get the contract for a phase transition, including rollback target.
 * @param {string} phase
 * @param {string} [domain="code"]
 * @returns {{ input_files: string[], output_files: string[], dod: string[], max_retries: number, rollback_target: string|null } | null}
 */
function getPhaseContract(phase, domain = "code") {
  const contracts = loadContracts();
  if (!contracts?.contracts?.[phase]) return null;
  return contracts.contracts[phase][domain] || contracts.contracts[phase].code || null;
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

/** Legal phase transitions. */
const VALID_TRANSITIONS = {
  plan: ["do"],
  do: ["check"],
  check: ["act"],
  act: ["plan"],
};

/** Gates and what conditions they require. */
const GATE_REQUIRED = {
  plan_to_do: ["brief_exists", "sources_min_3", "analysis_exists", "plan_mode_approved"],
  do_to_check: ["artifact_exists", "artifact_complete", "plan_integrated"],
  check_to_act: ["verdict_set", "min_two_reviewers"],
  act_to_exit: ["decision_set", "root_cause_set"],
};

/**
 * Evaluate gate conditions against current state.
 * Returns `{ passed: boolean, missing: string[] }`.
 * @param {string} gate
 * @param {object} state
 */
function evaluateGate(gate, state) {
  const required = GATE_REQUIRED[gate];
  if (!required) {
    return { passed: false, missing: [`unknown gate: ${gate}`] };
  }

  const missing = [];
  const artifacts = state.artifacts ?? {};

  switch (gate) {
    case "plan_to_do":
      if (!artifacts.plan_research) missing.push("brief_exists");
      if ((state.sources_count ?? 0) < 3) missing.push("sources_min_3");
      if (!artifacts.plan_analysis) missing.push("analysis_exists");
      if (!state.plan_mode_approved) missing.push("plan_mode_approved");
      break;

    case "do_to_check":
      if (!artifacts.do) missing.push("artifact_exists");
      if (!state.do_artifact_complete) missing.push("artifact_complete");
      if (!state.plan_findings_integrated) missing.push("plan_integrated");
      break;

    case "check_to_act":
      if (!state.check_verdict) missing.push("verdict_set");
      if ((state.reviewer_count ?? 0) < 2) missing.push("min_two_reviewers");
      break;

    case "act_to_exit":
      if (!state.act_decision) missing.push("decision_set");
      if (!state.act_root_cause) missing.push("root_cause_set");
      break;
  }

  return { passed: missing.length === 0, missing };
}

/**
 * Classify the Act-stage decision once the check_to_act gate has passed.
 * The counters cap repeated refinement/pivot recommendations to avoid
 * unbounded loops; once the cap is exhausted, the run falls through to
 * PROCEED so Act can close out intentionally.
 *
 * @param {object} state
 * @returns {"PROCEED" | "REFINE" | "PIVOT"}
 */
function evaluateCheckToActDecision(state) {
  const criticalCount =
    (Array.isArray(state.critical_findings) ? state.critical_findings.length : 0) +
    (Number(state.critical_count) || 0);
  const warningCount = Math.max(
    Number(state.warning_count) || 0,
    Array.isArray(state.top_improvements) ? state.top_improvements.length : 0
  );
  const verdict = String(state.check_verdict || "").toUpperCase();
  const hasCriticalIssues = criticalCount > 0 || verdict === "MUST FIX";
  const hasWarnings =
    !hasCriticalIssues &&
    (warningCount > 0 || verdict === "MINOR FIXES" || verdict === "NEEDS IMPROVEMENT");

  if (hasCriticalIssues && (state.pivot_count ?? 0) < 2) {
    return "PIVOT";
  }
  if (hasWarnings && (state.refine_count ?? 0) < 3) {
    return "REFINE";
  }
  return "PROCEED";
}

/**
 * Build the initial state object for a new run.
 * @param {string} topic
 * @param {number} maxCycles
 * @returns {object}
 */
function buildInitialState(topic, maxCycles) {
  return {
    run_id: randomUUID(),
    topic,
    current_phase: "plan",
    completed: [],
    cycle_count: 1,
    max_cycles: maxCycles,
    artifacts: {
      plan_research: null,
      plan_analysis: null,
      do: null,
      check_report: null,
      act_final: null,
    },
    gates: {
      plan_to_do: null,
      do_to_check: null,
      check_to_act: null,
    },
    check_verdict: null,
    action_router_history: [],
    assumptions: [],
    stuck_flags: [],
    scope_creep_detail: {
      planned_scope: null,
      actual_scope: null,
      additions: [],
      omissions: [],
    },
    // Extended fields used by gate validation (populated by pdca_transition callers)
    sources_count: 0,
    plan_mode_approved: false,
    do_artifact_complete: false,
    plan_findings_integrated: false,
    reviewer_count: 0,
    warning_count: 0,
    critical_count: 0,
    average_score: null,
    critical_findings: [],
    top_improvements: [],
    refine_count: 0,
    pivot_count: 0,
    act_decision: null,
    act_root_cause: null,
  };
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

/** pdca_get_state */
export function handleGetState() {
  const state = readJson(ACTIVE_FILE);
  return state;
}

/** pdca_start_run */
export function handleStartRun({ topic, max_cycles = 3 }) {
  if (typeof topic !== "string" || topic.trim() === "") {
    throw new Error("topic must be a non-empty string");
  }
  if (typeof max_cycles !== "number" || !Number.isInteger(max_cycles) || max_cycles < 1) {
    throw new Error("max_cycles must be a positive integer");
  }

  const existing = readJson(ACTIVE_FILE);
  if (existing) {
    throw new Error(
      `Active PDCA run already exists (run_id: ${existing.run_id}, topic: "${existing.topic}"). ` +
        `End it with pdca_end_run before starting a new one.`
    );
  }

  const state = buildInitialState(topic.trim(), max_cycles);
  writeJsonAtomic(ACTIVE_FILE, state);

  logEvent(DATA_DIR, state.run_id, {
    type: "cycle_start",
    phase: "plan",
    data: { topic: state.topic, max_cycles: state.max_cycles },
  });

  return state;
}

/** Map from "current_phase → target_phase" to the gate key. */
const PHASE_TO_GATE = {
  plan_do: "plan_to_do",
  do_check: "do_to_check",
  check_act: "check_to_act",
  act_plan: "act_to_exit",
};

/** pdca_transition */
export function handleTransition({ target_phase, artifacts = {}, auto_gate = false }) {
  const validPhases = ["plan", "do", "check", "act"];
  if (!validPhases.includes(target_phase)) {
    throw new Error(
      `target_phase must be one of: ${validPhases.join(", ")}. Got: "${target_phase}"`
    );
  }

  const state = readJson(ACTIVE_FILE);
  if (!state) {
    throw new Error("No active PDCA run. Start one with pdca_start_run.");
  }

  const current = state.current_phase;
  const allowed = VALID_TRANSITIONS[current] ?? [];
  if (!allowed.includes(target_phase)) {
    throw new Error(
      `Illegal transition: ${current} → ${target_phase}. ` +
        `From "${current}", allowed targets are: ${allowed.length > 0 ? allowed.join(", ") : "none (terminal phase)"}.`
    );
  }

  let autoGateResult = null;

  // ── auto_gate: evaluate the gate for this transition first ──
  if (auto_gate) {
    const gateKey = PHASE_TO_GATE[`${current}_${target_phase}`];
    if (gateKey) {
      const gateResult = evaluateGate(gateKey, state);
      autoGateResult = {
        gate: gateKey,
        passed: gateResult.passed,
        missing: gateResult.missing,
        decision: null,
      };

      logEvent(DATA_DIR, state.run_id, {
        type: "gate_check",
        phase: current,
        action: gateKey,
        data: { passed: gateResult.passed, missing: gateResult.missing },
      });

      logEvent(DATA_DIR, state.run_id, {
        type: gateResult.passed ? "gate_pass" : "gate_fail",
        phase: current,
        action: gateKey,
        data: gateResult.passed ? undefined : { missing: gateResult.missing },
      });

      if (!gateResult.passed) {
        return {
          transitioned: false,
          gate: gateKey,
          gate_result: { ...gateResult, decision: null },
          auto_gate_result: autoGateResult,
          current_phase: current,
          target_phase,
        };
      }

      if (gateKey === "check_to_act") {
        const decision = evaluateCheckToActDecision(state);
        autoGateResult.decision = decision;

        // Persist decision so act_to_exit gate (which requires decision_set) is satisfied,
        // and subsequent hooks/transitions can read the decision.
        state.act_decision = decision;

        if (decision === "REFINE") {
          state.refine_count = (state.refine_count ?? 0) + 1;
        } else if (decision === "PIVOT") {
          state.pivot_count = (state.pivot_count ?? 0) + 1;
        }
      }
    }
  }

  // Mark current phase as completed
  if (!state.completed.includes(current)) {
    state.completed.push(current);
  }

  // Increment cycle_count when re-entering plan
  if (target_phase === "plan") {
    state.cycle_count = (state.cycle_count ?? 1) + 1;
    if (state.cycle_count > state.max_cycles) {
      throw new Error(
        `max_cycles (${state.max_cycles}) reached. ` +
          `Cannot start another PDCA cycle. Use pdca_end_run to close the run.`
      );
    }
  }

  // Merge artifacts — only allowlisted keys accepted
  const VALID_ARTIFACT_KEYS = new Set(["plan_research", "plan_analysis", "do", "check_report", "act_final"]);
  if (artifacts && typeof artifacts === "object") {
    for (const k of Object.keys(artifacts)) {
      if (VALID_ARTIFACT_KEYS.has(k)) {
        state.artifacts[k] = artifacts[k];
      }
    }
  }

  const previousPhase = current;
  state.current_phase = target_phase;

  writeJsonAtomic(ACTIVE_FILE, state);

  logEvent(DATA_DIR, state.run_id, {
    type: "phase_end",
    phase: previousPhase,
    data: { artifacts_set: Object.keys(state.artifacts).filter((k) => state.artifacts[k] !== null) },
  });

  logEvent(DATA_DIR, state.run_id, {
    type: "phase_start",
    phase: target_phase,
    data: { cycle_count: state.cycle_count },
  });

  // Enrich result with stage contract information when available.
  const domain = state.domain || "code";
  const contract = getPhaseContract(target_phase, domain);
  const dod = getDoD(target_phase, domain);

  if (autoGateResult) {
    return {
      ...state,
      auto_gate_result: {
        ...autoGateResult,
        contract: contract ? { dod, rollback_target: contract.rollback_target, max_retries: contract.max_retries } : null,
      },
    };
  }

  // Even without auto_gate, include contract info for the new phase.
  if (contract) {
    return {
      ...state,
      current_contract: { phase: target_phase, domain, dod, rollback_target: contract.rollback_target },
    };
  }

  return state;
}

/** pdca_check_gate */
export function handleCheckGate({ gate }) {
  const validGates = Object.keys(GATE_REQUIRED);
  if (!validGates.includes(gate)) {
    throw new Error(
      `gate must be one of: ${validGates.join(", ")}. Got: "${gate}"`
    );
  }

  const state = readJson(ACTIVE_FILE);
  if (!state) {
    throw new Error("No active PDCA run. Start one with pdca_start_run.");
  }

  const result = evaluateGate(gate, state);

  logEvent(DATA_DIR, state.run_id, {
    type: "gate_check",
    phase: state.current_phase,
    action: gate,
    data: { passed: result.passed, missing: result.missing },
  });

  logEvent(DATA_DIR, state.run_id, {
    type: result.passed ? "gate_pass" : "gate_fail",
    phase: state.current_phase,
    action: gate,
    data: result.passed ? undefined : { missing: result.missing },
  });

  return result;
}

/** pdca_end_run */
export function handleEndRun() {
  const state = readJson(ACTIVE_FILE);
  if (!state) {
    throw new Error("No active PDCA run to end.");
  }

  const endedAt = new Date().toISOString();

  const summary = {
    run_id: state.run_id,
    topic: state.topic,
    completed_phases: state.completed,
    cycle_count: state.cycle_count,
    artifacts: state.artifacts,
    check_verdict: state.check_verdict,
    refine_count: state.refine_count ?? 0,
    pivot_count: state.pivot_count ?? 0,
    stuck_flags: state.stuck_flags,
    ended_at: endedAt,
  };

  // Log cycle_end before archiving so the event lands in the run's log
  const stats = getEventStats(DATA_DIR, state.run_id);
  logEvent(DATA_DIR, state.run_id, {
    type: "cycle_end",
    phase: state.current_phase,
    data: {
      completed_phases: state.completed,
      cycle_count: state.cycle_count,
      check_verdict: state.check_verdict,
      refine_count: state.refine_count ?? 0,
      pivot_count: state.pivot_count ?? 0,
      stuck_flags: state.stuck_flags,
      event_stats: stats,
      ended_at: endedAt,
    },
  });

  writeJsonAtomic(COMPLETED_FILE, { ...state, ended_at: endedAt });

  // Remove active file after archiving
  if (existsSync(ACTIVE_FILE)) {
    unlinkSync(ACTIVE_FILE);
  }

  return summary;
}

/** pdca_update_stuck_flags */
export function handleUpdateStuckFlags({ flags }) {
  if (!Array.isArray(flags) || flags.length === 0) {
    throw new Error("flags must be a non-empty array of strings");
  }
  for (const f of flags) {
    if (typeof f !== "string") {
      throw new Error("Each flag must be a string");
    }
  }

  const state = readJson(ACTIVE_FILE);
  if (!state) {
    throw new Error("No active PDCA run. Start one with pdca_start_run.");
  }

  const existing = new Set(state.stuck_flags ?? []);
  const newFlags = flags.filter((f) => !existing.has(f));
  for (const f of flags) {
    existing.add(f);
  }
  state.stuck_flags = Array.from(existing);

  writeJsonAtomic(ACTIVE_FILE, state);

  if (newFlags.length > 0) {
    logEvent(DATA_DIR, state.run_id, {
      type: "stuck_detected",
      phase: state.current_phase,
      data: { new_flags: newFlags, all_flags: state.stuck_flags },
    });
  }

  return state;
}

/** pdca_list_runs */
export function handleListRuns() {
  const runs = [];

  // Gather all run IDs from event logs
  const knownRunIds = listRunIds(DATA_DIR);

  // Active run (if any)
  const active = readJson(ACTIVE_FILE);

  // Last completed run
  const lastCompleted = readJson(COMPLETED_FILE);

  // Build a set of all run IDs to process
  const allIds = new Set(knownRunIds);
  if (active) allIds.add(active.run_id);
  if (lastCompleted) allIds.add(lastCompleted.run_id);

  for (const runId of allIds) {
    const events = readEvents(DATA_DIR, runId);

    // Determine started_at from first event
    const started_at = events.length > 0 ? events[0].ts : null;

    // Determine ended_at from cycle_end event
    const cycleEnd = events.find((e) => e.type === "cycle_end");
    const ended_at = cycleEnd?.data?.ended_at ?? null;

    // Determine topic, final_phase, cycles_completed
    let topic = null;
    let final_phase = null;
    let cycles_completed = 0;

    // Check if this is the active run
    if (active && active.run_id === runId) {
      topic = active.topic;
      final_phase = active.current_phase;
      cycles_completed = active.cycle_count ?? 1;
    }

    // Check if this is the last completed run
    if (lastCompleted && lastCompleted.run_id === runId) {
      topic = lastCompleted.topic;
      final_phase = lastCompleted.current_phase;
      cycles_completed = lastCompleted.cycle_count ?? 1;
    }

    // Fall back to event data for topic
    if (!topic) {
      const cycleStart = events.find((e) => e.type === "cycle_start");
      topic = cycleStart?.data?.topic ?? "unknown";
    }

    // Fall back to event data for final_phase
    if (!final_phase) {
      // Last phase_start or phase_end event gives best info
      for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].phase) {
          final_phase = events[i].phase;
          break;
        }
      }
      final_phase = final_phase ?? "unknown";
    }

    // Fall back: count cycle_start events for cycles_completed
    if (!cycles_completed) {
      cycles_completed = events.filter((e) => e.type === "cycle_start").length || 1;
    }

    runs.push({
      run_id: runId,
      topic,
      started_at,
      ended_at,
      final_phase,
      cycles_completed,
      is_active: active?.run_id === runId,
    });
  }

  // Sort: active first, then most recently started
  runs.sort((a, b) => {
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;
    return (b.started_at || "").localeCompare(a.started_at || "");
  });

  return { total: runs.length, runs };
}

// ---------------------------------------------------------------------------
// Event query tool handlers
// ---------------------------------------------------------------------------

/**
 * pdca_get_events
 * Query events for a specific run with optional filters.
 */
export function handleGetEvents({ run_id, type, phase, limit = 100 }) {
  if (typeof run_id !== "string" || run_id.trim() === "") {
    throw new Error("run_id must be a non-empty string");
  }

  const filters = {};
  if (type) filters.type = type;
  if (phase) filters.phase = phase;

  const events = readEvents(DATA_DIR, run_id, filters);
  const limitNum = Math.max(1, Number(limit) || 100);
  const limited = events.slice(-limitNum); // most recent N

  return { run_id, total: events.length, returned: limited.length, events: limited };
}

/**
 * pdca_get_analytics
 * Return cycle analytics for a run (or the most recent run if no run_id given).
 */
export function handleGetAnalytics({ run_id } = {}) {
  let resolvedRunId = run_id;

  // Fall back to the most recently active or completed run
  if (!resolvedRunId) {
    const active = readJson(ACTIVE_FILE);
    if (active) {
      resolvedRunId = active.run_id;
    } else {
      const completed = readJson(COMPLETED_FILE);
      if (completed) {
        resolvedRunId = completed.run_id;
      }
    }
  }

  if (!resolvedRunId) {
    throw new Error("No run_id provided and no active or completed run found.");
  }

  const stats = getEventStats(DATA_DIR, resolvedRunId);
  const allEvents = readEvents(DATA_DIR, resolvedRunId);

  // Phase durations: find phase_start / phase_end pairs
  /** @type {Record<string, { start: number | null, durations: number[] }>} */
  const phaseTracker = {};

  for (const e of allEvents) {
    if (e.type === "phase_start" && e.phase) {
      if (!phaseTracker[e.phase]) phaseTracker[e.phase] = { start: null, durations: [] };
      phaseTracker[e.phase].start = new Date(e.ts).getTime();
    }
    if (e.type === "phase_end" && e.phase) {
      if (!phaseTracker[e.phase]) phaseTracker[e.phase] = { start: null, durations: [] };
      const tracker = phaseTracker[e.phase];
      if (tracker.start !== null) {
        tracker.durations.push(new Date(e.ts).getTime() - tracker.start);
        tracker.start = null;
      }
    }
  }

  /** @type {Record<string, { count: number, avg_duration_ms: number | null }>} */
  const phase_durations = {};
  for (const [phase, tracker] of Object.entries(phaseTracker)) {
    const count = tracker.durations.length;
    const avg = count > 0 ? Math.round(tracker.durations.reduce((a, b) => a + b, 0) / count) : null;
    phase_durations[phase] = { count, avg_duration_ms: avg };
  }

  // Gate pass rate per gate
  const gateEvents = allEvents.filter((e) => e.type === "gate_pass" || e.type === "gate_fail");
  /** @type {Record<string, { pass: number, fail: number, pass_rate: number }>} */
  const gate_stats = {};
  for (const e of gateEvents) {
    const gate = e.action ?? "unknown";
    if (!gate_stats[gate]) gate_stats[gate] = { pass: 0, fail: 0, pass_rate: 0 };
    if (e.type === "gate_pass") gate_stats[gate].pass++;
    else gate_stats[gate].fail++;
  }
  for (const gs of Object.values(gate_stats)) {
    const total = gs.pass + gs.fail;
    gs.pass_rate = total > 0 ? Math.round((gs.pass / total) * 100) / 100 : 0;
  }

  return {
    run_id: resolvedRunId,
    summary: stats,
    phase_durations,
    gate_stats,
  };
}
