import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const execFileAsync = promisify(execFile);

export function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function writeJson(filePath, data) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function nowIso() {
  return new Date().toISOString();
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80) || "item";
}

export function sanitizeIdentifier(value, label) {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("..") ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(value.trim())
  ) {
    throw new Error(`${label} must use only letters, numbers, dot, underscore, or hyphen`);
  }
  return value.trim();
}

export function parseJsonArg(raw, label = "JSON") {
  if (!raw) {
    throw new Error(`${label} argument is required`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${label} must be valid JSON: ${err.message}`);
  }
}

export function dataDirFrom(rootDir) {
  return resolve(process.env.CLAUDE_PLUGIN_DATA || join(rootDir, ".data"));
}

export function acpxRunsRoot(rootDir) {
  return join(dataDirFrom(rootDir), "external-runs", "acpx");
}

export function defaultRunDir(rootDir, runId) {
  return join(acpxRunsRoot(rootDir), runId);
}

export function parseJsonLines(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const events = [];
  const invalid = [];

  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      invalid.push(line);
    }
  }

  return {
    events,
    invalid,
  };
}

export function extractFinalText(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (typeof event?.text === "string" && event.text.trim()) return event.text.trim();
    if (typeof event?.message === "string" && event.message.trim()) return event.message.trim();
    if (typeof event?.content === "string" && event.content.trim()) return event.content.trim();
  }
  return "";
}

export function buildLauncher(launcher = {}) {
  const command = launcher.command || process.env.ACPX_BIN || "acpx";
  const args = Array.isArray(launcher.args) ? launcher.args : [];
  const env = launcher.env && typeof launcher.env === "object" ? launcher.env : {};
  return { command, args, env };
}

export function buildAcpxArgs(request) {
  const globalArgs = ["--cwd", request.cwd, "--format", request.format || "json"];
  const agent = request.agent;

  if (request.mode === "session") {
    const sessionName = sanitizeIdentifier(
      request.session_name || `${request.run_id}-${request.role}`,
      "session_name"
    );
    return {
      ensureArgs: [...globalArgs, agent, "sessions", "ensure", "--name", sessionName],
      runArgs: [...globalArgs, agent, "-s", sessionName, request.prompt],
      sessionName,
    };
  }

  return {
    ensureArgs: null,
    runArgs: [...globalArgs, agent, "exec", request.prompt],
    sessionName: null,
  };
}

export async function execCommand({ command, args, cwd, timeoutMs, env = {} }) {
  const startedAt = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        ...env,
      },
    });
    return {
      ok: true,
      exit_code: 0,
      stdout,
      stderr,
      signal: null,
      duration_ms: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      exit_code: Number.isInteger(err.code) ? err.code : 1,
      stdout: typeof err.stdout === "string" ? err.stdout : "",
      stderr: typeof err.stderr === "string" ? err.stderr : String(err.message || ""),
      signal: err.signal || null,
      duration_ms: Date.now() - startedAt,
      timeout: err.killed === true && err.signal === "SIGTERM",
      error_message: String(err.message || "command failed"),
    };
  }
}

export function normalizeRunnerRequest(request, rootDir) {
  if (typeof request?.agent !== "string" || request.agent.trim() === "") {
    throw new Error("agent must be a non-empty string");
  }
  if (typeof request?.prompt !== "string" || request.prompt.trim() === "") {
    throw new Error("prompt must be a non-empty string");
  }

  const runId = sanitizeIdentifier(
    request.run_id || `run-${slugify(request.agent)}-${Date.now()}`,
    "run_id"
  );
  const role = sanitizeIdentifier(request.role || request.agent, "role");
  const cwd = resolve(request.cwd || process.cwd());
  const outputDir = resolve(
    request.output_dir || join(defaultRunDir(rootDir, runId), role)
  );
  const mode = request.mode === "session" ? "session" : "exec";

  return {
    run_id: runId,
    role,
    agent: request.agent.trim(),
    prompt: request.prompt,
    cwd,
    output_dir: outputDir,
    timeout_sec: Number(request.timeout_sec || 900),
    format: request.format || "json",
    mode,
    session_name: request.session_name || null,
    launcher: buildLauncher(request.launcher),
  };
}
