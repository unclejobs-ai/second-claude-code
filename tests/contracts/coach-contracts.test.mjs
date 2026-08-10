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

test("coach public surfaces are registered as the eighteenth command and skill", () => {
  assert.ok(existsSync(path.join(root, "commands", "coach.md")));
  assert.ok(existsSync(path.join(root, "skills", "coach", "SKILL.md")));

  const commands = readdirSync(path.join(root, "commands")).filter((name) => name.endsWith(".md"));
  const skills = readdirSync(path.join(root, "skills")).filter((name) => existsSync(path.join(root, "skills", name, "SKILL.md")));
  assert.equal(commands.length, 18);
  assert.equal(skills.length, 18);
  const commandNames = commands.map((name) => name.replace(/\.md$/, "")).sort();
  const skillNames = skills.toSorted();
  assert.deepEqual(commandNames, skillNames);

  const manifest = JSON.parse(read(".claude-plugin/plugin.json"));
  assert.match(manifest.description, /18 skills/);
  assert.match(manifest.description, /17 Pokemon agents/);
});

test("coach command, skill, and docs expose a self-serve pending-approval path", () => {
  const command = read("commands/coach.md");
  const skill = read("skills/coach/SKILL.md");
  const docs = read("docs/skills/coach.md");

  for (const [label, content] of Object.entries({ command, skill, docs })) {
    assert.match(content, /coach-runner\.mjs/, `${label} should document the runner path`);
    assert.match(content, /Round 0|topology/i, `${label} should document topology confirmation`);
    assert.match(content, /approval/i, `${label} should document approval gating`);
    assert.match(content, /\.scc\/standards\//, `${label} should document where a settled fork lands`);
    assert.match(content, /record-fork/, `${label} should name the command that records a fork`);
    // ralplan, ultragoal and team are commands this plugin has never had. They shipped in the
    // ported prose and were documented as approval options for three releases.
    assert.doesNotMatch(content, /ralplan|ultragoal/i, `${label} must not offer commands this plugin lacks`);
    assert.doesNotMatch(content, /\.gjc\//, `${label} must not revive the .gjc namespace`);
    assert.doesNotMatch(content, /\/second-claude-code\b/, `${label} must not revive the legacy /second-claude-code namespace`);
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
