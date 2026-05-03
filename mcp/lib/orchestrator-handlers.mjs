/**
 * Orchestrator MCP handler implementations.
 *
 * Runtime plugin discovery, routing, and dispatch — enables second-claude-code
 * to orchestrate the user's entire Claude Code plugin ecosystem through PDCA
 * phase routing.
 */

import { discoverAllPlugins, getPluginCapabilities, getDispatchPlan } from "../../hooks/lib/plugin-discovery.mjs";

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

/**
 * orchestrator_list_plugins — discover all installed plugins with capabilities.
 */
export function handleOrchestratorListPlugins() {
  const result = discoverAllPlugins();
  return {
    total_plugins: result.total_plugins,
    total_external_skills: result.total_skills,
    total_external_mcp_servers: result.total_mcp_servers,
    plugins: result.plugins.map((p) => ({
      name: p.name,
      version: p.version,
      description: p.description,
      skill_count: p.skills.length,
      command_count: p.commands.length,
      mcp_server_count: p.mcp_servers.length,
      agent_count: p.agents.length,
      scope: p.scope,
      skills: p.skills.map((/** @type {{name:string}} */ s) => s.name),
      commands: p.commands.map((/** @type {{name:string}} */ c) => c.name),
      mcp_servers: p.mcp_servers,
    })),
  };
}

/**
 * orchestrator_get_plugin — detailed info on a specific plugin.
 *
 * @param {{ plugin: string }} input
 */
export function handleOrchestratorGetPlugin({ plugin } = {}) {
  if (typeof plugin !== "string" || plugin.trim() === "") {
    throw new Error("plugin name is required");
  }

  const cap = getPluginCapabilities(plugin.trim());
  if (!cap) {
    return { found: false, plugin: plugin.trim(), hint: "Run orchestrator_list_plugins to see available plugins." };
  }

  return {
    found: true,
    name: cap.name,
    version: cap.version,
    description: cap.description,
    install_path: cap.install_path,
    scope: cap.scope,
    updated_at: cap.updated_at,
    skills: cap.skills,
    commands: cap.commands,
    mcp_servers: cap.mcp_servers,
    agents: cap.agents,
  };
}

/**
 * orchestrator_route — match a task keyword or PDCA phase to plugins.
 *
 * @param {{ keyword?: string, phase?: string }} input
 */
export function handleOrchestratorRoute({ keyword, phase } = {}) {
  return getDispatchPlan({ keyword, phase });
}

/**
 * orchestrator_health — quick health check of the plugin ecosystem.
 */
export function handleOrchestratorHealth() {
  const result = discoverAllPlugins();

  const withSkills = result.plugins.filter((p) => p.skills.length > 0);
  const withMcp = result.plugins.filter((p) => p.mcp_servers.length > 0);
  const withCommands = result.plugins.filter((p) => p.commands.length > 0);

  return {
    total_plugins: result.total_plugins,
    plugins_with_skills: withSkills.length,
    plugins_with_mcp: withMcp.length,
    plugins_with_commands: withCommands.length,
    external_skills_available: result.total_skills,
    external_mcp_available: result.total_mcp_servers,
    ready: result.total_plugins > 0,
    status: result.total_plugins > 0 ? "healthy" : "no_plugins_detected",
    plugin_names: result.plugins.map((p) => p.name),
  };
}
