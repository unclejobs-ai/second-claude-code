#!/usr/bin/env node

/**
 * Stop + SessionEnd Hook
 *
 * Stop (every turn): quality gate only. Incomplete PDCA Check or an open
 * coach interview exits 2. Passing Stop stamps the PDCA session id and
 * returns — it does not write HANDOFF.md. Claude Code Stop is per-turn.
 *
 * SessionEnd (once per session): handoff, recall, notifications, cycle
 * report, and soul flush. Writes HANDOFF.md only when a run is active.
 * SessionEnd cannot block; an unsafe state directory is a no-op.
 */

import {
  writeFileSync,
  existsSync,
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  renameSync,
  unlinkSync,
  statSync,
  readFileSync,
  appendFileSync,
} from "fs";
import { createHash, randomBytes } from "crypto";
import { join, dirname, isAbsolute, parse, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import { sanitize, readJsonSafe, ensureDir as ensureDirUtil, writeJsonAtomic } from "./lib/utils.mjs";
import { generateCycleReport } from "./lib/report-generator.mjs";
import { isSoulLearning, readSoulState, updateSoulState } from "./lib/soul-observer.mjs";
import {
  appendRecallEntry,
  queueDaemonNotification,
  readDaemonStatus,
} from "./lib/companion-daemon.mjs";
import { readEvents } from "./lib/event-log.mjs";
import { withFileLockSync } from "./lib/file-mutex-sync.mjs";
import { readState } from "../scripts/lib/coach-state.mjs";
import { coachBlockReason } from "./lib/coach-block.mjs";
import { readHookStdin, readTextFileLimited, sanitizeExternalText } from "./lib/soul-observer.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR = resolve(
  process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data")
);
const STATE_DIR = join(DATA_DIR, "state");
let activeSessionId = null;
let sessionIdentitySupplied = false;
let stateDirectorySafe = false;
const STOP_BYPASS_LOG = join(STATE_DIR, "stop-hook-bypass.jsonl");

// Sentinel file used as a stop-hook-active guard.
// If this file exists and is recent, the hook has already fired once in this
// stop attempt — allow through to prevent an infinite denial loop. Scoped per
// session so one session's retry-suppression can't unblock another's PDCA gate
// (all sessions share the global .data dir).
function guardFile() {
  if (activeSessionId) {
    const digest = createHash("sha256").update(activeSessionId).digest("hex");
    return join(STATE_DIR, `.stop-hook-guard-${digest}`);
  }
  return sessionIdentitySupplied ? null : legacyGuardFile();
}

function legacyGuardFile() {
  return join(STATE_DIR, ".stop-hook-guard");
}

function readPayload() {
  try {
    const raw = readHookStdin();
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === "SCC_HOOK_INPUT_TOO_LARGE") {
      console.error(`[stop-hook] ${error.message}; event metadata ignored, state gate still applies`);
      recordGateBypass("oversized Stop payload metadata ignored; active-state gate still evaluated", null);
    }
    return null;
  }
}

function isSessionEndEvent(payload) {
  const name = String(
    payload?.hook_event_name || payload?.hookEventName || payload?.event || ""
  ).toLowerCase();
  return name === "sessionend" || name === "session_end" || name === "session-end";
}

function sessionIdFromPayload(payload) {
  const values = [payload?.session_id, payload?.sessionId, process.env.CLAUDE_SESSION_ID];
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    sessionIdentitySupplied = true;
    // Hook stdin is already bounded, but guard records have a much smaller
    // contract. An oversized identity disables retry bypass rather than
    // falling back to the shared unscoped guard.
    if (Buffer.byteLength(value, "utf8") > 512) return null;
    return value;
  }
  return null;
}

function recordGateBypass(reason, payload) {
  if (!stateDirectorySafe) return;
  try {
    ensureDirUtil(STATE_DIR);
    // Keep this diagnostic log bounded; it is not a second state database.
    try {
      if (statSync(STOP_BYPASS_LOG).size > 256 * 1024) unlinkSync(STOP_BYPASS_LOG);
    } catch { /* file does not exist */ }
    appendFileSync(STOP_BYPASS_LOG, JSON.stringify({
      ts: new Date().toISOString(),
      session_id: activeSessionId,
      reason: sanitizeExternalText(reason, 240),
      stop_hook_active: payload?.stop_hook_active === true,
    }) + "\n", "utf8");
  } catch {
    // Diagnostics must never block a stop attempt.
  }
}

// A claimed guard remains as a short-lived tombstone. Concurrent invocations
// that lose the atomic claim must block, not turn the newly-written guard into
// a second bypass.
const GUARD_TTL_MS = 30_000;
const MAX_GUARD_BYTES = 4096;
const ANSI_RESET = "\u001b[0m";
const ANSI_GREEN = "\u001b[32m";
const ANSI_YELLOW = "\u001b[33m";
const ANSI_RED = "\u001b[31m";

// ─────────────────────────────────────────────────────────────────────────────
// Guard helpers
// ─────────────────────────────────────────────────────────────────────────────

function removeGuardNode(path) {
  if (!path) return false;
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() && !stat.isSymbolicLink()) return false;
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

function canonicalTimestamp(value) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) return null;
  return timestamp;
}

function readGuardRecord(path, expectedSessionId, allowLegacy) {
  let descriptor = null;
  try {
    const entry = lstatSync(path);
    if (!entry.isFile() || entry.isSymbolicLink()) return null;
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > MAX_GUARD_BYTES) {
      return null;
    }
    const raw = readFileSync(descriptor, "utf8");

    if (allowLegacy && /^\d{10,16}$/.test(raw.trim())) {
      const blockedAt = Number(raw.trim());
      const age = Date.now() - blockedAt;
      return age >= 0 && age < GUARD_TTL_MS
        ? { legacy: true, blockedAt, sessionId: null }
        : null;
    }

    const record = JSON.parse(raw);
    if (!record || typeof record !== "object" || Array.isArray(record)) return null;
    const keys = Object.keys(record).sort();
    if (keys.join("\0") !== ["blocked_at", "session_id", "version"].join("\0")) return null;
    if (record.version !== 1 || record.session_id !== expectedSessionId) return null;
    const blockedAt = canonicalTimestamp(record.blocked_at);
    if (blockedAt === null) return null;
    const age = Date.now() - blockedAt;
    return age >= 0 && age < GUARD_TTL_MS
      ? { legacy: false, blockedAt, sessionId: record.session_id }
      : null;
  } catch {
    return null;
  } finally {
    if (descriptor !== null) {
      try { closeSync(descriptor); } catch { /* best effort */ }
    }
  }
}

function claimGuardUnlocked(path, expectedSessionId, allowLegacy) {
  const claimedPath = `${path}.claimed`;
  let claimDescriptor = null;
  let ownedPath = null;
  try {
    try {
      const existing = lstatSync(claimedPath);
      const priorClaim = readGuardRecord(claimedPath, expectedSessionId, allowLegacy);
      const age = Date.now() - existing.mtimeMs;
      if (priorClaim || age < GUARD_TTL_MS) {
        // A valid tombstone or a fresh, possibly still-being-written exclusive
        // claim means another process owns this retry. Never delete it based on
        // an earlier read: that would race the owner between rename and verify.
        removeGuardNode(path);
        return { status: "already-claimed", legacy: priorClaim?.legacy === true };
      }
      if (!existing.isFile() || existing.isSymbolicLink()) {
        return { status: "invalid", legacy: false };
      }
      removeGuardNode(claimedPath);
    } catch (error) {
      if (error?.code !== "ENOENT") return { status: "invalid", legacy: false };
    }

    try {
      claimDescriptor = openSync(claimedPath, "wx", 0o600);
    } catch (error) {
      return error?.code === "EEXIST"
        ? { status: "already-claimed", legacy: false }
        : { status: "invalid", legacy: false };
    }

    ownedPath = `${claimedPath}.owned-${randomBytes(18).toString("hex")}`;
    try {
      const source = lstatSync(path);
      if (!source.isFile() || source.isSymbolicLink()) {
        removeGuardNode(path);
        return { status: "invalid", legacy: false };
      }
      renameSync(path, ownedPath);
    } catch {
      return { status: "none", legacy: false };
    }

    const record = readGuardRecord(ownedPath, expectedSessionId, allowLegacy);
    if (!record) return { status: "invalid", legacy: false };

    const tombstone = JSON.stringify({
      version: 1,
      blocked_at: new Date(record.blockedAt).toISOString(),
      session_id: expectedSessionId,
    });
    writeFileSync(claimDescriptor, tombstone, "utf8");
    fsyncSync(claimDescriptor);
    closeSync(claimDescriptor);
    claimDescriptor = null;
    removeGuardNode(ownedPath);
    ownedPath = null;
    return { status: "consumed", legacy: record.legacy };
  } finally {
    if (claimDescriptor !== null) {
      try { closeSync(claimDescriptor); } catch { /* best effort */ }
      removeGuardNode(claimedPath);
    }
    if (ownedPath) removeGuardNode(ownedPath);
  }
}

function claimGuard(path, expectedSessionId, allowLegacy) {
  if (!path) return { status: "none", legacy: false };
  try {
    return withFileLockSync(
      path,
      () => claimGuardUnlocked(path, expectedSessionId, allowLegacy),
      { maxWaitMs: 10_000 }
    );
  } catch {
    // A lock or filesystem failure must evaluate the quality gate. It must
    // never be reinterpreted as permission to bypass Stop.
    return { status: "invalid", legacy: false };
  }
}

function guardDirectoryIsSafe() {
  try {
    ensureDirUtil(STATE_DIR);
    const stat = lstatSync(STATE_DIR);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function pathIsWithin(candidate, root) {
  const offset = relative(root, candidate);
  return offset === "" || (!offset.startsWith("..") && !isAbsolute(offset));
}

function dataDirectoryIsSafe() {
  // macOS exposes its temporary tree through lexical aliases such as /var ->
  // /private/var. Treat the host-provided temp root as a canonicalized trust
  // anchor, then reject every symlink from that anchor down to DATA_DIR. Paths
  // outside the temp tree are checked all the way to the filesystem root.
  const temporaryRoot = resolve(tmpdir());
  const boundary = pathIsWithin(DATA_DIR, temporaryRoot)
    ? temporaryRoot
    : parse(DATA_DIR).root;
  let cursor = DATA_DIR;

  while (true) {
    try {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink() || !stat.isDirectory()) return false;
    } catch (error) {
      if (error?.code !== "ENOENT") return false;
    }

    if (cursor === boundary) return true;
    const parent = dirname(cursor);
    if (parent === cursor) return true;
    cursor = parent;
  }
}

function writeGuard() {
  const destination = guardFile();
  if (!destination || !guardDirectoryIsSafe()) return false;

  const content = JSON.stringify({
    version: 1,
    blocked_at: new Date().toISOString(),
    session_id: activeSessionId,
  });
  let tempPath = null;
  let descriptor = null;
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      tempPath = join(STATE_DIR, `.stop-hook-tmp-${randomBytes(18).toString("hex")}`);
      try {
        descriptor = openSync(tempPath, "wx", 0o600);
        break;
      } catch (error) {
        if (error?.code !== "EEXIST" || attempt === 3) throw error;
      }
    }
    if (descriptor === null) return false;
    writeFileSync(descriptor, content, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    renameSync(tempPath, destination);
    tempPath = null;
    return true;
  } catch {
    return false;
  } finally {
    if (descriptor !== null) {
      try { closeSync(descriptor); } catch { /* best effort */ }
    }
    if (tempPath) removeGuardNode(tempPath);
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

  const topic = sanitizeExternalText(pdcaState.topic || "current cycle", 400);
  const safePhase = sanitizeExternalText(phase || "unknown", 100);
  return (
    `PDCA cycle "${topic}" is active — Check phase not yet completed. ` +
    `Run /scc:review before finishing the session. ` +
    `Current phase: ${safePhase}. ` +
    `Completed: ${completed.length > 0 ? completed.join(" → ") : "none"}.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// State collection
// ─────────────────────────────────────────────────────────────────────────────

function collectActiveState() {
  const result = { loop: null, refine: null, pipeline: null, pdca: null };

  const loopState = readJsonSafe(join(STATE_DIR, "loop-active.json"));
  if (loopState) {
    result.loop = {
      run_id: sanitizeExternalText(loopState.run_id, 160),
      suite: sanitizeExternalText(loopState.suite || loopState.goal, 400),
      generation: Number(loopState.generation ?? loopState.current_iteration) || 0,
      max_generations: Number(loopState.max_generations ?? loopState.max) || 0,
      status: sanitizeExternalText(loopState.status, 100),
      best_score: Number(loopState.best_score) || 0,
    };
  }

  const refineState = readJsonSafe(join(STATE_DIR, "refine-active.json"));
  if (refineState) {
    result.refine = {
      goal: sanitizeExternalText(refineState.goal, 400),
      iteration: Number(refineState.current_iteration) || 0,
      max: Number(refineState.max) || 3,
      scores: Array.isArray(refineState.scores) ? refineState.scores : [],
    };
  }

  const pipelineState =
    readJsonSafe(join(STATE_DIR, "workflow-active.json")) ||
    readJsonSafe(join(STATE_DIR, "pipeline-active.json"));
  if (pipelineState) {
    result.pipeline = {
      name: sanitizeExternalText(pipelineState.name, 400),
      current_step: Number(pipelineState.current_step) || 0,
      total_steps: Number(pipelineState.total_steps) || 0,
      status: sanitizeExternalText(pipelineState.status, 100),
    };
  }

  const pdcaState = readJsonSafe(join(STATE_DIR, "pdca-active.json"));
  if (pdcaState) {
    result.pdca = {
      run_id: sanitizeExternalText(pdcaState.run_id, 160),
      topic: sanitizeExternalText(pdcaState.topic, 400),
      current_phase: sanitizeExternalText(pdcaState.current_phase, 100),
      completed: Array.isArray(pdcaState.completed) ? pdcaState.completed.slice(0, 16).map((p) => sanitizeExternalText(p, 100)) : [],
      cycle_count: Number(pdcaState.cycle_count) || 0,
      check_verdict: pdcaState.check_verdict
        ? sanitizeExternalText(String(pdcaState.check_verdict), 200)
        : null,
      average_score:
        pdcaState.average_score === null || pdcaState.average_score === undefined
          ? null
          : Number(pdcaState.average_score),
      warning_count: Number(pdcaState.warning_count) || 0,
      critical_findings: Array.isArray(pdcaState.critical_findings)
        ? pdcaState.critical_findings.slice(0, 24).map((f) => sanitizeExternalText(f, 300))
        : [],
      top_improvements: Array.isArray(pdcaState.top_improvements)
        ? pdcaState.top_improvements.slice(0, 24).map((f) => sanitizeExternalText(f, 300))
        : [],
      act_decision: pdcaState.act_decision
        ? sanitizeExternalText(String(pdcaState.act_decision), 300)
        : null,
      session_id: pdcaState.session_id
        ? sanitizeExternalText(String(pdcaState.session_id), 160)
        : null,
      session_history: Array.isArray(pdcaState.session_history)
        ? pdcaState.session_history.slice(-32).map((entry) => ({
            session_id: sanitizeExternalText(entry?.session_id, 160),
            phase_completed: sanitizeExternalText(entry?.phase_completed, 100),
            timestamp: sanitizeExternalText(entry?.timestamp, 100),
          }))
        : [],
    };
  }

  return result;
}

function stripAnsi(value) {
  return sanitizeExternalText(value || "", 100 * 1024);
}

function colorize(text, color) {
  return `${color}${text}${ANSI_RESET}`;
}

function shouldPrintPdcaCycleSummary(pdca) {
  if (!pdca) return false;
  return Array.isArray(pdca.completed) && pdca.completed.includes("act");
}

function completedCycleNumber(pdca) {
  const cycleCount = Number(pdca?.cycle_count) || 1;
  if (String(pdca?.current_phase || "").toLowerCase() === "plan") {
    return Math.max(1, cycleCount - 1);
  }
  return Math.max(1, cycleCount);
}

function computePdcaDurationMinutes(pdca) {
  if (!pdca?.run_id) return 0;
  let events;
  try {
    events = readEvents(DATA_DIR, pdca.run_id);
  } catch {
    // The summary is advisory. Corrupt legacy state or an unreadable event log
    // must not turn a successful Stop hook into an uncaught exit-code-1 crash.
    return 0;
  }
  if (events.length === 0) return 0;

  const firstTs = new Date(events[0].ts).getTime();
  const lastTs = new Date(events[events.length - 1].ts).getTime();
  if (Number.isNaN(firstTs) || Number.isNaN(lastTs) || lastTs < firstTs) {
    return 0;
  }

  return Math.max(0, Math.round((lastTs - firstTs) / 60_000));
}

function computePdcaIssueCount(pdca) {
  const warningCount = Number(pdca?.warning_count) || 0;
  const criticalCount = Array.isArray(pdca?.critical_findings)
    ? pdca.critical_findings.length
    : 0;
  const improvementCount = Array.isArray(pdca?.top_improvements)
    ? pdca.top_improvements.length
    : 0;
  return criticalCount + Math.max(warningCount, improvementCount);
}

function formatPhaseStatus(label, symbol, color) {
  return `${label} ${colorize(symbol, color)}`;
}

function formatCheckStatus(pdca) {
  const verdict = String(pdca?.check_verdict || "").toUpperCase();
  if (verdict === "MUST FIX") {
    return formatPhaseStatus("Check", "✗", ANSI_RED);
  }
  if (verdict === "MINOR FIXES" || verdict === "NEEDS IMPROVEMENT") {
    return formatPhaseStatus("Check", "⚠", ANSI_YELLOW);
  }
  return formatPhaseStatus("Check", "✓", ANSI_GREEN);
}

function buildPdcaSummaryBox(pdca) {
  if (!shouldPrintPdcaCycleSummary(pdca)) return null;

  const cycleNumber = completedCycleNumber(pdca);
  const statusLine = [
    formatPhaseStatus("Plan", "✓", ANSI_GREEN),
    formatPhaseStatus("Do", "✓", ANSI_GREEN),
    formatCheckStatus(pdca),
    formatPhaseStatus("Act", "✓", ANSI_GREEN),
  ].join("  ");

  const scoreValue =
    typeof pdca.average_score === "number" && Number.isFinite(pdca.average_score)
      ? String(Math.round(pdca.average_score * 100))
      : "--";
  const statsLine =
    `Time: ${computePdcaDurationMinutes(pdca)}m  ` +
    `Issues: ${computePdcaIssueCount(pdca)}  ` +
    `Score: ${scoreValue}`;
  const header = `PDCA Cycle #${cycleNumber}`;

  const innerWidth = Math.max(
    header.length + 2,
    stripAnsi(statusLine).length,
    stripAnsi(statsLine).length
  );
  const centeredHeader = ` ${header} `;
  const leftPad = Math.max(0, Math.floor((innerWidth - centeredHeader.length) / 2));
  const rightPad = Math.max(0, innerWidth - centeredHeader.length - leftPad);

  const top = `┌${"─".repeat(leftPad)}${centeredHeader}${"─".repeat(rightPad)}┐`;
  const line = (content) => {
    const visibleWidth = stripAnsi(content).length;
    return `│ ${content}${" ".repeat(Math.max(0, innerWidth - visibleWidth))} │`;
  };
  const bottom = `└${"─".repeat(innerWidth + 2)}┘`;

  return [top, line(statusLine), line(statsLine), bottom].join("\n");
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

  const hasActiveState = state.loop || state.refine || state.pipeline || state.pdca;

  // ── Active state ──────────────────────────────────────────────────────────
  lines.push("## Active State");
  lines.push("");

  if (state.loop) {
    lines.push("### Loop");
    lines.push(`- Suite: ${state.loop.suite}`);
    lines.push(`- Run ID: ${state.loop.run_id}`);
    lines.push(`- Generation: ${state.loop.generation}/${state.loop.max_generations}`);
    lines.push(`- Status: ${state.loop.status}`);
    if (state.loop.best_score > 0) {
      lines.push(`- Best score: ${state.loop.best_score}`);
    }
    lines.push("");
  }

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
    lines.push("No active loops, refine passes, pipelines, or PDCA cycles.");
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
  if (state.loop) {
    lines.push(
      `- To resume loop: \`/scc:loop resume ${state.loop.run_id}\``
    );
  }
  if (state.refine) {
    lines.push(
      `- To resume refine: re-run \`/scc:refine\` with the same file — it reads saved state from iteration ${state.refine.iteration}`
    );
  }
  if (state.pipeline) {
    lines.push(
      `- To resume pipeline: \`/scc:workflow run ${state.pipeline.name}\` (will resume from step ${state.pipeline.current_step})`
    );
  }
  if (state.pdca) {
    lines.push(
      `- To resume PDCA: \`/scc:pdca\` — auto-detects phase ${state.pdca.current_phase} from saved state`
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
      "No state to resume. Start fresh with any `/scc:*` command."
    );
  }
  lines.push("");

  return lines.join("\n");
}

function writeHandoff(content) {
  ensureDirUtil(DATA_DIR);
  const handoffPath = join(DATA_DIR, "HANDOFF.md");
  writeFileSync(handoffPath, content, "utf8");
  chmodSync(handoffPath, 0o600);
  return handoffPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Channel notification helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load channels config from .data/channels.json.
 * Falls back to TELEGRAM_CHAT_ID env var if the file is absent.
 * Returns null when no channel is configured.
 *
 * @returns {{ telegram: { enabled: boolean; chat_id: string } | null; notify_on: string[] } | null}
 */
function loadChannelsConfig() {
  const configPath = join(DATA_DIR, "channels.json");
  const fromFile = readJsonSafe(configPath);
  if (fromFile) return fromFile;

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId) {
    return {
      telegram: { enabled: true, chat_id: chatId },
      notify_on: [
        "phase_transition",
        "review_verdict",
        "cycle_complete",
        "approval_needed",
      ],
    };
  }

  return null;
}

/**
 * Build a human-readable notification text for a PDCA session-end summary.
 *
 * @param {{ pdca: { topic: string; current_phase: string; completed: string[]; check_verdict: string | null } | null }} state
 * @returns {string | null}
 */
function buildPdcaNotificationText(state) {
  if (!state.pdca) return null;

  const { topic, current_phase, completed, check_verdict } = state.pdca;

  const phaseList =
    completed.length > 0 ? completed.join(" \u2192 ") : "none";
  const verdict = check_verdict ? check_verdict : null;

  const lines = [
    `[PDCA] Topic: ${topic}`,
    `Phase: ${current_phase}`,
    `Completed: ${phaseList}`,
  ];

  if (verdict) {
    lines.push(`Status: ${verdict}`);
    const actionNeeded =
      verdict !== "APPROVED" && verdict !== "max_cycles reached";
    lines.push(`Action needed: ${actionNeeded ? "yes" : "no"}`);
  } else {
    lines.push("Status: in progress");
    lines.push("Action needed: no");
  }

  return lines.join("\n");
}

/**
 * Emit a channel notification payload to stdout if a channel is configured
 * and the active state has PDCA progress to report.
 *
 * Claude Code's Notification hook pattern routes the `notification` field
 * to the configured MCP plugin — this function never calls transport directly.
 *
 * @param {{ pdca: { topic: string; current_phase: string; completed: string[]; check_verdict: string | null } | null }} state
 */
function emitChannelNotification(state) {
  const config = loadChannelsConfig();
  if (!config) return;

  const telegram = config.telegram;
  if (!telegram || !telegram.enabled || !telegram.chat_id) return;

  const notifyOn = Array.isArray(config.notify_on) ? config.notify_on : [];

  // Determine event type from current PDCA state.
  let eventType = null;
  if (state.pdca) {
    const { current_phase, check_verdict } = state.pdca;
    if (check_verdict) {
      eventType =
        check_verdict === "APPROVED" || check_verdict === "max_cycles reached"
          ? "cycle_complete"
          : "review_verdict";
    } else if (current_phase) {
      eventType = "phase_transition";
    }
  }

  if (!eventType) return;

  // Filter by notify_on (empty list means all events).
  if (notifyOn.length > 0 && !notifyOn.includes(eventType)) return;

  const text = buildPdcaNotificationText(state);
  if (!text) return;

  // Deliver through the companion daemon's notification queue when it is online.
  // There is intentionally no stdout emission here: SessionEnd stderr is for
  // the user; stdout has no transport that consumes a {notification} object.
  try {
    const daemonStatus = readDaemonStatus(DATA_DIR);
    if (daemonStatus.online) {
      queueDaemonNotification(DATA_DIR, {
        channel: "telegram",
        chat_id: sanitize(String(telegram.chat_id), 64),
        text,
        event_type: eventType,
      });
    }
  } catch {
    // Non-fatal — notification errors must never affect session exit.
  }
}

function buildRecallSummary(state) {
  if (state.loop) {
    return `Loop run "${state.loop.suite}" stopped at generation ${state.loop.generation}/${state.loop.max_generations}.`;
  }
  if (state.pdca) {
    const phaseList =
      state.pdca.completed.length > 0 ? state.pdca.completed.join(" -> ") : "none";
    return `PDCA session for "${state.pdca.topic}" stopped in ${state.pdca.current_phase}. Completed phases: ${phaseList}.`;
  }
  if (state.pipeline) {
    return `Workflow "${state.pipeline.name}" stopped at step ${state.pipeline.current_step}/${state.pipeline.total_steps}.`;
  }
  if (state.refine) {
    return `Refine loop for "${state.refine.goal}" stopped at iteration ${state.refine.iteration}/${state.refine.max}.`;
  }
  return "Session ended with no active PDCA, workflow, or refine state.";
}

function stampPdcaSessionId() {
  const currentSessionId = activeSessionId;
  if (!currentSessionId) return;
  const pdcaActivePath = join(STATE_DIR, "pdca-active.json");
  withFileLockSync(pdcaActivePath, () => {
    const rawPdca = readJsonSafe(pdcaActivePath);
    if (!rawPdca) return;

    const sessionHistory = Array.isArray(rawPdca.session_history)
      ? rawPdca.session_history
      : [];

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

    rawPdca.session_id = currentSessionId;
    rawPdca.session_history = sessionHistory;

    try {
      ensureDirUtil(STATE_DIR);
      writeJsonAtomic(pdcaActivePath, rawPdca);
    } catch {
      // Non-fatal — session tracking must never block Stop or SessionEnd.
    }
  });
}

function finishSessionEnd() {
  stampPdcaSessionId();

  const state = collectActiveState();
  const hasActiveState = state.loop || state.refine || state.pipeline || state.pdca;
  let handoffPath = null;
  if (hasActiveState) {
    const content = generateHandoff(state);
    handoffPath = writeHandoff(content);
    try {
      recordSessionRecall(state, handoffPath);
    } catch {
      // Non-fatal — recall indexing must never affect session exit.
    }
  }

  emitChannelNotification(state);

  const pdcaSummaryBox = buildPdcaSummaryBox(state.pdca);
  if (pdcaSummaryBox) {
    console.error(pdcaSummaryBox);
  }

  if (state.pdca && state.pdca.current_phase === "act") {
    try {
      const pdca = state.pdca;
      const completedPhases = Array.isArray(pdca.completed) ? pdca.completed : [];
      const phaseStatus = (p) =>
        completedPhases.includes(p) ? (pdca.check_verdict === "MUST FIX" && p === "check" ? "fail" : "pass") : "warn";
      const htmlPath = generateCycleReport(DATA_DIR, {
        cycleNumber: pdca.cycle_count || 1,
        phases: {
          plan: phaseStatus("plan"),
          do: phaseStatus("do"),
          check: pdca.check_verdict === "MUST FIX" ? "fail" : pdca.check_verdict === "MINOR FIXES" ? "warn" : phaseStatus("check"),
          act: "pass",
        },
        totalTimeMs: pdca.elapsed_ms || 0,
        issueCount: (pdca.critical_findings || []).length + (pdca.top_improvements || []).length,
        score: pdca.average_score != null ? Math.round(pdca.average_score * 100) : null,
        topic: sanitize(pdca.topic || ""),
        issues: (pdca.critical_findings || []).concat(pdca.top_improvements || []).map(sanitize),
        nextAction: sanitize(pdca.next_action || ""),
      });
      console.error(`[SCC] Cycle report: ${htmlPath}`);
    } catch {
      // Non-fatal — report generation must never block session exit.
    }
  }

  if (hasActiveState) {
    const parts = [
      state.loop && "active loop",
      state.refine && "active refine",
      state.pipeline && "active pipeline",
      state.pdca && "active PDCA cycle",
    ].filter(Boolean);
    console.error(
      `Session ended. HANDOFF.md saved with ${parts.join(" + ")} state.`
    );
  }

  try {
    if (isSoulLearning(DATA_DIR)) {
      const today = new Date().toISOString().slice(0, 10);
      const todayFile = join(DATA_DIR, "soul", "observations", `${today}.jsonl`);
      let todayCount = 0;
      if (existsSync(todayFile)) {
        const lines = (readTextFileLimited(todayFile, 512 * 1024) || "")
          .split("\n")
          .filter((l) => l.trim().length > 0);
        todayCount = lines.length;
      }

      const soulState = readSoulState(DATA_DIR);
      const synthesisThreshold = Number(soulState?.synthesis_threshold) || 30;
      const autoPropose = soulState?.auto_propose !== false;
      const currentCount = Number(soulState?.observation_count) || 0;
      const newTotal = currentCount + todayCount;
      const proposalDue = autoPropose && newTotal >= synthesisThreshold;

      updateSoulState(DATA_DIR, {
        increment_observations: todayCount,
        increment_sessions: true,
        set_proposal_due: proposalDue,
      });
    }
  } catch {
    // Non-fatal — soul flush errors must never affect session exit.
  }
}

function recordSessionRecall(state, handoffPath) {
  const tags = [];
  if (state.loop) tags.push("loop");
  if (state.pdca) tags.push("pdca");
  if (state.pipeline) tags.push("workflow");
  if (state.refine) tags.push("refine");

  appendRecallEntry(DATA_DIR, {
    session_id: activeSessionId,
    topic: state.pdca?.topic || state.loop?.suite || state.refine?.goal || "",
    workflow_name: state.pipeline?.name || "",
    artifact_path: handoffPath,
    summary: buildRecallSummary(state),
    tags,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  // Resolve the plugin-data and state-directory trust boundaries before
  // parsing hook input. The oversized-input path records diagnostics, and
  // every later gate/summary path reads or writes state, so none of them may
  // run through a symlinked or otherwise unsafe STATE_DIR.
  const dataDirectorySafe = dataDirectoryIsSafe();
  stateDirectorySafe = dataDirectorySafe && guardDirectoryIsSafe();
  const payload = readPayload();
  activeSessionId = sessionIdFromPayload(payload);
  const sessionEndEvent = isSessionEndEvent(payload);

  if (!stateDirectorySafe) {
    const unsafeBoundary = dataDirectorySafe ? "state directory" : "plugin data directory";
    if (sessionEndEvent) {
      console.error(`[stop-hook] unsafe ${unsafeBoundary}; SessionEnd skipped`);
      return;
    }
    if (payload?.stop_hook_active === true) {
      // Claude's recursive Stop marker is authoritative, but an authoritative
      // bypass must remain a state-free no-op when the state boundary is
      // unsafe. In particular, do not consume guards, audit, summarize, or
      // update any file reachable through STATE_DIR.
      console.error(`[stop-hook] unsafe ${unsafeBoundary}; recursive Stop allowed without state access`);
      return;
    }
    process.stderr.write(
      `SCC ${unsafeBoundary} is unsafe; refusing to bypass the session quality gate.\n`
    );
    process.exit(2);
  }

  if (sessionEndEvent) {
    finishSessionEnd();
    return;
  }

  const guardDirectorySafe = stateDirectorySafe;

  // Claude marks recursive Stop-hook invocations with stop_hook_active. This
  // is the authoritative re-entry signal; honor it and leave an audit trail so
  // a gate bypass is explainable rather than silently weakening the gate.
  if (payload?.stop_hook_active === true && guardDirectorySafe) {
    recordGateBypass("stop_hook_active=true (recursive Stop hook invocation)", payload);
  }

  // ── Stop-hook-active guard ─────────────────────────────────────────────────
  // A valid guard has one atomic consumer. Losers see the claimed tombstone
  // and evaluate the quality gate instead of turning a concurrent rewrite
  // into another bypass.
  const sessionGuard = guardFile();
  const legacyGuard = legacyGuardFile();
  if (guardDirectorySafe && sessionIdentitySupplied) {
    // An unscoped legacy guard cannot prove which session created it.
    removeGuardNode(legacyGuard);
  }
  const guardClaim = guardDirectorySafe
    ? claimGuard(sessionGuard, activeSessionId, !sessionIdentitySupplied)
    : { status: "invalid", legacy: false };

  if (payload?.stop_hook_active === true || guardClaim.status === "consumed") {
    if (payload?.stop_hook_active !== true && guardClaim.legacy) {
      recordGateBypass("legacy stop-hook guard (hot-upgrade retry suppression)", payload);
    } else if (payload?.stop_hook_active !== true) {
      recordGateBypass("recent stop-hook guard (retry suppression)", payload);
    }
    // Stop already blocked once this turn; do not write HANDOFF.
  } else {
    // ── PDCA quality gate ──────────────────────────────────────────────────
    const pdcaState = readJsonSafe(join(STATE_DIR, "pdca-active.json"));
    const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const blockReason = pdcaBlockReason(pdcaState) || coachBlockReason(readState(projectRoot));

    if (blockReason) {
      // Do not publish another consumable guard while a recent claim exists.
      // Every failed or unsafe claim still takes the intentional exit-2 path.
      if (guardClaim.status !== "already-claimed") writeGuard();

      // Exit 2 blocks the stop; on exit 2 Claude Code reads the reason from
      // stderr (structured stdout JSON is only consumed on exit 0, so the old
      // console.log payload was silently dropped). Deliver the reason on stderr.
      process.stderr.write(blockReason + "\n");
      process.exit(2);
    }
  }

  stampPdcaSessionId();
}

try {
  main();
} catch (error) {
  // Stop is a host lifecycle hook. Persistence/reporting failures must not
  // strand the terminal with "Stop hook (failed)". The intentional quality
  // gate above exits 2 directly and is therefore unaffected by this guard.
  console.error(`[session-end] fail-open after unexpected error: ${error.message}`);
  process.exit(0);
}
