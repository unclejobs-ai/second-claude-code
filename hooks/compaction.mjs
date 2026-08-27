#!/usr/bin/env node

/**
 * Compaction Hook — Session State Preservation
 *
 * Handles both PreCompact and PostCompact events to preserve PDCA state
 * across Claude Code's automatic context compression.
 *
 * PreCompact:
 *   Reads active state files and writes a compact snapshot to
 *   a session-namespaced snapshot under .data/state/ before compression fires.
 *
 * PostCompact:
 *   Leaves the snapshot for the following SessionStart(source=compact)
 *   event, which is the single restoration channel supported by the host.
 *   SessionStart deletes it after injection.
 *
 * If no active state files exist, both phases exit 0 immediately.
 */

import {
  existsSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { sanitize, readJsonSafe, ensureDir, writeJsonAtomic } from "./lib/utils.mjs";
import { readHookStdin, sanitizeExternalText } from "./lib/soul-observer.mjs";
import { compactionOwner, compactionSnapshotPath } from "./lib/compaction-snapshot.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR =
  process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");
const STATE_DIR = join(DATA_DIR, "state");

function safeExternal(value, maxLen = 400) {
  return sanitizeExternalText(sanitize(value), maxLen);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect all active state and return a compact snapshot object.
 * Returns null if no state files are present.
 */
function buildSnapshot(owner) {
  const pdca = readJsonSafe(join(STATE_DIR, "pdca-active.json"));
  const loop = readJsonSafe(join(STATE_DIR, "loop-active.json"));
  const workflow = readJsonSafe(join(STATE_DIR, "workflow-active.json"));
  const pipeline = readJsonSafe(join(STATE_DIR, "pipeline-active.json"));

  if (!pdca && !loop && !workflow && !pipeline) return null;

  const snapshot = { owner };

  if (pdca) {
    snapshot.pdca = {
      topic: safeExternal(pdca.topic, 400),
      current_phase: safeExternal(pdca.current_phase, 100),
      completed: Array.isArray(pdca.completed)
        ? pdca.completed.slice(0, 16).map((p) => safeExternal(p, 100))
        : [],
      cycle_count: Number(pdca.cycle_count) || 0,
      max_cycles: Number(pdca.max_cycles) || 3,
      check_verdict: pdca.check_verdict
        ? safeExternal(String(pdca.check_verdict), 200)
        : null,
      artifact_paths: Array.isArray(pdca.artifact_paths)
        ? pdca.artifact_paths.slice(0, 12).map((p) => safeExternal(String(p), 300))
        : [],
    };
  }

  if (loop) {
    snapshot.loop = {
      suite: safeExternal(loop.suite || loop.goal, 400),
      generation: Number(loop.generation ?? loop.current_iteration) || 0,
      max_generations: Number(loop.max_generations ?? loop.max) || 3,
      status: safeExternal(loop.status || "running", 100),
      best_score: Number(loop.best_score) || 0,
      scores: Array.isArray(loop.scores) ? loop.scores.slice(0, 32).map((s) => Number(s) || 0) : [],
    };
  }

  if (workflow) {
    snapshot.workflow = {
      name: safeExternal(workflow.name, 400),
      current_step: Number(workflow.current_step) || 0,
      total_steps: Number(workflow.total_steps) || 0,
      status: safeExternal(workflow.status, 100),
    };
  }

  if (pipeline) {
    snapshot.pipeline = {
      name: safeExternal(pipeline.name, 400),
      current_step: Number(pipeline.current_step) || 0,
      total_steps: Number(pipeline.total_steps) || 0,
      status: safeExternal(pipeline.status, 100),
    };
  }

  snapshot.captured_at = new Date().toISOString();
  return snapshot;
}

// ─────────────────────────────────────────────────────────────────────────────
// PreCompact
// ─────────────────────────────────────────────────────────────────────────────

function handlePreCompact(payload) {
  const owner = compactionOwner(payload);
  const snapshotPath = compactionSnapshotPath(DATA_DIR, owner);
  if (!snapshotPath) {
    console.error("[compaction] snapshot skipped because no session identity was provided");
    process.exit(0);
  }
  const snapshot = buildSnapshot(owner);

  if (!snapshot) {
    // No active state — nothing to preserve.
    process.exit(0);
  }

  ensureDir(STATE_DIR);
  writeJsonAtomic(snapshotPath, snapshot);
  console.error("[compaction] PDCA state preserved before compression");
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// PostCompact
// ─────────────────────────────────────────────────────────────────────────────

function handlePostCompact(payload) {
  // Claude Code invokes SessionStart(source=compact) immediately after this
  // event. Keep the snapshot for that hook and emit no stdout: top-level
  // `additionalContext` is not a portable PostCompact response contract and
  // caused duplicate restoration on clients that also run SessionStart.
  const snapshotPath = compactionSnapshotPath(DATA_DIR, compactionOwner(payload));
  if (snapshotPath && existsSync(snapshotPath)) {
    console.error("[compaction] snapshot retained for SessionStart(source=compact)");
  }
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point — detect event from stdin
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  let input = "";
  try {
    input = readHookStdin();
  } catch (error) {
    if (error?.code === "SCC_HOOK_INPUT_TOO_LARGE") {
      console.error(`[compaction] ${error.message}; snapshot event skipped`);
      process.exit(0);
    }
    throw error;
  }

  let event = "";
  let payload = {};
  if (input.trim()) {
    try {
      payload = JSON.parse(input);
      event = String(payload.event || payload.hook_event_name || "").toLowerCase();
    } catch {
      // Malformed stdin — default to no event, will exit below.
    }
  }

  if (event === "precompact") {
    handlePreCompact(payload);
  } else if (event === "postcompact") {
    handlePostCompact(payload);
  } else {
    // Unknown or missing event — exit cleanly without side effects.
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("[compaction] Unexpected error:", err.message);
  process.exit(0);
});
