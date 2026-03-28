import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { readJson } from "../../scripts/lib/acpx-runtime.mjs";
import { runFanoutRequest } from "../../scripts/acpx-fanout.mjs";

const root = process.cwd();
const fakeAcpx = path.join(root, "tests", "fixtures", "fake-acpx.mjs");

function launcher() {
  return {
    command: process.execPath,
    args: [fakeAcpx],
  };
}

test("acpx fanout writes manifest and summary for successful roles", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-acpx-fanout-"));
  const outputDir = path.join(tempDir, "run");

  const result = await runFanoutRequest(
    {
      run_id: "fanout-success",
      cwd: root,
      output_dir: outputDir,
      task: "Implement, review, and document feature X",
      launcher: launcher(),
    },
    { rootDir: root }
  );

  const manifest = readJson(path.join(outputDir, "manifest.json"));
  const summary = readFileSync(path.join(outputDir, "summary.md"), "utf8");

  assert.equal(result.roles.length, 3);
  assert.equal(manifest.roles.length, 3);
  assert.equal(summary.includes("impl"), true);
  assert.equal(summary.includes("review"), true);
  assert.equal(summary.includes("docs"), true);
});

test("acpx fanout preserves partial failures", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-acpx-fanout-"));
  const outputDir = path.join(tempDir, "run");

  const result = await runFanoutRequest(
    {
      run_id: "fanout-partial-failure",
      cwd: root,
      output_dir: outputDir,
      task: "Implement, review, and document feature Y",
      launcher: launcher(),
      roles: [
        {
          role: "impl",
          agent: "codex",
          mode: "exec",
          prompt_template: "Implement: {{task}}",
        },
        {
          role: "review",
          agent: "claude",
          mode: "exec",
          prompt_template: "Review: {{task}}",
          launcher: {
            ...launcher(),
            env: {
              FAKE_ACPX_FAIL_AGENT: "claude",
            },
          },
        },
      ],
    },
    { rootDir: root }
  );

  assert.equal(existsSync(path.join(outputDir, "summary.md")), true);
  assert.equal(result.roles.length, 2);

  const failureResult = readJson(path.join(outputDir, "review", "result.json"));
  assert.equal(failureResult.ok, false);
});
