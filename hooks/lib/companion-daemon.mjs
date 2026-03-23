import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
} from "fs";
import { join } from "path";
import { ensureDir, readJsonSafe, writeJsonAtomic } from "./utils.mjs";

const DAEMON_DIRNAME = "daemon";
const STATUS_FILENAME = "status.json";
const JOBS_FILENAME = "jobs.json";
const RECALL_FILENAME = "index.jsonl";
const STATUS_TTL_MS = 120_000;

function nowIso() {
  return new Date().toISOString();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "item";
}

function generatedId(prefix, seed = "") {
  return `${prefix}-${slugify(seed)}-${Date.now()}`;
}

function normalizeRunId(value, { allowGenerate = false, seed = "" } = {}) {
  if (typeof value !== "string" || value.trim() === "") {
    if (allowGenerate) return generatedId("run", seed);
    throw new Error("run_id must be a non-empty string");
  }

  const normalized = value.trim();
  if (
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes("..") ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(normalized)
  ) {
    throw new Error(
      "run_id must use only letters, numbers, dot, underscore, or hyphen and must not contain path segments"
    );
  }

  return normalized;
}

function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];

  try {
    return readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export function getDaemonPaths(dataDir) {
  const daemonDir = join(dataDir, DAEMON_DIRNAME);
  const runsDir = join(daemonDir, "runs");
  const notificationsDir = join(daemonDir, "notifications");
  const recallDir = join(daemonDir, "recall");
  return {
    daemonDir,
    statusPath: join(daemonDir, STATUS_FILENAME),
    jobsPath: join(daemonDir, JOBS_FILENAME),
    runsDir,
    notificationsDir,
    recallDir,
    recallIndexPath: join(recallDir, RECALL_FILENAME),
  };
}

export function ensureDaemonLayout(dataDir) {
  const paths = getDaemonPaths(dataDir);
  ensureDir(paths.daemonDir);
  ensureDir(paths.runsDir);
  ensureDir(paths.notificationsDir);
  ensureDir(paths.recallDir);
  return paths;
}

export function readDaemonStatus(dataDir) {
  const { daemonDir, statusPath } = getDaemonPaths(dataDir);
  const status = readJsonSafe(statusPath);
  const installed = existsSync(daemonDir);

  if (!status) {
    return {
      installed,
      online: false,
      state: installed ? "offline" : "absent",
      heartbeat_ttl_ms: STATUS_TTL_MS,
    };
  }

  const lastSeenAt = status.last_seen_at || status.updated_at || status.started_at || null;
  const heartbeatAgeMs = lastSeenAt ? Date.now() - new Date(lastSeenAt).getTime() : null;
  const online = heartbeatAgeMs !== null && heartbeatAgeMs >= 0 && heartbeatAgeMs <= STATUS_TTL_MS;

  return {
    installed: true,
    online,
    state: online ? "online" : "stale",
    heartbeat_ttl_ms: STATUS_TTL_MS,
    heartbeat_age_ms: heartbeatAgeMs,
    ...status,
  };
}

export function writeDaemonHeartbeat(dataDir, overrides = {}) {
  const { statusPath } = ensureDaemonLayout(dataDir);
  const current = readJsonSafe(statusPath) || {};
  const now = nowIso();

  const next = {
    daemon_id: overrides.daemon_id || current.daemon_id || `local-${process.pid}`,
    mode: overrides.mode || current.mode || "local",
    pid: overrides.pid || current.pid || process.pid,
    started_at: current.started_at || overrides.started_at || now,
    scheduler_enabled:
      overrides.scheduler_enabled ?? current.scheduler_enabled ?? true,
    background_runs_enabled:
      overrides.background_runs_enabled ?? current.background_runs_enabled ?? true,
    notification_routing_enabled:
      overrides.notification_routing_enabled ?? current.notification_routing_enabled ?? true,
    session_recall_enabled:
      overrides.session_recall_enabled ?? current.session_recall_enabled ?? true,
    last_seen_at: now,
  };

  writeJsonAtomic(statusPath, next);
  return readDaemonStatus(dataDir);
}

function readJobsStore(dataDir) {
  const { jobsPath } = getDaemonPaths(dataDir);
  const parsed = readJsonSafe(jobsPath);
  if (!parsed || !Array.isArray(parsed.jobs)) {
    return { jobs: [] };
  }
  return parsed;
}

export function upsertDaemonJob(dataDir, job) {
  if (typeof job?.name !== "string" || job.name.trim() === "") {
    throw new Error("job.name must be a non-empty string");
  }
  if (typeof job?.workflow_name !== "string" || job.workflow_name.trim() === "") {
    throw new Error("job.workflow_name must be a non-empty string");
  }

  const { jobsPath } = ensureDaemonLayout(dataDir);
  const store = readJobsStore(dataDir);
  const now = nowIso();
  const id =
    typeof job.id === "string" && job.id.trim() ? job.id.trim() : slugify(job.name);

  const normalized = {
    id,
    name: job.name.trim(),
    workflow_name: job.workflow_name.trim(),
    schedule:
      typeof job.schedule === "object" && job.schedule !== null
        ? job.schedule
        : { type: "manual" },
    status: job.status || "active",
    tags: Array.isArray(job.tags) ? job.tags.filter(Boolean) : [],
    next_run_at: job.next_run_at || null,
    last_run_at: job.last_run_at || null,
    updated_at: now,
  };

  const existingIndex = store.jobs.findIndex((entry) => entry.id === id);
  if (existingIndex >= 0) {
    store.jobs[existingIndex] = {
      ...store.jobs[existingIndex],
      ...normalized,
      created_at: store.jobs[existingIndex].created_at || now,
    };
  } else {
    store.jobs.push({
      ...normalized,
      created_at: now,
    });
  }

  store.jobs.sort((a, b) => a.name.localeCompare(b.name));
  writeJsonAtomic(jobsPath, store);
  return store.jobs.find((entry) => entry.id === id);
}

export function listDaemonJobs(dataDir) {
  const store = readJobsStore(dataDir);
  const jobs = [...store.jobs].sort((a, b) => a.name.localeCompare(b.name));
  return {
    jobs,
    total: jobs.length,
  };
}

export function createBackgroundRun(dataDir, input) {
  const { runsDir } = ensureDaemonLayout(dataDir);
  const workflowName =
    typeof input?.workflow_name === "string" ? input.workflow_name.trim() : "";
  if (!workflowName) {
    throw new Error("workflow_name must be a non-empty string");
  }

  const runId = normalizeRunId(input.run_id, {
    allowGenerate: true,
    seed: workflowName,
  });
  const now = nowIso();
  const run = {
    run_id: runId,
    job_id: input.job_id || null,
    workflow_name: workflowName,
    trigger: input.trigger || "manual",
    status: input.status || "queued",
    input:
      typeof input.input === "object" && input.input !== null ? input.input : {},
    created_at: now,
    updated_at: now,
  };

  writeJsonAtomic(join(runsDir, `${runId}.json`), run);
  return run;
}

export function updateBackgroundRun(dataDir, runId, patch) {
  const normalizedRunId = normalizeRunId(runId);

  const { runsDir } = ensureDaemonLayout(dataDir);
  const filePath = join(runsDir, `${normalizedRunId}.json`);
  const existing = readJsonSafe(filePath);
  if (!existing) {
    throw new Error(`Background run not found: ${normalizedRunId}`);
  }

  const next = {
    ...existing,
    ...patch,
    run_id: existing.run_id,
    updated_at: nowIso(),
  };
  writeJsonAtomic(filePath, next);
  return next;
}

export function listBackgroundRuns(dataDir) {
  const { runsDir } = ensureDaemonLayout(dataDir);
  const runs = readdirSync(runsDir)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => readJsonSafe(join(runsDir, entry)))
    .filter(Boolean)
    .sort((a, b) =>
      String(b.updated_at || b.created_at || "").localeCompare(
        String(a.updated_at || a.created_at || "")
      )
    );

  return {
    runs,
    total: runs.length,
  };
}

export function queueDaemonNotification(dataDir, notification) {
  if (typeof notification?.event_type !== "string" || notification.event_type.trim() === "") {
    throw new Error("notification.event_type must be a non-empty string");
  }
  if (typeof notification?.text !== "string" || notification.text.trim() === "") {
    throw new Error("notification.text must be a non-empty string");
  }

  const { notificationsDir } = ensureDaemonLayout(dataDir);
  const id = generatedId("notification", notification.event_type);
  const now = nowIso();
  const payload = {
    id,
    channel: notification.channel || "telegram",
    chat_id: notification.chat_id || "",
    event_type: notification.event_type.trim(),
    text: notification.text.trim(),
    metadata:
      typeof notification.metadata === "object" && notification.metadata !== null
        ? notification.metadata
        : {},
    status: "queued",
    created_at: now,
    updated_at: now,
  };

  writeJsonAtomic(join(notificationsDir, `${id}.json`), payload);
  return payload;
}

export function appendRecallEntry(dataDir, entry) {
  const { recallIndexPath } = ensureDaemonLayout(dataDir);
  const payload = {
    session_id: entry.session_id || null,
    topic: entry.topic || "",
    workflow_name: entry.workflow_name || "",
    summary: entry.summary || "",
    artifact_path: entry.artifact_path || "",
    tags: Array.isArray(entry.tags) ? entry.tags.filter(Boolean) : [],
    created_at: nowIso(),
  };

  appendFileSync(recallIndexPath, `${JSON.stringify(payload)}\n`, "utf8");
  return payload;
}

export function searchSessionRecall(dataDir, { query = "", limit = 5 } = {}) {
  const { recallIndexPath } = getDaemonPaths(dataDir);
  const entries = readJsonl(recallIndexPath);
  const normalizedQuery = String(query || "").trim().toLowerCase();

  const filtered = entries.filter((entry) => {
    if (!normalizedQuery) return true;
    const haystack = [
      entry.session_id,
      entry.topic,
      entry.workflow_name,
      entry.summary,
      ...(Array.isArray(entry.tags) ? entry.tags : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  filtered.sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );

  return {
    entries: filtered.slice(0, Math.max(1, Number(limit) || 5)),
    total: filtered.length,
  };
}
