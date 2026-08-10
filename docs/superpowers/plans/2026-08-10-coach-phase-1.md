# Coach Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `deep-interview`를 `coach`로 바꾸고, 결정이 사용자 프로젝트에 기준 문서로 남아 세션을 넘어 살아 있게 만든다.

**Architecture:** 러너는 프로젝트 루트를 `CLAUDE_PROJECT_DIR`에서 해석하고 플러그인 경로 안이면 거부한다. 상태와 기준 문서는 `<project>/.scc/` 아래에 저장한다. 갈림길 하나가 기준 문서 하나가 되며, 훅 네 곳이 그것을 세션 시작에 싣고 충돌 시 제시하고 미완 인터뷰를 막고 압축 너머로 전달한다.

**Tech Stack:** JavaScript ESM (.mjs), Node 20+, `node --test`. 빌드 단계 없음.

## Global Constraints

- 언어는 JavaScript ESM(`.mjs`)만. TypeScript와 빌드 단계를 추가하지 않는다.
- Node `>=20.0.0`.
- 런타임 의존성은 `@modelcontextprotocol/sdk` 하나뿐이다. **새 npm 의존성을 추가하지 않는다.**
- `hooks/hooks.json`을 수정하지 않는다. 6개 이벤트가 이미 등록돼 있으므로 기존 진입점의 동작만 바꾼다.
- `agents/*.md`의 `model:` 티어를 변경하지 않는다.
- 셸 문자열을 실행하는 경로를 만들지 않는다.
- 레거시 `.gjc` 데이터를 읽거나 옮기는 경로를 만들지 않는다.
- 파일당 500 LOC를 넘지 않는다. 넘으면 책임 단위로 분리한다.
- 테스트는 `node --test 'tests/**/*.test.mjs'`로 전부 통과해야 한다.
- 작업은 워크트리 `/Users/parkeungje/project/second-claude-standards`, 브랜치 `feat/decision-standards`에서 한다. 공유 작업 디렉터리에서 작업하지 않는다.

## File Structure

| 파일 | 책임 |
|---|---|
| `scripts/lib/project-root.mjs` (신규) | 프로젝트 루트 해석과 플러그인 경로 거부. 이것만 한다 |
| `scripts/lib/coach-state.mjs` (신규) | `<root>/.scc/state/coach.json` 읽기·쓰기·삭제 |
| `scripts/lib/standard-record.mjs` (신규) | 기준 문서 렌더링과 디렉터리 쓰기 |
| `scripts/coach-runner.mjs` (개명) | CLI. 위 셋을 조립한다 |
| `hooks/session-start.mjs` (수정) | 활성 기준 주입, 명령어·디스패치 배너 제거 |
| `hooks/prompt-detect.mjs` (수정) | 기준 충돌 대조. 키워드 라우팅 삭제 |
| `hooks/session-end.mjs` (수정) | 미완 인터뷰 차단 사유 추가 |
| `hooks/compaction.mjs` (수정) | 기준·인터뷰 상태를 압축 너머로 전달 |

새 모듈을 셋으로 나눈 이유는 `deep-interview-runner.mjs`가 이미 690줄이기 때문이다. 여기에 더 얹으면 500 LOC 제약을 넘고, 루트 해석 같은 작은 로직이 대형 파일 안에 묻혀 테스트하기 어려워진다.

---

### Task 1: 프로젝트 루트 해석과 플러그인 경로 거부

**Files:**
- Create: `scripts/lib/project-root.mjs`
- Test: `tests/runtime/project-root.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `resolveProjectRoot({ env, cwd, moduleUrl }) -> string` — 루트 절대경로. 플러그인 설치 경로 안이면 `Error`를 던진다.
  - `isInsidePluginInstall(root, moduleUrl) -> boolean`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/runtime/project-root.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { resolveProjectRoot, isInsidePluginInstall } from "../../scripts/lib/project-root.mjs";

test("resolveProjectRoot prefers CLAUDE_PROJECT_DIR over cwd", () => {
  const project = mkdtempSync(join(tmpdir(), "scc-proj-"));
  const install = mkdtempSync(join(tmpdir(), "scc-plugin-"));
  try {
    const moduleUrl = pathToFileURL(join(install, "scripts", "lib", "project-root.mjs")).href;
    const root = resolveProjectRoot({
      env: { CLAUDE_PROJECT_DIR: project },
      cwd: "/some/other/place",
      moduleUrl,
    });
    assert.equal(root, project);
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(install, { recursive: true, force: true });
  }
});

test("resolveProjectRoot falls back to cwd when the env var is unset", () => {
  const project = mkdtempSync(join(tmpdir(), "scc-proj-"));
  const install = mkdtempSync(join(tmpdir(), "scc-plugin-"));
  try {
    const moduleUrl = pathToFileURL(join(install, "scripts", "lib", "project-root.mjs")).href;
    assert.equal(resolveProjectRoot({ env: {}, cwd: project, moduleUrl }), project);
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(install, { recursive: true, force: true });
  }
});

test("resolveProjectRoot refuses the plugin root itself, which is the original bug", () => {
  const install = mkdtempSync(join(tmpdir(), "scc-plugin-"));
  try {
    mkdirSync(join(install, "scripts", "lib"), { recursive: true });
    const moduleUrl = pathToFileURL(join(install, "scripts", "lib", "project-root.mjs")).href;
    assert.throws(
      () => resolveProjectRoot({ env: {}, cwd: install, moduleUrl }),
      /\ud50c\ub7ec\uadf8\uc778 \uc124\uce58 \uacbd\ub85c/,
      "the runner used to resolve its own install directory as the root"
    );
  } finally {
    rmSync(install, { recursive: true, force: true });
  }
});

test("resolveProjectRoot refuses a root inside the plugin install", () => {
  const install = mkdtempSync(join(tmpdir(), "scc-plugin-"));
  try {
    mkdirSync(join(install, "scripts", "lib"), { recursive: true });
    const moduleUrl = pathToFileURL(join(install, "scripts", "lib", "project-root.mjs")).href;
    assert.throws(
      () => resolveProjectRoot({ env: { CLAUDE_PROJECT_DIR: install }, cwd: install, moduleUrl }),
      /플러그인 설치 경로/
    );
  } finally {
    rmSync(install, { recursive: true, force: true });
  }
});

test("isInsidePluginInstall detects a nested directory, not just an exact match", () => {
  const install = mkdtempSync(join(tmpdir(), "scc-plugin-"));
  try {
    mkdirSync(join(install, "scripts", "lib"), { recursive: true });
    const moduleUrl = pathToFileURL(join(install, "scripts", "lib", "project-root.mjs")).href;
    assert.equal(isInsidePluginInstall(join(install, ".gjc", "specs"), moduleUrl), true);
    assert.equal(isInsidePluginInstall("/tmp/unrelated-project", moduleUrl), false);
  } finally {
    rmSync(install, { recursive: true, force: true });
  }
});

test("isInsidePluginInstall does not match a sibling with a shared name prefix", () => {
  const base = mkdtempSync(join(tmpdir(), "scc-sib-"));
  try {
    const install = join(base, "scc");
    mkdirSync(join(install, "scripts", "lib"), { recursive: true });
    const moduleUrl = pathToFileURL(join(install, "scripts", "lib", "project-root.mjs")).href;
    assert.equal(isInsidePluginInstall(join(base, "scc-standards"), moduleUrl), false);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `node --test tests/runtime/project-root.test.mjs`
Expected: FAIL — `Cannot find module '../../scripts/lib/project-root.mjs'`

- [ ] **Step 3: 최소 구현을 쓴다**

`scripts/lib/project-root.mjs`:

```javascript
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The plugin install root: two levels above this module (scripts/lib → scripts → root).
 */
function pluginRootFrom(moduleUrl) {
  return resolve(dirname(fileURLToPath(moduleUrl)), "..", "..");
}

export function isInsidePluginInstall(root, moduleUrl = import.meta.url) {
  const pluginRoot = pluginRootFrom(moduleUrl);
  const target = resolve(root);
  if (target === pluginRoot) return true;
  // Compare with a trailing separator so `/a/scc-standards` does not match `/a/scc`.
  return target.startsWith(pluginRoot + sep);
}

export function resolveProjectRoot({
  env = process.env,
  cwd = process.cwd(),
  moduleUrl = import.meta.url,
} = {}) {
  const root = resolve(env.CLAUDE_PROJECT_DIR || cwd);
  if (isInsidePluginInstall(root, moduleUrl)) {
    throw new Error(
      `프로젝트 루트가 플러그인 설치 경로 안입니다: ${root}. ` +
        `CLAUDE_PROJECT_DIR을 설정하거나 프로젝트 디렉터리에서 실행하십시오.`
    );
  }
  return root;
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `node --test tests/runtime/project-root.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋한다**

```bash
git add scripts/lib/project-root.mjs tests/runtime/project-root.test.mjs
git commit -m "feat(coach): resolve the project root, and refuse the plugin directory

The old runner took its own install path as the root, which is how a
session's spec ended up inside a versioned plugin cache. The guard makes
that shape unrepresentable rather than merely discouraged."
```

---

### Task 2: 프로젝트 로컬 상태 저장소

**Files:**
- Create: `scripts/lib/coach-state.mjs`
- Test: `tests/runtime/coach-state.test.mjs`

**Interfaces:**
- Consumes: `resolveProjectRoot` (Task 1) — 호출자가 이미 해석한 `root`를 넘긴다
- Produces:
  - `stateFilePath(root) -> string` (`<root>/.scc/state/coach.json`)
  - `readState(root) -> object | null`
  - `writeState(root, value) -> object`
  - `clearState(root) -> void`

`scripts/state-manager.sh`를 쓰지 않는다. 그 스크립트는 `DATA_DIR="${CLAUDE_PLUGIN_DATA:-${PLUGIN_ROOT}/.data}"`(`state-manager.sh:22`)로 플러그인 안에 상태를 두며, 이것이 프로젝트끼리 인터뷰를 덮어쓴 원인이다. 셸 의존성도 함께 사라진다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/runtime/coach-state.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readState, writeState, clearState, stateFilePath } from "../../scripts/lib/coach-state.mjs";

function withTempRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), "scc-state-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("state lives under the project, not the plugin", () => {
  withTempRoot((root) => {
    assert.equal(stateFilePath(root), join(root, ".scc", "state", "coach.json"));
  });
});

test("readState returns null when nothing has been written", () => {
  withTempRoot((root) => {
    assert.equal(readState(root), null);
  });
});

test("writeState then readState round-trips the value", () => {
  withTempRoot((root) => {
    const value = { run_id: "r1", round: 2, forks: [] };
    writeState(root, value);
    assert.deepEqual(readState(root), value);
  });
});

test("writeState creates the directory tree when it is missing", () => {
  withTempRoot((root) => {
    writeState(root, { run_id: "r1" });
    assert.equal(existsSync(join(root, ".scc", "state")), true);
  });
});

test("clearState removes the file and readState goes back to null", () => {
  withTempRoot((root) => {
    writeState(root, { run_id: "r1" });
    clearState(root);
    assert.equal(readState(root), null);
  });
});

test("clearState on an absent file does not throw", () => {
  withTempRoot((root) => {
    assert.doesNotThrow(() => clearState(root));
  });
});

test("readState returns null for corrupt JSON instead of throwing", () => {
  withTempRoot((root) => {
    mkdirSync(join(root, ".scc", "state"), { recursive: true });
    writeFileSync(stateFilePath(root), "{ not json", "utf8");
    assert.equal(readState(root), null);
  });
});

test("two roots keep separate state", () => {
  withTempRoot((a) => {
    withTempRoot((b) => {
      writeState(a, { run_id: "a" });
      writeState(b, { run_id: "b" });
      assert.equal(readState(a).run_id, "a");
      assert.equal(readState(b).run_id, "b");
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `node --test tests/runtime/coach-state.test.mjs`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 최소 구현을 쓴다**

`scripts/lib/coach-state.mjs`:

```javascript
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function stateFilePath(root) {
  return join(root, ".scc", "state", "coach.json");
}

export function readState(root) {
  const path = stateFilePath(root);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    // A corrupt state file reads as "no interview" rather than crashing the CLI.
    return null;
  }
}

export function writeState(root, value) {
  const path = stateFilePath(root);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return value;
}

export function clearState(root) {
  rmSync(stateFilePath(root), { force: true });
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `node --test tests/runtime/coach-state.test.mjs`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋한다**

```bash
git add scripts/lib/coach-state.mjs tests/runtime/coach-state.test.mjs
git commit -m "feat(coach): keep interview state in the project

state-manager.sh writes under the plugin root, so every project shared one
interview and the last one to run won. State now sits beside the project it
belongs to, and the shell dependency goes with it."
```

---

### Task 3: 기준 문서 렌더링과 쓰기

**Files:**
- Create: `scripts/lib/standard-record.mjs`
- Test: `tests/runtime/standard-record.test.mjs`

**Interfaces:**
- Consumes: 없음 (순수 함수 + 파일 쓰기)
- Produces:
  - `Fork` 형태: `{ id, title, chosen, rejected: [{ label, why }], payload, review_when, triggers }`
  - `renderStandard(fork, { now, supersedes }) -> string` — STANDARD.md 전문
  - `writeStandard(root, fork, { now, supersedes }) -> string` — 쓰인 경로
  - `listActiveStandards(root) -> [{ id, title, review_when, triggers, enforcement, path }]`
  - `supersedeStandard(root, oldId) -> boolean` — `status`를 `superseded`로 바꾼다. 삭제하지 않는다

1단계에서는 `checks`가 비어 있으므로 `enforcement: none`으로 쓴다. 검사 실행기는 2단계다. 비어 있는 것을 숨기지 않고 표시하는 것이 설계다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/runtime/standard-record.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
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

test("supersedeStandard returns false for an unknown id", () => {
  withRoot((root) => {
    assert.equal(supersedeStandard(root, "nope"), false);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `node --test tests/runtime/standard-record.test.mjs`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 최소 구현을 쓴다**

`scripts/lib/standard-record.mjs`:

```javascript
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function standardsDir(root) {
  return join(root, ".scc", "standards");
}

function standardPath(root, id) {
  return join(standardsDir(root), id, "STANDARD.md");
}

function jsonArray(values) {
  return `[${(values || []).map((v) => JSON.stringify(String(v))).join(", ")}]`;
}

export function renderStandard(fork, { now = new Date(), supersedes = null } = {}) {
  const decided = now.toISOString().slice(0, 10);
  const checks = Array.isArray(fork.checks) ? fork.checks : [];
  const enforcement = checks.length > 0 ? "checked" : "none";
  const rejected = (fork.rejected || [])
    .map((option) => `- **${option.label}** — ${option.why}`)
    .join("\n");

  return `---
id: ${fork.id}
status: active
enforcement: ${enforcement}
decided: ${decided}
review_when: ${JSON.stringify(fork.review_when || "")}
supersedes: ${supersedes ? JSON.stringify(supersedes) : "null"}
triggers: ${jsonArray(fork.triggers)}
checks: []
---

# ${fork.title}

## 고른 것

${fork.chosen}

## 탈락

${rejected || "- (기록된 대안 없음)"}

## 실행 재료

${fork.payload || "(없음)"}

## 지키는 법

${
  enforcement === "checked"
    ? "이 기준에는 준수 검사가 붙어 있다."
    : "준수 검사가 아직 없다. 위반을 기계로 잡지 못하므로 사람이 확인해야 한다."
}
`;
}

export function writeStandard(root, fork, options = {}) {
  const path = standardPath(root, fork.id);
  mkdirSync(join(standardsDir(root), fork.id), { recursive: true });
  writeFileSync(path, renderStandard(fork, options), "utf8");
  return path;
}

function readField(body, field) {
  const match = body.match(new RegExp(`^${field}:\\s*(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

function parseJsonField(body, field) {
  const raw = readField(body, field);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listActiveStandards(root) {
  const dir = standardsDir(root);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = standardPath(root, entry.name);
    if (!existsSync(path)) continue;
    const body = readFileSync(path, "utf8");
    if (readField(body, "status") !== "active") continue;
    const title = body.match(/^# (.+)$/m);
    out.push({
      id: readField(body, "id") || entry.name,
      title: title ? title[1].trim() : entry.name,
      review_when: JSON.parse(readField(body, "review_when") || '""'),
      triggers: parseJsonField(body, "triggers"),
      enforcement: readField(body, "enforcement") || "none",
      path,
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function supersedeStandard(root, id) {
  const path = standardPath(root, id);
  if (!existsSync(path)) return false;
  const body = readFileSync(path, "utf8");
  writeFileSync(path, body.replace(/^status: active$/m, "status: superseded"), "utf8");
  return true;
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `node --test tests/runtime/standard-record.test.mjs`
Expected: PASS (11 tests)

- [ ] **Step 5: 커밋한다**

```bash
git add scripts/lib/standard-record.mjs tests/runtime/standard-record.test.mjs
git commit -m "feat(coach): one record per fork, with the losers kept

A standard carries the options that lost and why, so a later session
proposing one of them meets its own rejection instead of relitigating it.
Superseding rewrites status and leaves the file; the graveyard is the point.

Phase 1 standards ship unenforced and say so. The check runner is phase 2,
and a record that pretended otherwise would be worse than an honest gap."
```

---

### Task 4: 러너를 새 모듈에 연결하고 `.gjc`를 걷어낸다

**Files:**
- Modify: `scripts/deep-interview-runner.mjs` — `createStateAdapter`(:558), `writeSpecFile`(:575), `finalizeState`(:585), `renderApprovalOptions`(:541), `resolveThreshold`(:40), `runCli`(:633)
- Modify: `tests/runtime/deep-interview-runner.test.mjs` — `.gjc` 단언(:100, :238-251)
- Modify: `tests/contracts/deep-interview-contracts.test.mjs` — `.gjc` 단언(:60)

**Interfaces:**
- Consumes: `resolveProjectRoot`(Task 1), `readState`/`writeState`/`clearState`(Task 2), `writeStandard`/`supersedeStandard`(Task 3)
- Produces:
  - `record-fork --file <path>` CLI 명령 — 갈림길 하나를 기준 문서로 확정한다
  - `finalize`는 `spec_path` 대신 `standard_paths: string[]`을 반환한다

`record-fork`를 추가하는 이유: 현행 상태 구조에는 "무엇을 놓고 골랐는가"가 없다. 점수 루프(`applyAnswer`, `scoreFromTranscript`)를 다시 쓰는 대신, 갈림길이 해결될 때 스킬이 선택지 묶음을 파일로 넘기게 한다. 러너는 기계로 남는다. 인수를 argv가 아니라 파일로 받는 것은 다국어 본문과 줄바꿈이 셸을 통과하며 깨지기 때문이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/runtime/coach-runner-cli.test.mjs`:

```javascript
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
```

`useRealRootResolution` 플래그는 테스트에서만 실제 해석 경로를 강제한다. 다른 테스트는 `deps.root`를 직접 넘겨 임시 디렉터리를 쓴다.

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `node --test tests/runtime/coach-runner-cli.test.mjs`
Expected: FAIL — `unknown command: record-fork`

- [ ] **Step 3: 러너를 수정한다**

`scripts/deep-interview-runner.mjs` 상단에 임포트를 더한다:

```javascript
import { resolveProjectRoot } from "./lib/project-root.mjs";
import { readState, writeState, clearState } from "./lib/coach-state.mjs";
import { writeStandard } from "./lib/standard-record.mjs";
```

`createStateAdapter`(:558) 전체를 지우고 다음으로 바꾼다:

```javascript
export function createStateAdapter({ root }) {
  return {
    read: () => readState(root),
    write: (value) => writeState(root, value),
    clear: () => clearState(root),
  };
}
```

`writeSpecFile`(:575)를 지운다. `renderSpec`은 남긴다 — Plan Mode 브리핑에서 계속 쓴다.

`finalizeState`(:585)를 다음으로 바꾼다:

```javascript
export function finalizeState(state, { now = new Date() } = {}) {
  const next = structuredCloneCompat(state);
  next.standard_ids = Array.isArray(next.forks) ? [...next.forks] : [];
  next.approval_options = renderApprovalOptions(next.standard_ids, next.current_ambiguity, next.language);
  next.status = "pending_approval";
  next.updated_at = now.toISOString();
  return next;
}
```

`resolveThreshold`(:40)에서 설정 경로와 키를 바꾼다:

```javascript
  const configDir = home ? join(home, ".scc") : "";
  const projectPath = options.projectSettingsPath || join(cwd, ".scc", "settings.json");
  const userValue = readJson(userPath)?.scc?.coach?.ambiguityThreshold;
  const projectValue = readJson(projectPath)?.scc?.coach?.ambiguityThreshold;
```

`thresholdResult` 호출의 출처 문자열도 `"./.scc/settings.json"`과 `"~/.scc/settings.json"`으로 바꾼다. `GJC_CONFIG_DIR` 분기는 삭제한다.

`runCli`(:633)의 첫 줄과 `finalize`·신규 분기를 바꾼다:

```javascript
export function runCli(argv = process.argv.slice(2), deps = {}) {
  const root =
    deps.root && !deps.useRealRootResolution
      ? deps.root
      : resolveProjectRoot({ env: deps.env || process.env, cwd: deps.cwd || process.cwd() });
  const adapter = deps.adapter || createStateAdapter({ root });
```

`finalize` 분기를 바꾼다:

```javascript
  if (command === "finalize") {
    const current = adapter.read();
    if (!current) throw new Error("no active coach interview");
    const next = finalizeState(current, { now: deps.now || new Date() });
    adapter.write(next);
    return output(
      {
        active: true,
        standard_ids: next.standard_ids,
        approval_options: next.approval_options,
        ambiguity: next.current_ambiguity,
      },
      json
    );
  }
```

`clear` 분기 앞에 `record-fork` 분기를 넣는다:

```javascript
  if (command === "record-fork") {
    const file = flags.file;
    if (!file) throw new Error("record-fork requires --file <path>");
    const fork = readJsonFile(file, null);
    if (!fork) throw new Error(`record-fork could not read a JSON object from ${file}`);
    if (!fork.id) throw new Error("record-fork requires the fork to declare an id");

    const current = adapter.read();
    if (!current) throw new Error("no active coach interview");

    const path = writeStandard(root, fork, { now: deps.now || new Date() });
    const forks = Array.isArray(current.forks) ? current.forks : [];
    if (!forks.includes(fork.id)) forks.push(fork.id);
    adapter.write({ ...current, forks });

    return output({ ok: true, id: fork.id, path }, json);
  }
```

- [ ] **Step 4: 승인 선택지에서 gjc 명령을 걷어낸다**

`renderApprovalOptions`(:541)를 통째로 바꾼다:

```javascript
export function renderApprovalOptions(standardIds, ambiguity, language = { code: "en" }) {
  const ko = language?.code === "ko";
  const count = Array.isArray(standardIds) ? standardIds.length : 0;
  return ko
    ? [
        { id: "confirm", label: `기준 ${count}개를 확정하고 인터뷰 종료`, recommended: true, standardIds, ambiguity },
        { id: "continue", label: "계속 정제하기", recommended: false, standardIds, ambiguity },
        { id: "plan-mode", label: "확정된 기준을 브리핑으로 Plan Mode에 넘기기", recommended: false, standardIds, ambiguity },
      ]
    : [
        { id: "confirm", label: `Confirm ${count} standard(s) and end the interview`, recommended: true, standardIds, ambiguity },
        { id: "continue", label: "Keep refining", recommended: false, standardIds, ambiguity },
        { id: "plan-mode", label: "Hand the confirmed standards to Plan Mode as a briefing", recommended: false, standardIds, ambiguity },
      ];
}
```

- [ ] **Step 5: 기존 테스트의 `.gjc` 단언을 고친다**

`tests/runtime/deep-interview-runner.test.mjs`:
- `:100` — `assert.match(finalized.spec_path, /\.gjc\/specs\/...$/)` 를 지우고 `assert.deepEqual(finalized.standard_ids, [])` 로 바꾼다.
- `:238-251` — `join(home, ".gjc")` → `join(home, ".scc")`, `join(root, ".gjc")` → `join(root, ".scc")`, 설정 키를 `{ scc: { coach: { ambiguityThreshold: ... } } }` 로, 출처 단언을 `"./.scc/settings.json"` 과 `/\.scc\/settings\.json$/` 로 바꾼다.

`tests/contracts/deep-interview-contracts.test.mjs`:
- `:60` — `assert.match(docs, /\.gjc\/specs\/deep-interview-\{slug\}\.md/)` 를 `assert.match(docs, /\.scc\/standards\//)` 로 바꾼다.

- [ ] **Step 6: 전체 테스트를 돌린다**

Run: `npm test`
Expected: PASS. `.gjc` 관련 실패가 남으면 그 단언을 위 규칙대로 고친다.

- [ ] **Step 7: 커밋한다**

```bash
git add scripts/deep-interview-runner.mjs tests/
git commit -m "feat(coach): emit standards into the project and drop the gjc namespace

finalize used to write one spec into whatever directory the script lived
in. It now records one standard per fork under the project's .scc, and the
approval options stop offering ralplan, ultragoal and team — commands this
plugin has never had.

record-fork takes its input as a file rather than argv because the payload
carries newlines and non-ASCII prose that a shell round-trip mangles."
```

---

### Task 5: coach로 개명한다

**Files:**
- Rename: `scripts/deep-interview-runner.mjs` → `scripts/coach-runner.mjs`
- Rename: `skills/deep-interview/` → `skills/coach/`
- Rename: `commands/deep-interview.md` → `commands/coach.md`
- Rename: `tests/runtime/deep-interview-runner.test.mjs` → `tests/runtime/coach-runner.test.mjs`
- Rename: `tests/contracts/deep-interview-contracts.test.mjs` → `tests/contracts/coach-contracts.test.mjs`
- Modify: `skills/coach/SKILL.md`, `commands/coach.md`, 그리고 위를 참조하는 모든 파일

**Interfaces:**
- Consumes: Task 4의 러너
- Produces: `skills/coach/SKILL.md`의 `name: coach`. `/scc:coach` 명령. `disable-model-invocation`은 **설정하지 않는다** — coach는 모델도 호출할 수 있어야 한다

- [ ] **Step 1: 파일을 옮긴다**

```bash
git mv scripts/deep-interview-runner.mjs scripts/coach-runner.mjs
git mv skills/deep-interview skills/coach
git mv commands/deep-interview.md commands/coach.md
git mv tests/runtime/deep-interview-runner.test.mjs tests/runtime/coach-runner.test.mjs
git mv tests/contracts/deep-interview-contracts.test.mjs tests/contracts/coach-contracts.test.mjs
git mv tests/runtime/coach-runner-cli.test.mjs tests/runtime/coach-cli.test.mjs
```

- [ ] **Step 2: 남은 참조를 전부 찾는다**

```bash
rg -l "deep-interview|deep_interview|deepInterview" --glob '!node_modules' --glob '!docs/superpowers/**' .
```

- [ ] **Step 3: 참조를 고친다**

각 파일에서 `deep-interview-runner.mjs` → `coach-runner.mjs`, `skills/deep-interview` → `skills/coach`, `/scc:deep-interview` → `/scc:coach`, `name: deep-interview` → `name: coach` 로 바꾼다.

`skills/coach/SKILL.md` 프론트매터를 바꾼다:

```yaml
---
name: coach
description: "Use when a request has more than one defensible direction and no active standard covers it — a fork that has to be settled before work starts"
effort: high
---
```

`description`은 트리거만 말하고 절차를 요약하지 않는다. 절차를 요약하면 모델이 본문 대신 요약을 따른다.

`SKILL.md` 본문에서 `.gjc/specs/...` 문장을 `.scc/standards/<id>/STANDARD.md` 로, `ralplan, ultragoal, team` 문장을 Task 4의 승인 선택지 셋으로 바꾼다.

- [ ] **Step 4: 전체 테스트를 돌린다**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 스킬 계약 검사를 돌린다**

```bash
for d in skills/*/; do [ -f "${d}SKILL.md" ] || echo "MISSING SKILL.md: $d"; done
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"
node --check scripts/coach-runner.mjs scripts/lib/*.mjs
```

Expected: 출력 없음(정상), JSON 파싱 성공, 구문 오류 없음

- [ ] **Step 6: 커밋한다**

```bash
git add -A
git commit -m "refactor(coach): rename deep-interview

The old name made the user sound like the one being interrogated, and it
came from another project's plugin. The description states only when to
reach for the skill; summarising the workflow there gives the model a
shortcut it takes instead of reading the body."
```

---

### Task 6: SessionStart — 활성 기준을 싣고 배너를 걷어낸다

**Files:**
- Modify: `hooks/session-start.mjs` — `main()`(:160), 명령어 표(:168-170)
- Test: `tests/hooks/session-start-standards.test.mjs`

**Interfaces:**
- Consumes: `listActiveStandards`(Task 3), `readState`(Task 2), `resolveProjectRoot`(Task 1)
- Produces: 훅 stdout에 `## 활성 기준` 절

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hooks/session-start-standards.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeStandard, supersedeStandard } from "../../scripts/lib/standard-record.mjs";
import { writeState } from "../../scripts/lib/coach-state.mjs";

const HOOK = join(process.cwd(), "hooks", "session-start.mjs");
const NOW = new Date("2026-08-10T00:00:00.000Z");

function fork(id, title) {
  return { id, title, chosen: "c", rejected: [], payload: "", review_when: "when", triggers: [id] };
}

function runHook(root) {
  return execFileSync("node", [HOOK], {
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: "{}",
  });
}

function withRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), "scc-hook-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("active standards appear in the session-start output", () => {
  withRoot((root) => {
    writeStandard(root, fork("voice-two-track", "두 목소리로 간다"), { now: NOW });
    const out = runHook(root);
    assert.match(out, /voice-two-track/);
    assert.match(out, /두 목소리로 간다/);
  });
});

test("superseded standards are not loaded", () => {
  withRoot((root) => {
    writeStandard(root, fork("retired", "폐기된 것"), { now: NOW });
    supersedeStandard(root, "retired");
    assert.doesNotMatch(runHook(root), /폐기된 것/);
  });
});

test("an unfinished interview is announced", () => {
  withRoot((root) => {
    writeState(root, { run_id: "r1", forks: ["a"], status: "in_progress" });
    assert.match(runHook(root), /인터뷰/);
  });
});

test("the standards block stays within its 200-word budget", () => {
  withRoot((root) => {
    for (let i = 0; i < 20; i += 1) {
      writeStandard(root, fork(`std-${i}`, `기준 ${i}`), { now: NOW });
    }
    const out = runHook(root);
    const block = out.split("## 활성 기준")[1] || "";
    assert.ok(block.split(/\s+/).filter(Boolean).length <= 200, "standards block exceeded 200 words");
  });
});

test("at most 12 standards are listed", () => {
  withRoot((root) => {
    for (let i = 0; i < 20; i += 1) {
      writeStandard(root, fork(`std-${i}`, `기준 ${i}`), { now: NOW });
    }
    const out = runHook(root);
    const listed = (out.match(/^- std-\d+/gm) || []).length;
    assert.ok(listed <= 12, `listed ${listed} standards`);
  });
});

test("the eighteen-command banner is gone", () => {
  withRoot((root) => {
    const out = runHook(root);
    assert.doesNotMatch(out, /18 commands/);
    assert.doesNotMatch(out, /Active Plugin Dispatch/);
  });
});

test("a project with no standards still exits cleanly", () => {
  withRoot((root) => {
    assert.doesNotThrow(() => runHook(root));
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `node --test tests/hooks/session-start-standards.test.mjs`
Expected: FAIL — `18 commands` 배너가 아직 있고 활성 기준 절이 없다

- [ ] **Step 3: 훅을 수정한다**

`hooks/session-start.mjs`의 임포트에 더한다:

```javascript
import { listActiveStandards } from "../scripts/lib/standard-record.mjs";
import { readState } from "../scripts/lib/coach-state.mjs";
```

`main()` 안에서 `lines.push("18 commands for all knowledge work:")`부터 명령어 표 전체와 플러그인 디스패치 절을 지우고 다음으로 바꾼다:

```javascript
  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const standards = listActiveStandards(projectRoot).slice(0, 12);

  if (standards.length > 0) {
    lines.push("## 활성 기준");
    lines.push("");
    for (const s of standards) {
      const when = s.review_when ? ` · 재검토: ${s.review_when}` : "";
      const unenforced = s.enforcement === "none" ? " · 검사없음" : "";
      lines.push(`- ${s.id} — ${s.title}${when}${unenforced}`);
    }
    lines.push("");
    lines.push("실행 재료는 해당 기준에 걸리는 작업을 시작할 때 읽는다.");
    lines.push("");
  }

  const coachState = readState(projectRoot);
  if (coachState && coachState.status !== "pending_approval") {
    const settled = Array.isArray(coachState.forks) ? coachState.forks.length : 0;
    lines.push(`미완 coach 인터뷰가 있다. 확정된 갈림길 ${settled}개. \`/scc:coach --resume\``);
    lines.push("");
  }
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `node --test tests/hooks/session-start-standards.test.mjs`
Expected: PASS (7 tests)

- [ ] **Step 5: 기존 세션 훅 테스트를 돌린다**

Run: `node --test tests/hooks/session-start.test.mjs`
Expected: PASS. 배너 문자열을 단언하던 테스트가 실패하면 그 단언을 삭제한다 — 배너는 의도적으로 사라졌다.

- [ ] **Step 6: 커밋한다**

```bash
git add hooks/session-start.mjs tests/hooks/
git commit -m "feat(hooks): open the session with the standards, not a menu

Listing eighteen commands every session taught nothing; the model still had
to guess. Active standards are what a session actually needs to know before
it starts, and the payload stays on disk until work touches it."
```

---

### Task 7: UserPromptSubmit — 기준 충돌 대조, 키워드 라우팅 삭제

**Files:**
- Modify: `hooks/prompt-detect.mjs` — 스킬 점수 계층(:140-190)과 `[ROUTING]` 출력
- Test: `tests/hooks/prompt-detect-standards.test.mjs`

**Interfaces:**
- Consumes: `listActiveStandards`(Task 3)
- Produces: 훅 stdout에 충돌 기준 안내. 스킬 호출 지시는 내지 않는다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hooks/prompt-detect-standards.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeStandard } from "../../scripts/lib/standard-record.mjs";

const HOOK = join(process.cwd(), "hooks", "prompt-detect.mjs");
const NOW = new Date("2026-08-10T00:00:00.000Z");

function withRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), "scc-pd-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runHook(root, prompt) {
  return execFileSync("node", [HOOK], {
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({ prompt }),
  });
}

const VOICE = {
  id: "voice-two-track",
  title: "두 목소리로 간다",
  chosen: "S-A와 S-B를 분리한다",
  rejected: [{ label: "고백조", why: "신뢰를 깎는다" }],
  payload: "",
  review_when: "",
  triggers: ["목소리", "S-A"],
};

test("a prompt containing a trigger surfaces the standard", () => {
  withRoot((root) => {
    writeStandard(root, VOICE, { now: NOW });
    const out = runHook(root, "이번 글 목소리 어떻게 갈까");
    assert.match(out, /voice-two-track/);
  });
});

test("an unrelated prompt stays silent", () => {
  withRoot((root) => {
    writeStandard(root, VOICE, { now: NOW });
    assert.equal(runHook(root, "이 함수 리팩터링 해줘").trim(), "");
  });
});

test("a standard with no triggers never fires", () => {
  withRoot((root) => {
    writeStandard(root, { ...VOICE, id: "silent", triggers: [] }, { now: NOW });
    assert.equal(runHook(root, "목소리 어떻게 갈까").trim(), "");
  });
});

test("the hook never instructs a skill invocation", () => {
  withRoot((root) => {
    writeStandard(root, VOICE, { now: NOW });
    const out = runHook(root, "이번 글 목소리 어떻게 갈까");
    assert.doesNotMatch(out, /MUST invoke/);
    assert.doesNotMatch(out, /\[ROUTING\]/);
  });
});

test("an architecture prompt does not route to a content skill", () => {
  // Regression: during the design session this hook twice told the model to
  // invoke scc:refine on an architecture turn.
  withRoot((root) => {
    const out = runHook(root, "스킬 구조를 전면 재설계하고 훅을 고쳐야 해");
    assert.doesNotMatch(out, /scc:refine/);
    assert.doesNotMatch(out, /MUST invoke/);
  });
});

test("a project with no standards produces no output", () => {
  withRoot((root) => {
    assert.equal(runHook(root, "아무 말").trim(), "");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `node --test tests/hooks/prompt-detect-standards.test.mjs`
Expected: FAIL — `[ROUTING]`과 `MUST invoke`가 아직 나온다

- [ ] **Step 3: 훅을 다시 쓴다**

`hooks/prompt-detect.mjs`에서 스킬 점수 계층(`computeRouteConfidence`, `matchesAny`, `KOREAN_NEGATION`, `isNegatedAt`, 라우트 테이블, `ROUTE_STATE_FILE` 관련 전부)을 삭제하고 본문을 다음으로 바꾼다:

```javascript
import { listActiveStandards } from "../scripts/lib/standard-record.mjs";

const hookPayload = readHookPayload();
const raw = extractPrompt(hookPayload) || process.env.USER_PROMPT || "";
const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const hits = listActiveStandards(projectRoot).filter((standard) =>
  (standard.triggers || []).some((trigger) => trigger && raw.includes(trigger))
);

if (hits.length > 0) {
  const lines = ["이 요청이 활성 기준의 적용 범위에 닿습니다.", ""];
  for (const hit of hits) {
    lines.push(`- **${hit.id}** — ${hit.title}`);
    lines.push(`  ${hit.path}`);
  }
  lines.push("");
  lines.push("기준을 지키거나, 명시적으로 폐기하고 새로 세우십시오. 조용히 다르게 가지 마십시오.");
  process.stdout.write(lines.join("\n") + "\n");
}

process.exit(0);
```

탐지는 `String.includes`로만 한다. 점수도 임계치도 두지 않는다. 트리거가 문자 그대로 나타나거나 아니거나 둘 중 하나다.

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `node --test tests/hooks/prompt-detect-standards.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 5: 기존 prompt-detect 테스트를 정리한다**

Run: `node --test tests/hooks/prompt-detect.test.mjs`
Expected: 라우팅 점수를 단언하던 테스트가 실패한다. 그 파일을 삭제한다 — 검증 대상이 사라졌다.

```bash
git rm tests/hooks/prompt-detect.test.mjs
```

- [ ] **Step 6: 커밋한다**

```bash
git add -A
git commit -m "feat(hooks): compare against standards instead of guessing intent

The keyword router scored every prompt and always picked something. It told
the model to run a content skill on an architecture turn twice while this
was being designed. Detection is now literal substring matching against
triggers a standard declares for itself, and a standard that declares none
never fires."
```

---

### Task 8: Stop — 미완 인터뷰를 막는다

**Files:**
- Create: `hooks/lib/coach-block.mjs`
- Modify: `hooks/session-end.mjs` — 차단 분기(:655)에서 함께 본다
- Test: `tests/hooks/coach-block.test.mjs`

**Interfaces:**
- Consumes: `readState`(Task 2)
- Produces: `coachBlockReason(coachState) -> string | null` — **`hooks/lib/coach-block.mjs`에서 내보낸다**

준수 검사 미실행 차단은 2단계다. 검사 실행기가 없으므로 여기서는 미완 인터뷰만 막는다.

**함수를 `hooks/lib/`에 두는 이유**: `session-end.mjs`는 `main()`을 최상위에서 호출한다(`:816`). 테스트가 그 파일에서 함수를 임포트하면 훅 전체가 실행되고 `process.exit(2)`까지 탈 수 있다. 순수 함수를 별도 모듈로 빼면 훅을 실행하지 않고 단위 테스트할 수 있다. `hooks/lib/`에는 이미 `review-config.mjs` 등이 같은 방식으로 있다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hooks/coach-block.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";

import { coachBlockReason } from "../../hooks/lib/coach-block.mjs";

test("no state means no block", () => {
  assert.equal(coachBlockReason(null), null);
});

test("an interview awaiting approval does not block", () => {
  assert.equal(coachBlockReason({ status: "pending_approval", forks: ["a"] }), null);
});

test("an in-progress interview blocks and counts the settled forks", () => {
  const reason = coachBlockReason({ status: "in_progress", forks: ["a", "b"] });
  assert.ok(reason);
  assert.match(reason, /2/);
  assert.match(reason, /coach/);
});

test("an in-progress interview with no settled forks still blocks", () => {
  assert.ok(coachBlockReason({ status: "in_progress", forks: [] }));
});

test("the reason names the resume command so the block is actionable", () => {
  assert.match(coachBlockReason({ status: "in_progress", forks: [] }), /--resume/);
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `node --test tests/hooks/coach-block.test.mjs`
Expected: FAIL — `Cannot find module '../../hooks/lib/coach-block.mjs'`

- [ ] **Step 3: 구현한다**

`hooks/lib/coach-block.mjs`를 만든다:

```javascript
/**
 * Returns a block reason when a coach interview is still open.
 * Compliance-check blocking arrives with the check runner in phase 2.
 *
 * Lives here rather than in session-end.mjs because that file calls main()
 * at the top level — importing it from a test would run the whole hook.
 */
export function coachBlockReason(coachState) {
  if (!coachState) return null;
  if (coachState.status === "pending_approval") return null;
  const settled = Array.isArray(coachState.forks) ? coachState.forks.length : 0;
  return (
    `coach 인터뷰가 끝나지 않았습니다. 확정된 갈림길 ${settled}개. ` +
    `\`/scc:coach --resume\`으로 마치거나 명시적으로 중단하십시오.`
  );
}
```

`hooks/session-end.mjs`에 임포트를 더하고 차단 분기(:655)를 바꾼다:

```javascript
import { readState } from "../scripts/lib/coach-state.mjs";
import { coachBlockReason } from "./lib/coach-block.mjs";
```

```javascript
    const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const blockReason = pdcaBlockReason(pdcaState) || coachBlockReason(readState(projectRoot));
```

가드 파일 로직은 그대로 둔다. `session-end.mjs:658`이 차단 직전에 가드를 쓰므로 두 번째 시도는 이미 통과한다.

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `node --test tests/hooks/coach-block.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 5: StopFailure가 차단 능력을 얻지 않았는지 고정한다**

`tests/hooks/stop-failure-contract.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("stop-failure never blocks", () => {
  const src = readFileSync(join(process.cwd(), "hooks", "stop-failure.mjs"), "utf8");
  assert.doesNotMatch(src, /process\.exit\(2\)/, "blocking leaked into a hook that must always exit 0");
  assert.doesNotMatch(src, /coachBlockReason/, "block logic must live in session-end, not stop-failure");
});
```

Run: `node --test tests/hooks/stop-failure-contract.test.mjs`
Expected: PASS

- [ ] **Step 6: 기존 종료 훅 테스트가 깨지지 않았는지 본다**

Run: `node --test tests/hooks/session-end.test.mjs tests/hooks/stop-failure.test.mjs`
Expected: PASS

- [ ] **Step 7: 커밋한다**

```bash
git add hooks/lib/coach-block.mjs hooks/session-end.mjs tests/hooks/
git commit -m "feat(hooks): do not let a session end mid-interview

Blocking goes here and only here. stop-failure.mjs declares exit 0 always,
so a gate placed there would read correct and never fire. The retry guard
this needs already exists a few lines below, so the second stop passes."
```

---

### Task 9: PreCompact — 기준과 인터뷰 상태를 압축 너머로

**Files:**
- Modify: `hooks/compaction.mjs`
- Test: `tests/hooks/compaction-standards.test.mjs`

**Interfaces:**
- Consumes: `listActiveStandards`(Task 3), `readState`(Task 2)
- Produces: 압축 훅 출력에 기준 id 목록과 인터뷰 진행 상태

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/hooks/compaction-standards.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeStandard } from "../../scripts/lib/standard-record.mjs";
import { writeState } from "../../scripts/lib/coach-state.mjs";

const HOOK = join(process.cwd(), "hooks", "compaction.mjs");
const NOW = new Date("2026-08-10T00:00:00.000Z");

function withRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), "scc-compact-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runHook(root) {
  return execFileSync("node", [HOOK], {
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: "{}",
  });
}

test("standard ids survive compaction", () => {
  withRoot((root) => {
    writeStandard(
      root,
      { id: "voice-two-track", title: "두 목소리", chosen: "c", rejected: [], payload: "", review_when: "", triggers: [] },
      { now: NOW }
    );
    assert.match(runHook(root), /voice-two-track/);
  });
});

test("an open interview survives compaction", () => {
  withRoot((root) => {
    writeState(root, { run_id: "r1", status: "in_progress", forks: ["a"] });
    assert.match(runHook(root), /coach/);
  });
});

test("an empty project produces no standards section", () => {
  withRoot((root) => {
    assert.doesNotMatch(runHook(root), /voice-two-track/);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `node --test tests/hooks/compaction-standards.test.mjs`
Expected: FAIL

- [ ] **Step 3: 구현한다**

`hooks/compaction.mjs`의 출력 조립부에 더한다:

```javascript
import { listActiveStandards } from "../scripts/lib/standard-record.mjs";
import { readState } from "../scripts/lib/coach-state.mjs";

const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const standards = listActiveStandards(projectRoot);
if (standards.length > 0) {
  lines.push(`활성 기준: ${standards.map((s) => s.id).join(", ")}`);
}
const coachState = readState(projectRoot);
if (coachState && coachState.status !== "pending_approval") {
  const settled = Array.isArray(coachState.forks) ? coachState.forks.length : 0;
  lines.push(`coach 인터뷰 진행 중 — 확정 ${settled}개`);
}
```

`lines` 배열 이름이 다르면 그 파일의 기존 출력 누적 변수에 맞춘다.

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `node --test tests/hooks/compaction-standards.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋한다**

```bash
git add hooks/compaction.mjs tests/hooks/compaction-standards.test.mjs
git commit -m "feat(hooks): carry standards across the compaction boundary

A long session forgets inside itself, not only between runs."
```

---

### Task 10: 부재 테스트와 찌꺼기 정리

**Files:**
- Create: `tests/contracts/trust-boundary.test.mjs`
- Delete: `tests/skill-tests/` (22개), `.gjc/`, `.omo/`, `excalidraw.log`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (회귀 방지 전용)

- [ ] **Step 1: 부재 테스트를 쓴다**

`tests/contracts/trust-boundary.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

function rgFiles(pattern) {
  try {
    return execFileSync(
      "rg",
      ["-l", pattern, "--glob", "!node_modules", "--glob", "!docs/**", "--glob", "!CHANGELOG.md", "."],
      { encoding: "utf8" }
    )
      .split("\n")
      .filter(Boolean);
  } catch {
    // rg exits non-zero when there are no matches.
    return [];
  }
}

test("no runtime code executes a shell string from a standard", () => {
  assert.deepEqual(rgFiles("execSync|execFileSync\\(.*shell"), [], "shell execution reached runtime code");
});

test("no runtime code reads the legacy .gjc namespace", () => {
  assert.deepEqual(rgFiles("\\.gjc"), [], ".gjc references survive outside docs");
});

test("no legacy cache migration path exists", () => {
  assert.deepEqual(rgFiles("plugins/cache.*\\.gjc"), [], "a legacy migration path was reintroduced");
});
```

`docs/**`와 `CHANGELOG.md`를 제외하는 것은 그 파일들이 옛 상태를 진단으로 서술하기 때문이다. 서술은 남고 코드 경로는 남지 않는다.

- [ ] **Step 2: 테스트를 돌려 현재 상태를 확인한다**

Run: `node --test tests/contracts/trust-boundary.test.mjs`
Expected: `.gjc` 테스트가 FAIL한다면 남은 참조를 Task 4~5 규칙대로 마저 고친다. 전부 PASS면 다음으로 간다.

- [ ] **Step 3: 찌꺼기를 지운다**

```bash
git rm -r --cached tests/skill-tests 2>/dev/null || true
rm -rf tests/skill-tests .gjc .omo excalidraw.log
```

`tests/skill-tests/` 22개 파일은 2026년 3월에 저장된 출력물이며 단언문이 없다. 저장된 출력은 테스트가 아니다.

- [ ] **Step 4: `.gitignore`에 더한다**

```
.DS_Store
.omo/
excalidraw.log
```

- [ ] **Step 5: 전체 테스트를 돌린다**

Run: `npm test`
Expected: PASS. `tests/skill-tests/`를 참조하던 테스트가 있으면 그 참조를 삭제한다.

- [ ] **Step 6: 커밋한다**

```bash
git add -A
git commit -m "test: lock the trust boundary shut, and clear the residue

Absence tests, because a list of things not to do gets rebuilt by the next
person who has a reason. tests/skill-tests held twenty-two markdown files
saved in March with no assertions in them — stored output is not a test."
```

---

### Task 11: 베이스라인 — 스킬 없이 무엇이 실패하는지 먼저 기록한다

**Files:**
- Create: `tests/baselines/coach-baseline.md`

**Interfaces:**
- Consumes: 없음
- Produces: `skills/coach/SKILL.md`가 반박해야 할 합리화 문장 목록

**순서 주의**: 이 과제는 Task 5(SKILL.md 재작성)보다 **먼저** 수행하는 것이 원칙이다. 스킬 없는 실패를 보지 않고 쓴 스킬은 무엇을 고치는지 모른다. 파일 이동이 선행되어야 편하므로 번호는 뒤에 있으나, Task 5의 SKILL.md 본문을 확정하기 전에 이 결과를 반영한다.

- [ ] **Step 1: 압박 시나리오를 만든다**

`tests/baselines/coach-baseline.md`에 다음을 기록한다.

시나리오 (스킬 없이 서브에이전트에 그대로 준다):

```
스레드 판매글을 오늘 저녁까지 올려야 합니다. 문체가 지금 엉망이고
판매가 저조합니다. 어떻게 가야 할지 정해서 초안까지 뽑아 주세요.
시간이 없으니 빨리요.
```

압박 요소가 셋 겹쳐 있다: 마감, 저조한 실적, 속도 요구. 갈림길(문체 방향)이 미해결인데 실행(초안)까지 요구한다.

- [ ] **Step 2: 스킬 없이 3회 돌리고 그대로 받아 적는다**

각 회차마다 기록한다.
- 질문을 했는가, 아니면 바로 초안으로 달렸는가
- 달렸다면 어떤 문장으로 정당화했는가 (**축약하지 말고 그대로**)
- 어떤 선택지를 암묵적으로 골랐는가, 그 선택을 밝혔는가

- [ ] **Step 3: 합리화 문장을 표로 정리한다**

```markdown
| 합리화 | 반박 |
|---|---|
| (3회에서 나온 실제 문장) | (그 문장을 막는 한 줄) |
```

- [ ] **Step 4: SKILL.md에 반영한다**

Task 5에서 쓴 `skills/coach/SKILL.md`가 이 표의 문장들을 직접 겨냥하도록 고친다. 관측되지 않은 가상의 실패에 대한 문구는 넣지 않는다.

- [ ] **Step 5: 스킬을 준 상태로 같은 시나리오를 3회 돌린다**

Expected: 초안 전에 갈림길을 꺼내고 질문한다. 여전히 달리는 회차가 있으면 그때 쓴 새 합리화를 표에 추가하고 Step 4로 돌아간다.

- [ ] **Step 6: 커밋한다**

```bash
git add tests/baselines/coach-baseline.md skills/coach/SKILL.md
git commit -m "test(coach): record what the model does without the skill

Superpowers' rule, applied to our own skill: if you did not watch an agent
fail without it, you do not know what the skill is teaching. The
rationalisations in this file are verbatim, and the SKILL.md answers those
sentences rather than imagined ones."
```

---

### Task 12: 전체 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 저장소 자체 검증 명령을 돌린다**

`CLAUDE.md`에 기록된 명령을 그대로 쓴다.

```bash
node --check hooks/*.mjs hooks/lib/*.mjs mcp/*.mjs mcp/lib/*.mjs scripts/*.mjs scripts/lib/*.mjs
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"
for f in agents/*.md; do head -1 "$f" | grep -q '^---' || echo "MISSING frontmatter: $f"; done
for d in skills/*/; do [ -f "${d}SKILL.md" ] || echo "MISSING SKILL.md: $d"; done
npm test
```

Expected: 구문 오류 없음, JSON 파싱 성공, 누락 출력 없음, 테스트 전부 통과

- [ ] **Step 2: 실제로 한 번 써 본다**

```bash
cd /tmp && mkdir -p coach-smoke && cd coach-smoke && git init -q
CLAUDE_PROJECT_DIR=$PWD node /Users/parkeungje/project/second-claude-standards/scripts/coach-runner.mjs start --idea "스레드 판매글 문체를 어떻게 가야 하나" --json
CLAUDE_PROJECT_DIR=$PWD node /Users/parkeungje/project/second-claude-standards/scripts/coach-runner.mjs status --json
```

Expected: 상태가 `/tmp/coach-smoke/.scc/state/coach.json`에 생긴다. **플러그인 디렉터리 안에는 아무것도 생기지 않는다.**

- [ ] **Step 3: 플러그인 디렉터리가 깨끗한지 확인한다**

```bash
git -C /Users/parkeungje/project/second-claude-standards status --short
ls /Users/parkeungje/project/second-claude-standards/.scc 2>&1
```

Expected: 작업 트리 깨끗, `.scc` 없음

- [ ] **Step 4: 스모크 테스트 잔해를 지운다**

```bash
rm -rf /tmp/coach-smoke
```

- [ ] **Step 5: 커밋한다**

```bash
git commit --allow-empty -m "chore(coach): phase 1 verified end to end

State lands in the project. Nothing lands in the plugin."
```

---

## 이 계획이 하지 않는 것

- **준수 검사 실행기** — 2단계. 1단계 기준 문서는 `enforcement: none`으로 나가며 그 사실을 표시한다.
- **나머지 7역할** — 3단계. scout·analyst·editor·critic·manager·trainer·librarian 개명과 통합은 coach가 실사용 판정을 받은 뒤에 한다.
- **문서 전면 재작성** — 4단계. README 양본, architecture 양본, `docs/skills/` 36→16.
- **PDCA 게이트 수정** — 자기신고 문제는 확인됐으나 기준 검사가 자리를 잡은 뒤에 손댄다.

1단계가 끝나면 결정이 프로젝트에 남고, 세션 시작에 실리고, 충돌 시 제시되고, 미완 인터뷰가 세션을 못 끝내게 한다. 여기서 방향이 틀린 것으로 판명되면 3·4단계를 하지 않는다.
