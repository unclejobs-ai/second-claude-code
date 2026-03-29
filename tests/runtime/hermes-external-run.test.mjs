import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { runHermesExternalRequest } from "../../scripts/hermes-external-run.mjs";

const root = process.cwd();
const fakeAcpx = path.join(root, "tests", "fixtures", "fake-acpx.mjs");

function launcher(env = {}) {
  return {
    command: process.execPath,
    args: [fakeAcpx],
    env,
  };
}

test("hermes external run executes fanout and mmbridge quality checks", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-hermes-run-"));
  const outputDir = path.join(tempDir, "run");
  const mmbridgeAdapter = {
    async review() {
      return {
        status: "ok",
        findings: [{ id: "R-1" }],
        summary: "mmbridge review ok",
        score: 88,
      };
    },
    async gate() {
      return {
        status: "warn",
        warnings: ["one warning"],
      };
    },
  };

  const result = await runHermesExternalRequest(
    {
      run_id: "hermes-external-ok",
      cwd: root,
      output_dir: outputDir,
      task: "Implement and validate feature Z",
      acpx: {
        launcher: launcher(),
      },
    },
    {
      rootDir: root,
      mmbridgeAdapter,
    }
  );

  const summary = readFileSync(path.join(outputDir, "summary.md"), "utf8");
  assert.equal(result.mmbridge.skipped, false);
  assert.equal(existsSync(path.join(outputDir, "mmbridge-review.json")), true);
  assert.equal(existsSync(path.join(outputDir, "mmbridge-gate.json")), true);
  assert.match(summary, /MMBridge/);
  assert.match(summary, /warn/);
});

test("hermes external run skips mmbridge when impl fails", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-hermes-run-"));
  const outputDir = path.join(tempDir, "run");
  let called = false;
  const mmbridgeAdapter = {
    async review() {
      called = true;
      return { status: "ok", findings: [], summary: "", score: null };
    },
    async gate() {
      called = true;
      return { status: "pass", warnings: [] };
    },
  };

  const result = await runHermesExternalRequest(
    {
      run_id: "hermes-external-fail",
      cwd: root,
      output_dir: outputDir,
      task: "Implement and validate feature W",
      acpx: {
        roles: [
          {
            role: "impl",
            agent: "codex",
            mode: "exec",
            prompt_template: "Implement: {{task}}",
            launcher: launcher({
              FAKE_ACPX_FAIL_AGENT: "codex",
            }),
          },
          {
            role: "review",
            agent: "claude",
            mode: "exec",
            prompt_template: "Review: {{task}}",
            launcher: launcher(),
          },
        ],
      },
    },
    {
      rootDir: root,
      mmbridgeAdapter,
    }
  );

  assert.equal(result.mmbridge.skipped, true);
  assert.equal(result.mmbridge.reason, "impl failed");
  assert.equal(called, false);
});
