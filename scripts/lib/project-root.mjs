import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The plugin install root: two levels above this module (scripts/lib → scripts → root).
 */
function pluginRootFrom(moduleUrl) {
  return resolve(dirname(fileURLToPath(moduleUrl)), "..", "..");
}

export function isInsidePluginInstall(root, moduleUrl = import.meta.url) {
  const pluginRoot = pluginRootFrom(moduleUrl);
  const target = resolve(root);
  if (target === pluginRoot) return true;
  // Compare with a trailing separator so `/a/scc-standards` does not match `/a/scc`.
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
