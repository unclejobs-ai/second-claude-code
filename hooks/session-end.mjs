#!/usr/bin/env node

/**
 * Stop Hook — Second Claude Knowledge Work OS
 *
 * Fires when the session ends. Captures:
 * - Active loop/pipeline/PDCA state
 * - Creates HANDOFF.md for cross-session continuity
 */

import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { sanitize, readJsonSafe } from "./lib/utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR =
  process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function collectActiveState() {
  const statePath = join(DATA_DIR, "state");
  const result = { loop: null, pipeline: null, pdca: null };

  const loopState = readJsonSafe(join(statePath, "loop-active.json"));
  if (loopState) {
    result.loop = {
      goal: sanitize(loopState.goal),
      iteration: Number(loopState.current_iteration) || 0,
      max: Number(loopState.max) || 3,
      scores: Array.isArray(loopState.scores) ? loopState.scores : [],
    };
  }

  const pipelineState = readJsonSafe(join(statePath, "pipeline-active.json"));
  if (pipelineState) {
    result.pipeline = {
      name: sanitize(pipelineState.name),
      current_step: Number(pipelineState.current_step) || 0,
      total_steps: Number(pipelineState.total_steps) || 0,
      status: sanitize(pipelineState.status),
    };
  }

  const pdcaState = readJsonSafe(join(statePath, "pdca-active.json"));
  if (pdcaState) {
    result.pdca = {
      topic: sanitize(pdcaState.topic),
      current_phase: sanitize(pdcaState.current_phase),
      completed: Array.isArray(pdcaState.completed) ? pdcaState.completed : [],
    };
  }

  return result;
}

function generateHandoff(state) {
  const lines = [];
  const now = new Date().toISOString();

  lines.push("# HANDOFF.md");
  lines.push("");
  lines.push(`Generated: ${now}`);
  lines.push("");

  // Active state
  lines.push("## Active State");
  lines.push("");

  if (state.loop) {
    lines.push("### Loop");
    lines.push(`- Goal: ${state.loop.goal}`);
    lines.push(
      `- Progress: iteration ${state.loop.iteration}/${state.loop.max}`
    );
    if (state.loop.scores.length > 0) {
      lines.push(`- Scores: ${state.loop.scores.join(" → ")}`);
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
    lines.push("");
  }

  const hasActiveState = state.loop || state.pipeline || state.pdca;
  if (!hasActiveState) {
    lines.push("No active loops, pipelines, or PDCA cycles.");
    lines.push("");
  }

  // Resumption hints
  lines.push("## Resumption");
  lines.push("");
  if (state.loop) {
    lines.push(
      `- To resume loop: re-run \`/second-claude-code:loop\` with the same file — it reads saved state from iteration ${state.loop.iteration}`
    );
  }
  if (state.pipeline) {
    lines.push(
      `- To resume pipeline: \`/second-claude-code:pipeline run ${state.pipeline.name}\` (will resume from step ${state.pipeline.current_step})`
    );
  }
  if (state.pdca) {
    lines.push(
      `- To resume PDCA: \`/second-claude-code:pdca\` — auto-detects phase ${state.pdca.current_phase} from saved state`
    );
  }
  if (!hasActiveState) {
    lines.push("No state to resume. Start fresh with any `/second-claude-code:*` command.");
  }
  lines.push("");

  return lines.join("\n");
}

function main() {
  const state = collectActiveState();

  // Only create HANDOFF.md if there is active state worth persisting
  const hasActiveState = state.loop || state.pipeline || state.pdca;
  if (hasActiveState) {
    ensureDir(DATA_DIR);
    const handoffPath = join(DATA_DIR, "HANDOFF.md");
    const content = generateHandoff(state);
    writeFileSync(handoffPath, content, "utf8");

    const parts = [
      state.loop && "active loop",
      state.pipeline && "active pipeline",
      state.pdca && "active PDCA cycle",
    ].filter(Boolean);
    console.log(
      `Session ended. HANDOFF.md saved with ${parts.join(" + ")} state.`
    );
  }
}

main();
