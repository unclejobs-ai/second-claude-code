import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const modulePath = path.join(root, "mcp", "lib", "soul-handlers.mjs");

async function loadHandlers(dataDir) {
  process.env.CLAUDE_PLUGIN_DATA = dataDir;
  return import(`${pathToFileURL(modulePath).href}?t=${Date.now()}-${Math.random()}`);
}

function makeTempDir() {
  return mkdtempSync(path.join(os.tmpdir(), "second-claude-soul-"));
}

function writeObservationFile(dataDir, date, lines) {
  const dir = path.join(dataDir, "soul", "observations");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${date}.jsonl`), lines.join("\n") + "\n", "utf8");
}

test("handleSoulGetProfile returns nulls when soul files are absent", async () => {
  const dataDir = makeTempDir();

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetProfile();

    assert.equal(result.profile, null);
    assert.equal(result.metadata, null);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetProfile returns profile markdown and metadata", async () => {
  const dataDir = makeTempDir();
  const soulDir = path.join(dataDir, "soul");
  mkdirSync(soulDir, { recursive: true });
  writeFileSync(path.join(soulDir, "SOUL.md"), "# Soul\nProfile text", "utf8");
  writeFileSync(
    path.join(soulDir, "soul-active.json"),
    JSON.stringify({ voice: "mentor", updated_at: "2026-03-28T00:00:00.000Z" }),
    "utf8"
  );

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetProfile();

    assert.match(result.profile, /Profile text/);
    assert.deepEqual(result.metadata, {
      voice: "mentor",
      updated_at: "2026-03-28T00:00:00.000Z",
    });
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetProfile throws when soul metadata JSON is invalid", async () => {
  const dataDir = makeTempDir();
  const soulDir = path.join(dataDir, "soul");
  mkdirSync(soulDir, { recursive: true });
  writeFileSync(path.join(soulDir, "soul-active.json"), "{bad", "utf8");

  try {
    const handlers = await loadHandlers(dataDir);
    assert.throws(() => handlers.handleSoulGetProfile(), /Failed to parse soul-active\.json/);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulRecordObservation requires a non-empty signal", async () => {
  const dataDir = makeTempDir();

  try {
    const handlers = await loadHandlers(dataDir);
    assert.throws(
      () => handlers.handleSoulRecordObservation({ signal: "   ", category: "style" }),
      /signal must be a non-empty string/
    );
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulRecordObservation requires a non-empty category", async () => {
  const dataDir = makeTempDir();

  try {
    const handlers = await loadHandlers(dataDir);
    assert.throws(
      () => handlers.handleSoulRecordObservation({ signal: "tone drift", category: "" }),
      /category must be a non-empty string/
    );
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulRecordObservation writes a JSONL observation file", async () => {
  const dataDir = makeTempDir();

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulRecordObservation({
      signal: "voice mismatch",
      category: "style",
      confidence: 0.66,
      raw_context: "some context",
    });

    assert.equal(result.recorded, true);
    assert.ok(result.file.endsWith(".jsonl"));
    const stored = JSON.parse(readFileSync(result.file, "utf8").trim());
    assert.equal(stored.signal, "voice mismatch");
    assert.equal(stored.category, "style");
    assert.equal(stored.confidence, 0.66);
    assert.equal(stored.raw_context, "some context");
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulRecordObservation trims fields, defaults confidence, and truncates raw context", async () => {
  const dataDir = makeTempDir();

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulRecordObservation({
      signal: "  reflective tone  ",
      category: "  voice  ",
      raw_context: "x".repeat(260),
    });

    const stored = JSON.parse(readFileSync(result.file, "utf8").trim());
    assert.equal(stored.signal, "reflective tone");
    assert.equal(stored.category, "voice");
    assert.equal(stored.confidence, 0.8);
    assert.equal(stored.raw_context.length, 200);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetObservations returns empty results when the observation directory is missing", async () => {
  const dataDir = makeTempDir();

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetObservations({});

    assert.deepEqual(result, { observations: [], total: 0 });
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetObservations returns newest observations first", async () => {
  const dataDir = makeTempDir();
  writeObservationFile(dataDir, "2026-03-27", [
    JSON.stringify({ ts: "2026-03-27T08:00:00.000Z", signal: "older", category: "style" }),
  ]);
  writeObservationFile(dataDir, "2026-03-28", [
    JSON.stringify({ ts: "2026-03-28T09:00:00.000Z", signal: "newer", category: "style" }),
  ]);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetObservations({});

    assert.equal(result.total, 2);
    assert.equal(result.observations[0].signal, "newer");
    assert.equal(result.observations[1].signal, "older");
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetObservations filters by category", async () => {
  const dataDir = makeTempDir();
  writeObservationFile(dataDir, "2026-03-28", [
    JSON.stringify({ ts: "2026-03-28T01:00:00.000Z", signal: "tone", category: "style" }),
    JSON.stringify({ ts: "2026-03-28T02:00:00.000Z", signal: "memory", category: "behavior" }),
  ]);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetObservations({ category: "behavior" });

    assert.equal(result.total, 1);
    assert.equal(result.observations[0].signal, "memory");
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetObservations filters by date range", async () => {
  const dataDir = makeTempDir();
  writeObservationFile(dataDir, "2026-03-26", [
    JSON.stringify({ ts: "2026-03-26T01:00:00.000Z", signal: "skip-me", category: "style" }),
  ]);
  writeObservationFile(dataDir, "2026-03-27", [
    JSON.stringify({ ts: "2026-03-27T01:00:00.000Z", signal: "include-me", category: "style" }),
  ]);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetObservations({
      date_from: "2026-03-27",
      date_to: "2026-03-27",
    });

    assert.equal(result.total, 1);
    assert.equal(result.observations[0].signal, "include-me");
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetObservations skips malformed JSONL lines", async () => {
  const dataDir = makeTempDir();
  writeObservationFile(dataDir, "2026-03-28", [
    '{"ts":"2026-03-28T01:00:00.000Z","signal":"good","category":"style"}',
    "{bad",
  ]);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetObservations({});

    assert.equal(result.total, 1);
    assert.equal(result.observations[0].signal, "good");
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetObservations skips files that cannot be read", async () => {
  const dataDir = makeTempDir();
  const obsDir = path.join(dataDir, "soul", "observations");
  mkdirSync(obsDir, { recursive: true });
  mkdirSync(path.join(obsDir, "2026-03-28.jsonl"));
  writeObservationFile(dataDir, "2026-03-29", [
    JSON.stringify({ ts: "2026-03-29T01:00:00.000Z", signal: "good", category: "style" }),
  ]);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetObservations({});

    assert.equal(result.total, 1);
    assert.equal(result.observations[0].signal, "good");
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetObservations applies the provided limit", async () => {
  const dataDir = makeTempDir();
  writeObservationFile(dataDir, "2026-03-28", [
    JSON.stringify({ ts: "2026-03-28T03:00:00.000Z", signal: "third", category: "style" }),
    JSON.stringify({ ts: "2026-03-28T02:00:00.000Z", signal: "second", category: "style" }),
    JSON.stringify({ ts: "2026-03-28T01:00:00.000Z", signal: "first", category: "style" }),
  ]);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetObservations({ limit: 2 });

    assert.equal(result.total, 3);
    assert.equal(result.observations.length, 2);
    assert.deepEqual(
      result.observations.map((item) => item.signal),
      ["third", "second"]
    );
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetObservations honors numeric string limits", async () => {
  const dataDir = makeTempDir();
  writeObservationFile(dataDir, "2026-03-28", [
    JSON.stringify({ ts: "2026-03-28T02:00:00.000Z", signal: "keep", category: "style" }),
    JSON.stringify({ ts: "2026-03-28T01:00:00.000Z", signal: "drop", category: "style" }),
  ]);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetObservations({ limit: "1" });

    assert.equal(result.total, 2);
    assert.equal(result.observations.length, 1);
    assert.equal(result.observations[0].signal, "keep");
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});
