/** Packaged MCP startup regression tests. */

import test from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

test("a fresh packaged plugin initializes without running a package manager", {
  skip: process.platform === "win32",
}, () => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  const pluginRoot = mkdtempSync(join(os.tmpdir(), "pdca-packaged-startup-"));
  const fakeBin = join(pluginRoot, "fake-bin");
  const npmMarker = join(pluginRoot, "npm-was-invoked");
  const npxMarker = join(pluginRoot, "npx-was-invoked");

  try {
    for (const relativePath of [
      ".claude-plugin",
      "hooks",
      "mcp",
      "scripts",
      "package.json",
      "package-lock.json",
    ]) {
      cpSync(join(repoRoot, relativePath), join(pluginRoot, relativePath), {
        recursive: true,
      });
    }

    mkdirSync(fakeBin, { recursive: true });
    const fakeNpm = join(fakeBin, "npm");
    writeFileSync(
      fakeNpm,
      `#!/bin/sh\nprintf invoked > ${JSON.stringify(npmMarker)}\nexit 97\n`,
      "utf8"
    );
    chmodSync(fakeNpm, 0o755);

    const fakeNpx = join(fakeBin, "npx");
    writeFileSync(
      fakeNpx,
      `#!/bin/sh\nprintf invoked > ${JSON.stringify(npxMarker)}\nexit 97\n`,
      "utf8"
    );
    chmodSync(fakeNpx, 0o755);

    const manifest = JSON.parse(
      readFileSync(join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8")
    );
    assert.equal(manifest.mcpServers.playwright.optional, true);
    assert.notEqual(manifest.mcpServers["pdca-state"].optional, true);
    const configuredEntry = manifest.mcpServers["pdca-state"].args[0];
    const entryPath = configuredEntry.replace("${CLAUDE_PLUGIN_ROOT}", pluginRoot);
    const initialize = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "scc-cold-start-test", version: "1.0.0" },
      },
    }) + "\n";

    const result = spawnSync(process.execPath, [entryPath], {
      cwd: pluginRoot,
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        CLAUDE_PLUGIN_DATA: join(pluginRoot, ".data"),
        // Simulate an offline/cache-miss host: neither package-manager command
        // can succeed, but the prebundled pdca-state server must still start.
        PATH: fakeBin,
      },
      input: initialize,
      encoding: "utf8",
      timeout: 3_000,
    });

    assert.equal(
      existsSync(npmMarker),
      false,
      `MCP startup invoked npm; stderr: ${result.stderr}`
    );
    assert.equal(
      existsSync(npxMarker),
      false,
      `MCP startup invoked npx; stderr: ${result.stderr}`
    );
    assert.equal(result.signal, null, `MCP startup timed out: ${result.stderr}`);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\"id\":1/);
    assert.match(result.stdout, /\"serverInfo\"/);
  } finally {
    rmSync(pluginRoot, { recursive: true, force: true });
  }
});
