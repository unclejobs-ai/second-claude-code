/**
 * PDCA Cycle HTML Report Generator
 *
 * Generates a self-contained HTML dashboard after each PDCA cycle completion.
 * Uses Chart.js (CDN) for metrics charts and Mermaid.js (CDN) for flow diagrams.
 * Output: .data/reports/cycle-{N}.html + cycle-{N}.mmd
 *
 * Inspired by LangSmith dashboards, CrewAI metrics, and Pi coding agent's
 * two-file persistence pattern (structured data + human-readable narrative).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPORTS_DIR = ".data/reports";

/**
 * @param {string} dataDir - Plugin data directory root
 * @param {object} cycleData
 * @param {number} cycleData.cycleNumber
 * @param {object} cycleData.phases - { plan: "pass"|"warn"|"fail", do: ..., check: ..., act: ... }
 * @param {number} cycleData.totalTimeMs
 * @param {number} cycleData.issueCount
 * @param {number|null} cycleData.score - mmbridge score or gate pass rate (0-100)
 * @param {string} cycleData.topic
 * @param {Array<{cycle: number, score: number}>} cycleData.history - Previous cycle scores
 * @param {string[]} cycleData.issues - Issue descriptions
 * @param {string} cycleData.nextAction
 */
export function generateCycleReport(dataDir, cycleData) {
  const reportsDir = join(dataDir, REPORTS_DIR);
  mkdirSync(reportsDir, { recursive: true });

  const {
    cycleNumber,
    phases,
    totalTimeMs,
    issueCount,
    score,
    topic,
    history = [],
    issues = [],
    nextAction = "",
  } = cycleData;

  const timeMin = Math.round(totalTimeMs / 60000);

  // Generate Mermaid source
  const mmd = generateMermaid(phases);
  writeFileSync(join(reportsDir, `cycle-${cycleNumber}.mmd`), mmd, "utf8");

  // Generate HTML
  const html = generateHTML({
    cycleNumber,
    phases,
    timeMin,
    issueCount,
    score,
    topic,
    history,
    issues,
    nextAction,
    mmd,
  });
  const htmlPath = join(reportsDir, `cycle-${cycleNumber}.html`);
  writeFileSync(htmlPath, html, "utf8");

  return htmlPath;
}

/**
 * @param {object} phases
 * @returns {string} Mermaid flowchart source
 */
function generateMermaid(phases) {
  const classMap = { pass: "pass", warn: "warn", fail: "fail" };
  return `flowchart LR
    Plan:::${classMap[phases.plan] || "pass"} --> Do:::${classMap[phases.do] || "pass"}
    Do --> Check:::${classMap[phases.check] || "pass"}
    Check --> Act:::${classMap[phases.act] || "pass"}
    classDef pass fill:#4caf50,color:#fff,stroke:#388e3c
    classDef warn fill:#ff9800,color:#fff,stroke:#f57c00
    classDef fail fill:#f44336,color:#fff,stroke:#d32f2f
`;
}

function phaseIcon(status) {
  const map = { pass: "✓", warn: "⚠", fail: "✗" };
  return map[status] || "?";
}

function phaseColor(status) {
  const map = { pass: "#4caf50", warn: "#ff9800", fail: "#f44336" };
  return map[status] || "#999";
}

function generateHTML(data) {
  const { cycleNumber, phases, timeMin, issueCount, score, topic, history, issues, nextAction, mmd } = data;

  const historyLabels = history.map((h) => `Cycle ${h.cycle}`);
  const historyScores = history.map((h) => h.score);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PDCA Cycle #${cycleNumber} Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 24px; }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { font-size: 28px; color: #fff; }
    .header .meta { color: #888; font-size: 14px; margin-top: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 1000px; margin: 0 auto; }
    .card { background: #16213e; border-radius: 12px; padding: 20px; }
    .card h2 { font-size: 16px; color: #888; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .traffic-light { display: flex; gap: 16px; justify-content: center; align-items: center; }
    .phase-box { text-align: center; padding: 16px 20px; border-radius: 8px; min-width: 80px; }
    .phase-box .name { font-size: 12px; text-transform: uppercase; opacity: 0.8; }
    .phase-box .icon { font-size: 28px; margin-top: 4px; }
    .stats { display: flex; gap: 24px; justify-content: center; }
    .stat { text-align: center; }
    .stat .value { font-size: 32px; font-weight: bold; color: #fff; }
    .stat .label { font-size: 12px; color: #888; text-transform: uppercase; }
    .issues-list { list-style: none; }
    .issues-list li { padding: 8px 0; border-bottom: 1px solid #1a1a2e; font-size: 14px; }
    .issues-list li:before { content: "⚠ "; color: #ff9800; }
    .next-action { background: #0f3460; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; }
    .full-width { grid-column: 1 / -1; }
    .mermaid { text-align: center; }
    canvas { max-width: 100%; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'dark' });
  </script>
</head>
<body>
  <div class="header">
    <h1>PDCA Cycle #${cycleNumber}</h1>
    <div class="meta">${topic || "Second Claude Code"} — Generated ${new Date().toISOString().slice(0, 19)}</div>
  </div>

  <div class="grid">
    <div class="card full-width">
      <h2>Phase Status</h2>
      <div class="traffic-light">
        ${["plan", "do", "check", "act"]
          .map(
            (p) => `<div class="phase-box" style="background:${phaseColor(phases[p])}22;border:2px solid ${phaseColor(phases[p])}">
          <div class="name">${p}</div>
          <div class="icon">${phaseIcon(phases[p])}</div>
        </div>`
          )
          .join("\n        ")}
      </div>
    </div>

    <div class="card">
      <h2>Metrics</h2>
      <div class="stats">
        <div class="stat"><div class="value">${timeMin}m</div><div class="label">Time</div></div>
        <div class="stat"><div class="value">${issueCount}</div><div class="label">Issues</div></div>
        <div class="stat"><div class="value">${score !== null ? score : "—"}</div><div class="label">Score</div></div>
      </div>
    </div>

    <div class="card">
      <h2>PDCA Flow</h2>
      <div class="mermaid">
${mmd}
      </div>
    </div>

    ${
      history.length > 1
        ? `<div class="card full-width">
      <h2>Score Trend</h2>
      <canvas id="trend-chart" height="200"></canvas>
      <script>
        new Chart(document.getElementById('trend-chart'), {
          type: 'line',
          data: {
            labels: ${JSON.stringify(historyLabels)},
            datasets: [{
              label: 'Score',
              data: ${JSON.stringify(historyScores)},
              borderColor: '#4caf50',
              backgroundColor: '#4caf5033',
              fill: true,
              tension: 0.3
            }]
          },
          options: {
            responsive: true,
            scales: {
              y: { min: 0, max: 100, grid: { color: '#333' } },
              x: { grid: { color: '#333' } }
            },
            plugins: { legend: { display: false } }
          }
        });
      </script>
    </div>`
        : ""
    }

    ${
      issues.length > 0
        ? `<div class="card">
      <h2>Issues (${issues.length})</h2>
      <ul class="issues-list">
        ${issues.map((i) => `<li>${i}</li>`).join("\n        ")}
      </ul>
    </div>`
        : ""
    }

    ${
      nextAction
        ? `<div class="card">
      <h2>Next Action</h2>
      <div class="next-action">${nextAction}</div>
    </div>`
        : ""
    }
  </div>
</body>
</html>`;
}
