#!/usr/bin/env node

/**
 * SubagentStop Hook — Reviewer Consensus Aggregation
 *
 * Fires every time a subagent finishes. The hook is a fast no-op unless a
 * review aggregation session is in progress (i.e. .data/state/review-aggregation.json
 * exists). When aggregation is active it:
 *
 *   1. Reads the subagent's output from STDIN (Claude injects the SubagentStop
 *      event payload as JSON on stdin).
 *   2. Parses the output for verdict and severity markers.
 *   3. Appends the reviewer record to the aggregation file (atomic rename).
 *   4. When all expected reviewers have reported, computes consensus using the
 *      preset-aware threshold defined in skills/review/references/consensus-gate.md
 *      and sets the `consensus` field.
 *   5. Emits additionalContext so the main agent sees the live aggregation state.
 *
 * Verdict detection rules (aligned with consensus-gate.md):
 *   - "APPROVED"            → pass
 *   - "MINOR FIXES"         → pass  (threshold met, no critical — polish only)
 *   - "NEEDS IMPROVEMENT"   → fail  (threshold not met, no critical)
 *   - "MUST FIX"            → fail  (critical finding present)
 *   - "PASS"                → pass  (alias)
 *   - "FAIL"                → fail  (alias)
 *
 * Critical / Warning / Nitpick severity markers:
 *   - Lines starting with "Critical:" count toward critical_count
 *   - Lines starting with "Warning:"  count toward warning_count
 *   - Lines starting with "Nitpick:"  recorded but do not affect gate
 *
 * Any critical_count > 0 forces the reviewer's verdict to MUST FIX and
 * forces the final consensus to MUST FIX regardless of pass/fail tallies.
 */

import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readJsonSafe, ensureDir, writeJsonAtomic } from "./lib/utils.mjs";
import { readHookStdin, sanitizeExternalText } from "./lib/soul-observer.mjs";
import { withFileLockSync } from "./lib/file-mutex-sync.mjs";
import { resolveReviewAggregationConfig } from "./lib/review-config.mjs";
import { participantStateDir, readParticipantNames, clearParticipants } from "./lib/participation.mjs";
import { reviewAggregationPath } from "./lib/review-session.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");
const STATE_DIR = join(DATA_DIR, "state");
const AGGREGATION_FILE = join(STATE_DIR, "review-aggregation.json");
const KNOWN_REVIEWERS = new Set([
  "deep-reviewer",
  "devil-advocate",
  "fact-checker",
  "tone-guardian",
  "structure-analyst",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Read the subagent event payload from STDIN.
// Claude sends a JSON object on stdin for SubagentStop hooks.
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {object | null} parsed subagent hook payload, or null on failure */
function readPayload() {
  try {
    const raw = readHookStdin();
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === "SCC_HOOK_INPUT_TOO_LARGE") {
      console.error(`[subagent-stop] ${error.message}; reviewer result ignored`);
    }
    return null;
  }
}

function normalizeReviewerName(value) {
  if (typeof value !== "string") return null;
  let normalized = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (normalized.startsWith("scc:")) normalized = normalized.slice("scc:".length);
  else if (normalized.includes(":")) return null;
  return KNOWN_REVIEWERS.has(normalized) ? normalized : null;
}

function extractReviewerIdentity(payload) {
  const candidates = [
    payload?.agent_type,
    payload?.subagent_name,
    payload?.subagent_type,
    payload?.agent_name,
    payload?.name,
    payload?.type,
    payload?.tool_input?.subagent_type,
  ];

  for (const candidate of candidates) {
    const reviewer = normalizeReviewerName(candidate);
    if (reviewer) return reviewer;
  }

  return null;
}

function textFromContent(value) {
  if (typeof value === "string") return value.slice(0, 96 * 1024);
  if (Array.isArray(value)) {
    return value
      .slice(0, 128)
      .map((item) => {
        if (typeof item === "string") return item.slice(0, 8 * 1024);
        if (typeof item?.text === "string") return item.text.slice(0, 8 * 1024);
        if (typeof item?.content === "string") return item.content.slice(0, 8 * 1024);
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (value && typeof value === "object") {
    if (typeof value.text === "string") return value.text.slice(0, 96 * 1024);
    if (typeof value.content === "string") return value.content.slice(0, 96 * 1024);
  }
  return "";
}

/** @returns {string} raw subagent output text */
function extractSubagentOutput(payload) {
  if (!payload) return "";
  const candidates = [
    payload.last_assistant_message,
    payload.output,
    payload.result,
    payload.subagent_output,
    payload.content,
  ];

  for (const candidate of candidates) {
    const text = textFromContent(candidate);
    if (text.trim()) return text;
  }

  return "";
}

function reviewerStartedInState(state, reviewerName, agentId) {
  if (!state || !Array.isArray(state.started_reviewers)) return false;
  return state.started_reviewers.some((reviewer) => {
    if (agentId && reviewer.agent_id === agentId) return true;
    return reviewer.name === reviewerName;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Verdict detection
// ─────────────────────────────────────────────────────────────────────────────

const PASS_VERDICTS = new Set(["APPROVED", "MINOR FIXES", "PASS"]);
const FAIL_VERDICTS = new Set(["NEEDS IMPROVEMENT", "MUST FIX", "FAIL"]);

/**
 * Parse reviewer output text and extract structured result.
 *
 * @param {string} text
 * @param {string | null} reviewerName
 * @returns {{ name: string, verdict: string, is_pass: boolean, critical_count: number, warning_count: number, findings: string[], score: number | null }}
 */
function parseReviewerOutput(text, reviewerName = null) {
  text = sanitizeExternalText(text, 96 * 1024);
  const lines = text.split("\n");

  // ── Reviewer name ──────────────────────────────────────────────────────────
  // Prefer hook payload identity. Fallback to explicit "Reviewer:" markers;
  // generic headings like "## Critic Output" are not reviewer names.
  let name = reviewerName || "unknown";
  if (!reviewerName) {
    const nameMatch = text.match(/reviewer[:\s]+([a-z][a-z0-9\-_]+)/i);
    const explicitName = normalizeReviewerName(nameMatch?.[1]);
    if (explicitName) {
      name = explicitName;
    } else {
      const headingMatch = text.match(/^##\s+([a-z][a-z0-9\-_ ]+)/im);
      const headingName = normalizeReviewerName(headingMatch?.[1]);
      if (headingName) {
        name = headingName;
      }
    }
  }

  // ── Score (Critic Schema: **Score**: 0.85 or Score: 0.85) ─────────────────
  let score = null;
  const scoreMatch = text.match(/\*\*Score\*\*:\s*([\d.]+)/i) ?? text.match(/Score:\s*([\d.]+)/i);
  if (scoreMatch) {
    const parsed = parseFloat(scoreMatch[1]);
    if (!isNaN(parsed) && parsed >= 0.0 && parsed <= 1.0) {
      score = parsed;
    }
  }

  // ── Verdict ────────────────────────────────────────────────────────────────
  // Prefer the Critic Schema field; fallback only to a standalone verdict line.
  // A prose scan turns "NOT APPROVED" into approval, so arbitrary mentions are
  // deliberately not treated as gate decisions.
  const orderedVerdicts = [
    "MINOR FIXES",
    "NEEDS IMPROVEMENT",
    "MUST FIX",
    "APPROVED",
    "PASS",
    "FAIL",
  ];
  const normalizeVerdict = (value) => {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toUpperCase().replace(/\s+/g, " ");
    return orderedVerdicts.includes(normalized) ? normalized : null;
  };

  let rawVerdict = null;
  const verdictFieldMatch =
    text.match(/\*\*Verdict\*\*:\s*(MINOR FIXES|NEEDS IMPROVEMENT|MUST FIX|APPROVED|PASS|FAIL)/i) ??
    text.match(/\bVerdict:\s*(MINOR FIXES|NEEDS IMPROVEMENT|MUST FIX|APPROVED|PASS|FAIL)/i);
  rawVerdict = normalizeVerdict(verdictFieldMatch?.[1]);

  if (!rawVerdict) {
    for (const v of orderedVerdicts) {
      const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const standalone = new RegExp(
        `^\\s*(?:#{1,6}\\s+)?(?:[-*]\\s+)?(?:\\*\\*|__)?${escaped}(?:\\*\\*|__)?\\s*[.!]?\\s*$`,
        "im"
      );
      if (standalone.test(text)) {
        rawVerdict = v;
        break;
      }
    }
  }

  // ── Severity markers ───────────────────────────────────────────────────────
  let critical_count = 0;
  let warning_count = 0;
  const findings = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^critical:/i.test(trimmed)) {
      critical_count++;
      if (findings.length < 24) findings.push(sanitizeExternalText(trimmed, 200));
    } else if (/^warning:/i.test(trimmed)) {
      warning_count++;
      if (findings.length < 24) findings.push(sanitizeExternalText(trimmed, 200));
    } else if (/^nitpick:/i.test(trimmed)) {
      if (findings.length < 24) findings.push(sanitizeExternalText(trimmed, 200));
    }
    // Also count inline **Critical** markers that appear in the review report
    // format described in SKILL.md (e.g., "### Critical" section headings).
    else if (/^###\s*critical/i.test(trimmed)) {
      // Count bullet points under the Critical section that follow.
      // This is handled by counting "Critical:" prefixed lines above; but
      // the ### heading itself is not a finding.
    }
  }

  // ── Table-format severity detection (Critic Schema: | N | Severity | ...) ─
  let tableCriticals = 0;
  let tableWarnings = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!/^\|/.test(trimmed)) continue;
    const cells = trimmed.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 3 || !/^\d+$/.test(cells[0])) continue;

    const severity = cells[1].toLowerCase();
    const description = cells.length >= 4 ? cells[3] : cells[2];
    if (/^critical$/.test(severity)) {
      tableCriticals++;
      if (findings.length < 24) findings.push(sanitizeExternalText(`Critical table: ${description}`, 200));
    } else if (/^(warning|major)$/.test(severity)) {
      tableWarnings++;
      if (findings.length < 24) findings.push(sanitizeExternalText(`Warning table: ${description}`, 200));
    } else if (/^(nitpick|minor)$/.test(severity)) {
      if (findings.length < 24) findings.push(sanitizeExternalText(`Nitpick table: ${description}`, 200));
    }
  }

  // Count **[reviewer]** findings under "### Critical" sections via a broader
  // pattern: lines that are findings (start with "- **") inside a Critical block.
  const criticalSectionMatch = text.match(/###\s*Critical\s*\n([\s\S]*?)(?=###|$)/i);
  let headingCriticals = critical_count; // already counted "Critical:" prefixed lines
  if (criticalSectionMatch) {
    const section = criticalSectionMatch[1];
    const bulletCount = (section.match(/^[\s]*-\s+\*\*/gm) || []).length;
    // Only add if the section actually has bullets (avoid double-counting
    // explicitly prefixed "Critical:" lines already counted above).
    if (bulletCount > 0 && headingCriticals === 0) {
      headingCriticals = bulletCount;
      // Extract truncated findings for traceability.
      const bullets = section.match(/^[\s]*-\s+(.+)/gm) || [];
      for (const b of bullets) {
        if (findings.length < 24) findings.push(sanitizeExternalText(b.replace(/^[\s]*-\s+/, ""), 200));
      }
    }
  }

  // Merge counts: take the max for criticals to avoid double-counting the same
  // finding across formats; add table warnings because prefix warnings are
  // independent rows in the Critic Output schema.
  critical_count = Math.max(headingCriticals, tableCriticals);
  warning_count += tableWarnings;

  // ── Score/verdict consistency check ───────────────────────────────────────
  // If the score is below the floor but the verdict is a pass verdict, downgrade it
  // so that schema-compliant reviewers with low scores don't sneak through.
  let resolvedRawVerdict = rawVerdict;
  if (score !== null && score < MIN_AVERAGE_SCORE && rawVerdict !== null && PASS_VERDICTS.has(rawVerdict)) {
    resolvedRawVerdict = "NEEDS IMPROVEMENT";
  }

  // ── Resolve final verdict ──────────────────────────────────────────────────
  // Critical findings override the stated verdict to MUST FIX.
  let verdict = resolvedRawVerdict ?? "UNKNOWN";
  if (critical_count > 0) {
    verdict = "MUST FIX";
  }

  const is_pass = PASS_VERDICTS.has(verdict);

  return { name, verdict, is_pass, critical_count, warning_count, findings, score };
}

// ─────────────────────────────────────────────────────────────────────────────
// Consensus computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute consensus verdict from the current list of reviewer records.
 *
 * @param {Array<{ verdict: string, is_pass: boolean, critical_count: number, warning_count: number, score: number | null }>} reviewers
 * @param {number} expected  total expected reviewer count
 * @param {number} threshold pass fraction (default 0.67) — clamped to [0.5, 1.0]
 * @returns {{ verdict: string, pass_count: number, total: number, required: number, average_score: number | null } | null}
 *   Returns null when not all reviewers have reported yet.
 */
// Two different gates, deliberately two different numbers. `threshold` is a *vote fraction* — 0.67
// of 3 reviewers is a 2/3 majority — while MIN_AVERAGE_SCORE is a floor on the average score itself.
// Collapsing them into one value is what made the docs claim the score gate was 0.67.
const MIN_AVERAGE_SCORE = 0.7;

function computeConsensus(reviewers, expected, threshold = 0.67, excluded = []) {
  if (reviewers.length + excluded.length < expected) return null;

  // Rule 3 of the independence protocol: when exclusion leaves the panel short,
  // report the shortfall instead of passing. Relaxing an exclusion to reach
  // quorum would turn the rule into a suggestion, which is the same as not
  // having it.
  if (reviewers.length < expected) {
    return {
      verdict: "BLOCKED — QUORUM SHORT",
      pass_count: 0,
      total: reviewers.length,
      required: expected,
      average_score: null,
      excluded,
      reason:
        `${excluded.join(", ")} helped produce this artifact and cannot review it. ` +
        `${reviewers.length} independent reviewer(s) reported, ${expected} required. ` +
        "Dispatch replacements that were not upstream; do not lower the bar to fit.",
    };
  }

  const total = reviewers.length;
  // Clamp threshold to a safe range to prevent trivially easy or impossible gates.
  const clampedThreshold = Math.max(0.5, Math.min(1.0, threshold));
  // Math.round (not ceil) so 0.67 * 3 = 2 (2/3 majority), not 3 (unanimity).
  // ceil made 3-reviewer presets require 3/3 and 5-reviewer presets require 4/5,
  // contradicting the documented 2/3 and 3/5 thresholds.
  const required = Math.round(clampedThreshold * total);
  const pass_count = reviewers.filter((r) => r.is_pass).length;
  const any_critical = reviewers.some((r) => r.critical_count > 0);

  // ── Score-based primary gate ───────────────────────────────────────────────
  // Average the scores of reviewers that provided a numeric score.
  const scoringReviewers = reviewers.filter((r) => r.score !== null && r.score !== undefined);
  const average_score =
    scoringReviewers.length > 0
      ? scoringReviewers.reduce((sum, r) => sum + /** @type {number} */ (r.score), 0) /
        scoringReviewers.length
      : null;

  let verdict;
  if (any_critical) {
    verdict = "MUST FIX";
  } else if (average_score !== null) {
    // Score-based path: scores are available from schema-compliant reviewers.
    // Both score AND vote-count must pass — high average alone cannot override
    // a majority-reject outcome.
    if (average_score >= MIN_AVERAGE_SCORE && pass_count >= required) {
      const has_major_findings = reviewers.some(
        (r) => r.warning_count > 0 || r.verdict === "MINOR FIXES"
      );
      verdict = has_major_findings ? "MINOR FIXES" : "APPROVED";
    } else if (average_score >= MIN_AVERAGE_SCORE && pass_count < required) {
      // High score but not enough votes — trust the votes.
      verdict = "NEEDS IMPROVEMENT";
    } else {
      verdict = "NEEDS IMPROVEMENT";
    }
  } else if (pass_count >= required) {
    // Fallback vote-count path when no reviewer provided scores.
    const has_major_findings = reviewers.some(
      (r) => r.warning_count > 0 || r.verdict === "MINOR FIXES"
    );
    verdict = has_major_findings ? "MINOR FIXES" : "APPROVED";
  } else {
    verdict = "NEEDS IMPROVEMENT";
  }

  return { verdict, pass_count, total, required, average_score };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  // ── Parse the subagent's output (before lock, no shared state) ─────────────
  const payload = readPayload();
  const { path: aggregationPath } = reviewAggregationPath(STATE_DIR, payload);
  const participantDir = participantStateDir(STATE_DIR, payload);
  // Do not allow a stop from one session to touch another session's panel.
  if (!existsSync(aggregationPath)) process.exit(0);
  const text = extractSubagentOutput(payload);
  if (!text.trim()) {
    // Empty output — subagent produced nothing useful; skip aggregation update.
    process.exit(0);
  }

  const identityFields = [
    payload?.agent_type,
    payload?.subagent_name,
    payload?.subagent_type,
    payload?.agent_name,
    payload?.name,
    payload?.type,
    payload?.tool_input?.subagent_type,
  ];
  const hasExplicitIdentity = identityFields.some((value) => typeof value === "string" && value.trim());
  const payloadReviewer = extractReviewerIdentity(payload);
  if (hasExplicitIdentity && !payloadReviewer) {
    // A named non-reviewer subagent finished while review aggregation is active.
    // Do not let unrelated agent output pollute reviewer consensus.
    process.exit(0);
  }

  const record = parseReviewerOutput(text, payloadReviewer);
  if (!KNOWN_REVIEWERS.has(record.name)) {
    process.exit(0);
  }
  const agentId = typeof payload?.agent_id === "string" && payload.agent_id.trim()
    ? payload.agent_id.trim()
    : null;

  // ── Locked read-modify-write of aggregation file ──────────────────────────
  // Multiple reviewer subagents may complete simultaneously. withFileLockSync
  // ensures the entire read→update→write cycle is atomic across processes.
  ensureDir(STATE_DIR); // Ensure directory exists before lock creation
  const state = withFileLockSync(aggregationPath, () => {
    const s = readJsonSafe(aggregationPath);
    if (!s) return null;

    if (hasExplicitIdentity && Array.isArray(s.started_reviewers) && s.started_reviewers.length > 0) {
      if (!reviewerStartedInState(s, record.name, agentId)) return null;
    }

    if (!Array.isArray(s.reviewers)) {
      s.reviewers = [];
    }

    const config = resolveReviewAggregationConfig(s);
    const expected = config.expected_reviewers;
    const threshold = config.threshold;
    s.expected_reviewers = expected;
    s.threshold = threshold;
    if (config.preset) {
      s.preset = config.preset;
    }

    // An agent that ran upstream of this artifact keeps its report on file --
    // the findings are still worth reading -- but its vote does not count.
    const upstream = new Set([
      ...(Array.isArray(s.upstream_participants) ? s.upstream_participants : []),
      ...readParticipantNames(participantDir),
    ]);
    if (upstream.has(record.name)) {
      record.excluded = true;
      record.excluded_reason = "ran upstream of this artifact";
    }

    // Avoid duplicate entries for the same named reviewer (last-write wins).
    const existingIndex = s.reviewers.findIndex((r) => r.name === record.name);
    if (existingIndex !== -1) {
      s.reviewers[existingIndex] = record;
    } else {
      s.reviewers.push(record);
    }

    const eligible = s.reviewers.filter((r) => !r.excluded);
    const excludedNames = s.reviewers.filter((r) => r.excluded).map((r) => r.name);
    s.excluded_reviewers = excludedNames;
    s.last_reviewer = record.name;

    // Compute consensus when all reviewers have reported.
    const consensusResult = computeConsensus(eligible, expected, threshold, excludedNames);
    s.consensus = consensusResult
      ? {
          verdict: consensusResult.verdict,
          pass_count: consensusResult.pass_count,
          total: consensusResult.total,
          required: consensusResult.required,
          average_score: consensusResult.average_score,
          excluded: excludedNames,
          reason: consensusResult.reason ?? null,
          computed_at: new Date().toISOString(),
        }
      : null;

    // Clear only after an independent quorum reaches a real gate verdict.
    // A quorum-short result asks for replacement reviewers of the same
    // artifact, so producer identities must survive that retry.
    if (consensusResult && consensusResult.verdict !== "BLOCKED — QUORUM SHORT") {
      clearParticipants(participantDir);
    }

    ensureDir(STATE_DIR);
    writeJsonAtomic(aggregationPath, s);
    return s;
  });

  if (!state) {
    // File vanished between the guard check and now — nothing to do.
    process.exit(0);
  }

  // SubagentStop additionalContext applies to the stopping subagent, not to
  // its parent. Persist the aggregation here; the PostToolUse(Agent) bridge
  // injects the supported parent-session summary after the tool returns.
}


try {
  main();
} catch (err) {
  console.error("[subagent-stop] Unexpected error:", err.message);
  process.exit(0);
}
