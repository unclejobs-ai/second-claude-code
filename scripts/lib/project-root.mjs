import { readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Canonical form of a path: symlinks followed and case normalized to whatever
 * the filesystem actually stores. On case-insensitive systems (macOS APFS),
 * reads each directory to find the actual on-disk casing. When a path component
 * doesn't exist, trails the rest as-is (projects may not exist yet).
 */
function canonical(inputPath) {
  const parts = resolve(inputPath).split(sep);
  let result = parts[0] === "" ? sep : parts[0]; // Handle absolute vs relative and empty first part

  for (let i = 1; i < parts.length; i++) {
    const component = parts[i];
    if (!component) continue; // Skip empty components

    let next = resolve(result, component);

    try {
      // Check if this path exists
      statSync(next);
      // It exists; use realpathSync to normalize symlinks, then read parent to get correct case
      const real = realpathSync(result);
      const entries = readdirSync(real);
      const actualName = entries.find((e) => e.toLowerCase() === component.toLowerCase());
      result = resolve(real, actualName || component);
    } catch {
      // Path doesn't exist yet; just append it as-is
      result = next;
    }
  }

  // Follow any remaining symlinks in the final result
  try {
    result = realpathSync(result);
  } catch {
    // If the final path doesn't exist, return what we have
  }

  return result;
}

/**
 * The plugin install root: two levels above this module (scripts/lib → scripts → root).
 */
function pluginRootFrom(moduleUrl) {
  return canonical(resolve(dirname(fileURLToPath(moduleUrl)), "..", ".."));
}

export function isInsidePluginInstall(root, moduleUrl = import.meta.url) {
  const pluginRoot = pluginRootFrom(moduleUrl);
  const target = canonical(root);
  if (target === pluginRoot) return true;
  // Trailing separator so `/a/scc-standards` does not match `/a/scc`.
  return target.startsWith(pluginRoot + sep);
}

export function resolveProjectRoot({
  env = process.env,
  cwd = process.cwd(),
  moduleUrl = import.meta.url,
} = {}) {
  const root = resolve(env.CLAUDE_PROJECT_DIR || cwd);
  if (isInsidePluginInstall(root, moduleUrl)) {
    throw new Error(
      `프로젝트 루트가 플러그인 설치 경로 안입니다: ${root}. ` +
        `CLAUDE_PROJECT_DIR을 설정하거나 프로젝트 디렉터리에서 실행하십시오.`
    );
  }
  return root;
}
