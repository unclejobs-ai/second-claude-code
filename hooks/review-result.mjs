#!/usr/bin/env node

/**
 * PostToolUse(Agent) bridge for review aggregation.
 *
 * SubagentStop persists reviewer output; its additionalContext targets the
 * stopping subagent rather than the parent session. PostToolUse targets the
 * parent, so this hook renders the persisted state after an Agent tool returns.
 */

import { existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readHookStdin, sanitizeExternalText, MAX_EXTERNAL_CONTEXT_CHARS } from "./lib/soul-observer.mjs";
import { readJsonSafe } from "./lib/utils.mjs";
import { reviewAggregationPath } from "./lib/review-session.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");
const STATE_DIR = join(DATA_DIR, "state");

function readPayload() {
  try {
    const raw = readHookStdin();
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (error) {
    if (error?.code === "SCC_HOOK_INPUT_TOO_LARGE") {
      console.error(`[review-result] ${error.message}; parent summary skipped`);
    }
    return null;
  }
}

function render(state) {
  const reviewers = Array.isArray(state?.reviewers) ? state.reviewers : [];
  const expected = Number(state?.expected_reviewers) || 0;
  const lines = [`[REVIEW AGGREGATION] ${reviewers.length}/${expected} reviewers reported.`];
  const latest = reviewers.find((reviewer) => reviewer?.name === state?.last_reviewer) || reviewers.at(-1);
  if (latest) {
    lines.push(
      `Latest: ${latest.name} → ${latest.verdict}` +
      (latest.score !== null && latest.score !== undefined ? ` score=${Number(latest.score).toFixed(2)}` : "") +
      (latest.critical_count > 0 ? ` (${latest.critical_count} Critical)` : "") +
      (latest.warning_count > 0 ? ` (${latest.warning_count} Warning)` : "")
    );
  }
  if (Array.isArray(state?.excluded_reviewers) && state.excluded_reviewers.length > 0) {
    lines.push(
      `[EXCLUDED] ${state.excluded_reviewers.join(", ")} ran upstream of this artifact. ` +
      "Findings still count as findings; the votes do not count toward quorum."
    );
  }
  if (state?.consensus) {
    const consensus = state.consensus;
    if (consensus.reason) {
      lines.push(`CONSENSUS: ${consensus.verdict} — ${consensus.reason}`);
    } else {
      const scoreLabel = consensus.average_score !== null && consensus.average_score !== undefined
        ? ` avg_score=${Number(consensus.average_score).toFixed(2)} [score-gate]`
        : " [vote-gate]";
      lines.push(
        `CONSENSUS: ${consensus.verdict} (${consensus.pass_count}/${consensus.total} pass, ` +
        `required ${consensus.required}${scoreLabel})`,
        `Review complete. Proceed with the consensus verdict: ${consensus.verdict}.`
      );
    }
  } else {
    lines.push(`Waiting for ${Math.max(0, expected - reviewers.length)} more reviewer(s) before consensus can be computed.`);
  }
  return sanitizeExternalText(lines.join("\n"), MAX_EXTERNAL_CONTEXT_CHARS);
}

function main() {
  const payload = readPayload();
  if (!payload) return;
  const toolName = payload.tool_name || payload.toolName;
  if (toolName && toolName !== "Agent") return;
  const { namespace, path: aggregationPath } = reviewAggregationPath(STATE_DIR, payload);
  if (!existsSync(aggregationPath)) return;
  const state = readJsonSafe(aggregationPath);
  if (!state || !Array.isArray(state.reviewers) || state.reviewers.length === 0) return;

  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: render(state),
    },
  }));

  // The bridge is the final consumer of a completed session-scoped panel.
  // Keep legacy state for older/manual callers that inspect it after the hook.
  if (namespace && state.consensus) {
    try { unlinkSync(aggregationPath); } catch { /* non-fatal */ }
  }
}

try {
  main();
} catch (error) {
  console.error("[review-result] Unexpected error:", error.message);
  process.exit(0);
}
