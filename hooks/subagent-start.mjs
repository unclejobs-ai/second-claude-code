#!/usr/bin/env node

/**
 * SubagentStart Hook — Review Session Initialization & Context Injection
 *
 * Fires every time a subagent starts. The hook is a fast no-op unless the
 * starting subagent is a known reviewer. When a reviewer starts it:
 *
 *   1. Reads the subagent event payload from STDIN.
 *   2. Identifies whether the subagent is a known reviewer.
 *   3. If the namespaced review aggregation file does not exist, creates it
 *      as a safety net (or uses the legacy file when no run ID is available)
 *      (the review skill should create it before dispatch, but this catches
 *      edge cases like manual reviewer invocations).
 *   4. Records the reviewer's start time in the aggregation file.
 *   5. Emits additionalContext with reviewer-specific guidance (e.g., SOUL.md
 *      path for tone-guardian, web search reminder for fact-checker).
 */

import { existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readJsonSafe, ensureDir, writeJsonAtomic } from "./lib/utils.mjs";
import { readHookStdin, sanitizeExternalText, MAX_EXTERNAL_CONTEXT_CHARS } from "./lib/soul-observer.mjs";
import { withFileLockSync } from "./lib/file-mutex-sync.mjs";
import { resolveReviewAggregationConfig } from "./lib/review-config.mjs";
import { participantScope, participantStateDir, readParticipantNames, recordParticipant } from "./lib/participation.mjs";
import { reviewAggregationPath } from "./lib/review-session.mjs";

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
    const raw = readHookStdin();
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === "SCC_HOOK_INPUT_TOO_LARGE") {
      console.error(`[subagent-start] ${error.message}; event ignored`);
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Identify reviewer name from payload
// ─────────────────────────────────────────────────────────────────────────────

function normalizeReviewerName(value) {
  if (typeof value !== "string") return null;
  let normalized = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (normalized.startsWith("scc:")) normalized = normalized.slice("scc:".length);
  else if (normalized.includes(":")) return null;
  return KNOWN_REVIEWERS.has(normalized) ? normalized : null;
}

function identifyReviewer(payload) {
  if (!payload) return null;

  // Try known payload fields for subagent identity. Claude Code 2.1+
  // uses agent_type/agent_id for subagent hooks; older builds and tests used
  // subagent_name/subagent_type/agent_name.
  const candidates = [
    payload.agent_type,
    payload.subagent_name,
    payload.subagent_type,
    payload.name,
    payload.type,
    payload.agent_name,
    payload.tool_input?.subagent_type,
  ];

  for (const candidate of candidates) {
    const reviewer = normalizeReviewerName(candidate);
    if (reviewer) return reviewer;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const payload = readPayload();
  const reviewerName = identifyReviewer(payload);
  const { namespace, path: aggregationPath } = reviewAggregationPath(STATE_DIR, payload);
  const participantDir = participantStateDir(STATE_DIR, payload);

  // Fast-exit: not a known reviewer.
  if (!reviewerName) {
    process.exit(0);
  }

  // The native hook payload has no panel/run identifier. A second review
  // command in the same session/prompt creates a new legacy configuration
  // while the first session panel is still active; reject that overlap instead
  // of silently mixing two panels.
  if (namespace && existsSync(aggregationPath) && existsSync(AGGREGATION_FILE)) {
    const activePanel = readJsonSafe(aggregationPath);
    const pendingPanel = readJsonSafe(AGGREGATION_FILE);
    if (activePanel && !activePanel.consensus && pendingPanel && !pendingPanel.namespace && !pendingPanel.consensus) {
      console.error(`[subagent-start] concurrent review panel rejected for ${namespace}`);
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "SubagentStart",
          additionalContext:
            "[REVIEW CONFLICT] Another review panel is already active in this session and prompt. " +
            "This reviewer will not be counted; finish the active panel before starting another.",
        },
      }));
      process.exit(0);
    }
  }

  // A reviewer-named agent starting outside the Check phase was borrowed by an
  // upstream phase, not dispatched to a panel. The active run's phase is the
  // discriminator: absence of the aggregation file is not, because the review
  // skill's own safety net depends on exactly that condition.
  const activePhase = readJsonSafe(join(STATE_DIR, "pdca-active.json"))?.current_phase;
  if (typeof activePhase === "string" && activePhase && activePhase !== "check") {
    recordParticipant(participantDir, reviewerName);
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "SubagentStart",
          additionalContext:
            `[UPSTREAM] ${reviewerName} is running in the ${activePhase} phase, not on a review panel. ` +
            "It is now barred from the quorum that judges this artifact — dispatch a different reviewer in Check.",
        },
      })
    );
    process.exit(0);
  }

  // ── Locked read-modify-write of aggregation file ──────────────────────────
  // Serialized with subagent-stop to prevent reviewer record loss.
  ensureDir(STATE_DIR); // Ensure directory exists before lock creation
  const state = withFileLockSync(aggregationPath, () => {
    let s = readJsonSafe(aggregationPath);

    // Never let a reused filename from another run leak into this namespace.
    if ((s?.namespace && s.namespace !== namespace) || (namespace && s?.consensus)) s = null;

    if (!s && namespace) {
      // Older review skill revisions create the panel configuration in the
      // unnamespaced file before dispatch. Claim it exactly once so explicit
      // thresholds, external-voter counts, and preset metadata survive the
      // transition to session-isolated aggregation files.
      s = withFileLockSync(AGGREGATION_FILE, () => {
        const legacy = readJsonSafe(AGGREGATION_FILE);
        if (!legacy || legacy.namespace || legacy.consensus) return null;
        try {
          unlinkSync(AGGREGATION_FILE);
        } catch {
          return null;
        }
        return legacy;
      });
    }

    if (!s) {
      // The review skill should create this before dispatch. If it didn't,
      // create a minimal aggregation file so SubagentStop can still aggregate.
      ensureDir(STATE_DIR);
      s = {
        started_at: new Date().toISOString(),
        expected_reviewers: 3, // default for content/strategy/code presets
        threshold: 0.67,
        reviewers: [],
        started_reviewers: [],
      };
    }

    if (namespace) {
      s.namespace = namespace;
      if (payload?.session_id || payload?.sessionId) {
        s.session_id = String(payload.session_id || payload.sessionId).slice(0, 160);
      }
      if (payload?.prompt_id || payload?.promptId) {
        s.prompt_id = String(payload.prompt_id || payload.promptId).slice(0, 160);
      }
    }

    // Snapshot producer participation into every panel before reviewers report.
    // This keeps concurrent same-session panels honest even if one panel reaches
    // consensus and clears the live Do -> Check participant list first.
    const upstreamParticipants = readParticipantNames(participantDir);
    s.upstream_participants = [...new Set([
      ...(Array.isArray(s.upstream_participants) ? s.upstream_participants : []),
      ...upstreamParticipants,
    ])];
    s.participant_scope = participantScope(payload);

    // Record reviewer start time.
    if (!Array.isArray(s.started_reviewers)) {
      s.started_reviewers = [];
    }

    // Avoid duplicate entries on retry.
    if (!s.started_reviewers.some((r) => r.name === reviewerName)) {
      const startedRecord = {
        name: reviewerName,
        started_at: new Date().toISOString(),
      };
      if (typeof payload?.agent_id === "string" && payload.agent_id.trim()) {
        startedRecord.agent_id = payload.agent_id.trim();
      }
      s.started_reviewers.push(startedRecord);
    }

    const config = resolveReviewAggregationConfig(s, payload);
    s.expected_reviewers = config.expected_reviewers;
    s.threshold = config.threshold;
    if (config.preset) {
      s.preset = config.preset;
    }

    writeJsonAtomic(aggregationPath, s);
    return s;
  });

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

  const additionalContext = sanitizeExternalText(lines.join("\n"), MAX_EXTERNAL_CONTEXT_CHARS);
  console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext,
      },
    }));
}

try {
  main();
} catch (err) {
  // Never block subagent startup on hook failure.
  console.error("[subagent-start] Unexpected error:", err.message);
  process.exit(0);
}
