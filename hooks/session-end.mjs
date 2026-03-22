#!/usr/bin/env node

/**
 * Stop Hook — Second Claude Knowledge Work OS
 *
 * Synchronous quality gate that fires when Claude attempts to end the session.
 *
 * Gate behavior:
 * - If a PDCA cycle is active AND the Check phase has not been completed,
 *   deny termination with exit code 2 and a user-facing reason.
 * - A short-lived sentinel file prevents the hook from blocking infinitely
 *   if Claude retries the Stop event after the user acknowledges the gate.
 *
 * After passing the gate, writes HANDOFF.md unconditionally (including a
 * "last completed cycle" summary when no active state exists).
 * HANDOFF.md is written with 0o600 permissions (owner read/write only).
 */

import {
  writeFileSync,
  existsSync,
  mkdirSync,
  chmodSync,
  unlinkSync,
  statSync,
  readFileSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { sanitize, readJsonSafe } from "./lib/utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR =
  process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");
const STATE_DIR = join(DATA_DIR, "state");

// Sentinel file used as a stop-hook-active guard.
// If this file exists and is recent, the hook has already fired once in this
// stop attempt — allow through to prevent an infinite denial loop.
const GUARD_FILE = join(STATE_DIR, ".stop-hook-guard");

// Sentinel is considered "recent" if written within the last 30 seconds.
const GUARD_TTL_MS = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Guard helpers
// ─────────────────────────────────────────────────────────────────────────────

function guardIsActive() {
  if (!existsSync(GUARD_FILE)) return false;
  try {
    const { mtimeMs } = statSync(GUARD_FILE);
    return Date.now() - mtimeMs < GUARD_TTL_MS;
  } catch {
    return false;
  }
}

function writeGuard() {
  ensureDir(STATE_DIR);
  writeFileSync(GUARD_FILE, String(Date.now()), "utf8");
}

function clearGuard() {
  if (existsSync(GUARD_FILE)) {
    try {
      unlinkSync(GUARD_FILE);
    } catch {
      // Non-fatal — guard will expire naturally via TTL.
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filesystem helpers
// ─────────────────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDCA quality gate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a block reason string if the session should be denied termination,
 * or null if the session may proceed.
 */
function pdcaBlockReason(pdcaState) {
  if (!pdcaState) return null;

  const phase = String(pdcaState.current_phase || "").toLowerCase();
  const completed = Array.isArray(pdcaState.completed)
    ? pdcaState.completed.map((p) => String(p).toLowerCase())
    : [];

  // Allow if the cycle has reached the Act phase (Check was already completed
  // as the gate into Act) or if Check is explicitly listed as completed.
  const checkDone = completed.includes("check");
  const inActPhase = phase === "act";

  if (checkDone || inActPhase) return null;

  const topic = sanitize(pdcaState.topic || "current cycle");
  return (
    `PDCA cycle "${topic}" is active — Check phase not yet completed. ` +
    `Run /second-claude-code:review before finishing the session. ` +
    `Current phase: ${phase || "unknown"}. ` +
    `Completed: ${completed.length > 0 ? completed.join(" → ") : "none"}.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// State collection
// ─────────────────────────────────────────────────────────────────────────────

function collectActiveState() {
  const result = { refine: null, pipeline: null, pdca: null };

  const refineState = readJsonSafe(join(STATE_DIR, "refine-active.json"));
  if (refineState) {
    result.refine = {
      goal: sanitize(refineState.goal),
      iteration: Number(refineState.current_iteration) || 0,
      max: Number(refineState.max) || 3,
      scores: Array.isArray(refineState.scores) ? refineState.scores : [],
    };
  }

  const pipelineState = readJsonSafe(join(STATE_DIR, "pipeline-active.json"));
  if (pipelineState) {
    result.pipeline = {
      name: sanitize(pipelineState.name),
      current_step: Number(pipelineState.current_step) || 0,
      total_steps: Number(pipelineState.total_steps) || 0,
      status: sanitize(pipelineState.status),
    };
  }

  const pdcaState = readJsonSafe(join(STATE_DIR, "pdca-active.json"));
  if (pdcaState) {
    result.pdca = {
      topic: sanitize(pdcaState.topic),
      current_phase: sanitize(pdcaState.current_phase),
      completed: Array.isArray(pdcaState.completed) ? pdcaState.completed : [],
      cycle_count: Number(pdcaState.cycle_count) || 0,
      check_verdict: pdcaState.check_verdict
        ? sanitize(String(pdcaState.check_verdict))
        : null,
      session_id: pdcaState.session_id
        ? sanitize(String(pdcaState.session_id))
        : null,
      session_history: Array.isArray(pdcaState.session_history)
        ? pdcaState.session_history
        : [],
    };
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDOFF.md generation
// ─────────────────────────────────────────────────────────────────────────────

function generateHandoff(state) {
  const lines = [];
  const now = new Date().toISOString();

  lines.push("# HANDOFF.md");
  lines.push("");
  lines.push(`Generated: ${now}`);
  lines.push("");

  const hasActiveState = state.refine || state.pipeline || state.pdca;

  // ── Active state ──────────────────────────────────────────────────────────
  lines.push("## Active State");
  lines.push("");

  if (state.refine) {
    lines.push("### Refine");
    lines.push(`- Goal: ${state.refine.goal}`);
    lines.push(
      `- Progress: iteration ${state.refine.iteration}/${state.refine.max}`
    );
    if (state.refine.scores.length > 0) {
      lines.push(`- Scores: ${state.refine.scores.join(" → ")}`);
    }
    lines.push("");
  }

  if (state.pipeline) {
    lines.push("### Pipeline");
    lines.push(`- Name: ${state.pipeline.name}`);
    lines.push(
      `- Progress: step ${state.pipeline.current_step}/${state.pipeline.total_steps}`
    );
    lines.push(`- Status: ${state.pipeline.status}`);
    lines.push("");
  }

  if (state.pdca) {
    lines.push("### PDCA");
    lines.push(`- Topic: ${state.pdca.topic}`);
    lines.push(`- Current phase: ${state.pdca.current_phase}`);
    lines.push(
      `- Completed: ${state.pdca.completed.length > 0 ? state.pdca.completed.join(" → ") : "none"}`
    );
    if (state.pdca.cycle_count > 0) {
      lines.push(`- Cycle count: ${state.pdca.cycle_count}`);
    }
    if (state.pdca.check_verdict) {
      lines.push(`- Last check verdict: ${state.pdca.check_verdict}`);
    }
    lines.push("");

    // Session Resume section — only when session history exists
    const sessionHistory = state.pdca.session_history;
    if (sessionHistory.length > 0) {
      lines.push("### Session Resume");
      lines.push("");
      lines.push(
        "Sessions that contributed to this cycle (most recent last):"
      );
      for (const entry of sessionHistory) {
        const sid = sanitize(String(entry.session_id || ""));
        const phase = sanitize(String(entry.phase_completed || ""));
        const ts = sanitize(String(entry.timestamp || ""));
        lines.push(`- \`${sid}\` — completed: ${phase} at ${ts}`);
      }
      lines.push("");
      const latestSessionId = sanitize(
        String(sessionHistory[sessionHistory.length - 1].session_id || "")
      );
      lines.push(
        `**Recommended**: \`claude --resume ${latestSessionId}\` for full context of the most recent session.`
      );
      lines.push(
        "For complex cycles spanning 3+ sessions, resume is strongly preferred over the compressed summary above."
      );
      lines.push("");
    }
  }

  if (!hasActiveState) {
    lines.push("No active refine, pipelines, or PDCA cycles.");
    lines.push("");

    // ── Last completed cycle summary ────────────────────────────────────────
    lines.push("## Last Completed Cycle");
    lines.push("");
    const lastCycle = readJsonSafe(join(STATE_DIR, "pdca-last-completed.json"));
    if (lastCycle) {
      lines.push(`- Topic: ${sanitize(lastCycle.topic || "")}`);
      lines.push(
        `- Completed at: ${sanitize(String(lastCycle.completed_at || ""))}`
      );
      lines.push(
        `- Verdict: ${sanitize(String(lastCycle.check_verdict || ""))}`
      );
      lines.push(
        `- Phases run: ${
          Array.isArray(lastCycle.completed)
            ? lastCycle.completed.join(" → ")
            : "unknown"
        }`
      );
    } else {
      lines.push("No completed PDCA cycle on record.");
    }
    lines.push("");
  }

  // ── Resumption hints ──────────────────────────────────────────────────────
  lines.push("## Resumption");
  lines.push("");
  if (state.refine) {
    lines.push(
      `- To resume refine: re-run \`/second-claude-code:refine\` with the same file — it reads saved state from iteration ${state.refine.iteration}`
    );
  }
  if (state.pipeline) {
    lines.push(
      `- To resume pipeline: \`/second-claude-code:workflow run ${state.pipeline.name}\` (will resume from step ${state.pipeline.current_step})`
    );
  }
  if (state.pdca) {
    lines.push(
      `- To resume PDCA: \`/second-claude-code:pdca\` — auto-detects phase ${state.pdca.current_phase} from saved state`
    );
    const sessionHistory = state.pdca.session_history;
    if (sessionHistory.length > 0) {
      const latestSessionId = sanitize(
        String(sessionHistory[sessionHistory.length - 1].session_id || "")
      );
      lines.push(
        `- For full context: \`claude --resume ${latestSessionId}\``
      );
    }
  }
  if (!hasActiveState) {
    lines.push(
      "No state to resume. Start fresh with any `/second-claude-code:*` command."
    );
  }
  lines.push("");

  return lines.join("\n");
}

function writeHandoff(content) {
  ensureDir(DATA_DIR);
  const handoffPath = join(DATA_DIR, "HANDOFF.md");
  writeFileSync(handoffPath, content, "utf8");
  chmodSync(handoffPath, 0o600);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  // ── Stop-hook-active guard ─────────────────────────────────────────────────
  // If this hook has already fired within the last 30 seconds for this stop
  // attempt, allow through unconditionally. This prevents Claude from being
  // permanently blocked if it retries the Stop event after the user sees the
  // quality gate message.
  if (guardIsActive()) {
    clearGuard();
    // Proceed to HANDOFF generation below without blocking.
  } else {
    // ── PDCA quality gate ──────────────────────────────────────────────────
    const pdcaState = readJsonSafe(join(STATE_DIR, "pdca-active.json"));
    const blockReason = pdcaBlockReason(pdcaState);

    if (blockReason) {
      // Write the guard before blocking so a second stop attempt passes through.
      writeGuard();

      console.log(
        JSON.stringify({
          decision: "block",
          reason: blockReason,
        })
      );
      process.exit(2);
    }
  }

  // ── PDCA session tracking (before HANDOFF generation) ────────────────────
  // Record the current session ID into pdca-active.json so the next session
  // can offer `claude --resume` for full context restoration.
  const currentSessionId = process.env.CLAUDE_SESSION_ID || null;
  if (currentSessionId) {
    const pdcaActivePath = join(STATE_DIR, "pdca-active.json");
    const rawPdca = readJsonSafe(pdcaActivePath);
    if (rawPdca) {
      const sessionHistory = Array.isArray(rawPdca.session_history)
        ? rawPdca.session_history
        : [];

      // Append an entry for every phase completed in the current session
      // (phases not yet recorded in session_history).
      const recordedPhases = new Set(
        sessionHistory.map((e) => String(e.phase_completed || ""))
      );
      const allCompleted = Array.isArray(rawPdca.completed)
        ? rawPdca.completed
        : [];
      const newPhases = allCompleted.filter((p) => !recordedPhases.has(p));

      if (newPhases.length > 0) {
        const ts = new Date().toISOString();
        for (const phase of newPhases) {
          sessionHistory.push({
            session_id: currentSessionId,
            phase_completed: phase,
            timestamp: ts,
          });
        }
      }

      // Always stamp session_id as the last-writer, even if no new phases.
      rawPdca.session_id = currentSessionId;
      rawPdca.session_history = sessionHistory;

      try {
        ensureDir(STATE_DIR);
        writeFileSync(pdcaActivePath, JSON.stringify(rawPdca, null, 2), "utf8");
      } catch {
        // Non-fatal — HANDOFF generation continues.
      }
    }
  }

  // ── HANDOFF.md (always written) ───────────────────────────────────────────
  const state = collectActiveState();
  const content = generateHandoff(state);
  writeHandoff(content);

  const hasActiveState = state.refine || state.pipeline || state.pdca;
  if (hasActiveState) {
    const parts = [
      state.refine && "active refine",
      state.pipeline && "active pipeline",
      state.pdca && "active PDCA cycle",
    ].filter(Boolean);
    console.error(
      `Session ended. HANDOFF.md saved with ${parts.join(" + ")} state.`
    );
  } else {
    console.error("Session ended. HANDOFF.md saved (no active state).");
  }
}

main();
