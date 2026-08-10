#!/usr/bin/env node

// Runs the active standards' checks against one artifact.
//
//   node scripts/standard-check.mjs <target path> [--standard <id>] [--json]
//
// Exit code 1 when any check fails. Two standards whose checks cannot both be
// satisfied produce two failures and no arbitration: the runner reports the
// conflict, and a human resolves it through the supersede protocol.

import { existsSync, readFileSync, statSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

import { resolveProjectRoot } from "./lib/project-root.mjs";
import { listActiveStandards } from "./lib/standard-record.mjs";
import { validateCheck, runCheck } from "./lib/standard-checkers.mjs";

export function isDirectExecution(metaUrl = import.meta.url, argv1 = process.argv[1]) {
  return argv1 ? resolve(fileURLToPath(metaUrl)) === resolve(argv1) : false;
}

export function parseTarget(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  const frontmatter = {};
  if (match) {
    for (const line of match[1].split("\n")) {
      const field = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (!field) continue;
      const raw = field[2].trim();
      let value = raw;
      if (raw.startsWith('"') || raw.startsWith("[") || raw.startsWith("{")) {
        try {
          const parsed = JSON.parse(raw);
          value = typeof parsed === "string" ? parsed : raw;
        } catch {
          value = raw;
        }
      }
      frontmatter[field[1]] = value;
    }
  }
  return { frontmatter, body: match ? text.slice(match[0].length) : text };
}

export function checkTarget({ root, targetPath, standardId = null }) {
  if (!existsSync(targetPath) || !statSync(targetPath).isFile()) {
    throw new Error(`no such target file: ${targetPath}`);
  }
  const target = parseTarget(readFileSync(targetPath, "utf8"));

  const active = listActiveStandards(root);
  const selected = standardId ? active.filter((standard) => standard.id === standardId) : active;
  if (standardId && selected.length === 0) {
    throw new Error(`no active standard "${standardId}" under ${root}`);
  }

  const standards = [];
  const failures = [];
  const unchecked = [];
  const unproven = [];

  for (const standard of selected) {
    const checks = Array.isArray(standard.checks) ? standard.checks : [];
    if (checks.length === 0) {
      // Reported, never counted as a pass. A standard nobody can verify is the
      // thing this report exists to keep visible.
      unchecked.push(standard.id);
      standards.push({ id: standard.id, enforcement: standard.enforcement, results: [] });
      continue;
    }
    checks.forEach((check, index) => validateCheck(check, index));
    const results = checks.map((check, index) => runCheck(check, target, index));
    for (const result of results) {
      if (result.status === "fail") {
        failures.push({ standard: standard.id, checker: result.checker, reason: result.reason });
      } else if (result.status === "unproven") {
        unproven.push({ standard: standard.id, ask: result.ask });
      }
    }
    standards.push({ id: standard.id, enforcement: standard.enforcement, results });
  }

  return { target: targetPath, standards, failures, unchecked, unproven, ok: failures.length === 0 };
}

function render(report) {
  const lines = [];
  for (const failure of report.failures) {
    lines.push(`FAIL ${failure.standard} / ${failure.checker} — ${failure.reason}`);
  }
  for (const item of report.unproven) {
    lines.push(`UNPROVEN ${item.standard} — adversarial, needs an independent reviewer: ${item.ask}`);
  }
  for (const id of report.unchecked) {
    lines.push(`UNCHECKED ${id} — no checks on file, so nothing here verifies it`);
  }
  const checked = report.standards.length - report.unchecked.length;
  lines.push(
    report.ok
      ? `ok — ${checked} standard(s) checked, ${report.failures.length} failure(s)`
      : `${report.failures.length} failure(s) across ${checked} checked standard(s)`
  );
  return lines.join("\n");
}

export function runCli(argv = process.argv.slice(2), deps = {}) {
  const positionals = [];
  let standardId = null;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--json") json = true;
    else if (item === "--standard") {
      standardId = argv[i + 1];
      i += 1;
    } else if (item.startsWith("--standard=")) standardId = item.slice("--standard=".length);
    else positionals.push(item);
  }
  if (positionals.length === 0) throw new Error("standard-check requires a target path");

  const root =
    deps.root && !deps.useRealRootResolution
      ? deps.root
      : resolveProjectRoot({ env: deps.env || process.env, cwd: deps.cwd || process.cwd() });

  const report = checkTarget({ root, targetPath: positionals[0], standardId });
  process.stdout.write(`${json ? JSON.stringify(report, null, 2) : render(report)}\n`);
  return report;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  try {
    if (!runCli().ok) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
