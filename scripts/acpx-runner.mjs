#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

import {
  buildAcpxArgs,
  ensureDir,
  execCommand,
  extractFinalText,
  normalizeRunnerRequest,
  nowIso,
  parseJsonArg,
  parseJsonLines,
  writeJson,
} from "./lib/acpx-runtime.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, "..");

function writeText(filePath, text) {
  writeFileSync(filePath, text, "utf8");
}

export async function runAcpxRequest(input, options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const request = normalizeRunnerRequest(input, rootDir);
  ensureDir(request.output_dir);

  const requestPath = join(request.output_dir, "request.json");
  const resultPath = join(request.output_dir, "result.json");
  const stdoutPath = join(
    request.output_dir,
    request.format === "json" ? "stdout.ndjson" : "stdout.txt"
  );
  const stderrPath = join(request.output_dir, "stderr.txt");
  const ensurePath = join(request.output_dir, "ensure.json");
  writeJson(requestPath, request);

  const { ensureArgs, runArgs, sessionName } = buildAcpxArgs(request);
  const command = request.launcher.command;
  const prefixArgs = request.launcher.args;
  const launcherEnv = request.launcher.env || {};

  let ensureResult = null;
  if (ensureArgs) {
    ensureResult = await execCommand({
      command,
      args: [...prefixArgs, ...ensureArgs],
      cwd: request.cwd,
      timeoutMs: request.timeout_sec * 1000,
      env: launcherEnv,
    });
    writeJson(ensurePath, ensureResult);
    if (!ensureResult.ok) {
      const failure = {
        ok: false,
        run_id: request.run_id,
        role: request.role,
        agent: request.agent,
        mode: request.mode,
        session_name: sessionName,
        started_at: nowIso(),
        finished_at: nowIso(),
        exit_code: ensureResult.exit_code,
        stdout_path: null,
        stderr_path: stderrPath,
        result_path: resultPath,
        final_text: "",
        events_count: 0,
        parse_errors: 0,
        ensure_path: ensurePath,
      };
      writeText(stderrPath, ensureResult.stderr || "");
      writeJson(resultPath, failure);
      return failure;
    }
  }

  const startedAt = nowIso();
  const execution = await execCommand({
    command,
    args: [...prefixArgs, ...runArgs],
    cwd: request.cwd,
    timeoutMs: request.timeout_sec * 1000,
    env: launcherEnv,
  });
  const finishedAt = nowIso();
  writeText(stdoutPath, execution.stdout || "");
  writeText(stderrPath, execution.stderr || "");

  const parsed = request.format === "json" ? parseJsonLines(execution.stdout) : { events: [], invalid: [] };
  const result = {
    ok: execution.ok,
    run_id: request.run_id,
    role: request.role,
    agent: request.agent,
    mode: request.mode,
    session_name: sessionName,
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: execution.duration_ms,
    exit_code: execution.exit_code,
    signal: execution.signal,
    timeout: execution.timeout || false,
    stdout_path: stdoutPath,
    stderr_path: stderrPath,
    result_path: resultPath,
    final_text: extractFinalText(parsed.events),
    events_count: parsed.events.length,
    parse_errors: parsed.invalid.length,
    ensure_path: ensureResult ? ensurePath : null,
  };
  writeJson(resultPath, result);
  return result;
}

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/acpx-runner.mjs run '<json>'",
    ].join("\n")
  );
}

async function main() {
  const [, , command, raw] = process.argv;
  if (command !== "run") {
    usage();
    process.exit(1);
  }

  const request = parseJsonArg(raw, "runner request");
  const result = await runAcpxRequest(request);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
