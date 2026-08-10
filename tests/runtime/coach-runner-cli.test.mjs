import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "../../scripts/deep-interview-runner.mjs";
import { readState, writeState } from "../../scripts/lib/coach-state.mjs";

function withRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), "scc-cli-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

test("runCli refuses to run when the resolved root is the plugin install", () => {
  assert.throws(
    () => runCli(["status"], { env: { CLAUDE_PROJECT_DIR: process.cwd() }, useRealRootResolution: true }),
    /플러그인 설치 경로/
  );
});
