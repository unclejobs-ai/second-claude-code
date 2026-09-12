import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const commandDir = path.join(root, "commands");
const runtimeFallback = "${CLAUDE_PLUGIN_DATA:-${CLAUDE_PLUGIN_ROOT}/.data}";

const stateContexts = new Map([
  ["pdca", "pdca-active.json"],
  ["loop", "loop-active.json"],
  ["workflow", "workflow-active.json"],
  ["refine", "refine-active.json"],
  ["evolve", "loop-active.json"],
  ["viewer", "pdca-active.json"],
]);

function inlineCommand(markdown, label) {
  const line = markdown
    .split("\n")
    .find((candidate) => candidate.includes(label) && candidate.includes("!`"));
  assert.ok(line, `missing inline context: ${label}`);
  const match = line.match(/!`([^`]+)`/);
  assert.ok(match, `inline context is not executable: ${label}`);
  return match[1];
}

function runInline(command, cwd, env) {
  return spawnSync("sh", ["-c", command], {
    cwd,
    env,
    encoding: "utf8",
  });
}

function fixtureDataDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "scc-command-runtime-"));
  mkdirSync(path.join(dir, "state"), { recursive: true });
  return dir;
}

test("command state contexts resolve a CLAUDE_PLUGIN_DATA fixture", () => {
  const dataDir = fixtureDataDir();
  try {
    mkdirSync(path.join(dataDir, "soul"), { recursive: true });
    for (const file of new Set(stateContexts.values())) {
      writeFileSync(path.join(dataDir, "state", file), JSON.stringify({ fixture: file }));
    }
    writeFileSync(path.join(dataDir, "state", "batch-fixture.json"), "{}\n");
    writeFileSync(path.join(dataDir, "soul", "SOUL.md"), "# Fixture Soul\nVisible fixture\n");
    mkdirSync(path.join(dataDir, "soul", "observations"), { recursive: true });
    writeFileSync(path.join(dataDir, "soul", "observations", "2026-01-01.jsonl"), '{"n":1}\n{"n":2}\n');
    writeFileSync(
      path.join(dataDir, "state", "review-aggregation-review-fixture.json"),
      JSON.stringify({ fixture: "review" })
    );
    writeFileSync(
      path.join(dataDir, "state", "review-aggregation-review-fixture--prompt-fixture.json"),
      JSON.stringify({ fixture: "prompt review" })
    );

    const env = {
      ...process.env,
      CLAUDE_PLUGIN_DATA: dataDir,
      CLAUDE_PLUGIN_ROOT: root,
      CLAUDE_SESSION_ID: "review-fixture",
      CLAUDE_PROMPT_ID: "",
    };

    for (const [commandName, stateFile] of stateContexts) {
      const markdown = readFileSync(path.join(commandDir, `${commandName}.md`), "utf8");
      const command = inlineCommand(markdown, commandName === "viewer" ? "Current PDCA state" : "Active");
      assert.match(
        command,
        new RegExp(runtimeFallback.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `${commandName} must honor plugin data`
      );
      const result = runInline(command, root, env);
      assert.equal(result.status, 0, `${commandName}: ${result.stderr}`);
      assert.match(result.stdout, new RegExp(stateFile.replaceAll(".", "\\.")), `${commandName} fixture not visible`);
    }

    const review = readFileSync(path.join(commandDir, "review.md"), "utf8");
    const reviewResult = runInline(inlineCommand(review, "Active review state"), root, env);
    assert.equal(reviewResult.status, 0, reviewResult.stderr);
    assert.match(reviewResult.stdout, /review/, "review namespace fixture was not visible");
    const promptReviewResult = runInline(
      inlineCommand(review, "Active review state"),
      root,
      { ...env, CLAUDE_PROMPT_ID: "prompt-fixture" }
    );
    assert.equal(promptReviewResult.status, 0, promptReviewResult.stderr);
    assert.match(promptReviewResult.stdout, /prompt review/, "review prompt namespace fixture was not visible");

    const batch = readFileSync(path.join(commandDir, "batch.md"), "utf8");
    const batchResult = runInline(inlineCommand(batch, "Active batch runs"), root, env);
    assert.equal(batchResult.status, 0, batchResult.stderr);
    assert.match(batchResult.stdout, /1/, "batch fixture state was not counted");

    const soul = readFileSync(path.join(commandDir, "soul.md"), "utf8");
    const soulResult = runInline(inlineCommand(soul, "Current soul"), root, env);
    assert.equal(soulResult.status, 0, soulResult.stderr);
    assert.match(soulResult.stdout, /Fixture Soul/);
    const observationsResult = runInline(inlineCommand(soul, "Observation count"), root, env);
    assert.equal(observationsResult.status, 0, observationsResult.stderr);
    assert.match(observationsResult.stdout, /2/);

    const translate = readFileSync(path.join(commandDir, "translate.md"), "utf8");
    const translateResult = runInline(inlineCommand(translate, "Current soul"), root, env);
    assert.equal(translateResult.status, 0, translateResult.stderr);
    assert.match(translateResult.stdout, /Fixture Soul/);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test("command state contexts retain the CLAUDE_PLUGIN_ROOT/.data runtime fallback", () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "scc-command-fallback-"));
  try {
    mkdirSync(path.join(cwd, ".data", "state"), { recursive: true });
    writeFileSync(path.join(cwd, ".data", "state", "pdca-active.json"), '{"fallback":true}\n');
    const { CLAUDE_PLUGIN_DATA: _pluginData, ...envWithoutPluginData } = process.env;
    envWithoutPluginData.CLAUDE_PLUGIN_ROOT = cwd;
    const markdown = readFileSync(path.join(commandDir, "pdca.md"), "utf8");
    const result = runInline(inlineCommand(markdown, "Active PDCA state"), cwd, envWithoutPluginData);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /fallback/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("every command .data reference uses the runtime fallback contract", () => {
  const escapedFallback = new RegExp(runtimeFallback.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  for (const file of readdirSync(commandDir).filter((name) => name.endsWith(".md"))) {
    const markdown = readFileSync(path.join(commandDir, file), "utf8");
    for (const [lineNumber, line] of markdown.split("\n").entries()) {
      if (line.includes(".data")) {
        assert.match(line, escapedFallback, `${file}:${lineNumber + 1} bypasses plugin data fallback`);
      }
    }
  }
});

test("review context follows the session namespace and never reads the fixed legacy file", () => {
  const markdown = readFileSync(path.join(commandDir, "review.md"), "utf8");
  const command = inlineCommand(markdown, "Active review state");
  assert.match(command, /CLAUDE_SESSION_ID/);
  assert.match(command, /review-aggregation-\"\+namespace/);
  assert.doesNotMatch(command, /review-aggregation\.json/);
  assert.doesNotMatch(markdown, /cat \.data\/state\/review-aggregation/);
});
