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

const PLUGINS_ROOT = join(homedir(), ".claude", "plugins");
const INSTALLED_PLUGINS = join(PLUGINS_ROOT, "installed_plugins.json");

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

  if (!existsSync(INSTALLED_PLUGINS)) {
    return { plugins: [], capability_map: {}, total_plugins: 0, total_skills: 0, total_mcp_servers: 0 };
  }

  /** @type {{ [pluginId: string]: object[] }} */
  let installed;
  try {
    installed = JSON.parse(readFileSync(INSTALLED_PLUGINS, "utf8")).plugins || {};
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
 * @returns {{ plugin: string, skills: string[], commands: string[], match_source: string }[]}
 */
export function routeTask(keyword) {
  const all = discoverAllPlugins();
  const lower = keyword.toLowerCase();

  /** @type {{ plugin: string, skills: string[], commands: string[], match_source: string }[]} */
  const matches = [];

  for (const p of all.plugins) {
    const matchedSkills = [];
    const matchedCommands = [];
    let matchSource = "";

    // Check skills
    for (const s of p.skills) {
      if (
        s.name.toLowerCase().includes(lower) ||
        s.description.toLowerCase().includes(lower)
      ) {
        matchedSkills.push(s.name);
      }
    }

    // Check commands
    for (const c of p.commands) {
      if (
        c.name.toLowerCase().includes(lower) ||
        c.description.toLowerCase().includes(lower)
      ) {
        matchedCommands.push(c.name);
      }
    }

    // Check plugin description
    if (p.description.toLowerCase().includes(lower)) {
      matchSource = matchSource || "description";
    }
    if (matchedSkills.length > 0) matchSource = matchSource || "skill";
    if (matchedCommands.length > 0) matchSource = matchSource || "command";

    if (matchedSkills.length > 0 || matchedCommands.length > 0 || matchSource === "description") {
      matches.push({
        plugin: p.name,
        skills: matchedSkills,
        commands: matchedCommands,
        match_source: matchSource,
      });
    }
  }

  return matches;
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

  // Phase-to-plugin mapping with explicit priority ordering
  /** @type {{ [phase: string]: { plugin: string, skills: string[], commands: string[] }[] }} */
  const phaseMap = { plan: [], do: [], check: [], act: [] };

  for (const p of all.plugins) {
    const skillNames = p.skills.map(/** @param {{name:string}} s */ (s) => s.name);
    const cmdNames = p.commands.map(/** @param {{name:string}} c */ (c) => c.name);
    const allText = [p.name, p.description, ...skillNames, ...cmdNames].join(" ").toLowerCase();

    // Plan: research, search, explore, find, strategy
    if (/\b(research|search|explore|find|strategy|know?ledge|learn|discover|memory|pathfinder)\b/.test(allText)) {
      phaseMap.plan.push({ plugin: p.name, skills: skillNames, commands: cmdNames });
    }
    // Do: write, build, create, design, generate, implement, component, ui
    if (/\b(write|build|creat|generat|design|compon|ui\b|frontend|implement|codex|gpt)\b/.test(allText)) {
      phaseMap.do.push({ plugin: p.name, skills: skillNames, commands: cmdNames });
    }
    // Check: review, test, audit, validate, lint, security, check, quality
    if (/\b(review|test|audit|valid|lint|secur|check|quality|debug|inspect|rabbit|experiment|flag)\b/.test(allText)) {
      phaseMap.check.push({ plugin: p.name, skills: skillNames, commands: cmdNames });
    }
    // Act: commit, deploy, push, simplify, refactor, fix, format, release
    if (/\b(commit|deploy|push|simplif|refactor|fix|format|releas|autofix|merge)\b/.test(allText)) {
      phaseMap.act.push({ plugin: p.name, skills: skillNames, commands: cmdNames });
    }
  }

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
    const entries = phaseMap[phase];
    if (entries.length === 0) continue;
    lines.push(`## ${label}`);
    // Deduplicate: same plugin may appear in multiple skill matches
    const seen = new Set();
    for (const e of entries) {
      if (seen.has(e.plugin)) continue;
      seen.add(e.plugin);
      for (const s of e.skills) {
        lines.push(`- \`${e.plugin}:${s}\` → Skill: "${e.plugin}-${s}"`);
      }
      for (const c of e.commands) {
        lines.push(`- \`/${e.plugin}:${c}\` → command: "${c}"`);
      }
    }
    lines.push("");
  }

  // Auto-dispatch rules
  lines.push("## Auto-dispatch rules");
  lines.push("When PDCA routing fires:");
  lines.push("- **check phase**: before writing your own review, MUST invoke Skill tool with top-matched plugin from CHECK list");
  lines.push("- **act phase**: after completing work, invoke commit/dispatch plugin from ACT list");
  lines.push("- **do phase**: for frontend/design tasks, prefer external design plugins over internal write skill");
  lines.push("");
  lines.push("Match found? → Invoke Skill tool FIRST, then respond.");
  lines.push("</skill-check>");

  return lines.join("\n");
}
