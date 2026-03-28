import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  aggregateCaseScores,
  calculateConfidence,
  parseEvaluatorOutput,
  selectEliteCandidates,
} from "../../scripts/loop-runner.mjs";

const root = process.cwd();
const runnerPath = path.join(root, "scripts", "loop-runner.mjs");

function runLoop(cwd, dataDir, ...args) {
  return execFileSync(process.execPath, [runnerPath, ...args], {
    cwd,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: dataDir,
    },
    encoding: "utf8",
  });
}

function initFixtureRepo(prefix) {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), prefix));
  mkdirSync(path.join(repoDir, "skills", "demo"), { recursive: true });
  mkdirSync(path.join(repoDir, "benchmarks", "loop"), { recursive: true });
  writeFileSync(
    path.join(repoDir, "skills", "demo", "SKILL.md"),
    [
      "---",
      'name: demo',
      'description: "Use when demo scoring should improve."',
      "---",
      "",
      "This skill should become stricter over time.",
      "",
    ].join("\n")
  );

  execFileSync("git", ["init", "-b", "main"], { cwd: repoDir, encoding: "utf8" });
  execFileSync("git", ["config", "user.email", "loop@test.local"], {
    cwd: repoDir,
    encoding: "utf8",
  });
  execFileSync("git", ["config", "user.name", "Loop Test"], {
    cwd: repoDir,
    encoding: "utf8",
  });
  execFileSync("git", ["add", "."], { cwd: repoDir, encoding: "utf8" });
  execFileSync("git", ["commit", "-m", "init"], { cwd: repoDir, encoding: "utf8" });

  return repoDir;
}

function writeSuite(repoDir, name, command) {
  const suite = {
    name,
    description: `${name} suite`,
    allowed_targets: ["skills/demo/SKILL.md"],
    cases: [
      {
        id: `${name}-case`,
        prompt: "Score the demo skill prompt",
        command,
        review_preset: "content",
        weight: 1,
        timeout_sec: 5,
      },
    ],
    budget: {
      max_candidates: 3,
      max_generations: 2,
      parallel: 1,
    },
    scoring: {
      hard_gates: ["allowed-targets", "critic-output"],
      weights: { average_score: 1 },
      min_delta: 0.05,
    },
  };

  writeFileSync(
    path.join(repoDir, "benchmarks", "loop", `${name}.json`),
    `${JSON.stringify(suite, null, 2)}\n`
  );
}

test("list-suites returns the bundled loop suites", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-loop-"));
  const output = runLoop(root, tempDir, "list-suites");
  const parsed = JSON.parse(output);

  assert.equal(Array.isArray(parsed.suites), true);
  assert.match(parsed.suites.join("\n"), /write-core/);
  assert.match(parsed.suites.join("\n"), /review-core/);
});

test("aggregateCaseScores and elite selection stay deterministic", () => {
  const aggregate = aggregateCaseScores(
    [
      { id: "a", weight: 3 },
      { id: "b", weight: 1 },
    ],
    new Map([
      ["a", 0.8],
      ["b", 0.2],
    ])
  );

  assert.equal(aggregate, 0.65);

  const elites = selectEliteCandidates([
    { candidate_id: "baseline", average_score: 0.6, hard_gate_failed: false },
    { candidate_id: "candidate-1", average_score: 0.9, hard_gate_failed: false },
    { candidate_id: "candidate-2", average_score: 0.7, hard_gate_failed: true },
    { candidate_id: "candidate-3", average_score: 0.8, hard_gate_failed: false },
  ]);

  assert.deepEqual(
    elites.map((entry) => entry.candidate_id),
    ["candidate-1", "candidate-3"]
  );
});

test("parseEvaluatorOutput extracts scores from JSON and critic markdown", () => {
  assert.equal(parseEvaluatorOutput('{"average_score":0.82}'), 0.82);
  assert.equal(
    parseEvaluatorOutput("| Reviewer | Score | Verdict |\n| **Average** | **0.74** | — |"),
    0.74
  );
});

test("calculateConfidence uses MAD and classifies the result", () => {
  assert.deepEqual(
    calculateConfidence([0.5, 0.7, 0.6]),
    { value: 2, level: "strong" }
  );
  assert.deepEqual(
    calculateConfidence([0.5, 0.3, 0.4, 0.5, 0.6]),
    { value: 1, level: "marginal" }
  );
  assert.deepEqual(
    calculateConfidence([0.5, 0.2, 0.3, 0.4, 0.55]),
    { value: 0.5, level: "noise" }
  );
  assert.equal(calculateConfidence([0.5, 0.6]), null);
});

test("run rejects explicit targets outside the suite allowlist", () => {
  const repoDir = initFixtureRepo("second-claude-loop-disallowed-");
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-loop-data-"));
  writeSuite(
    repoDir,
    "disallowed-targets",
    `${process.execPath} -e "console.log(JSON.stringify({average_score:0.5}))"`
  );

  assert.throws(
    () => runLoop(repoDir, dataDir, "run", "disallowed-targets", "--targets", "README.md"),
    /outside the suite allowlist|outside the v1 loop mutation scope/i
  );
});

test("run creates a winner branch and artifacts when a mutation improves score", () => {
  const repoDir = initFixtureRepo("second-claude-loop-winner-");
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-loop-data-"));
  writeSuite(
    repoDir,
    "winner-suite",
    `${process.execPath} -e "const fs=require('fs');const text=fs.readFileSync(process.argv[1],'utf8');const score=text.includes('must')?0.9:0.6;console.log(JSON.stringify({average_score:score}))" "{{candidate_dir}}/skills/demo/SKILL.md"`
  );

  const output = runLoop(repoDir, dataDir, "run", "winner-suite", "--max-generations", "1");
  const parsed = JSON.parse(output);

  assert.equal(parsed.status, "winner_promoted");
  assert.match(parsed.branch, /^codex\/loop-winner-suite-/);
  assert.equal(parsed.generation, 1);
  assert.equal(parsed.winner.changed_files.includes("skills/demo/SKILL.md"), true);
  assert.equal(parsed.winner.delta > 0, true);
  assert.equal(existsSync(parsed.artifact_dir), true);
  assert.equal(existsSync(path.join(dataDir, "state", "loop-active.json")), true);

  const branches = execFileSync("git", ["branch", "--format=%(refname:short)"], {
    cwd: repoDir,
    encoding: "utf8",
  });
  assert.match(branches, new RegExp(parsed.branch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(branches, /g1-c1|g1-c2|g1-c3/);
});

test("run reports MAD-based confidence after at least three benchmark scores", () => {
  const repoDir = initFixtureRepo("second-claude-loop-confidence-");
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-loop-data-"));
  writeSuite(
    repoDir,
    "confidence-suite",
    `${process.execPath} -e "const fs=require('fs');const state=process.env.CLAUDE_PLUGIN_DATA+'/score-counter.json';let index=0;try{index=JSON.parse(fs.readFileSync(state,'utf8')).index}catch{}const scores=[0.5,0.7,0.6,0.55];const score=scores[index] ?? scores[scores.length-1];fs.writeFileSync(state,JSON.stringify({index:index+1}));console.log(JSON.stringify({average_score:score}))"`
  );

  const output = runLoop(repoDir, dataDir, "run", "confidence-suite", "--max-generations", "1");
  const parsed = JSON.parse(output);

  assert.deepEqual(parsed.confidence, { value: 4, level: "strong" });

  const statePath = path.join(dataDir, "state", "loop-active.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  assert.deepEqual(state.confidence, { value: 4, level: "strong" });
});

test("run plateaus when scores stay flat and resume returns saved state", () => {
  const repoDir = initFixtureRepo("second-claude-loop-plateau-");
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-loop-data-"));
  writeSuite(
    repoDir,
    "plateau-suite",
    `${process.execPath} -e "console.log(JSON.stringify({average_score:0.5}))"`
  );

  const output = runLoop(repoDir, dataDir, "run", "plateau-suite", "--max-generations", "3");
  const parsed = JSON.parse(output);

  assert.equal(parsed.status, "plateau");
  assert.equal(parsed.winner, null);

  const statePath = path.join(dataDir, "state", "loop-active.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const resumed = JSON.parse(runLoop(repoDir, dataDir, "resume", state.run_id));

  assert.equal(resumed.run_id, state.run_id);
  assert.equal(resumed.status, "plateau");
});

test("run reports min_delta_not_met when budget ends without enough improvement", () => {
  const repoDir = initFixtureRepo("second-claude-loop-min-delta-");
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-loop-data-"));
  writeSuite(
    repoDir,
    "min-delta-suite",
    `${process.execPath} -e "const fs=require('fs');const text=fs.readFileSync(process.argv[1],'utf8');const score=text.includes('must')?0.61:0.6;console.log(JSON.stringify({average_score:score}))" "{{candidate_dir}}/skills/demo/SKILL.md"`
  );

  const output = runLoop(repoDir, dataDir, "run", "min-delta-suite", "--max-generations", "1");
  const parsed = JSON.parse(output);

  assert.equal(parsed.status, "min_delta_not_met");
  assert.equal(parsed.generation, 1);
  assert.equal(parsed.winner, null);
});

test("run stops when the estimated token cost exceeds --cost-limit", () => {
  const repoDir = initFixtureRepo("second-claude-loop-cost-limit-");
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-loop-data-"));
  writeSuite(
    repoDir,
    "cost-limit-suite",
    `${process.execPath} -e "console.log(JSON.stringify({average_score:0.5}))"`
  );

  const output = runLoop(repoDir, dataDir, "run", "cost-limit-suite", "--cost-limit", "0");
  const parsed = JSON.parse(output);

  assert.equal(parsed.status, "cost_limit_exceeded");
  assert.equal(parsed.generation, 0);
  assert.equal(parsed.winner, null);
  assert.equal(parsed.estimated_tokens > 0, true);

  const statePath = path.join(dataDir, "state", "loop-active.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  assert.equal(state.status, "cost_limit_exceeded");
  assert.equal(state.estimated_tokens > 0, true);
});

test("run stops when wall clock time exceeds --time-limit", () => {
  const repoDir = initFixtureRepo("second-claude-loop-time-limit-");
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-loop-data-"));
  writeSuite(
    repoDir,
    "time-limit-suite",
    `${process.execPath} -e "setTimeout(() => console.log(JSON.stringify({average_score:0.5})), 200)"`
  );

  const output = runLoop(repoDir, dataDir, "run", "time-limit-suite", "--time-limit", "0.05");
  const parsed = JSON.parse(output);

  assert.equal(parsed.status, "time_limit_exceeded");
  assert.equal(parsed.generation, 0);
  assert.equal(parsed.winner, null);
  assert.equal(parsed.elapsed_ms >= 50, true);

  const statePath = path.join(dataDir, "state", "loop-active.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  assert.equal(state.status, "time_limit_exceeded");
  assert.equal(state.elapsed_ms >= 50, true);
});

test("parallel evaluations honor the requested concurrency budget", () => {
  const repoDir = initFixtureRepo("second-claude-loop-parallel-");
  const sequentialDataDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-loop-data-"));
  const parallelDataDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-loop-data-"));
  writeSuite(
    repoDir,
    "parallel-suite",
    `${process.execPath} -e "setTimeout(() => console.log(JSON.stringify({average_score:0.5})), 800)"`
  );

  const sequentialStart = Date.now();
  runLoop(repoDir, sequentialDataDir, "run", "parallel-suite", "--parallel", "1", "--budget", "3", "--max-generations", "1");
  const sequentialElapsed = Date.now() - sequentialStart;

  const parallelStart = Date.now();
  runLoop(repoDir, parallelDataDir, "run", "parallel-suite", "--parallel", "3", "--budget", "3", "--max-generations", "1");
  const parallelElapsed = Date.now() - parallelStart;

  assert.equal(parallelElapsed < sequentialElapsed, true);
  assert.equal(parallelElapsed < sequentialElapsed * 0.8, true);
});
