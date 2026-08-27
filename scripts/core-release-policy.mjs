import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";

const FORBIDDEN_LIFECYCLE_SCRIPTS = [
  "preinstall",
  "install",
  "postinstall",
  "prepare",
  "prepack"
];

const RUNTIME_DEPENDENCY_FIELDS = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "bundledDependencies",
  "bundleDependencies"
];

function hasEntries(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== null && typeof value === "object"
    ? Object.keys(value).length > 0
    : value !== undefined;
}

export function assertSafePackedManifest(manifest) {
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("packed package.json must contain a JSON object");
  }

  const scripts = manifest.scripts;
  for (const script of FORBIDDEN_LIFECYCLE_SCRIPTS) {
    if (scripts !== null && typeof scripts === "object" && script in scripts) {
      throw new Error(`packed package.json contains forbidden lifecycle script ${script}`);
    }
  }
  for (const field of RUNTIME_DEPENDENCY_FIELDS) {
    if (hasEntries(manifest[field])) {
      throw new Error(`packed package.json contains runtime dependency field ${field}`);
    }
  }
}

function tarString(buffer, start, length) {
  const end = buffer.indexOf(0, start);
  return buffer.toString("utf8", start, end === -1 || end > start + length ? start + length : end);
}

export async function readPackedManifest(tarballPath) {
  const archive = gunzipSync(await readFile(tarballPath));
  for (let offset = 0; offset + 512 <= archive.length;) {
    const name = tarString(archive, offset, 100);
    if (name.length === 0) {
      break;
    }
    const prefix = tarString(archive, offset + 345, 155);
    const entryPath = prefix.length > 0 ? `${prefix}/${name}` : name;
    const sizeText = tarString(archive, offset + 124, 12).trim();
    const size = Number.parseInt(sizeText, 8);
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(`invalid tar entry size for ${entryPath}`);
    }
    const contentStart = offset + 512;
    if (entryPath === "package/package.json") {
      return JSON.parse(archive.toString("utf8", contentStart, contentStart + size));
    }
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  throw new Error("packed archive does not contain package/package.json");
}
