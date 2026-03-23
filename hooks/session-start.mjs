#!/usr/bin/env node

/**
 * SessionStart Hook — Second Claude Knowledge Work OS
 *
 * Injects core context on session startup:
 * - 9 skills overview + routing rules
 * - Active refine/workflow/PDCA state restoration
 * - Available environment capabilities
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { sanitize, readJsonSafe } from "./lib/utils.mjs";
import { readSoulProfile, readSoulState, isSoulLearning } from "./lib/soul-observer.mjs";
import { readProjectMemorySnapshot } from "./lib/project-memory.mjs";
import { readDaemonStatus } from "./lib/companion-daemon.mjs";

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
      timeout: 5000,
    });
    const parsed = JSON.parse(output);
    return Array.isArray(parsed.capabilities) ? parsed.capabilities : [];
  } catch {
    return [];
  }
}

function getCrashRecovery() {
  const recoveryPath = join(DATA_DIR, "state", "pdca-crash-recovery.json");
  const recovery = readJsonSafe(recoveryPath);
  if (!recovery) return null;

  const topic = sanitize(recovery.topic ?? "unknown");
  const phase = sanitize(recovery.current_phase ?? "unknown");
  const crashedAt = sanitize(recovery.crashed_at ?? "unknown");

  return `PDCA crash recovery available: "${topic}" was in ${phase} phase at ${crashedAt}. Run \`/second-claude-code:pdca\` to resume or delete ${recoveryPath} to discard.`;
}

function getActiveState() {
  const statePath = join(DATA_DIR, "state");
  const parts = [];

  const refine = readJsonSafe(join(statePath, "refine-active.json"));
  if (refine) {
    const goal = sanitize(refine.goal);
    const cur = Number(refine.current_iteration) || 0;
    const max = Number(refine.max) || 3;
    parts.push(`Active refine: "${goal}" (iteration ${cur}/${max})`);
  }

  const pdca = readJsonSafe(join(statePath, "pdca-active.json"));
  if (pdca) {
    const topic = sanitize(pdca.topic);
    const phase = sanitize(pdca.current_phase);
    const completed = Array.isArray(pdca.completed) ? pdca.completed.join(" → ") : "";
    parts.push(`Active PDCA: "${topic}" — current phase: ${phase} (completed: ${completed || "none"})`);

    // Session resume hint — offered when a prior session ID is on record
    const priorSessionId = pdca.session_id
      ? sanitize(String(pdca.session_id))
      : null;
    if (priorSessionId) {
      parts.push(
        `Previous PDCA session: ${priorSessionId}. Use \`claude --resume ${priorSessionId}\` for full context, or continue with compressed state above.`
      );
    }
  }

  const workflow = readJsonSafe(join(statePath, "workflow-active.json"));
  if (workflow) {
    const name = sanitize(workflow.name);
    const step = Number(workflow.current_step) || 0;
    const total = Number(workflow.total_steps) || 0;
    parts.push(`Active workflow: "${name}" (step ${step}/${total})`);
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

function main() {
  const lines = [];
  const capabilities = getCapabilities();

  lines.push("# Second Claude Code — Knowledge Work OS");
  lines.push("");
  lines.push("PDCA loop: Plan (Eevee+Alakazam) → Do (Smeargle) → Check (Xatu+Absol+Porygon+Jigglypuff+Unown) → Act (Action Router → Ditto)");
  lines.push("");
  lines.push("9 commands for all knowledge work:");
  lines.push("");
  lines.push("| Command | Purpose |");
  lines.push("|---------|---------|");
  lines.push("| `/second-claude-code:pdca` | **PDCA orchestrator** — Plan→Do→Check→Act with quality gates + Action Router |");
  lines.push("| `/second-claude-code:research` | Deep autonomous research → structured brief |");
  lines.push("| `/second-claude-code:write` | Content production (newsletter, article, shorts, report) |");
  lines.push("| `/second-claude-code:analyze` | Strategic framework analysis (SWOT, RICE, OKR...) |");
  lines.push("| `/second-claude-code:review` | Multi-perspective quality gate (3-5 parallel reviewers) |");
  lines.push("| `/second-claude-code:refine` | Iterative improvement until quality target met |");
  lines.push("| `/second-claude-code:collect` | Knowledge capture & PARA organization |");
  lines.push("| `/second-claude-code:workflow` | Custom workflow builder (chain any skills) |");
  lines.push("| `/second-claude-code:discover` | Dynamic skill discovery & installation |");
  lines.push("");
  lines.push("PDCA cycle: `/pdca` auto-detects phase and chains skills with gates.");
  lines.push("Or use individual skills: research, write, analyze, review, refine, collect, workflow, discover.");
  lines.push('Action Router: review failures route by root cause (Plan/Do/Loop).');
  lines.push('Say it naturally — "알아보고 보고서 써줘" routes to full PDCA cycle.');
  lines.push("");
  lines.push(
    `Capabilities: ${capabilities.length > 0 ? capabilities.join(", ") : "none detected"}`
  );

  // Crash recovery notice (takes priority over normal state resume)
  const crashRecovery = getCrashRecovery();
  if (crashRecovery) {
    lines.push("");
    lines.push("## Crash Recovery");
    lines.push(crashRecovery);
  }

  // Restore active state if any
  const state = getActiveState();
  if (state) {
    lines.push("");
    lines.push("## Resumed State");
    lines.push(state);
  }

  try {
    const projectMemory = readProjectMemorySnapshot(DATA_DIR);
    if (projectMemory) {
      lines.push("");
      lines.push("## Project Memory");
      lines.push(projectMemory);
    }
  } catch {
    // Non-fatal — project memory injection errors must never break session start.
  }

  try {
    const daemonStatus = readDaemonStatus(DATA_DIR);
    if (daemonStatus.installed || daemonStatus.online) {
      lines.push("");
      lines.push("## Companion Daemon");
      if (daemonStatus.online) {
        lines.push(
          `Status: online (${daemonStatus.mode || "local"}) — scheduler, background runs, notification routing, and session recall are available.`
        );
      } else {
        lines.push(
          "Status: offline — background and scheduled execution are disabled until the daemon heartbeats again."
        );
      }
    }
  } catch {
    // Non-fatal — daemon status errors must never break session start.
  }

  // ── Soul profile injection ─────────────────────────────────────────────────
  // Inject SOUL.md content (truncated) so the model's personality is primed
  // at session start. Appends learning status and proposal notice if relevant.
  try {
    const soulProfile = readSoulProfile(DATA_DIR);
    if (soulProfile) {
      lines.push("");
      lines.push("## Soul");
      lines.push(soulProfile);

      if (isSoulLearning(DATA_DIR)) {
        const soulState = readSoulState(DATA_DIR);
        const obsCount = Number(soulState?.observation_count) || 0;
        const sessCount = Number(soulState?.session_count) || 0;
        lines.push("");
        lines.push(
          `Soul learning active (${obsCount} observations across ${sessCount} sessions)`
        );

        if (soulState?.proposal_due === true) {
          lines.push(
            "Soul evolution proposal ready — run `/second-claude-code:soul propose`"
          );
        }
      }
    }
  } catch {
    // Non-fatal — soul injection errors must never break session start.
  }

  console.log(lines.join("\n"));
}

main();
