import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const hookPath = path.join(root, "hooks", "prompt-detect.mjs");
const emptyPluginsRoot = path.join(root, "tests", "fixtures", "empty-plugins-root");

function runPrompt(userPrompt, env = {}) {
  return execFileSync(process.execPath, [hookPath], {
    cwd: root,
    env: {
      ...process.env,
      __SCC_TEST_PLUGINS_ROOT: emptyPluginsRoot,
      ...env,
      USER_PROMPT: userPrompt,
    },
    encoding: "utf8",
  });
}

function runPromptPayload(payload, env = {}) {
  const childEnv = {
    ...process.env,
    __SCC_TEST_PLUGINS_ROOT: emptyPluginsRoot,
    ...env,
  };
  delete childEnv.USER_PROMPT;

  return execFileSync(process.execPath, [hookPath], {
    cwd: root,
    env: childEnv,
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
}

function assertRoutesTo(output, skill) {
  assert.match(output, new RegExp(`skill: \\\\\"scc:${skill}\\\\\"`));
}

function setupPluginsRoot() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "scc-prompt-test-"));
  const pluginsDir = path.join(tmp, ".claude", "plugins");
  mkdirSync(pluginsDir, { recursive: true });
  return { tmp, pluginsDir };
}

function createMockPlugin(pluginsDir, name, opts = {}) {
  const { skills = [], commands = [], description = "", version = "1.0.0" } = opts;
  const pluginRoot = path.join(pluginsDir, "cache", "test", name, version);
  mkdirSync(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  writeFileSync(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name, version, description }, null, 2),
    "utf8"
  );

  for (const s of skills) {
    const skillDir = path.join(pluginRoot, "skills", s.name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      path.join(skillDir, "SKILL.md"),
      `---\nname: ${s.name}\ndescription: "${s.description}"\n---\n`,
      "utf8"
    );
  }

  if (commands.length > 0) {
    const commandsDir = path.join(pluginRoot, "commands");
    mkdirSync(commandsDir, { recursive: true });
    for (const c of commands) {
      writeFileSync(
        path.join(commandsDir, `${c.name}.md`),
        `---\ndescription: "${c.description}"\n---\n`,
        "utf8"
      );
    }
  }

  return pluginRoot;
}

function writeInstalledPlugins(pluginsDir, entries) {
  const plugins = {};
  for (const e of entries) {
    plugins[e.id] = [
      {
        scope: "user",
        installPath: e.installPath,
        version: e.version || "1.0.0",
        installedAt: "2026-05-01T00:00:00.000Z",
        lastUpdated: "2026-05-01T00:00:00.000Z",
      },
    ];
  }
  writeFileSync(
    path.join(pluginsDir, "installed_plugins.json"),
    JSON.stringify({ version: 2, plugins }, null, 2),
    "utf8"
  );
}

// ── Existing single-skill routing tests ──

test("prompt detect routes review prompts to /scc:review", () => {
  const output = runPrompt("quality check this document");
  assertRoutesTo(output, "review");
});

test("prompt detect routes writing prompts to /scc:write", () => {
  const output = runPrompt("write a newsletter");
  assertRoutesTo(output, "write");
});

test("prompt detect routes current UserPromptSubmit stdin payloads", () => {
  const output = runPromptPayload({
    hook_event_name: "UserPromptSubmit",
    prompt: "write a newsletter",
  });

  assertRoutesTo(output, "write");
});

test("prompt detect prioritizes review for mixed report-quality prompts", () => {
  const output = runPrompt("review this report for quality");
  assertRoutesTo(output, "review");
});

test("prompt detect still routes Korean review prompts without Hangul literals in source", () => {
  const output = runPrompt("이거 리뷰해");
  assertRoutesTo(output, "review");
});

test("prompt detect routes workflow scheduling prompts to /scc:workflow", () => {
  const output = runPrompt("schedule this workflow every morning");
  assertRoutesTo(output, "workflow");
});

test("prompt detect routes background workflow prompts to /scc:workflow", () => {
  const output = runPrompt("run this workflow in background");
  assertRoutesTo(output, "workflow");
});

test("prompt detect routes session recall prompts to /scc:workflow", () => {
  const output = runPrompt("search session recall for Hermes adoption");
  assertRoutesTo(output, "workflow");
});

test("prompt detect routes root-cause debugging prompts to /scc:investigate", () => {
  const output = runPrompt("investigate the root cause of conflicting claims in this report");
  assertRoutesTo(output, "investigate");
});

test("prompt detect keeps code bug prompts on development guidance", () => {
  const output = runPrompt("fix this bug in src/app.js");
  assert.doesNotMatch(output, /skill: \\\"scc:investigate\\\"/);
});

test("prompt detect routes general investigate prompts to /scc:research", () => {
  const output = runPrompt("investigate ai market trends");
  assertRoutesTo(output, "research");
});

// ── PDCA compound pattern tests ──

test("PDCA: Korean compound '알아보고' routes to full PDCA", () => {
  const output = runPrompt("AI 에이전트에 대해 알아보고 보고서 써줘");
  assertRoutesTo(output, "pdca");
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: Korean compound '조사해서' routes to full PDCA", () => {
  const output = runPrompt("시장 동향 조사해서 정리해줘");
  assertRoutesTo(output, "pdca");
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: English 'research and write' routes to full PDCA", () => {
  const output = runPrompt("research and write a report on AI agents");
  assertRoutesTo(output, "pdca");
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: English 'review and improve' routes to check+act", () => {
  const output = runPrompt("review and improve this draft");
  assertRoutesTo(output, "pdca");
  assert.match(output, /Check→Act cycle/);
});

test("PDCA: Korean '검토하고 고쳐' routes to check+act", () => {
  const output = runPrompt("이 초안 검토하고 고쳐줘");
  assertRoutesTo(output, "pdca");
  assert.match(output, /Check→Act cycle/);
});

test("PDCA: 'end-to-end' routes to full PDCA", () => {
  const output = runPrompt("do an end-to-end analysis of the cloud market");
  assertRoutesTo(output, "pdca");
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: 'comprehensive report' routes to full PDCA", () => {
  const output = runPrompt("write a comprehensive report on competitor landscape");
  assertRoutesTo(output, "pdca");
  assert.match(output, /full PDCA cycle/);
});

test("PDCA: compound patterns take priority over single-skill patterns", () => {
  // "research and write" should match PDCA, not individual research or write
  const output = runPrompt("research and write about the future of AI");
  assertRoutesTo(output, "pdca");
  // Should NOT match individual skills
  assert.doesNotMatch(output, /skill: \\"scc:research\\"/);
  assert.doesNotMatch(output, /skill: \\"scc:write\\"/);
});

test("PDCA: single-skill prompts still route to individual skills, not PDCA", () => {
  const output = runPrompt("research the AI market");
  assertRoutesTo(output, "research");
  assert.doesNotMatch(output, /skill: \\"scc:pdca\\"/);
});

test("PDCA: slash commands are skipped entirely", () => {
  const output = runPrompt("/scc:review my draft");
  assert.equal(output.trim(), "");
});

test("PDCA: slash commands in stdin payloads are skipped entirely", () => {
  const output = runPromptPayload({
    hook_event_name: "UserPromptSubmit",
    prompt: "/scc:review my draft",
  });

  assert.equal(output.trim(), "");
});

test("engineering prompt with end-to-end analysis does not misroute to PDCA", () => {
  const output = runPrompt("do an end-to-end analysis of our failing auth flow");
  assert.doesNotMatch(output, /skill: \\"scc:pdca\\"/);
});

test("engineering prompt with iterate until tests pass does not misroute to refine", () => {
  const output = runPrompt("iterate until the tests pass in this repo");
  assert.doesNotMatch(output, /skill: \\"scc:refine\\"/);
});

test("engineering prompt with CI deployment workflow does not misroute to workflow", () => {
  const output = runPrompt("automate this workflow in our CI deployment pipeline");
  assert.doesNotMatch(output, /skill: \\"scc:workflow\\"/);
});

test("external dispatch: Korean review prompt routes to coderabbit before internal review", () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const coderabbit = createMockPlugin(pluginsDir, "coderabbit", {
    description: "AI code review tool",
    skills: [
      { name: "autofix", description: "Safely review and apply CodeRabbit PR feedback" },
      { name: "code-review", description: "AI-powered code review using CodeRabbit" },
    ],
    commands: [
      { name: "coderabbit-review", description: "Run CodeRabbit review" },
    ],
  });
  writeInstalledPlugins(pluginsDir, [{ id: "coderabbit@test", installPath: coderabbit }]);

  try {
    const output = runPrompt("리뷰해줘", { __SCC_TEST_PLUGINS_ROOT: pluginsDir });
    assert.match(output, /External capability selected for review/);
    assert.match(output, /coderabbit:code-review/);
    assert.doesNotMatch(output, /scc:review/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("external dispatch: Korean commit prompt routes to commit-commands", () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const commitCommands = createMockPlugin(pluginsDir, "commit-commands", {
    description: "Git commit helper commands",
    commands: [
      { name: "commit-push-pr", description: "Commit, push, and open PR" },
      { name: "commit", description: "Create a git commit" },
    ],
  });
  writeInstalledPlugins(pluginsDir, [{ id: "commit-commands@test", installPath: commitCommands }]);

  try {
    const output = runPrompt("커밋해줘", { __SCC_TEST_PLUGINS_ROOT: pluginsDir });
    assert.match(output, /External capability selected for commit/);
    assert.match(output, /\/commit-commands:commit/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("external dispatch: design improvement prompt routes to frontend-design", () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const frontendDesign = createMockPlugin(pluginsDir, "frontend-design", {
    description: "Create production-grade frontend interfaces with high design quality",
    skills: [
      { name: "frontend-design", description: "Create distinctive frontend UI and application designs" },
    ],
  });
  writeInstalledPlugins(pluginsDir, [{ id: "frontend-design@test", installPath: frontendDesign }]);

  try {
    const output = runPrompt("디자인 개선해줘", { __SCC_TEST_PLUGINS_ROOT: pluginsDir });
    assert.match(output, /External capability selected for frontend-design/);
    assert.match(output, /frontend-design:frontend-design/);
    assert.doesNotMatch(output, /scc:refine/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("external dispatch: Korean research prompt routes to claude-mem knowledge-agent", () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const claudeMem = createMockPlugin(pluginsDir, "claude-mem", {
    description: "Persistent memory and knowledge agents",
    skills: [
      { name: "mem-search", description: "Search persistent cross-session memory database" },
      { name: "knowledge-agent", description: "Build and query AI-powered knowledge bases from claude-mem observations" },
    ],
  });
  writeInstalledPlugins(pluginsDir, [{ id: "claude-mem@test", installPath: claudeMem }]);

  try {
    const output = runPrompt("조사해줘", { __SCC_TEST_PLUGINS_ROOT: pluginsDir });
    assert.match(output, /External capability selected for memory-research/);
    assert.match(output, /claude-mem:knowledge-agent/);
    assert.doesNotMatch(output, /scc:research/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("external dispatch: strong generic match routes to installed plugin skill", () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const posthog = createMockPlugin(pluginsDir, "posthog", {
    description: "Product analytics and event analysis",
    skills: [
      { name: "exploring-autocapture-events", description: "Analyze PostHog autocapture events and product analytics" },
    ],
  });
  writeInstalledPlugins(pluginsDir, [{ id: "posthog@test", installPath: posthog }]);

  try {
    const output = runPrompt("posthog event analysis", { __SCC_TEST_PLUGINS_ROOT: pluginsDir });
    assert.match(output, /External capability selected for generic/);
    assert.match(output, /posthog:exploring-autocapture-events/);
    assert.doesNotMatch(output, /scc:/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("external dispatch: code bug prompt does not match debugging by substring", () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const agentTeams = createMockPlugin(pluginsDir, "agent-teams", {
    description: "Team coordination helpers",
    skills: [
      { name: "parallel-debugging", description: "Coordinate multiple agents for debugging complex issues" },
    ],
  });
  writeInstalledPlugins(pluginsDir, [{ id: "agent-teams@test", installPath: agentTeams }]);

  try {
    const output = runPrompt("fix this bug in src/app.js", { __SCC_TEST_PLUGINS_ROOT: pluginsDir });
    assert.doesNotMatch(output, /External capability selected/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("following an auto-routed command does not log a routing correction", () => {
  const { tmp, pluginsDir } = setupPluginsRoot();
  const commitCommands = createMockPlugin(pluginsDir, "commit-commands", {
    description: "Git commit helper commands",
    commands: [{ name: "commit", description: "Create a git commit" }],
  });
  writeInstalledPlugins(pluginsDir, [{ id: "commit-commands@test", installPath: commitCommands }]);

  const dataDir = path.join(tmp, "data");
  mkdirSync(path.join(dataDir, "soul"), { recursive: true });
  writeFileSync(
    path.join(dataDir, "soul", "soul-active.json"),
    JSON.stringify({ mode: "learning" }),
    "utf8"
  );
  const env = { __SCC_TEST_PLUGINS_ROOT: pluginsDir, CLAUDE_PLUGIN_DATA: dataDir };

  try {
    // The router suggests /commit-commands:commit and records it as the last auto-route.
    const routed = runPrompt("커밋해줘", env);
    assert.match(routed, /\/commit-commands:commit/);

    // Obeying that suggestion is agreement, not a correction. The stored route used to keep its
    // leading slash while the check strips one, so every obedient user logged a false correction.
    runPrompt("/commit-commands:commit", env);

    const obsDir = path.join(dataDir, "soul", "observations");
    const logged = existsSync(obsDir)
      ? readdirSync(obsDir)
          .flatMap((f) => readFileSync(path.join(obsDir, f), "utf8").split("\n"))
          .filter((line) => line.includes("routing_correction"))
      : [];
    assert.deepEqual(logged, []);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("a preference override drops the pin so other plugins can compete", () => {
  // INTENT_PROFILES pins review to coderabbit and the pin is worth +60, so a reviewer you prefer
  // could never outrank it without editing source. An empty override removes the pin, which is what
  // makes "runtime discovery" true for the one part of routing that is not discovered.
  //
  // A mock plugin root, not the real one: keying this off whatever happens to be installed would
  // make the test pass by measuring nothing on a machine without coderabbit.
  const { tmp, pluginsDir } = setupPluginsRoot();
  const rabbit = createMockPlugin(pluginsDir, "coderabbit", {
    description: "Review code quality and find bugs",
    skills: [{ name: "code-review", description: "Review code quality, security, and bugs" }],
  });
  writeInstalledPlugins(pluginsDir, [{ id: "coderabbit@test", installPath: rabbit }]);

  const scoreWith = (overrides) => {
    const dataDir = path.join(tmp, overrides ? "with" : "without");
    mkdirSync(dataDir, { recursive: true });
    if (overrides) {
      writeFileSync(path.join(dataDir, "plugin-preferences.json"), JSON.stringify(overrides), "utf8");
    }
    const out = execFileSync(
      process.execPath,
      ["--input-type=module", "-e",
       "const m = await import('./hooks/lib/plugin-discovery.mjs');" +
       "const p = m.getDispatchPlan({keyword:'review this code'});" +
       "console.log((p.routes||[]).find(r=>r.plugin==='coderabbit')?.score ?? 0);"],
      { cwd: root, encoding: "utf8",
        env: { ...process.env, __SCC_TEST_PLUGINS_ROOT: pluginsDir, CLAUDE_PLUGIN_DATA: dataDir } }
    );
    return Number(out.trim());
  };

  try {
    const pinned = scoreWith(null);
    assert.ok(pinned > 0, "the mock coderabbit should be discovered and scored");
    assert.equal(pinned - scoreWith({ review: [] }), 60, "clearing the override removes the +60 pin");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
