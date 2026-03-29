import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const installer = path.join(root, "scripts", "install-hermes-skillpack.mjs");

function runInstaller(...args) {
  return JSON.parse(
    execFileSync(process.execPath, [installer, ...args], {
      cwd: root,
      encoding: "utf8",
    })
  );
}

test("hermes skillpack installer lists packaged skills", () => {
  const result = runInstaller("list");
  const names = result.skills.map((entry) => `${entry.category}/${entry.name}`);

  assert.ok(names.includes("autonomous-ai-agents/acpx-orchestrator"));
  assert.ok(names.includes("autonomous-ai-agents/external-coding-supervisor"));
  assert.ok(names.includes("code-quality/mmbridge-quality"));
});

test("hermes skillpack installer installs all packaged skills to target dir", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-hermes-skills-"));
  const result = runInstaller("install", "--target", tempDir);

  assert.equal(result.installed.length >= 3, true);
  assert.equal(
    existsSync(path.join(tempDir, "autonomous-ai-agents", "acpx-orchestrator", "SKILL.md")),
    true
  );
  assert.equal(
    existsSync(path.join(tempDir, "autonomous-ai-agents", "external-coding-supervisor", "SKILL.md")),
    true
  );
  assert.equal(
    existsSync(path.join(tempDir, "code-quality", "mmbridge-quality", "SKILL.md")),
    true
  );
});

test("hermes skillpack installer installs a single skill by name", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-hermes-skill-"));
  const result = runInstaller("install", "external-coding-supervisor", "--target", tempDir);
  const skillPath = path.join(
    tempDir,
    "autonomous-ai-agents",
    "external-coding-supervisor",
    "SKILL.md"
  );

  assert.equal(result.installed.length, 1);
  assert.equal(existsSync(skillPath), true);
  assert.match(readFileSync(skillPath, "utf8"), /external-coding-supervisor/);
});
