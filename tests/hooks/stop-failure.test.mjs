import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const hookPath = path.join(root, "hooks", "stop-failure.mjs");

function makeTempDataDir() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-failure-"));
  mkdirSync(path.join(tempDir, "state"), { recursive: true });
  return tempDir;
}

function statePath(tempDir, file) {
  return path.join(tempDir, "state", file);
}

function runHook(tempDir) {
  return spawnSync(process.execPath, [hookPath], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: tempDir,
    },
    encoding: "utf8",
  });
}

test("stop-failure exits cleanly when there is no active PDCA run", () => {
  const tempDir = makeTempDataDir();
  const result = runHook(tempDir);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(existsSync(statePath(tempDir, "pdca-crash-recovery.json")), false);
});

test("stop-failure writes a crash recovery snapshot from active PDCA state", () => {
  const tempDir = makeTempDataDir();

  writeFileSync(
    statePath(tempDir, "pdca-active.json"),
    JSON.stringify({
      run_id: "run-123",
      topic: "Hermes adoption",
      current_phase: "check",
      cycle_count: 2,
      artifact_paths: ["docs/report.md"],
    })
  );

  const result = runHook(tempDir);
  const recovery = JSON.parse(readFileSync(statePath(tempDir, "pdca-crash-recovery.json"), "utf8"));

  assert.equal(result.status, 0);
  assert.equal(recovery.run_id, "run-123");
  assert.equal(recovery.topic, "Hermes adoption");
  assert.equal(recovery.current_phase, "check");
  assert.equal(recovery.cycle_count, 2);
  assert.equal(recovery.recovery_source, "stop_failure_hook");
  assert.equal(typeof recovery.crashed_at, "string");
});

test("stop-failure appends an error event to the run event log", () => {
  const tempDir = makeTempDataDir();

  writeFileSync(
    statePath(tempDir, "pdca-active.json"),
    JSON.stringify({
      run_id: "run-456",
      topic: "Crash handling",
      current_phase: "act",
      cycle_count: 4,
    })
  );

  runHook(tempDir);

  const recoveryPath = statePath(tempDir, "pdca-crash-recovery.json");
  const eventLogPath = path.join(tempDir, "events", "pdca-run-456.jsonl");
  const event = JSON.parse(readFileSync(eventLogPath, "utf8").trim());

  assert.equal(event.type, "error");
  assert.equal(event.phase, "act");
  assert.equal(event.action, "stop_failure");
  assert.equal(event.run_id, "run-456");
  assert.equal(event.data.current_phase, "act");
  assert.equal(event.data.cycle_count, 4);
  assert.equal(event.data.recovery_file, recoveryPath);
  assert.equal(typeof event.data.crashed_at, "string");
});

test("stop-failure still writes recovery when event logging cannot derive a run id", () => {
  const tempDir = makeTempDataDir();

  writeFileSync(
    statePath(tempDir, "pdca-active.json"),
    JSON.stringify({
      topic: "Missing run id",
      current_phase: "plan",
      cycle_count: 1,
    })
  );

  const result = runHook(tempDir);

  assert.equal(result.status, 0);
  assert.equal(existsSync(statePath(tempDir, "pdca-crash-recovery.json")), true);
  assert.equal(existsSync(path.join(tempDir, "events")), false);
});

test("stop-failure ignores malformed active state files", () => {
  const tempDir = makeTempDataDir();

  writeFileSync(statePath(tempDir, "pdca-active.json"), "{not-json");

  const result = runHook(tempDir);

  assert.equal(result.status, 0);
  assert.equal(existsSync(statePath(tempDir, "pdca-crash-recovery.json")), false);
});
