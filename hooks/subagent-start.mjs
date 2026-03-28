#!/usr/bin/env node

/**
 * SubagentStart Hook — Review Session Initialization & Context Injection
 *
 * Fires every time a subagent starts. The hook is a fast no-op unless the
 * starting subagent is a known reviewer. When a reviewer starts it:
 *
 *   1. Reads the subagent event payload from STDIN.
 *   2. Identifies whether the subagent is a known reviewer.
 *   3. If review-aggregation.json does not exist, creates it as a safety net
 *      (the review skill should create it before dispatch, but this catches
 *      edge cases like manual reviewer invocations).
 *   4. Records the reviewer's start time in the aggregation file.
 *   5. Emits additionalContext with reviewer-specific guidance (e.g., SOUL.md
 *      path for tone-guardian, web search reminder for fact-checker).
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readJsonSafe, ensureDir, writeJsonAtomic } from "./lib/utils.mjs";
import { resolveReviewAggregationConfig } from "./lib/review-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");
const STATE_DIR = join(DATA_DIR, "state");
const AGGREGATION_FILE = join(STATE_DIR, "review-aggregation.json");
const SOUL_FILE = join(DATA_DIR, "soul", "SOUL.md");

// ─────────────────────────────────────────────────────────────────────────────
// Known reviewer names (must match agent definition names)
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_REVIEWERS = new Set([
  "deep-reviewer",
  "devil-advocate",
  "fact-checker",
  "tone-guardian",
  "structure-analyst",
]);

// Reviewer-specific context hints injected via additionalContext.
// These help each reviewer find project-specific resources without bloating
// the agent system prompt.
const REVIEWER_CONTEXT = {
  "tone-guardian": () => {
    if (existsSync(SOUL_FILE)) {
      return "SOUL.md found at .data/soul/SOUL.md — use its ## Tone Rules and ## Anti-Patterns as primary voice criteria.";
    }
    return null;
  },
  "fact-checker": () => {
    return "Use WebSearch and WebFetch to verify every claim. Include source URLs for each verified fact.";
  },
  "deep-reviewer": () => {
    return "Focus on logic gaps, missing edge cases, and structural completeness. Cite exact sections.";
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Read the subagent event payload from STDIN
// ─────────────────────────────────────────────────────────────────────────────

function readPayload() {
  try {
    const raw = readFileSync("/dev/stdin", "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Identify reviewer name from payload
// ─────────────────────────────────────────────────────────────────────────────

function identifyReviewer(payload) {
  if (!payload) return null;

  // Try known payload fields for subagent identity.
  const candidates = [
    payload.subagent_name,
    payload.subagent_type,
    payload.name,
    payload.type,
    payload.agent_name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && KNOWN_REVIEWERS.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const payload = readPayload();
  const reviewerName = identifyReviewer(payload);

  // Fast-exit: not a known reviewer.
  if (!reviewerName) {
    process.exit(0);
  }

  // ── Ensure aggregation file exists (safety net) ─────────────────────────
  let state = readJsonSafe(AGGREGATION_FILE);

  if (!state) {
    // The review skill should create this before dispatch. If it didn't,
    // create a minimal aggregation file so SubagentStop can still aggregate.
    ensureDir(STATE_DIR);
    state = {
      started_at: new Date().toISOString(),
      expected_reviewers: 3, // default for content/strategy/code presets
      threshold: 0.67,
      reviewers: [],
      started_reviewers: [],
    };
  }

  // ── Record reviewer start time ──────────────────────────────────────────
  if (!Array.isArray(state.started_reviewers)) {
    state.started_reviewers = [];
  }

  // Avoid duplicate entries on retry.
  if (!state.started_reviewers.some((r) => r.name === reviewerName)) {
    state.started_reviewers.push({
      name: reviewerName,
      started_at: new Date().toISOString(),
    });
  }

  const config = resolveReviewAggregationConfig(state, payload);
  state.expected_reviewers = config.expected_reviewers;
  state.threshold = config.threshold;
  if (config.preset) {
    state.preset = config.preset;
  }

  writeJsonAtomic(AGGREGATION_FILE, state);

  // ── Emit additionalContext ──────────────────────────────────────────────
  const lines = [];
  lines.push(
    `[REVIEW START] ${reviewerName} started (${state.started_reviewers.length}/${state.expected_reviewers} dispatched).`
  );

  // Inject reviewer-specific context if available.
  const contextFn = REVIEWER_CONTEXT[reviewerName];
  if (contextFn) {
    const hint = contextFn();
    if (hint) {
      lines.push(`[CONTEXT] ${hint}`);
    }
  }

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: lines.join("\n"),
      },
    })
  );
}

try {
  main();
} catch (err) {
  // Never block subagent startup on hook failure.
  console.error("[subagent-start] Unexpected error:", err.message);
  process.exit(0);
}
