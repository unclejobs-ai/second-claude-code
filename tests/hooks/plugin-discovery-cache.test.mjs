/**
 * discoverAllPlugins() memoization — prompt-detect calls it ~6x per prompt and
 * each call walks every installed plugin's directories. The cache must collapse
 * repeat calls within a process yet still reflect install/uninstall changes.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const modPath = path.join(process.cwd(), "hooks", "lib", "plugin-discovery.mjs");

async function freshModule() {
  // Fresh import → empty module-level cache, isolated from other test files.
  return import(`${pathToFileURL(modPath).href}?t=${Date.now()}-${Math.random()}`);
}

function makePlugin(pluginsDir, name) {
  const root = path.join(pluginsDir, "cache", "test", name, "1.0.0");
  mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
  writeFileSync(
    path.join(root, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name, version: "1.0.0", description: name }),
    "utf8"
  );
  const skillDir = path.join(root, "skills", `${name}-skill`);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(path.join(skillDir, "SKILL.md"), `---\nname: ${name}-skill\ndescription: "d"\n---\n`, "utf8");
  return root;
}

function writeInstalled(pluginsDir, entries) {
  const plugins = {};
  for (const e of entries) {
    plugins[e.id] = [{
      scope: "user",
      installPath: e.installPath,
      version: "1.0.0",
      installedAt: "2026-05-01T00:00:00.000Z",
      lastUpdated: "2026-05-01T00:00:00.000Z",
    }];
  }
  writeFileSync(path.join(pluginsDir, "installed_plugins.json"), JSON.stringify({ version: 2, plugins }), "utf8");
}

test("discoverAllPlugins memoizes within a process and invalidates on install change", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "scc-disc-cache-"));
  const pluginsDir = path.join(tmp, ".claude", "plugins");
  mkdirSync(pluginsDir, { recursive: true });
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  try {
    const { discoverAllPlugins } = await freshModule();

    const alpha = makePlugin(pluginsDir, "alpha");
    writeInstalled(pluginsDir, [{ id: "alpha@test", installPath: alpha }]);

    const r1 = discoverAllPlugins();
    const r2 = discoverAllPlugins();
    assert.equal(r1.total_plugins, 1);
    assert.equal(r2, r1, "unchanged install → cached result is the same object (no re-walk)");

    // Install a second plugin: installed_plugins.json content changes.
    const beta = makePlugin(pluginsDir, "beta");
    writeInstalled(pluginsDir, [
      { id: "alpha@test", installPath: alpha },
      { id: "beta@test", installPath: beta },
    ]);

    const r3 = discoverAllPlugins();
    assert.notEqual(r3, r1, "changed install → recomputed (new object)");
    assert.equal(r3.total_plugins, 2, "cache invalidated and picked up the new plugin");
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});
