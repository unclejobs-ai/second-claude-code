import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
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

// ---------------------------------------------------------------------------
// handleSoulGetReadiness
// ---------------------------------------------------------------------------

test("handleSoulGetReadiness returns not-ready when no observations exist", async () => {
  const dataDir = makeTempDir();

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetReadiness();

    assert.equal(result.ready, false);
    assert.equal(result.observation_count, 0);
    assert.equal(result.session_count, 0);
    assert.equal(result.observation_shortfall, 30);
    assert.equal(result.session_shortfall, 10);
    assert.equal(result.proposal_due, false);
    assert.ok(result.recommendation.includes("30"));
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetReadiness detects readiness via observation threshold", async () => {
  const dataDir = makeTempDir();
  const lines = [];
  for (let i = 0; i < 30; i++) {
    lines.push(JSON.stringify({
      ts: `2026-03-28T${String(i).padStart(2, "0")}:00:00.000Z`,
      signal: `sig-${i}`,
      category: "style",
      session_id: `session-${i % 5}`,
    }));
  }
  writeObservationFile(dataDir, "2026-03-28", lines);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetReadiness();

    assert.equal(result.ready, true);
    assert.equal(result.observation_count, 30);
    assert.equal(result.session_count, 5);
    assert.equal(result.observation_shortfall, 0);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetReadiness detects readiness via session threshold", async () => {
  const dataDir = makeTempDir();
  const lines = [];
  for (let i = 0; i < 15; i++) {
    lines.push(JSON.stringify({
      ts: `2026-03-28T${String(i).padStart(2, "0")}:00:00.000Z`,
      signal: `sig-${i}`,
      category: "correction",
      session_id: `session-${i}`,
    }));
  }
  writeObservationFile(dataDir, "2026-03-28", lines);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetReadiness();

    assert.equal(result.ready, true);
    assert.equal(result.session_count, 15);
    assert.equal(result.session_shortfall, 0);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetReadiness detects learning mode and proposal_due", async () => {
  const dataDir = makeTempDir();
  const soulDir = path.join(dataDir, "soul");
  mkdirSync(soulDir, { recursive: true });
  writeFileSync(
    path.join(soulDir, "soul-active.json"),
    JSON.stringify({ mode: "hybrid", proposal_due: true, observation_count: 30 }),
    "utf8"
  );

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetReadiness();

    assert.equal(result.learning_active, true);
    assert.equal(result.proposal_due, true);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// handleSoulGetSynthesisContext
// ---------------------------------------------------------------------------

test("handleSoulGetSynthesisContext returns structured context with readiness gap", async () => {
  const dataDir = makeTempDir();
  writeObservationFile(dataDir, "2026-03-28", [
    JSON.stringify({ ts: "2026-03-28T10:00:00.000Z", signal: "tone_correction", category: "correction", session_id: "session-a" }),
    JSON.stringify({ ts: "2026-03-28T11:00:00.000Z", signal: "brevity_signal", category: "emotional", session_id: "session-a" }),
  ]);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetSynthesisContext();

    assert.equal(result.observations_total, 2);
    assert.equal(result.observations_in_context, 2);
    assert.equal(result.session_count, 1);
    assert.equal(result.readiness.threshold_met, false);
    assert.equal(result.readiness.observation_shortfall, 28);
    assert.equal(result.readiness.session_shortfall, 9);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetSynthesisContext groups by recency", async () => {
  const dataDir = makeTempDir();
  // 7 different sessions: first 5 are "recent"
  const obs = [];
  for (let s = 0; s < 7; s++) {
    obs.push(JSON.stringify({
      ts: `2026-03-2${8 - s}T12:00:00.000Z`,
      signal: `sig-${s}`,
      category: "style",
      session_id: `session-${s}`,
    }));
  }
  writeObservationFile(dataDir, "2026-03-28", obs);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetSynthesisContext();

    assert.equal(result.recent_observations.length, 5);
    assert.equal(result.session_count, 7);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetSynthesisContext includes shipping entries", async () => {
  const dataDir = makeTempDir();
  writeObservationFile(dataDir, "2026-03-28", [
    JSON.stringify({ ts: "2026-03-28T10:00:00.000Z", signal: "shipping", signal_type: "shipping", category: "shipping", session_id: "retro-2026-03-28" }),
    JSON.stringify({ ts: "2026-03-28T11:00:00.000Z", signal: "style", category: "style", session_id: "session-a" }),
  ]);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetSynthesisContext();

    assert.equal(result.shipping_entries, 1);
    assert.notEqual(result.latest_shipping, null);
    assert.equal(result.latest_shipping.signal_type, "shipping");
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetSynthesisContext includes profile when SOUL.md exists", async () => {
  const dataDir = makeTempDir();
  const soulDir = path.join(dataDir, "soul");
  mkdirSync(soulDir, { recursive: true });
  writeFileSync(path.join(soulDir, "SOUL.md"), "# Soul\nTest profile content.", "utf8");

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetSynthesisContext();

    assert.ok(result.profile.includes("Test profile content"));
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulGetSynthesisContext returns null profile when SOUL.md absent", async () => {
  const dataDir = makeTempDir();

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulGetSynthesisContext();

    assert.equal(result.profile, null);
    assert.equal(result.previous_version_exists, false);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// handleSoulRetro
// ---------------------------------------------------------------------------

function initGitRepo(repoDir) {
  mkdirSync(repoDir, { recursive: true });
  execSync("git init", { cwd: repoDir, encoding: "utf8" });
  execSync("git config user.email 'test@test.test'", { cwd: repoDir, encoding: "utf8" });
  execSync("git config user.name 'Test'", { cwd: repoDir, encoding: "utf8" });

  // Create a few commits
  writeFileSync(path.join(repoDir, "file.txt"), "line 1\n", "utf8");
  execSync("git add file.txt && git commit -m 'first commit' --date='2026-03-28T10:00:00'", { cwd: repoDir, encoding: "utf8" });

  writeFileSync(path.join(repoDir, "file.txt"), "line 1\nline 2\n", "utf8");
  execSync("git add file.txt && git commit -m 'second commit' --date='2026-03-28T14:00:00'", { cwd: repoDir, encoding: "utf8" });

  writeFileSync(path.join(repoDir, "file.txt"), "line 1\nline 2\nline 3\n", "utf8");
  execSync("git add file.txt && git commit -m 'third commit' --date='2026-03-28T15:00:00'", { cwd: repoDir, encoding: "utf8" });
}

test("handleSoulRetro returns retro report for a real git repo", async () => {
  const dataDir = makeTempDir();
  // Create a test git repo outside CLAUDE_PLUGIN_DATA
  const repoDir = path.join(dataDir, "test-project");
  initGitRepo(repoDir);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulRetro({ period: "week", projects: [repoDir] });

    assert.equal(result.observation_recorded, true);
    assert.ok(result.report);
    assert.ok(result.report.summary.total_commits > 0);
    assert.ok(result.report.summary.active_days >= 1);
    assert.ok(result.report.summary.peak_hours.length >= 1);
    const projectData = result.report.by_project["test-project"];
    assert.ok(projectData);
    assert.equal(projectData.commits, 3);
    assert.ok(projectData.top_files.includes("file.txt"));
    assert.ok(result.report.commit_size_profile);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulRetro respects the period parameter", async () => {
  const dataDir = makeTempDir();
  const repoDir = path.join(dataDir, "test-project");
  initGitRepo(repoDir);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulRetro({ period: "month", projects: [repoDir] });

    assert.equal(result.observation_recorded, true);
    assert.ok(result.report.summary.total_commits > 0);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulRetro rejects invalid period", async () => {
  const dataDir = makeTempDir();

  try {
    const handlers = await loadHandlers(dataDir);
    assert.throws(
      () => handlers.handleSoulRetro({ period: "year", projects: [] }),
      /period must be one of/
    );
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulRetro handles empty projects gracefully", async () => {
  const dataDir = makeTempDir();

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulRetro({ period: "week", projects: [] });

    assert.equal(result.observation_recorded, true);
    assert.equal(result.report.summary.total_commits, 0);
    assert.equal(result.report.summary.active_days, 0);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulRetro appends a shipping observation", async () => {
  const dataDir = makeTempDir();
  const repoDir = path.join(dataDir, "test-project");
  initGitRepo(repoDir);

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulRetro({ period: "week", projects: [repoDir] });

    const today = new Date().toISOString().slice(0, 10);
    const obsFile = path.join(dataDir, "soul", "observations", `${today}.jsonl`);
    const content = readFileSync(obsFile, "utf8").trim();
    const obs = JSON.parse(content);
    assert.equal(obs.signal_type, "shipping");
    assert.ok(obs.raw_text.includes("total_commits"));
    assert.ok(result.observation_recorded);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulRetro detects trend when previous retro exists", async () => {
  const dataDir = makeTempDir();
  const repoDir = path.join(dataDir, "test-project");
  initGitRepo(repoDir);

  try {
    const handlers = await loadHandlers(dataDir);

    // First retro — no trend possible
    const r1 = handlers.handleSoulRetro({ period: "week", projects: [repoDir] });
    assert.equal(r1.trend, null);

    // Add more commits to change the commit count
    writeFileSync(path.join(repoDir, "file.txt"), "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\n", "utf8");
    execSync("git add file.txt && git commit -m 'big commit' --date='2026-03-28T16:00:00'", { cwd: repoDir, encoding: "utf8" });
    writeFileSync(path.join(repoDir, "file.txt"), "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\n", "utf8");
    execSync("git add file.txt && git commit -m 'another commit' --date='2026-03-28T17:00:00'", { cwd: repoDir, encoding: "utf8" });

    // Second retro — should detect trend
    const r2 = handlers.handleSoulRetro({ period: "week", projects: [repoDir] });
    assert.ok(r2.trend !== null);
    assert.ok(["accelerating", "steady", "decelerating"].includes(r2.trend));
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulRetro updates soul-active.json with retro metadata", async () => {
  const dataDir = makeTempDir();
  const repoDir = path.join(dataDir, "test-project");
  initGitRepo(repoDir);

  // Pre-create soul-active.json
  const soulDir = path.join(dataDir, "soul");
  mkdirSync(soulDir, { recursive: true });
  writeFileSync(path.join(soulDir, "soul-active.json"), JSON.stringify({ mode: "hybrid" }), "utf8");

  try {
    const handlers = await loadHandlers(dataDir);
    handlers.handleSoulRetro({ period: "week", projects: [repoDir] });

    const state = JSON.parse(readFileSync(path.join(soulDir, "soul-active.json"), "utf8"));
    assert.equal(state.retro_count, 1);
    assert.ok(state.last_retro);
  } finally {
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("handleSoulRetro auto-detects sibling projects when projects param omitted", async () => {
  // This test simulates auto-detection by setting SECOND_CLAUDE_CWD
  const dataDir = makeTempDir();

  // Create a mock parent structure
  const parentDir = path.join(dataDir, "parent");
  const projectDir = path.join(parentDir, "my-project");
  initGitRepo(projectDir);
  const cwdDir = path.join(parentDir, "second-claude");
  mkdirSync(cwdDir, { recursive: true });

  // Set SECOND_CLAUDE_CWD so detectProjects finds siblings
  process.env["SECOND_CLAUDE_CWD"] = cwdDir;

  try {
    const handlers = await loadHandlers(dataDir);
    const result = handlers.handleSoulRetro({ period: "week" });

    assert.equal(result.observation_recorded, true);
    const projectKeys = Object.keys(result.report.by_project);
    assert.ok(projectKeys.includes("my-project"));
  } finally {
    delete process.env.SECOND_CLAUDE_CWD;
    delete process.env.CLAUDE_PLUGIN_DATA;
    rmSync(dataDir, { recursive: true, force: true });
  }
});
