import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  return readFileSync(path.join(root, relPath), "utf8");
}

function runPrompt(userPrompt) {
  return execFileSync(process.execPath, [path.join(root, "hooks", "prompt-detect.mjs")], {
    cwd: root,
    env: {
      ...process.env,
      USER_PROMPT: userPrompt,
    },
    encoding: "utf8",
  });
}

function findAgentFileByName(expectedName) {
  const agentsDir = path.join(root, "agents");
  for (const fileName of readdirSync(agentsDir)) {
    if (!fileName.endsWith(".md")) continue;
    const content = read(path.join("agents", fileName));
    if (new RegExp(`^name:\\s*${expectedName}$`, "m").test(content)) {
      return path.join("agents", fileName);
    }
  }
  return null;
}

function assertPromptRoutes(output, command) {
  assert.match(
    output,
    new RegExp(`skill: \\\\\"second-claude-code:${command}\\\\\"`),
    `prompt should route to ${command}`
  );
}

test("natural-language prompts resolve to command docs and backing skills", () => {
  const cases = [
    { prompt: "research the AI agent market", command: "research" },
    { prompt: "write a newsletter about AI agents", command: "write" },
    { prompt: "run a swot on this SaaS product", command: "analyze" },
    { prompt: "review this draft for quality", command: "review" },
    { prompt: "iterate until this is better", command: "refine" },
    { prompt: "save this URL to my notes", command: "collect" },
    { prompt: "automate this workflow as a pipeline", command: "workflow" },
    { prompt: "find a skill for terraform security audit", command: "discover" },
  ];

  for (const testCase of cases) {
    const output = runPrompt(testCase.prompt);
    assertPromptRoutes(output, testCase.command);

    const commandDoc = read(path.join("commands", `${testCase.command}.md`));
    assert.match(commandDoc, new RegExp(`loaded \`${testCase.command}\` skill`, "i"));
    assert.doesNotMatch(commandDoc, /Use the Skill tool to invoke/i);

    const skillPath = path.join(root, "skills", testCase.command, "SKILL.md");
    assert.equal(existsSync(skillPath), true, `${testCase.command} skill should exist`);
    assert.match(read(path.join("skills", testCase.command, "SKILL.md")), new RegExp(`name: ${testCase.command}`));
  }
});

test("write advertised formats and voices have concrete backing references", () => {
  const commandDoc = read("commands/write.md");
  const skillDoc = read("skills/write/SKILL.md");
  const writerAgentPath = findAgentFileByName("writer");
  assert.ok(writerAgentPath, "writer agent definition should exist");
  const writerAgent = read(writerAgentPath);

  const formatMatch = commandDoc.match(/format \(([^)]+)\)/);
  assert.ok(formatMatch, "write command should list supported formats");
  const formats = formatMatch[1].split("|");

  const referenceBackedFormats = ["newsletter", "article", "shorts", "report", "social", "card-news"];
  assert.deepEqual(formats, referenceBackedFormats);

  for (const format of referenceBackedFormats) {
    assert.match(skillDoc, new RegExp(`\`${format}\``), `${format} should be documented in the write skill`);
    if (["newsletter", "article", "shorts", "report", "social", "card-news"].includes(format)) {
      const refPath = path.join(root, "skills", "write", "references", "formats", `${format}.md`);
      assert.equal(existsSync(refPath), true, `${format} format guide should exist`);
    }
  }

  for (const voice of ["peer-mentor", "expert", "casual"]) {
    const voicePath = path.join(root, "skills", "write", "references", "voice-guides", `${voice}.md`);
    assert.equal(existsSync(voicePath), true, `${voice} voice guide should exist`);
    assert.match(skillDoc, new RegExp(`\`${voice}\``), `${voice} should be documented in the write skill`);
  }

  assert.match(writerAgent, /Social post/);
  assert.match(writerAgent, /Card news/);
});

test("state-manager written state flows through session start and session end hooks", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "second-claude-integration-"));
  const env = {
    ...process.env,
    CLAUDE_PLUGIN_DATA: tempDir,
  };
  const stateManager = path.join(root, "scripts", "state-manager.sh");
  const sessionStart = path.join(root, "hooks", "session-start.mjs");
  const sessionEnd = path.join(root, "hooks", "session-end.mjs");

  execFileSync(
    "bash",
    [stateManager, "write", "refine-active", '{"goal":"Polish the brief","current_iteration":1,"max":3,"scores":[3.7]}'],
    { cwd: root, env, encoding: "utf8" }
  );
  execFileSync(
    "bash",
    [stateManager, "write", "workflow-active", '{"name":"autopilot","current_step":2,"total_steps":5,"status":"running"}'],
    { cwd: root, env, encoding: "utf8" }
  );
  execFileSync(
    "bash",
    [stateManager, "write", "loop-active", '{"run_id":"loop-write-core-20260326","suite":"write-core","generation":1,"max_generations":3,"status":"running"}'],
    { cwd: root, env, encoding: "utf8" }
  );

  const startOutput = execFileSync(process.execPath, [sessionStart], {
    cwd: root,
    env,
    encoding: "utf8",
  });
  assert.match(startOutput, /Active refine: "Polish the brief" \(iteration 1\/3\)/);
  assert.match(startOutput, /Active loop: "write-core" \(generation 1\/3, status: running\)/);
  assert.match(startOutput, /Active workflow: "autopilot" \(step 2\/5\)/);

  const endResult = spawnSync(process.execPath, [sessionEnd], {
    cwd: root,
    env,
    encoding: "utf8",
  });
  assert.match(endResult.stderr || "", /HANDOFF\.md saved/);

  const handoff = readFileSync(path.join(tempDir, "HANDOFF.md"), "utf8");
  assert.match(handoff, /Goal: Polish the brief/);
  assert.match(handoff, /Suite: write-core/);
  assert.match(handoff, /Progress: step 2\/5/);
  assert.match(handoff, /\/second-claude-code:loop resume loop-write-core-20260326/);
  assert.match(handoff, /re-run.*\/second-claude-code:refine/);
  assert.match(handoff, /\/second-claude-code:workflow run autopilot/);
});
