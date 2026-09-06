import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repositoryRoot, "packages", "core");
const checkedDist = path.join(packageRoot, "dist");
const temporaryDist = await mkdtemp(path.join(packageRoot, ".dist-verify-"));

async function relativeFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      return relativeFiles(root, absolute);
    }
    return [path.relative(root, absolute)];
  }));
  return nested.flat().sort();
}

try {
  const compiler = path.join(repositoryRoot, "node_modules", "typescript", "bin", "tsc");
  const build = spawnSync(
    process.execPath,
    [compiler, "-p", path.join(packageRoot, "tsconfig.json"), "--outDir", temporaryDist],
    { cwd: repositoryRoot, encoding: "utf8" }
  );
  if (build.status !== 0) {
    process.stderr.write(build.stdout);
    process.stderr.write(build.stderr);
    process.exitCode = build.status ?? 1;
  } else {
    const expectedFiles = await relativeFiles(temporaryDist);
    const actualFiles = await relativeFiles(checkedDist);
    assert.deepEqual(
      actualFiles,
      expectedFiles,
      "checked-in packages/core/dist file list differs from a clean strict build"
    );
    for (const relativeFile of expectedFiles) {
      const expected = await readFile(path.join(temporaryDist, relativeFile));
      const actual = await readFile(path.join(checkedDist, relativeFile));
      assert.deepEqual(actual, expected, `checked-in packages/core/dist/${relativeFile} is stale`);
    }
    process.stdout.write(`verified ${actualFiles.length} checked-in core distributable files\n`);
  }
} finally {
  await rm(temporaryDist, { recursive: true });
}
