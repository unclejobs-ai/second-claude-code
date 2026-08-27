import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = path.join(process.cwd(), "hooks", "lib", "plugin-discovery.mjs");

async function loadDiscovery() {
  return import(`${pathToFileURL(modulePath).href}?hardening=${Date.now()}-${Math.random()}`);
}

function setup() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "scc-discovery-hardening-"));
  const pluginsDir = path.join(tmp, ".claude", "plugins");
  mkdirSync(path.join(pluginsDir, "cache"), { recursive: true });
  return { tmp, pluginsDir, settingsPath: path.join(tmp, ".claude", "settings.json") };
}

function plugin(pluginsDir, id, manifestName = id, location = "cache") {
  const root = path.join(pluginsDir, location, "fixture", id, "1.0.0");
  mkdirSync(path.join(root, ".claude-plugin"), { recursive: true });
  writeFileSync(
    path.join(root, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: manifestName, version: "1.0.0", description: manifestName }),
    "utf8"
  );
  mkdirSync(path.join(root, "skills", "safe-skill"), { recursive: true });
  writeFileSync(path.join(root, "skills", "safe-skill", "SKILL.md"), "---\nname: safe-skill\ndescription: safe\n---\n", "utf8");
  return root;
}

function installed(pluginsDir, entries) {
  const plugins = {};
  for (const { id, installPath, scope = "user", projectPath, lastUpdated, installedAt } of entries) {
    plugins[id] ||= [];
    plugins[id].push({
      installPath,
      scope,
      ...(projectPath === undefined ? {} : { projectPath }),
      ...(lastUpdated === undefined ? {} : { lastUpdated }),
      ...(installedAt === undefined ? {} : { installedAt }),
    });
  }
  writeFileSync(path.join(pluginsDir, "installed_plugins.json"), JSON.stringify({ version: 2, plugins }), "utf8");
}

function cleanup(tmp) {
  delete process.env.__SCC_TEST_PLUGINS_ROOT;
  delete process.env.__SCC_TEST_SETTINGS_PATH;
  delete process.env.__SCC_TEST_PROJECT_SETTINGS_PATH;
  delete process.env.CLAUDE_PLUGIN_DATA;
  rmSync(tmp, { recursive: true, force: true });
}

test("enabledPlugins excludes disabled IDs and self is skipped by ID or manifest name", async () => {
  const { tmp, pluginsDir, settingsPath } = setup();
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  process.env.__SCC_TEST_SETTINGS_PATH = settingsPath;
  try {
    const disabled = plugin(pluginsDir, "disabled");
    const enabled = plugin(pluginsDir, "enabled");
    const selfById = plugin(pluginsDir, "scc@fixture", "not-scc");
    const selfByName = plugin(pluginsDir, "another-scc", "scc");
    installed(pluginsDir, [
      { id: "disabled@fixture", installPath: disabled },
      { id: "enabled@fixture", installPath: enabled },
      { id: "scc@fixture", installPath: selfById },
      { id: "another-scc@fixture", installPath: selfByName },
    ]);
    writeFileSync(settingsPath, JSON.stringify({ enabledPlugins: { "disabled@fixture": false } }), "utf8");

    const { discoverAllPlugins } = await loadDiscovery();
    assert.deepEqual(discoverAllPlugins().plugins.map((entry) => entry.name), ["enabled"]);
  } finally {
    cleanup(tmp);
  }
});

test("realpath install paths are restricted to cache/installed roots", async () => {
  const { tmp, pluginsDir } = setup();
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  try {
    const safe = plugin(pluginsDir, "safe");
    const installedRoot = plugin(pluginsDir, "also-safe", "also-safe", "installed");
    const outside = plugin(tmp, "outside");
    const escape = path.join(pluginsDir, "cache", "fixture", "escape");
    symlinkSync(outside, escape, "dir");
    installed(pluginsDir, [
      { id: "safe@fixture", installPath: safe },
      { id: "also-safe@fixture", installPath: installedRoot },
      { id: "escape@fixture", installPath: escape },
      { id: "outside@fixture", installPath: outside },
    ]);

    const { discoverAllPlugins } = await loadDiscovery();
    const result = discoverAllPlugins();
    assert.deepEqual(result.plugins.map((entry) => entry.name).sort(), ["also-safe", "safe"]);
    assert.equal(result.plugins.find((entry) => entry.name === "safe").install_path, realpathSync(safe));
  } finally {
    cleanup(tmp);
  }
});

test("invalid identifiers are rejected and duplicate manifest names do not overwrite", async () => {
  const { tmp, pluginsDir } = setup();
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  try {
    const first = plugin(pluginsDir, "first", "same-name");
    const second = plugin(pluginsDir, "second", "same-name");
    const invalidManifest = plugin(pluginsDir, "invalid-manifest", "bad/name");
    const invalidSkill = plugin(pluginsDir, "invalid-skill");
    writeFileSync(
      path.join(invalidSkill, "skills", "safe-skill", "SKILL.md"),
      "---\nname: bad/name\ndescription: unsafe\n---\n",
      "utf8"
    );
    mkdirSync(path.join(invalidSkill, "commands"), { recursive: true });
    writeFileSync(path.join(invalidSkill, "commands", "safe-command.md"), "---\nname: safe-command\ndescription: safe\n---\n", "utf8");
    installed(pluginsDir, [
      { id: "first@fixture", installPath: first },
      { id: "second@fixture", installPath: second },
      { id: "invalid-manifest@fixture", installPath: invalidManifest },
      { id: "invalid-skill@fixture", installPath: invalidSkill },
      { id: "../invalid@fixture", installPath: first },
    ]);

    const { discoverAllPlugins } = await loadDiscovery();
    const result = discoverAllPlugins();
    assert.deepEqual(result.plugins.map((entry) => entry.name), ["same-name", "invalid-skill"]);
    assert.deepEqual(result.plugins.find((entry) => entry.name === "same-name").skills.map((s) => s.name), ["safe-skill"]);
    assert.equal(result.plugins.find((entry) => entry.name === "invalid-skill").skills.length, 0);
  } finally {
    cleanup(tmp);
  }
});

test("an empty duplicate cannot hide a later usable plugin", async () => {
  const { tmp, pluginsDir } = setup();
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  try {
    const empty = plugin(pluginsDir, "empty", "shared-name");
    rmSync(path.join(empty, "skills"), { recursive: true, force: true });
    const usable = plugin(pluginsDir, "usable", "shared-name");
    installed(pluginsDir, [
      { id: "empty@fixture", installPath: empty },
      { id: "usable@fixture", installPath: usable },
    ]);

    const { discoverAllPlugins } = await loadDiscovery();
    const result = discoverAllPlugins();
    assert.equal(result.plugins.length, 1);
    assert.equal(result.plugins[0].id, "usable@fixture");
    assert.deepEqual(result.plugins[0].skills.map((skill) => skill.name), ["safe-skill"]);
  } finally {
    cleanup(tmp);
  }
});

test("preference overrides reload when content changes", async () => {
  const { tmp, pluginsDir } = setup();
  const dataDir = path.join(tmp, "plugin-data");
  mkdirSync(dataDir, { recursive: true });
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  process.env.CLAUDE_PLUGIN_DATA = dataDir;
  try {
    const alpha = plugin(pluginsDir, "alpha");
    const beta = plugin(pluginsDir, "beta");
    installed(pluginsDir, [
      { id: "alpha@fixture", installPath: alpha },
      { id: "beta@fixture", installPath: beta },
    ]);
    const preferences = path.join(dataDir, "plugin-preferences.json");
    writeFileSync(preferences, JSON.stringify({ review: ["alpha"] }), "utf8");
    const { inferTaskIntent } = await loadDiscovery();
    assert.deepEqual(inferTaskIntent("review").preferred_plugins, ["alpha"]);
    writeFileSync(preferences, JSON.stringify({ review: ["beta"] }), "utf8");
    assert.deepEqual(inferTaskIntent("review").preferred_plugins, ["beta"]);
  } finally {
    cleanup(tmp);
  }
});

test("local plugins require the current canonical project and reject sibling boundaries", async () => {
  const { tmp, pluginsDir } = setup();
  const project = path.join(tmp, "project");
  const projectAlias = path.join(tmp, "project-alias");
  const sibling = path.join(tmp, "project-other");
  mkdirSync(project, { recursive: true });
  mkdirSync(sibling, { recursive: true });
  symlinkSync(project, projectAlias, "dir");
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  process.env.CLAUDE_PROJECT_DIR = projectAlias;
  try {
    const matching = plugin(pluginsDir, "matching-local");
    const wrong = plugin(pluginsDir, "wrong-local");
    const missing = plugin(pluginsDir, "missing-local");
    installed(pluginsDir, [
      { id: "matching-local@fixture", installPath: matching, scope: "local", projectPath: project },
      { id: "wrong-local@fixture", installPath: wrong, scope: "local", projectPath: sibling },
      { id: "missing-local@fixture", installPath: missing, scope: "local" },
    ]);

    const { discoverAllPlugins } = await loadDiscovery();
    assert.deepEqual(discoverAllPlugins().plugins.map((entry) => entry.name), ["matching-local"]);
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
    cleanup(tmp);
  }
});

test("an inapplicable newer local entry does not hide an applicable older user entry", async () => {
  const { tmp, pluginsDir } = setup();
  const project = path.join(tmp, "project");
  const otherProject = path.join(tmp, "other-project");
  mkdirSync(project, { recursive: true });
  mkdirSync(otherProject, { recursive: true });
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  process.env.CLAUDE_PROJECT_DIR = project;
  try {
    const userInstall = plugin(pluginsDir, "shared-user");
    const localInstall = plugin(pluginsDir, "shared-local");
    installed(pluginsDir, [
      {
        id: "shared@fixture",
        installPath: userInstall,
        scope: "user",
        installedAt: "2026-01-01T00:00:00.000Z",
        lastUpdated: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "shared@fixture",
        installPath: localInstall,
        scope: "local",
        projectPath: otherProject,
        installedAt: "2026-02-01T00:00:00.000Z",
        lastUpdated: "2026-02-01T00:00:00.000Z",
      },
    ]);

    const { discoverAllPlugins } = await loadDiscovery();
    assert.deepEqual(discoverAllPlugins().plugins.map((entry) => entry.name), ["shared-user"]);
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
    cleanup(tmp);
  }
});

test("a broken newest install falls back to the next applicable healthy entry", async () => {
  const { tmp, pluginsDir } = setup();
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  try {
    const healthy = plugin(pluginsDir, "healthy-install");
    const malformed = plugin(pluginsDir, "malformed-install");
    writeFileSync(path.join(malformed, ".claude-plugin", "plugin.json"), "{ not valid json", "utf8");
    const missing = path.join(pluginsDir, "cache", "fixture", "missing-install", "1.0.0");
    installed(pluginsDir, [
      {
        id: "fallback@fixture",
        installPath: healthy,
        installedAt: "2026-01-01T00:00:00.000Z",
        lastUpdated: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "fallback@fixture",
        installPath: malformed,
        installedAt: "2026-02-01T00:00:00.000Z",
        lastUpdated: "2026-02-01T00:00:00.000Z",
      },
      {
        id: "fallback@fixture",
        installPath: missing,
        installedAt: "2026-03-01T00:00:00.000Z",
        lastUpdated: "2026-03-01T00:00:00.000Z",
      },
    ]);

    const { discoverAllPlugins } = await loadDiscovery();
    assert.deepEqual(discoverAllPlugins().plugins.map((entry) => entry.name), ["healthy-install"]);
  } finally {
    cleanup(tmp);
  }
});

test("dispatch recommendations and legacy guide are advisory, never execution guarantees", async () => {
  const { tmp, pluginsDir } = setup();
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  try {
    const candidate = plugin(pluginsDir, "candidate");
    installed(pluginsDir, [{ id: "candidate@fixture", installPath: candidate }]);
    const { getDispatchPlan, generateDispatchGuide } = await loadDiscovery();
    const plan = getDispatchPlan({ keyword: "safe" });
    assert.match(plan.recommendation, /advisory candidate/i);
    assert.match(plan.recommendation, /no external tool was executed/i);
    assert.match(plan.recommendation, /caller must explicitly choose\/invoke/i);
    const guide = generateDispatchGuide();
    assert.doesNotMatch(guide, /<skill-check>|\[MANDATORY\]|MUST invoke|Invoke Skill tool FIRST/i);
  } finally {
    cleanup(tmp);
  }
});

test("manifest and capability metadata are length bounded", async () => {
  const { tmp, pluginsDir } = setup();
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  try {
    const root = plugin(pluginsDir, "verbose");
    const longDescription = "d".repeat(10_000);
    const longVersion = "v".repeat(10_000);
    writeFileSync(
      path.join(root, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "verbose", version: longVersion, description: longDescription }),
      "utf8"
    );
    writeFileSync(
      path.join(root, "skills", "safe-skill", "SKILL.md"),
      `---\nname: safe-skill\ndescription: ${longDescription}\n---\n`,
      "utf8"
    );
    mkdirSync(path.join(root, "commands"), { recursive: true });
    writeFileSync(
      path.join(root, "commands", "safe-command.md"),
      `---\nname: safe-command\ndescription: ${longDescription}\n---\n`,
      "utf8"
    );
    installed(pluginsDir, [{ id: "verbose@fixture", installPath: root }]);

    const { discoverAllPlugins } = await loadDiscovery();
    const discovered = discoverAllPlugins().plugins[0];
    assert.ok(discovered.description.length <= 2048);
    assert.ok(discovered.version.length <= 128);
    assert.ok(discovered.skills[0].description.length <= 2048);
    assert.ok(discovered.commands[0].description.length <= 2048);
  } finally {
    cleanup(tmp);
  }
});

test("oversized and sparse metadata files are skipped within bounded reads", async () => {
  const { tmp, pluginsDir } = setup();
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  try {
    const oversizedManifest = plugin(pluginsDir, "oversized-manifest");
    writeFileSync(
      path.join(oversizedManifest, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "oversized-manifest", description: "x".repeat(1024 * 1024) }),
      "utf8"
    );

    const oversizedSkill = plugin(pluginsDir, "oversized-skill");
    writeFileSync(
      path.join(oversizedSkill, "skills", "safe-skill", "SKILL.md"),
      `---\nname: safe-skill\ndescription: ${"x".repeat(256 * 1024)}\n---\n`,
      "utf8"
    );
    mkdirSync(path.join(oversizedSkill, "commands"), { recursive: true });
    writeFileSync(path.join(oversizedSkill, "commands", "valid.md"), "---\nname: valid\ndescription: valid\n---\n", "utf8");

    const oversizedCommand = plugin(pluginsDir, "oversized-command");
    mkdirSync(path.join(oversizedCommand, "commands"), { recursive: true });
    writeFileSync(
      path.join(oversizedCommand, "commands", "oversized.md"),
      `---\nname: oversized\ndescription: ${"x".repeat(256 * 1024)}\n---\n`,
      "utf8"
    );

    const sparseManifest = plugin(pluginsDir, "sparse-manifest");
    truncateSync(path.join(sparseManifest, ".claude-plugin", "plugin.json"), 1024 * 1024 + 1);

    installed(pluginsDir, [
      { id: "oversized-manifest@fixture", installPath: oversizedManifest },
      { id: "oversized-skill@fixture", installPath: oversizedSkill },
      { id: "oversized-command@fixture", installPath: oversizedCommand },
      { id: "sparse-manifest@fixture", installPath: sparseManifest },
    ]);

    const { discoverAllPlugins } = await loadDiscovery();
    const result = discoverAllPlugins();
    assert.deepEqual(result.plugins.map((entry) => entry.name).sort(), ["oversized-command", "oversized-skill"]);
    assert.deepEqual(result.plugins.find((entry) => entry.name === "oversized-skill").skills, []);
    assert.deepEqual(result.plugins.find((entry) => entry.name === "oversized-skill").commands.map((entry) => entry.name), ["valid"]);
    assert.deepEqual(result.plugins.find((entry) => entry.name === "oversized-command").commands, []);
  } finally {
    cleanup(tmp);
  }
});

test("skills, commands, and agents directory floods are bounded", async () => {
  const { tmp, pluginsDir } = setup();
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  try {
    const root = plugin(pluginsDir, "entry-flood");
    mkdirSync(path.join(root, "commands"), { recursive: true });
    mkdirSync(path.join(root, "agents"), { recursive: true });
    for (let index = 0; index < 600; index += 1) {
      const suffix = String(index).padStart(3, "0");
      const skillDir = path.join(root, "skills", `flood-${suffix}`);
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(path.join(skillDir, "SKILL.md"), `---\nname: flood-skill-${suffix}\ndescription: flood\n---\n`, "utf8");
      writeFileSync(path.join(root, "commands", `flood-${suffix}.md`), `---\nname: flood-command-${suffix}\ndescription: flood\n---\n`, "utf8");
      writeFileSync(path.join(root, "agents", `flood-${suffix}.md`), "agent\n", "utf8");
    }
    installed(pluginsDir, [{ id: "entry-flood@fixture", installPath: root }]);

    const { discoverAllPlugins } = await loadDiscovery();
    const discovered = discoverAllPlugins().plugins[0];
    assert.ok(discovered.skills.length <= 256);
    assert.ok(discovered.commands.length <= 512);
    assert.ok(discovered.agents.length <= 512);
  } finally {
    cleanup(tmp);
  }
});

test("agent callable names come from bounded frontmatter, not Pokemon filenames", async () => {
  const { tmp, pluginsDir } = setup();
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  try {
    const root = plugin(pluginsDir, "pokemon");
    const agentsDir = path.join(root, "agents");
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(
      path.join(agentsDir, "xatu.md"),
      "---\nname: deep-reviewer\ndescription: Review deeply\n---\n\nAgent instructions.\n",
      "utf8"
    );
    writeFileSync(
      path.join(agentsDir, "invalid.md"),
      "---\nname: ../escape\ndescription: invalid\n---\n",
      "utf8"
    );
    installed(pluginsDir, [{ id: "pokemon@fixture", installPath: root }]);

    const { discoverAllPlugins } = await loadDiscovery();
    const discovered = discoverAllPlugins().plugins[0];
    assert.deepEqual(discovered.agents, [{ name: "deep-reviewer", invoke: "pokemon:deep-reviewer" }]);
  } finally {
    cleanup(tmp);
  }
});

test("manifest-declared nested skills and commands are contained and deduplicated", async () => {
  const { tmp, pluginsDir } = setup();
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  try {
    const root = plugin(pluginsDir, "mattpocock-skills");
    const nestedSkill = path.join(root, "skills", "engineering", "code-review");
    const nestedCommand = path.join(root, "commands", "engineering", "review");
    mkdirSync(nestedSkill, { recursive: true });
    mkdirSync(nestedCommand, { recursive: true });
    writeFileSync(path.join(nestedSkill, "SKILL.md"), "---\nname: code-review\ndescription: nested review\n---\n", "utf8");
    writeFileSync(path.join(nestedCommand, "review.md"), "---\nname: review\ndescription: nested command\n---\n", "utf8");
    const outside = path.join(tmp, "outside-skill");
    mkdirSync(outside, { recursive: true });
    writeFileSync(path.join(outside, "SKILL.md"), "---\nname: escaped\ndescription: should not load\n---\n", "utf8");
    symlinkSync(outside, path.join(root, "skills", "engineering", "escaped"), "dir");
    writeFileSync(
      path.join(root, ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: "mattpocock-skills",
        version: "1.2.3",
        skills: ["./skills/engineering/code-review", "./skills/engineering/code-review", "./skills/engineering/escaped"],
        commands: ["./commands/engineering/review/review.md", "./commands/engineering/review/review.md"],
      }),
      "utf8"
    );
    installed(pluginsDir, [{ id: "mattpocock-skills@fixture", installPath: root }]);

    const { discoverAllPlugins } = await loadDiscovery();
    const discovered = discoverAllPlugins().plugins[0];
    assert.deepEqual(discovered.skills.map((skill) => skill.name).sort(), ["code-review", "safe-skill"]);
    assert.deepEqual(discovered.commands.map((command) => command.name), ["review"]);
  } finally {
    cleanup(tmp);
  }
});

test("project-scoped entries use canonical projectPath and project settings override user settings", async () => {
  const { tmp, pluginsDir, settingsPath } = setup();
  const project = path.join(tmp, "project");
  mkdirSync(path.join(project, ".claude"), { recursive: true });
  process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  process.env.__SCC_TEST_SETTINGS_PATH = settingsPath;
  process.env.CLAUDE_PROJECT_DIR = project;
  try {
    const projectPlugin = plugin(pluginsDir, "project-plugin");
    installed(pluginsDir, [{
      id: "project-plugin@fixture",
      installPath: projectPlugin,
      scope: "project",
      projectPath: project,
    }]);
    writeFileSync(settingsPath, JSON.stringify({ enabledPlugins: { "project-plugin@fixture": false } }), "utf8");
    const projectSettings = path.join(project, ".claude", "settings.json");
    writeFileSync(projectSettings, JSON.stringify({ enabledPlugins: { "project-plugin@fixture": true } }), "utf8");

    const { discoverAllPlugins } = await loadDiscovery();
    assert.equal(discoverAllPlugins().total_plugins, 1, "project setting re-enables a user-disabled plugin");
    writeFileSync(projectSettings, JSON.stringify({ enabledPlugins: { "project-plugin@fixture": false } }), "utf8");
    assert.equal(discoverAllPlugins().total_plugins, 0, "project setting takes precedence when disabling");
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
    cleanup(tmp);
  }
});
