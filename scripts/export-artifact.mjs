#!/usr/bin/env node

// export-artifact.mjs — export a PDCA run as a single self-contained Markdown provenance page.
//
// This is NOT a dump of the produced content. The point is the audit trail: which gates fired,
// how many adversarial reviewers attacked the draft, what they caught, how the run actually moved
// between phases, and whether scope drifted from the plan. That record is what separates a PDCA
// artifact from "some model wrote this" — so it leads, and the content follows.
//
// Reads what the pipeline ACTUALLY writes (`.data/state`, `.data/events/*.jsonl`, `.data/cycles/`),
// not the `{session}/state.json` + `artifacts/*.json` layout the live viewer expects — nothing in
// this repo produces that layout, which is why the viewer renders nothing. The phase timeline is
// reconstructed from the event log rather than `state.action_router_history`, because that field is
// initialized to `[]` and never appended to (see mcp/lib/pdca-handlers.mjs).
//
// Emits Markdown only (mermaid fences for the loop, flows, and charts), so the result renders as a
// Claude Code Artifact with no bundle, no server, and no CSP problems.
//
// Usage:
//   node scripts/export-artifact.mjs [--data-dir .data] [--run <run_id>] [--out <file.md>]
//   node scripts/export-artifact.mjs --session-dir <dir> [--out <file.md>]
//     --data-dir     pipeline data root (default: .data); uses the last completed run
//     --run          specific run_id under --data-dir
//     --session-dir  legacy viewer layout (state.json + artifacts/*.json)
// Prints:
//   {"out": "<path>", "artifacts": N, "cycles": N, "source": "data-dir|session-dir"}

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

function fail(message) {
  console.error(`export-artifact: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { dataDir: ".data", run: null, sessionDir: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--data-dir") args.dataDir = argv[++i];
    else if (argv[i] === "--run") args.run = argv[++i];
    else if (argv[i] === "--session-dir") args.sessionDir = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    fail(`cannot read JSON at ${path}: ${cause.message}`);
  }
}

// Unparseable lines are counted, never silently dropped — a provenance record that quietly omits
// part of the run is worse than one that admits the gap.
function readEvents(path) {
  if (!existsSync(path)) return { events: [], malformed: 0 };
  const events = [];
  let malformed = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      malformed += 1;
    }
  }
  return { events, malformed };
}

// Pair phase_start with the matching phase_end to get real durations, and treat a phase that
// reappears in a later cycle as a re-entry — the only honest signal available, since the state's
// action_router_history is never written.
function buildTimeline(events) {
  const timeline = [];
  const open = new Map();
  for (const ev of events) {
    if (ev.type === "phase_start") {
      open.set(ev.phase, { phase: ev.phase, cycle: ev.data?.cycle_count ?? 1, startedAt: ev.ts });
    } else if (ev.type === "phase_end") {
      const entry = open.get(ev.phase) ?? { phase: ev.phase, cycle: 1, startedAt: null };
      open.delete(ev.phase);
      timeline.push({
        ...entry,
        endedAt: ev.ts,
        artifactsSet: ev.data?.artifacts_set ?? [],
        durationMs:
          entry.startedAt && ev.ts ? new Date(ev.ts) - new Date(entry.startedAt) : null,
      });
    }
  }
  for (const entry of open.values()) timeline.push({ ...entry, endedAt: null, durationMs: null });
  return timeline;
}

function mmLabel(text) {
  return String(text ?? "")
    .replace(/["[\]{}|()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function mdEscape(text) {
  return String(text ?? "").replace(/\|/g, "\\|");
}

function humanMs(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
}

// --- input adapters -------------------------------------------------------

function loadFromDataDir(dataDir, runId) {
  const statePath = join(dataDir, "state", "pdca-last-completed.json");
  if (!existsSync(statePath)) fail(`no pipeline state at ${statePath} (try --session-dir)`);
  const state = readJson(statePath);

  // Only the latest run keeps state and cycle output; the event log is the one per-run artifact.
  // Pairing an older run's events with the latest run's state and cycles would silently produce a
  // provenance page whose sections describe different runs, so refuse instead of mixing.
  if (runId && runId !== state.run_id) {
    fail(
      `--run ${runId} is not the last completed run (${state.run_id}). ` +
        `Only the latest run has state and cycle artifacts; exporting an older run would mix provenance.`
    );
  }
  const run = state.run_id;

  const { events, malformed } = readEvents(join(dataDir, "events", `pdca-${run}.jsonl`));

  const cyclesDir = join(dataDir, "cycles");
  const artifacts = [];
  if (existsSync(cyclesDir)) {
    const cycleDirs = readdirSync(cyclesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const cycle of cycleDirs) {
      const files = readdirSync(join(cyclesDir, cycle))
        .filter((f) => f.endsWith(".md"))
        .sort();
      for (const file of files) {
        artifacts.push({
          type: "markdown",
          phase: `${cycle} · ${basename(file, ".md")}`,
          title: `${basename(file, ".md")} (${cycle})`,
          content: readFileSync(join(cyclesDir, cycle, file), "utf8").trim(),
        });
      }
    }
  }
  return { state, events, artifacts, malformed, source: "data-dir" };
}

function loadFromSessionDir(sessionDir) {
  const statePath = join(sessionDir, "state.json");
  if (!existsSync(statePath)) fail(`no state.json in ${sessionDir}`);
  const state = readJson(statePath);
  const artifactsDir = join(sessionDir, "artifacts");
  const artifacts = existsSync(artifactsDir)
    ? readdirSync(artifactsDir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => ({ file: f, ...readJson(join(artifactsDir, f)) }))
    : [];
  return { state, events: [], artifacts, malformed: 0, source: "session-dir" };
}

// --- renderers ------------------------------------------------------------

const PHASES = ["plan", "do", "check", "act"];

function renderLoop(state, timeline) {
  const done = new Set(state.completed ?? state.completed_phases ?? []);
  const current = state.current_phase;
  const lines = ["```mermaid", "graph LR"];

  for (const phase of PHASES) {
    const mark = done.has(phase) ? "✓" : phase === current ? "▶" : "·";
    const entry = timeline.find((t) => t.phase === phase);
    const time = entry?.durationMs != null ? ` ${humanMs(entry.durationMs)}` : "";
    lines.push(`  ${phase}["${mark} ${phase}${time}"]`);
  }
  lines.push("  plan --> do --> check --> act");

  // A phase logged in a later cycle means Act sent the work back to it.
  const reentries = new Set(timeline.filter((t) => (t.cycle ?? 1) > 1).map((t) => t.phase));
  for (const phase of reentries) {
    lines.push(`  act -.->|"re-entry"| ${phase}`);
  }
  const declared = state.action_router_history ?? [];
  declared.forEach((entry, i) => {
    const target = entry?.route ?? entry?.to ?? entry?.target;
    if (!target || !PHASES.includes(target) || reentries.has(target)) return;
    lines.push(`  act -.->|"${i + 1}. ${mmLabel(entry?.reason ?? "routed back")}"| ${target}`);
  });

  for (const phase of PHASES) {
    if (done.has(phase)) lines.push(`  style ${phase} fill:#d3f9d8,stroke:#2f9e44`);
    else if (phase === current) lines.push(`  style ${phase} fill:#fff3bf,stroke:#f08c00`);
  }
  lines.push("```");
  return { diagram: lines.join("\n"), reentryCount: reentries.size + declared.length };
}

function renderTimeline(timeline) {
  if (!timeline.length) return null;
  const rows = timeline.map(
    (t) =>
      `| ${t.cycle ?? 1} | ${t.phase} | ${humanMs(t.durationMs)} | ${
        (t.artifactsSet ?? []).map((a) => `\`${a}\``).join(", ") || "—"
      } |`
  );
  return ["| Cycle | Phase | Took | Artifacts set |", "| --- | --- | --- | --- |", ...rows].join("\n");
}

function renderGates(state) {
  const rows = Object.entries(state.gates ?? {}).map(([name, value]) => {
    const status = value === true ? "✅ pass" : value === false ? "❌ fail" : "— not reached";
    return `| \`${name}\` | ${status} |`;
  });
  if (!rows.length) return "_No gate data recorded._";
  return ["| Gate | Result |", "| --- | --- |", ...rows].join("\n");
}

function renderReview(state) {
  const out = [
    "| Metric | Value |",
    "| --- | --- |",
    `| Reviewers dispatched | ${state.reviewer_count ?? 0} |`,
    `| Critical findings | ${state.critical_count ?? 0} |`,
    `| Warnings | ${state.warning_count ?? 0} |`,
    `| Average score | ${state.average_score ?? "—"} |`,
    `| Verdict | ${state.check_verdict ?? "—"} |`,
    `| Sources collected | ${state.sources_count ?? 0} |`,
  ];
  const list = (label, items) => {
    if (!items?.length) return;
    out.push("", `**${label}**`, "");
    for (const item of items) {
      out.push(`- ${mdEscape(typeof item === "string" ? item : (item.summary ?? JSON.stringify(item)))}`);
    }
  };
  list("Critical findings", state.critical_findings);
  list("Top improvements applied", state.top_improvements);
  return out.join("\n").trimEnd();
}

function renderScope(state) {
  const s = state.scope_creep_detail ?? {};
  const additions = s.additions ?? [];
  const omissions = s.omissions ?? [];
  if (!s.planned_scope && !additions.length && !omissions.length) return null;

  const out = [];
  if (s.planned_scope) out.push(`**Planned:** ${mdEscape(s.planned_scope)}`, "");
  if (s.actual_scope) out.push(`**Delivered:** ${mdEscape(s.actual_scope)}`, "");
  if (additions.length) {
    out.push("**Added beyond plan**", "");
    for (const a of additions) out.push(`- ➕ ${mdEscape(a)}`);
  }
  if (omissions.length) {
    out.push("", "**Planned but missing**", "");
    for (const o of omissions) out.push(`- ➖ ${mdEscape(o)}`);
  }
  return out.join("\n").trimEnd();
}

function renderChart(artifact) {
  const labels = artifact.data?.labels ?? [];
  const values = artifact.data?.datasets?.[0]?.values ?? [];

  if (artifact.chartType === "pie") {
    const lines = ["```mermaid", `pie title ${mmLabel(artifact.title)}`];
    labels.forEach((label, i) => lines.push(`  "${mmLabel(label)}" : ${values[i] ?? 0}`));
    lines.push("```");
    return lines.join("\n");
  }
  if (artifact.chartType === "bar" || artifact.chartType === "line") {
    return [
      "```mermaid",
      "xychart-beta",
      `  title "${mmLabel(artifact.title)}"`,
      `  x-axis [${labels.map((l) => `"${mmLabel(l)}"`).join(", ")}]`,
      `  ${artifact.chartType} [${values.join(", ")}]`,
      "```",
    ].join("\n");
  }
  // radar has no mermaid equivalent — a table keeps the numbers rather than dropping them.
  const rows = labels.map((l, i) => `| ${mdEscape(l)} | ${values[i] ?? ""} |`);
  return ["| Axis | Value |", "| --- | --- |", ...rows].join("\n");
}

function renderArtifact(artifact) {
  switch (artifact.type) {
    case "markdown":
      return artifact.content ?? "";
    case "code":
      return ["```" + (artifact.language ?? ""), artifact.code ?? "", "```"].join("\n");
    case "chart":
      return renderChart(artifact);
    case "flow": {
      const lines = ["```mermaid", "graph TD"];
      for (const node of artifact.nodes ?? []) lines.push(`  ${node.id}["${mmLabel(node.label)}"]`);
      for (const edge of artifact.edges ?? []) lines.push(`  ${edge.from} --> ${edge.to}`);
      lines.push("```");
      return lines.join("\n");
    }
    default:
      return `_Unsupported artifact type: \`${artifact.type}\`_`;
  }
}

// --- main -----------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { state, events, artifacts, malformed, source } = args.sessionDir
    ? loadFromSessionDir(args.sessionDir)
    : loadFromDataDir(args.dataDir, args.run);

  const timeline = buildTimeline(events);
  const { diagram, reentryCount } = renderLoop(state, timeline);
  const cycles = state.cycle_count ?? 1;
  const doc = [];

  doc.push(`# ${state.topic ?? "PDCA Run"}`, "");
  doc.push(
    `\`${state.domain ?? "general"}\` · ${state.reviewer_count ?? 0} reviewers · ` +
      `${state.critical_count ?? 0} critical · ${cycles}/${state.max_cycles ?? cycles} cycles · ` +
      `${reentryCount} re-entr${reentryCount === 1 ? "y" : "ies"}`
  );
  doc.push("", "## How this was produced", "", diagram);

  if (malformed > 0) {
    doc.push(
      "",
      `> ⚠️ ${malformed} unreadable line${malformed === 1 ? "" : "s"} in the event log — ` +
        `the phase timeline below may be incomplete.`
    );
  }

  const tl = renderTimeline(timeline);
  if (tl) doc.push("", "### Phase log", "", tl);

  doc.push("", "## Gates", "", renderGates(state));
  doc.push("", "## Review panel", "", renderReview(state));

  const scope = renderScope(state);
  if (scope) doc.push("", "## Scope integrity", "", scope);

  const assumptions = state.assumptions ?? [];
  if (assumptions.length) {
    doc.push("", "## Assumptions carried", "");
    for (const a of assumptions) {
      doc.push(`- ${mdEscape(typeof a === "string" ? a : JSON.stringify(a))}`);
    }
  }

  if (artifacts.length) {
    doc.push("", "## Artifacts");
    for (const artifact of artifacts) {
      doc.push("", `### ${artifact.title ?? basename(artifact.file ?? "artifact", ".json")}`);
      if (artifact.phase) doc.push("", `_Phase: ${artifact.phase}_`);
      doc.push("", renderArtifact(artifact));
    }
  }

  doc.push("", "---", "");
  doc.push(
    `Produced by the SCC PDCA cycle${state.ended_at ? ` · completed ${state.ended_at}` : ""}` +
      `${state.run_id ? ` · run \`${state.run_id}\`` : ""}`
  );
  doc.push("");

  const outPath = args.out ?? (args.sessionDir ? join(args.sessionDir, "export.md") : "pdca-export.md");
  writeFileSync(outPath, doc.join("\n"), "utf8");
  console.log(JSON.stringify({ out: outPath, artifacts: artifacts.length, cycles, source }));
}

main();
