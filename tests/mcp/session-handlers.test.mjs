import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourcePath = path.join(root, "mcp", "lib", "session-handlers.mjs");
const sourceUrl = pathToFileURL(sourcePath).href;

function makeTempDir(prefix = "second-claude-session-") {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function loadHandlers(dataDir) {
  process.env.CLAUDE_PLUGIN_DATA = dataDir;
  return import(`${sourceUrl}?t=${Date.now()}-${Math.random()}`);
}

async function loadStubbedHandlers(dataDir, responses) {
  const sandboxDir = makeTempDir("second-claude-session-stub-");
  const stubPath = path.join(sandboxDir, "companion-daemon-stub.mjs");
  const handlerPath = path.join(sandboxDir, "session-handlers.mjs");

  const source = readFileSync(sourcePath, "utf8").replace(
    "../../hooks/lib/companion-daemon.mjs",
    "./companion-daemon-stub.mjs"
  );

  const stubSource = `
export const calls = [];
const responses = ${JSON.stringify(responses, null, 2)};

export function searchSessionRecall(...args) {
  calls.push({ name: "searchSessionRecall", args });
  return responses.searchSessionRecall;
}
`;

  writeFileSync(stubPath, stubSource, "utf8");
  writeFileSync(handlerPath, source, "utf8");

  process.env.CLAUDE_PLUGIN_DATA = dataDir;
  const handlers = await import(`${pathToFileURL(handlerPath).href}?t=${Date.now()}-${Math.random()}`);
  const stub = await import(pathToFileURL(stubPath).href);
  return { handlers, stub, sandboxDir };
}

function appendRecallEntry(dataDir, entry) {
  const recallDir = path.join(dataDir, "daemon", "recall");
  mkdirSync(recallDir, { recursive: true });
  appendFileSync(path.join(recallDir, "index.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
}

describe("session handlers", () => {
  test("handleSessionRecallSearch delegates to searchSessionRecall with the default limit", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "custom-data");
    const response = { entries: [{ session_id: "s1" }], total: 1 };

    try {
      const { handlers, stub, sandboxDir } = await loadStubbedHandlers(dataDir, {
        searchSessionRecall: response,
      });

      try {
        assert.deepEqual(handlers.handleSessionRecallSearch({ query: "digest" }), response);
        assert.deepEqual(stub.calls, [
          {
            name: "searchSessionRecall",
            args: [dataDir, { query: "digest", limit: 5 }],
          },
        ]);
      } finally {
        rmSync(sandboxDir, { recursive: true, force: true });
      }
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleSessionRecallSearch forwards an explicit limit to searchSessionRecall", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "custom-data");
    const response = { entries: [{ session_id: "s2" }], total: 1 };

    try {
      const { handlers, stub, sandboxDir } = await loadStubbedHandlers(dataDir, {
        searchSessionRecall: response,
      });

      try {
        assert.deepEqual(
          handlers.handleSessionRecallSearch({ query: "ops", limit: 2 }),
          response
        );
        assert.deepEqual(stub.calls, [
          {
            name: "searchSessionRecall",
            args: [dataDir, { query: "ops", limit: 2 }],
          },
        ]);
      } finally {
        rmSync(sandboxDir, { recursive: true, force: true });
      }
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleSessionRecallSearch returns a valid structure for an empty query when recall data is absent", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "missing-data");

    try {
      const handlers = await loadHandlers(dataDir);
      const result = handlers.handleSessionRecallSearch({ query: "" });
      // May include mmbridge context-tree entries from ~/.mmbridge/ even with empty dataDir
      assert.ok(Array.isArray(result.entries), "entries should be an array");
      assert.equal(typeof result.total, "number", "total should be a number");
      assert.ok(
        result.total >= result.entries.length,
        "total should cover the returned page of entries"
      );
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("handleSessionRecallSearch respects the limit and query filter with real recall data", async () => {
    const tempRoot = makeTempDir();
    const dataDir = path.join(tempRoot, "data");

    appendRecallEntry(dataDir, {
      session_id: "session-1",
      topic: "Weekly digest",
      workflow_name: "weekly-digest",
      summary: "digest summary 1",
      tags: ["digest"],
      created_at: "2026-03-28T10:00:00.000Z",
    });
    appendRecallEntry(dataDir, {
      session_id: "session-2",
      topic: "Weekly digest",
      workflow_name: "weekly-digest",
      summary: "digest summary 2",
      tags: ["digest"],
      created_at: "2026-03-28T11:00:00.000Z",
    });
    appendRecallEntry(dataDir, {
      session_id: "session-3",
      topic: "Bug triage",
      workflow_name: "triage",
      summary: "triage summary",
      tags: ["bugs"],
      created_at: "2026-03-28T12:00:00.000Z",
    });

    try {
      const handlers = await loadHandlers(dataDir);
      const result = handlers.handleSessionRecallSearch({ query: "digest", limit: 1 });

      assert.equal(result.total, 2);
      assert.equal(result.entries.length, 1);
      assert.equal(result.entries[0].session_id, "session-2");
    } finally {
      delete process.env.CLAUDE_PLUGIN_DATA;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
