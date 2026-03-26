#!/usr/bin/env node

/**
 * Compaction Hook — Second Claude Knowledge Work OS
 *
 * Handles both PreCompact and PostCompact events to preserve PDCA state
 * across Claude Code's automatic context compression.
 *
 * PreCompact:
 *   Reads active state files and writes a compact snapshot to
 *   .data/state/compaction-snapshot.json before compression fires.
 *
 * PostCompact:
 *   Reads the snapshot and emits it as additionalContext so Claude
 *   knows exactly where it is in the PDCA cycle after compression.
 *   Deletes the snapshot file after injection.
 *
 * If no active state files exist, both phases exit 0 immediately.
 */

import {
  existsSync,
  unlinkSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { sanitize, readJsonSafe, ensureDir, writeJsonAtomic } from "./lib/utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR =
  process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");
const STATE_DIR = join(DATA_DIR, "state");
const SNAPSHOT_PATH = join(STATE_DIR, "compaction-snapshot.json");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Collect all active state and return a compact snapshot object.
 * Returns null if no state files are present.
 */
function buildSnapshot() {
  const pdca = readJsonSafe(join(STATE_DIR, "pdca-active.json"));
  const loop = readJsonSafe(join(STATE_DIR, "loop-active.json"));
  const pipeline = readJsonSafe(join(STATE_DIR, "pipeline-active.json"));

  if (!pdca && !loop && !pipeline) return null;

  const snapshot = {};

  if (pdca) {
    snapshot.pdca = {
      topic: sanitize(pdca.topic),
      current_phase: sanitize(pdca.current_phase),
      completed: Array.isArray(pdca.completed) ? pdca.completed : [],
      cycle_count: Number(pdca.cycle_count) || 0,
      max_cycles: Number(pdca.max_cycles) || 3,
      check_verdict: pdca.check_verdict
        ? sanitize(String(pdca.check_verdict))
        : null,
      artifact_paths: Array.isArray(pdca.artifact_paths)
        ? pdca.artifact_paths.map((p) => sanitize(String(p), 300))
        : [],
    };
  }

  if (loop) {
    snapshot.loop = {
      suite: sanitize(loop.suite || loop.goal),
      generation: Number(loop.generation ?? loop.current_iteration) || 0,
      max_generations: Number(loop.max_generations ?? loop.max) || 3,
      status: sanitize(loop.status || "running"),
      best_score: Number(loop.best_score) || 0,
      scores: Array.isArray(loop.scores) ? loop.scores.map((s) => Number(s) || 0) : [],
    };
  }

  if (pipeline) {
    snapshot.pipeline = {
      name: sanitize(pipeline.name),
      current_step: Number(pipeline.current_step) || 0,
      total_steps: Number(pipeline.total_steps) || 0,
      status: sanitize(pipeline.status),
    };
  }

  snapshot.captured_at = new Date().toISOString();
  return snapshot;
}

// ─────────────────────────────────────────────────────────────────────────────
// PreCompact
// ─────────────────────────────────────────────────────────────────────────────

function handlePreCompact() {
  const snapshot = buildSnapshot();

  if (!snapshot) {
    // No active state — nothing to preserve.
    process.exit(0);
  }

  ensureDir(STATE_DIR);
  writeJsonAtomic(SNAPSHOT_PATH, snapshot);
  console.error("[compaction] PDCA state preserved before compression");
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// PostCompact
// ─────────────────────────────────────────────────────────────────────────────

function formatRestorationContext(snapshot) {
  const lines = ["[PDCA State Restored After Compression]"];

  if (snapshot.pdca) {
    const { topic, current_phase, completed, cycle_count, max_cycles, check_verdict, artifact_paths } =
      snapshot.pdca;
    lines.push(`Topic: ${topic}`);
    lines.push(
      `Phase: ${current_phase} (completed: ${completed.length > 0 ? completed.join(" → ") : "none"})`
    );
    lines.push(`Cycle: ${cycle_count}/${max_cycles}`);
    if (check_verdict) {
      lines.push(`Last verdict: ${check_verdict}`);
    }
    if (artifact_paths.length > 0) {
      lines.push(`Key artifacts: ${artifact_paths.join(", ")}`);
    }
  }

  if (snapshot.loop) {
    const { suite, generation, max_generations, status, best_score, scores } = snapshot.loop;
    lines.push(
      `Active loop: "${suite}" (generation ${generation}/${max_generations}, status: ${status})`
    );
    if (best_score > 0) {
      lines.push(`  Best score so far: ${best_score}`);
    }
    if (scores.length > 0) {
      lines.push(`  Loop scores so far: ${scores.join(" → ")}`);
    }
  }

  if (snapshot.pipeline) {
    const { name, current_step, total_steps, status } = snapshot.pipeline;
    lines.push(
      `Active pipeline: "${name}" (step ${current_step}/${total_steps}, status: ${status})`
    );
  }

  lines.push(
    `Resume: continue from the current phase — state files are intact on disk.`
  );

  return lines.join("\n");
}

function handlePostCompact() {
  const snapshot = readJsonSafe(SNAPSHOT_PATH);

  if (!snapshot) {
    // No snapshot was written — nothing to restore.
    process.exit(0);
  }

  // Delete snapshot before emitting to avoid stale re-injection on subsequent
  // compactions that happen before new state is written.
  try {
    unlinkSync(SNAPSHOT_PATH);
  } catch {
    // Non-fatal — if deletion fails the worst outcome is a redundant injection
    // on the next compaction, which is harmless.
  }

  const context = formatRestorationContext(snapshot);

  console.log(
    JSON.stringify({
      additionalContext: context,
    })
  );

  console.error("[compaction] PDCA state restored after compression");
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point — detect event from stdin
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let event = "";
  if (input.trim()) {
    try {
      const parsed = JSON.parse(input);
      event = String(parsed.event || parsed.hook_event_name || "").toLowerCase();
    } catch {
      // Malformed stdin — default to no event, will exit below.
    }
  }

  if (event === "precompact") {
    handlePreCompact();
  } else if (event === "postcompact") {
    handlePostCompact();
  } else {
    // Unknown or missing event — exit cleanly without side effects.
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("[compaction] Unexpected error:", err.message);
  process.exit(1);
});
