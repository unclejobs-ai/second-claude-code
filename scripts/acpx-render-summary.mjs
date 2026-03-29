#!/usr/bin/env node

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

import { parseJsonArg, readJson } from "./lib/acpx-runtime.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, "..");

function snippet(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "No final text captured.";
  return text.slice(0, 240);
}

export function buildSummary(markdownInput) {
  const lines = [];
  lines.push(`# acpx Run Summary`);
  lines.push("");
  lines.push(`- Run ID: \`${markdownInput.run_id}\``);
  lines.push(`- Task: ${markdownInput.task || "No task recorded."}`);
  lines.push(`- CWD: \`${markdownInput.cwd}\``);
  lines.push(`- Roles: ${markdownInput.roles.length}`);
  lines.push("");
  lines.push(`## Role Status`);
  lines.push("");

  for (const role of markdownInput.roles) {
    lines.push(`### ${role.role}`);
    lines.push(`- Agent: \`${role.agent}\``);
    lines.push(`- Status: ${role.ok ? "success" : "failed"}`);
    lines.push(`- Exit code: ${role.exit_code}`);
    lines.push(`- Duration: ${role.duration_ms || 0} ms`);
    lines.push(`- Result: \`${role.result_path}\``);
    lines.push(`- Final text: ${snippet(role.final_text)}`);
    lines.push("");
  }

  if (markdownInput.mmbridge) {
    lines.push(`## MMBridge`);
    lines.push("");
    if (markdownInput.mmbridge.skipped) {
      lines.push(`- Status: skipped`);
      lines.push(`- Reason: ${markdownInput.mmbridge.reason || "No reason recorded."}`);
    } else {
      if (markdownInput.mmbridge.review) {
        lines.push(`- Review status: ${markdownInput.mmbridge.review.status}`);
        lines.push(
          `- Review findings: ${Array.isArray(markdownInput.mmbridge.review.findings) ? markdownInput.mmbridge.review.findings.length : 0}`
        );
      }
      if (markdownInput.mmbridge.gate) {
        lines.push(`- Gate status: ${markdownInput.mmbridge.gate.status}`);
        lines.push(
          `- Gate warnings: ${Array.isArray(markdownInput.mmbridge.gate.warnings) ? markdownInput.mmbridge.gate.warnings.length : 0}`
        );
      }
    }
    lines.push("");
  }

  const failed = markdownInput.roles.filter((entry) => !entry.ok);
  lines.push(`## Recommendation`);
  lines.push("");
  if (failed.length > 0) {
    lines.push(
      `One or more roles failed (${failed.map((entry) => entry.role).join(", ")}). Inspect their result and stderr artifacts before taking action.`
    );
  } else if (markdownInput.mmbridge?.gate?.status === "fail") {
    lines.push("MMBridge gate failed. Do not accept the run without a corrective implementation pass.");
  } else if (markdownInput.mmbridge?.gate?.status === "warn") {
    lines.push("MMBridge returned warnings. Review them before accepting the implementation result.");
  } else {
    lines.push(
      "All roles completed successfully. Read the review and docs outputs before accepting the implementation result."
    );
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

export function renderSummaryFromManifest(manifestPath) {
  const manifest = readJson(manifestPath);
  const summary = buildSummary(manifest);
  const summaryPath = join(dirname(manifestPath), "summary.md");
  writeFileSync(summaryPath, summary, "utf8");
  return {
    summary_path: summaryPath,
    summary,
  };
}

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/acpx-render-summary.mjs render '<json>'",
      "  node scripts/acpx-render-summary.mjs render-manifest /path/to/manifest.json",
    ].join("\n")
  );
}

function main() {
  const [, , command, arg] = process.argv;
  if (command === "render") {
    const input = parseJsonArg(arg, "summary input");
    process.stdout.write(buildSummary(input));
    return;
  }

  if (command === "render-manifest") {
    const result = renderSummaryFromManifest(resolve(arg));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  usage();
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
