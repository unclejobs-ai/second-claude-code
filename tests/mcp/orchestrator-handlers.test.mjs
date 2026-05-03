import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Create a mock installed_plugins.json in a temp dir.
 * Returns the plugins root dir.
 */
function setupPluginsRoot() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "scc-orch-test-"));
  const pluginsDir = path.join(tmp, ".claude", "plugins");
  mkdirSync(pluginsDir, { recursive: true });
  return { tmp, pluginsDir };
}

/**
 * Create a minimal plugin directory structure.
 */
function createMockPlugin(pluginsDir, name, version, opts = {}) {
  const { skills = [], commands = [], mcpServers = {}, agents = [], description = "" } = opts;
  const pluginRoot = path.join(pluginsDir, "cache", "test-publisher", name, version);
  mkdirSync(path.join(pluginRoot, ".claude-plugin"), { recursive: true });

  // plugin.json
  writeFileSync(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name,
      version,
      description,
      mcpServers,
    }, null, 2),
    "utf8"
  );

  // Skills
  for (const s of skills) {
    const skillDir = path.join(pluginRoot, "skills", s.name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      path.join(skillDir, "SKILL.md"),
      `---\nname: ${s.name}\ndescription: "${s.description}"\n---\n\n# ${s.name}\n\nTest skill content.`,
      "utf8"
    );
  }

  // Commands
  if (commands.length > 0) {
    const cmdDir = path.join(pluginRoot, "commands");
    mkdirSync(cmdDir, { recursive: true });
    for (const c of commands) {
      writeFileSync(
        path.join(cmdDir, `${c.name}.md`),
        `---\nname: ${c.name}\ndescription: "${c.description}"\n---\n\n# ${c.name}\n`,
        "utf8"
      );
    }
  }

  // Agents
  if (agents.length > 0) {
    const agentsDir = path.join(pluginRoot, "agents");
    mkdirSync(agentsDir, { recursive: true });
    for (const a of agents) {
      writeFileSync(path.join(agentsDir, `${a}.md`), "", "utf8");
    }
  }

  return pluginRoot;
}

/**
 * Write installed_plugins.json pointing to mock plugins.
 */
function writeInstalledPlugins(pluginsDir, entries) {
  const plugins = {};
  for (const e of entries) {
    plugins[e.id] = [
      {
        scope: "user",
        installPath: e.installPath,
        version: e.version,
        installedAt: "2026-05-01T00:00:00.000Z",
        lastUpdated: "2026-05-01T00:00:00.000Z",
      },
    ];
  }
  writeFileSync(
    path.join(pluginsDir, "installed_plugins.json"),
    JSON.stringify({ version: 2, plugins }, null, 2),
    "utf8"
  );
}

/**
 * Load orchestrator handlers with a custom plugins root via env override.
 */
async function loadHandlers(pluginsDir) {
  if (pluginsDir) {
    process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  }
  const handlerPath = path.join(root, "mcp", "lib", "orchestrator-handlers.mjs");
  const url = pathToFileURL(handlerPath).href;
  return await import(`${url}?t=${Date.now()}`);
}

async function loadDiscovery(pluginsDir) {
  if (pluginsDir) {
    process.env.__SCC_TEST_PLUGINS_ROOT = pluginsDir;
  }
  const discoveryPath = path.join(root, "hooks", "lib", "plugin-discovery.mjs");
  const url = pathToFileURL(discoveryPath).href;
  return await import(`${url}?t=${Date.now()}`);
}

// ---------------------------------------------------------------------------
// Plugin discovery
// ---------------------------------------------------------------------------

test("discoverAllPlugins returns empty when no plugins installed", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  writeInstalledPlugins(pluginsDir, []);

  try {
    const { discoverAllPlugins } = await loadDiscovery(pluginsDir);
    assert.deepEqual(discoverAllPlugins(), {
      plugins: [],
      capability_map: {},
      total_plugins: 0,
      total_skills: 0,
      total_mcp_servers: 0,
    });
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("plugin-discovery discovers skills from plugin structure", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();

  // Create mock code-reviewer plugin
  const installPath = createMockPlugin(pluginsDir, "code-reviewer", "1.0.0", {
    description: "AI code review tool",
    skills: [
      { name: "code-review", description: "Review code for bugs and quality" },
      { name: "autofix", description: "Auto-fix common issues" },
    ],
    commands: [
      { name: "review", description: "Run code review" },
    ],
  });

  writeInstalledPlugins(pluginsDir, [
    { id: "code-reviewer@test", installPath, version: "1.0.0" },
  ]);

  try {
    const { discoverAllPlugins } = await loadDiscovery(pluginsDir);
    const result = discoverAllPlugins();
    assert.equal(result.total_plugins, 1);
    assert.equal(result.total_skills, 2);
    assert.deepEqual([...result.capability_map["code-reviewer"].skills].sort(), ["autofix", "code-review"]);
    assert.deepEqual([...result.capability_map["code-reviewer"].commands].sort(), ["review"]);
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("plugin-discovery discovers MCP servers from plugin.json", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();

  const installPath = createMockPlugin(pluginsDir, "mcp-plugin", "2.0.0", {
    description: "MCP-heavy plugin",
    mcpServers: {
      "analysis-server": { type: "stdio", command: "node", args: ["server.mjs"] },
      "data-server": { type: "stdio", command: "node", args: ["data.mjs"] },
    },
  });

  writeInstalledPlugins(pluginsDir, [
    { id: "mcp-plugin@test", installPath, version: "2.0.0" },
  ]);

  try {
    const { discoverAllPlugins } = await loadDiscovery(pluginsDir);
    const result = discoverAllPlugins();
    assert.equal(result.total_plugins, 1);
    assert.equal(result.total_mcp_servers, 2);
    assert.deepEqual([...result.capability_map["mcp-plugin"].mcp_servers].sort(), ["analysis-server", "data-server"]);
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Orchestrator handler contracts
// ---------------------------------------------------------------------------

test("handleOrchestratorListPlugins discovers installed plugin capabilities", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const installPath = createMockPlugin(pluginsDir, "analytics-tools", "1.0.0", {
    description: "Analytics workflow tools",
    skills: [
      { name: "event-analysis", description: "Analyze product events" },
    ],
    commands: [
      { name: "analytics-report", description: "Create analytics report" },
    ],
    mcpServers: {
      "analytics-server": { type: "stdio", command: "node", args: ["server.mjs"] },
    },
    agents: ["analytics-agent"],
  });
  writeInstalledPlugins(pluginsDir, [
    { id: "analytics-tools@test", installPath, version: "1.0.0" },
  ]);

  try {
    const { handleOrchestratorListPlugins } = await loadHandlers(pluginsDir);
    const result = handleOrchestratorListPlugins();
    assert.equal(result.total_plugins, 1);
    assert.equal(result.total_external_skills, 1);
    assert.equal(result.total_external_mcp_servers, 1);
    assert.equal(result.plugins[0].name, "analytics-tools");
    assert.deepEqual(result.plugins[0].skills, ["event-analysis"]);
    assert.deepEqual(result.plugins[0].commands, ["analytics-report"]);
    assert.deepEqual(result.plugins[0].mcp_servers, ["analytics-server"]);
    assert.equal(result.plugins[0].agent_count, 1);
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("handleOrchestratorGetPlugin returns installed plugin details", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const installPath = createMockPlugin(pluginsDir, "commit-commands", "1.0.0", {
    description: "Git commit helper commands",
    commands: [
      { name: "commit", description: "Create a git commit" },
    ],
  });
  writeInstalledPlugins(pluginsDir, [
    { id: "commit-commands@test", installPath, version: "1.0.0" },
  ]);

  try {
    const { handleOrchestratorGetPlugin } = await loadHandlers(pluginsDir);
    const result = handleOrchestratorGetPlugin({ plugin: "commit-commands" });
    assert.equal(result.found, true);
    assert.equal(result.name, "commit-commands");
    assert.deepEqual(result.commands.map((c) => c.name), ["commit"]);
    assert.throws(() => handleOrchestratorGetPlugin({ plugin: "" }), /plugin name is required/);
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("handleOrchestratorRoute validates input", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  writeInstalledPlugins(pluginsDir, []);

  try {
    const { handleOrchestratorRoute } = await loadHandlers(pluginsDir);
    assert.throws(() => handleOrchestratorRoute({}), /Either 'keyword' or 'phase'/);
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("handleOrchestratorRoute maps PDCA plan phase to research plugin", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const claudeMem = createMockPlugin(pluginsDir, "claude-mem", "12.4.8", {
    description: "Persistent memory and knowledge agents",
    skills: [
      { name: "mem-search", description: "Search persistent cross-session memory database" },
      { name: "knowledge-agent", description: "Build and query AI-powered knowledge bases" },
    ],
  });
  writeInstalledPlugins(pluginsDir, [
    { id: "claude-mem@test", installPath: claudeMem, version: "12.4.8" },
  ]);

  try {
    const { handleOrchestratorRoute } = await loadHandlers(pluginsDir);
    const result = handleOrchestratorRoute({ phase: "plan" });
    assert.equal(result.intent, "plan");
    assert.equal(result.dispatch[0].invoke, "Skill: claude-mem-knowledge-agent");
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("handleOrchestratorHealth returns real ecosystem health", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const installPath = createMockPlugin(pluginsDir, "coderabbit", "1.0.0", {
    description: "AI code review tool",
    skills: [
      { name: "code-review", description: "AI-powered code review using CodeRabbit" },
    ],
  });
  writeInstalledPlugins(pluginsDir, [
    { id: "coderabbit@test", installPath, version: "1.0.0" },
  ]);

  try {
    const { handleOrchestratorHealth } = await loadHandlers(pluginsDir);
    const health = handleOrchestratorHealth();
    assert.equal(health.status, "healthy");
    assert.equal(health.ready, true);
    assert.equal(health.total_plugins, 1);
    assert.equal(health.plugins_with_skills, 1);
    assert.deepEqual(health.plugin_names, ["coderabbit"]);
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("handleOrchestratorRoute sends Korean review intent to CodeRabbit code-review before autofix", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const coderabbit = createMockPlugin(pluginsDir, "coderabbit", "1.1.1", {
    description: "AI code review tool",
    skills: [
      { name: "autofix", description: "Safely review and apply CodeRabbit PR review-thread feedback" },
      { name: "code-review", description: "AI-powered code review using CodeRabbit" },
    ],
    commands: [
      { name: "coderabbit-review", description: "Run CodeRabbit review" },
    ],
  });

  writeInstalledPlugins(pluginsDir, [
    { id: "coderabbit@test", installPath: coderabbit, version: "1.1.1" },
  ]);

  try {
    const { handleOrchestratorRoute } = await loadHandlers(pluginsDir);
    const result = handleOrchestratorRoute({ keyword: "\uB9AC\uBDF0\uD574\uC918" });
    assert.equal(result.intent, "review");
    assert.equal(result.dispatch[0].invoke, "Skill: coderabbit-code-review");
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("handleOrchestratorRoute sends Korean commit intent to commit-commands commit", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const commitCommands = createMockPlugin(pluginsDir, "commit-commands", "1.0.0", {
    description: "Git commit helper commands",
    commands: [
      { name: "commit-push-pr", description: "Commit, push, and open PR" },
      { name: "commit", description: "Create a git commit" },
    ],
  });

  writeInstalledPlugins(pluginsDir, [
    { id: "commit-commands@test", installPath: commitCommands, version: "1.0.0" },
  ]);

  try {
    const { handleOrchestratorRoute } = await loadHandlers(pluginsDir);
    const result = handleOrchestratorRoute({ keyword: "\uCEE4\uBC0B\uD574\uC918" });
    assert.equal(result.intent, "commit");
    assert.equal(result.dispatch[0].invoke, "/commit-commands:commit");
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("handleOrchestratorRoute sends design improvement intent to frontend-design", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const frontendDesign = createMockPlugin(pluginsDir, "frontend-design", "1.0.0", {
    description: "Create production-grade frontend interfaces with high design quality",
    skills: [
      { name: "frontend-design", description: "Create distinctive frontend UI and application designs" },
    ],
  });

  writeInstalledPlugins(pluginsDir, [
    { id: "frontend-design@test", installPath: frontendDesign, version: "1.0.0" },
  ]);

  try {
    const { handleOrchestratorRoute } = await loadHandlers(pluginsDir);
    const result = handleOrchestratorRoute({ keyword: "\uB514\uC790\uC778 \uAC1C\uC120\uD574\uC918" });
    assert.equal(result.intent, "frontend-design");
    assert.equal(result.dispatch[0].invoke, "Skill: frontend-design-frontend-design");
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("handleOrchestratorRoute sends Korean research intent to claude-mem knowledge-agent", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const claudeMem = createMockPlugin(pluginsDir, "claude-mem", "12.4.8", {
    description: "Persistent memory and knowledge agents",
    skills: [
      { name: "mem-search", description: "Search persistent cross-session memory database" },
      { name: "knowledge-agent", description: "Build and query AI-powered knowledge bases from claude-mem observations" },
    ],
  });

  writeInstalledPlugins(pluginsDir, [
    { id: "claude-mem@test", installPath: claudeMem, version: "12.4.8" },
  ]);

  try {
    const { handleOrchestratorRoute } = await loadHandlers(pluginsDir);
    const result = handleOrchestratorRoute({ keyword: "\uC870\uC0AC\uD574\uC918" });
    assert.equal(result.intent, "memory-research");
    assert.equal(result.dispatch[0].invoke, "Skill: claude-mem-knowledge-agent");
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("handleOrchestratorRoute routes strong generic match to installed plugin skill", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const posthog = createMockPlugin(pluginsDir, "posthog", "1.0.0", {
    description: "Product analytics and event analysis",
    skills: [
      { name: "exploring-autocapture-events", description: "Analyze PostHog autocapture events and product analytics" },
    ],
  });

  writeInstalledPlugins(pluginsDir, [
    { id: "posthog@test", installPath: posthog, version: "1.0.0" },
  ]);

  try {
    const { handleOrchestratorRoute } = await loadHandlers(pluginsDir);
    const result = handleOrchestratorRoute({ keyword: "posthog event analysis" });
    assert.equal(result.intent, "generic");
    assert.equal(result.dispatch[0].invoke, "Skill: posthog-exploring-autocapture-events");
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("handleOrchestratorRoute does not match short keyword inside longer words", async () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const agentTeams = createMockPlugin(pluginsDir, "agent-teams", "1.0.0", {
    description: "Team coordination helpers",
    skills: [
      { name: "parallel-debugging", description: "Coordinate multiple agents for debugging complex issues" },
    ],
  });

  writeInstalledPlugins(pluginsDir, [
    { id: "agent-teams@test", installPath: agentTeams, version: "1.0.0" },
  ]);

  try {
    const { handleOrchestratorRoute } = await loadHandlers(pluginsDir);
    const result = handleOrchestratorRoute({ keyword: "fix this bug in src/app.js" });
    assert.equal(result.intent, "generic");
    assert.equal(result.dispatch.length, 0);
  } finally {
    delete process.env.__SCC_TEST_PLUGINS_ROOT;
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Integration: tool definitions in pdca-state-server
// ---------------------------------------------------------------------------

test("pdca-state-server declares orchestrator tools", () => {
  // Read the MCP server source and verify orchestrator tools are declared
  const serverSrc = readFileSync(
    path.join(root, "mcp", "pdca-state-server.mjs"),
    "utf8"
  );

  const tools = [
    "orchestrator_list_plugins",
    "orchestrator_get_plugin",
    "orchestrator_route",
    "orchestrator_health",
  ];

  for (const tool of tools) {
    assert.ok(
      serverSrc.includes(`"${tool}"`),
      `pdca-state-server must declare tool: ${tool}`
    );
  }
});

test("pdca-state-server has switch cases for orchestrator tools", () => {
  const serverSrc = readFileSync(
    path.join(root, "mcp", "pdca-state-server.mjs"),
    "utf8"
  );

  assert.ok(serverSrc.includes('case "orchestrator_list_plugins"'));
  assert.ok(serverSrc.includes('case "orchestrator_get_plugin"'));
  assert.ok(serverSrc.includes('case "orchestrator_route"'));
  assert.ok(serverSrc.includes('case "orchestrator_health"'));
});

test("pdca-state-server imports orchestrator handlers", () => {
  const serverSrc = readFileSync(
    path.join(root, "mcp", "pdca-state-server.mjs"),
    "utf8"
  );

  assert.ok(serverSrc.includes('handleOrchestratorListPlugins'));
  assert.ok(serverSrc.includes('handleOrchestratorGetPlugin'));
  assert.ok(serverSrc.includes('handleOrchestratorRoute'));
  assert.ok(serverSrc.includes('handleOrchestratorHealth'));
  assert.ok(serverSrc.includes('./lib/orchestrator-handlers.mjs'));
});
