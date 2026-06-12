#!/usr/bin/env node

// evolve-runner.mjs — the ouroboros maintainer loop CLI.
//
// Harvests real PDCA gate failures to surface which prompt asset is structurally weak
// (provenance), lets the maintainer attach a hand-authored structural check, generates a
// loop suite for it, and shells out to the UNMODIFIED loop engine to evolve the asset on an
// isolated branch. evolve never runs its own optimizer and never relaxes a loop gate.
//
// Subcommands: list-failures | show-failure <id> | harvest <id> --assertion <a> [--target p] | run <name> | resume <id>
//
// Safety invariants (see docs/proposals/evolve-ouroboros-spec.md):
//   - The success criterion is ALWAYS maintainer-authored (--assertion), never model-derived.
//   - Generated suites pin scoring.min_delta to the bundled 0.02 floor; runs refuse min_delta < 0.02.
//   - Winners land only on the loop's isolated branch; merging to main stays a manual maintainer step.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { listRunIds, readEvents } from "../hooks/lib/event-log.mjs";
import { readRecords, setMaintainerCheck, upsertByDedup } from "../mcp/lib/evolve-ledger.mjs";

const __filename = fileURLToPath(import.meta.url);

const DEFAULT_RECURRENCE = 3;
const MIN_DELTA_FLOOR = 0.02;
// Each path segment is restricted to a safe charset. The generated suite case command is
// run through a login shell by the loop engine, so a target must never carry shell
// metacharacters (`;`, space, `$()`, backtick, quotes) — those are rejected here.
const TARGET_PATTERNS = [
  /^skills\/[A-Za-z0-9._-]+\/SKILL\.md$/,
  /^agents\/[A-Za-z0-9._-]+\.md$/,
  /^commands\/[A-Za-z0-9._-]+\.md$/,
  /^templates\/[A-Za-z0-9._-]+\.md$/,
];

function repoRoot() {
  return resolve(process.cwd());
}

function dataDirFromEnv(root) {
  return resolve(process.env.CLAUDE_PLUGIN_DATA || join(root, ".data"));
}

function suiteDir(root) {
  return join(root, "benchmarks", "loop");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function parseArgs(argv) {
  const args = [...argv];
  const positional = [];
  const flags = {};
  while (args.length > 0) {
    const token = args.shift();
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = args[0];
      if (!next || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = args.shift();
      }
      continue;
    }
    positional.push(token);
  }
  return { positional, flags };
}

function validateTarget(target) {
  if (!TARGET_PATTERNS.some((pattern) => pattern.test(target))) {
    throw new Error(`Target "${target}" is outside the v1 loop mutation scope`);
  }
}

function loadAssetMap(root) {
  const path = join(root, "config", "evolve-asset-map.json");
  if (!existsSync(path)) {
    throw new Error("Missing config/evolve-asset-map.json");
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function resolveAsset(assetMap, rule, phase) {
  const candidate =
    (assetMap.gate_rule && assetMap.gate_rule[rule]) ||
    (phase && assetMap.phase && assetMap.phase[phase]) ||
    assetMap.fallback;
  if (!candidate) return null;
  try {
    validateTarget(candidate);
  } catch {
    return null; // a misconfigured map entry should skip, not crash the scan
  }
  return candidate;
}

// --- Harvest: turn real gate_fail events into provenance records -------------------------

function scanFailures(root, dataDir) {
  const assetMap = loadAssetMap(root);
  const buckets = new Map(); // dedup_key -> { asset_path, gate_rule, runs:Set, phase }

  for (const runId of listRunIds(dataDir)) {
    for (const event of readEvents(dataDir, runId, { type: "gate_fail" })) {
      const phase = event.phase || (event.data && event.data.phase) || null;
      const missing = (event.data && Array.isArray(event.data.missing) && event.data.missing) || [];
      for (const rule of missing) {
        const asset = resolveAsset(assetMap, rule, phase);
        if (!asset) continue;
        const dedupKey = `${asset}::${rule}`;
        if (!buckets.has(dedupKey)) {
          buckets.set(dedupKey, { asset_path: asset, gate_rule: rule, runs: new Set(), phase });
        }
        buckets.get(dedupKey).runs.add(runId);
      }
    }
  }

  const stored = [];
  for (const [dedupKey, info] of buckets) {
    const record = {
      id: slugify(dedupKey),
      ts: new Date().toISOString(),
      source_kind: "gate_fail",
      asset_path: info.asset_path,
      gate_rule: info.gate_rule,
      finding_excerpt: `gate_fail: ${info.gate_rule} (phase ${info.phase || "?"})`,
      dedup_key: dedupKey,
      source_runs: [...info.runs].sort(),
      recurrence: info.runs.size,
      checkable: true,
      check_assertion: null,
      check_author: null,
      status: "open",
    };
    stored.push(upsertByDedup(dataDir, record));
  }
  return stored;
}

function listFailures(root, flags) {
  const dataDir = dataDirFromEnv(root);
  scanFailures(root, dataDir);
  const minRecurrence = flags["min-recurrence"] !== undefined
    ? Number(flags["min-recurrence"])
    : DEFAULT_RECURRENCE;
  const failures = readRecords(dataDir, {
    min_recurrence: minRecurrence,
    ...(flags.asset ? { asset_path: String(flags.asset) } : {}),
  }).sort((left, right) => (right.recurrence ?? 0) - (left.recurrence ?? 0));

  return {
    min_recurrence: minRecurrence,
    eligible: failures.length,
    failures: failures.map((record) => ({
      id: record.id,
      asset_path: record.asset_path,
      gate_rule: record.gate_rule,
      recurrence: record.recurrence,
      status: record.status,
      check_author: record.check_author,
    })),
    note: failures.length
      ? "Pick an id, hand-author a structural check, then: harvest <id> --assertion '<regex,regex>'"
      : "No assets have reached the recurrence threshold yet. Lower it with --min-recurrence or keep running PDCA.",
  };
}

function showFailure(root, id) {
  const dataDir = dataDirFromEnv(root);
  scanFailures(root, dataDir);
  const [record] = readRecords(dataDir, { id });
  if (!record) {
    throw new Error(`No failure record with id "${id}". Run list-failures to see eligible ids.`);
  }
  const holdouts = readRecords(dataDir, { asset_path: record.asset_path })
    .filter((other) => other.id !== record.id && other.check_author === "maintainer")
    .map((other) => other.id);

  return {
    record,
    prior_ratified_checks_for_asset: holdouts,
    next_step: record.check_author
      ? `run evolve-${record.id}`
      : `Hand-author a structural check, then: harvest ${record.id} --assertion '<regex>[,<regex>]'`,
  };
}

// --- Harvest authoring: maintainer attaches a check and we generate the suite ------------

function parseAssertions(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("--assertion is required and must be maintainer-authored (a model must not invent it)");
  }
  const usableSource = (entry) =>
    typeof entry === "string" ? entry.trim() : entry && entry.source && String(entry.source).trim();

  const text = raw.trim();
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const cleaned = parsed.filter(usableSource);
      if (cleaned.length > 0) return cleaned;
      throw new Error("--assertion produced no usable regex sources");
    }
  } catch (error) {
    if (/no usable regex sources/.test(error.message)) throw error;
    // otherwise not JSON — fall through to the comma-separated form
  }
  const list = text.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (list.length === 0) {
    throw new Error("--assertion produced no usable regex sources");
  }
  return list;
}

function caseForAssertions(asset, id, assertions, weight) {
  const b64 = Buffer.from(JSON.stringify(assertions)).toString("base64");
  // asset is constrained by validateTarget (no shell metacharacters or quotes); it is also
  // single-quoted here as defense in depth. b64 is in the [A-Za-z0-9+/=] alphabet — shell-safe.
  return {
    id,
    prompt: `Maintainer-authored structural-conformance check for ${asset}.`,
    command: `node scripts/evolve-scorer.mjs "{{candidate_dir}}" '${asset}' ${b64}`,
    review_preset: "structural",
    weight,
    timeout_sec: 60,
  };
}

function holdoutCases(dataDir, asset, excludeId) {
  return readRecords(dataDir, { asset_path: asset })
    .filter(
      (record) =>
        record.id !== excludeId &&
        record.check_author === "maintainer" &&
        Array.isArray(record.check_assertion) &&
        record.check_assertion.length > 0
    )
    .map((record) => caseForAssertions(asset, `holdout-${record.id}`, record.check_assertion, 0));
}

function buildSuite(dataDir, record) {
  const asset = record.asset_path;
  const primary = caseForAssertions(asset, `${record.id}-structure`, record.check_assertion, 1);
  const holdouts = holdoutCases(dataDir, asset, record.id);
  return {
    name: `evolve-${record.id}`,
    description: `evolve: maintainer-authored structural-conformance check for ${asset} (provenance ${record.dedup_key}, recurrence ${record.recurrence}).`,
    allowed_targets: [asset],
    cases: [primary, ...holdouts],
    budget: { max_candidates: 5, max_generations: 2, parallel: 1 },
    scoring: {
      hard_gates: ["syntax", "manifest", "contract-smoke", "allowed-targets", "critic-output"],
      weights: { average_score: 1 },
      min_delta: MIN_DELTA_FLOOR,
    },
  };
}

function validateGeneratedSuite(suite) {
  for (const key of ["name", "description", "allowed_targets", "cases", "budget", "scoring"]) {
    if (!(key in suite)) throw new Error(`Generated suite missing field "${key}"`);
  }
  if (!Array.isArray(suite.allowed_targets) || suite.allowed_targets.length === 0) {
    throw new Error("Generated suite has no allowed_targets");
  }
  suite.allowed_targets.forEach(validateTarget);
  if (!Array.isArray(suite.cases) || suite.cases.length === 0) {
    throw new Error("Generated suite has no cases");
  }
  for (const caseDef of suite.cases) {
    for (const field of ["id", "prompt", "command", "review_preset", "weight", "timeout_sec"]) {
      if (!(field in caseDef)) throw new Error(`Generated case missing field "${field}"`);
    }
  }
  if (!Array.isArray(suite.scoring.hard_gates)) {
    throw new Error("scoring.hard_gates must be an array");
  }
  if (typeof suite.scoring.min_delta !== "number") {
    throw new Error("scoring.min_delta must be numeric");
  }
  if (suite.scoring.min_delta < MIN_DELTA_FLOOR) {
    throw new Error(`Refusing min_delta ${suite.scoring.min_delta} below the ${MIN_DELTA_FLOOR} floor`);
  }
  return suite;
}

function harvest(root, id, flags) {
  const dataDir = dataDirFromEnv(root);
  scanFailures(root, dataDir);

  const [existing] = readRecords(dataDir, { id });
  if (!existing) {
    throw new Error(`No failure record with id "${id}". Run list-failures first — evolve only targets real logged failures.`);
  }

  const assetOverride = flags.target ? String(flags.target) : null;
  if (assetOverride) validateTarget(assetOverride);

  const assertions = parseAssertions(typeof flags.assertion === "string" ? flags.assertion : "");
  // The --target override is persisted to the ledger so holdout lookups and show-failure
  // report the asset the run actually evolves (not the original map-resolved one).
  const record = setMaintainerCheck(dataDir, id, assertions, "maintainer", assetOverride);

  if (!existsSync(join(root, record.asset_path))) {
    throw new Error(`Asset ${record.asset_path} does not exist in the repository`);
  }

  const suite = validateGeneratedSuite(buildSuite(dataDir, record));
  const suitePath = join(suiteDir(root), `${suite.name}.json`);
  writeFileSync(suitePath, `${JSON.stringify(suite, null, 2)}\n`, "utf8");

  return {
    suite: suite.name,
    suite_path: suitePath,
    asset: record.asset_path,
    assertions,
    holdout_cases: suite.cases.length - 1,
    next_step: `run ${suite.name}`,
    reminder: "Commit scripts/evolve-scorer.mjs before the first run — loop worktrees are built from HEAD.",
  };
}

// --- Run: shell out to the unmodified loop engine, then advise on holdout regressions ----

function assertCommittedToHead(root, relPath) {
  try {
    execFileSync("git", ["cat-file", "-e", `HEAD:${relPath}`], { cwd: root, stdio: "ignore" });
  } catch {
    throw new Error(
      `"${relPath}" is not committed to HEAD. Loop candidate worktrees are built from HEAD, so an uncommitted file is invisible and every candidate would score 0. Commit it, then re-run.`
    );
  }
}

function resolveSuiteName(root, arg) {
  const candidates = arg.startsWith("evolve-") ? [arg] : [`evolve-${slugify(arg)}`, arg];
  for (const name of candidates) {
    if (existsSync(join(suiteDir(root), `${name}.json`))) return name;
  }
  throw new Error(`No generated suite for "${arg}". Run harvest first.`);
}

function evaluateHoldout(summary) {
  if (!summary.winner) return { status: "no_winner" };
  const leaderboardPath = join(summary.artifact_dir, "leaderboard.json");
  if (!existsSync(leaderboardPath)) return { status: "unavailable" };

  const leaderboard = JSON.parse(readFileSync(leaderboardPath, "utf8"));
  const baseline = leaderboard.find((entry) => entry.candidate_id === "baseline");
  const winner = leaderboard.find((entry) => entry.candidate_id === summary.winner.candidate_id);
  if (!baseline || !winner) return { status: "unavailable" };

  const winnerScores = winner.case_scores || {};
  const baselineScores = baseline.case_scores || {};
  const regressions = [];
  for (const caseId of Object.keys(winnerScores)) {
    if (!caseId.startsWith("holdout-")) continue;
    const winnerScore = Number(winnerScores[caseId] ?? 0);
    const baselineScore = Number(baselineScores[caseId] ?? 0);
    if (winnerScore < baselineScore) {
      regressions.push({ case: caseId, baseline: baselineScore, winner: winnerScore });
    }
  }

  return regressions.length > 0
    ? {
        status: "holdout_regression",
        regressions,
        note: "Winner regresses a prior maintainer-ratified check. Advisory only — review winner.diff before merging.",
      }
    : { status: "clean" };
}

function runEvolve(root, arg, flags) {
  const suiteName = resolveSuiteName(root, arg);
  const suite = validateGeneratedSuite(JSON.parse(readFileSync(join(suiteDir(root), `${suiteName}.json`), "utf8")));
  const asset = suite.allowed_targets[0];

  // Fail fast if the scorer or the target asset is not in HEAD — the loop builds candidate
  // worktrees from HEAD, so otherwise every candidate scores 0 with no clear error.
  assertCommittedToHead(root, "scripts/evolve-scorer.mjs");
  assertCommittedToHead(root, asset);

  const passthrough = [];
  for (const key of ["budget", "max-generations", "parallel", "cost-limit", "time-limit"]) {
    if (flags[key] !== undefined && flags[key] !== true) {
      passthrough.push(`--${key}`, String(flags[key]));
    }
  }

  const output = execFileSync(
    "node",
    [join("scripts", "loop-runner.mjs"), "run", suiteName, "--targets", asset, ...passthrough],
    { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
  const summary = JSON.parse(output);

  return {
    ...summary,
    evolve_holdout: evaluateHoldout(summary),
    next_step:
      summary.status === "winner_promoted"
        ? `Review ${join(summary.artifact_dir, "winner.diff")} on branch ${summary.branch}, then merge manually if good.`
        : "No winner promoted — nothing to merge.",
  };
}

function resumeEvolve(root, runId) {
  const output = execFileSync(
    "node",
    [join("scripts", "loop-runner.mjs"), "resume", runId],
    { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
  return JSON.parse(output);
}

function main() {
  const root = repoRoot();
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [subcommand, arg1] = positional;

  if (!subcommand || subcommand === "list-failures") {
    console.log(JSON.stringify(listFailures(root, flags), null, 2));
    return;
  }
  if (subcommand === "show-failure") {
    if (!arg1) throw new Error("show-failure requires a failure id");
    console.log(JSON.stringify(showFailure(root, arg1), null, 2));
    return;
  }
  if (subcommand === "harvest") {
    if (!arg1) throw new Error("harvest requires a failure id");
    console.log(JSON.stringify(harvest(root, arg1, flags), null, 2));
    return;
  }
  if (subcommand === "run") {
    if (!arg1) throw new Error("run requires a suite name or asset");
    console.log(JSON.stringify(runEvolve(root, arg1, flags), null, 2));
    return;
  }
  if (subcommand === "resume") {
    if (!arg1) throw new Error("resume requires a run_id");
    console.log(JSON.stringify(resumeEvolve(root, arg1), null, 2));
    return;
  }
  throw new Error(`Unknown subcommand "${subcommand}"`);
}

const isMainModule = resolve(process.argv[1] || "") === __filename;
if (isMainModule) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

export { evaluateHoldout, scanFailures, buildSuite, validateGeneratedSuite, parseAssertions };
