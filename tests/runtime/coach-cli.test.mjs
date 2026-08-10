import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "../../scripts/coach-runner.mjs";
import { readState, writeState, stateFilePath } from "../../scripts/lib/coach-state.mjs";

function withRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), "scc-cli-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function captureStdout(fn) {
  const writes = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk, ...args) => {
    writes.push(String(chunk));
    const callback = args.find((arg) => typeof arg === "function");
    callback?.();
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = original;
  }
  return writes.join("");
}

const FORK_JSON = {
  id: "voice-two-track",
  title: "두 목소리로 간다",
  chosen: "S-A와 S-B를 서로 다른 화자로 유지한다",
  rejected: [{ label: "고백조", why: "신뢰를 소급해서 깎는다" }],
  payload: "### 목소리 A\n건조한 관찰자.",
  review_when: "결제 2주치 데이터 확보 시",
  triggers: ["목소리", "S-A"],
};

test("record-fork writes a standard under the project root", () => {
  withRoot((root) => {
    const forkFile = join(root, "fork.json");
    writeFileSync(forkFile, JSON.stringify(FORK_JSON), "utf8");
    writeState(root, { run_id: "r1", forks: [] });

    runCli(["record-fork", "--file", forkFile, "--json"], { root });

    const path = join(root, ".scc", "standards", "voice-two-track", "STANDARD.md");
    assert.equal(existsSync(path), true);
    assert.match(readFileSync(path, "utf8"), /고백조/);
  });
});

test("record-fork appends the standard id to state so finalize can count it", () => {
  withRoot((root) => {
    const forkFile = join(root, "fork.json");
    writeFileSync(forkFile, JSON.stringify(FORK_JSON), "utf8");
    writeState(root, { run_id: "r1", forks: [] });

    runCli(["record-fork", "--file", forkFile, "--json"], { root });

    assert.deepEqual(readState(root).forks, ["voice-two-track"]);
  });
});

test("record-fork refuses a fork without an id", () => {
  withRoot((root) => {
    const forkFile = join(root, "fork.json");
    writeFileSync(forkFile, JSON.stringify({ title: "no id" }), "utf8");
    writeState(root, { run_id: "r1", forks: [] });

    assert.throws(() => runCli(["record-fork", "--file", forkFile], { root }), /id/);
  });
});

test("the runner never writes into a .gjc directory", () => {
  withRoot((root) => {
    const forkFile = join(root, "fork.json");
    writeFileSync(forkFile, JSON.stringify(FORK_JSON), "utf8");
    writeState(root, { run_id: "r1", forks: [] });

    runCli(["record-fork", "--file", forkFile, "--json"], { root });

    assert.equal(existsSync(join(root, ".gjc")), false);
  });
});

function recordFork(root, fork = FORK_JSON) {
  const forkFile = join(root, `${fork.id}.json`);
  writeFileSync(forkFile, JSON.stringify(fork), "utf8");
  runCli(["record-fork", "--file", forkFile, "--json"], { root });
  return forkFile;
}

function standardBody(root, id) {
  return readFileSync(join(root, ".scc", "standards", id, "STANDARD.md"), "utf8");
}

const REPLACEMENT_JSON = {
  id: "voice-one-track",
  title: "한 목소리로 간다",
  chosen: "S-A와 S-B를 한 화자로 합친다",
  rejected: [{ label: "두 목소리", why: "결제 데이터가 분리를 지지하지 않았다" }],
  review_when: "구독자 1만 도달 시",
  triggers: ["목소리"],
};

test("supersede retires a standard without deleting its file", () => {
  withRoot((root) => {
    writeState(root, { run_id: "r1", forks: [] });
    recordFork(root);

    runCli(["supersede", "--id", "voice-two-track", "--json"], { root });

    const body = standardBody(root, "voice-two-track");
    assert.match(body, /^status: superseded$/m);
    assert.match(body, /고백조/);
  });
});

test("supersede --file writes the replacement pointing back at the record it retires", () => {
  withRoot((root) => {
    writeState(root, { run_id: "r1", forks: [] });
    recordFork(root);
    const replacementFile = join(root, "replacement.json");
    writeFileSync(replacementFile, JSON.stringify(REPLACEMENT_JSON), "utf8");

    runCli(["supersede", "--id", "voice-two-track", "--file", replacementFile, "--json"], { root });

    assert.match(standardBody(root, "voice-one-track"), /^supersedes: "voice-two-track"$/m);
    assert.match(standardBody(root, "voice-two-track"), /^status: superseded$/m);
    assert.deepEqual(readState(root).forks, ["voice-two-track", "voice-one-track"]);
  });
});

test("supersede refuses an id that is not an active standard", () => {
  withRoot((root) => {
    writeState(root, { run_id: "r1", forks: [] });
    recordFork(root);
    runCli(["supersede", "--id", "voice-two-track", "--json"], { root });

    assert.throws(() => runCli(["supersede", "--id", "voice-two-track"], { root }), /no active standard/);
    assert.throws(() => runCli(["supersede", "--id", "never-existed"], { root }), /no active standard/);
  });
});

test("supersede refuses a replacement that reuses the retiring id", () => {
  withRoot((root) => {
    writeState(root, { run_id: "r1", forks: [] });
    const forkFile = recordFork(root);

    assert.throws(
      () => runCli(["supersede", "--id", "voice-two-track", "--file", forkFile], { root }),
      /cannot supersede itself/
    );
    assert.match(standardBody(root, "voice-two-track"), /^status: active$/m);
  });
});

test("a colliding replacement id aborts before the old standard is retired", () => {
  withRoot((root) => {
    writeState(root, { run_id: "r1", forks: [] });
    recordFork(root);
    recordFork(root, { ...REPLACEMENT_JSON, id: "payment-copy", title: "결제 카피는 짧게" });
    const collidingFile = join(root, "colliding.json");
    writeFileSync(collidingFile, JSON.stringify({ ...REPLACEMENT_JSON, id: "payment-copy" }), "utf8");

    assert.throws(
      () => runCli(["supersede", "--id", "voice-two-track", "--file", collidingFile], { root }),
      /이미 다른 기준에 쓰이고 있습니다/
    );
    assert.match(standardBody(root, "voice-two-track"), /^status: active$/m);
  });
});

test("supersede works outside an interview and leaves state absent", () => {
  withRoot((root) => {
    writeState(root, { run_id: "r1", forks: [] });
    recordFork(root);
    runCli(["clear", "--json"], { root });

    runCli(["supersede", "voice-two-track", "--json"], { root });

    assert.match(standardBody(root, "voice-two-track"), /^status: superseded$/m);
    assert.equal(readState(root), null);
  });
});

test("record-verdict appends a reviewer's answer and refuses one for an inactive standard", () => {
  withRoot((root) => {
    writeState(root, { run_id: "r1", forks: [] });
    recordFork(root);
    const verdictFile = join(root, "verdict.json");
    const verdict = {
      standard: "voice-two-track",
      ask: "과장 없이 읽히는가?",
      target_sha256: "a".repeat(64),
      verdict: "pass",
      reviewer: "codex",
    };
    writeFileSync(verdictFile, JSON.stringify(verdict), "utf8");

    runCli(["record-verdict", "--file", verdictFile, "--json"], { root, now: new Date("2026-08-10T12:00:00.000Z") });

    const logged = JSON.parse(readFileSync(join(root, ".scc", "checks", "adversarial.jsonl"), "utf8").trim());
    assert.equal(logged.reviewer, "codex");
    assert.equal(logged.at, "2026-08-10T12:00:00.000Z");

    writeFileSync(verdictFile, JSON.stringify({ ...verdict, standard: "never-existed" }), "utf8");
    assert.throws(() => runCli(["record-verdict", "--file", verdictFile], { root }), /no active standard/);
  });
});

const SETTLED_STATE = {
  run_id: "r1",
  forks: [],
  threshold: 0.05,
  current_ambiguity: 0.02,
  topology: { status: "confirmed", components: [{ name: "one" }] },
};

test("finalize refuses an unconfirmed topology and names what is open", () => {
  withRoot((root) => {
    writeState(root, { ...SETTLED_STATE, topology: { status: "pending", components: [{ name: "one" }] } });

    assert.throws(
      () => runCli(["finalize", "--json"], { root }),
      /finalize refused — topology is pending, not confirmed/
    );
    assert.equal(readState(root).status, undefined);
  });
});

test("finalize refuses ambiguity above the threshold", () => {
  withRoot((root) => {
    writeState(root, { ...SETTLED_STATE, current_ambiguity: 0.4 });

    assert.throws(() => runCli(["finalize", "--json"], { root }), /ambiguity 0\.400 is above the 0\.05 threshold/);
  });
});

test("--accept-risk without a reason is refused, so acceptance cannot be reflexive", () => {
  withRoot((root) => {
    writeState(root, { ...SETTLED_STATE, current_ambiguity: 0.4 });

    assert.throws(() => runCli(["finalize", "--accept-risk"], { root }), /needs the reason/);
    assert.throws(() => runCli(["finalize", "--accept-risk", "   "], { root }), /put the acceptance on the record/);
  });
});

test("--accept-risk records what was accepted, by whom it was named, and against what numbers", () => {
  withRoot((root) => {
    writeState(root, { ...SETTLED_STATE, current_ambiguity: 0.4 });

    runCli(["finalize", "--json", "--accept-risk", "발행 마감이 오늘이다"], {
      root,
      now: new Date("2026-08-10T12:00:00.000Z"),
    });

    const recorded = readState(root).risk_accepted;
    assert.equal(recorded.reason, "발행 마감이 오늘이다");
    assert.equal(recorded.ambiguity, 0.4);
    assert.equal(recorded.threshold, 0.05);
    assert.equal(recorded.at, "2026-08-10T12:00:00.000Z");
    assert.match(recorded.risks.join(" "), /ambiguity 0\.400/);
  });
});

test("finalize under the threshold needs no acceptance and records none", () => {
  withRoot((root) => {
    writeState(root, SETTLED_STATE);

    runCli(["finalize", "--json"], { root });

    const state = readState(root);
    assert.equal(state.status, "pending_approval");
    assert.equal(state.risk_accepted, undefined);
  });
});

test("confirm closes the interview so nothing is left to resume", () => {
  withRoot((root) => {
    writeState(root, SETTLED_STATE);
    recordFork(root);
    runCli(["finalize", "--json"], { root });

    runCli(["confirm", "--json"], { root });

    assert.equal(readState(root), null);
    // The decision survives; only the resumable remainder is gone.
    assert.match(standardBody(root, "voice-two-track"), /^status: active$/m);
  });
});

test("confirm refuses an interview that was never finalized", () => {
  withRoot((root) => {
    writeState(root, SETTLED_STATE);

    assert.throws(() => runCli(["confirm"], { root }), /confirm needs a finalized interview/);
    assert.notEqual(readState(root), null);
  });
});

test("a confirmed interview leaves start free to open the next one", () => {
  withRoot((root) => {
    writeState(root, SETTLED_STATE);
    runCli(["finalize", "--json"], { root });
    runCli(["confirm", "--json"], { root });

    runCli(["start", "--idea", "다음 갈림길", "--json"], { root });

    assert.equal(readState(root).initial_idea, "다음 갈림길");
  });
});

test("runCli refuses to run when the resolved root is the plugin install", () => {
  assert.throws(
    () => runCli(["status"], { env: { CLAUDE_PROJECT_DIR: process.cwd() }, useRealRootResolution: true }),
    /플러그인 설치 경로/
  );
});

test("a second start against an active interview refuses and leaves state byte-for-byte unchanged", () => {
  withRoot((root) => {
    runCli(["start", "--idea", "first idea", "--json"], { root });
    const statePath = stateFilePath(root);
    const before = readFileSync(statePath, "utf8");
    const firstState = readState(root);

    assert.throws(
      () => runCli(["start", "--idea", "second idea", "--json"], { root }),
      (err) => err.message.includes(firstState.run_id) && err.message.includes(String(firstState.round)) && err.message.includes("--force")
    );

    assert.equal(readFileSync(statePath, "utf8"), before);
  });
});

test("start --force overrides an active interview and prints what it discarded", () => {
  withRoot((root) => {
    runCli(["start", "--idea", "first idea", "--json"], { root, now: new Date("2026-06-13T00:00:00.000Z") });
    const firstState = readState(root);

    const out = captureStdout(() =>
      runCli(["start", "--idea", "second idea", "--force", "--json"], { root, now: new Date("2026-06-13T00:01:00.000Z") })
    );
    const parsed = JSON.parse(out);

    assert.deepEqual(parsed.discarded, {
      run_id: firstState.run_id,
      round: firstState.round,
      standards_settled: 0,
    });

    const secondState = readState(root);
    assert.notEqual(secondState.run_id, firstState.run_id);
    assert.equal(secondState.initial_idea, "second idea");
  });
});

test("status against a state file with no usable topology gives a clear message, not a TypeError", () => {
  withRoot((root) => {
    writeState(root, { active: true, status: "interviewing", round: 1 });

    assert.throws(
      () => runCli(["status", "--json"], { root }),
      (err) =>
        !/Cannot read propert/i.test(err.message) &&
        err.message.includes("topology") &&
        err.message.includes(stateFilePath(root))
    );
  });
});

test("answer against a state file with no usable topology gives a clear message, not a TypeError", () => {
  withRoot((root) => {
    writeState(root, { active: true, status: "interviewing", round: 1 });

    assert.throws(
      () => runCli(["answer", "--answer", "some answer", "--json"], { root }),
      (err) =>
        !/Cannot read propert/i.test(err.message) &&
        err.message.includes("topology") &&
        err.message.includes(stateFilePath(root))
    );
  });
});
