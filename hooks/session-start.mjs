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
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR =
  process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");

function getCapabilities() {
  try {
    const scriptPath = join(PLUGIN_ROOT, "scripts", "detect-environment.sh");
    const output = execFileSync("bash", [scriptPath], {
      encoding: "utf8",
      env: process.env,
    });
    const parsed = JSON.parse(output);
    return Array.isArray(parsed.capabilities) ? parsed.capabilities : [];
  } catch {
    return [];
  }
}

function sanitize(val, maxLen = 200) {
  return String(val || "").replace(/[[\](){}#*`<>]/g, "").slice(0, maxLen);
}

function getActiveState() {
  const statePath = join(DATA_DIR, "state");
  if (!existsSync(statePath)) return null;

  const parts = [];

  // Check active loops
  const loopState = join(statePath, "loop-active.json");
  if (existsSync(loopState)) {
    try {
      const loop = JSON.parse(readFileSync(loopState, "utf8"));
      const goal = sanitize(loop.goal);
      const cur = Number(loop.current_iteration) || 0;
      const max = Number(loop.max) || 3;
      parts.push(`Active loop: "${goal}" (iteration ${cur}/${max})`);
    } catch {
      /* ignore corrupt state */
    }
  }

  // Check active pipelines
  const pipelineState = join(statePath, "pipeline-active.json");
  if (existsSync(pipelineState)) {
    try {
      const pipeline = JSON.parse(readFileSync(pipelineState, "utf8"));
      const name = sanitize(pipeline.name);
      const step = Number(pipeline.current_step) || 0;
      const total = Number(pipeline.total_steps) || 0;
      parts.push(`Active pipeline: "${name}" (step ${step}/${total})`);
    } catch {
      /* ignore corrupt state */
    }
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

function main() {
  const lines = [];
  const capabilities = getCapabilities();

  lines.push("# Second Claude Code — Knowledge Work OS");
  lines.push("");
  lines.push("PDCA loop: Plan/Gather → Do/Produce → Check/Verify → Act/Refine");
  lines.push("");
  lines.push("8 commands for all knowledge work:");
  lines.push("");
  lines.push("| Command | Purpose |");
  lines.push("|---------|---------|");
  lines.push("| `/second-claude-code:research` | Deep autonomous research → structured brief |");
  lines.push("| `/second-claude-code:write` | Content production (newsletter, article, shorts, report) |");
  lines.push("| `/second-claude-code:analyze` | Strategic framework analysis (SWOT, RICE, OKR...) |");
  lines.push("| `/second-claude-code:review` | Multi-perspective quality gate (3 parallel reviewers) |");
  lines.push("| `/second-claude-code:loop` | Iterative improvement until quality target met |");
  lines.push("| `/second-claude-code:collect` | Knowledge collection & PARA organization |");
  lines.push("| `/second-claude-code:pipeline` | Custom workflow builder (chain any skills) |");
  lines.push("| `/second-claude-code:hunt` | Dynamic skill discovery & installation |");
  lines.push("");
  lines.push("Phase map: Gather = research + hunt + collect | Produce = analyze + write + pipeline | Verify = review | Refine = loop");
  lines.push("");
  lines.push("Skills compose: `/second-claude-code:write` auto-calls `/second-claude-code:research` + `/second-claude-code:review`.");
  lines.push('Or say it naturally — "write a newsletter" routes to the right skill.');
  lines.push("");
  lines.push(
    `Capabilities: ${capabilities.length > 0 ? capabilities.join(", ") : "none detected"}`
  );

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
