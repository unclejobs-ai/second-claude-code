import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  return readFileSync(path.join(root, relPath), "utf8");
}

function filesUnder(relDir) {
  const start = path.join(root, relDir);
  const files = [];
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  return files.map((f) => path.relative(root, f));
}

// Runtime code only. Excludes tests/ (which names ".gjc" and "repoRootFrom" on purpose, in
// negative assertions proving those things stay gone) and docs/ + CHANGELOG.md (which describe
// past releases and the .gjc era correctly, as history).
const RUNTIME_DIRS = ["hooks", "scripts", "mcp", "skills", "daemon"];

function runtimeFiles() {
  return RUNTIME_DIRS.flatMap((dir) => filesUnder(dir));
}

// Every file a STANDARD.md's content passes through: written by standard-record, read back by
// coach-runner and the hooks that list, match, and carry it across compaction. A standard is a
// file that travels through a repository with the project it documents — anyone who opens that
// project and lets the coach run is trusting every file on this list.
const STANDARD_REACHABLE_FILES = [
  "scripts/coach-runner.mjs",
  "scripts/lib/coach-state.mjs",
  "scripts/lib/standard-record.mjs",
  "hooks/lib/coach-block.mjs",
  "hooks/prompt-detect.mjs",
  "hooks/compaction.mjs",
  "hooks/session-start.mjs",
  "hooks/session-end.mjs",
];

test("no code reachable from a standard executes a shell string", () => {
  // execSync/exec always hand their argument to a shell to interpret. execFileSync/spawn only do
  // that when told to (shell: true, or a shell binary invoked with -c/-lc). Any of those, in a
  // file a standard passes through, would turn a STANDARD.md a project committed into a
  // code-execution path for whoever next opens that project and lets the coach run.
  const pattern = /\bexecSync\(|\bexec\(|shell:\s*true|["'`]-l?c["'`]/;
  for (const file of STANDARD_REACHABLE_FILES) {
    const content = read(file);
    assert.doesNotMatch(
      content,
      pattern,
      `${file} executes a shell string — a standard is a file that travels through a repository, ` +
        `and every reader of one becomes a code-execution path for anyone who opens the project`
    );
  }
});

test("no runtime code reads the legacy .gjc namespace", () => {
  for (const file of runtimeFiles()) {
    const content = read(file);
    assert.doesNotMatch(
      content,
      /\.gjc/,
      `${file} references the legacy .gjc namespace — coach state and standards now live under ` +
        `the project's own .scc, and .gjc was the shared-plugin-root bug this phase closed`
    );
  }
});

test("no legacy plugin-cache migration path exists", () => {
  for (const file of runtimeFiles()) {
    const content = read(file);
    assert.doesNotMatch(
      content,
      /plugins[\s\S]{0,20}cache[\s\S]{0,80}\.gjc|\.gjc[\s\S]{0,80}plugins[\s\S]{0,20}cache/i,
      `${file} reads or moves the old plugin-cache .gjc specs — they are deliberately left where ` +
        `they are, and nothing should read or move them into the project`
    );
  }
});

test("repoRootFrom does not return to scripts/", () => {
  // The function that resolved the runner's own install directory as the project root — the bug
  // this phase exists to close. It was routed around, then deleted. Pinned by exact name because
  // the name reads exactly like what someone reaching for a project root would want to write next.
  for (const file of filesUnder("scripts")) {
    const content = read(file);
    assert.doesNotMatch(
      content,
      /\brepoRootFrom\b/,
      `${file} reintroduces repoRootFrom`
    );
  }
});
