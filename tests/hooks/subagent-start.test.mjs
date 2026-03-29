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
const hookPath = path.join(root, "hooks", "subagent-start.mjs");

function makeTempDataDir() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-subagent-start-"));
  mkdirSync(path.join(tempDir, "state"), { recursive: true });
  return tempDir;
}

function runHook(tempDir, payload) {
  return spawnSync(process.execPath, [hookPath], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: tempDir,
    },
    input: payload === undefined ? "" : JSON.stringify(payload),
    encoding: "utf8",
  });
}

function readAggregation(tempDir) {
  return JSON.parse(
    readFileSync(path.join(tempDir, "state", "review-aggregation.json"), "utf8")
  );
}

function writeAggregation(tempDir, state) {
  writeFileSync(
    path.join(tempDir, "state", "review-aggregation.json"),
    JSON.stringify(state, null, 2)
  );
}

function parseOutput(result) {
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

test("subagent start exits quietly for unknown subagents", () => {
  const tempDir = makeTempDataDir();
  const result = runHook(tempDir, { subagent_name: "draft-writer" });

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(
    existsSync(path.join(tempDir, "state", "review-aggregation.json")),
    false
  );
});

test("subagent start creates a safety-net aggregation file for reviewers", () => {
  const tempDir = makeTempDataDir();
  const result = runHook(tempDir, { subagent_name: "fact-checker" });

  // CI debug: if hook fails silently, capture stderr
  if (!existsSync(path.join(tempDir, "state", "review-aggregation.json"))) {
    assert.fail(
      `Hook did not create aggregation file.\n` +
      `exit: ${result.status}\n` +
      `stderr: ${(result.stderr || "").slice(0, 500)}\n` +
      `stdout: ${(result.stdout || "").slice(0, 300)}`
    );
  }

  assert.equal(result.status, 0);

  const aggregation = readAggregation(tempDir);
  assert.equal(aggregation.expected_reviewers, 3);
  assert.equal(aggregation.threshold, 0.67);
  assert.deepEqual(aggregation.reviewers, []);
  assert.equal(aggregation.started_reviewers.length, 1);
  assert.equal(aggregation.started_reviewers[0].name, "fact-checker");

  const output = parseOutput(result);
  assert.match(
    output.hookSpecificOutput.additionalContext,
    /\[REVIEW START\] fact-checker started \(1\/3 dispatched\)\./
  );
  assert.match(
    output.hookSpecificOutput.additionalContext,
    /Use WebSearch and WebFetch to verify every claim/
  );
});

test("subagent start injects SOUL guidance for tone-guardian when SOUL.md exists", () => {
  const tempDir = makeTempDataDir();
  const soulDir = path.join(tempDir, "soul");

  mkdirSync(soulDir, { recursive: true });
  writeFileSync(path.join(soulDir, "SOUL.md"), "# Tone Rules\n");

  const result = runHook(tempDir, { subagent_name: "tone-guardian" });
  const output = parseOutput(result);

  assert.equal(result.status, 0);
  assert.match(output.hookSpecificOutput.additionalContext, /tone-guardian started/);
  assert.match(
    output.hookSpecificOutput.additionalContext,
    /SOUL\.md found at \.data\/soul\/SOUL\.md/
  );
});

test("subagent start does not duplicate started reviewers on retry", () => {
  const tempDir = makeTempDataDir();

  writeAggregation(tempDir, {
    started_at: "2026-03-28T00:00:00.000Z",
    expected_reviewers: 3,
    threshold: 0.67,
    reviewers: [],
    started_reviewers: [
      {
        name: "deep-reviewer",
        started_at: "2026-03-28T00:01:00.000Z",
      },
    ],
  });

  const result = runHook(tempDir, { subagent_name: "deep-reviewer" });
  const aggregation = readAggregation(tempDir);

  assert.equal(result.status, 0);
  assert.equal(aggregation.started_reviewers.length, 1);
  assert.deepEqual(aggregation.started_reviewers[0], {
    name: "deep-reviewer",
    started_at: "2026-03-28T00:01:00.000Z",
  });
});

test("subagent start grows expected reviewer count when more reviewers are dispatched", () => {
  const tempDir = makeTempDataDir();

  writeAggregation(tempDir, {
    started_at: "2026-03-28T00:00:00.000Z",
    expected_reviewers: 1,
    threshold: 0.67,
    reviewers: [],
    started_reviewers: [
      {
        name: "deep-reviewer",
        started_at: "2026-03-28T00:01:00.000Z",
      },
    ],
  });

  const result = runHook(tempDir, { subagent_name: "devil-advocate" });
  const aggregation = readAggregation(tempDir);
  const output = parseOutput(result);

  assert.equal(aggregation.expected_reviewers, 2);
  assert.equal(aggregation.started_reviewers.length, 2);
  assert.match(
    output.hookSpecificOutput.additionalContext,
    /\[REVIEW START\] devil-advocate started \(2\/2 dispatched\)\./
  );
});

test("subagent start infers the quick preset threshold from the reviewer pair", () => {
  const tempDir = makeTempDataDir();

  writeAggregation(tempDir, {
    started_at: "2026-03-28T00:00:00.000Z",
    expected_reviewers: 3,
    threshold: 0.67,
    reviewers: [],
    started_reviewers: [
      {
        name: "devil-advocate",
        started_at: "2026-03-28T00:01:00.000Z",
      },
    ],
  });

  const result = runHook(tempDir, { subagent_name: "fact-checker" });
  const aggregation = readAggregation(tempDir);
  const output = parseOutput(result);

  assert.equal(result.status, 0);
  assert.equal(aggregation.expected_reviewers, 2);
  assert.equal(aggregation.threshold, 1);
  assert.equal(aggregation.preset, "quick");
  assert.match(
    output.hookSpecificOutput.additionalContext,
    /\[REVIEW START\] fact-checker started \(2\/2 dispatched\)\./
  );
});

test("subagent start identifies reviewers from alternate payload fields", () => {
  const tempDir = makeTempDataDir();
  const result = runHook(tempDir, { agent_name: "deep-reviewer" });
  const aggregation = readAggregation(tempDir);

  assert.equal(result.status, 0);
  assert.equal(aggregation.started_reviewers.length, 1);
  assert.equal(aggregation.started_reviewers[0].name, "deep-reviewer");
});
