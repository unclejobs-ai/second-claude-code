import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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

test("resolveProjectRoot refuses the plugin root itself, which is the original bug", () => {
  const install = mkdtempSync(join(tmpdir(), "scc-plugin-"));
  try {
    mkdirSync(join(install, "scripts", "lib"), { recursive: true });
    const moduleUrl = pathToFileURL(join(install, "scripts", "lib", "project-root.mjs")).href;
    assert.throws(
      () => resolveProjectRoot({ env: {}, cwd: install, moduleUrl }),
      /플러그인 설치 경로/,
      "the runner used to resolve its own install directory as the root"
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

test("a symlink pointing into the plugin install is caught", () => {
  const install = mkdtempSync(join(tmpdir(), "scc-plugin-"));
  const outside = mkdtempSync(join(tmpdir(), "scc-out-"));
  try {
    mkdirSync(join(install, "scripts", "lib"), { recursive: true });
    mkdirSync(join(install, "nested"), { recursive: true });
    const moduleUrl = pathToFileURL(join(install, "scripts", "lib", "project-root.mjs")).href;
    const link = join(outside, "link-into-plugin");
    symlinkSync(join(install, "nested"), link, "dir");
    assert.equal(isInsidePluginInstall(link, moduleUrl), true);
  } finally {
    rmSync(install, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("a differently-cased path to the plugin install is caught on a case-insensitive filesystem", () => {
  const install = mkdtempSync(join(tmpdir(), "scc-plugin-"));
  try {
    mkdirSync(join(install, "scripts", "lib"), { recursive: true });
    const moduleUrl = pathToFileURL(join(install, "scripts", "lib", "project-root.mjs")).href;
    const upper = install.toUpperCase();
    let caseInsensitive = true;
    try {
      realpathSync(upper);
    } catch {
      caseInsensitive = false;
    }
    if (!caseInsensitive) return; // case-sensitive volume: nothing to assert
    assert.equal(isInsidePluginInstall(upper, moduleUrl), true);
  } finally {
    rmSync(install, { recursive: true, force: true });
  }
});

test("a project directory that does not exist yet still resolves", () => {
  const project = mkdtempSync(join(tmpdir(), "scc-proj-"));
  const install = mkdtempSync(join(tmpdir(), "scc-plugin-"));
  try {
    const moduleUrl = pathToFileURL(join(install, "scripts", "lib", "project-root.mjs")).href;
    const notYet = join(project, "does", "not", "exist");
    assert.equal(resolveProjectRoot({ env: {}, cwd: notYet, moduleUrl }), resolve(notYet));
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(install, { recursive: true, force: true });
  }
});
