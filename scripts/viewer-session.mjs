#!/usr/bin/env node

// viewer-session.mjs — build the session directory the Artifact Viewer reads.
//
// The viewer expects `{session}/state.json` + `{session}/artifacts/*.json`, and until now nothing
// in this repo produced that layout, so `/scc:viewer` rendered an empty page on every real run.
// This adapter is the missing producer: it projects what PDCA actually writes
// (`.data/state`, `.data/cycles/`) into the shape `ui/src/types.ts` declares.
//
// The two vocabularies differ. PDCA runs plan/do/check/act; the viewer's `Phase` is the *skill*
// axis — research, write, analyze, review, refine. Plan feeds two of them, so the mapping is
// deliberate rather than one-to-one.
//
// Usage:
//   node scripts/viewer-session.mjs [--data-dir .data] [--session-dir <dir>]
//     --data-dir     pipeline data root (default: .data)
//     --session-dir  where to write (default: .scc/sessions/<run_id>)
// Prints:
//   {"session_dir": "<dir>", "artifacts": N, "phase": "<viewer phase>"}

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

function fail(message) {
  console.error(`viewer-session: ${message}`);
  process.exit(1);
}

const FLAGS = { "--data-dir": "dataDir", "--session-dir": "sessionDir" };

function parseArgs(argv) {
  const args = { dataDir: ".data", sessionDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const key = FLAGS[argv[i]];
    if (!key) continue;
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) fail(`${argv[i - 1]} needs a value`);
    args[key] = value;
  }
  return args;
}

// Plan produces both the research brief and the analysis, so it lights two viewer phases.
const PDCA_TO_VIEWER = { plan: ["research", "analyze"], do: ["write"], check: ["review"], act: ["refine"] };
const VIEWER_PHASES = ["research", "analyze", "write", "review", "refine"];

// Which PDCA phase a viewer phase came from — the inverse of the map above.
const VIEWER_TO_PDCA = Object.fromEntries(
  Object.entries(PDCA_TO_VIEWER).flatMap(([pdca, viewers]) => viewers.map((v) => [v, pdca]))
);

function buildPhases(state) {
  const completed = new Set(state.completed ?? state.completed_phases ?? []);
  const current = state.current_phase;

  // Plan lights two viewer phases, but only one may read as active or the timeline shows two
  // cursors. The first of the group carries "active"; the rest wait.
  let activeClaimed = false;
  return VIEWER_PHASES.map((name) => {
    const source = VIEWER_TO_PDCA[name];
    let status = "pending";
    if (completed.has(source)) {
      status = "completed";
    } else if (source === current && !activeClaimed) {
      status = "active";
      activeClaimed = true;
    }
    return { name, status };
  });
}

function readCycleArtifacts(dataDir) {
  const cyclesDir = join(dataDir, "cycles");
  if (!existsSync(cyclesDir)) return [];

  const cycles = readdirSync(cyclesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0));

  // Ordered plan → do → check, not alphabetically: `check.md` sorts first by name and would put the
  // review above the draft it reviewed.
  const PDCA_ORDER = ["plan", "do", "check", "act"];
  const artifacts = [];
  for (const cycle of cycles) {
    const files = readdirSync(join(cyclesDir, cycle))
      .filter((f) => f.endsWith(".md"))
      .sort((a, b) => PDCA_ORDER.indexOf(basename(a, ".md")) - PDCA_ORDER.indexOf(basename(b, ".md")));
    for (const file of files) {
      const pdcaPhase = basename(file, ".md");
      const viewerPhase = PDCA_TO_VIEWER[pdcaPhase]?.[0];
      if (!viewerPhase) continue; // a file the viewer has no lane for
      artifacts.push({
        type: "markdown",
        phase: viewerPhase,
        title: `${pdcaPhase} — ${cycle}`,
        content: readFileSync(join(cyclesDir, cycle, file), "utf8").trim(),
      });
    }
  }
  return artifacts;
}

// The review numbers are the one thing a reader wants at a glance, and `kpi` is the artifact type
// built for it — otherwise the viewer would show prose only.
function buildReviewKpi(state) {
  if (!state.reviewer_count && !state.critical_count && state.average_score == null) return null;
  const items = [
    { label: "Reviewers", value: state.reviewer_count ?? 0 },
    { label: "Critical", value: state.critical_count ?? 0, trend: (state.critical_count ?? 0) > 0 ? "up" : "flat" },
    { label: "Warnings", value: state.warning_count ?? 0 },
    { label: "Sources", value: state.sources_count ?? 0 },
  ];
  if (state.average_score != null) items.push({ label: "Score", value: state.average_score });
  return { type: "kpi", phase: "review", title: "Review panel", items };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const statePath = existsSync(join(args.dataDir, "state", "pdca-active.json"))
    ? join(args.dataDir, "state", "pdca-active.json")
    : join(args.dataDir, "state", "pdca-last-completed.json");
  if (!existsSync(statePath)) fail(`no PDCA state under ${join(args.dataDir, "state")}`);

  let state;
  try {
    state = JSON.parse(readFileSync(statePath, "utf8"));
  } catch (cause) {
    fail(`cannot read ${statePath}: ${cause.message}`);
  }

  const runId = state.run_id ?? "unknown-run";
  const sessionDir = args.sessionDir ?? join(".scc", "sessions", runId);
  const artifactsDir = join(sessionDir, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });

  const phases = buildPhases(state);
  const currentViewerPhase =
    phases.find((p) => p.status === "active")?.name ??
    [...phases].reverse().find((p) => p.status === "completed")?.name ??
    "research";

  writeFileSync(
    join(sessionDir, "state.json"),
    JSON.stringify({ sessionId: runId, currentPhase: currentViewerPhase, phases }, null, 2),
    "utf8"
  );

  const artifacts = readCycleArtifacts(args.dataDir);
  const kpi = buildReviewKpi(state);
  if (kpi) artifacts.push(kpi);

  artifacts.forEach((artifact, i) => {
    const seq = String(i + 1).padStart(3, "0");
    const id = `${seq}-${artifact.phase}`;
    writeFileSync(
      join(artifactsDir, `${id}.json`),
      JSON.stringify({ id, ...artifact }, null, 2),
      "utf8"
    );
  });

  console.log(
    JSON.stringify({ session_dir: sessionDir, artifacts: artifacts.length, phase: currentViewerPhase })
  );
}

main();
