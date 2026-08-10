// The trace an adversarial check needs before it counts as answered.
//
// An adversarial check asks something no regex can settle -- whether two posts
// read as one voice, whether a claim is overstated. The runner cannot judge it
// and cannot verify that whoever answered was independent. What it can do is
// refuse to accept an answer that leaves no trace, and refuse to carry an
// answer forward onto a draft it was never given: a verdict is bound to the
// exact bytes it was passed, so editing the artifact invalidates it.

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SHA256 = /^[0-9a-f]{64}$/;

export function checksDir(root) {
  return join(root, ".scc", "checks");
}

export function adversarialLogPath(root) {
  return join(checksDir(root), "adversarial.jsonl");
}

export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function validateVerdict(verdict) {
  if (!verdict || typeof verdict !== "object" || Array.isArray(verdict)) {
    throw new Error("a verdict must be a JSON object");
  }
  for (const field of ["standard", "ask", "reviewer"]) {
    if (typeof verdict[field] !== "string" || !verdict[field].trim()) {
      throw new Error(`a verdict needs a non-empty "${field}"`);
    }
  }
  if (verdict.verdict !== "pass" && verdict.verdict !== "fail") {
    throw new Error(`a verdict must be "pass" or "fail", got ${JSON.stringify(verdict.verdict)}`);
  }
  if (typeof verdict.target_sha256 !== "string" || !SHA256.test(verdict.target_sha256)) {
    throw new Error(
      'a verdict needs "target_sha256", the sha256 of the artifact the reviewer actually read. ' +
        "Without it the verdict would follow the standard onto drafts nobody reviewed."
    );
  }
  return verdict;
}

export function appendVerdict(root, verdict, { now = new Date() } = {}) {
  validateVerdict(verdict);
  const record = {
    standard: verdict.standard,
    ask: verdict.ask,
    target_sha256: verdict.target_sha256,
    verdict: verdict.verdict,
    reviewer: verdict.reviewer,
    note: typeof verdict.note === "string" ? verdict.note : "",
    at: now.toISOString(),
  };
  mkdirSync(checksDir(root), { recursive: true });
  // Append rather than rewrite: five sessions share this project, and a
  // read-modify-write would drop whichever verdict lost the race.
  appendFileSync(adversarialLogPath(root), `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export function readVerdicts(root) {
  const path = adversarialLogPath(root);
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) out.push(parsed);
    } catch {
      // One torn line must not blind the runner to every verdict after it.
    }
  }
  return out;
}

export function findVerdict(verdicts, { standard, ask, targetSha }) {
  let found = null;
  for (const verdict of verdicts) {
    if (verdict.standard !== standard) continue;
    if (verdict.ask !== ask) continue;
    if (verdict.target_sha256 !== targetSha) continue;
    found = verdict;
  }
  return found;
}
