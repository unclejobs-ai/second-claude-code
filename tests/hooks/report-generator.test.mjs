import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateCycleReport } from "../../hooks/lib/report-generator.mjs";

function makeTempDir() {
  return mkdtempSync(path.join(os.tmpdir(), "scc-report-"));
}

test("generates HTML report with all phase statuses", () => {
  const dir = makeTempDir();
  const htmlPath = generateCycleReport(dir, {
    cycleNumber: 3,
    phases: { plan: "pass", do: "pass", check: "warn", act: "pass" },
    totalTimeMs: 720000,
    issueCount: 2,
    score: 83,
    topic: "Newsletter optimization",
    history: [
      { cycle: 1, score: 65 },
      { cycle: 2, score: 78 },
      { cycle: 3, score: 83 },
    ],
    issues: ["Performance regression in module X", "Missing test for edge case"],
    nextAction: "Fix performance regression before next cycle",
  });

  assert.ok(existsSync(htmlPath));
  const html = readFileSync(htmlPath, "utf8");
  assert.match(html, /PDCA Cycle #3/);
  assert.match(html, /Newsletter optimization/);
  assert.match(html, /83/);
  assert.match(html, /chart\.js/i);
  assert.match(html, /mermaid/i);
  assert.match(html, /#4caf50/); // green for pass
  assert.match(html, /#ff9800/); // yellow for warn
});

test("generates Mermaid .mmd file alongside HTML", () => {
  const dir = makeTempDir();
  generateCycleReport(dir, {
    cycleNumber: 1,
    phases: { plan: "pass", do: "pass", check: "pass", act: "pass" },
    totalTimeMs: 300000,
    issueCount: 0,
    score: 95,
    topic: "Test",
  });

  const mmdPath = path.join(dir, "reports/cycle-1.mmd");
  assert.ok(existsSync(mmdPath));
  const mmd = readFileSync(mmdPath, "utf8");
  assert.match(mmd, /flowchart LR/);
  assert.match(mmd, /Plan:::pass/);
  assert.match(mmd, /classDef pass fill:#4caf50/);
});

test("handles fail status with red coloring", () => {
  const dir = makeTempDir();
  const htmlPath = generateCycleReport(dir, {
    cycleNumber: 5,
    phases: { plan: "pass", do: "pass", check: "fail", act: "fail" },
    totalTimeMs: 600000,
    issueCount: 5,
    score: 32,
    topic: "Failed cycle",
  });

  const html = readFileSync(htmlPath, "utf8");
  assert.match(html, /#f44336/); // red for fail
  assert.match(html, /✗/); // fail icon
});

test("handles null score gracefully", () => {
  const dir = makeTempDir();
  const htmlPath = generateCycleReport(dir, {
    cycleNumber: 1,
    phases: { plan: "pass", do: "pass", check: "pass", act: "pass" },
    totalTimeMs: 120000,
    issueCount: 0,
    score: null,
    topic: "No score",
  });

  const html = readFileSync(htmlPath, "utf8");
  assert.match(html, /—/); // dash for null score
});

test("omits trend chart when history has fewer than 2 entries", () => {
  const dir = makeTempDir();
  const htmlPath = generateCycleReport(dir, {
    cycleNumber: 1,
    phases: { plan: "pass", do: "pass", check: "pass", act: "pass" },
    totalTimeMs: 120000,
    issueCount: 0,
    score: 90,
    topic: "First cycle",
    history: [{ cycle: 1, score: 90 }],
  });

  const html = readFileSync(htmlPath, "utf8");
  assert.ok(!html.includes("trend-chart"));
});

test("creates .data/reports/ directory if it does not exist", () => {
  const dir = makeTempDir();
  const reportsDir = path.join(dir, "reports");
  assert.ok(!existsSync(reportsDir));

  generateCycleReport(dir, {
    cycleNumber: 1,
    phases: { plan: "pass", do: "pass", check: "pass", act: "pass" },
    totalTimeMs: 60000,
    issueCount: 0,
    score: 100,
    topic: "Test",
  });

  assert.ok(existsSync(reportsDir));
});
