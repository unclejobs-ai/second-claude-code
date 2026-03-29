#!/usr/bin/env node

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MmBridgeCliAdapter } from "../hooks/lib/mmbridge-adapter.mjs";
import { runFanoutRequest } from "./acpx-fanout.mjs";
import { renderSummaryFromManifest } from "./acpx-render-summary.mjs";
import { parseJsonArg, readJson, writeJson } from "./lib/acpx-runtime.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, "..");

function normalizeRequest(input) {
  if (typeof input?.task !== "string" || input.task.trim() === "") {
    throw new Error("task must be a non-empty string");
  }

  return {
    run_id: input.run_id,
    task: input.task.trim(),
    cwd: input.cwd || process.cwd(),
    output_dir: input.output_dir,
    acpx: input.acpx || {},
    mmbridge: {
      enabled: input.mmbridge?.enabled !== false,
      binary: input.mmbridge?.binary || "mmbridge",
      review_options: input.mmbridge?.review_options || { scope: "all" },
      gate_options: input.mmbridge?.gate_options || { mode: "review" },
    },
  };
}

export async function runHermesExternalRequest(input, options = {}) {
  const request = normalizeRequest(input);
  const fanout = await runFanoutRequest(
    {
      ...request.acpx,
      run_id: request.run_id,
      cwd: request.cwd,
      output_dir: request.output_dir,
      task: request.task,
    },
    { rootDir: options.rootDir || ROOT_DIR }
  );

  const manifestPath = fanout.manifest_path;
  const manifest = readJson(manifestPath);
  const implRole = manifest.roles.find((role) => role.role === "impl");

  if (!request.mmbridge.enabled) {
    manifest.mmbridge = {
      skipped: true,
      reason: "disabled",
    };
    writeJson(manifestPath, manifest);
    const summary = renderSummaryFromManifest(manifestPath);
    return {
      ...fanout,
      mmbridge: manifest.mmbridge,
      summary_path: summary.summary_path,
    };
  }

  if (!implRole?.ok) {
    manifest.mmbridge = {
      skipped: true,
      reason: "impl failed",
    };
    writeJson(manifestPath, manifest);
    const summary = renderSummaryFromManifest(manifestPath);
    return {
      ...fanout,
      mmbridge: manifest.mmbridge,
      summary_path: summary.summary_path,
    };
  }

  const adapter = options.mmbridgeAdapter || new MmBridgeCliAdapter({
    binary: request.mmbridge.binary,
  });
  const [review, gate] = await Promise.all([
    adapter.review(request.mmbridge.review_options),
    adapter.gate(request.mmbridge.gate_options),
  ]);

  writeJson(join(fanout.output_dir, "mmbridge-review.json"), review);
  writeJson(join(fanout.output_dir, "mmbridge-gate.json"), gate);

  manifest.mmbridge = {
    skipped: false,
    review,
    gate,
  };
  writeJson(manifestPath, manifest);
  const summary = renderSummaryFromManifest(manifestPath);

  return {
    ...fanout,
    mmbridge: manifest.mmbridge,
    summary_path: summary.summary_path,
  };
}

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/hermes-external-run.mjs run '<json>'",
    ].join("\n")
  );
}

async function main() {
  const [, , command, raw] = process.argv;
  if (command !== "run") {
    usage();
    process.exit(1);
  }

  const request = parseJsonArg(raw, "hermes external request");
  const result = await runHermesExternalRequest(request);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
