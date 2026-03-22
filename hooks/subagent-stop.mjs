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
 *      2/3 threshold defined in skills/review/references/consensus-gate.md and
 *      sets the `consensus` field.
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

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readJsonSafe, sanitize, ensureDir, writeJsonAtomic } from "./lib/utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");
const STATE_DIR = join(DATA_DIR, "state");
const AGGREGATION_FILE = join(STATE_DIR, "review-aggregation.json");

// ─────────────────────────────────────────────────────────────────────────────
// Fast-exit guard: do nothing when no aggregation is in progress.
// ─────────────────────────────────────────────────────────────────────────────

if (!existsSync(AGGREGATION_FILE)) {
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Read the subagent event payload from STDIN.
// Claude sends a JSON object on stdin for SubagentStop hooks.
// ─────────────────────────────────────────────────────────────────────────────

/** @returns {string} raw subagent output text, or "" on failure */
function readSubagentOutput() {
  try {
    const raw = readFileSync("/dev/stdin", "utf8");
    if (!raw.trim()) return "";
    const payload = JSON.parse(raw);
    // The subagent's final text output lives at different paths depending on
    // Claude's hook protocol version; try both known locations.
    const text =
      payload?.output ??
      payload?.result ??
      payload?.content ??
      payload?.subagent_output ??
      "";
    return typeof text === "string" ? text : JSON.stringify(text);
  } catch {
    return "";
  }
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
 * @returns {{ name: string, verdict: string, is_pass: boolean, critical_count: number, warning_count: number, findings: string[], score: number | null }}
 */
function parseReviewerOutput(text) {
  const lines = text.split("\n");

  // ── Reviewer name ──────────────────────────────────────────────────────────
  // Look for "Reviewer: <name>" or "## <name>" or fall back to "unknown".
  let name = "unknown";
  const nameMatch = text.match(/reviewer[:\s]+([a-z][a-z0-9\-_]+)/i);
  if (nameMatch) {
    name = sanitize(nameMatch[1].toLowerCase().trim(), 50);
  } else {
    const headingMatch = text.match(/^##\s+([a-z][a-z0-9\-_ ]+)/im);
    if (headingMatch) {
      name = sanitize(headingMatch[1].toLowerCase().trim(), 50);
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
  // Scan for the first occurrence of a known verdict keyword.
  // Order matters: longer matches first to avoid "APPROVED" inside a sentence
  // matching before "MINOR FIXES".
  const orderedVerdicts = [
    "MINOR FIXES",
    "NEEDS IMPROVEMENT",
    "MUST FIX",
    "APPROVED",
    "PASS",
    "FAIL",
  ];
  let rawVerdict = null;
  for (const v of orderedVerdicts) {
    if (text.includes(v)) {
      rawVerdict = v;
      break;
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
      findings.push(sanitize(trimmed, 200));
    } else if (/^warning:/i.test(trimmed)) {
      warning_count++;
      findings.push(sanitize(trimmed, 200));
    } else if (/^nitpick:/i.test(trimmed)) {
      findings.push(sanitize(trimmed, 200));
    }
    // Also count inline **Critical** markers that appear in the review report
    // format described in SKILL.md (e.g., "### Critical" section headings).
    else if (/^###\s*critical/i.test(trimmed)) {
      // Count bullet points under the Critical section that follow.
      // This is handled by counting "Critical:" prefixed lines above; but
      // the ### heading itself is not a finding.
    }
  }

  // ── Table-format Critical detection (Critic Schema: | N | Critical | ... |) ─
  // Matches rows like: | 1 | Critical | description |
  const tableMatches = text.match(/\|\s*\d+\s*\|\s*Critical\s*\|/gi) || [];
  const tableCriticals = tableMatches.length;
  if (tableCriticals > 0) {
    // Extract the finding descriptions from table rows for traceability.
    const tableRowRe = /\|\s*\d+\s*\|\s*Critical\s*\|([^|]+)\|/gi;
    let tableRow;
    while ((tableRow = tableRowRe.exec(text)) !== null) {
      findings.push(sanitize(`Critical (table): ${tableRow[1].trim()}`, 200));
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
        findings.push(sanitize(b.replace(/^[\s]*-\s+/, ""), 200));
      }
    }
  }

  // Merge critical counts: take the maximum to avoid under-counting when both
  // formats appear, but avoid double-counting the same findings.
  critical_count = Math.max(headingCriticals, tableCriticals);

  // ── Score/verdict consistency check ───────────────────────────────────────
  // If score < 0.7 but verdict is a pass verdict, downgrade to NEEDS IMPROVEMENT
  // so that schema-compliant reviewers with low scores don't sneak through.
  let resolvedRawVerdict = rawVerdict;
  if (score !== null && score < 0.7 && rawVerdict !== null && PASS_VERDICTS.has(rawVerdict)) {
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
function computeConsensus(reviewers, expected, threshold = 0.67) {
  if (reviewers.length < expected) return null;

  const total = reviewers.length;
  // Clamp threshold to a safe range to prevent trivially easy or impossible gates.
  const clampedThreshold = Math.max(0.5, Math.min(1.0, threshold));
  const required = Math.ceil(clampedThreshold * total);
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
    if (average_score >= 0.7) {
      const has_major_findings = reviewers.some(
        (r) => r.warning_count > 0 || r.verdict === "MINOR FIXES"
      );
      verdict = has_major_findings ? "MINOR FIXES" : "APPROVED";
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
  // ── Load current aggregation state ────────────────────────────────────────
  const state = readJsonSafe(AGGREGATION_FILE);
  if (!state) {
    // File vanished between the guard check and now — nothing to do.
    process.exit(0);
  }

  if (!Array.isArray(state.reviewers)) {
    state.reviewers = [];
  }

  const rawExpected =
    typeof state.expected_reviewers === "number" ? state.expected_reviewers : 3;
  // Clamp to [2, 10] to prevent trivially-small or unreachably-large reviewer pools.
  const expected = Math.max(2, Math.min(10, rawExpected));

  const rawThreshold =
    typeof state.threshold === "number" ? state.threshold : 0.67;
  // Threshold is also clamped inside computeConsensus; clamp here as well so
  // the stored value in the aggregation file reflects the effective threshold.
  const threshold = Math.max(0.5, Math.min(1.0, rawThreshold));

  // ── Parse the subagent's output ────────────────────────────────────────────
  const text = readSubagentOutput();
  if (!text.trim()) {
    // Empty output — subagent produced nothing useful; skip aggregation update.
    process.exit(0);
  }

  const record = parseReviewerOutput(text);

  // Avoid duplicate entries for the same named reviewer (last-write wins so
  // a retried subagent does not inflate the tally).
  const existingIndex = state.reviewers.findIndex((r) => r.name === record.name);
  if (existingIndex !== -1) {
    state.reviewers[existingIndex] = record;
  } else {
    state.reviewers.push(record);
  }

  // ── Compute consensus when all reviewers have reported ────────────────────
  const consensusResult = computeConsensus(state.reviewers, expected, threshold);
  state.consensus = consensusResult
    ? {
        verdict: consensusResult.verdict,
        pass_count: consensusResult.pass_count,
        total: consensusResult.total,
        required: consensusResult.required,
        average_score: consensusResult.average_score,
        computed_at: new Date().toISOString(),
      }
    : null;

  // ── Persist updated state ──────────────────────────────────────────────────
  ensureDir(STATE_DIR);
  writeJsonAtomic(AGGREGATION_FILE, state);

  // ── Emit additionalContext for the main agent ──────────────────────────────
  const reported = state.reviewers.length;
  const lines = [];

  lines.push(`[REVIEW AGGREGATION] ${reported}/${expected} reviewers reported.`);

  lines.push(
    `Latest: ${record.name} → ${record.verdict}` +
      (record.score !== null && record.score !== undefined ? ` score=${record.score.toFixed(2)}` : "") +
      (record.critical_count > 0 ? ` (${record.critical_count} Critical)` : "") +
      (record.warning_count > 0 ? ` (${record.warning_count} Warning)` : "")
  );

  if (state.consensus) {
    const c = state.consensus;
    const scoreLabel =
      c.average_score !== null && c.average_score !== undefined
        ? ` avg_score=${c.average_score.toFixed(2)} [score-gate]`
        : " [vote-gate]";
    lines.push(
      `CONSENSUS: ${c.verdict} (${c.pass_count}/${c.total} pass, required ${c.required}${scoreLabel})`
    );
    lines.push(
      `Review complete. Proceed with the consensus verdict: ${c.verdict}.`
    );
  } else {
    lines.push(
      `Waiting for ${expected - reported} more reviewer(s) before consensus can be computed.`
    );
  }

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SubagentStop",
        additionalContext: lines.join("\n"),
      },
    })
  );
}


try {
  main();
} catch (err) {
  console.error("[subagent-stop] Unexpected error:", err.message);
  process.exit(1);
}
