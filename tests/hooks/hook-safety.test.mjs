import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { sanitizeExternalText } from "../../hooks/lib/soul-observer.mjs";
import { compactionOwner, compactionSnapshotPath } from "../../hooks/lib/compaction-snapshot.mjs";

const root = process.cwd();
const sessionStart = path.join(root, "hooks", "session-start.mjs");
const compaction = path.join(root, "hooks", "compaction.mjs");
const reviewerStart = path.join(root, "hooks", "subagent-start.mjs");
const reviewerStop = path.join(root, "hooks", "subagent-stop.mjs");
const reviewResult = path.join(root, "hooks", "review-result.mjs");
const sessionEnd = path.join(root, "hooks", "session-end.mjs");
const stopFailure = path.join(root, "hooks", "stop-failure.mjs");
const promptDetect = path.join(root, "hooks", "prompt-detect.mjs");
const TEST_SESSION_ID = "hook-safety-session";

function compactPath(dir, sessionId = TEST_SESSION_ID) {
  return compactionSnapshotPath(
    dir,
    compactionOwner({ session_id: sessionId, project_dir: root }, {})
  );
}

function dataDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "scc-hook-safety-"));
  mkdirSync(path.join(dir, "state"), { recursive: true });
  return dir;
}

function run(script, dir, payload, extraEnv = {}) {
  return spawnSync(process.execPath, [script], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: dir,
      CLAUDE_PROJECT_DIR: root,
      CLAUDE_SESSION_ID: TEST_SESSION_ID,
      SECOND_CLAUDE_CAPABILITIES: '["node"]',
      ...extraEnv,
    },
    input: payload === undefined ? "" : JSON.stringify(payload),
    encoding: "utf8",
  });
}

function stopGuardPath(dir, sessionId) {
  const suffix = sessionId
    ? `-${createHash("sha256").update(sessionId).digest("hex")}`
    : "";
  return path.join(dir, "state", `.stop-hook-guard${suffix}`);
}

function runWithoutSession(script, dir, payload) {
  const { CLAUDE_SESSION_ID: _sessionId, ...env } = process.env;
  return spawnSync(process.execPath, [script], {
    cwd: root,
    env: {
      ...env,
      CLAUDE_PLUGIN_DATA: dir,
      CLAUDE_PROJECT_DIR: root,
      SECOND_CLAUDE_CAPABILITIES: '["node"]',
    },
    input: payload === undefined ? "" : JSON.stringify(payload),
    encoding: "utf8",
  });
}

function runAsync(script, dir, payload, sessionId) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: root,
      env: {
        ...process.env,
        CLAUDE_PLUGIN_DATA: dir,
        CLAUDE_PROJECT_DIR: root,
        CLAUDE_SESSION_ID: sessionId,
        SECOND_CLAUDE_CAPABILITIES: '["node"]',
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(JSON.stringify(payload));
  });
}

test("external hook text strips ANSI, bidi, and controls and stays bounded", () => {
  const malicious = `\u001b[31m${"x".repeat(100)}\u001b[0m\u202Ehidden\u0000\u0007`;
  const safe = sanitizeExternalText(malicious, 32);
  assert.equal(safe.length, 32);
  assert.doesNotMatch(safe, /\u001b|\u202E|\u0000|\u0007/);
});

test("all lifecycle hook entrypoints fail open on oversized stdin", () => {
  const oversized = JSON.stringify({ payload: "x".repeat(600 * 1024) });
  const scripts = [sessionStart, compaction, reviewerStart, reviewerStop, reviewResult, sessionEnd, stopFailure, promptDetect];

  for (const script of scripts) {
    const dir = dataDir();
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      env: {
        ...process.env,
        CLAUDE_PLUGIN_DATA: dir,
        CLAUDE_PROJECT_DIR: root,
        CLAUDE_SESSION_ID: "oversized-hook-session",
        SECOND_CLAUDE_CAPABILITIES: '[]',
      },
      input: oversized,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${path.basename(script)} should not fail: ${result.stderr}`);
  }
});

test("hook registry bridges completed Agent reviews into the parent session", () => {
  const registry = JSON.parse(readFileSync(path.join(root, "hooks", "hooks.json"), "utf8"));
  assert.equal(Object.keys(registry.hooks).length, 9);
  const bridge = registry.hooks.PostToolUse;
  assert.equal(bridge.length, 1);
  assert.equal(bridge[0].matcher, "Agent");
  assert.match(bridge[0].hooks[0].command, /hooks\/review-result\.mjs/);

  const stopSource = readFileSync(reviewerStop, "utf8");
  assert.doesNotMatch(stopSource, /hookEventName:\s*["']SubagentStop["']/);
  assert.doesNotMatch(stopSource, /console\.log\(JSON\.stringify/);
});

test("PostCompact leaves restoration to SessionStart(source=compact)", () => {
  const dir = dataDir();
  writeFileSync(compactPath(dir), JSON.stringify({
    owner: compactionOwner({ session_id: TEST_SESSION_ID, project_dir: root }, {}),
    pdca: { topic: "compact topic", current_phase: "check", completed: ["plan"], cycle_count: 1, max_cycles: 2 },
  }));

  const post = run(compaction, dir, { event: "PostCompact" });
  assert.equal(post.status, 0);
  assert.equal(post.stdout, "");
  assert.ok(existsSync(compactPath(dir)));

  const start = run(sessionStart, dir, { source: "compact" });
  assert.equal(start.status, 0);
  assert.match(start.stdout, /Restored State After Compression/);
  assert.match(start.stdout, /compact topic/);
  assert.equal(existsSync(compactPath(dir)), false);
});

test("compaction snapshots cannot cross session boundaries", () => {
  const dir = dataDir();
  const ownerA = compactionOwner({ session_id: "session-A", project_dir: root }, {});
  const pathA = compactionSnapshotPath(dir, ownerA);
  writeFileSync(pathA, JSON.stringify({
    owner: ownerA,
    pdca: { topic: "private session A", current_phase: "check" },
  }));

  const startB = run(
    sessionStart,
    dir,
    { source: "compact", session_id: "session-B", project_dir: root },
    { CLAUDE_SESSION_ID: "session-B" }
  );
  assert.equal(startB.status, 0);
  assert.doesNotMatch(startB.stdout, /private session A/);
  assert.ok(existsSync(pathA));

  const startA = run(
    sessionStart,
    dir,
    { source: "compact", session_id: "session-A", project_dir: root },
    { CLAUDE_SESSION_ID: "session-A" }
  );
  assert.match(startA.stdout, /private session A/);
  assert.equal(existsSync(pathA), false);
});

test("review panels are session-namespaced and cleaned by PostToolUse after consensus", () => {
  const dir = dataDir();
  const reviewers = ["deep-reviewer", "fact-checker", "structure-analyst"];
  for (const name of reviewers) {
    const started = run(reviewerStart, dir, { agent_type: name, session_id: "session-A" });
    assert.equal(started.status, 0);
  }
  const other = run(reviewerStart, dir, { agent_type: "deep-reviewer", session_id: "session-B" });
  assert.equal(other.status, 0);
  assert.ok(existsSync(path.join(dir, "state", "review-aggregation-session-A.json")));
  assert.ok(existsSync(path.join(dir, "state", "review-aggregation-session-B.json")));

  for (const name of reviewers) {
    const stopped = run(reviewerStop, dir, {
      agent_type: name,
      session_id: "session-A",
      output: `Reviewer: ${name}\nScore: 0.9\nAPPROVED`,
    });
    assert.equal(stopped.status, 0);
  }
  const bridge = run(reviewResult, dir, { hook_event_name: "PostToolUse", tool_name: "Agent", session_id: "session-A" });
  assert.equal(bridge.status, 0);
  assert.match(bridge.stdout, /CONSENSUS: APPROVED/);
  assert.equal(existsSync(path.join(dir, "state", "review-aggregation-session-A.json")), false);
  assert.ok(existsSync(path.join(dir, "state", "review-aggregation-session-B.json")));
});

test("synthetic run IDs cannot split a native session review panel", () => {
  const dir = dataDir();

  const panelAStart = run(reviewerStart, dir, {
    agent_type: "deep-reviewer",
    session_id: "same-session",
    review_run_id: "panel-a",
  });
  const panelBStart = run(reviewerStart, dir, {
    agent_type: "fact-checker",
    session_id: "same-session",
    review_run_id: "panel-b",
  });

  assert.equal(panelAStart.status, 0);
  assert.equal(panelBStart.status, 0);
  const panelPath = path.join(dir, "state", "review-aggregation-same-session.json");
  assert.ok(existsSync(panelPath));
  assert.equal(existsSync(path.join(dir, "state", "review-aggregation-panel-a.json")), false);
  assert.equal(existsSync(path.join(dir, "state", "review-aggregation-panel-b.json")), false);
  assert.deepEqual(
    JSON.parse(readFileSync(panelPath, "utf8")).started_reviewers.map((r) => r.name),
    ["deep-reviewer", "fact-checker"]
  );

  const panelAStop = run(reviewerStop, dir, {
    agent_type: "deep-reviewer",
    session_id: "same-session",
    review_run_id: "panel-a",
    output: "Reviewer: deep-reviewer\nScore: 0.9\nAPPROVED",
  });
  assert.equal(panelAStop.status, 0);
  assert.deepEqual(JSON.parse(readFileSync(panelPath, "utf8")).reviewers.map((r) => r.name), ["deep-reviewer"]);
});

test("a second panel in the same native session and prompt is rejected", () => {
  const dir = dataDir();
  const activePath = path.join(dir, "state", "review-aggregation-conflict-session--prompt-1.json");
  const legacyPath = path.join(dir, "state", "review-aggregation.json");

  const first = run(reviewerStart, dir, {
    agent_type: "deep-reviewer",
    session_id: "conflict-session",
    prompt_id: "prompt-1",
  });
  assert.equal(first.status, 0);
  assert.ok(existsSync(activePath));

  writeFileSync(legacyPath, JSON.stringify({
    expected_reviewers: 2,
    threshold: 1,
    reviewers: [],
    started_reviewers: [],
  }));
  const second = run(reviewerStart, dir, {
    agent_type: "fact-checker",
    session_id: "conflict-session",
    prompt_id: "prompt-1",
  });

  assert.equal(second.status, 0);
  assert.match(second.stdout, /\[REVIEW CONFLICT\]/);
  assert.deepEqual(
    JSON.parse(readFileSync(activePath, "utf8")).started_reviewers.map((r) => r.name),
    ["deep-reviewer"]
  );
});

test("plugin-scoped SCC reviewer identities aggregate while foreign prefixes do not", () => {
  const dir = dataDir();
  const sessionId = "scoped-reviewer-session";
  const statePath = path.join(dir, "state", `review-aggregation-${sessionId}.json`);

  const start = run(reviewerStart, dir, { agent_type: "scc:deep-reviewer", session_id: sessionId });
  assert.equal(start.status, 0);
  assert.ok(existsSync(statePath));

  const foreign = run(reviewerStart, dir, { agent_type: "other-plugin:fact-checker", session_id: sessionId });
  assert.equal(foreign.status, 0);
  assert.equal(foreign.stdout, "");

  const stop = run(reviewerStop, dir, {
    agent_type: "scc:deep-reviewer",
    session_id: sessionId,
    last_assistant_message: "Reviewer: deep-reviewer\nScore: 0.9\nAPPROVED",
  });
  assert.equal(stop.status, 0);
  assert.equal(stop.stdout, "");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  assert.deepEqual(state.started_reviewers.map((r) => r.name), ["deep-reviewer"]);
  assert.deepEqual(state.reviewers.map((r) => r.name), ["deep-reviewer"]);
});

test("producer participation survives different subagent run IDs into review", () => {
  const dir = dataDir();
  const activePath = path.join(dir, "state", "pdca-active.json");
  writeFileSync(activePath, JSON.stringify({ current_phase: "do" }));

  const upstream = run(reviewerStart, dir, {
    agent_type: "deep-reviewer",
    session_id: "artifact-session",
    run_id: "producer-call",
  });
  assert.equal(upstream.status, 0);
  assert.match(upstream.stdout, /\[UPSTREAM\]/);

  writeFileSync(activePath, JSON.stringify({ current_phase: "check" }));
  const reviewers = ["deep-reviewer", "fact-checker", "structure-analyst"];
  for (const name of reviewers) {
    const started = run(reviewerStart, dir, {
      agent_type: name,
      session_id: "artifact-session",
      run_id: `${name}-review-call`,
      review_run_id: "artifact-panel",
    });
    assert.equal(started.status, 0);
  }

  let finalResult;
  for (const name of reviewers) {
    finalResult = run(reviewerStop, dir, {
      agent_type: name,
      session_id: "artifact-session",
      run_id: `${name}-review-call`,
      review_run_id: "artifact-panel",
      output: `Reviewer: ${name}\nScore: 0.9\nAPPROVED`,
    });
    assert.equal(finalResult.status, 0);
  }

  assert.equal(finalResult.stdout, "");
  const bridge = run(reviewResult, dir, {
    hook_event_name: "PostToolUse",
    tool_name: "Agent",
    session_id: "artifact-session",
  });
  assert.match(bridge.stdout, /\[EXCLUDED\] deep-reviewer ran upstream/);
  assert.match(bridge.stdout, /BLOCKED — QUORUM SHORT/);

  const participantFile = path.join(
    dir,
    "state",
    "review-participants",
    "artifact-session",
    "upstream-participants.json"
  );
  assert.deepEqual(
    JSON.parse(readFileSync(participantFile, "utf8")).participants.map((entry) => entry.name),
    ["deep-reviewer"],
    "a blocked panel must preserve producer identity for replacement reviewers"
  );

  for (const name of ["deep-reviewer", "fact-checker"]) {
    const started = run(reviewerStart, dir, {
      agent_type: name,
      session_id: "artifact-session",
      preset: "quick",
    });
    assert.equal(started.status, 0);
    const stopped = run(reviewerStop, dir, {
      agent_type: name,
      session_id: "artifact-session",
      preset: "quick",
      output: `Reviewer: ${name}\nScore: 0.9\nAPPROVED`,
    });
    assert.equal(stopped.status, 0);
  }
  const replacement = run(reviewResult, dir, {
    hook_event_name: "PostToolUse",
    tool_name: "Agent",
    session_id: "artifact-session",
  });
  assert.match(replacement.stdout, /\[EXCLUDED\] deep-reviewer ran upstream/);
  assert.match(replacement.stdout, /BLOCKED — QUORUM SHORT/);
  assert.doesNotMatch(replacement.stdout, /CONSENSUS: APPROVED/);
});

test("namespaced panels preserve reviewer preset configuration", () => {
  const dir = dataDir();
  const result = run(reviewerStart, dir, {
    agent_type: "devil-advocate",
    session_id: "preset-session",
    preset: "quick",
  });
  assert.equal(result.status, 0);
  const state = JSON.parse(readFileSync(
    path.join(dir, "state", "review-aggregation-preset-session.json"),
    "utf8"
  ));
  assert.equal(state.preset, "quick");
  assert.equal(state.expected_reviewers, 2);
  assert.equal(state.threshold, 1);
});

test("namespaced panels migrate an existing legacy review configuration", () => {
  const dir = dataDir();
  const legacyPath = path.join(dir, "state", "review-aggregation.json");
  writeFileSync(legacyPath, JSON.stringify({
    started_at: "2026-08-27T00:00:00.000Z",
    expected_reviewers: 4,
    threshold: 0.9,
    external_reviewers: 2,
    reviewers: [],
    started_reviewers: [],
  }));

  const result = run(reviewerStart, dir, {
    agent_type: "deep-reviewer",
    session_id: "migration-session",
  });
  assert.equal(result.status, 0);
  const state = JSON.parse(readFileSync(
    path.join(dir, "state", "review-aggregation-migration-session.json"),
    "utf8"
  ));
  assert.equal(state.expected_reviewers, 4);
  assert.equal(state.threshold, 0.9);
  assert.equal(state.external_reviewers, 2);
  assert.equal(existsSync(legacyPath), false);
});

test("stop_hook_active bypasses the gate and records why", () => {
  const dir = dataDir();
  writeFileSync(path.join(dir, "state", "pdca-active.json"), JSON.stringify({
    topic: "unfinished", current_phase: "plan", completed: [],
  }));
  const result = run(sessionEnd, dir, { stop_hook_active: true, session_id: "stop-session" });
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stderr, /gate bypassed|recursive invocation/i);
  const audit = readFileSync(path.join(dir, "state", "stop-hook-bypass.jsonl"), "utf8");
  assert.match(audit, /recursive Stop hook invocation/);
});

test("an incomplete PDCA Stop blocks once, then the same-session retry passes", () => {
  const dir = dataDir();
  writeFileSync(path.join(dir, "state", "pdca-active.json"), JSON.stringify({
    topic: "unfinished",
    current_phase: "plan",
    completed: [],
  }));

  const environment = {
    CLAUDE_PROJECT_DIR: dir,
    CLAUDE_SESSION_ID: "same-stop-session",
  };
  const first = run(sessionEnd, dir, { session_id: "same-stop-session" }, environment);
  assert.equal(first.status, 2);
  assert.match(first.stderr, /Check phase not yet completed/);
  assert.match(first.stderr, /Run \/scc:review before finishing the session/);
  assert.equal(first.stderr.trim().split("\n").length, 1, first.stderr);
  assert.equal(first.stdout, "");

  const guardPath = stopGuardPath(dir, "same-stop-session");
  const guard = JSON.parse(readFileSync(guardPath, "utf8"));
  assert.deepEqual(Object.keys(guard).sort(), ["blocked_at", "session_id", "version"]);
  assert.equal(guard.version, 1);
  assert.equal(guard.session_id, "same-stop-session");
  assert.equal(new Date(guard.blocked_at).toISOString(), guard.blocked_at);
  assert.equal(statSync(guardPath).mode & 0o777, 0o600);

  const retry = run(sessionEnd, dir, { session_id: "same-stop-session" }, environment);
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(existsSync(guardPath), false);
  assert.doesNotMatch(retry.stderr, /Check phase not yet completed|gate bypassed/i);
  const audit = readFileSync(path.join(dir, "state", "stop-hook-bypass.jsonl"), "utf8");
  assert.match(audit, /recent stop-hook guard \(retry suppression\)/);

  const nextStopAttempt = run(sessionEnd, dir, { session_id: "same-stop-session" }, environment);
  assert.equal(nextStopAttempt.status, 2);
});

test("a session-tagged Stop never consumes an unscoped legacy guard", () => {
  const dir = dataDir();
  writeFileSync(path.join(dir, "state", "pdca-active.json"), JSON.stringify({
    topic: "unfinished", current_phase: "plan", completed: [],
  }));
  const legacyGuard = stopGuardPath(dir, null);
  writeFileSync(legacyGuard, String(Date.now()));

  const result = run(
    sessionEnd,
    dir,
    { session_id: "unrelated-session" },
    { CLAUDE_SESSION_ID: "unrelated-session" }
  );

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Check phase not yet completed/);
  assert.equal(existsSync(legacyGuard), false);
});

test("a valid legacy guard remains a one-shot fallback only without session identity", () => {
  const dir = dataDir();
  writeFileSync(path.join(dir, "state", "pdca-active.json"), JSON.stringify({
    topic: "unfinished", current_phase: "plan", completed: [],
  }));
  const legacyGuard = stopGuardPath(dir, null);
  writeFileSync(legacyGuard, String(Date.now()));

  const result = runWithoutSession(sessionEnd, dir, {});

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(legacyGuard), false);
  assert.doesNotMatch(result.stderr, /Check phase not yet completed|gate bypassed/i);
  const audit = readFileSync(path.join(dir, "state", "stop-hook-bypass.jsonl"), "utf8");
  assert.match(audit, /legacy stop-hook guard \(hot-upgrade retry suppression\)/);
});

test("a stale legacy Stop guard does not weaken the quality gate", () => {
  const dir = dataDir();
  writeFileSync(path.join(dir, "state", "pdca-active.json"), JSON.stringify({
    topic: "unfinished",
    current_phase: "plan",
    completed: [],
  }));
  const legacyGuard = path.join(dir, "state", ".stop-hook-guard");
  writeFileSync(legacyGuard, String(Date.now() - 60_000));
  const stale = new Date(Date.now() - 60_000);
  utimesSync(legacyGuard, stale, stale);

  const result = run(
    sessionEnd,
    dir,
    { session_id: "stale-stop-session" },
    { CLAUDE_SESSION_ID: "stale-stop-session" }
  );

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Check phase not yet completed/);
  assert.equal(existsSync(legacyGuard), false);
});

test("raw session identities cannot alias the same Stop guard", () => {
  const dir = dataDir();
  writeFileSync(path.join(dir, "state", "pdca-active.json"), JSON.stringify({
    topic: "unfinished", current_phase: "plan", completed: [],
  }));

  const slash = run(sessionEnd, dir, { session_id: "a/b" }, { CLAUDE_SESSION_ID: "a/b" });
  const plain = run(sessionEnd, dir, { session_id: "ab" }, { CLAUDE_SESSION_ID: "ab" });

  assert.equal(slash.status, 2);
  assert.equal(plain.status, 2);
  assert.notEqual(stopGuardPath(dir, "a/b"), stopGuardPath(dir, "ab"));
});

test("only one concurrent same-session retry can consume a Stop guard", async () => {
  const dir = dataDir();
  writeFileSync(path.join(dir, "state", "pdca-active.json"), JSON.stringify({
    topic: "unfinished", current_phase: "plan", completed: [],
  }));
  const sessionId = "concurrent-stop-session";
  const blocked = run(sessionEnd, dir, { session_id: sessionId }, { CLAUDE_SESSION_ID: sessionId });
  assert.equal(blocked.status, 2);

  const retries = await Promise.all(Array.from(
    { length: 12 },
    () => runAsync(sessionEnd, dir, { session_id: sessionId }, sessionId)
  ));
  assert.equal(retries.filter((result) => result.status === 0).length, 1);
  assert.equal(retries.filter((result) => result.status === 2).length, 11);
});

test("stale claim cleanup cannot race a fresh same-session claim", async () => {
  const dir = dataDir();
  writeFileSync(path.join(dir, "state", "pdca-active.json"), JSON.stringify({
    topic: "unfinished", current_phase: "plan", completed: [],
  }));
  const sessionId = "stale-claim-concurrent-session";
  const blocked = run(sessionEnd, dir, { session_id: sessionId }, { CLAUDE_SESSION_ID: sessionId });
  assert.equal(blocked.status, 2);

  const claimedPath = `${stopGuardPath(dir, sessionId)}.claimed`;
  writeFileSync(claimedPath, "{stale-claim", { mode: 0o600 });
  const stale = new Date(Date.now() - 60_000);
  utimesSync(claimedPath, stale, stale);

  const retries = await Promise.all(Array.from(
    { length: 12 },
    () => runAsync(sessionEnd, dir, { session_id: sessionId }, sessionId)
  ));
  assert.equal(retries.filter((result) => result.status === 0).length, 1);
  assert.equal(retries.filter((result) => result.status === 2).length, 11);
});

test("malformed, symlink, and directory guards never bypass the quality gate", () => {
  for (const guardKind of ["malformed", "symlink", "directory"]) {
    const dir = dataDir();
    writeFileSync(path.join(dir, "state", "pdca-active.json"), JSON.stringify({
      topic: "unfinished", current_phase: "plan", completed: [],
    }));
    const sessionId = `unsafe-${guardKind}`;
    const guardPath = stopGuardPath(dir, sessionId);
    const external = path.join(dir, `external-${guardKind}.txt`);
    writeFileSync(external, "do-not-overwrite");
    if (guardKind === "malformed") writeFileSync(guardPath, "{not-json");
    if (guardKind === "symlink") symlinkSync(external, guardPath);
    if (guardKind === "directory") mkdirSync(guardPath);

    const result = run(sessionEnd, dir, { session_id: sessionId }, { CLAUDE_SESSION_ID: sessionId });

    assert.equal(result.status, 2, `${guardKind}: ${result.stderr}`);
    assert.match(result.stderr, /Check phase not yet completed/);
    assert.equal(readFileSync(external, "utf8"), "do-not-overwrite");
  }
});

test("a symlinked state directory is never touched by Stop guard handling", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "scc-hook-safety-data-"));
  const externalState = mkdtempSync(path.join(os.tmpdir(), "scc-hook-safety-external-state-"));
  const sessionId = "symlinked-state-session";
  const pdcaPath = path.join(externalState, "pdca-active.json");
  const legacyGuard = path.join(externalState, ".stop-hook-guard");
  const sessionGuard = path.join(
    externalState,
    path.basename(stopGuardPath(dir, sessionId)),
  );
  writeFileSync(pdcaPath, JSON.stringify({
    topic: "unfinished", current_phase: "plan", completed: [],
  }));
  writeFileSync(legacyGuard, String(Date.now()));
  writeFileSync(sessionGuard, JSON.stringify({
    version: 1,
    blocked_at: new Date().toISOString(),
    session_id: sessionId,
  }));
  const before = new Map([
    [pdcaPath, readFileSync(pdcaPath)],
    [legacyGuard, readFileSync(legacyGuard)],
    [sessionGuard, readFileSync(sessionGuard)],
  ]);
  symlinkSync(externalState, path.join(dir, "state"), "dir");

  const result = run(sessionEnd, dir, { session_id: sessionId }, { CLAUDE_SESSION_ID: sessionId });

  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /state directory is unsafe/i);
  for (const [targetPath, contents] of before) {
    assert.deepEqual(readFileSync(targetPath), contents, targetPath);
  }
});

test("an unsafe state directory fail-closes ordinary Stop before any state access", () => {
  for (const scenario of ["empty", "completed", "oversized"]) {
    const dir = mkdtempSync(path.join(os.tmpdir(), `scc-hook-unsafe-${scenario}-data-`));
    const externalState = mkdtempSync(path.join(os.tmpdir(), `scc-hook-unsafe-${scenario}-target-`));
    writeFileSync(path.join(externalState, "marker.txt"), `unchanged-${scenario}`);
    if (scenario === "completed") {
      writeFileSync(path.join(externalState, "pdca-active.json"), JSON.stringify({
        topic: "completed",
        current_phase: "act",
        completed: ["plan", "do", "check", "act"],
      }));
    }
    symlinkSync(externalState, path.join(dir, "state"), "dir");
    const namesBefore = readdirSync(externalState).sort();
    const contentsBefore = new Map(namesBefore.map((name) => [
      name,
      readFileSync(path.join(externalState, name)),
    ]));

    const result = scenario === "oversized"
      ? spawnSync(process.execPath, [sessionEnd], {
          cwd: root,
          env: {
            ...process.env,
            CLAUDE_PLUGIN_DATA: dir,
            CLAUDE_PROJECT_DIR: root,
            CLAUDE_SESSION_ID: `unsafe-${scenario}-session`,
          },
          input: JSON.stringify({ payload: "x".repeat(600 * 1024) }),
          encoding: "utf8",
        })
      : run(
          sessionEnd,
          dir,
          { session_id: `unsafe-${scenario}-session` },
          { CLAUDE_SESSION_ID: `unsafe-${scenario}-session` },
        );

    assert.equal(result.status, 2, `${scenario}: ${result.stderr}`);
    assert.match(result.stderr, /state directory is unsafe/i);
    assert.deepEqual(readdirSync(externalState).sort(), namesBefore, scenario);
    for (const [name, contents] of contentsBefore) {
      assert.deepEqual(readFileSync(path.join(externalState, name)), contents, `${scenario}:${name}`);
    }
  }
});

test("an authoritative recursive Stop never mutates an unsafe state target", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "scc-hook-unsafe-recursive-data-"));
  const externalState = mkdtempSync(path.join(os.tmpdir(), "scc-hook-unsafe-recursive-target-"));
  const sessionId = "unsafe-recursive-session";
  writeFileSync(path.join(externalState, "pdca-active.json"), JSON.stringify({
    topic: "unfinished", current_phase: "plan", completed: [],
  }));
  writeFileSync(path.join(externalState, path.basename(stopGuardPath(dir, sessionId))), JSON.stringify({
    version: 1,
    blocked_at: new Date().toISOString(),
    session_id: sessionId,
  }));
  symlinkSync(externalState, path.join(dir, "state"), "dir");
  const namesBefore = readdirSync(externalState).sort();
  const contentsBefore = new Map(namesBefore.map((name) => [
    name,
    readFileSync(path.join(externalState, name)),
  ]));

  const result = run(
    sessionEnd,
    dir,
    { stop_hook_active: true, session_id: sessionId },
    { CLAUDE_SESSION_ID: sessionId },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /recursive Stop allowed without state access/);
  assert.deepEqual(readdirSync(externalState).sort(), namesBefore);
  for (const [name, contents] of contentsBefore) {
    assert.deepEqual(readFileSync(path.join(externalState, name)), contents, name);
  }
});

test("guard writes do not follow the old predictable temp-file symlink", () => {
  const dir = dataDir();
  writeFileSync(path.join(dir, "state", "pdca-active.json"), JSON.stringify({
    topic: "unfinished", current_phase: "plan", completed: [],
  }));
  const external = path.join(dir, "external-temp-target.txt");
  writeFileSync(external, "do-not-overwrite");
  const oldGuardBase = path.join(dir, "state", ".stop-hook-guard-temp-symlink-session");
  const driver = [
    'import { symlinkSync } from "node:fs";',
    `symlinkSync(${JSON.stringify(external)}, ${JSON.stringify(oldGuardBase)} + ".tmp." + process.pid);`,
    `await import(${JSON.stringify(sessionEnd)} + "?temp-symlink=" + process.pid);`,
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", driver], {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_DATA: dir,
      CLAUDE_PROJECT_DIR: root,
      CLAUDE_SESSION_ID: "temp-symlink-session",
    },
    input: JSON.stringify({ session_id: "temp-symlink-session" }),
    encoding: "utf8",
  });

  assert.equal(result.status, 2, result.stderr);
  assert.equal(readFileSync(external, "utf8"), "do-not-overwrite");
});

test("SessionStart survives a large MMBridge packet within the bounded context", () => {
  const dir = dataDir();
  const bin = path.join(dir, "bin");
  mkdirSync(bin, { recursive: true });
  const packet = JSON.stringify({
    alwaysOnMemory: `\u001b[31m${"memory ".repeat(5000)}\u202E`,
    freshness: "fresh\u0007",
    gateWarnings: [`\u001b[32m${"warning ".repeat(1000)}\u001b[0m`],
  });
  const encoded = Buffer.from(packet).toString("base64");
  const bridge = path.join(bin, "mmbridge");
  writeFileSync(bridge, `#!/bin/sh\nprintf '%s' '${encoded}' | base64 --decode\n`);
  chmodSync(bridge, 0o755);
  const result = run(sessionStart, dir, { source: "startup" }, { PATH: `${bin}:${process.env.PATH || ""}` });
  assert.equal(result.status, 0);
  assert.ok(result.stdout.length <= 12 * 1024);
  assert.doesNotMatch(result.stdout, /\u001b|\u202E|\u0007/);
});
