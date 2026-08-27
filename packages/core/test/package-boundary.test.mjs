import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { assertSafePackedManifest, readPackedManifest } from "../../../scripts/core-release-policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const packageRoot = path.join(repositoryRoot, "packages", "core");

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: "utf8" });
}

test("packed package catches root or fixture exports disappearing from consumer installs", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "second-claude-core-package-"));
  try {
    const packed = run("npm", ["pack", packageRoot, "--pack-destination", temporaryRoot, "--json"], repositoryRoot);
    assert.equal(packed.status, 0, packed.stderr);
    const [metadata] = JSON.parse(packed.stdout);
    assert.deepEqual(metadata.files.map((entry) => entry.path).sort(), [
      "README.md",
      "dist/index.d.ts",
      "dist/index.d.ts.map",
      "dist/index.js",
      "dist/index.js.map",
      "fixtures/quality-contract.json",
      "package.json"
    ]);
    const packedManifest = await readPackedManifest(path.join(temporaryRoot, metadata.filename));
    assert.equal(packedManifest.name, "@second-claude/core");
    assert.doesNotThrow(() => assertSafePackedManifest(packedManifest));
    for (const lifecycle of ["preinstall", "install", "postinstall", "prepare", "prepack"]) {
      assert.equal(packedManifest.scripts?.[lifecycle], undefined, lifecycle);
    }
    for (const field of [
      "dependencies",
      "optionalDependencies",
      "peerDependencies",
      "bundledDependencies",
      "bundleDependencies"
    ]) {
      assert.equal(packedManifest[field], undefined, field);
    }

    const consumerRoot = path.join(temporaryRoot, "consumer");
    await mkdir(consumerRoot);
    await writeFile(path.join(consumerRoot, "package.json"), JSON.stringify({ type: "module", private: true }));
    const installed = run("npm", [
      "install",
      "--offline",
      "--no-audit",
      "--no-fund",
      path.join(temporaryRoot, metadata.filename)
    ], consumerRoot);
    assert.equal(installed.status, 0, installed.stderr);

    const imported = run(process.execPath, [
      "--input-type=module",
      "--eval",
      "const core = await import('@second-claude/core'); const fixture = await import('@second-claude/core/fixtures/quality-contract.json', { with: { type: 'json' } }); process.stdout.write(`${core.classifyQualityProfile({ complexity: 'simple', risk: 'low', creatorIntent: true })}:${fixture.default.cases.length}`);"
    ], consumerRoot);
    assert.equal(imported.status, 0, imported.stderr);
    assert.equal(imported.stdout, "creator:15");
    await assert.rejects(access(path.join(consumerRoot, "node_modules", "typescript")), { code: "ENOENT" });
  } finally {
    await rm(temporaryRoot, { recursive: true });
  }
});

test("strict TypeScript consumer catches exported contract declarations becoming unsound", () => {
  const compiler = path.join(repositoryRoot, "node_modules", "typescript", "bin", "tsc");
  const fixture = path.join(packageRoot, "test", "fixtures", "consumer-contract.ts");
  const compiled = run(process.execPath, [
    compiler,
    "--noEmit",
    "--strict",
    "--target", "ES2022",
    "--module", "NodeNext",
    "--moduleResolution", "NodeNext",
    fixture
  ], repositoryRoot);

  assert.equal(compiled.status, 0, `${compiled.stdout}\n${compiled.stderr}`);
});
