import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourcePath = path.join(root, "mcp", "lib", "loop-handlers.mjs");
const sourceUrl = pathToFileURL(sourcePath).href;

function makeTempDir(prefix = "second-claude-loop-") {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function loadHandlers(dataDir) {
  process.env.CLAUDE_PLUGIN_DATA = dataDir;
  return import(`${sourceUrl}?t=${Date.now()}-${Math.random()}`);
}

function writeRunFile(dataDir, runId, content = "") {
  const eventsDir = path.join(dataDir, "events");
  mkdirSync(eventsDir, { recursive: true });
  writeFileSync(path.join(eventsDir, `pdca-${runId}.jsonl`), content, "utf8");
}

describe("loop handlers", () => {
  test("handleListRunIds returns an empty array when the data dir does not exist", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "missing-data");

    try {
      const handlers = await loadHandlers(dataDir);
      const result = handlers.handleListRunIds();

      assert.ok(Array.isArray(result));
      assert.deepEqual(result, []);
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleListRunIds returns an empty array when the events dir exists but has no logs", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "data");
    mkdirSync(path.join(dataDir, "events"), { recursive: true });

    try {
      const handlers = await loadHandlers(dataDir);
      assert.deepEqual(handlers.handleListRunIds(), []);
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleListRunIds returns existing run IDs from PDCA event logs", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "data");
    writeRunFile(dataDir, "run-alpha");
    writeRunFile(dataDir, "run.beta_2");

    try {
      const handlers = await loadHandlers(dataDir);
      const result = handlers.handleListRunIds().sort();

      assert.deepEqual(result, ["run-alpha", "run.beta_2"]);
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleListRunIds ignores files that are not PDCA run logs", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "data");
    const eventsDir = path.join(dataDir, "events");
    mkdirSync(eventsDir, { recursive: true });
    writeRunFile(dataDir, "run-1");
    writeFileSync(path.join(eventsDir, "notes.txt"), "ignore", "utf8");
    writeFileSync(path.join(eventsDir, "other-run.json"), "ignore", "utf8");
    writeFileSync(path.join(eventsDir, "pdca-run-2.json"), "ignore", "utf8");

    try {
      const handlers = await loadHandlers(dataDir);
      assert.deepEqual(handlers.handleListRunIds(), ["run-1"]);
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
