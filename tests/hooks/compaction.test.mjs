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
const hookPath = path.join(root, "hooks", "compaction.mjs");

function makeTempDataDir() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-compaction-"));
  mkdirSync(path.join(tempDir, "state"), { recursive: true });
  return tempDir;
}

function statePath(tempDir, file) {
  return path.join(tempDir, "state", file);
}

function writeState(tempDir, file, value) {
  writeFileSync(statePath(tempDir, file), JSON.stringify(value, null, 2));
}

function runHook(tempDir, rawInput) {
  return spawnSync(process.execPath, [hookPath], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: tempDir,
    },
    input: rawInput,
    encoding: "utf8",
  });
}

function parseStdout(result) {
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

test("compaction precompact exits quietly when there is no active state", () => {
  const tempDir = makeTempDataDir();
  const result = runHook(tempDir, JSON.stringify({ event: "PreCompact" }));

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(existsSync(statePath(tempDir, "compaction-snapshot.json")), false);
});

test("compaction precompact writes a sanitized snapshot for active PDCA, loop, and pipeline state", () => {
  const tempDir = makeTempDataDir();

  writeState(tempDir, "pdca-active.json", {
    topic: "AI <Plan>\nDraft",
    current_phase: "check",
    completed: ["plan", "do"],
    cycle_count: 2,
    max_cycles: 5,
    check_verdict: "APPROVED<script>",
    artifact_paths: ["docs/[draft].md", "notes\nraw.md"],
  });
  writeState(tempDir, "loop-active.json", {
    goal: "Refine report",
    current_iteration: 4,
    max: 6,
    status: "running",
    best_score: 0.81,
    scores: [0.52, "0.81", "bad"],
  });
  writeState(tempDir, "pipeline-active.json", {
    name: "weekly|digest",
    current_step: 3,
    total_steps: 7,
    status: "running",
  });

  const result = runHook(tempDir, JSON.stringify({ event: "PreCompact" }));
  const snapshot = JSON.parse(readFileSync(statePath(tempDir, "compaction-snapshot.json"), "utf8"));

  assert.equal(result.status, 0);
  assert.match(result.stderr, /PDCA state preserved before compression/);
  assert.equal(snapshot.pdca.topic, "AI Plan Draft");
  assert.equal(snapshot.pdca.check_verdict, "APPROVEDscript");
  assert.deepEqual(snapshot.pdca.artifact_paths, ["docs/draft.md", "notes raw.md"]);
  assert.equal(snapshot.loop.suite, "Refine report");
  assert.equal(snapshot.loop.generation, 4);
  assert.equal(snapshot.loop.max_generations, 6);
  assert.deepEqual(snapshot.loop.scores, [0.52, 0.81, 0]);
  assert.equal(snapshot.pipeline.name, "weeklydigest");
  assert.equal(typeof snapshot.captured_at, "string");
});

test("compaction postcompact exits quietly when no snapshot exists", () => {
  const tempDir = makeTempDataDir();
  const result = runHook(tempDir, JSON.stringify({ event: "PostCompact" }));

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
});

test("compaction postcompact restores snapshot context and deletes the snapshot file", () => {
  const tempDir = makeTempDataDir();

  writeState(tempDir, "compaction-snapshot.json", {
    pdca: {
      topic: "Hermes adoption",
      current_phase: "check",
      completed: ["plan", "do"],
      cycle_count: 2,
      max_cycles: 4,
      check_verdict: "MINOR FIXES",
      artifact_paths: ["docs/report.md", "notes/findings.md"],
    },
    loop: {
      suite: "write-core",
      generation: 3,
      max_generations: 5,
      status: "running",
      best_score: 0.84,
      scores: [0.55, 0.71, 0.84],
    },
    pipeline: {
      name: "weekly-digest",
      current_step: 2,
      total_steps: 6,
      status: "running",
    },
    captured_at: "2026-03-28T00:00:00.000Z",
  });

  const result = runHook(tempDir, JSON.stringify({ event: "PostCompact" }));
  const output = parseStdout(result);
  const context = output.additionalContext;

  assert.equal(result.status, 0);
  assert.equal(existsSync(statePath(tempDir, "compaction-snapshot.json")), false);
  assert.match(context, /\[PDCA State Restored After Compression\]/);
  assert.match(context, /Topic: Hermes adoption/);
  assert.match(context, /Phase: check \(completed: plan → do\)/);
  assert.match(context, /Cycle: 2\/4/);
  assert.match(context, /Last verdict: MINOR FIXES/);
  assert.match(context, /Key artifacts: docs\/report\.md, notes\/findings\.md/);
  assert.match(context, /Active loop: "write-core" \(generation 3\/5, status: running\)/);
  assert.match(context, /Best score so far: 0\.84/);
  assert.match(context, /Loop scores so far: 0\.55 → 0\.71 → 0\.84/);
  assert.match(context, /Active pipeline: "weekly-digest" \(step 2\/6, status: running\)/);
  assert.match(context, /Resume: continue from the current phase/);
});

test("compaction precompact snapshots workflow-active.json alongside other state", () => {
  const tempDir = makeTempDataDir();

  writeState(tempDir, "workflow-active.json", {
    name: "weekly-digest",
    current_step: 3,
    total_steps: 5,
    status: "running",
  });

  const result = runHook(tempDir, JSON.stringify({ event: "PreCompact" }));
  const snapshot = JSON.parse(readFileSync(statePath(tempDir, "compaction-snapshot.json"), "utf8"));

  assert.equal(result.status, 0);
  assert.ok(snapshot.workflow);
  assert.equal(snapshot.workflow.name, "weekly-digest");
  assert.equal(snapshot.workflow.current_step, 3);
  assert.equal(snapshot.workflow.total_steps, 5);
  assert.equal(snapshot.workflow.status, "running");
});

test("compaction postcompact restores workflow state from snapshot", () => {
  const tempDir = makeTempDataDir();

  writeState(tempDir, "compaction-snapshot.json", {
    workflow: {
      name: "content-pipeline",
      current_step: 2,
      total_steps: 4,
      status: "running",
    },
    captured_at: "2026-03-28T00:00:00.000Z",
  });

  const result = runHook(tempDir, JSON.stringify({ event: "PostCompact" }));
  const output = parseStdout(result);
  const context = output.additionalContext;

  assert.equal(result.status, 0);
  assert.match(context, /Active workflow: "content-pipeline" \(step 2\/4, status: running\)/);
  assert.match(context, /Resume: continue from the current phase/);
});

test("compaction ignores unknown hook events without writing a snapshot", () => {
  const tempDir = makeTempDataDir();

  writeState(tempDir, "pdca-active.json", {
    topic: "Ignored run",
    current_phase: "plan",
  });

  const result = runHook(tempDir, JSON.stringify({ event: "SomethingElse" }));

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(existsSync(statePath(tempDir, "compaction-snapshot.json")), false);
});

test("compaction ignores malformed stdin payloads", () => {
  const tempDir = makeTempDataDir();

  writeState(tempDir, "pdca-active.json", {
    topic: "Ignored run",
    current_phase: "plan",
  });

  const result = runHook(tempDir, "{");

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(existsSync(statePath(tempDir, "compaction-snapshot.json")), false);
});
