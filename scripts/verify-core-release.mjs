import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertSafePackedManifest, readPackedManifest } from "./core-release-policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repositoryRoot, "packages", "core");
const tarballName = "second-claude-core-4.0.0.tgz";
const checkedTarballPath = path.join(packageRoot, "release", tarballName);
const checkedChecksumPath = `${checkedTarballPath}.sha256`;
const temporaryPackDirectory = await mkdtemp(path.join(os.tmpdir(), "second-claude-core-pack-"));

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

try {
  run(process.execPath, [path.join(repositoryRoot, "scripts", "verify-core-dist.mjs")]);

  const checkedTarball = await readFile(checkedTarballPath);
  const checkedHash = createHash("sha256").update(checkedTarball).digest("hex");
  const checkedChecksum = await readFile(checkedChecksumPath, "utf8");
  assert.equal(
    checkedChecksum,
    `${checkedHash}  ${tarballName}\n`,
    "checked-in core checksum does not pin the checked-in tarball bytes"
  );
  assertSafePackedManifest(await readPackedManifest(checkedTarballPath));

  const packOutput = run("npm", [
    "pack",
    packageRoot,
    "--pack-destination",
    temporaryPackDirectory,
    "--json"
  ]);
  const [metadata] = JSON.parse(packOutput);
  assert.equal(metadata?.filename, tarballName, "fresh npm pack produced an unexpected filename");
  const freshTarballPath = path.join(temporaryPackDirectory, metadata.filename);
  assertSafePackedManifest(await readPackedManifest(freshTarballPath));
  const freshTarball = await readFile(freshTarballPath);
  assert.equal(
    Buffer.compare(freshTarball, checkedTarball),
    0,
    "checked-in core tarball differs byte-for-byte from a fresh deterministic npm pack"
  );

  process.stdout.write(`verified checked-in core release ${tarballName} (${checkedHash})\n`);
} finally {
  await rm(temporaryPackDirectory, { recursive: true, force: true });
}
