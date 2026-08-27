import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  return readFileSync(path.join(root, relPath), "utf8");
}

function markdownFilesUnder(relPath) {
  const start = path.join(root, relPath);
  const files = [];
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      if (entry.isFile() && entry.name.endsWith(".md")) files.push(fullPath);
    }
  }
  return files;
}

// Commands and skills are no longer the same list. A command with no skill is a
// tool -- it executes and makes no judgment, so it does not spend a slot in the
// skill list. A skill without a command would be unreachable, and stays banned.
const TOOL_ONLY_COMMANDS = ["standard-check", "unblock", "viewer"];

test("every skill has a command, and the tool-only commands have no skill", () => {
  assert.ok(existsSync(path.join(root, "commands", "coach.md")));
  assert.ok(existsSync(path.join(root, "skills", "coach", "SKILL.md")));

  const commands = readdirSync(path.join(root, "commands"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
  const skills = readdirSync(path.join(root, "skills"))
    .filter((name) => existsSync(path.join(root, "skills", name, "SKILL.md")))
    .toSorted();

  for (const skill of skills) {
    assert.ok(commands.includes(skill), `skill "${skill}" has no command and cannot be reached`);
  }
  assert.deepEqual(
    commands.filter((name) => !skills.includes(name)),
    TOOL_ONLY_COMMANDS,
    "a command with no skill must be one of the declared tools"
  );

  const manifest = JSON.parse(read(".claude-plugin/plugin.json"));
  const agentCount = readdirSync(path.join(root, "agents"))
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .length;
  assert.match(manifest.description, new RegExp(`${skills.length} skills`));
  assert.match(manifest.description, new RegExp(`${agentCount} agents`));
});

// marketplace.json sat at "18 skills" through a release that shipped 15,
// because the count check only ever looked at the docs.
test("every shipped manifest agrees with the skill count on disk and with each other", () => {
  const skillCount = readdirSync(path.join(root, "skills")).filter((name) =>
    existsSync(path.join(root, "skills", name, "SKILL.md"))
  ).length;

  const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
  const marketplace = JSON.parse(read(".claude-plugin/marketplace.json"));
  const pkg = JSON.parse(read("package.json"));

  const descriptions = [
    plugin.description,
    marketplace.metadata?.description,
    ...(marketplace.plugins || []).map((entry) => entry.description),
  ].filter(Boolean);
  assert.ok(descriptions.length >= 3, "expected a description on the plugin and both marketplace entries");
  for (const description of descriptions) {
    assert.match(description, new RegExp(`${skillCount} skills`), `"${description.slice(0, 40)}…" is stale`);
  }

  const versions = [
    plugin.version,
    pkg.version,
    marketplace.metadata?.version,
    ...(marketplace.plugins || []).map((entry) => entry.version),
  ].filter(Boolean);
  assert.equal(new Set(versions).size, 1, `manifest versions disagree: ${versions.join(", ")}`);
});

test("investigate is gone from every surface, not just from skills/", () => {
  for (const surface of ["skills/investigate", "commands/investigate.md", "docs/skills/investigate.md"]) {
    assert.equal(existsSync(path.join(root, surface)), false, `${surface} should be deleted`);
  }
});

// The six soul_* tools shipped with no caller, while the skill hand-rolled the
// same operations against a different layout: `observations.jsonl` and
// `meta.json`, which neither the hooks nor the handlers have ever read or
// written. Two half-features that could not see each other.
test("the soul skill drives the soul_* tools instead of a second storage layout", () => {
  const server = read("mcp/pdca-state-server.mjs");
  const soulTools = [...new Set([...server.matchAll(/name:\s*"(soul_[a-z_]+)"/g)].map((m) => m[1]))];
  assert.ok(soulTools.length >= 6, "expected the soul tool family to be registered");

  const skill = read("skills/soul/SKILL.md");
  for (const tool of soulTools) {
    assert.match(skill, new RegExp(tool), `skills/soul/SKILL.md should drive ${tool}`);
  }
  for (const orphanPath of ["observations.jsonl", "meta.json"]) {
    assert.doesNotMatch(
      skill,
      new RegExp(orphanPath.replace(".", "\\.")),
      `the skill must not prescribe ${orphanPath} — nothing else reads or writes it`
    );
  }
});

// PDCA chains its sub-skills by slash command, so the skills it dispatches have
// to stay reachable. Only the maintainer loops, which nothing chains to and
// which both READMEs already promise are never auto-routed, are pinned shut.
test("only the maintainer loops are marked user-invoked", () => {
  const userInvoked = [];
  for (const name of readdirSync(path.join(root, "skills"))) {
    const file = path.join(root, "skills", name, "SKILL.md");
    if (!existsSync(file)) continue;
    if (/^disable-model-invocation:\s*true$/m.test(readFileSync(file, "utf8"))) userInvoked.push(name);
  }
  assert.deepEqual(userInvoked.sort(), ["evolve", "loop"]);
});

// The map pointed at skills/investigate/SKILL.md for a release after nothing
// read it. A dangling target makes the loop evolve a file that is not there.
test("every evolve asset-map target resolves to a file that exists", () => {
  const map = JSON.parse(read("config/evolve-asset-map.json"));
  const targets = [...Object.values(map.gate_rule), ...Object.values(map.phase), map.fallback];
  for (const target of targets) {
    assert.equal(existsSync(path.join(root, target)), true, `asset-map target ${target} does not exist`);
  }
});

test("coach command, skill, and docs expose a self-serve pending-approval path", () => {
  const command = read("commands/coach.md");
  const skill = read("skills/coach/SKILL.md");
  const docs = read("docs/skills/coach.md");

  for (const [label, content] of Object.entries({ command, skill, docs })) {
    assert.match(content, /coach-runner\.mjs/, `${label} should document the runner path`);
    assert.match(content, /approval/i, `${label} should document approval gating`);
    assert.match(content, /\.scc\/standards\//, `${label} should document where a settled fork lands`);
    assert.match(content, /record-fork/, `${label} should name the command that records a fork`);
    // ralplan, ultragoal and team are commands this plugin has never had. They shipped in the
    // ported prose and were documented as approval options for three releases.
    assert.doesNotMatch(content, /ralplan|ultragoal/i, `${label} must not offer commands this plugin lacks`);
    assert.doesNotMatch(content, /\.gjc\//, `${label} must not revive the .gjc namespace`);
    assert.doesNotMatch(content, /\/second-claude-code\b/, `${label} must not revive the legacy /second-claude-code namespace`);
  }

  // The runner's Round 0 gate is documented where the flow is documented. SKILL.md deliberately
  // does not restate the runner's surface: an enumeration in prose drifts the moment the runner
  // changes, which is the drift the .gjc assertions above were catching.
  for (const [label, content] of Object.entries({ command, docs })) {
    assert.match(content, /Round 0|topology/i, `${label} should document topology confirmation`);
  }

  assert.match(command, /docs\/skills\/coach\.md/);
  assert.match(skill, /docs\/skills\/coach\.md/);
  assert.match(docs, /must fall back safely and increment diagnostic failure accounting/i);
});

test("the coach skill keys on divergence, states a recipe, and stays short", () => {
  const skill = read("skills/coach/SKILL.md");
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(frontmatter, "SKILL.md should open with YAML frontmatter");
  const body = skill.slice(frontmatter[0].length);

  // The baseline agents were confident, thorough, and divergent. Keying the trigger on the agent's
  // own uncertainty would have let all three straight through.
  assert.match(body, /different defensible answer/i, "the fork test should be divergence, not uncertainty");

  // The model must be able to reach for this on its own; the baseline failure is that nobody asked.
  assert.doesNotMatch(frontmatter[1], /disable-model-invocation/, "coach must stay model-invocable");

  // A description that summarizes the workflow becomes the shortcut the model takes instead of
  // reading the body.
  const description = frontmatter[1].match(/^description:\s*"([^"\n]+)"/m)?.[1];
  assert.ok(description, "SKILL.md should declare a description");
  assert.match(description, /^Use when /);
  assert.doesNotMatch(description, /record-fork|STANDARD\.md|coach-runner/, "description should state triggers, not process");

  // Over-firing is this plugin's established failure mode, so the description states when NOT to
  // fire as well as when to. Vagueness is not a fork: it takes a clarifying question.
  assert.match(description, /Do not use/, "description should carry an anti-trigger");
  assert.match(description, /vague|underspecified/i, "the anti-trigger should rule out mere vagueness");
  assert.ok(description.length <= 500, `description should stay at or under 500 characters (got ${description.length})`);

  // A mechanical check runs before any judgement. resolveProjectRoot throws when the project root
  // is inside the plugin install, and there is nowhere legitimate to write a standard in that case.
  const checkAt = body.indexOf("coach-runner.mjs");
  const forkTestAt = body.indexOf("different defensible answer");
  assert.ok(checkAt >= 0, "SKILL.md should open with the runnable precondition check");
  assert.ok(checkAt < forkTestAt, "the precondition check should come before any judgement");
  assert.match(body, /plugin-install-path error/, "SKILL.md should name the failure the check catches");

  // The precondition is read and run from a user project directory, never from the plugin's own
  // checkout — a bare relative path resolves against the caller's cwd and only "worked" before by
  // accident, the exact bug this phase closed (see C3, whole-branch review, 2026-08-10).
  assert.match(
    body,
    /node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/coach-runner\.mjs" status --json/,
    "the precondition check should resolve the runner via CLAUDE_PLUGIN_ROOT, not a path relative to the caller's cwd"
  );

  // Sixteen of this plugin's eighteen skills answer a discipline failure that did not occur here,
  // at length. The recipe has nothing to negotiate with, so it does not need the length.
  const words = body.split(/\s+/).filter(Boolean).length;
  assert.ok(words <= 500, `skills/coach/SKILL.md should stay at or under 500 words (got ${words})`);
});

test("coach internal fragments are private skill-fragments, not public commands", () => {
  const fragments = [
    "skills/coach/references/fragments/auto-research-greenfield.md",
    "skills/coach/references/fragments/auto-answer-uncertain.md",
  ];

  for (const relPath of fragments) {
    const content = read(relPath);
    assert.match(content, /^kind: skill-fragment$/m, `${relPath} must be a skill-fragment`);
    assert.match(content, /^parent: coach$/m, `${relPath} must declare its parent`);
    assert.match(content, /Internal-only prompt fragment/i, `${relPath} must be explicitly internal-only`);
    assert.match(content, /Do not edit files|No code edits/i, `${relPath} must stay read-only`);
    assert.match(content, /Do not invoke|Do not mutate|No workflow delegation|Do not edit files, mutate state, call workflow skills, or delegate execution/i, `${relPath} must not delegate execution`);
  }

  const commandFiles = markdownFilesUnder("commands");
  const commandText = commandFiles.map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(commandText, /auto-research-greenfield|auto-answer-uncertain/);
  assert.equal(existsSync(path.join(root, "commands", "auto-research-greenfield.md")), false);
  assert.equal(existsSync(path.join(root, "skills", "auto-research-greenfield", "SKILL.md")), false);
  assert.equal(existsSync(path.join(root, "skills", "auto-answer-uncertain", "SKILL.md")), false);
  assert.equal(existsSync(path.join(root, "commands", "auto-answer-uncertain.md")), false);
});

test("coach files do not ship incompleteness markers", () => {
  const files = [
    "commands/coach.md",
    "skills/coach/SKILL.md",
    "skills/coach/references/fragments/auto-research-greenfield.md",
    "skills/coach/references/fragments/auto-answer-uncertain.md",
    "scripts/coach-runner.mjs",
    "docs/skills/coach.md",
  ];
  const bannedTerms = [
    ["T", "O", "D", "O"].join(""),
    ["s", "t", "u", "b"].join(""),
    ["n", "o", "-", "o", "p"].join(""),
    ["n", "o", "o", "p"].join(""),
    ["f", "a", "k", "e", " ", "f", "a", "l", "l", "b", "a", "c", "k"].join(""),
    ["p", "l", "a", "c", "e", "h", "o", "l", "d", "e", "r"].join(""),
    ["T", "B", "D"].join(""),
  ];
  const banned = new RegExp(bannedTerms.join("|"), "i");

  for (const relPath of files) {
    assert.doesNotMatch(read(relPath), banned, `${relPath} contains a banned incompleteness marker`);
  }
});
