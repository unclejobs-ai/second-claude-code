import { realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Canonical form of a path: symlinks resolved component by component. When a
 * component doesn't exist yet (a project directory that hasn't been created),
 * resolution stops there and the rest of the path is appended as-is, using
 * whatever prefix was resolved so far — so a not-yet-existing path under an
 * existing, symlinked ancestor still compares correctly against a fully
 * resolved root.
 *
 * This does NOT normalize letter case — realpathSync preserves the case it's
 * given for real (non-symlink) path components. Case is handled separately
 * by `equalOrInside`.
 */
function canonical(inputPath) {
  const parts = resolve(inputPath).split(sep);
  let result = parts[0] === "" ? sep : parts[0]; // Handle absolute vs relative and empty first part

  for (let i = 1; i < parts.length; i++) {
    const component = parts[i];
    if (!component) continue; // Skip empty components

    const next = resolve(result, component);
    try {
      result = realpathSync(next);
    } catch (err) {
      if (err && err.code === "ENOENT") {
        // Doesn't exist yet; keep going from the last resolved prefix.
        result = next;
        continue;
      }
      // Anything else (EACCES on an unreadable ancestor, ELOOP, ENOTDIR, ...)
      // must not silently fall back to unresolved `resolve()` semantics for
      // the rest of the path — that would reopen the symlink/case bypass this
      // guard exists to close. Fail closed instead of guessing.
      throw new Error(`경로를 확인할 수 없습니다: ${next} (${err && err.code}). ${err && err.message}`);
    }
  }

  return result;
}

/**
 * True when `target` equals or is nested under `root`, checked both exactly
 * and case-insensitively. APFS (macOS) and NTFS (Windows) default to
 * case-insensitive-but-case-preserving, so two differently-cased strings can
 * name the identical on-disk directory, and `canonical` above does not
 * correct for that. Bias toward refusing: a false positive here costs a
 * confusing error message on a case-sensitive volume where two distinct
 * directories happen to differ only by case; a false negative would let user
 * data get written into the plugin install.
 */
function equalOrInside(target, root) {
  if (target === root || target.startsWith(root + sep)) return true;
  const t = target.toLowerCase();
  const r = root.toLowerCase();
  return t === r || t.startsWith(r + sep);
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
  return equalOrInside(target, pluginRoot);
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
