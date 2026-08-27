/**
 * Plugin Discovery — runtime scan of the user's installed Claude Code plugins.
 *
 * Reads ~/.claude/plugins/installed_plugins.json and inspects each plugin's
 * filesystem structure to build a capability map. Used by the orchestrator
 * MCP tools and session-start injection to route PDCA phases to external
 * plugins.
 */

import {
  closeSync,
  existsSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  statSync,
} from "fs";
import { createHash } from "crypto";
import { basename, dirname, isAbsolute, join, relative } from "path";
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

/**
 * Claude Code stores plugin enablement in the settings file beside the
 * plugins directory.  The test-only override keeps path validation and
 * settings behaviour testable without touching a user's home directory.
 */
function getSettingsPath() {
  return process.env.__SCC_TEST_SETTINGS_PATH || join(dirname(getPluginsRoot()), "settings.json");
}

// Plugin IDs in installed_plugins.json include the marketplace suffix (for
// example, `reviewer@marketplace`).  Capability names are the stricter slug
// form used in Skill and slash-command invocations.  Neither form permits
// path separators, whitespace, control characters, or shell metacharacters.
const IDENTIFIER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,127})$/;
const PLUGIN_ID_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,127})(?:@[A-Za-z0-9](?:[A-Za-z0-9._-]{0,127}))?$/;
const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f-\u009f]/;
const MAX_METADATA_TEXT_LENGTH = 2048;
const MAX_VERSION_TEXT_LENGTH = 128;
const MAX_MANIFEST_FILE_BYTES = 1024 * 1024;
const MAX_CAPABILITY_FILE_BYTES = 256 * 1024;
const MAX_REGISTRY_FILE_BYTES = 1024 * 1024;
const MAX_SKILL_DIRECTORY_ENTRIES = 256;
const MAX_COMMAND_DIRECTORY_ENTRIES = 512;
const MAX_AGENT_DIRECTORY_ENTRIES = 512;

/**
 * Read a small metadata file without ever loading more than its budget.
 * statSync is an early rejection for sparse/huge files; the max+1 read also
 * handles a file growing between stat and read.
 */
function readBoundedText(file, maxBytes) {
  let fd;
  try {
    const stat = statSync(file);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    fd = openSync(file, "r");
    const buffer = Buffer.allocUnsafe(maxBytes + 1);
    const bytesRead = readSync(fd, buffer, 0, maxBytes + 1, 0);
    if (bytesRead > maxBytes) return null;
    return buffer.subarray(0, bytesRead).toString("utf8");
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* non-fatal */ }
    }
  }
}

export function isValidPluginIdentifier(value) {
  return typeof value === "string" && PLUGIN_ID_RE.test(value) && !CONTROL_CHAR_RE.test(value);
}

export function isValidCapabilityIdentifier(value) {
  return typeof value === "string" && IDENTIFIER_RE.test(value) && !CONTROL_CHAR_RE.test(value);
}

function safeText(value, fallback = "", maxLength = MAX_METADATA_TEXT_LENGTH) {
  if (typeof value !== "string" || CONTROL_CHAR_RE.test(value)) return fallback;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function isWithin(root, candidate) {
  const rel = relative(root, candidate);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Resolve an install path and require it to remain below one of Claude's
 * plugin storage roots.  realpathSync closes the symlink escape hatch before
 * the containment check.  Only existing directories are accepted.
 */
export function resolveSafePluginInstallPath(installPath, pluginsRoot = getPluginsRoot()) {
  if (typeof installPath !== "string" || !installPath || CONTROL_CHAR_RE.test(installPath) || !isAbsolute(installPath)) {
    return null;
  }

  let candidate;
  try {
    candidate = realpathSync(installPath);
    if (!statSync(candidate).isDirectory()) return null;
  } catch {
    return null;
  }

  for (const root of [join(pluginsRoot, "cache"), join(pluginsRoot, "installed")]) {
    try {
      const realRoot = realpathSync(root);
      if (isWithin(realRoot, candidate)) return candidate;
    } catch {
      // A missing storage root simply cannot authorize an install path.
    }
  }
  return null;
}

function canonicalExistingPath(value) {
  if (typeof value !== "string" || !value || CONTROL_CHAR_RE.test(value)) return null;
  try {
    return realpathSync(value);
  } catch {
    return null;
  }
}

function localEntryMatchesProject(entry) {
  if (entry.scope !== "local" && entry.scope !== "project") return true;
  const projectPath = entry.projectPath ?? entry.project_path ?? entry.projectRoot ?? entry.project_root;
  const currentProject = canonicalExistingPath(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const declaredProject = canonicalExistingPath(projectPath);
  // Exact canonical equality is intentional: a sibling such as /repo-other
  // must not pass a prefix check for /repo, and symlink aliases should pass.
  return currentProject !== null && declaredProject !== null && currentProject === declaredProject;
}

function readSettingsFile(file) {
  try {
    const raw = readBoundedText(file, MAX_REGISTRY_FILE_BYTES);
    if (raw === null) return { file, raw: "", enabledPlugins: null };
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Invalid settings must not disable every plugin.
    }
    return { file, raw, enabledPlugins: parsed && typeof parsed === "object" ? parsed.enabledPlugins : null };
  } catch {
    return { file, raw: "", enabledPlugins: null };
  }
}

function mergeEnabledPlugins(userEnabled, projectEnabled) {
  if (Array.isArray(projectEnabled)) return projectEnabled;
  if (projectEnabled && typeof projectEnabled === "object") {
    return {
      ...(userEnabled && typeof userEnabled === "object" && !Array.isArray(userEnabled) ? userEnabled : {}),
      ...projectEnabled,
    };
  }
  return userEnabled;
}

function readSettingsSnapshot() {
  const userFile = getSettingsPath();
  const projectRoot = canonicalExistingPath(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const projectFile = process.env.__SCC_TEST_PROJECT_SETTINGS_PATH
    || (projectRoot ? join(projectRoot, ".claude", "settings.json") : "");
  const user = readSettingsFile(userFile);
  const project = projectFile && projectFile !== userFile
    ? readSettingsFile(projectFile)
    : { file: projectFile, raw: "", enabledPlugins: null };
  return {
    file: `${user.file}\n${project.file}`,
    raw: `${user.raw}\n${project.raw}`,
    enabledPlugins: mergeEnabledPlugins(user.enabledPlugins, project.enabledPlugins),
  };
}

function pluginIsEnabled(pluginId, manifestName, enabledPlugins) {
  if (Array.isArray(enabledPlugins)) {
    return enabledPlugins.some((value) => value === pluginId || value === manifestName);
  }
  if (!enabledPlugins || typeof enabledPlugins !== "object") return true;

  // Settings normally use plugin IDs.  The manifest-name fallback supports
  // hand-authored settings and remains exact (no substring matching).
  const keys = [pluginId, manifestName];
  const explicit = keys.find((key) => Object.prototype.hasOwnProperty.call(enabledPlugins, key));
  return explicit === undefined || enabledPlugins[explicit] !== false;
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

// Which plugin each intent prefers is the one part of routing that is not discovered — it is the
// table above. That is fine as a default and wrong as a verdict: install a review plugin you like
// better than the pinned one and it can never win, because the pin is worth +60.
//
// A JSON file at `${CLAUDE_PLUGIN_DATA}/plugin-preferences.json` overrides it per intent:
//   { "review": ["my-reviewer"], "commit": [] }
// An empty array drops the pin entirely and lets capabilities compete on their own merits.
/** @type {{ file: string | null, key: string, overrides: object } | null} */
let preferenceOverridesCache = null;

function loadPreferenceOverrides() {
  const dataDir = process.env.CLAUDE_PLUGIN_DATA;
  const file = dataDir ? join(dataDir, "plugin-preferences.json") : null;
  if (!file) {
    preferenceOverridesCache = { file: null, key: "none", overrides: {} };
    return preferenceOverridesCache.overrides;
  }

  let raw;
  let mtime = "missing";
  try {
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error("not a file");
    raw = readBoundedText(file, MAX_CAPABILITY_FILE_BYTES);
    if (raw === null) throw new Error("preference file exceeds read budget");
    mtime = String(stat.mtimeMs);
  } catch {
    raw = "";
  }

  // mtime catches the usual edit case; the digest also catches replacements
  // that preserve timestamps (common in tests and atomic file writers).
  const digest = createHash("sha256").update(raw).digest("hex");
  const key = `${mtime}:${digest}`;
  if (preferenceOverridesCache?.file === file && preferenceOverridesCache.key === key) {
    return preferenceOverridesCache.overrides;
  }

  let overrides = {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      overrides = Object.fromEntries(
        Object.entries(parsed).filter(([intent, plugins]) =>
          isValidCapabilityIdentifier(intent) && Array.isArray(plugins)
        ).map(([intent, plugins]) => [
          intent,
          plugins.filter((plugin) => isValidPluginIdentifier(plugin) || isValidCapabilityIdentifier(plugin)),
        ])
      );
    }
  } catch {
    // A malformed override must not take routing down with it — fall back to the defaults.
  }
  preferenceOverridesCache = { file, key, overrides };
  return overrides;
}

function makeIntent(name, profile) {
  const overrides = loadPreferenceOverrides();
  return {
    name,
    search: profile.search || "",
    keywords: profile.keywords || [],
    preferred_plugins: Array.isArray(overrides[name])
      ? overrides[name]
      : profile.preferred_plugins || [],
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

function resolveContainedPath(root, candidate) {
  if (typeof candidate !== "string" || !candidate || CONTROL_CHAR_RE.test(candidate)) return null;
  try {
    const resolved = realpathSync(isAbsolute(candidate) ? candidate : join(root, candidate));
    return isWithin(root, resolved) ? resolved : null;
  } catch {
    return null;
  }
}

function resolveManifestPath(root, declaration) {
  // Manifest paths are plugin-relative by contract. Reject absolute paths
  // before resolution even when they happen to point inside the plugin.
  if (typeof declaration !== "string" || !declaration || isAbsolute(declaration)) return null;
  return resolveContainedPath(root, declaration);
}

function addDiscoveredSkill(pluginRoot, skillFile, fallbackName, skills, seenNames) {
  const safeFile = resolveContainedPath(pluginRoot, skillFile);
  if (!safeFile || basename(safeFile) !== "SKILL.md") return;
  try {
    const content = readBoundedText(safeFile, MAX_CAPABILITY_FILE_BYTES);
    if (content === null) return;
    const meta = parseFrontmatter(content);
    const name = meta.name === undefined ? fallbackName : meta.name;
    if (!isValidCapabilityIdentifier(name) || seenNames.has(name)) return;
    seenNames.add(name);
    skills.push({
      name,
      description: safeText(meta.description, name, MAX_METADATA_TEXT_LENGTH),
    });
  } catch {
    // An unreadable declaration must not prevent discovery of other entries.
  }
}

function addDeclaredSkill(pluginRoot, declaration, skills, seenNames) {
  const declared = resolveManifestPath(pluginRoot, declaration);
  if (!declared) return;
  try {
    if (statSync(declared).isDirectory()) {
      addDiscoveredSkill(pluginRoot, join(declared, "SKILL.md"), basename(declared), skills, seenNames);
    } else {
      addDiscoveredSkill(pluginRoot, declared, basename(declared, ".md"), skills, seenNames);
    }
  } catch {
    // Non-file declarations are ignored.
  }
}

/**
 * Discover skills from a plugin's skills/ directory.
 * Each skill is `skills/<name>/SKILL.md` with YAML frontmatter.
 *
 * @param {string} pluginRoot
 * @returns {{ name: string, description: string }[]}
 */
function discoverSkills(pluginRoot, declaredPaths = []) {

  /** @type {{ name: string, description: string }[]} */
  const skills = [];
  const seenNames = new Set();

  // Official manifests may declare nested paths (for example
  // ./skills/engineering/code-review). Resolve and contain each declaration
  // before reading it so a symlink cannot escape the plugin install.
  for (const declaration of declaredPaths.slice(0, 256)) {
    addDeclaredSkill(pluginRoot, declaration, skills, seenNames);
  }

  const skillsDir = resolveContainedPath(pluginRoot, join(pluginRoot, "skills"));
  if (!skillsDir) return skills;
  try {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true }).slice(0, MAX_SKILL_DIRECTORY_ENTRIES)) {
      if (!entry.isDirectory()) continue;
      addDiscoveredSkill(pluginRoot, join(skillsDir, entry.name, "SKILL.md"), entry.name, skills, seenNames);
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
function addDiscoveredCommand(pluginRoot, commandFile, fallbackName, commands, seenNames) {
  const safeFile = resolveContainedPath(pluginRoot, commandFile);
  if (!safeFile || !safeFile.endsWith(".md")) return;
  try {
    const content = readBoundedText(safeFile, MAX_CAPABILITY_FILE_BYTES);
    if (content === null) return;
    const meta = parseFrontmatter(content);
    const name = meta.name === undefined ? fallbackName : meta.name;
    if (!isValidCapabilityIdentifier(name) || seenNames.has(name)) return;
    seenNames.add(name);
    commands.push({
      name,
      description: safeText(meta.description, name, MAX_METADATA_TEXT_LENGTH),
    });
  } catch {
    // An unreadable declaration must not prevent discovery of other entries.
  }
}

function addDeclaredCommand(pluginRoot, declaration, commands, seenNames) {
  const declared = resolveManifestPath(pluginRoot, declaration);
  if (!declared) return;
  try {
    if (statSync(declared).isDirectory()) {
      for (const entry of readdirSync(declared, { withFileTypes: true }).slice(0, MAX_COMMAND_DIRECTORY_ENTRIES)) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          addDiscoveredCommand(pluginRoot, join(declared, entry.name), entry.name.slice(0, -3), commands, seenNames);
        }
      }
    } else {
      addDiscoveredCommand(pluginRoot, declared, basename(declared, ".md"), commands, seenNames);
    }
  } catch {
    // Non-file declarations are ignored.
  }
}

function discoverCommands(pluginRoot, declaredPaths = []) {

  /** @type {{ name: string, description: string }[]} */
  const commands = [];
  const seenNames = new Set();
  for (const declaration of declaredPaths.slice(0, 256)) {
    addDeclaredCommand(pluginRoot, declaration, commands, seenNames);
  }

  const commandsDir = resolveContainedPath(pluginRoot, join(pluginRoot, "commands"));
  if (!commandsDir) return commands;
  try {
    for (const file of readdirSync(commandsDir).slice(0, MAX_COMMAND_DIRECTORY_ENTRIES)) {
      if (!file.endsWith(".md")) continue;
      addDiscoveredCommand(pluginRoot, join(commandsDir, file), file.slice(0, -3), commands, seenNames);
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
      const rawManifest = readBoundedText(manifestPath, MAX_MANIFEST_FILE_BYTES);
      if (rawManifest !== null) {
        const manifest = JSON.parse(rawManifest);
        if (manifest.mcpServers && typeof manifest.mcpServers === "object") {
          servers.push(...Object.keys(manifest.mcpServers).filter(isValidCapabilityIdentifier));
        }
      }
    } catch { /* non-fatal */ }
  }

  // .mcp.json (alternative MCP config)
  const mcpJsonPath = join(pluginRoot, ".mcp.json");
  if (existsSync(mcpJsonPath)) {
    try {
      const rawMcpConfig = readBoundedText(mcpJsonPath, MAX_MANIFEST_FILE_BYTES);
      if (rawMcpConfig === null) return [...new Set(servers)];
      const mcpConfig = JSON.parse(rawMcpConfig);
      if (mcpConfig.mcpServers && typeof mcpConfig.mcpServers === "object") {
        servers.push(...Object.keys(mcpConfig.mcpServers).filter(isValidCapabilityIdentifier));
      }
    } catch { /* non-fatal */ }
  }

  return [...new Set(servers)];
}

/**
 * Discover agent definitions from agents/*.md.
 *
 * Agent filenames are human-facing labels (for example, Pokemon names), so
 * the callable identity comes from bounded frontmatter `name` metadata. The
 * filename fallback keeps legacy minimal fixtures usable when no metadata is
 * present, while a supplied invalid name is always rejected.
 *
 * @param {string} pluginRoot
 * @param {string} manifestName
 * @returns {{ name: string, invoke: string }[]} agent names and callable IDs
 */
function discoverAgents(pluginRoot, manifestName) {
  const agentsDir = resolveContainedPath(pluginRoot, join(pluginRoot, "agents"));
  if (!agentsDir) return [];

  /** @type {{ name: string, invoke: string }[]} */
  const agents = [];
  const seenNames = new Set();
  try {
    for (const file of readdirSync(agentsDir).slice(0, MAX_AGENT_DIRECTORY_ENTRIES)) {
      if (!file.endsWith(".md")) continue;
      const safeFile = resolveContainedPath(pluginRoot, join(agentsDir, file));
      if (!safeFile || !safeFile.endsWith(".md")) continue;
      const content = readBoundedText(safeFile, MAX_CAPABILITY_FILE_BYTES);
      if (content === null) continue;
      const meta = parseFrontmatter(content);
      const filenameName = file.slice(0, -3);
      const name = meta.name === undefined ? filenameName : meta.name;
      if (!isValidCapabilityIdentifier(name) || seenNames.has(name)) continue;
      seenNames.add(name);
      agents.push({ name, invoke: `${manifestName}:${name}` });
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
    return {
      name: isValidCapabilityIdentifier(name) ? name : "unknown",
      version: "unknown",
      description: "",
      skills: [],
      commands: [],
    };
  }
  try {
    const rawManifest = readBoundedText(manifestPath, MAX_MANIFEST_FILE_BYTES);
    if (rawManifest === null) return null;
    const m = JSON.parse(rawManifest);
    // An explicitly supplied invalid name must not be silently converted into
    // a routable identifier.  Callers skip the plugin when this returns null.
    if (m && Object.prototype.hasOwnProperty.call(m, "name") && !isValidCapabilityIdentifier(m.name)) {
      return null;
    }
    const name = m.name || pluginRoot.split("/").pop();
    if (!isValidCapabilityIdentifier(name)) return null;
    return {
      name,
      version: safeText(
        typeof m.version === "string" ? m.version : String(m.version || "unknown"),
        "unknown",
        MAX_VERSION_TEXT_LENGTH
      ),
      description: safeText(
        typeof m.description === "string" ? m.description : String(m.description || ""),
        "",
        MAX_METADATA_TEXT_LENGTH
      ),
      skills: Array.isArray(m.skills) ? m.skills.filter((entry) => typeof entry === "string").slice(0, 256) : [],
      commands: Array.isArray(m.commands) ? m.commands.filter((entry) => typeof entry === "string").slice(0, 256) : [],
    };
  } catch {
    return null;
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
const EMPTY_DISCOVERY = { plugins: [], capability_map: {}, total_plugins: 0, total_skills: 0, total_mcp_servers: 0 };

/**
 * Memoize the expensive per-plugin directory walks within one process.
 * prompt-detect calls discoverAllPlugins ~6x per prompt and each call walks every
 * installed plugin's skills/commands/agents/manifests. A hook process is
 * short-lived, so the cache is keyed on the resolved path + the raw
 * installed_plugins.json content; any install/uninstall invalidates it.
 * @type {{ key: string, result: object } | null}
 */
let _discoverCache = null;

export function discoverAllPlugins() {
  /** @type {object[]} */
  const plugins = [];
  const installedPluginsPath = getInstalledPluginsPath();
  const settings = readSettingsSnapshot();

  let raw;
  try {
    raw = readBoundedText(installedPluginsPath, MAX_REGISTRY_FILE_BYTES);
    if (raw === null) throw new Error("installed plugin registry exceeds read budget");
  } catch {
    // Missing or unreadable installed_plugins.json → nothing to discover.
    _discoverCache = null;
    return { ...EMPTY_DISCOVERY };
  }

  const cacheKey = `${installedPluginsPath}\n${raw}\n${settings.file}\n${settings.raw}`;
  if (_discoverCache && _discoverCache.key === cacheKey) {
    return _discoverCache.result;
  }

  /** @type {{ [pluginId: string]: object[] }} */
  let installed;
  try {
    const parsed = JSON.parse(raw);
    installed = parsed && typeof parsed === "object" && parsed.plugins && typeof parsed.plugins === "object"
      ? parsed.plugins
      : {};
  } catch {
    _discoverCache = null;
    return { ...EMPTY_DISCOVERY };
  }

  let totalSkills = 0;
  let totalMcpServers = 0;
  const seenNames = new Set();

  for (const [pluginId, entries] of Object.entries(installed)) {
    if (!isValidPluginIdentifier(pluginId) || !Array.isArray(entries) || entries.length === 0) continue;

    // Scope/project applicability is evaluated before choosing the newest
    // install. A newer local copy for another project must not hide an older
    // user-scoped copy that is valid for this process.
    const validEntries = entries.filter((entry) => entry && typeof entry === "object" && localEntryMatchesProject(entry));
    if (validEntries.length === 0) continue;

    // Try the most recent install first, but fall back to an older applicable
    // entry when a stale registry points at a missing/unsafe path, malformed
    // manifest, or disabled plugin. Never mutate the parsed registry array.
    const sortedEntries = [...validEntries].sort(
      (a, b) => String(b.lastUpdated || b.installedAt || "").localeCompare(String(a.lastUpdated || a.installedAt || ""))
    );

    /** @type {{ entry: object, pluginRoot: string, manifest: object } | null} */
    let selected = null;
    for (const candidate of sortedEntries) {
      const pluginRoot = resolveSafePluginInstallPath(candidate.installPath);
      if (!pluginRoot) continue;
      const manifest = readManifest(pluginRoot);
      if (!manifest || !pluginIsEnabled(pluginId, manifest.name, settings.enabledPlugins)) continue;

      // Skip this package by both the installed ID and its manifest name.  A
      // stale/mislabelled manifest must not make SCC route to itself.
      if (pluginId.split("@")[0].toLowerCase() === "scc" || manifest.name.toLowerCase() === "scc") continue;
      selected = { entry: candidate, pluginRoot, manifest };
      break;
    }
    if (!selected) continue;

    const { entry, pluginRoot, manifest } = selected;

    // A capability map is keyed by manifest name.  Keep the first valid
    // install deterministically and skip duplicates rather than overwriting a
    // previously discovered plugin without notice.
    if (seenNames.has(manifest.name)) continue;

    const skills = discoverSkills(pluginRoot, manifest.skills);
    const commands = discoverCommands(pluginRoot, manifest.commands);
    const mcpServers = discoverMcpServers(pluginRoot);
    const agents = discoverAgents(pluginRoot, manifest.name);

    // Skip empty plugins (no skills, no commands, no MCP, no agents)
    if (skills.length === 0 && commands.length === 0 && mcpServers.length === 0 && agents.length === 0) continue;

    seenNames.add(manifest.name);

    totalSkills += skills.length;
    totalMcpServers += mcpServers.length;

    plugins.push({
      id: pluginId,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      install_path: pluginRoot,
      scope: safeText(typeof entry.scope === "string" ? entry.scope : "user", "user"),
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

  const result = {
    plugins,
    capability_map: capabilityMap,
    total_plugins: plugins.length,
    total_skills: totalSkills,
    total_mcp_servers: totalMcpServers,
  };
  _discoverCache = { key: cacheKey, result };
  return result;
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
      // Plugin skills resolve as `plugin:skill`, the same shape the command branch below builds.
      // A hyphen here produced unresolvable ids like `frontend-design-frontend-design`.
      const name = `${r.plugin}:${skill.name}`;
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
      ? `Found ${routes.length} plugin(s). Advisory candidate: ${top.invoke}; no external tool was executed; caller must explicitly choose/invoke this capability.`
      : `No matching plugins found for "${search}". Consider installing plugins with relevant skills.`,
  };
}

/**
 * Generate an advisory list of discovered route candidates.
 *
 * This function is retained for callers that imported the v3.0.1 export, but
 * it is deliberately informational. The active prompt hook is standards-only
 * and does not consume this output or execute external capabilities.
 *
 * @returns {string}
 */
export function generateDispatchGuide() {
  const all = discoverAllPlugins();
  if (all.total_plugins === 0) return "";

  const lines = [];
  lines.push("Active plugin route candidates (advisory only; no external tool was executed):");
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

  lines.push("These candidates are informational; the caller must explicitly choose whether to use one.");

  return lines.join("\n");
}
