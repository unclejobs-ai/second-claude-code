import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  symlinkSync,
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

function snapshotTree(directory, relativeDirectory = "") {
  const snapshot = {};
  const absoluteDirectory = path.join(directory, relativeDirectory);

  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      snapshot[`${relativePath}/`] = "directory";
      Object.assign(snapshot, snapshotTree(directory, relativePath));
    } else {
      snapshot[relativePath] = readFileSync(path.join(directory, relativePath), "base64");
    }
  }

  return snapshot;
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

test("stop-failure does not access state through a symlinked plugin data path", () => {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-failure-data-link-"));
  const targetData = path.join(sandbox, "target-data");
  mkdirSync(path.join(targetData, "state"), { recursive: true });
  writeFileSync(
    statePath(targetData, "pdca-active.json"),
    JSON.stringify({ run_id: "data-link", current_phase: "do", cycle_count: 1 })
  );
  const dataLink = path.join(sandbox, "plugin-data-link");
  symlinkSync(targetData, dataLink, "dir");
  const before = snapshotTree(targetData);

  const result = runHook(dataLink);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
  assert.deepEqual(snapshotTree(targetData), before);
});

test("stop-failure does not access state through a symlinked plugin data ancestor", () => {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-failure-parent-link-"));
  const targetParent = path.join(sandbox, "target-parent");
  const targetData = path.join(targetParent, "plugin-data");
  mkdirSync(path.join(targetData, "state"), { recursive: true });
  writeFileSync(
    statePath(targetData, "pdca-active.json"),
    JSON.stringify({ run_id: "parent-link", current_phase: "check", cycle_count: 2 })
  );
  const parentLink = path.join(sandbox, "parent-link");
  symlinkSync(targetParent, parentLink, "dir");
  const linkedData = path.join(parentLink, "plugin-data");
  const before = snapshotTree(targetParent);

  const result = runHook(linkedData);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
  assert.deepEqual(snapshotTree(targetParent), before);
});

test("stop-failure does not access state through a symlinked state directory", () => {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-failure-state-link-"));
  const pluginData = path.join(sandbox, "plugin-data");
  const targetState = path.join(sandbox, "target-state");
  mkdirSync(pluginData);
  mkdirSync(targetState);
  writeFileSync(
    path.join(targetState, "pdca-active.json"),
    JSON.stringify({ run_id: "state-link", current_phase: "act", cycle_count: 3 })
  );
  symlinkSync(targetState, path.join(pluginData, "state"), "dir");
  const before = snapshotTree(targetState);

  const result = runHook(pluginData);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
  assert.deepEqual(snapshotTree(targetState), before);
  assert.equal(existsSync(path.join(pluginData, "events")), false);
});

test("stop-failure recovery does not follow a symlinked events directory", () => {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-failure-events-link-"));
  const pluginData = path.join(sandbox, "plugin-data");
  const targetEvents = path.join(sandbox, "target-events");
  mkdirSync(path.join(pluginData, "state"), { recursive: true });
  mkdirSync(targetEvents);
  writeFileSync(
    statePath(pluginData, "pdca-active.json"),
    JSON.stringify({ run_id: "events-link", current_phase: "act", cycle_count: 3 })
  );
  symlinkSync(targetEvents, path.join(pluginData, "events"), "dir");
  const before = snapshotTree(targetEvents);

  const result = runHook(pluginData);

  assert.equal(result.status, 0);
  assert.equal(existsSync(statePath(pluginData, "pdca-crash-recovery.json")), true);
  assert.deepEqual(snapshotTree(targetEvents), before);
});

test("stop-failure recovery does not follow a symlinked event log leaf", () => {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "second-claude-stop-failure-event-file-link-"));
  const pluginData = path.join(sandbox, "plugin-data");
  const targetLog = path.join(sandbox, "target.jsonl");
  mkdirSync(path.join(pluginData, "state"), { recursive: true });
  mkdirSync(path.join(pluginData, "events"));
  writeFileSync(targetLog, "outside-before\n");
  writeFileSync(
    statePath(pluginData, "pdca-active.json"),
    JSON.stringify({ run_id: "leaf-link", current_phase: "check", cycle_count: 2 })
  );
  symlinkSync(targetLog, path.join(pluginData, "events", "pdca-leaf-link.jsonl"));
  const before = readFileSync(targetLog, "utf8");

  const result = runHook(pluginData);

  assert.equal(result.status, 0);
  assert.equal(existsSync(statePath(pluginData, "pdca-crash-recovery.json")), true);
  assert.equal(readFileSync(targetLog, "utf8"), before);
});
