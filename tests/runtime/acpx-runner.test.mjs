import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { readJson } from "../../scripts/lib/acpx-runtime.mjs";
import { runAcpxRequest } from "../../scripts/acpx-runner.mjs";

const root = process.cwd();
const fakeAcpx = path.join(root, "tests", "fixtures", "fake-acpx.mjs");

function launcher() {
  return {
    command: process.execPath,
    args: [fakeAcpx],
  };
}

test("acpx runner captures exec artifacts and parses final text", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-acpx-runner-"));
  const outputDir = path.join(tempDir, "impl");

  const result = await runAcpxRequest({
    run_id: "runner-success",
    role: "impl",
    agent: "codex",
    mode: "exec",
    cwd: root,
    output_dir: outputDir,
    prompt: "Implement feature X",
    launcher: launcher(),
    timeout_sec: 5,
  });

  const stored = readJson(path.join(outputDir, "result.json"));
  assert.equal(result.ok, true);
  assert.equal(stored.ok, true);
  assert.equal(stored.agent, "codex");
  assert.match(stored.final_text, /completed task successfully/);
  assert.equal(existsSync(path.join(outputDir, "stdout.ndjson")), true);
  assert.equal(existsSync(path.join(outputDir, "stderr.txt")), true);
});

test("acpx runner supports session mode and writes ensure metadata", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-acpx-runner-"));
  const outputDir = path.join(tempDir, "review");

  const result = await runAcpxRequest({
    run_id: "runner-session",
    role: "review",
    agent: "claude",
    mode: "session",
    session_name: "runner-session-review",
    cwd: root,
    output_dir: outputDir,
    prompt: "Review the branch",
    launcher: launcher(),
    timeout_sec: 5,
  });

  const ensure = readJson(path.join(outputDir, "ensure.json"));
  assert.equal(result.ok, true);
  assert.equal(ensure.ok, true);
  assert.equal(result.session_name, "runner-session-review");
});
