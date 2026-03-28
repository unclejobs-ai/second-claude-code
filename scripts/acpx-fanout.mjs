#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  defaultRunDir,
  ensureDir,
  nowIso,
  parseJsonArg,
  sanitizeIdentifier,
  slugify,
  writeJson,
} from "./lib/acpx-runtime.mjs";
import { runAcpxRequest } from "./acpx-runner.mjs";
import { renderSummaryFromManifest } from "./acpx-render-summary.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, "..");

const DEFAULT_ROLES = [
  {
    role: "impl",
    agent: "codex",
    mode: "exec",
    prompt_template:
      "You are the implementation agent. You may edit files and run tests. Task: {{task}}",
  },
  {
    role: "review",
    agent: "claude",
    mode: "exec",
    prompt_template:
      "You are the reviewer. Do not edit files. Identify concrete regressions, risks, and missing tests for: {{task}}",
  },
  {
    role: "docs",
    agent: "gemini",
    mode: "exec",
    prompt_template:
      "You are the documentation agent. Do not edit files. Summarize user-visible changes and operator notes for: {{task}}",
  },
];

function interpolate(template, vars) {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, key) =>
    key in vars ? String(vars[key]) : ""
  );
}

function normalizeFanoutRequest(input) {
  if (typeof input?.task !== "string" || input.task.trim() === "") {
    throw new Error("task must be a non-empty string");
  }
  const runId = sanitizeIdentifier(
    input.run_id || `fanout-${slugify(input.task).slice(0, 40)}-${Date.now()}`,
    "run_id"
  );
  const cwd = input.cwd || process.cwd();
  const outputDir = input.output_dir || defaultRunDir(ROOT_DIR, runId);
  const roles = Array.isArray(input.roles) && input.roles.length > 0 ? input.roles : DEFAULT_ROLES;

  return {
    run_id: runId,
    task: input.task.trim(),
    cwd,
    output_dir: outputDir,
    launcher: input.launcher || null,
    timeout_sec: Number(input.timeout_sec || 900),
    roles,
  };
}

export async function runFanoutRequest(input, options = {}) {
  const request = normalizeFanoutRequest(input);
  const rootDir = options.rootDir || ROOT_DIR;
  ensureDir(request.output_dir);

  const startedAt = nowIso();
  const roleRequests = request.roles.map((role) => {
    const roleName = sanitizeIdentifier(role.role, "role");
    return {
      role: roleName,
      request: {
        run_id: request.run_id,
        role: roleName,
        agent: role.agent,
        mode: role.mode || "exec",
        session_name: role.session_name || `${request.run_id}-${roleName}`,
        cwd: request.cwd,
        output_dir: join(request.output_dir, roleName),
        timeout_sec: role.timeout_sec || request.timeout_sec,
        launcher: role.launcher || request.launcher,
        prompt: interpolate(role.prompt_template, {
          task: request.task,
          cwd: request.cwd,
          role: roleName,
          run_id: request.run_id,
        }),
      },
    };
  });

  const results = await Promise.all(
    roleRequests.map(({ request: roleRequest }) => runAcpxRequest(roleRequest, { rootDir }))
  );

  const manifestPath = join(request.output_dir, "manifest.json");
  const manifest = {
    run_id: request.run_id,
    task: request.task,
    cwd: request.cwd,
    started_at: startedAt,
    finished_at: nowIso(),
    output_dir: request.output_dir,
    roles: results.map((result) => ({
      role: result.role,
      agent: result.agent,
      ok: result.ok,
      exit_code: result.exit_code,
      duration_ms: result.duration_ms,
      final_text: result.final_text,
      result_path: result.result_path,
      stderr_path: result.stderr_path,
    })),
  };
  writeJson(manifestPath, manifest);
  const summaryResult = renderSummaryFromManifest(manifestPath);

  return {
    ...manifest,
    manifest_path: manifestPath,
    summary_path: summaryResult.summary_path,
  };
}

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/acpx-fanout.mjs run '<json>'",
    ].join("\n")
  );
}

async function main() {
  const [, , command, raw] = process.argv;
  if (command !== "run") {
    usage();
    process.exit(1);
  }

  const request = parseJsonArg(raw, "fanout request");
  const result = await runFanoutRequest(request);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
