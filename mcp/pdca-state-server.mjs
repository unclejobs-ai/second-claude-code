#!/usr/bin/env node

/**
 * PDCA State MCP Server
 *
 * Provides atomic, concurrency-safe state management for PDCA runs.
 * Replaces direct JSON file manipulation with a proper MCP tool interface.
 *
 * Tools:
 *   pdca_get_state         — Returns current active run state or null
 *   pdca_start_run         — Initializes a new PDCA run
 *   pdca_transition        — Transitions to the next phase with validation
 *   pdca_check_gate        — Validates a phase gate before transition
 *   pdca_end_run           — Completes the run and archives final state
 *   pdca_update_stuck_flags — Appends stuck detection flags
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  renameSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  readdirSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? join(PLUGIN_ROOT, ".data");
const STATE_DIR = join(DATA_DIR, "state");
const ACTIVE_FILE = join(STATE_DIR, "pdca-active.json");
const COMPLETED_FILE = join(STATE_DIR, "pdca-last-completed.json");

// Soul paths
const SOUL_DIR = join(DATA_DIR, "soul");
const SOUL_PROFILE_FILE = join(SOUL_DIR, "SOUL.md");
const SOUL_ACTIVE_FILE = join(SOUL_DIR, "soul-active.json");
const SOUL_OBS_DIR = join(SOUL_DIR, "observations");

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
    act_decision: null,
    act_root_cause: null,
  };
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

/** pdca_get_state */
function handleGetState() {
  const state = readJson(ACTIVE_FILE);
  return state;
}

/** pdca_start_run */
function handleStartRun({ topic, max_cycles = 3 }) {
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
  return state;
}

/** pdca_transition */
function handleTransition({ target_phase, artifacts = {} }) {
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

  state.current_phase = target_phase;

  writeJsonAtomic(ACTIVE_FILE, state);
  return state;
}

/** pdca_check_gate */
function handleCheckGate({ gate }) {
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

  return evaluateGate(gate, state);
}

/** pdca_end_run */
function handleEndRun() {
  const state = readJson(ACTIVE_FILE);
  if (!state) {
    throw new Error("No active PDCA run to end.");
  }

  const summary = {
    run_id: state.run_id,
    topic: state.topic,
    completed_phases: state.completed,
    cycle_count: state.cycle_count,
    artifacts: state.artifacts,
    check_verdict: state.check_verdict,
    stuck_flags: state.stuck_flags,
    ended_at: new Date().toISOString(),
  };

  writeJsonAtomic(COMPLETED_FILE, { ...state, ended_at: summary.ended_at });

  // Remove active file after archiving
  if (existsSync(ACTIVE_FILE)) {
    unlinkSync(ACTIVE_FILE);
  }

  return summary;
}

/** pdca_update_stuck_flags */
function handleUpdateStuckFlags({ flags }) {
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
  for (const f of flags) {
    existing.add(f);
  }
  state.stuck_flags = Array.from(existing);

  writeJsonAtomic(ACTIVE_FILE, state);
  return state;
}

// ---------------------------------------------------------------------------
// Soul tool handlers
// ---------------------------------------------------------------------------

/** soul_get_profile */
function handleSoulGetProfile() {
  const profile = existsSync(SOUL_PROFILE_FILE)
    ? readFileSync(SOUL_PROFILE_FILE, "utf8")
    : null;

  let metadata = null;
  if (existsSync(SOUL_ACTIVE_FILE)) {
    try {
      metadata = JSON.parse(readFileSync(SOUL_ACTIVE_FILE, "utf8"));
    } catch (err) {
      throw new Error(`Failed to parse soul-active.json: ${err.message}`);
    }
  }

  return { profile, metadata };
}

/** soul_record_observation */
function handleSoulRecordObservation({ signal, category, confidence, raw_context }) {
  if (typeof signal !== "string" || signal.trim() === "") {
    throw new Error("signal must be a non-empty string");
  }
  if (typeof category !== "string" || category.trim() === "") {
    throw new Error("category must be a non-empty string");
  }

  mkdirSync(SOUL_OBS_DIR, { recursive: true });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filePath = join(SOUL_OBS_DIR, `${today}.jsonl`);

  const record = JSON.stringify({
    ts: new Date().toISOString(),
    signal: signal.trim(),
    category: category.trim(),
    confidence: typeof confidence === "number" ? confidence : 0.8,
    raw_context: typeof raw_context === "string" ? raw_context.slice(0, 200) : "",
  });

  appendFileSync(filePath, record + "\n", "utf8");

  return { recorded: true, file: filePath, ts: JSON.parse(record).ts };
}

/** soul_get_observations */
function handleSoulGetObservations({ category, date_from, date_to, limit = 50 }) {
  if (!existsSync(SOUL_OBS_DIR)) {
    return { observations: [], total: 0 };
  }

  // Gather candidate JSONL files filtered by date range
  const allFiles = readdirSync(SOUL_OBS_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .sort(); // lexicographic = chronological for YYYY-MM-DD

  const filteredFiles = allFiles.filter((f) => {
    const date = f.replace(".jsonl", "");
    if (date_from && date < date_from) return false;
    if (date_to && date > date_to) return false;
    return true;
  });

  /** @type {object[]} */
  const observations = [];

  for (const file of filteredFiles) {
    const filePath = join(SOUL_OBS_DIR, file);
    let content;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (category && obj.category !== category) continue;
        observations.push(obj);
      } catch {
        // Skip malformed lines silently
      }
    }
  }

  // Most recent first, then apply limit
  observations.sort((a, b) => {
    const ta = String(a.ts || "");
    const tb = String(b.ts || "");
    return tb.localeCompare(ta);
  });

  const limitedObs = observations.slice(0, Math.max(1, Number(limit) || 50));

  return { observations: limitedObs, total: observations.length };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = [
  {
    name: "pdca_get_state",
    description:
      "Returns the current active PDCA run state, or null if no run is active. Use this to inspect phase, artifacts, gates, and cycle count.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "pdca_start_run",
    description:
      "Initializes a new PDCA run. Fails if a run is already active. Returns the initial state object.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "The topic or goal for this PDCA cycle.",
        },
        max_cycles: {
          type: "number",
          description: "Maximum number of full PDCA re-cycles allowed (default: 3).",
        },
      },
      required: ["topic"],
      additionalProperties: false,
    },
  },
  {
    name: "pdca_transition",
    description:
      "Transitions the active PDCA run to the next phase. Validates that the transition is legal (plan→do→check→act). Merges any provided artifacts into the state.",
    inputSchema: {
      type: "object",
      properties: {
        target_phase: {
          type: "string",
          enum: ["plan", "do", "check", "act"],
          description: "The phase to transition into.",
        },
        artifacts: {
          type: "object",
          description:
            "Optional artifact paths to merge into state.artifacts. Keys must match artifact field names (plan_research, plan_analysis, do, check_report, act_final).",
          additionalProperties: { type: "string" },
        },
      },
      required: ["target_phase"],
      additionalProperties: false,
    },
  },
  {
    name: "pdca_check_gate",
    description:
      "Validates a phase gate by checking required conditions against the current state. Returns { passed: boolean, missing: string[] }.",
    inputSchema: {
      type: "object",
      properties: {
        gate: {
          type: "string",
          enum: ["plan_to_do", "do_to_check", "check_to_act", "act_to_exit"],
          description: "The gate to evaluate.",
        },
      },
      required: ["gate"],
      additionalProperties: false,
    },
  },
  {
    name: "pdca_end_run",
    description:
      "Completes the active PDCA run. Archives the final state to pdca-last-completed.json, removes pdca-active.json, and returns a run summary.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "pdca_update_stuck_flags",
    description:
      "Appends stuck detection flags to the active run state. Flags are additive and deduplicated. Valid flags: plan_churn, check_avoidance, scope_creep.",
    inputSchema: {
      type: "object",
      properties: {
        flags: {
          type: "array",
          items: { type: "string" },
          description: "Stuck flags to add (e.g. [\"plan_churn\", \"scope_creep\"]).",
        },
      },
      required: ["flags"],
      additionalProperties: false,
    },
  },
  {
    name: "soul_get_profile",
    description:
      "Read the current SOUL.md content and soul-active.json metadata. Returns { profile: string | null, metadata: object | null }. Profile is null when SOUL.md does not exist.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "soul_record_observation",
    description:
      "Append a soul observation to today's JSONL file. Use this for programmatic signal capture outside the hook pipeline.",
    inputSchema: {
      type: "object",
      properties: {
        signal: {
          type: "string",
          description: "Signal identifier (e.g. 'tone_correction', 'brevity_signal').",
        },
        category: {
          type: "string",
          description: "Signal category: 'correction', 'emotional', or 'style'.",
        },
        confidence: {
          type: "number",
          description: "Confidence score between 0 and 1 (default: 0.8).",
        },
        raw_context: {
          type: "string",
          description: "Short excerpt of the user text that triggered the signal (max 200 chars).",
        },
      },
      required: ["signal", "category"],
      additionalProperties: false,
    },
  },
  {
    name: "soul_get_observations",
    description:
      "Query soul observations from daily JSONL files. Supports filtering by category and date range. Returns { observations: object[], total: number }.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category ('correction', 'emotional', 'style'). Omit to return all categories.",
        },
        date_from: {
          type: "string",
          description: "Start date inclusive in YYYY-MM-DD format. Omit for no lower bound.",
        },
        date_to: {
          type: "string",
          description: "End date inclusive in YYYY-MM-DD format. Omit for no upper bound.",
        },
        limit: {
          type: "number",
          description: "Maximum number of observations to return, most recent first (default: 50).",
        },
      },
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------------------
// MCP Server bootstrap
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "pdca-state", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const input = args ?? {};

  try {
    let result;

    switch (name) {
      case "pdca_get_state":
        result = handleGetState();
        break;
      case "pdca_start_run":
        result = handleStartRun(input);
        break;
      case "pdca_transition":
        result = handleTransition(input);
        break;
      case "pdca_check_gate":
        result = handleCheckGate(input);
        break;
      case "pdca_end_run":
        result = handleEndRun();
        break;
      case "pdca_update_stuck_flags":
        result = handleUpdateStuckFlags(input);
        break;
      case "soul_get_profile":
        result = handleSoulGetProfile();
        break;
      case "soul_record_observation":
        result = handleSoulRecordObservation(input);
        break;
      case "soul_get_observations":
        result = handleSoulGetObservations(input);
        break;
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: err.message }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
