import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// End-to-end: a real evolve-generated suite run through the UNMODIFIED loop engine in a
// throwaway git repo. Proves the two facts the unit tests cannot: (1) a should->must check
// actually promotes a winner, and (2) a presence-of-new-content check can NEVER promote under
// v1 mutations — locking in the documented limitation so it can't silently become a false promise.

const repo = process.cwd();

function git(cwd, args) {
  execFileSync("git", args, { cwd, encoding: "utf8" });
}

function setupRepo() {
  // realpath so the copied loop-runner's isMainModule check (process.argv[1] vs import.meta.url)
  // matches — macOS tmpdir is under the /var -> /private/var symlink.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "evolve-int-")));
  mkdirSync(join(dir, "scripts"), { recursive: true });
  mkdirSync(join(dir, "agents"), { recursive: true });
  mkdirSync(join(dir, "benchmarks", "loop"), { recursive: true });
  copyFileSync(join(repo, "scripts", "loop-runner.mjs"), join(dir, "scripts", "loop-runner.mjs"));
  copyFileSync(join(repo, "scripts", "evolve-scorer.mjs"), join(dir, "scripts", "evolve-scorer.mjs"));
  // Fixture target the loop can actually mutate: it says "should", not "must".
  writeFileSync(join(dir, "agents", "fixture.md"), "# Fixture\n\nThe agent should do the thing.\n", "utf8");

  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.email", "evolve@test.local"]);
  git(dir, ["config", "user.name", "Evolve Test"]);
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "init"]);
  return dir;
}

function runSuite(dir, name, assertions) {
  // Mirror evolve-runner caseForAssertions exactly (inline base64 + single-quoted asset).
  const b64 = Buffer.from(JSON.stringify(assertions)).toString("base64");
  const suite = {
    name,
    description: "integration",
    allowed_targets: ["agents/fixture.md"],
    cases: [
      {
        id: `${name}-structure`,
        prompt: "integration",
        command: `node scripts/evolve-scorer.mjs "{{candidate_dir}}" 'agents/fixture.md' ${b64}`,
        review_preset: "structural",
        weight: 1,
        timeout_sec: 60,
      },
    ],
    budget: { max_candidates: 5, max_generations: 1, parallel: 1 },
    scoring: { hard_gates: [], weights: { average_score: 1 }, min_delta: 0.02 },
  };
  writeFileSync(join(dir, "benchmarks", "loop", `${name}.json`), `${JSON.stringify(suite, null, 2)}\n`);
  const output = execFileSync(
    process.execPath,
    [join(dir, "scripts", "loop-runner.mjs"), "run", name, "--targets", "agents/fixture.md"],
    { cwd: dir, env: { ...process.env, CLAUDE_PLUGIN_DATA: join(dir, ".data") }, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
  return JSON.parse(output);
}

test("e2e: a should->must check promotes a winner through the real loop engine", () => {
  const dir = setupRepo();
  try {
    const result = runSuite(dir, "evolve-int-must", ["\\bmust\\b"]);
    assert.equal(result.status, "winner_promoted", `expected promotion, got ${result.status}`);
    assert.ok(result.winner && result.winner.delta >= 0.02, "winner delta should clear the floor");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("e2e: a presence-of-new-content check cannot promote under v1 mutations", () => {
  const dir = setupRepo();
  try {
    const result = runSuite(dir, "evolve-int-heading", ["## Nonexistent Heading"]);
    assert.notEqual(result.status, "winner_promoted", `heading-presence must not promote, got ${result.status}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
