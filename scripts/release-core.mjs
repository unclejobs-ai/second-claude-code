import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSafePackedManifest, readPackedManifest } from "./core-release-policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repositoryRoot, "packages", "core");
const releaseDirectory = path.join(packageRoot, "release");
const tarballName = "second-claude-core-4.0.0.tgz";
const tarballPath = path.join(releaseDirectory, tarballName);
const checksumPath = `${tarballPath}.sha256`;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, [path.join(repositoryRoot, "scripts", "verify-core-dist.mjs")]);
assertSafePackedManifest(JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")));
await mkdir(releaseDirectory, { recursive: true });
await Promise.all([
  rm(tarballPath, { force: true }),
  rm(checksumPath, { force: true })
]);
run("npm", ["pack", packageRoot, "--pack-destination", releaseDirectory]);
assertSafePackedManifest(await readPackedManifest(tarballPath));

const checksum = createHash("sha256").update(await readFile(tarballPath)).digest("hex");
await writeFile(checksumPath, `${checksum}  ${tarballName}\n`, "utf8");
process.stdout.write(`${path.relative(repositoryRoot, tarballPath)}\n${checksum}\n`);
