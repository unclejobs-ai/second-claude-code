#!/usr/bin/env node

/**
 * PDCA State MCP Server
 *
 * Provides atomic, concurrency-safe state management for PDCA runs.
 * Replaces direct JSON file manipulation with a proper MCP tool interface.
 *
 * Tools:
 *   pdca_get_state          — Returns current active run state or null
 *   pdca_start_run          — Initializes a new PDCA run
 *   pdca_transition         — Transitions to the next phase with validation
 *   pdca_check_gate         — Validates a phase gate before transition
 *   pdca_end_run            — Completes the run and archives final state
 *   pdca_update_stuck_flags — Appends stuck detection flags
 *   pdca_get_events         — Query event log with optional filters
 *   pdca_get_analytics      — Cycle analytics: duration, gate rates, stuck frequency
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Handler imports from focused modules
// ---------------------------------------------------------------------------

import {
  handleGetState,
  handleStartRun,
  handleTransition,
  handleCheckGate,
  handleEndRun,
  handleUpdateStuckFlags,
  handleListRuns,
  handleGetEvents,
  handleGetAnalytics,
} from "./lib/pdca-handlers.mjs";

import {
  handleSoulGetProfile,
  handleSoulRecordObservation,
  handleSoulGetObservations,
} from "./lib/soul-handlers.mjs";

import {
  handleProjectMemoryGet,
  handleProjectMemoryUpsert,
} from "./lib/memory-handlers.mjs";

import {
  handleDaemonGetStatus,
  handleDaemonScheduleWorkflow,
  handleDaemonListJobs,
  handleDaemonStartBackgroundRun,
  handleDaemonListBackgroundRuns,
  handleDaemonQueueNotification,
} from "./lib/daemon-handlers.mjs";

import { handleSessionRecallSearch } from "./lib/session-handlers.mjs";
import {
  getCycleHistory,
  getInsights,
  saveInsight,
} from "./lib/cycle-memory.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? join(PLUGIN_ROOT, ".data");

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
        domain: {
          type: "string",
          enum: ["code", "content", "analysis", "pipeline"],
          description: "The execution domain, which determines which stage contracts are enforced. Default: 'code'.",
        },
      },
      required: ["topic"],
      additionalProperties: false,
    },
  },
  {
    name: "pdca_transition",
    description:
      "Transitions the active PDCA run to the next phase. Validates that the transition is legal (plan→do→check→act). Merges any provided artifacts into the state. When auto_gate=true, the gate for the current phase is evaluated first; if it fails, the transition is blocked and the gate failure is returned instead.",
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
        auto_gate: {
          type: "boolean",
          description:
            "When true, automatically evaluate the gate for the current→target transition before proceeding. If the gate fails, the transition is blocked and the gate result is returned. Default: false.",
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
    name: "pdca_list_runs",
    description:
      "Lists all historical PDCA runs by scanning event logs and state files. Returns an array of run summaries including the active run if one exists. Each entry has: run_id, topic, started_at, ended_at, final_phase, cycles_completed, is_active.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "pdca_get_events",
    description:
      "Query the event log for a PDCA run. Returns typed events (phase_start, gate_pass, stuck_detected, etc.) with optional filtering by type, phase, and limit.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: {
          type: "string",
          description: "The UUID of the PDCA run to query.",
        },
        type: {
          type: "string",
          description:
            "Filter by event type: cycle_start, cycle_end, phase_start, phase_end, gate_check, gate_pass, gate_fail, artifact_created, review_started, review_completed, stuck_detected, error.",
        },
        phase: {
          type: "string",
          enum: ["plan", "do", "check", "act"],
          description: "Filter events to a specific PDCA phase.",
        },
        limit: {
          type: "number",
          description: "Maximum number of events to return (most recent first, default: 100).",
        },
      },
      required: ["run_id"],
      additionalProperties: false,
    },
  },
  {
    name: "pdca_get_analytics",
    description:
      "Return cycle analytics for a PDCA run: total duration, per-phase durations, gate pass rates, and stuck frequency. Defaults to the currently active or last completed run if no run_id is provided.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: {
          type: "string",
          description: "UUID of the run to analyze. Omit to use the active or most recently completed run.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "pdca_get_cycle_history",
    description:
      "Return persisted PDCA cycle memory for a specific cycle or the most recent N cycles, including phase markdown and cycle metrics.",
    inputSchema: {
      type: "object",
      properties: {
        cycle_id: {
          type: "number",
          description: "Optional numeric cycle id to load, such as 1 for cycle-001.",
        },
        last_n: {
          type: "number",
          description: "Optional number of most recent cycles to return when cycle_id is omitted.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "pdca_save_insight",
    description:
      "Persist a structured PDCA insight for later recall across cycles. Critical repeated insights can emit gotcha proposals.",
    inputSchema: {
      type: "object",
      properties: {
        cycle_id: {
          type: "number",
          description: "Numeric cycle id that produced the insight.",
        },
        insight: {
          type: "string",
          description: "The insight text to persist.",
        },
        category: {
          type: "string",
          enum: ["process", "technical", "quality"],
          description: "Insight category.",
        },
        severity: {
          type: "string",
          enum: ["info", "warning", "critical"],
          description: "Insight severity.",
        },
      },
      required: ["cycle_id", "insight", "category", "severity"],
      additionalProperties: false,
    },
  },
  {
    name: "pdca_get_insights",
    description:
      "Query persisted PDCA insights with optional category filtering and minimum decayed weight threshold.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional category filter: process, technical, or quality.",
        },
        last_n: {
          type: "number",
          description: "Maximum number of most recent insights to return (default: 20).",
        },
        min_weight: {
          type: "number",
          description: "Optional minimum decayed weight threshold between 0 and 1.",
        },
      },
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
  {
    name: "project_memory_get",
    description:
      "Read the current project memory layer. Returns both the rendered PROJECT_MEMORY.md snapshot and the structured JSON index.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "project_memory_upsert",
    description:
      "Create or replace a project memory note. Use this for stable repo facts, conventions, and long-lived product decisions that should persist across sessions.",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Stable identifier for the project memory note, e.g. 'runtime' or 'phase-2-direction'.",
        },
        content: {
          type: "string",
          description: "The project memory note content.",
        },
        source: {
          type: "string",
          description: "Optional provenance, such as 'AGENTS.md' or 'user-confirmed'.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags for later indexing and filtering.",
        },
      },
      required: ["key", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "daemon_get_status",
    description:
      "Read the local companion daemon status. Returns whether the daemon is installed, online, and which substrate capabilities are currently available.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "daemon_schedule_workflow",
    description:
      "Create or update a daemon-managed workflow job definition. Jobs are persisted even if the daemon is offline and will be picked up when it resumes.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        workflow_name: { type: "string" },
        schedule: {
          type: "object",
          description: "Schedule metadata such as { type: 'manual' } or { type: 'interval', minutes: 60 }.",
          additionalProperties: true,
        },
        status: { type: "string" },
        next_run_at: { type: "string" },
        tags: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["name", "workflow_name"],
      additionalProperties: false,
    },
  },
  {
    name: "daemon_list_jobs",
    description:
      "List the daemon-managed workflow job definitions currently stored in the local substrate.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "daemon_start_background_run",
    description:
      "Queue a background workflow run in the daemon substrate. The daemon may execute it later when online.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "string" },
        job_id: { type: "string" },
        workflow_name: { type: "string" },
        trigger: { type: "string" },
        status: { type: "string" },
        input: {
          type: "object",
          additionalProperties: true,
        },
      },
      required: ["workflow_name"],
      additionalProperties: false,
    },
  },
  {
    name: "daemon_list_background_runs",
    description:
      "List background workflow runs currently persisted in the daemon substrate, newest first.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "session_recall_search",
    description:
      "Search the local session recall index produced by the companion daemon substrate and session-end hook.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Free-text query over session summaries, topics, workflow names, and tags.",
        },
        limit: {
          type: "number",
          description: "Maximum number of recall entries to return (default: 5).",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "daemon_queue_notification",
    description:
      "Queue a daemon-managed notification attempt for later delivery. Useful when the plugin wants durable notification routing without blocking the foreground session.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string" },
        chat_id: { type: "string" },
        event_type: { type: "string" },
        text: { type: "string" },
        metadata: {
          type: "object",
          additionalProperties: true,
        },
      },
      required: ["event_type", "text"],
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
      case "pdca_list_runs":
        result = handleListRuns();
        break;
      case "pdca_get_events":
        result = handleGetEvents(input);
        break;
      case "pdca_get_analytics":
        result = handleGetAnalytics(input);
        break;
      case "pdca_get_cycle_history":
        result = getCycleHistory(DATA_DIR, input);
        break;
      case "pdca_save_insight":
        result = saveInsight(DATA_DIR, input);
        break;
      case "pdca_get_insights":
        result = getInsights(DATA_DIR, input);
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
      case "project_memory_get":
        result = handleProjectMemoryGet();
        break;
      case "project_memory_upsert":
        result = handleProjectMemoryUpsert(input);
        break;
      case "daemon_get_status":
        result = handleDaemonGetStatus();
        break;
      case "daemon_schedule_workflow":
        result = handleDaemonScheduleWorkflow(input);
        break;
      case "daemon_list_jobs":
        result = handleDaemonListJobs();
        break;
      case "daemon_start_background_run":
        result = handleDaemonStartBackgroundRun(input);
        break;
      case "daemon_list_background_runs":
        result = handleDaemonListBackgroundRuns();
        break;
      case "session_recall_search":
        result = handleSessionRecallSearch(input);
        break;
      case "daemon_queue_notification":
        result = handleDaemonQueueNotification(input);
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
