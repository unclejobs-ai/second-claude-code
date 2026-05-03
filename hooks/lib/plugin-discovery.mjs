/**
 * Plugin Discovery — runtime scan of the user's installed Claude Code plugins.
 *
 * Reads ~/.claude/plugins/installed_plugins.json and inspects each plugin's
 * filesystem structure to build a capability map. Used by the orchestrator
 * MCP tools and session-start injection to route PDCA phases to external
 * plugins.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const DEFAULT_PLUGINS_ROOT = join(homedir(), ".claude", "plugins");

function getPluginsRoot() {
  return process.env.__SCC_TEST_PLUGINS_ROOT || DEFAULT_PLUGINS_ROOT;
}

function getInstalledPluginsPath() {
  return join(getPluginsRoot(), "installed_plugins.json");
}

const INTENT_PROFILES = {
  review: {
    search: "review code quality security audit",
    keywords: ["review", "code-review", "code review", "quality", "security", "audit", "bug"],
    preferred_plugins: ["coderabbit"],
    preferred_skills: ["code-review"],
    preferred_commands: ["coderabbit-review", "review"],
    deprioritized_skills: ["autofix"],
  },
  commit: {
    search: "commit git push changes",
    keywords: ["commit", "git", "changes"],
    preferred_plugins: ["commit-commands"],
    preferred_skills: [],
    preferred_commands: ["commit"],
  },
  "frontend-design": {
    search: "frontend design ui component page interface",
    keywords: ["frontend", "design", "ui", "component", "page", "interface"],
    preferred_plugins: ["frontend-design"],
    preferred_skills: ["frontend-design"],
    preferred_commands: ["design"],
  },
  "memory-research": {
    search: "knowledge memory research search previous session",
    keywords: ["knowledge", "memory", "mem", "research", "search", "previous", "session"],
    preferred_plugins: ["claude-mem"],
    preferred_skills: ["knowledge-agent"],
    preferred_commands: [],
  },
  "plan": {
    search: "research analyze brief strategy knowledge memory",
    keywords: ["research", "analyze", "brief", "strategy", "knowledge", "memory"],
    preferred_plugins: ["claude-mem"],
    preferred_skills: ["knowledge-agent", "mem-search", "pathfinder"],
    preferred_commands: [],
  },
  "do": {
    search: "write create build implement design develop generate frontend",
    keywords: ["write", "create", "build", "implement", "design", "develop", "generate", "frontend"],
    preferred_plugins: ["frontend-design"],
    preferred_skills: ["frontend-design"],
    preferred_commands: ["design"],
  },
  "act": {
    search: "commit deploy simplify refactor fix apply format push",
    keywords: ["commit", "deploy", "simplify", "refactor", "fix", "format", "push"],
    preferred_plugins: ["commit-commands"],
    preferred_skills: [],
    preferred_commands: ["commit"],
  },
};

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textHasKeyword(text, keyword) {
  if (!keyword) return false;
  if (text === keyword) return true;
  if (keyword.length <= 3) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}([^a-z0-9]|$)`, "i").test(text);
  }
  return text.includes(keyword);
}

function makeIntent(name, profile) {
  return {
    name,
    search: profile.search || "",
    keywords: profile.keywords || [],
    preferred_plugins: profile.preferred_plugins || [],
    preferred_skills: profile.preferred_skills || [],
    preferred_commands: profile.preferred_commands || [],
    deprioritized_skills: profile.deprioritized_skills || [],
  };
}

/**
 * Infer the user's orchestration intent from natural language or a PDCA phase.
 *
 * @param {string} keyword
 * @param {string | undefined} phase
 * @returns {{ name: string, search: string, keywords: string[], preferred_plugins: string[], preferred_skills: string[], preferred_commands: string[], deprioritized_skills: string[] }}
 */
export function inferTaskIntent(keyword = "", phase = undefined) {
  const lower = normalizeSearchText(keyword);

  if (phase === "check") return makeIntent("review", INTENT_PROFILES.review);
  if (phase === "act") return makeIntent("commit", INTENT_PROFILES.act);
  if (phase === "do") return makeIntent("frontend-design", INTENT_PROFILES.do);
  if (phase === "plan") return makeIntent("plan", INTENT_PROFILES.plan);

  if (/(\uCEE4\uBC0B|commit|git commit)/i.test(lower)) {
    return makeIntent("commit", INTENT_PROFILES.commit);
  }

  if (/(\uB514\uC790\uC778|\uD504\uB860\uD2B8|\uD504\uB7F0\uD2B8|ui|ux|\uD654\uBA74|\uC778\uD130\uD398\uC774\uC2A4|frontend|front-end|design)/i.test(lower)) {
    return makeIntent("frontend-design", INTENT_PROFILES["frontend-design"]);
  }

  if (/(\uB9AC\uBDF0|\uAC80\uD1A0|\uCF54\uB4DC\s*\uB9AC\uBDF0|review|quality check|code review)/i.test(lower)) {
    return makeIntent("review", INTENT_PROFILES.review);
  }

  if (/(\uC870\uC0AC\uD574|\uC870\uC0AC\uD574\uC918|\uB9AC\uC11C\uCE58|\uCC3E\uC544\uBD10|\uC54C\uC544\uBD10|\uBA54\uBAA8\uB9AC|\uAE30\uC5B5|\uC774\uC804|\uC9C0\uB09C|knowledge|memory|previous session|past work)/i.test(lower)) {
    return makeIntent("memory-research", INTENT_PROFILES["memory-research"]);
  }

  return {
    name: "generic",
    search: lower,
    keywords: uniqueStrings(lower.split(/\s+/)),
    preferred_plugins: [],
    preferred_skills: [],
    preferred_commands: [],
    deprioritized_skills: [],
  };
}

function scoreTextAgainstKeywords(name, description, keywords) {
  const n = normalizeSearchText(name);
  const d = normalizeSearchText(description);
  let score = 0;

  for (const kw of keywords) {
    const k = normalizeSearchText(kw);
    if (!k) continue;
    if (n === k) score += 45;
    else if (textHasKeyword(n, k)) score += 24;
    if (textHasKeyword(d, k)) score += 10;
  }

  return score;
}

function scoreCapability(plugin, item, kind, intent) {
  let score = 0;
  const pluginName = normalizeSearchText(plugin.name);

  if (intent.preferred_plugins.includes(plugin.name) || intent.preferred_plugins.includes(pluginName)) {
    score += 60;
  }

  if (kind === "skill") {
    const idx = intent.preferred_skills.indexOf(item.name);
    if (idx !== -1) score += 120 - idx * 20;
  }
  if (kind === "command") {
    const idx = intent.preferred_commands.indexOf(item.name);
    if (idx !== -1) score += 120 - idx * 20;
  }
  if (kind === "skill" && intent.deprioritized_skills.includes(item.name)) score -= 60;

  score += scoreTextAgainstKeywords(item.name, item.description, intent.keywords);
  score += Math.floor(scoreTextAgainstKeywords(plugin.name, plugin.description, intent.keywords) / 2);

  // A generic route should still match direct names/descriptions, but not every
  // plugin that merely has a vague description hit.
  if (intent.name === "generic" && score < 10) return 0;

  return Math.max(score, 0);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Strip YAML frontmatter (--- delimited) and extract metadata fields.
 * @param {string} content
 * @returns {{ name?: string, description?: string }}
 */
function parseFrontmatter(content) {
  const m = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  /** @type {{ [key: string]: unknown }} */
  const fields = {};
  let key = "";
  for (const line of m[1].split("\n")) {
    const fm = line.match(/^(\w[\w-]*):\s*(.+)/);
    if (fm) {
      key = fm[1];
      fields[key] = fm[2].replace(/^["']|["']$/g, "").trim();
    } else if (key && line.startsWith("  ")) {
      // Multi-line value continuation
      fields[key] += " " + line.trim();
    }
  }
  return {
    name: typeof fields.name === "string" ? fields.name : undefined,
    description: typeof fields.description === "string" ? fields.description : undefined,
  };
}

/**
 * Discover skills from a plugin's skills/ directory.
 * Each skill is `skills/<name>/SKILL.md` with YAML frontmatter.
 *
 * @param {string} pluginRoot
 * @returns {{ name: string, description: string }[]}
 */
function discoverSkills(pluginRoot) {
  const skillsDir = join(pluginRoot, "skills");
  if (!existsSync(skillsDir)) return [];

  /** @type {{ name: string, description: string }[]} */
  const skills = [];
  try {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillFile = join(skillsDir, entry.name, "SKILL.md");
      if (!existsSync(skillFile)) continue;
      try {
        const content = readFileSync(skillFile, "utf8");
        const meta = parseFrontmatter(content);
        skills.push({
          name: meta.name || entry.name,
          description: meta.description || entry.name,
        });
      } catch { /* skip unreadable skill */ }
    }
  } catch { /* non-fatal */ }
  return skills;
}

/**
 * Discover commands from a plugin's commands/ directory.
 * Each command is `commands/<name>.md` with YAML frontmatter.
 *
 * @param {string} pluginRoot
 * @returns {{ name: string, description: string }[]}
 */
function discoverCommands(pluginRoot) {
  const commandsDir = join(pluginRoot, "commands");
  if (!existsSync(commandsDir)) return [];

  /** @type {{ name: string, description: string }[]} */
  const commands = [];
  try {
    for (const file of readdirSync(commandsDir)) {
      if (!file.endsWith(".md")) continue;
      try {
        const content = readFileSync(join(commandsDir, file), "utf8");
        const meta = parseFrontmatter(content);
        commands.push({
          name: meta.name || file.replace(".md", ""),
          description: meta.description || file.replace(".md", ""),
        });
      } catch { /* skip unreadable command */ }
    }
  } catch { /* non-fatal */ }
  return commands;
}

/**
 * Discover MCP servers declared in plugin.json's mcpServers field
 * or .mcp.json at the plugin root.
 *
 * @param {string} pluginRoot
 * @returns {string[]} MCP server names
 */
function discoverMcpServers(pluginRoot) {
  const servers = [];

  // plugin.json mcpServers
  const manifestPath = join(pluginRoot, ".claude-plugin", "plugin.json");
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (manifest.mcpServers && typeof manifest.mcpServers === "object") {
        servers.push(...Object.keys(manifest.mcpServers));
      }
    } catch { /* non-fatal */ }
  }

  // .mcp.json (alternative MCP config)
  const mcpJsonPath = join(pluginRoot, ".mcp.json");
  if (existsSync(mcpJsonPath)) {
    try {
      const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, "utf8"));
      if (mcpConfig.mcpServers && typeof mcpConfig.mcpServers === "object") {
        servers.push(...Object.keys(mcpConfig.mcpServers));
      }
    } catch { /* non-fatal */ }
  }

  return [...new Set(servers)];
}

/**
 * Discover agent definitions from agents/*.md.
 *
 * @param {string} pluginRoot
 * @returns {string[]} agent names
 */
function discoverAgents(pluginRoot) {
  const agentsDir = join(pluginRoot, "agents");
  if (!existsSync(agentsDir)) return [];

  /** @type {string[]} */
  const agents = [];
  try {
    for (const file of readdirSync(agentsDir)) {
      if (!file.endsWith(".md")) continue;
      agents.push(file.replace(".md", ""));
    }
  } catch { /* non-fatal */ }
  return agents;
}

/**
 * Read plugin manifest (.claude-plugin/plugin.json) for metadata.
 *
 * @param {string} pluginRoot
 * @returns {{ name: string, version: string, description: string }}
 */
function readManifest(pluginRoot) {
  const manifestPath = join(pluginRoot, ".claude-plugin", "plugin.json");
  if (!existsSync(manifestPath)) {
    const name = pluginRoot.split("/").pop() || "unknown";
    return { name, version: "unknown", description: "" };
  }
  try {
    const m = JSON.parse(readFileSync(manifestPath, "utf8"));
    return {
      name: String(m.name || pluginRoot.split("/").pop()),
      version: String(m.version || "unknown"),
      description: String(m.description || ""),
    };
  } catch {
    return {
      name: pluginRoot.split("/").pop() || "unknown",
      version: "unknown",
      description: "",
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover all installed plugins and their capabilities.
 *
 * @returns {{ plugins: object[], capability_map: object, total_plugins: number, total_skills: number, total_mcp_servers: number }}
 */
export function discoverAllPlugins() {
  /** @type {object[]} */
  const plugins = [];
  const installedPluginsPath = getInstalledPluginsPath();

  if (!existsSync(installedPluginsPath)) {
    return { plugins: [], capability_map: {}, total_plugins: 0, total_skills: 0, total_mcp_servers: 0 };
  }

  /** @type {{ [pluginId: string]: object[] }} */
  let installed;
  try {
    installed = JSON.parse(readFileSync(installedPluginsPath, "utf8")).plugins || {};
  } catch {
    return { plugins: [], capability_map: {}, total_plugins: 0, total_skills: 0, total_mcp_servers: 0 };
  }

  let totalSkills = 0;
  let totalMcpServers = 0;

  for (const [pluginId, entries] of Object.entries(installed)) {
    if (!Array.isArray(entries) || entries.length === 0) continue;

    // Use the most recent install entry
    const entry = entries.sort(
      (a, b) => (b.lastUpdated || b.installedAt || "").localeCompare(a.lastUpdated || a.installedAt || "")
    )[0];

    const pluginRoot = entry.installPath;
    if (!pluginRoot || !existsSync(pluginRoot)) continue;

    const manifest = readManifest(pluginRoot);
    const skills = discoverSkills(pluginRoot);
    const commands = discoverCommands(pluginRoot);
    const mcpServers = discoverMcpServers(pluginRoot);
    const agents = discoverAgents(pluginRoot);

    // Skip self (second-claude-code itself)
    if (manifest.name === "second-claude-code") continue;

    // Skip empty plugins (no skills, no commands, no MCP, no agents)
    if (skills.length === 0 && commands.length === 0 && mcpServers.length === 0 && agents.length === 0) continue;

    totalSkills += skills.length;
    totalMcpServers += mcpServers.length;

    plugins.push({
      id: pluginId,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      install_path: pluginRoot,
      scope: entry.scope || "user",
      skills,
      commands,
      mcp_servers: mcpServers,
      agents,
      updated_at: entry.lastUpdated || entry.installedAt || null,
    });
  }

  // Build flattened capability map for quick route lookup
  /** @type {{ [pluginName: string]: { skills: string[], commands: string[], mcp_servers: string[], description: string } }} */
  const capabilityMap = {};
  for (const p of plugins) {
    capabilityMap[p.name] = {
      skills: p.skills.map(/** @param {{name:string}} s */ (s) => s.name),
      commands: p.commands.map(/** @param {{name:string}} c */ (c) => c.name),
      mcp_servers: p.mcp_servers,
      description: p.description,
    };
  }

  return {
    plugins,
    capability_map: capabilityMap,
    total_plugins: plugins.length,
    total_skills: totalSkills,
    total_mcp_servers: totalMcpServers,
  };
}

/**
 * Get capabilities for a specific plugin by name or ID.
 *
 * @param {string} identifier — plugin name or plugin ID
 * @returns {object | null}
 */
export function getPluginCapabilities(identifier) {
  const all = discoverAllPlugins();
  const match = all.plugins.find(
    (p) => p.name === identifier || p.id === identifier
  );
  return match || null;
}

/**
 * Route a task keyword to matching plugins.
 * Returns plugins whose skills/commands/descriptions match the keyword.
 *
 * @param {string} keyword — task keyword like "review", "commit", "design"
 * @param {{ intent?: ReturnType<typeof inferTaskIntent>, phase?: string }} options
 * @returns {{ plugin: string, skills: string[], commands: string[], match_source: string, score: number, matched_items: { skills: object[], commands: object[] } }[]}
 */
export function routeTask(keyword, options = {}) {
  const all = discoverAllPlugins();
  const intent = options.intent || inferTaskIntent(keyword, options.phase);

  /** @type {{ plugin: string, skills: string[], commands: string[], match_source: string, score: number, matched_items: { skills: object[], commands: object[] } }[]} */
  const matches = [];

  for (const p of all.plugins) {
    const matchedSkills = [];
    const matchedCommands = [];

    for (const s of p.skills) {
      const score = scoreCapability(p, s, "skill", intent);
      if (score > 0) {
        matchedSkills.push({ name: s.name, score });
      }
    }

    for (const c of p.commands) {
      const score = scoreCapability(p, c, "command", intent);
      if (score > 0) {
        matchedCommands.push({ name: c.name, score });
      }
    }

    matchedSkills.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    matchedCommands.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    if (matchedSkills.length > 0 || matchedCommands.length > 0) {
      const bestSkillScore = matchedSkills[0]?.score || 0;
      const bestCommandScore = matchedCommands[0]?.score || 0;
      const score = Math.max(bestSkillScore, bestCommandScore);
      matches.push({
        plugin: p.name,
        skills: matchedSkills.map((s) => s.name),
        commands: matchedCommands.map((c) => c.name),
        match_source: matchedSkills.length > 0 ? "skill" : "command",
        score,
        matched_items: {
          skills: matchedSkills,
          commands: matchedCommands,
        },
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score || a.plugin.localeCompare(b.plugin));
}

/**
 * Build actionable Skill/slash-command instructions from sorted routes.
 *
 * @param {{ plugin: string, skills: string[], commands: string[], matched_items?: { skills?: object[], commands?: object[] } }[]} routes
 * @returns {{ plugin: string, name: string, invoke: string, type: string, score: number }[]}
 */
export function buildDispatchInstructions(routes) {
  /** @type {{ plugin: string, name: string, invoke: string, type: string, score: number }[]} */
  const dispatchInstructions = [];

  for (const r of routes) {
    const skills = r.matched_items?.skills || r.skills.map((name) => ({ name, score: r.score || 0 }));
    const commands = r.matched_items?.commands || r.commands.map((name) => ({ name, score: r.score || 0 }));

    for (const skill of skills) {
      const name = `${r.plugin}-${skill.name}`;
      dispatchInstructions.push({
        plugin: r.plugin,
        name,
        invoke: `Skill: ${name}`,
        type: "skill",
        score: skill.score || 0,
      });
    }
    for (const cmd of commands) {
      const invoke = `/${r.plugin}:${cmd.name}`;
      dispatchInstructions.push({
        plugin: r.plugin,
        name: invoke,
        invoke,
        type: "command",
        score: cmd.score || 0,
      });
    }
  }

  return dispatchInstructions.sort((a, b) => b.score - a.score || a.invoke.localeCompare(b.invoke));
}

/**
 * Build a complete routing plan for an MCP request or prompt-detect hook.
 *
 * @param {{ keyword?: string, phase?: string }} input
 */
export function getDispatchPlan({ keyword, phase } = {}) {
  const intent = inferTaskIntent(keyword || "", phase);
  const search = keyword || intent.search || "";

  if (!search) {
    throw new Error("Either 'keyword' or 'phase' (plan|do|check|act) is required.");
  }

  const routes = routeTask(search, { intent, phase });
  const dispatch = buildDispatchInstructions(routes).slice(0, 10);
  const top = dispatch[0] || null;

  return {
    search,
    phase: phase || null,
    intent: intent.name,
    routes,
    dispatch,
    recommendation: top
      ? `Found ${routes.length} plugin(s). Auto-dispatch top pick: ${top.invoke}. ${top.type === "skill" ? "Invoke the Skill tool with this exact name." : "Invoke this slash command."}`
      : `No matching plugins found for "${search}". Consider installing plugins with relevant skills.`,
  };
}

/**
 * Generate a dynamic <skill-check> dispatch guide for the prompt-detect hook.
 * Replaces the old hardcoded genericGuide. Groups external plugins by
 * task category and includes exact Skill tool invocation strings.
 *
 * @returns {string}
 */
export function generateDispatchGuide() {
  const all = discoverAllPlugins();
  if (all.total_plugins === 0) return "";

  const lines = [];
  lines.push("<skill-check>");
  lines.push("[MANDATORY] Active dispatch guide — external plugins detected at session start:");
  lines.push("");

  const phaseLabels = {
    plan: "PLAN (research / explore / strategy)",
    do: "DO (write / build / create / design)",
    check: "CHECK (review / test / audit / validate)",
    act: "ACT (commit / deploy / fix / format)",
  };

  for (const [phase, label] of Object.entries(phaseLabels)) {
    const plan = getDispatchPlan({ phase });
    if (plan.dispatch.length === 0) continue;
    lines.push(`## ${label}`);
    for (const d of plan.dispatch.slice(0, 8)) {
      lines.push(`- ${d.invoke} (${d.plugin}, score ${d.score})`);
    }
    lines.push("");
  }

  // Auto-dispatch rules
  lines.push("## Auto-dispatch rules");
  lines.push("When PDCA routing fires:");
  lines.push("- **plan phase**: before planning from scratch, invoke the top research/memory plugin from PLAN list when available");
  lines.push("- **check phase**: before writing your own review, MUST invoke Skill tool with top-matched plugin from CHECK list");
  lines.push("- **act phase**: after completing work, invoke commit/dispatch plugin from ACT list");
  lines.push("- **do phase**: for frontend/design tasks, prefer external design plugins over internal write skill");
  lines.push("- **direct plugin match**: if a user prompt strongly matches an installed plugin skill/command, dispatch that external capability first");
  lines.push("");
  lines.push("Match found? → Invoke Skill tool FIRST, then respond.");
  lines.push("</skill-check>");

  return lines.join("\n");
}
