import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runCli, checkTarget, parseTarget } from "../../scripts/standard-check.mjs";
import { checkerIds, runCheck, validateCheck, selectSection } from "../../scripts/lib/standard-checkers.mjs";
import { writeStandard } from "../../scripts/lib/standard-record.mjs";
import { appendVerdict, sha256 } from "../../scripts/lib/adversarial-log.mjs";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "standard-checks");

function withRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), "scc-check-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function seed(root, { id = "voice-two-track", checks = [], target = "# 초안\n\n본문.\n" } = {}) {
  writeStandard(root, {
    id,
    title: `${id} 기준`,
    chosen: "고른 방향",
    rejected: [{ label: "탈락", why: "근거 부족" }],
    review_when: "",
    triggers: [],
    checks,
  });
  const targetPath = join(root, "target.md");
  writeFileSync(targetPath, target, "utf8");
  return targetPath;
}

function silently(fn) {
  const original = process.stdout.write;
  process.stdout.write = () => true;
  try {
    return fn();
  } finally {
    process.stdout.write = original;
  }
}

// The self-proof the spec demands: every builtin checker ships a fixture it
// must reject. A checker that starts passing its own fixture — because a guard
// was loosened, or a rewrite made it always-true — breaks this test rather than
// quietly certifying everything it is pointed at.
test("every builtin checker fails its bundled must-fail fixture", () => {
  const withFixtures = readdirSync(FIXTURES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(withFixtures, checkerIds(), "each checker needs exactly one must-fail fixture directory");

  for (const checker of checkerIds()) {
    const check = JSON.parse(readFileSync(join(FIXTURES, checker, "check.json"), "utf8"));
    assert.equal(check.checker, checker, `${checker} fixture must exercise its own checker`);
    const target = parseTarget(readFileSync(join(FIXTURES, checker, "target.md"), "utf8"));
    const result = runCheck(check, target);
    assert.equal(result.status, "fail", `${checker} passed its must-fail fixture`);
    assert.ok(result.reason, `${checker} failed without saying why`);
  }
});

test("an unknown checker id is refused, not skipped", () => {
  assert.throws(
    () => validateCheck({ kind: "builtin", checker: "no-such-checker", args: {} }, 0),
    /unknown checker/
  );
});

test("a free-form command field is an error, never silently ignored", () => {
  for (const field of ["run", "command", "shell"]) {
    assert.throws(
      () => validateCheck({ kind: "builtin", checker: "regex-absent", run: "rm -rf /", args: {} }, 0),
      /free-form command field/,
      `${field} must be refused`
    );
  }
});

test("an unknown field on a check is refused so a typo cannot disable enforcement", () => {
  assert.throws(
    () => validateCheck({ kind: "builtin", checker: "regex-absent", arg: { pattern: "x" } }, 0),
    /unknown field "arg"/
  );
  assert.throws(() => validateCheck({ kind: "adversarial", ask: "정말?", threshold: 0.5 }, 0), /unknown field/);
});

test("a standard with no checks is reported as unchecked, not counted as a pass", () => {
  withRoot((root) => {
    const targetPath = seed(root, { checks: [] });
    const report = checkTarget({ root, targetPath });

    assert.deepEqual(report.unchecked, ["voice-two-track"]);
    assert.equal(report.ok, true);
    assert.equal(report.standards[0].enforcement, "none");
    assert.deepEqual(report.standards[0].results, []);
  });
});

test("an adversarial check is unproven until an independent reviewer answers it", () => {
  withRoot((root) => {
    const targetPath = seed(root, {
      checks: [{ kind: "adversarial", ask: "S-A와 S-B가 같은 사람이 쓴 것처럼 읽히는가?" }],
    });
    const report = checkTarget({ root, targetPath });

    assert.equal(report.standards[0].results[0].status, "unproven");
    assert.equal(report.unproven.length, 1);
    assert.equal(
      report.standards[0].results.some((result) => result.status === "pass"),
      false,
      "an unanswered adversarial check must never read as a pass"
    );
  });
});

test("a recorded verdict answers the adversarial check it was written for", () => {
  withRoot((root) => {
    const ask = "S-A와 S-B가 같은 사람이 쓴 것처럼 읽히는가?";
    const targetPath = seed(root, { checks: [{ kind: "adversarial", ask }] });
    appendVerdict(root, {
      standard: "voice-two-track",
      ask,
      target_sha256: sha256(readFileSync(targetPath, "utf8")),
      verdict: "pass",
      reviewer: "codex",
    });

    const report = checkTarget({ root, targetPath });

    assert.equal(report.standards[0].results[0].status, "pass");
    assert.equal(report.unproven.length, 0);
    assert.equal(report.ok, true);
  });
});

test("a reviewer answering no is a failure, not an unproven check", () => {
  withRoot((root) => {
    const ask = "과장 없이 읽히는가?";
    const targetPath = seed(root, { checks: [{ kind: "adversarial", ask }] });
    appendVerdict(root, {
      standard: "voice-two-track",
      ask,
      target_sha256: sha256(readFileSync(targetPath, "utf8")),
      verdict: "fail",
      reviewer: "codex",
      note: "두 번째 문단이 과장이다",
    });

    const report = checkTarget({ root, targetPath });

    assert.equal(report.ok, false);
    assert.match(report.failures[0].reason, /codex answered no — 두 번째 문단이 과장이다/);
  });
});

test("editing the artifact sends its verdicts back to unproven", () => {
  withRoot((root) => {
    const ask = "과장 없이 읽히는가?";
    const targetPath = seed(root, { checks: [{ kind: "adversarial", ask }] });
    appendVerdict(root, {
      standard: "voice-two-track",
      ask,
      target_sha256: sha256(readFileSync(targetPath, "utf8")),
      verdict: "pass",
      reviewer: "codex",
    });
    writeFileSync(targetPath, "# 초안\n\n고쳐 쓴 본문.\n", "utf8");

    const report = checkTarget({ root, targetPath });

    assert.equal(report.standards[0].results[0].status, "unproven");
    assert.equal(report.unproven.length, 1);
  });
});

test("a verdict for a different question does not answer this one", () => {
  withRoot((root) => {
    const targetPath = seed(root, { checks: [{ kind: "adversarial", ask: "과장 없이 읽히는가?" }] });
    appendVerdict(root, {
      standard: "voice-two-track",
      ask: "전혀 다른 질문인가?",
      target_sha256: sha256(readFileSync(targetPath, "utf8")),
      verdict: "pass",
      reviewer: "codex",
    });

    assert.equal(checkTarget({ root, targetPath }).standards[0].results[0].status, "unproven");
  });
});

test("a verdict without a reviewer or a target hash is refused", () => {
  withRoot((root) => {
    const base = { standard: "voice-two-track", ask: "?", verdict: "pass", reviewer: "codex", target_sha256: "a".repeat(64) };
    assert.throws(() => appendVerdict(root, { ...base, reviewer: "  " }), /non-empty "reviewer"/);
    assert.throws(() => appendVerdict(root, { ...base, target_sha256: "short" }), /target_sha256/);
    assert.throws(() => appendVerdict(root, { ...base, verdict: "maybe" }), /"pass" or "fail"/);
  });
});

test("one torn line in the verdict log does not hide the verdicts after it", () => {
  withRoot((root) => {
    const ask = "과장 없이 읽히는가?";
    const targetPath = seed(root, { checks: [{ kind: "adversarial", ask }] });
    const sha = sha256(readFileSync(targetPath, "utf8"));
    mkdirSync(join(root, ".scc", "checks"), { recursive: true });
    writeFileSync(
      join(root, ".scc", "checks", "adversarial.jsonl"),
      `{"standard":"voice-two-tr\n${JSON.stringify({ standard: "voice-two-track", ask, target_sha256: sha, verdict: "pass", reviewer: "codex" })}\n`,
      "utf8"
    );

    assert.equal(checkTarget({ root, targetPath }).standards[0].results[0].status, "pass");
  });
});

test("a failing builtin check is reported with the standard that owns it", () => {
  withRoot((root) => {
    const targetPath = seed(root, {
      checks: [{ kind: "builtin", checker: "regex-absent", args: { pattern: "단순히" } }],
      target: "# 초안\n\n이건 단순히 좋은 제품이 아닙니다.\n",
    });
    const report = checkTarget({ root, targetPath });

    assert.equal(report.ok, false);
    assert.equal(report.failures.length, 1);
    assert.equal(report.failures[0].standard, "voice-two-track");
    assert.equal(report.failures[0].checker, "regex-absent");
    assert.match(report.failures[0].reason, /단순히/);
  });
});

test("two standards that cannot both be satisfied report both failures without arbitration", () => {
  withRoot((root) => {
    const targetPath = seed(root, {
      id: "must-say-refund",
      checks: [{ kind: "builtin", checker: "regex-present", args: { pattern: "환불" } }],
      target: "# 판매글\n\n가격만 적었다.\n",
    });
    writeStandard(root, {
      id: "must-not-say-refund",
      title: "환불 언급 금지",
      chosen: "환불을 언급하지 않는다",
      rejected: [],
      review_when: "",
      triggers: [],
      checks: [{ kind: "builtin", checker: "regex-absent", args: { pattern: "가격" } }],
    });

    const report = checkTarget({ root, targetPath });

    assert.equal(report.failures.length, 2);
    assert.deepEqual(report.failures.map((failure) => failure.standard).sort(), [
      "must-not-say-refund",
      "must-say-refund",
    ]);
  });
});

test("a superseded standard is not checked", () => {
  withRoot((root) => {
    const targetPath = seed(root, {
      checks: [{ kind: "builtin", checker: "regex-absent", args: { pattern: "단순히" } }],
      target: "# 초안\n\n단순히.\n",
    });
    const path = join(root, ".scc", "standards", "voice-two-track", "STANDARD.md");
    writeFileSync(path, readFileSync(path, "utf8").replace("status: active", "status: superseded"), "utf8");

    const report = checkTarget({ root, targetPath });

    assert.deepEqual(report.standards, []);
    assert.equal(report.ok, true);
  });
});

test("--standard narrows the run and refuses an id that is not active", () => {
  withRoot((root) => {
    const targetPath = seed(root, {
      checks: [{ kind: "builtin", checker: "regex-absent", args: { pattern: "단순히" } }],
      target: "# 초안\n\n단순히.\n",
    });

    const report = silently(() => runCli([targetPath, "--standard", "voice-two-track", "--json"], { root }));
    assert.equal(report.failures.length, 1);

    assert.throws(() => runCli([targetPath, "--standard", "never-existed"], { root }), /no active standard/);
  });
});

test("a missing target path is an error, not an empty pass", () => {
  withRoot((root) => {
    seed(root);
    assert.throws(() => runCli([join(root, "absent.md")], { root }), /no such target file/);
    assert.throws(() => runCli([], { root }), /requires a target path/);
  });
});

test("checkTarget refuses to resolve a root inside the plugin install", () => {
  assert.throws(
    () => runCli(["README.md"], { env: { CLAUDE_PROJECT_DIR: process.cwd() }, useRealRootResolution: true }),
    /플러그인 설치 경로/
  );
});

test("selectSection walks a nested heading path and returns null when it misses", () => {
  const markdown = "# S-A\n\n## closing\n\n첫 번째 마무리.\n\n# S-B\n\n## closing\n\n두 번째 마무리.\n";
  assert.equal(selectSection(markdown, "S-A#closing"), "첫 번째 마무리.");
  assert.equal(selectSection(markdown, "S-B#closing"), "두 번째 마무리.");
  assert.equal(selectSection(markdown, "S-C#closing"), null);
  assert.equal(selectSection(markdown, "S-A#opening"), null);
});

test("parseTarget separates frontmatter from body so a body regex cannot match metadata", () => {
  const parsed = parseTarget('---\nstatus: draft\ntitle: "단순히"\n---\n\n본문.\n');
  assert.equal(parsed.frontmatter.status, "draft");
  assert.equal(parsed.frontmatter.title, "단순히");
  assert.equal(parsed.body.includes("status:"), false);
});

test("the runner reads standards from the project, never from the plugin install", () => {
  withRoot((root) => {
    const targetPath = seed(root, { checks: [] });
    checkTarget({ root, targetPath });
    assert.equal(existsSync(join(root, ".scc", "standards", "voice-two-track", "STANDARD.md")), true);
    assert.equal(existsSync(join(root, ".gjc")), false);
  });
});

test("a standards directory that is absent yields an empty report rather than a crash", () => {
  withRoot((root) => {
    mkdirSync(join(root, "nested"), { recursive: true });
    const targetPath = join(root, "nested", "target.md");
    writeFileSync(targetPath, "# 초안\n", "utf8");

    const report = checkTarget({ root, targetPath });

    assert.deepEqual(report.standards, []);
    assert.equal(report.ok, true);
  });
});
