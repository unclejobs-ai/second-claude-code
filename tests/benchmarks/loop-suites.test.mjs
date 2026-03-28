import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const SUITE_DIR = join(ROOT, "benchmarks", "loop");

/**
 * Load all benchmark suite JSON files from benchmarks/loop/.
 */
function loadSuiteFiles() {
  if (!existsSync(SUITE_DIR)) return [];
  return readdirSync(SUITE_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({
      name: f.replace(/\.json$/, ""),
      path: join(SUITE_DIR, f),
      data: JSON.parse(readFileSync(join(SUITE_DIR, f), "utf8")),
    }));
}

const suites = loadSuiteFiles();

test("benchmarks/loop/ contains at least one suite", () => {
  assert.ok(suites.length > 0, "Expected at least one benchmark suite in benchmarks/loop/");
});

for (const suite of suites) {
  test(`suite "${suite.name}" has valid top-level structure`, () => {
    const required = ["name", "description", "allowed_targets", "cases", "budget", "scoring"];
    for (const key of required) {
      assert.ok(key in suite.data, `Suite "${suite.name}" is missing required field "${key}"`);
    }
    assert.ok(Array.isArray(suite.data.allowed_targets), "allowed_targets must be an array");
    assert.ok(suite.data.allowed_targets.length > 0, "allowed_targets must not be empty");
    assert.ok(Array.isArray(suite.data.cases), "cases must be an array");
    assert.ok(suite.data.cases.length > 0, "cases must not be empty");
  });

  test(`suite "${suite.name}" allowed_targets exist in the repo`, () => {
    for (const target of suite.data.allowed_targets) {
      const targetPath = join(ROOT, target);
      assert.ok(
        existsSync(targetPath),
        `Target "${target}" referenced by suite "${suite.name}" does not exist at ${targetPath}`
      );
    }
  });

  test(`suite "${suite.name}" cases have required fields and valid weights`, () => {
    const requiredCaseFields = ["id", "prompt", "command", "review_preset", "weight", "timeout_sec"];
    for (const caseDef of suite.data.cases) {
      for (const field of requiredCaseFields) {
        assert.ok(
          field in caseDef,
          `Case "${caseDef.id || "(unnamed)"}" in suite "${suite.name}" is missing field "${field}"`
        );
      }
      assert.equal(typeof caseDef.weight, "number", `weight must be a number in case "${caseDef.id}"`);
      assert.ok(caseDef.weight > 0 && caseDef.weight <= 1, `weight must be in (0, 1] in case "${caseDef.id}"`);
      assert.equal(typeof caseDef.timeout_sec, "number", `timeout_sec must be a number in case "${caseDef.id}"`);
      assert.ok(caseDef.timeout_sec > 0, `timeout_sec must be positive in case "${caseDef.id}"`);
    }
  });

  test(`suite "${suite.name}" case weights sum to approximately 1.0`, () => {
    const totalWeight = suite.data.cases.reduce((sum, c) => sum + c.weight, 0);
    assert.ok(
      Math.abs(totalWeight - 1.0) < 0.01,
      `Case weights in "${suite.name}" sum to ${totalWeight}, expected ~1.0`
    );
  });

  test(`suite "${suite.name}" scoring has required fields`, () => {
    assert.ok(Array.isArray(suite.data.scoring.hard_gates), "scoring.hard_gates must be an array");
    assert.ok(suite.data.scoring.hard_gates.length > 0, "scoring.hard_gates must not be empty");
    assert.equal(
      typeof suite.data.scoring.min_delta,
      "number",
      "scoring.min_delta must be a number"
    );
    assert.ok(
      suite.data.scoring.min_delta > 0,
      "scoring.min_delta must be positive"
    );
  });

  test(`suite "${suite.name}" budget has required fields`, () => {
    assert.equal(typeof suite.data.budget.max_candidates, "number", "budget.max_candidates must be a number");
    assert.equal(typeof suite.data.budget.max_generations, "number", "budget.max_generations must be a number");
    assert.equal(typeof suite.data.budget.parallel, "number", "budget.parallel must be a number");
    assert.ok(suite.data.budget.max_candidates > 0, "max_candidates must be positive");
    assert.ok(suite.data.budget.max_generations > 0, "max_generations must be positive");
    assert.ok(suite.data.budget.parallel > 0, "parallel must be positive");
  });

  test(`suite "${suite.name}" case IDs are unique`, () => {
    const ids = suite.data.cases.map((c) => c.id);
    const unique = new Set(ids);
    assert.equal(ids.length, unique.size, `Duplicate case IDs found in suite "${suite.name}"`);
  });

  test(`suite "${suite.name}" produces valid structured output format`, () => {
    // Verify the suite itself is valid JSON that round-trips cleanly
    const roundTripped = JSON.parse(JSON.stringify(suite.data));
    assert.deepEqual(roundTripped, suite.data, "Suite data must survive JSON round-trip");

    // Verify name field matches filename
    assert.equal(
      suite.data.name,
      suite.name,
      `Suite name field "${suite.data.name}" must match filename "${suite.name}"`
    );
  });
}
