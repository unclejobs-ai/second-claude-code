#!/usr/bin/env node

// export-artifact.mjs — export a PDCA run as a single self-contained provenance page.
//
// This is NOT a dump of the produced content. The point is the audit trail: which gates fired,
// how many adversarial reviewers attacked the draft, what they caught, how the run actually moved
// between phases, and whether scope drifted from the plan. That record is what separates a PDCA
// artifact from "some model wrote this" — so it leads, and the content follows.
//
// Reads what the pipeline ACTUALLY writes (`.data/state`, `.data/events/*.jsonl`, `.data/cycles/`),
// not the `{session}/state.json` + `artifacts/*.json` layout the live viewer expects — nothing in
// this repo produces that layout, which is why the viewer renders nothing. The phase timeline comes
// from the event log; re-entry reasons come from `state.action_router_history`, with a cycle-based
// fallback for runs recorded before that field started being written.
//
// The event log is the source. Markdown and HTML are projections of that log — not a second host
// loop, not a live runtime. Markdown (default) keeps mermaid fences for mermaid-friendly hosts.
// HTML is one self-contained page: inline CSS, escaped text, no fetch/WebSocket/CDN.
//
// Usage:
//   node scripts/export-artifact.mjs [--data-dir .data] [--run <run_id>] [--out <file>] [--format md|html]
//   node scripts/export-artifact.mjs --session-dir <dir> [--out <file>] [--format md|html]
//     --data-dir     pipeline data root (default: .data); uses the last completed run
//     --run          specific run_id under --data-dir
//     --session-dir  legacy viewer layout (state.json + artifacts/*.json)
//     --format       md (default) or html; inferred as html when --out ends in .html
// Prints:
//   {"out": "<path>", "artifacts": N, "cycles": N, "source": "data-dir|session-dir", "format": "md|html"}

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

function fail(message) {
  console.error(`export-artifact: ${message}`);
  process.exit(1);
}

const FLAGS = {
  "--data-dir": "dataDir",
  "--run": "run",
  "--session-dir": "sessionDir",
  "--out": "out",
  "--format": "format",
};

function parseArgs(argv) {
  const args = { dataDir: ".data", run: null, sessionDir: null, out: null, format: null };
  for (let i = 0; i < argv.length; i += 1) {
    const key = FLAGS[argv[i]];
    if (!key) continue;
    // Catch `--out` with nothing after it here, rather than letting an undefined path surface
    // later as an opaque join() error.
    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) fail(`${argv[i - 1]} needs a value`);
    args[key] = value;
  }
  return args;
}

// Explicit --format wins. Otherwise a .html destination is enough to opt into the HTML projection.
function resolveFormat(args) {
  if (args.format != null) {
    const format = String(args.format).trim().toLowerCase();
    if (format !== "md" && format !== "html") fail(`--format must be md or html (got ${args.format})`);
    return format;
  }
  if (typeof args.out === "string" && args.out.toLowerCase().endsWith(".html")) return "html";
  return "md";
}

function defaultOutPath(args, format) {
  const ext = format === "html" ? "html" : "md";
  if (args.sessionDir) return join(args.sessionDir, `export.${ext}`);
  return `pdca-export.${ext}`;
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
      // A phase can start again without having ended — an interrupted run, or a re-entry whose
      // phase_end never landed. Keep the earlier attempt as an unfinished row instead of
      // overwriting it; a provenance record that drops attempts is the failure this file exists
      // to prevent.
      const abandoned = open.get(ev.phase);
      if (abandoned) timeline.push({ ...abandoned, endedAt: null, durationMs: null });
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

function htmlEscape(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    // Sorted by cycle number, not by name — `cycle-NNN` is zero-padded today, but the ordering
    // should not silently depend on that padding holding.
    const cycleDirs = readdirSync(cyclesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort((a, b) => (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0));
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

  // The router records why it sent work back, so prefer that. Older runs predate the field being
  // written, and a run can also be exported mid-flight; for those, a phase logged under a later
  // cycle is the only evidence a re-entry happened, but it carries no reason.
  const declared = (state.action_router_history ?? []).filter((entry) =>
    PHASES.includes(entry?.route ?? entry?.to ?? entry?.target)
  );
  let reentryCount = declared.length;
  if (declared.length) {
    declared.forEach((entry, i) => {
      const target = entry.route ?? entry.to ?? entry.target;
      const why = entry.root_cause ?? entry.reason ?? entry.decision ?? "routed back";
      lines.push(`  act -.->|"${i + 1}. ${mmLabel(why)}"| ${target}`);
    });
  } else {
    const inferred = new Set(timeline.filter((t) => (t.cycle ?? 1) > 1).map((t) => t.phase));
    reentryCount = inferred.size;
    for (const phase of inferred) lines.push(`  act -.->|"re-entry"| ${phase}`);
  }

  for (const phase of PHASES) {
    if (done.has(phase)) lines.push(`  style ${phase} fill:#d3f9d8,stroke:#2f9e44`);
    else if (phase === current) lines.push(`  style ${phase} fill:#fff3bf,stroke:#f08c00`);
  }
  lines.push("```");
  return { diagram: lines.join("\n"), reentryCount };
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

function renderMarkdown(state, timeline, artifacts, malformed) {
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
  return doc.join("\n");
}

// HTML is a static projection of the same append-only log. No scripts, no network, no mermaid CDN.

const HTML_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { font: 15px/1.45 system-ui, -apple-system, sans-serif; }
body { margin: 0; color: #1c1917; background: #fff; }
main { max-width: 52rem; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
h1 { font-size: 1.6rem; margin: 0 0 .35rem; }
h2 { font-size: 1.15rem; margin: 2rem 0 .75rem; border-bottom: 1px solid #e7e5e4; padding-bottom: .35rem; }
h3 { font-size: 1rem; margin: 1.25rem 0 .4rem; }
.meta, .empty, footer { color: #57534e; }
.pills { display: flex; flex-wrap: wrap; gap: .5rem; list-style: none; padding: 0; margin: 0 0 1rem; }
.pill { border: 1px solid #d6d3d1; border-radius: 999px; padding: .2rem .75rem; display: flex; gap: .4rem; align-items: center; }
.pill.done { background: #d3f9d8; border-color: #2f9e44; }
.pill.current { background: #fff3bf; border-color: #f08c00; }
.pill .mark { font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; color: #57534e; }
.reentries { margin: 0 0 1rem; padding-left: 1.2rem; }
.warn { background: #fff3bf; border: 1px solid #f08c00; padding: .6rem .8rem; }
table { width: 100%; border-collapse: collapse; margin: 0 0 1rem; }
th, td { border: 1px solid #e7e5e4; padding: .4rem .55rem; text-align: left; vertical-align: top; }
th { background: #f5f5f4; }
.turns { display: grid; gap: .75rem; margin: 0 0 1rem; }
.turn { border: 1px solid #e7e5e4; border-radius: 8px; padding: .7rem .9rem; break-inside: avoid; }
.turn header { display: flex; flex-wrap: wrap; gap: .5rem 1rem; font-weight: 600; }
.turn .artifacts { margin: .4rem 0 0; color: #44403c; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f5f5f4; padding: .75rem; border-radius: 6px; }
ul.flow { margin: 0; }
footer { margin-top: 2.5rem; border-top: 1px solid #e7e5e4; padding-top: 1rem; font-size: .9rem; }
@media print {
  body { background: #fff; color: #000; }
  main { max-width: none; padding: 0; }
  .turn, table, pre, .pill { break-inside: avoid; }
  .pill.done, .pill.current, .warn, th, pre { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`.trim();

function htmlItemText(item) {
  return htmlEscape(typeof item === "string" ? item : (item?.summary ?? JSON.stringify(item)));
}

function collectReentries(state, timeline) {
  const declared = (state.action_router_history ?? []).filter((entry) =>
    PHASES.includes(entry?.route ?? entry?.to ?? entry?.target)
  );
  if (declared.length) {
    return declared.map((entry) => ({
      target: entry.route ?? entry.to ?? entry.target,
      why: entry.root_cause ?? entry.reason ?? entry.decision ?? "routed back",
    }));
  }
  return [...new Set(timeline.filter((t) => (t.cycle ?? 1) > 1).map((t) => t.phase))].map((phase) => ({
    target: phase,
    why: "re-entry",
  }));
}

function renderHtmlPills(state, timeline) {
  const done = new Set(state.completed ?? state.completed_phases ?? []);
  const current = state.current_phase;
  const items = PHASES.map((phase) => {
    const cls = done.has(phase) ? "pill done" : phase === current ? "pill current" : "pill";
    const mark = done.has(phase) ? "done" : phase === current ? "current" : "pending";
    const entry = [...timeline].reverse().find((t) => t.phase === phase);
    const time =
      entry?.durationMs != null ? `<span class="time">${htmlEscape(humanMs(entry.durationMs))}</span>` : "";
    return `<li class="${cls}"><span class="name">${htmlEscape(phase)}</span><span class="mark">${mark}</span>${time}</li>`;
  });
  return `<ol class="pills">${items.join("")}</ol>`;
}

function renderHtmlReentries(reentries) {
  if (!reentries.length) return "";
  return `<ul class="reentries">${reentries
    .map((entry) => `<li>act → ${htmlEscape(entry.target)}: ${htmlEscape(entry.why)}</li>`)
    .join("")}</ul>`;
}

function renderHtmlTimelineTable(timeline) {
  if (!timeline.length) return `<p class="empty">No phase events in the log.</p>`;
  const rows = timeline
    .map((t) => {
      const artifacts = (t.artifactsSet ?? []).map((a) => htmlEscape(a)).join(", ") || "—";
      return `<tr><td>${htmlEscape(t.cycle ?? 1)}</td><td>${htmlEscape(t.phase)}</td><td>${htmlEscape(humanMs(t.durationMs))}</td><td>${artifacts}</td></tr>`;
    })
    .join("");
  return `<table><thead><tr><th>Cycle</th><th>Phase</th><th>Took</th><th>Artifacts set</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderHtmlTurns(timeline) {
  if (!timeline.length) return "";
  return `<div class="turns">${timeline
    .map((t) => {
      const artifacts = (t.artifactsSet ?? []).map((a) => htmlEscape(a)).join(", ") || "—";
      return `<article class="turn"><header><span class="cycle">Cycle ${htmlEscape(t.cycle ?? 1)}</span><span class="phase">${htmlEscape(t.phase)}</span><span class="duration">${htmlEscape(humanMs(t.durationMs))}</span></header><p class="artifacts">${artifacts}</p></article>`;
    })
    .join("")}</div>`;
}

function renderHtmlGates(state) {
  const entries = Object.entries(state.gates ?? {});
  if (!entries.length) return `<p class="empty">No gate data recorded.</p>`;
  const rows = entries
    .map(([name, value]) => {
      const status = value === true ? "pass" : value === false ? "fail" : "not reached";
      return `<tr><th>${htmlEscape(name)}</th><td>${status}</td></tr>`;
    })
    .join("");
  return `<table><thead><tr><th>Gate</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderHtmlReview(state) {
  const rows = [
    ["Reviewers dispatched", state.reviewer_count ?? 0],
    ["Critical findings", state.critical_count ?? 0],
    ["Warnings", state.warning_count ?? 0],
    ["Average score", state.average_score ?? "—"],
    ["Verdict", state.check_verdict ?? "—"],
    ["Sources collected", state.sources_count ?? 0],
  ]
    .map(([label, value]) => `<tr><th>${label}</th><td>${htmlEscape(value)}</td></tr>`)
    .join("");
  const list = (label, items) => {
    if (!items?.length) return "";
    return `<h3>${label}</h3><ul>${items.map((item) => `<li>${htmlItemText(item)}</li>`).join("")}</ul>`;
  };
  return `<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>${list("Critical findings", state.critical_findings)}${list("Top improvements applied", state.top_improvements)}`;
}

function renderHtmlScope(state) {
  const s = state.scope_creep_detail ?? {};
  const additions = s.additions ?? [];
  const omissions = s.omissions ?? [];
  if (!s.planned_scope && !s.actual_scope && !additions.length && !omissions.length) {
    return `<p class="empty">No scope data recorded.</p>`;
  }
  const parts = [];
  if (s.planned_scope) parts.push(`<p><strong>Planned:</strong> ${htmlEscape(s.planned_scope)}</p>`);
  if (s.actual_scope) parts.push(`<p><strong>Delivered:</strong> ${htmlEscape(s.actual_scope)}</p>`);
  if (additions.length) {
    parts.push(`<h3>Added beyond plan</h3><ul>${additions.map((a) => `<li>${htmlEscape(a)}</li>`).join("")}</ul>`);
  }
  if (omissions.length) {
    parts.push(`<h3>Planned but missing</h3><ul>${omissions.map((o) => `<li>${htmlEscape(o)}</li>`).join("")}</ul>`);
  }
  return parts.join("");
}

function renderHtmlAssumptions(state) {
  const assumptions = state.assumptions ?? [];
  if (!assumptions.length) return `<p class="empty">No assumptions recorded.</p>`;
  return `<ul>${assumptions.map((a) => `<li>${htmlItemText(a)}</li>`).join("")}</ul>`;
}

function renderHtmlChart(artifact) {
  const labels = artifact.data?.labels ?? [];
  const values = artifact.data?.datasets?.[0]?.values ?? [];
  const rows = labels
    .map((label, i) => `<tr><th>${htmlEscape(label)}</th><td>${htmlEscape(values[i] ?? "")}</td></tr>`)
    .join("");
  return `<table class="chart"><caption>${htmlEscape(artifact.title ?? "Chart")}</caption><thead><tr><th>Axis</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderHtmlFlow(artifact) {
  const nodes = new Map((artifact.nodes ?? []).map((n) => [n.id, n.label ?? n.id]));
  const children = new Map();
  for (const edge of artifact.edges ?? []) {
    if (!children.has(edge.from)) children.set(edge.from, []);
    children.get(edge.from).push(edge.to);
  }
  const incoming = new Set((artifact.edges ?? []).map((e) => e.to));
  const ids = (artifact.nodes ?? []).map((n) => n.id);
  const roots = ids.filter((id) => !incoming.has(id));
  const walk = (id, seen) => {
    const label = htmlEscape(nodes.get(id) ?? id);
    if (seen.has(id)) return `<li>${label}</li>`;
    const next = new Set(seen);
    next.add(id);
    const kids = children.get(id) ?? [];
    if (!kids.length) return `<li>${label}</li>`;
    return `<li>${label}<ul>${kids.map((child) => walk(child, next)).join("")}</ul></li>`;
  };
  const start = roots.length ? roots : ids;
  if (!start.length) return `<p class="empty">No flow nodes.</p>`;
  return `<ul class="flow">${start.map((id) => walk(id, new Set())).join("")}</ul>`;
}

function renderHtmlArtifact(artifact) {
  switch (artifact.type) {
    case "markdown":
      return `<pre class="artifact-md">${htmlEscape(artifact.content ?? "")}</pre>`;
    case "code":
      return `<pre><code>${htmlEscape(artifact.code ?? "")}</code></pre>`;
    case "chart":
      return renderHtmlChart(artifact);
    case "flow":
      return renderHtmlFlow(artifact);
    default:
      return `<p class="empty">Unsupported artifact type: ${htmlEscape(artifact.type)}</p>`;
  }
}

function renderHtml(state, timeline, artifacts, malformed) {
  const reentries = collectReentries(state, timeline);
  const cycles = state.cycle_count ?? 1;
  const title = htmlEscape(state.topic ?? "PDCA Run");
  const meta = `${htmlEscape(state.domain ?? "general")} · ${htmlEscape(state.reviewer_count ?? 0)} reviewers · ${htmlEscape(state.critical_count ?? 0)} critical · ${htmlEscape(cycles)}/${htmlEscape(state.max_cycles ?? cycles)} cycles · ${htmlEscape(reentries.length)} re-entr${reentries.length === 1 ? "y" : "ies"}`;
  const warn =
    malformed > 0
      ? `<p class="warn">${htmlEscape(malformed)} unreadable line${malformed === 1 ? "" : "s"} in the event log — the phase timeline below may be incomplete.</p>`
      : "";
  const artifactBlocks = artifacts.length
    ? artifacts
        .map((artifact) => {
          const heading = htmlEscape(artifact.title ?? basename(artifact.file ?? "artifact", ".json"));
          const phase = artifact.phase ? `<p class="empty">Phase: ${htmlEscape(artifact.phase)}</p>` : "";
          return `<h3>${heading}</h3>${phase}${renderHtmlArtifact(artifact)}`;
        })
        .join("")
    : `<p class="empty">No artifacts recorded.</p>`;
  const ended = state.ended_at ? ` · completed ${htmlEscape(state.ended_at)}` : "";
  const run = state.run_id ? ` · run <code>${htmlEscape(state.run_id)}</code>` : " · run <code>—</code>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${HTML_CSS}
</style>
</head>
<body>
<main>
<header>
<h1>${title}</h1>
<p class="meta">${meta}</p>
</header>
<section>
<h2>How this was produced</h2>
${renderHtmlPills(state, timeline)}
${renderHtmlReentries(reentries)}
${warn}
</section>
<section>
<h2>Phase log</h2>
${renderHtmlTimelineTable(timeline)}
${renderHtmlTurns(timeline)}
</section>
<section>
<h2>Gates</h2>
${renderHtmlGates(state)}
</section>
<section>
<h2>Review panel</h2>
${renderHtmlReview(state)}
</section>
<section>
<h2>Scope</h2>
${renderHtmlScope(state)}
</section>
<section>
<h2>Assumptions</h2>
${renderHtmlAssumptions(state)}
</section>
<section>
<h2>Artifacts</h2>
${artifactBlocks}
</section>
<footer>
<p>Produced by the SCC PDCA cycle${ended}${run}</p>
</footer>
</main>
</body>
</html>
`;
}

// --- main -----------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const format = resolveFormat(args);
  const { state, events, artifacts, malformed, source } = args.sessionDir
    ? loadFromSessionDir(args.sessionDir)
    : loadFromDataDir(args.dataDir, args.run);

  const timeline = buildTimeline(events);
  const cycles = state.cycle_count ?? 1;
  const text =
    format === "html"
      ? renderHtml(state, timeline, artifacts, malformed)
      : renderMarkdown(state, timeline, artifacts, malformed);

  const outPath = args.out ?? defaultOutPath(args, format);
  writeFileSync(outPath, text, "utf8");
  console.log(JSON.stringify({ out: outPath, artifacts: artifacts.length, cycles, source, format }));
}

main();
