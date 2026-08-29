import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
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

  const guardPath = path.join(dir, "state", ".stop-hook-guard-same-stop-session");
  assert.deepEqual(
    Object.keys(JSON.parse(readFileSync(guardPath, "utf8"))).sort(),
    ["blocked_at", "session_id", "version"]
  );

  const retry = run(sessionEnd, dir, { session_id: "same-stop-session" }, environment);
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(existsSync(guardPath), false);
  assert.doesNotMatch(retry.stderr, /Check phase not yet completed|gate bypassed/i);
  const audit = readFileSync(path.join(dir, "state", "stop-hook-bypass.jsonl"), "utf8");
  assert.match(audit, /recent stop-hook guard \(retry suppression\)/);
});

test("a hot-upgrade legacy Stop guard is consumed once without repeating the block", () => {
  for (const contents of [String(Date.now()), "{malformed-hot-upgrade-state"]) {
    const dir = dataDir();
    writeFileSync(path.join(dir, "state", "pdca-active.json"), JSON.stringify({
      topic: "unfinished",
      current_phase: "plan",
      completed: [],
    }));
    const legacyGuard = path.join(dir, "state", ".stop-hook-guard");
    writeFileSync(legacyGuard, contents);

    const result = run(
      sessionEnd,
      dir,
      { session_id: "upgraded-stop-session" },
      { CLAUDE_SESSION_ID: "upgraded-stop-session" }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(legacyGuard), false);
    assert.doesNotMatch(result.stderr, /Check phase not yet completed|gate bypassed/i);
    const audit = readFileSync(path.join(dir, "state", "stop-hook-bypass.jsonl"), "utf8");
    assert.match(audit, /legacy stop-hook guard \(hot-upgrade retry suppression\)/);
  }
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
