#!/usr/bin/env node

// evolve-scorer.mjs — data-driven structural-conformance scorer for evolve-generated loop suites.
//
// Mirrors loop-runner.mjs `scoreChecks` (read the static asset file, test regexes against it)
// but takes the maintainer-authored assertions INLINE as base64 JSON. The loop builds candidate
// worktrees from HEAD, and `.data` is gitignored, so a generated suite cannot reference a check
// file inside the worktree — passing assertions inline removes that lookup entirely.
//
// Pure: reads ONLY the one target asset file. No clock, network, randomness, or env input — this
// is what backs the loop engine's "deterministic numeric scoring" hard gate for evolve suites.
//
// Usage:
//   node scripts/evolve-scorer.mjs <candidate_dir> <asset_path> <assertions_b64>
//     assertions_b64 = base64( JSON.stringify([ "<regex source>" | { "source": "...", "flags": "i" } ]) )
// Prints:
//   {"average_score": N}   where N = (assertions matched / total assertions), 4 decimals.

import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

function fail(message) {
  console.error(`evolve-scorer: ${message}`);
  process.exit(1);
}

const [candidateDir, assetPath, assertionsB64] = process.argv.slice(2);
if (!candidateDir || !assetPath || !assertionsB64) {
  fail("usage: evolve-scorer.mjs <candidate_dir> <asset_path> <assertions_b64>");
}

let assertions;
try {
  assertions = JSON.parse(Buffer.from(assertionsB64, "base64").toString("utf8"));
} catch (error) {
  fail(`could not decode assertions: ${error.message}`);
}
if (!Array.isArray(assertions) || assertions.length === 0) {
  fail("assertions must be a non-empty JSON array of regex sources");
}

let patterns;
try {
  patterns = assertions.map((entry) => {
    const source = typeof entry === "string" ? entry : entry && entry.source;
    if (typeof source !== "string" || source.length === 0) {
      // An empty source compiles to /(?:)/ which matches every file and would
      // silently inflate the score — refuse it so the scorer stays honest.
      throw new Error("assertion has an empty or missing regex source");
    }
    return typeof entry === "string" ? new RegExp(entry) : new RegExp(source, entry.flags || "");
  });
} catch (error) {
  fail(`invalid regex in assertions: ${error.message}`);
}

const targetFile = isAbsolute(assetPath) ? assetPath : join(candidateDir, assetPath);
let text;
try {
  text = readFileSync(targetFile, "utf8");
} catch (error) {
  fail(`cannot read target asset ${targetFile}: ${error.message}`);
}

const passed = patterns.filter((pattern) => pattern.test(text)).length;
const averageScore = Number((passed / patterns.length).toFixed(4));
console.log(JSON.stringify({ average_score: averageScore }));
