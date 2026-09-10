import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts", "export-artifact.mjs");

function makeDataDir() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "scc-export-artifact-"));
  const dataDir = path.join(tmp, "data");
  mkdirSync(path.join(dataDir, "state"), { recursive: true });
  mkdirSync(path.join(dataDir, "events"), { recursive: true });
  mkdirSync(path.join(dataDir, "cycles", "cycle-001"), { recursive: true });

  const runId = "run-export-1";
  writeFileSync(
    path.join(dataDir, "state", "pdca-last-completed.json"),
    JSON.stringify({
      run_id: runId,
      topic: "Export HTML topic",
      domain: "general",
      current_phase: "act",
      completed: ["plan", "do", "check", "act"],
      cycle_count: 1,
      max_cycles: 3,
      reviewer_count: 2,
      critical_count: 0,
      gates: { plan_to_do: true, do_to_check: true, check_to_act: true },
    }),
    "utf8"
  );

  const events = [
    { ts: "2026-01-01T00:00:00.000Z", type: "phase_start", phase: "plan", data: { cycle_count: 1 } },
    { ts: "2026-01-01T00:00:05.000Z", type: "phase_end", phase: "plan", data: { artifacts_set: ["plan_research"] } },
    { ts: "2026-01-01T00:00:05.000Z", type: "phase_start", phase: "do", data: { cycle_count: 1 } },
    { ts: "2026-01-01T00:00:20.000Z", type: "phase_end", phase: "do", data: { artifacts_set: ["do"] } },
  ];
  writeFileSync(
    path.join(dataDir, "events", `pdca-${runId}.jsonl`),
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
    "utf8"
  );
  writeFileSync(path.join(dataDir, "cycles", "cycle-001", "plan.md"), "# Plan\nShip the export.\n", "utf8");
  return { tmp, dataDir };
}

function runScript(args, cwd = root) {
  const stdout = execFileSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  return JSON.parse(stdout);
}

test("html export is a self-contained projection of the event log", () => {
  const { tmp, dataDir } = makeDataDir();
  try {
    const out = path.join(tmp, "export.html");
    const result = runScript(["--data-dir", dataDir, "--format", "html", "--out", out]);
    assert.equal(result.format, "html");
    const html = readFileSync(out, "utf8");
    assert.match(html, /Export HTML topic/);
    assert.match(html, /<style>/);
    assert.equal(html.includes('src="http'), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("default --out still writes markdown", () => {
  const { tmp, dataDir } = makeDataDir();
  try {
    const result = runScript(["--data-dir", dataDir], tmp);
    assert.equal(result.format, "md");
    assert.equal(result.out, "pdca-export.md");
    const md = readFileSync(path.join(tmp, "pdca-export.md"), "utf8");
    assert.match(md, /^# Export HTML topic/m);
    assert.match(md, /```mermaid/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("infers html from --out ending in .html", () => {
  const { tmp, dataDir } = makeDataDir();
  try {
    const out = path.join(tmp, "inferred.html");
    const result = runScript(["--data-dir", dataDir, "--out", out]);
    assert.equal(result.format, "html");
    const html = readFileSync(out, "utf8");
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<style>/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
