import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { logEvent } from "../../hooks/lib/event-log.mjs";
import { readRecords, setMaintainerCheck, upsertByDedup } from "../../mcp/lib/evolve-ledger.mjs";
import {
  scanFailures,
  buildSuite,
  validateGeneratedSuite,
  parseAssertions,
  evaluateHoldout,
} from "../../scripts/evolve-runner.mjs";

const root = process.cwd();

function makeTemp() {
  return mkdtempSync(join(tmpdir(), "evolve-test-"));
}

test("evolve-scorer scores structural conformance as matched/total", () => {
  const dir = makeTemp();
  try {
    writeFileSync(join(dir, "asset.md"), "# Title\n\n## Output\n\nbody\n", "utf8");
    const b64 = (list) => Buffer.from(JSON.stringify(list)).toString("base64");
    const score = (list) =>
      JSON.parse(
        execFileSync("node", [join(root, "scripts", "evolve-scorer.mjs"), dir, "asset.md", b64(list)], {
          encoding: "utf8",
        })
      ).average_score;

    assert.equal(score(["## Output"]), 1);
    assert.equal(score(["## Output", "## Workflow"]), 0.5);
    assert.equal(score(["## Workflow", "## Gotchas"]), 0);
    // object form {source, flags}
    assert.equal(score([{ source: "## output", flags: "i" }]), 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("evolve-scorer rejects an empty-source entry instead of matching everything", () => {
  const dir = makeTemp();
  try {
    writeFileSync(join(dir, "asset.md"), "no heading here", "utf8");
    // An empty source would compile to /(?:)/ and pass against any file — must be refused.
    for (const bad of [[""], [{ flags: "i" }]]) {
      const b64 = Buffer.from(JSON.stringify(bad)).toString("base64");
      assert.throws(() =>
        execFileSync("node", [join(root, "scripts", "evolve-scorer.mjs"), dir, "asset.md", b64], {
          encoding: "utf8",
          stdio: "pipe",
        })
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("evolve-scorer rejects an empty assertion set", () => {
  const dir = makeTemp();
  try {
    writeFileSync(join(dir, "asset.md"), "x", "utf8");
    const b64 = Buffer.from(JSON.stringify([])).toString("base64");
    assert.throws(() =>
      execFileSync("node", [join(root, "scripts", "evolve-scorer.mjs"), dir, "asset.md", b64], {
        encoding: "utf8",
        stdio: "pipe",
      })
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ledger upsert preserves the maintainer-authored check across re-harvest", () => {
  const data = makeTemp();
  try {
    const base = {
      id: "skills-research-skill-md-sources-min-3",
      ts: "2026-01-01T00:00:00.000Z",
      source_kind: "gate_fail",
      asset_path: "skills/research/SKILL.md",
      gate_rule: "sources_min_5",
      finding_excerpt: "gate_fail: sources_min_5 (phase plan)",
      dedup_key: "skills/research/SKILL.md::sources_min_5",
      source_runs: ["r1"],
      recurrence: 1,
      checkable: true,
      check_assertion: null,
      check_author: null,
      status: "open",
    };
    upsertByDedup(data, base);
    setMaintainerCheck(data, base.id, ["## Sources"]);

    // Re-harvest with higher recurrence must NOT wipe the authored check.
    upsertByDedup(data, { ...base, source_runs: ["r1", "r2", "r3"], recurrence: 3 });
    const [record] = readRecords(data, { id: base.id });

    assert.deepEqual(record.check_assertion, ["## Sources"]);
    assert.equal(record.check_author, "maintainer");
    assert.equal(record.status, "harvested");
    assert.equal(record.recurrence, 3);
  } finally {
    rmSync(data, { recursive: true, force: true });
  }
});

test("setMaintainerCheck refuses a non-maintainer author and empty assertions", () => {
  const data = makeTemp();
  try {
    upsertByDedup(data, {
      id: "x",
      dedup_key: "a::b",
      asset_path: "skills/research/SKILL.md",
      recurrence: 1,
      check_assertion: null,
      check_author: null,
      status: "open",
    });
    assert.throws(() => setMaintainerCheck(data, "x", ["ok"], "model"));
    assert.throws(() => setMaintainerCheck(data, "x", []));
  } finally {
    rmSync(data, { recursive: true, force: true });
  }
});

test("harvest scan aggregates real gate_fail events into a recurring provenance record", () => {
  const data = makeTemp();
  try {
    for (const runId of ["run-a", "run-b", "run-c"]) {
      logEvent(data, runId, { type: "gate_fail", phase: "plan", data: { missing: ["sources_min_5"] } });
    }
    scanFailures(root, data);
    const [record] = readRecords(data, { asset_path: "skills/research/SKILL.md", min_recurrence: 3 });

    assert.ok(record, "expected a recurring record for the research skill");
    assert.equal(record.gate_rule, "sources_min_5");
    assert.equal(record.recurrence, 3);
    assert.equal(record.check_author, null, "scan must not author a check");
  } finally {
    rmSync(data, { recursive: true, force: true });
  }
});

test("buildSuite emits a valid suite with the floor min_delta and an inline base64 check", () => {
  const data = makeTemp();
  try {
    const record = {
      id: "skills-research-skill-md-sources-min-3",
      asset_path: "skills/research/SKILL.md",
      dedup_key: "skills/research/SKILL.md::sources_min_5",
      recurrence: 3,
      check_assertion: ["## Sources"],
      check_author: "maintainer",
    };
    const suite = buildSuite(data, record);
    validateGeneratedSuite(suite);

    assert.equal(suite.scoring.min_delta, 0.02);
    assert.deepEqual(suite.allowed_targets, ["skills/research/SKILL.md"]);
    assert.match(suite.cases[0].command, /evolve-scorer\.mjs/);
    assert.match(suite.cases[0].command, /\{\{candidate_dir\}\}/);

    // Below-floor min_delta must be refused.
    assert.throws(() => validateGeneratedSuite({ ...suite, scoring: { ...suite.scoring, min_delta: 0.001 } }));
  } finally {
    rmSync(data, { recursive: true, force: true });
  }
});

test("parseAssertions requires a maintainer-supplied value", () => {
  assert.throws(() => parseAssertions(""));
  assert.deepEqual(parseAssertions("## Output,## Workflow"), ["## Output", "## Workflow"]);
  assert.deepEqual(parseAssertions('["## Output"]'), ["## Output"]);
  // empty / sourceless entries are filtered out, and an all-empty set is rejected
  assert.throws(() => parseAssertions('[""]'));
  assert.throws(() => parseAssertions('[{"flags":"i"}]'));
  assert.deepEqual(parseAssertions('["", "## Output"]'), ["## Output"]);
  assert.deepEqual(parseAssertions('[{"source":"## Output","flags":"i"}]'), [
    { source: "## Output", flags: "i" },
  ]);
});

test("setMaintainerCheck persists a --target asset override to disk", () => {
  const data = makeTemp();
  try {
    upsertByDedup(data, {
      id: "rec",
      dedup_key: "skills/research/SKILL.md::sources_min_5",
      asset_path: "skills/research/SKILL.md",
      recurrence: 3,
      check_assertion: null,
      check_author: null,
      status: "open",
    });
    setMaintainerCheck(data, "rec", ["## Sources"], "maintainer", "agents/eevee.md");
    const [record] = readRecords(data, { id: "rec" });

    assert.equal(record.asset_path, "agents/eevee.md", "override must be persisted");
    assert.equal(record.check_author, "maintainer");
    // holdout lookups keyed by the override asset can now find the ratified check
    assert.equal(readRecords(data, { asset_path: "agents/eevee.md" }).length, 1);
  } finally {
    rmSync(data, { recursive: true, force: true });
  }
});

test("evaluateHoldout flags a winner that regresses a prior ratified check", () => {
  const dir = makeTemp();
  try {
    const leaderboard = [
      { candidate_id: "baseline", case_scores: { "x-structure": 0.5, "holdout-y": 1 } },
      { candidate_id: "g1-c1", case_scores: { "x-structure": 1, "holdout-y": 0.5 } },
    ];
    writeFileSync(join(dir, "leaderboard.json"), JSON.stringify(leaderboard), "utf8");

    const regressed = evaluateHoldout({ winner: { candidate_id: "g1-c1" }, artifact_dir: dir });
    assert.equal(regressed.status, "holdout_regression");

    leaderboard[1].case_scores["holdout-y"] = 1;
    writeFileSync(join(dir, "leaderboard.json"), JSON.stringify(leaderboard), "utf8");
    const clean = evaluateHoldout({ winner: { candidate_id: "g1-c1" }, artifact_dir: dir });
    assert.equal(clean.status, "clean");

    assert.equal(evaluateHoldout({ winner: null }).status, "no_winner");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
