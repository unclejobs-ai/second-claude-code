import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const pluginDir = root;
const baseArgs = [
  "-p",
  "--setting-sources",
  "local",
  "--strict-mcp-config",
  "--model",
  "haiku",
  "--plugin-dir",
  pluginDir,
];
const enabled = process.env.RUN_CLAUDE_CLI_E2E === "1";

function runClaude(prompt, timeout = 45000) {
  return execFileSync("claude", [...baseArgs, prompt], {
    cwd: root,
    encoding: "utf8",
    timeout,
  });
}

if (!enabled) {
  test("Claude CLI E2E smoke is skipped unless RUN_CLAUDE_CLI_E2E=1", { skip: true }, () => {});
} else {
  test("slash commands are registered under /scc:*", () => {
    const output = runClaude(
      "List available slash commands from loaded plugins. Reply with only /scc:* lines.",
      20000
    );

    for (const command of [
      "/scc:batch",
      "/scc:soul",
      "/scc:loop",
      "/scc:pdca",
      "/scc:research",
      "/scc:write",
      "/scc:analyze",
      "/scc:review",
      "/scc:refine",
      "/scc:collect",
      "/scc:workflow",
      "/scc:discover",
      "/scc:investigate",
      "/scc:translate",
      "/scc:viewer",
    ]) {
      assert.match(output, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  test("review command returns a real review report", () => {
    const output = runClaude(
      "/scc:review README.md --preset quick"
    );

    assert.match(output, /REVIEW REPORT|Verdict|Consensus/i);
    assert.doesNotMatch(output, /Unknown skill/i);
    assert.doesNotMatch(output, /I(?:'ve| have) already invoked/i);
    assert.doesNotMatch(output, /The skill is running/i);
  });

  test("analyze command returns a real SWOT analysis", () => {
    const output = runClaude(
      '/scc:analyze swot "scc plugin repo"'
    );

    assert.match(output, /SWOT Analysis|STRENGTHS|WEAKNESSES/i);
    assert.doesNotMatch(output, /Unknown skill/i);
    assert.doesNotMatch(output, /I(?:'ve| have) already invoked/i);
    assert.doesNotMatch(output, /The skill is running/i);
  });

  test("write command returns actual content", () => {
    const output = runClaude(
      '/scc:write social "Why skill packs need tests" --skip-research --skip-review --lang en'
    );

    assert.match(output, /Why skill packs need tests/i);
    assert.doesNotMatch(output, /Unknown skill/i);
    assert.doesNotMatch(output, /I(?:'ve| have) invoked/i);
    assert.doesNotMatch(output, /The skill is running/i);
  });
}
