#!/usr/bin/env node

import { execFile, execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_SHELL = process.env.SHELL || "/bin/zsh";
const execFileAsync = promisify(execFile);
const TARGET_PATTERNS = [
  /^skills\/[^/]+\/SKILL\.md$/,
  /^agents\/[^/]+\.md$/,
  /^commands\/[^/]+\.md$/,
  /^templates\/[^/]+\.md$/,
];
const MUTATION_STRATEGIES = [
  {
    id: "should-to-must",
    mutate(text) {
      return text.replace(/\bshould\b/g, "must");
    },
  },
  {
    id: "normalize-command-prefix",
    mutate(text) {
      return text.replace(/\/scc:/g, "/second-claude-code:");
    },
  },
  {
    id: "trim-trailing-whitespace",
    mutate(text) {
      return text.replace(/[ \t]+$/gm, "");
    },
  },
  {
    id: "collapse-blank-lines",
    mutate(text) {
      return text.replace(/\n{3,}/g, "\n\n");
    },
  },
  {
    id: "can-to-must",
    mutate(text) {
      return text.replace(/\bcan\b/g, "must");
    },
  },
];

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function writeJson(filePath, data) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function sanitizeRunId(runId) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(runId) || runId.includes("/") || runId.includes("..")) {
    throw new Error("run_id must use only letters, numbers, dot, underscore, or hyphen and must not contain path segments");
  }
  return runId;
}

function repoRootFromCwd(cwd = process.cwd()) {
  return resolve(cwd);
}

function dataDirFromEnv(root) {
  return resolve(process.env.CLAUDE_PLUGIN_DATA || join(root, ".data"));
}

function statePath(root) {
  return join(dataDirFromEnv(root), "state", "loop-active.json");
}

function suiteDir(root) {
  return join(root, "benchmarks", "loop");
}

function collectFiles(dirPath, suffix) {
  if (!existsSync(dirPath)) return [];
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(fullPath, suffix));
      continue;
    }
    if (!suffix || entry.name.endsWith(suffix)) {
      result.push(fullPath);
    }
  }
  return result.sort();
}

function git(cwd, args, options = {}) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function tryGit(cwd, args) {
  try {
    return git(cwd, args);
  } catch {
    return "";
  }
}

function shell(cwd, command, timeoutMs) {
  return execFileSync(DEFAULT_SHELL, ["-lc", command], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: timeoutMs,
  });
}

async function shellAsync(cwd, command, timeoutMs) {
  const { stdout } = await execFileAsync(DEFAULT_SHELL, ["-lc", command], {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
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

function validateLoopTarget(target) {
  if (!TARGET_PATTERNS.some((pattern) => pattern.test(target))) {
    throw new Error(`Target "${target}" is outside the v1 loop mutation scope`);
  }
}

function validateSuiteShape(rawSuite) {
  const requiredTopLevel = [
    "name",
    "description",
    "allowed_targets",
    "cases",
    "budget",
    "scoring",
  ];

  for (const key of requiredTopLevel) {
    if (!(key in rawSuite)) {
      throw new Error(`Suite is missing required field "${key}"`);
    }
  }

  if (!Array.isArray(rawSuite.allowed_targets) || rawSuite.allowed_targets.length === 0) {
    throw new Error("allowed_targets must contain at least one path");
  }
  if (!Array.isArray(rawSuite.cases) || rawSuite.cases.length === 0) {
    throw new Error("cases must contain at least one case");
  }

  for (const target of rawSuite.allowed_targets) {
    validateLoopTarget(target);
  }

  for (const caseDef of rawSuite.cases) {
    for (const field of ["id", "prompt", "command", "review_preset", "weight", "timeout_sec"]) {
      if (!(field in caseDef)) {
        throw new Error(`Case is missing required field "${field}"`);
      }
    }
  }

  if (!Array.isArray(rawSuite.scoring.hard_gates)) {
    throw new Error("scoring.hard_gates must be an array");
  }
  if (typeof rawSuite.scoring.min_delta !== "number") {
    throw new Error("scoring.min_delta must be numeric");
  }

  return rawSuite;
}

function loadSuite(root, suiteName) {
  const suitePath = join(suiteDir(root), `${suiteName}.json`);
  if (!existsSync(suitePath)) {
    throw new Error(`Unknown loop suite "${suiteName}"`);
  }

  return {
    path: suitePath,
    suite: validateSuiteShape(readJson(suitePath)),
  };
}

function listSuiteNames(root) {
  if (!existsSync(suiteDir(root))) return [];
  return collectFiles(suiteDir(root), ".json")
    .map((filePath) => relative(suiteDir(root), filePath).replace(/\.json$/, ""))
    .sort();
}

export function parseEvaluatorOutput(output) {
  const text = String(output || "").trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.average_score === "number") return parsed.average_score;
    if (typeof parsed.score === "number") return parsed.score;
  } catch {
    // Fall through to regex parsing.
  }

  const patterns = [
    /\|\s*\*\*Average\*\*\s*\|\s*\*\*([0-9.]+)\*\*/i,
    /average[_ ]score[^0-9]*([0-9.]+)/i,
    /"average_score"\s*:\s*([0-9.]+)/i,
    /"score"\s*:\s*([0-9.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

export function aggregateCaseScores(cases, scoreMap) {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const caseDef of cases) {
    const weight = Number(caseDef.weight) || 0;
    const score = Number(scoreMap.get(caseDef.id) || 0);
    weightedSum += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Number((weightedSum / totalWeight).toFixed(4));
}

export function selectEliteCandidates(candidates, maxCount = 2) {
  return [...candidates]
    .filter((candidate) => candidate.hard_gate_failed !== true)
    .sort((left, right) => {
      if (right.average_score !== left.average_score) {
        return right.average_score - left.average_score;
      }
      return left.candidate_id.localeCompare(right.candidate_id);
    })
    .slice(0, maxCount);
}

function ensureGitIdentity(cwd) {
  const email = tryGit(cwd, ["config", "--get", "user.email"]);
  const name = tryGit(cwd, ["config", "--get", "user.name"]);

  if (!name) {
    git(cwd, ["config", "user.name", "Second Claude Loop"]);
  }
  if (!email) {
    git(cwd, ["config", "user.email", "loop@second-claude.local"]);
  }
}

function safeStat(pathname) {
  try {
    return statSync(pathname);
  } catch {
    return null;
  }
}

function buildRunId(suiteName) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return sanitizeRunId(`${slugify(suiteName)}-${stamp}`);
}

function resolveSelectedTargets(suite, rawTargets) {
  const allowed = new Set(suite.allowed_targets);
  const targets = rawTargets
    ? rawTargets.split(",").map((entry) => entry.trim()).filter(Boolean)
    : [...allowed];

  for (const target of targets) {
    validateLoopTarget(target);
    if (!allowed.has(target)) {
      throw new Error(`Target "${target}" is outside the suite allowlist`);
    }
  }

  return targets;
}

function ensureFilesExist(root, targets) {
  for (const target of targets) {
    if (!existsSync(join(root, target))) {
      throw new Error(`Selected target "${target}" does not exist in the repository`);
    }
  }
}

function createWorktree(root, ref, branch, dirPath) {
  ensureDir(dirname(dirPath));
  git(root, ["worktree", "add", "-b", branch, dirPath, ref]);
  return dirPath;
}

function removeWorktree(root, dirPath) {
  if (!existsSync(dirPath)) return;
  try {
    git(root, ["worktree", "remove", "--force", dirPath], { stdio: ["ignore", "ignore", "ignore"] });
  } catch {
    rmSync(dirPath, { recursive: true, force: true });
  }
}

function deleteBranch(root, branch) {
  if (!branch) return;
  try {
    git(root, ["branch", "-D", branch], { stdio: ["ignore", "ignore", "ignore"] });
  } catch {
    // Best-effort cleanup only.
  }
}

function copyChangedFiles(sourceDir, targetDir, files) {
  for (const file of files) {
    const sourcePath = join(sourceDir, file);
    const targetPath = join(targetDir, file);
    ensureDir(dirname(targetPath));
    copyFileSync(sourcePath, targetPath);
  }
}

function commitFiles(cwd, files, message) {
  if (!files.length) return false;
  ensureGitIdentity(cwd);
  git(cwd, ["add", "--", ...files]);
  git(cwd, ["commit", "-m", message], { stdio: ["ignore", "pipe", "pipe"] });
  return true;
}

function interpolateCommand(command, context) {
  return command.replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key) => {
    const value = context[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function collectMjsFiles(root, dirName) {
  return collectFiles(join(root, dirName), ".mjs").map((filePath) => relative(root, filePath));
}

function collectTestFiles(root, dirName) {
  return collectFiles(join(root, dirName), ".test.mjs").map((filePath) => relative(root, filePath));
}

async function runSmokeChecks(candidateDir) {
  const failures = [];

  const pluginManifest = join(candidateDir, ".claude-plugin", "plugin.json");
  if (existsSync(pluginManifest)) {
    try {
      JSON.parse(readFileSync(pluginManifest, "utf8"));
    } catch (error) {
      failures.push(`manifest:${error.message}`);
    }
  }

  const syntaxFiles = [...collectMjsFiles(candidateDir, "hooks"), ...collectMjsFiles(candidateDir, "mcp")];
  if (syntaxFiles.length > 0) {
    try {
      await execFileAsync("node", ["--check", ...syntaxFiles], {
        cwd: candidateDir,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      failures.push(`syntax:${(error.stderr || error.stdout || error.message).trim()}`);
    }
  }

  const contractTests = [
    ...collectTestFiles(candidateDir, join("tests", "contracts")),
    ...collectTestFiles(candidateDir, join("tests", "runtime")),
  ];
  if (contractTests.length > 0) {
    try {
      await execFileAsync("node", ["--test", ...contractTests], {
        cwd: candidateDir,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      failures.push(`contract:${(error.stderr || error.stdout || error.message).trim()}`);
    }
  }

  return failures;
}

function verifyChangedFiles(changedFiles, targets) {
  const allowed = new Set(targets);
  for (const changedFile of changedFiles) {
    validateLoopTarget(changedFile);
    if (!allowed.has(changedFile)) {
      throw new Error(`Mutation touched "${changedFile}" outside the selected targets`);
    }
  }
}

function applyMutation(strategy, candidateDir, targets) {
  const changedFiles = [];

  for (const target of targets) {
    const filePath = join(candidateDir, target);
    const original = readFileSync(filePath, "utf8");
    const mutated = strategy.mutate(original);
    if (mutated !== original) {
      writeFileSync(filePath, mutated, "utf8");
      changedFiles.push(target);
    }
  }

  verifyChangedFiles(changedFiles, targets);
  return changedFiles;
}

async function evaluateCase(caseDef, context, artifactDir) {
  const captureDir = join(artifactDir, context.candidate_id);
  ensureDir(captureDir);
  const command = interpolateCommand(caseDef.command, {
    candidate_dir: context.candidate_dir,
    capture_dir: captureDir,
    case_id: caseDef.id,
    prompt: caseDef.prompt,
    review_preset: caseDef.review_preset,
    input_path: caseDef.input_path ? join(context.candidate_dir, caseDef.input_path) : "",
  });

  try {
    const output = await shellAsync(
      context.candidate_dir,
      command,
      Number(caseDef.timeout_sec) * 1000
    );
    const score = parseEvaluatorOutput(output);
    writeFileSync(join(captureDir, `${caseDef.id}.log`), output, "utf8");

    if (score === null || Number.isNaN(score)) {
      return { score: 0, failure: "critic-output" };
    }

    return { score, failure: null };
  } catch (error) {
    const text = [error.stdout, error.stderr, error.message].filter(Boolean).join("\n");
    writeFileSync(join(captureDir, `${caseDef.id}.log`), text, "utf8");
    return { score: 0, failure: "critic-output" };
  }
}

async function evaluateCandidate(suite, candidate, artifactDir) {
  const hardGateFailures = [];
  const smokeFailures = await runSmokeChecks(candidate.worktree);
  hardGateFailures.push(...smokeFailures);

  if (candidate.changed_files.length > 0) {
    try {
      verifyChangedFiles(candidate.changed_files, candidate.targets);
    } catch (error) {
      hardGateFailures.push(error.message);
    }
  }

  const scoreMap = new Map();
  for (const caseDef of suite.cases) {
    const evaluated = await evaluateCase(caseDef, {
      candidate_id: candidate.candidate_id,
      candidate_dir: candidate.worktree,
    }, artifactDir);
    if (evaluated.failure) {
      hardGateFailures.push(evaluated.failure);
    }
    scoreMap.set(caseDef.id, evaluated.score);
  }

  const averageScore = hardGateFailures.length > 0
    ? 0
    : aggregateCaseScores(suite.cases, scoreMap);

  return {
    ...candidate,
    case_scores: Object.fromEntries(scoreMap.entries()),
    average_score: averageScore,
    hard_gate_failed: hardGateFailures.length > 0,
    hard_gate_failures: [...new Set(hardGateFailures)],
  };
}

function summarizeRunState(state) {
  return {
    run_id: state.run_id,
    suite: state.suite,
    status: state.status,
    generation: state.generation,
    max_generations: state.max_generations,
    best_score: state.best_score,
    branch: state.branch,
    artifact_dir: state.artifact_dir,
    winner: state.winner,
  };
}

function scoreChecks(filePath, checks) {
  const text = readFileSync(filePath, "utf8");
  const passed = checks.filter((pattern) => pattern.test(text)).length;
  return Number((passed / checks.length).toFixed(4));
}

function bundledSuiteScore(suiteName, caseId, candidateDir) {
  const suites = {
    "write-core": {
      "write-command-surface": () =>
        scoreChecks(join(candidateDir, "commands", "write.md"), [
          /\/second-claude-code:write/,
          /loaded `write` skill/i,
          /format \(newsletter\|article\|shorts\|report\|social\|card-news\)/i,
          /--voice peer-mentor\|expert\|casual/i,
        ]),
      "write-skill-structure": () =>
        scoreChecks(join(candidateDir, "skills", "write", "SKILL.md"), [
          /^name:\s*write$/m,
          /## Workflow/,
          /## Options/,
          /## Output/,
          /newsletter[\s\S]*2000/i,
          /article[\s\S]*3000/i,
        ]),
      "newsletter-template-contract": () =>
        scoreChecks(join(candidateDir, "templates", "newsletter.md"), [
          /2000 words/i,
          /This is the core of the newsletter/i,
          /action/i,
        ]),
    },
    "review-core": {
      "review-command-surface": () =>
        scoreChecks(join(candidateDir, "commands", "review.md"), [
          /\/second-claude-code:review/,
          /loaded `review` skill/i,
          /--preset content\|strategy\|code\|security\|quick\|full/i,
          /Return the actual review result/i,
        ]),
      "review-skill-consensus": () =>
        scoreChecks(join(candidateDir, "skills", "review", "SKILL.md"), [
          /## Consensus Gate/,
          /average score across reviewers/i,
          /Critical finding/i,
          /## Output/,
        ]),
      "xatu-agent-contract": () =>
        scoreChecks(join(candidateDir, "agents", "xatu.md"), [
          /deep-reviewer/i,
          /logic/i,
          /structure/i,
        ]),
    },
  };

  const scorer = suites[suiteName]?.[caseId];
  if (!scorer) {
    throw new Error(`Unknown bundled scorer ${suiteName}/${caseId}`);
  }

  return scorer();
}

function promoteWinner(runWorktree, winner, artifactDir) {
  copyChangedFiles(winner.worktree, runWorktree, winner.changed_files);
  if (winner.changed_files.length > 0) {
    commitFiles(runWorktree, winner.changed_files, `loop: promote ${winner.candidate_id}`);
  }

  let diff = "";
  try {
    diff = git(runWorktree, ["show", "--stat", "--patch", "HEAD"]);
  } catch {
    diff = "";
  }
  writeFileSync(join(artifactDir, "winner.diff"), diff, "utf8");
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function runLoop(root, suiteName, options) {
  const { suite } = loadSuite(root, suiteName);
  const targets = resolveSelectedTargets(suite, options.targets || "");
  ensureFilesExist(root, targets);

  const dataDir = dataDirFromEnv(root);
  const runId = buildRunId(suiteName);
  const branch = `codex/loop-${runId}`;
  const artifactDir = join(root, ".captures", `loop-${runId}`);
  const worktreesRoot = join(dataDir, "loop-worktrees", runId);
  const runWorktree = join(worktreesRoot, "run");
  const stateFile = statePath(root);
  const maxGenerations = Number(options["max-generations"] || suite.budget.max_generations || 1);
  const maxCandidates = Number(options.budget || suite.budget.max_candidates || 3);
  const parallel = Number(options.parallel || suite.budget.parallel || 1);

  if (!Number.isInteger(maxGenerations) || maxGenerations < 1) {
    throw new Error("max-generations must be a positive integer");
  }
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1) {
    throw new Error("budget must resolve to a positive integer candidate count");
  }
  if (!Number.isInteger(parallel) || parallel < 1) {
    throw new Error("parallel must be at least 1");
  }

  ensureDir(artifactDir);
  ensureDir(worktreesRoot);

  createWorktree(root, "HEAD", branch, runWorktree);

  const leaderboard = [];
  const scoreHistory = [];

  let bestCandidate = {
    candidate_id: "baseline",
    branch,
    worktree: runWorktree,
    generation: 0,
    strategy_id: "baseline",
    changed_files: [],
    targets,
  };
  bestCandidate = await evaluateCandidate(suite, bestCandidate, artifactDir);
  leaderboard.push(bestCandidate);
  scoreHistory.push({
    generation: 0,
    candidate_id: bestCandidate.candidate_id,
    average_score: bestCandidate.average_score,
  });

  let plateauCount = 0;
  let elites = [bestCandidate];
  let completedGenerations = 0;
  let terminationReason = "budget_exhausted";

  for (let generation = 1; generation <= maxGenerations; generation += 1) {
    const parentCandidates = elites.slice(0, Math.min(2, elites.length));
    const candidatePlans = [];

    for (let index = 0; index < maxCandidates; index += 1) {
      const parent = parentCandidates[index % parentCandidates.length];
      const strategy = MUTATION_STRATEGIES[index % MUTATION_STRATEGIES.length];
      const candidateId = `g${generation}-c${index + 1}`;
      const candidateBranch = `${branch}-${candidateId}`;
      const candidateWorktree = join(worktreesRoot, candidateId);

      candidatePlans.push({
        parent,
        strategy,
        candidateId,
        candidateBranch,
        candidateWorktree,
        generation,
      });
    }

    const generationCandidates = await mapWithConcurrency(candidatePlans, parallel, async (plan) => {
      createWorktree(root, plan.parent.branch, plan.candidateBranch, plan.candidateWorktree);

      const changedFiles = applyMutation(plan.strategy, plan.candidateWorktree, targets);
      if (changedFiles.length > 0) {
        commitFiles(plan.candidateWorktree, changedFiles, `loop: ${plan.strategy.id}`);
      }

      return evaluateCandidate(suite, {
        candidate_id: plan.candidateId,
        branch: plan.candidateBranch,
        worktree: plan.candidateWorktree,
        generation: plan.generation,
        strategy_id: plan.strategy.id,
        changed_files: changedFiles,
        targets,
      }, artifactDir);
    });

    for (const evaluated of generationCandidates) {
      leaderboard.push(evaluated);
      scoreHistory.push({
        generation,
        candidate_id: evaluated.candidate_id,
        average_score: evaluated.average_score,
      });
    }
    completedGenerations = generation;

    const newElites = selectEliteCandidates([...elites, ...generationCandidates], 2);
    const generationBest = newElites[0] || bestCandidate;
    if (generationBest.average_score > bestCandidate.average_score) {
      bestCandidate = generationBest;
      plateauCount = 0;
    } else {
      plateauCount += 1;
    }

    elites = newElites.length > 0 ? newElites : elites;

    if (plateauCount >= 2) {
      terminationReason = "plateau";
      break;
    }
  }

  const delta = Number((bestCandidate.average_score - leaderboard[0].average_score).toFixed(4));
  let status = terminationReason;
  let winner = null;

  if (!bestCandidate.hard_gate_failed && bestCandidate.candidate_id !== "baseline" && delta >= suite.scoring.min_delta) {
    promoteWinner(runWorktree, bestCandidate, artifactDir);
    status = "winner_promoted";
    winner = {
      candidate_id: bestCandidate.candidate_id,
      average_score: bestCandidate.average_score,
      delta,
      changed_files: bestCandidate.changed_files,
      strategy_id: bestCandidate.strategy_id,
    };
  } else if (terminationReason !== "plateau" && delta < suite.scoring.min_delta) {
    status = "min_delta_not_met";
  }

  const finalState = {
    run_id: runId,
    suite: suite.name,
    status,
    generation: completedGenerations,
    max_generations: maxGenerations,
    best_score: bestCandidate.average_score,
    branch,
    worktree: runWorktree,
    artifact_dir: artifactDir,
    selected_targets: targets,
    winner,
    leaderboard,
    score_history: scoreHistory,
    updated_at: new Date().toISOString(),
  };

  writeJson(join(artifactDir, "leaderboard.json"), leaderboard);
  writeJson(join(artifactDir, "score-history.json"), scoreHistory);
  writeJson(join(artifactDir, "summary.json"), summarizeRunState(finalState));
  writeJson(stateFile, finalState);

  for (const entry of leaderboard) {
    if (entry.worktree !== runWorktree) {
      removeWorktree(root, entry.worktree);
    }
    if (entry.branch && entry.branch !== branch) {
      deleteBranch(root, entry.branch);
    }
  }

  return summarizeRunState(finalState);
}

function resumeLoop(root, runId) {
  const filePath = statePath(root);
  if (!existsSync(filePath)) {
    throw new Error("No loop-active state is available to resume");
  }

  const state = readJson(filePath);
  if (state.run_id !== sanitizeRunId(runId)) {
    throw new Error(`Saved loop state belongs to ${state.run_id}, not ${runId}`);
  }

  return summarizeRunState(state);
}

function handleBundledScorer(args) {
  const suiteName = args[0];
  const caseId = args[1];
  const candidateDir = resolve(args[2] || ".");
  const averageScore = bundledSuiteScore(suiteName, caseId, candidateDir);
  console.log(JSON.stringify({ average_score: averageScore }));
}

async function main() {
  const root = repoRootFromCwd();
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [subcommand, arg1] = positional;

  if (subcommand === "__score-suite-case") {
    handleBundledScorer(positional.slice(1));
    return;
  }

  if (!subcommand) {
    throw new Error("Usage: loop-runner.mjs <list-suites|show-suite|run|resume>");
  }

  if (subcommand === "list-suites") {
    console.log(JSON.stringify({ suites: listSuiteNames(root) }));
    return;
  }

  if (subcommand === "show-suite") {
    if (!arg1) throw new Error("show-suite requires a suite name");
    const { suite } = loadSuite(root, arg1);
    console.log(JSON.stringify(suite, null, 2));
    return;
  }

  if (subcommand === "run") {
    if (!arg1) throw new Error("run requires a suite name");
    console.log(JSON.stringify(await runLoop(root, arg1, flags), null, 2));
    return;
  }

  if (subcommand === "resume") {
    if (!arg1) throw new Error("resume requires a run_id");
    console.log(JSON.stringify(resumeLoop(root, arg1), null, 2));
    return;
  }

  throw new Error(`Unknown subcommand "${subcommand}"`);
}

const isMainModule = resolve(process.argv[1] || "") === __filename;

if (isMainModule) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
