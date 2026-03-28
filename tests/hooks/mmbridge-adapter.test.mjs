import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  MmBridgeCliAdapter,
  MmBridgeStubAdapter,
  MmBridgeRecordingAdapter,
} from "../../hooks/lib/mmbridge-adapter.mjs";

function makeTempDir() {
  return mkdtempSync(path.join(os.tmpdir(), "second-claude-mmbridge-"));
}

function readJsonl(filePath) {
  return readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("StubAdapter returns configured review response", async () => {
  const adapter = new MmBridgeStubAdapter({
    review: {
      response: {
        status: "ok",
        findings: [{ title: "Issue A" }],
        summary: "review summary",
        score: 91,
      },
    },
  });

  const result = await adapter.review({ scope: "all" });

  assert.equal(result.status, "ok");
  assert.equal(result.summary, "review summary");
  assert.equal(result.score, 91);
  assert.deepEqual(result.findings, [{ title: "Issue A" }]);
});

test("StubAdapter returns configured gate response", async () => {
  const adapter = new MmBridgeStubAdapter({
    gate: {
      response: {
        status: "fail",
        warnings: ["coverage gap"],
      },
    },
  });

  const result = await adapter.gate({ mode: "review" });

  assert.equal(result.status, "fail");
  assert.deepEqual(result.warnings, ["coverage gap"]);
});

test("StubAdapter returns configured embrace response", async () => {
  const adapter = new MmBridgeStubAdapter({
    embrace: {
      response: {
        overallScore: 88,
        recommendations: ["Ship after one more pass"],
      },
    },
  });

  const result = await adapter.embrace({ topic: "adapter" });

  assert.equal(result.overallScore, 88);
  assert.deepEqual(result.recommendations, ["Ship after one more pass"]);
});

test("StubAdapter returns protocol defaults when no response is configured", async () => {
  const adapter = new MmBridgeStubAdapter();

  const review = await adapter.review({});
  const gate = await adapter.gate({});
  const embrace = await adapter.embrace({});

  assert.deepEqual(review, {
    status: "stub",
    findings: [],
    summary: "",
    score: null,
  });
  assert.deepEqual(gate, {
    status: "warn",
    warnings: [],
  });
  assert.deepEqual(embrace, {
    overallScore: null,
    recommendations: [],
  });
});

test("StubAdapter can simulate review errors", async () => {
  const adapter = new MmBridgeStubAdapter({
    review: {
      error: new Error("stub review failed"),
    },
  });

  await assert.rejects(() => adapter.review({}), /stub review failed/);
});

test("StubAdapter can simulate gate timeouts", async () => {
  const adapter = new MmBridgeStubAdapter({
    gate: {
      timeout: true,
      message: "gate timed out",
    },
  });

  await assert.rejects(
    () => adapter.gate({}),
    (error) => error.name === "TimeoutError" && /gate timed out/.test(error.message)
  );
});

test("RecordingAdapter records delegated review responses to JSONL", async () => {
  const dir = makeTempDir();
  const recordingPath = path.join(dir, "recording.jsonl");
  const adapter = new MmBridgeRecordingAdapter({
    adapter: new MmBridgeStubAdapter({
      review: {
        response: {
          status: "ok",
          findings: [{ id: "F-1" }],
          summary: "captured",
          score: 72,
        },
      },
    }),
    recordingPath,
  });

  const result = await adapter.review({ prompt: "audit" });

  assert.equal(result.summary, "captured");
  assert.ok(existsSync(recordingPath));
  const entries = readJsonl(recordingPath);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].method, "review");
  assert.deepEqual(entries[0].options, { prompt: "audit" });
  assert.equal(entries[0].result.summary, "captured");
});

test("RecordingAdapter records multiple methods in call order", async () => {
  const dir = makeTempDir();
  const recordingPath = path.join(dir, "recording.jsonl");
  const adapter = new MmBridgeRecordingAdapter({
    adapter: new MmBridgeStubAdapter({
      review: { response: { status: "ok", findings: [], summary: "r1", score: 10 } },
      gate: { response: { status: "pass", warnings: [] } },
      embrace: { response: { overallScore: 99, recommendations: ["keep"] } },
    }),
    recordingPath,
  });

  await adapter.review({ id: 1 });
  await adapter.gate({ id: 2 });
  await adapter.embrace({ id: 3 });

  const entries = readJsonl(recordingPath);
  assert.deepEqual(
    entries.map((entry) => entry.method),
    ["review", "gate", "embrace"]
  );
});

test("RecordingAdapter replays recorded review responses without a delegate", async () => {
  const dir = makeTempDir();
  const recordingPath = path.join(dir, "recording.jsonl");
  const recorder = new MmBridgeRecordingAdapter({
    adapter: new MmBridgeStubAdapter({
      review: {
        response: {
          status: "ok",
          findings: [{ title: "Persisted" }],
          summary: "from disk",
          score: 64,
        },
      },
    }),
    recordingPath,
  });

  await recorder.review({ prompt: "first" });

  const replay = new MmBridgeRecordingAdapter({
    mode: "replay",
    recordingPath,
  });

  const result = await replay.review({ prompt: "ignored in replay mode" });

  assert.equal(result.summary, "from disk");
  assert.deepEqual(result.findings, [{ title: "Persisted" }]);
});

test("RecordingAdapter replays entries sequentially for the same method", async () => {
  const dir = makeTempDir();
  const recordingPath = path.join(dir, "recording.jsonl");
  const recorder = new MmBridgeRecordingAdapter({
    adapter: new MmBridgeStubAdapter({
      review: { response: { status: "ok", findings: [], summary: "first", score: 1 } },
    }),
    recordingPath,
  });

  await recorder.review({ seq: 1 });
  recorder.adapter = new MmBridgeStubAdapter({
    review: { response: { status: "ok", findings: [], summary: "second", score: 2 } },
  });
  await recorder.review({ seq: 2 });

  const replay = new MmBridgeRecordingAdapter({
    mode: "replay",
    recordingPath,
  });

  const first = await replay.review({});
  const second = await replay.review({});

  assert.equal(first.summary, "first");
  assert.equal(second.summary, "second");
});

test("RecordingAdapter throws when replay data is exhausted", async () => {
  const dir = makeTempDir();
  const recordingPath = path.join(dir, "recording.jsonl");
  const recorder = new MmBridgeRecordingAdapter({
    adapter: new MmBridgeStubAdapter({
      gate: { response: { status: "pass", warnings: [] } },
    }),
    recordingPath,
  });

  await recorder.gate({});

  const replay = new MmBridgeRecordingAdapter({
    mode: "replay",
    recordingPath,
  });

  await replay.gate({});
  await assert.rejects(() => replay.gate({}), /No recorded mmbridge response/);
});

test("CliAdapter parses review JSON and appends --json flag", async () => {
  let invocation;
  const adapter = new MmBridgeCliAdapter({
    runner: async (command, args, options) => {
      invocation = { command, args, options };
      return JSON.stringify({
        status: "ok",
        findings: [{ id: "C-1" }],
        summary: "cli review",
        score: 87,
      });
    },
  });

  const result = await adapter.review({ scope: "auth", staged: true });

  assert.equal(result.summary, "cli review");
  assert.equal(invocation.command, "mmbridge");
  assert.equal(invocation.args[0], "review");
  assert.ok(invocation.args.includes("--json"));
  assert.ok(invocation.args.includes("--scope"));
  assert.ok(invocation.args.includes("--staged"));
  assert.equal(typeof invocation.options.timeoutMs, "number");
});

test("CliAdapter parses gate JSON", async () => {
  const adapter = new MmBridgeCliAdapter({
    runner: async () =>
      JSON.stringify({
        status: "pass",
        warnings: ["one advisory"],
      }),
  });

  const result = await adapter.gate({ mode: "review" });

  assert.deepEqual(result, {
    status: "pass",
    warnings: ["one advisory"],
  });
});

test("CliAdapter parses embrace JSON", async () => {
  const adapter = new MmBridgeCliAdapter({
    runner: async () =>
      JSON.stringify({
        overallScore: 93,
        recommendations: ["keep external review"],
      }),
  });

  const result = await adapter.embrace({ topic: "plugin" });

  assert.deepEqual(result, {
    overallScore: 93,
    recommendations: ["keep external review"],
  });
});

test("CliAdapter handles missing mmbridge gracefully", async () => {
  const adapter = new MmBridgeCliAdapter({
    runner: async () => {
      const error = new Error("spawn mmbridge ENOENT");
      error.code = "ENOENT";
      throw error;
    },
  });

  const result = await adapter.review({ scope: "all" });

  assert.deepEqual(result, {
    status: "skipped",
    findings: [],
    summary: "",
    score: null,
  });
});

test("CliAdapter degrades to warn on gate parse failures", async () => {
  const adapter = new MmBridgeCliAdapter({
    runner: async () => "{not-json",
  });

  const result = await adapter.gate({ mode: "security" });

  assert.equal(result.status, "warn");
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /parse/i);
});

test("CliAdapter degrades to empty embrace response on runner failures", async () => {
  const adapter = new MmBridgeCliAdapter({
    runner: async () => {
      const error = new Error("process failed");
      error.code = 1;
      throw error;
    },
  });

  const result = await adapter.embrace({ path: "." });

  assert.deepEqual(result, {
    overallScore: null,
    recommendations: [],
  });
});
