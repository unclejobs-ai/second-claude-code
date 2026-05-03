import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const root = process.cwd();

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function readHttpJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, json: JSON.parse(body) });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
  });
}

test("artifact viewer start and stop scripts manage a background server", async () => {
  const sessionDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-viewer-session-"));
  const distDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-viewer-dist-"));
  mkdirSync(path.join(sessionDir, "artifacts"), { recursive: true });
  writeFileSync(
    path.join(sessionDir, "state.json"),
    JSON.stringify({ phase: "check", topic: "viewer smoke" }),
    "utf8"
  );
  writeFileSync(path.join(distDir, "index.html"), "<!doctype html><title>SCC</title>", "utf8");

  const port = await getFreePort();
  const startScript = path.join(root, "ui", "scripts", "start-server.sh");
  const stopScript = path.join(root, "ui", "scripts", "stop-server.sh");

  try {
    const output = execFileSync(
      "bash",
      [
        startScript,
        "--session-dir",
        sessionDir,
        "--dist-dir",
        distDir,
        "--port",
        String(port),
      ],
      { cwd: root, encoding: "utf8" }
    );
    const startInfo = JSON.parse(output);

    assert.equal(startInfo.ok, true);
    assert.equal(startInfo.url, `http://localhost:${port}`);
    assert.equal(existsSync(path.join(sessionDir, "state", "server.pid")), true);

    const response = await readHttpJson(`${startInfo.url}/api/state`);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json, { phase: "check", topic: "viewer smoke" });

    const persistedInfo = JSON.parse(
      readFileSync(path.join(sessionDir, "state", "server-info.json"), "utf8")
    );
    assert.equal(persistedInfo.pid, startInfo.pid);
    assert.equal(persistedInfo.session_dir, sessionDir);
  } finally {
    const stopOutput = execFileSync(
      "bash",
      [stopScript, "--session-dir", sessionDir],
      { cwd: root, encoding: "utf8" }
    );
    const stopInfo = JSON.parse(stopOutput);
    assert.equal(stopInfo.ok, true);
  }
});
