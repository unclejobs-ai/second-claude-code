import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { resolveProjectRoot, isInsidePluginInstall } from "../../scripts/lib/project-root.mjs";

test("resolveProjectRoot prefers CLAUDE_PROJECT_DIR over cwd", () => {
  const dir = mkdtempSync(join(tmpdir(), "scc-root-"));
  try {
    const moduleUrl = pathToFileURL(join(dir, "elsewhere", "lib", "project-root.mjs")).href;
    const root = resolveProjectRoot({
      env: { CLAUDE_PROJECT_DIR: dir },
      cwd: "/some/other/place",
      moduleUrl,
    });
    assert.equal(root, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveProjectRoot falls back to cwd when the env var is unset", () => {
  const dir = mkdtempSync(join(tmpdir(), "scc-root-"));
  try {
    const moduleUrl = pathToFileURL(join(dir, "elsewhere", "lib", "project-root.mjs")).href;
    assert.equal(resolveProjectRoot({ env: {}, cwd: dir, moduleUrl }), dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
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
