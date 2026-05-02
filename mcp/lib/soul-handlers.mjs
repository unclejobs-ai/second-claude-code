/**
 * Soul profile and observations handlers.
 */

import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  renameSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "../..");
const DATA_DIR = process.env.CLAUDE_PLUGIN_DATA ?? join(PLUGIN_ROOT, ".data");

// Soul paths
const SOUL_DIR = join(DATA_DIR, "soul");
const SOUL_PROFILE_FILE = join(SOUL_DIR, "SOUL.md");
const SOUL_ACTIVE_FILE = join(SOUL_DIR, "soul-active.json");
const SOUL_OBS_DIR = join(SOUL_DIR, "observations");

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

/** soul_get_profile */
export function handleSoulGetProfile() {
  const profile = existsSync(SOUL_PROFILE_FILE)
    ? readFileSync(SOUL_PROFILE_FILE, "utf8")
    : null;

  let metadata = null;
  if (existsSync(SOUL_ACTIVE_FILE)) {
    try {
      metadata = JSON.parse(readFileSync(SOUL_ACTIVE_FILE, "utf8"));
    } catch (err) {
      throw new Error(`Failed to parse soul-active.json: ${err.message}`);
    }
  }

  return { profile, metadata };
}

/** soul_record_observation */
export function handleSoulRecordObservation({ signal, category, confidence, raw_context }) {
  if (typeof signal !== "string" || signal.trim() === "") {
    throw new Error("signal must be a non-empty string");
  }
  if (typeof category !== "string" || category.trim() === "") {
    throw new Error("category must be a non-empty string");
  }

  mkdirSync(SOUL_OBS_DIR, { recursive: true });

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filePath = join(SOUL_OBS_DIR, `${today}.jsonl`);

  const record = JSON.stringify({
    ts: new Date().toISOString(),
    signal: signal.trim(),
    category: category.trim(),
    confidence: typeof confidence === "number" ? confidence : 0.8,
    raw_context: typeof raw_context === "string" ? raw_context.slice(0, 200) : "",
  });

  appendFileSync(filePath, record + "\n", "utf8");

  return { recorded: true, file: filePath, ts: JSON.parse(record).ts };
}

/** soul_get_observations */
export function handleSoulGetObservations({ category, date_from, date_to, limit = 50 }) {
  if (!existsSync(SOUL_OBS_DIR)) {
    return { observations: [], total: 0 };
  }

  // Gather candidate JSONL files filtered by date range
  const allFiles = readdirSync(SOUL_OBS_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .sort(); // lexicographic = chronological for YYYY-MM-DD

  const filteredFiles = allFiles.filter((f) => {
    const date = f.replace(".jsonl", "");
    if (date_from && date < date_from) return false;
    if (date_to && date > date_to) return false;
    return true;
  });

  /** @type {object[]} */
  const observations = [];

  for (const file of filteredFiles) {
    const filePath = join(SOUL_OBS_DIR, file);
    let content;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (category && obj.category !== category) continue;
        observations.push(obj);
      } catch {
        // Skip malformed lines silently
      }
    }
  }

  // Most recent first, then apply limit
  observations.sort((a, b) => {
    const ta = String(a.ts || "");
    const tb = String(b.ts || "");
    return tb.localeCompare(ta);
  });

  const limitedObs = observations.slice(0, Math.max(1, Number(limit) || 50));

  return { observations: limitedObs, total: observations.length };
}

// ---------------------------------------------------------------------------
// Soul retro — git shipping metrics
// ---------------------------------------------------------------------------

/** @param {'week'|'month'|'quarter'} period */
function periodToDays(period) {
  if (period === "month") return 30;
  if (period === "quarter") return 90;
  return 7;
}

/**
 * Auto-detect sibling git projects from the parent of the current working
 * directory, filtering to those with at least one commit in the date range.
 *
 * @param {string} since ISO-8601 date string
 * @returns {string[]} absolute project directory paths
 */
function detectProjects(since) {
  const cwd = process.env["SECOND_CLAUDE_CWD"] ?? process.cwd();
  const parent = dirname(cwd);
  if (!existsSync(parent)) return [];

  /** @type {string[]} */
  const projects = [];
  try {
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const projPath = join(parent, entry.name);
      if (!existsSync(join(projPath, ".git"))) continue;
      // Quick check: does this project have commits in range?
      try {
        const count = Number(
          execFileSync("git", ["-C", projPath, "log", `--since=${since}`,
            "--format=%H", "--no-merges", "-n", "1"], { encoding: "utf8", timeout: 5000 }).trim().length
        );
        if (count > 0) projects.push(projPath);
      } catch {
        // Skip projects with no commits or git errors
      }
    }
  } catch {
    // readdir failed; return whatever we found
  }
  return projects;
}

/**
 * Collect per-project git metrics.
 *
 * @param {string} projectPath
 * @param {string} since
 * @param {string} until
 * @returns {{ commits: number, added: number, removed: number, files_changed: string[], top_files: string[], avg_commit_size: number, size_profile: 'small'|'medium'|'large' }}
 */
function collectProjectMetrics(projectPath, since, until) {
  try {
    const logOutput = execFileSync("git", ["-C", projectPath, "log",
      `--since=${since}`, `--until=${until}`,
      "--format=%H", "--shortstat", "--no-merges"],
      { encoding: "utf8", timeout: 10000 });

    const lines = logOutput.trim().split("\n").filter(Boolean);
    const commitHashes = lines.filter((l) => /^[a-f0-9]{40}$/.test(l));
    let added = 0;
    let removed = 0;
    for (const line of lines) {
      const m = line.match(/(\d+)\s+insertions?/);
      if (m) added += Number(m[1]);
      const r = line.match(/(\d+)\s+deletions?/);
      if (r) removed += Number(r[1]);
    }

    // Top changed files
    const changedFiles = execFileSync("git", ["-C", projectPath, "log",
      `--since=${since}`, `--until=${until}`,
      "--format=%n", "--name-only", "--no-merges"],
      { encoding: "utf8", timeout: 10000 }).trim().split("\n").filter(Boolean);

    const freq = new Map();
    for (const f of changedFiles) {
      freq.set(f, (freq.get(f) || 0) + 1);
    }
    const topFiles = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([f]) => f);

    const commits = commitHashes.length;
    const netLines = added - removed;
    const avgCommitSize = commits > 0 ? Math.round(netLines / commits) : 0;
    const absAvg = commits > 0 ? Math.round((added + removed) / commits) : 0;
    /** @type {'small'|'medium'|'large'} */
    let sizeProfile = "small";
    if (absAvg >= 200) sizeProfile = "large";
    else if (absAvg >= 50) sizeProfile = "medium";

    return { commits, added, removed, files_changed: [...new Set(changedFiles)], top_files: topFiles, avg_commit_size: avgCommitSize, size_profile: sizeProfile };
  } catch {
    return { commits: 0, added: 0, removed: 0, files_changed: [], top_files: [], avg_commit_size: 0, size_profile: "small" };
  }
}

/**
 * Collect peak commit hours across all projects.
 *
 * @param {string[]} projectPaths
 * @param {string} since
 * @param {string} until
 * @returns {number[]}
 */
function collectPeakHours(projectPaths, since, until) {
  const hourCounts = new Map();
  for (const projPath of projectPaths) {
    try {
      const dates = execFileSync("git", ["-C", projPath, "log",
        `--since=${since}`, `--until=${until}`,
        "--format=%H %ai", "--no-merges"],
        { encoding: "utf8", timeout: 10000 }).trim().split("\n").filter(Boolean);
      for (const line of dates) {
        const m = line.match(/(\d{2}):\d{2}:\d{2}/);
        if (m) {
          const hour = Number(m[1]);
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        }
      }
    } catch {
      // Skip projects with git errors
    }
  }
  return [...hourCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h]) => h);
}

/**
 * soul_retro — collect git shipping metrics and append a shipping observation.
 *
 * @param {{ period?: string, projects?: string[] }} input
 */
export function handleSoulRetro({ period = "week", projects = null } = {}) {
  const validPeriods = ["week", "month", "quarter"];
  if (!validPeriods.includes(period)) {
    throw new Error(`period must be one of: ${validPeriods.join(", ")}`);
  }

  const days = periodToDays(/** @type {'week'|'month'|'quarter'} */ (period));
  const now = new Date();
  const periodEnd = now.toISOString().slice(0, 10);
  const periodStart = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);

  // Resolve project dirs
  /** @type {string[]} */
  let projDirs;
  if (Array.isArray(projects)) {
    projDirs = projects.filter((p) => existsSync(join(p, ".git")));
  } else {
    projDirs = detectProjects(periodStart);
  }

  /** @type {{[name: string]: object}} */
  const byProject = {};
  let totalCommits = 0;
  let totalAdded = 0;
  let totalRemoved = 0;
  const allChangedFiles = [];

  for (const projPath of projDirs) {
    const name = projPath.split("/").pop() || projPath;
    const metrics = collectProjectMetrics(projPath, periodStart, periodEnd);
    byProject[name] = metrics;
    totalCommits += metrics.commits;
    totalAdded += metrics.added;
    totalRemoved += metrics.removed;
    allChangedFiles.push(...metrics.files_changed);
  }

  // Aggregate metrics
  const peakHours = collectPeakHours(projDirs, periodStart, periodEnd);

  // Compute active days and streak
  let activeDays = 0;
  let streak = 0;
  if (projDirs.length > 0) {
    const activeDatesRaw = new Set();
    for (const projPath of projDirs) {
      try {
        const dates = execFileSync("git", ["-C", projPath, "log",
          `--since=${periodStart}`, `--until=${periodEnd}`,
          "--format=%ad", "--date=short", "--no-merges"],
          { encoding: "utf8", timeout: 10000 }).trim().split("\n").filter(Boolean);
        for (const d of dates) activeDatesRaw.add(d);
      } catch { /* skip */ }
    }
    activeDays = activeDatesRaw.size;

    // Count backwards streak from today
    const cursor = new Date(now);
    const oneDay = 86400000;
    let daysBack = 0;
    while (daysBack < days) {
      const dateStr = cursor.toISOString().slice(0, 10);
      if (activeDatesRaw.has(dateStr)) {
        streak++;
      } else {
        break;
      }
      cursor.setTime(cursor.getTime() - oneDay);
      daysBack++;
    }
  }

  const activeRatio = days > 0 ? activeDays / days : 0;

  // Commit size distribution across all projects
  let smallCount = 0;
  let mediumCount = 0;
  let largeCount = 0;
  for (const projPath of projDirs) {
    try {
      const sizes = execFileSync("git", ["-C", projPath, "log",
        `--since=${periodStart}`, `--until=${periodEnd}`,
        "--format=%H", "--shortstat", "--no-merges"],
        { encoding: "utf8", timeout: 10000 }).trim().split("\n").filter(Boolean);

      for (const line of sizes) {
        const mAdd = line.match(/(\d+)\s+insertions?/);
        const mDel = line.match(/(\d+)\s+deletions?/);
        const change = (mAdd ? Number(mAdd[1]) : 0) + (mDel ? Number(mDel[1]) : 0);
        if (change > 0) {
          if (change < 50) smallCount++;
          else if (change <= 200) mediumCount++;
          else largeCount++;
        }
      }
    } catch { /* skip */ }
  }
  const totalWithSize = smallCount + mediumCount + largeCount;

  // Build retro report
  const report = {
    period: `${periodStart} to ${periodEnd}`,
    summary: {
      total_commits: totalCommits,
      shipping_streak: streak,
      active_days: activeDays,
      period_days: days,
      active_ratio: Math.round(activeRatio * 100 * 100) / 100,
      peak_hours: peakHours,
    },
    by_project: Object.fromEntries(
      Object.entries(byProject).map(([name, m]) => [name, {
        commits: m.commits,
        net_lines: m.added - m.removed,
        avg_commit_size: m.avg_commit_size,
        size_profile: m.size_profile,
        top_files: m.top_files,
      }])
    ),
    commit_size_profile: {
      small_pct: totalWithSize > 0 ? Math.round((smallCount / totalWithSize) * 100 * 100) / 100 : 0,
      medium_pct: totalWithSize > 0 ? Math.round((mediumCount / totalWithSize) * 100 * 100) / 100 : 0,
      large_pct: totalWithSize > 0 ? Math.round((largeCount / totalWithSize) * 100 * 100) / 100 : 0,
      small_count: smallCount,
      medium_count: mediumCount,
      large_count: largeCount,
    },
  };

  // Trend detection (compare with previous retro)
  let trend = null;
  try {
    const allObs = handleSoulGetObservations({ category: "shipping", limit: 2 });
    if (allObs.observations.length >= 1) {
      const prev = allObs.observations[0];
      const prevRaw = prev.raw_context || prev.raw_text;
      if (prevRaw) {
        const prevData = JSON.parse(typeof prevRaw === "string" ? prevRaw : "{}");
        const prevCommits = prevData.total_commits || 0;
        if (prevCommits > 0) {
          if (totalCommits > prevCommits * 1.2) trend = "accelerating";
          else if (totalCommits < prevCommits * 0.8) trend = "decelerating";
          else trend = "steady";
        }
      }
    }
  } catch {
    // Trend detection is non-fatal
  }

  // Append shipping observation
  mkdirSync(SOUL_OBS_DIR, { recursive: true });
  const today = now.toISOString().slice(0, 10);
  const filePath = join(SOUL_OBS_DIR, `${today}.jsonl`);

  const projectDist = {};
  for (const [name, m] of Object.entries(byProject)) {
    projectDist[name] = m.commits;
  }

  const shippingObs = JSON.stringify({
    id: `obs-${Date.now()}-retro`,
    session_id: `retro-${today}`,
    signal_type: "shipping",
    category: "shipping",
    signal: `soul_retro --period ${period}`,
    context: `soul_retro --period ${period}`,
    raw_text: JSON.stringify({
      period: `${periodStart}..${periodEnd}`,
      total_commits: totalCommits,
      streak_days: streak,
      projects: projectDist,
      net_lines: totalAdded - totalRemoved,
      peak_hours: peakHours,
    }),
    inferred_pattern: "",
    ts: now.toISOString(),
    weight: 1,
  });
  appendFileSync(filePath, shippingObs + "\n", "utf8");

  // Update soul-active.json retro count
  try {
    if (existsSync(SOUL_ACTIVE_FILE)) {
      const state = JSON.parse(readFileSync(SOUL_ACTIVE_FILE, "utf8"));
      state.last_retro = now.toISOString();
      state.retro_count = (Number(state.retro_count) || 0) + 1;
      const tmp = `${SOUL_ACTIVE_FILE}.tmp.${process.pid}`;
      writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
      renameSync(tmp, SOUL_ACTIVE_FILE);
    }
  } catch {
    // Non-fatal
  }

  return {
    report,
    trend,
    observation_recorded: true,
  };
}

// ---------------------------------------------------------------------------
// Soul synthesis context
// ---------------------------------------------------------------------------

/**
 * soul_get_synthesis_context — prepare all data needed for the soul-keeper
 * agent to execute `soul propose` (the synthesis phase of the feedback loop).
 *
 * Returns observations (with recency-weighted grouping), current profile,
 * shipping metrics from retro entries, readiness status, and a drift
 * pre-check between the latest two profiles if an archive exists.
 */
export function handleSoulGetSynthesisContext() {
  // Observations with auto-derived session groups
  const rawObs = handleSoulGetObservations({ limit: 200 });
  const observations = rawObs.observations;

  // Count unique session_ids
  const sessionSet = new Set();
  for (const obs of observations) {
    if (obs.session_id) sessionSet.add(obs.session_id);
  }
  const sessionCount = sessionSet.size;

  // Recency-weighted grouping: last 5 sessions → recency=recent, rest → recency=older
  const sessionTimestamps = new Map();
  for (const obs of observations) {
    const sid = obs.session_id;
    if (!sessionTimestamps.has(sid)) {
      sessionTimestamps.set(sid, obs.ts || "");
    } else {
      const existing = sessionTimestamps.get(sid);
      if ((obs.ts || "") > existing) sessionTimestamps.set(sid, obs.ts);
    }
  }
  const sortedSessions = [...sessionTimestamps.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .map(([sid]) => sid);
  const recentSessions = new Set(sortedSessions.slice(0, 5));

  /** @type {object[]} */
  const recentObs = [];
  /** @type {object[]} */
  const olderObs = [];
  for (const obs of observations) {
    if (recentSessions.has(obs.session_id)) {
      recentObs.push(obs);
    } else {
      olderObs.push(obs);
    }
  }

  // Shipping observations (retro entries)
  const shippingObs = observations.filter((o) => o.signal_type === "shipping");

  // Current profile
  const profile = existsSync(SOUL_PROFILE_FILE)
    ? readFileSync(SOUL_PROFILE_FILE, "utf8")
    : null;

  // Archive check for drift pre-check
  let previousVersion = null;
  const archiveDir = join(SOUL_DIR, "archive");
  if (existsSync(archiveDir)) {
    try {
      const archives = readdirSync(archiveDir)
        .filter((f) => f.startsWith("SOUL-") && f.endsWith(".md"))
        .sort()
        .reverse();
      if (archives.length > 0) {
        previousVersion = readFileSync(join(archiveDir, archives[0]), "utf8");
      }
    } catch {
      // Non-fatal
    }
  }

  // Metadata
  let metadata = null;
  if (existsSync(SOUL_ACTIVE_FILE)) {
    try {
      metadata = JSON.parse(readFileSync(SOUL_ACTIVE_FILE, "utf8"));
    } catch { /* non-fatal */ }
  }

  const thresholdMet = observations.length >= 30 || sessionCount >= 10;

  return {
    observations_total: rawObs.total,
    observations_in_context: observations.length,
    session_count: sessionCount,
    recent_observations: recentObs.slice(0, 50),
    older_observations_summary: `${olderObs.length} observations from ${sortedSessions.length - recentSessions.size} older sessions`,
    shipping_entries: shippingObs.length,
    latest_shipping: shippingObs.length > 0 ? shippingObs[0] : null,
    profile,
    previous_version_exists: previousVersion !== null,
    metadata,
    readiness: {
      threshold_met: thresholdMet,
      required_sessions: 10,
      required_observations: 30,
      session_shortfall: Math.max(0, 10 - sessionCount),
      observation_shortfall: Math.max(0, 30 - observations.length),
    },
  };
}

/**
 * soul_get_readiness — lightweight check whether the soul is ready for
 * synthesis. Faster than get_synthesis_context when only the threshold
 * check is needed.
 */
export function handleSoulGetReadiness() {
  // Count total observations and sessions without loading all data
  let totalObs = 0;
  const sessionSet = new Set();

  if (existsSync(SOUL_OBS_DIR)) {
    try {
      const files = readdirSync(SOUL_OBS_DIR).filter((f) => f.endsWith(".jsonl"));
      for (const file of files) {
        try {
          const content = readFileSync(join(SOUL_OBS_DIR, file), "utf8");
          const lines = content.split("\n").filter((l) => l.trim().length > 0);
          totalObs += lines.length;
          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              if (obj.session_id) sessionSet.add(obj.session_id);
            } catch { /* skip malformed */ }
          }
        } catch { /* skip unreadable files */ }
      }
    } catch { /* non-fatal */ }
  }

  const sessionCount = sessionSet.size;
  const thresholdMet = totalObs >= 30 || sessionCount >= 10;

  // Check proposal_due flag from soul-active.json
  let proposalDue = false;
  let learningActive = false;
  if (existsSync(SOUL_ACTIVE_FILE)) {
    try {
      const state = JSON.parse(readFileSync(SOUL_ACTIVE_FILE, "utf8"));
      proposalDue = state.proposal_due === true;
      const mode = String(state.mode || "").toLowerCase();
      learningActive = mode === "learning" || mode === "hybrid";
    } catch { /* non-fatal */ }
  }

  return {
    ready: thresholdMet,
    threshold_met: thresholdMet,
    observation_count: totalObs,
    session_count: sessionCount,
    required_observations: 30,
    required_sessions: 10,
    observation_shortfall: Math.max(0, 30 - totalObs),
    session_shortfall: Math.max(0, 10 - sessionCount),
    proposal_due: proposalDue,
    learning_active: learningActive,
    recommendation: thresholdMet
      ? "Synthesis threshold met. Run soul propose to generate a proposed SOUL.md."
      : `Need ${Math.max(0, 30 - totalObs)} more observations or ${Math.max(0, 10 - sessionCount)} more sessions.`,
  };
}
