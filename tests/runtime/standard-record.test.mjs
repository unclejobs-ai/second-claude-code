import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MAX_STANDARD_ENTRIES,
  MAX_STANDARD_FILE_BYTES,
  renderStandard,
  writeStandard,
  listActiveStandards,
  supersedeStandard,
} from "../../scripts/lib/standard-record.mjs";

const NOW = new Date("2026-08-10T00:00:00.000Z");

const FORK = {
  id: "voice-two-track",
  title: "두 목소리로 간다",
  chosen: "S-A와 S-B를 서로 다른 화자로 유지한다",
  rejected: [
    { label: "고백조", why: "자기 오류 고백 직후 판매 글은 신뢰를 소급해서 깎는다" },
    { label: "단일 목소리", why: "유형별 반응 차이를 측정할 수 없다" },
  ],
  payload: "### 목소리 A\n건조한 관찰자.\n\n### 목소리 B\n동료 실무자.",
  review_when: "결제 2주치 데이터 확보 시",
  triggers: ["목소리", "voice", "S-A", "S-B"],
};

function withRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), "scc-std-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("renderStandard marks a check-less standard as unenforced", () => {
  const md = renderStandard(FORK, { now: NOW });
  assert.match(md, /^enforcement: none$/m);
  assert.match(md, /^status: active$/m);
  assert.match(md, /^id: voice-two-track$/m);
  assert.match(md, /^decided: 2026-08-10$/m);
});

test("renderStandard round-trips a structured check instead of flattening it", () => {
  // A check is a structured object, not a string like triggers — the JSON.stringify(String(v))
  // path that jsonArray() uses for triggers would flatten it to the literal text "[object Object]",
  // a record that claims enforcement: checked while carrying an unusable check. Phase 2's checker
  // reading it would report a pass with nothing behind it — worse than the empty `checks: []` this
  // replaced.
  const fork = {
    ...FORK,
    checks: [{ kind: "grep", checker: "no-console-log", args: { pattern: "console.log" } }],
  };
  const md = renderStandard(fork, { now: NOW });
  assert.match(md, /^enforcement: checked$/m);
  assert.doesNotMatch(md, /\[object Object\]/, "the structured check was flattened to a string");
  assert.match(md, /"checker":\s*"no-console-log"/, "the checker name did not survive rendering");
  assert.match(md, /"pattern":\s*"console\.log"/, "the check's args did not survive rendering");
});

test("renderStandard keeps every rejected option and its reason", () => {
  const md = renderStandard(FORK, { now: NOW });
  assert.match(md, /고백조/);
  assert.match(md, /신뢰를 소급해서 깎는다/);
  assert.match(md, /단일 목소리/);
  assert.match(md, /측정할 수 없다/);
});

test("renderStandard carries the payload so the decision can be executed", () => {
  const md = renderStandard(FORK, { now: NOW });
  assert.match(md, /건조한 관찰자/);
  assert.match(md, /동료 실무자/);
});

test("renderStandard records triggers and the review condition", () => {
  const md = renderStandard(FORK, { now: NOW });
  assert.match(md, /review_when: "결제 2주치 데이터 확보 시"/);
  assert.match(md, /triggers: \["목소리", "voice", "S-A", "S-B"\]/);
});

test("renderStandard writes supersedes: null when nothing is replaced", () => {
  assert.match(renderStandard(FORK, { now: NOW }), /^supersedes: null$/m);
});

test("writeStandard puts the file at .scc/standards/<id>/STANDARD.md", () => {
  withRoot((root) => {
    const path = writeStandard(root, FORK, { now: NOW });
    assert.equal(path, join(root, ".scc", "standards", "voice-two-track", "STANDARD.md"));
    assert.match(readFileSync(path, "utf8"), /두 목소리로 간다/);
  });
});

test("listActiveStandards returns active records with their triggers", () => {
  withRoot((root) => {
    writeStandard(root, FORK, { now: NOW });
    const active = listActiveStandards(root);
    assert.equal(active.length, 1);
    assert.equal(active[0].id, "voice-two-track");
    assert.equal(active[0].enforcement, "none");
    assert.deepEqual(active[0].triggers, ["목소리", "voice", "S-A", "S-B"]);
  });
});

test("supersedeStandard flips status and never deletes the file", () => {
  withRoot((root) => {
    const path = writeStandard(root, FORK, { now: NOW });
    assert.equal(supersedeStandard(root, "voice-two-track"), true);
    const md = readFileSync(path, "utf8");
    assert.match(md, /^status: superseded$/m);
    assert.match(md, /고백조/, "the rejected options must survive superseding");
  });
});

test("listActiveStandards excludes superseded records", () => {
  withRoot((root) => {
    writeStandard(root, FORK, { now: NOW });
    supersedeStandard(root, "voice-two-track");
    assert.deepEqual(listActiveStandards(root), []);
  });
});

test("listActiveStandards returns an empty list when the tree is absent", () => {
  withRoot((root) => {
    assert.deepEqual(listActiveStandards(root), []);
  });
});

test("listActiveStandards bounds the sorted standard directory", () => {
  withRoot((root) => {
    for (let i = 0; i < MAX_STANDARD_ENTRIES + 8; i += 1) {
      const id = `cap-${String(i).padStart(3, "0")}`;
      writeStandard(root, { ...FORK, id, title: `기준 ${i}` }, { now: NOW });
    }
    const active = listActiveStandards(root);
    assert.equal(active.length, MAX_STANDARD_ENTRIES);
    assert.equal(active[0].id, "cap-000");
    assert.equal(active.at(-1).id, `cap-${String(MAX_STANDARD_ENTRIES - 1).padStart(3, "0")}`);
  });
});

test("listActiveStandards skips a STANDARD.md larger than the byte budget", () => {
  withRoot((root) => {
    writeStandard(root, FORK, { now: NOW });
    const oversizedDir = join(root, ".scc", "standards", "oversized-record");
    mkdirSync(oversizedDir, { recursive: true });
    writeFileSync(
      join(oversizedDir, "STANDARD.md"),
      renderStandard({ ...FORK, id: "oversized-record", title: "너무 큰 기준", payload: "x".repeat(MAX_STANDARD_FILE_BYTES) }, { now: NOW }),
      "utf8"
    );
    const active = listActiveStandards(root);
    assert.ok(active.some((standard) => standard.id === FORK.id));
    assert.ok(!active.some((standard) => standard.id === "oversized-record"));
  });
});

test("listActiveStandards rejects invalid and mismatched entry ids", () => {
  withRoot((root) => {
    const standards = join(root, ".scc", "standards");
    const malformedDir = join(standards, "malformed-entry");
    const mismatchedDir = join(standards, "mismatched-entry");
    mkdirSync(malformedDir, { recursive: true });
    mkdirSync(mismatchedDir, { recursive: true });
    writeFileSync(
      join(malformedDir, "STANDARD.md"),
      renderStandard({ ...FORK, id: "../escape", title: "경로 이탈" }, { now: NOW }),
      "utf8"
    );
    writeFileSync(
      join(mismatchedDir, "STANDARD.md"),
      renderStandard({ ...FORK, id: "different-entry", title: "식별자 불일치" }, { now: NOW }),
      "utf8"
    );
    assert.deepEqual(listActiveStandards(root), []);
  });
});

test("supersedeStandard returns false for an unknown id", () => {
  withRoot((root) => {
    assert.equal(supersedeStandard(root, "nope"), false);
  });
});

test("writeStandard rejects an id containing ../, and nothing is written outside the root", () => {
  withRoot((root) => {
    const maliciousId = "../../../evil";
    assert.throws(() => writeStandard(root, { ...FORK, id: maliciousId }, { now: NOW }));
    const wouldHaveEscaped = join(root, ".scc", "standards", maliciousId, "STANDARD.md");
    assert.equal(existsSync(wouldHaveEscaped), false);
  });
});

test("writeStandard rejects an id containing a newline", () => {
  withRoot((root) => {
    assert.throws(() =>
      writeStandard(root, { ...FORK, id: "legit\nstatus: superseded" }, { now: NOW })
    );
  });
});

test("writeStandard rejects an empty id", () => {
  withRoot((root) => {
    assert.throws(() => writeStandard(root, { ...FORK, id: "" }, { now: NOW }));
  });
});

test("writeStandard never overwrites an oversized existing record", () => {
  withRoot((root) => {
    const path = join(root, ".scc", "standards", FORK.id, "STANDARD.md");
    mkdirSync(join(root, ".scc", "standards", FORK.id), { recursive: true });
    const before = "x".repeat(MAX_STANDARD_FILE_BYTES + 1);
    writeFileSync(path, before, "utf8");
    assert.throws(() => writeStandard(root, FORK, { now: NOW }));
    assert.equal(readFileSync(path, "utf8"), before);
  });
});

test("writeStandard never overwrites an existing record without a readable title", () => {
  withRoot((root) => {
    const path = join(root, ".scc", "standards", FORK.id, "STANDARD.md");
    mkdirSync(join(root, ".scc", "standards", FORK.id), { recursive: true });
    const before = ["---", `id: ${FORK.id}`, "status: active", "---", "", "body without a heading", ""].join("\n");
    writeFileSync(path, before, "utf8");
    assert.throws(() => writeStandard(root, FORK, { now: NOW }));
    assert.equal(readFileSync(path, "utf8"), before);
  });
});

test("a record with a malformed review_when does not prevent the other records from listing", () => {
  withRoot((root) => {
    writeStandard(root, FORK, { now: NOW });
    const brokenDir = join(root, ".scc", "standards", "broken-record");
    mkdirSync(brokenDir, { recursive: true });
    writeFileSync(
      join(brokenDir, "STANDARD.md"),
      [
        "---",
        "id: broken-record",
        "status: active",
        "enforcement: none",
        'review_when: "unterminated',
        "triggers: []",
        "checks: []",
        "---",
        "",
        "# broken",
        "",
      ].join("\n"),
      "utf8"
    );
    const active = listActiveStandards(root);
    assert.equal(active.length, 2);
    const broken = active.find((s) => s.id === "broken-record");
    assert.equal(broken.review_when, "");
    assert.ok(active.some((s) => s.id === "voice-two-track"));
  });
});

test("supersedeStandard succeeds on status:  active with two spaces", () => {
  withRoot((root) => {
    const path = writeStandard(root, FORK, { now: NOW });
    const twoSpaced = readFileSync(path, "utf8").replace(/^status: active$/m, "status:  active");
    writeFileSync(path, twoSpaced, "utf8");
    assert.equal(supersedeStandard(root, "voice-two-track"), true);
    assert.match(readFileSync(path, "utf8"), /^status: superseded$/m);
  });
});

test("supersedeStandard returns false on a second call and leaves the file unchanged", () => {
  withRoot((root) => {
    const path = writeStandard(root, FORK, { now: NOW });
    assert.equal(supersedeStandard(root, "voice-two-track"), true);
    const afterFirst = readFileSync(path, "utf8");
    assert.equal(supersedeStandard(root, "voice-two-track"), false);
    assert.equal(readFileSync(path, "utf8"), afterFirst);
  });
});

test("a status: active line inside the preserved body survives two supersede calls untouched", () => {
  withRoot((root) => {
    const forkWithBodyStatus = { ...FORK, payload: "status: active\n\nleave this line alone" };
    const path = writeStandard(root, forkWithBodyStatus, { now: NOW });
    supersedeStandard(root, "voice-two-track");
    supersedeStandard(root, "voice-two-track");
    const md = readFileSync(path, "utf8");
    assert.match(md, /^status: superseded$/m);
    assert.match(md, /^status: active$/m);
    assert.match(md, /leave this line alone/);
  });
});

test("writing the same id twice with the same title succeeds and updates the record", () => {
  withRoot((root) => {
    writeStandard(root, FORK, { now: NOW });
    const updatedFork = { ...FORK, chosen: "바뀐 결정문" };
    const path = writeStandard(root, updatedFork, { now: NOW });
    assert.match(readFileSync(path, "utf8"), /바뀐 결정문/);
  });
});

test("writing the same id with a different title throws, and the original file is left byte-for-byte unchanged", () => {
  withRoot((root) => {
    const path = writeStandard(root, FORK, { now: NOW });
    const before = readFileSync(path, "utf8");
    assert.throws(() => writeStandard(root, { ...FORK, title: "다른 결정" }, { now: NOW }));
    assert.equal(readFileSync(path, "utf8"), before);
  });
});

test("the collision error names both titles", () => {
  withRoot((root) => {
    writeStandard(root, FORK, { now: NOW });
    assert.throws(
      () => writeStandard(root, { ...FORK, title: "다른 결정" }, { now: NOW }),
      (err) => err.message.includes(FORK.title) && err.message.includes("다른 결정")
    );
  });
});
