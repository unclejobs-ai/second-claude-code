#!/usr/bin/env node

/**
 * SessionStart Hook — Second Claude Knowledge Work OS
 *
 * Injects core context on session startup:
 * - 8 killer skills overview + routing rules
 * - Active loop/pipeline state restoration
 * - Available environment capabilities
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR =
  process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");

function getActiveState() {
  const statePath = join(DATA_DIR, "state");
  if (!existsSync(statePath)) return null;

  const parts = [];

  // Check active loops
  const loopState = join(statePath, "loop-active.json");
  if (existsSync(loopState)) {
    try {
      const loop = JSON.parse(readFileSync(loopState, "utf8"));
      parts.push(
        `Active loop: "${loop.goal}" (iteration ${loop.current}/${loop.max})`
      );
    } catch {
      /* ignore corrupt state */
    }
  }

  // Check active pipelines
  const pipelineState = join(statePath, "pipeline-active.json");
  if (existsSync(pipelineState)) {
    try {
      const pipeline = JSON.parse(readFileSync(pipelineState, "utf8"));
      parts.push(
        `Active pipeline: "${pipeline.name}" (step ${pipeline.currentStep}/${pipeline.totalSteps})`
      );
    } catch {
      /* ignore corrupt state */
    }
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

function main() {
  const lines = [];

  lines.push("# Second Claude — Knowledge Work OS");
  lines.push("");
  lines.push("8 commands for all knowledge work:");
  lines.push("");
  lines.push("| Command | Purpose |");
  lines.push("|---------|---------|");
  lines.push("| `/scc:research` | Deep autonomous research → structured brief |");
  lines.push("| `/scc:write` | Content production (newsletter, article, shorts, report) |");
  lines.push("| `/scc:analyze` | Strategic framework analysis (SWOT, RICE, OKR...) |");
  lines.push("| `/scc:review` | Multi-perspective quality gate (3 parallel reviewers) |");
  lines.push("| `/scc:loop` | Iterative improvement until quality target met |");
  lines.push("| `/scc:capture` | Knowledge capture & PARA organization |");
  lines.push("| `/scc:pipeline` | Custom workflow builder (chain any skills) |");
  lines.push("| `/scc:hunt` | Dynamic skill discovery & installation |");
  lines.push("");
  lines.push("Skills compose: `/scc:write` auto-calls `/scc:research` + `/scc:review`.");
  lines.push("Or say it naturally — \"뉴스레터 써줘\" routes to the right skill.");

  // Restore active state if any
  const state = getActiveState();
  if (state) {
    lines.push("");
    lines.push("## Resumed State");
    lines.push(state);
  }

  console.log(lines.join("\n"));
}

main();
