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
  readFileSync,
  unlinkSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { sanitize, readJsonSafe, ensureDir, writeJsonAtomic } from "./lib/utils.mjs";
import { listActiveStandards } from "../scripts/lib/standard-record.mjs";
import { readState } from "../scripts/lib/coach-state.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR =
  process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");
const STATE_DIR = join(DATA_DIR, "state");
const SNAPSHOT_PATH = join(STATE_DIR, "compaction-snapshot.json");
const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

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
  const workflow = readJsonSafe(join(STATE_DIR, "workflow-active.json"));
  const pipeline = readJsonSafe(join(STATE_DIR, "pipeline-active.json"));

  if (!pdca && !loop && !workflow && !pipeline) return null;

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

  if (workflow) {
    snapshot.workflow = {
      name: sanitize(workflow.name),
      current_step: Number(workflow.current_step) || 0,
      total_steps: Number(workflow.total_steps) || 0,
      status: sanitize(workflow.status),
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

  if (snapshot.workflow) {
    const { name, current_step, total_steps, status } = snapshot.workflow;
    lines.push(
      `Active workflow: "${name}" (step ${current_step}/${total_steps}, status: ${status})`
    );
  }

  lines.push(
    `Resume: continue from the current phase — state files are intact on disk.`
  );

  // ── Iterative context preservation (Pi UPDATE_SUMMARIZATION pattern) ──────
  // Inject accumulated insights so the post-compression agent doesn't lose
  // cross-cycle learnings. This is the "merge, don't re-summarize" approach.
  const insightsPath = join(DATA_DIR, "cycles", "insights.md");
  if (existsSync(insightsPath)) {
    try {
      const raw = readJsonSafe(insightsPath);
      const insights = (typeof raw === "string" ? raw : null) || String(
        readFileSync(insightsPath, "utf8")
      ).trim();
      if (typeof insights === "string" && insights.length > 0) {
        // Truncate to last 2000 chars to avoid bloating restored context.
        const tail = insights.length > 2000
          ? "…\n" + insights.slice(-2000)
          : insights;
        lines.push("");
        lines.push("[Accumulated Insights From Previous Cycles]");
        lines.push(tail);
      }
    } catch {
      // Non-fatal — insights are supplementary context.
    }
  }

  // Inject the previous compaction summary if it exists, so context
  // accumulates across multiple compressions instead of being lost.
  const prevSummaryPath = join(STATE_DIR, "compaction-prev-summary.txt");
  if (existsSync(prevSummaryPath)) {
    try {
      const prevSummary = String(
        readFileSync(prevSummaryPath, "utf8")
      ).trim();
      if (prevSummary.length > 0) {
        const tail = prevSummary.length > 3000
          ? "…\n" + prevSummary.slice(-3000)
          : prevSummary;
        lines.push("");
        lines.push("[Previous Session Context Summary]");
        lines.push(tail);
      }
    } catch {
      // Non-fatal.
    }
  }

  return lines.join("\n");
}

/**
 * Standards and an open coach interview live on disk independent of the
 * PDCA snapshot above — a session can compact many times without ever
 * touching PDCA/loop/workflow state. Compaction re-summarizes everything
 * the session knew, so an active standard can silently fall out of that
 * summary even though it is still on disk. This re-injects it right after,
 * immune to whatever the summarizer kept or dropped.
 * Kept to one or two lines: this rides through the same summarization
 * step it exists to survive.
 */
function buildCarryOverLines(projectRoot) {
  const lines = [];
  const standards = listActiveStandards(projectRoot);
  if (standards.length > 0) {
    lines.push(`Active standards: ${standards.map((s) => s.id).join(", ")}`);
  }
  const coach = readState(projectRoot);
  if (coach && coach.status !== "pending_approval") {
    const settled = Array.isArray(coach.forks) ? coach.forks.length : 0;
    lines.push(
      `Coach interview open — ${settled} standard(s) settled. Resume with \`/scc:coach resume\`.`
    );
  }
  return lines;
}

function handlePostCompact() {
  const snapshot = readJsonSafe(SNAPSHOT_PATH);
  const carryOver = buildCarryOverLines(PROJECT_ROOT);

  if (!snapshot && carryOver.length === 0) {
    // Nothing to restore.
    process.exit(0);
  }

  if (snapshot) {
    // Delete snapshot before emitting to avoid stale re-injection on subsequent
    // compactions that happen before new state is written.
    try {
      unlinkSync(SNAPSHOT_PATH);
    } catch {
      // Non-fatal — if deletion fails the worst outcome is a redundant injection
      // on the next compaction, which is harmless.
    }
  }

  const parts = [];
  if (snapshot) parts.push(formatRestorationContext(snapshot));
  if (carryOver.length > 0) parts.push(carryOver.join("\n"));
  const context = parts.join("\n\n");

  console.log(
    JSON.stringify({
      additionalContext: context,
    })
  );

  console.error("[compaction] state restored after compression");
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
