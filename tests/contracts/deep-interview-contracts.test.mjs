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

test("deep interview public surfaces are registered as the eighteenth command and skill", () => {
  assert.ok(existsSync(path.join(root, "commands", "deep-interview.md")));
  assert.ok(existsSync(path.join(root, "skills", "deep-interview", "SKILL.md")));

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

test("deep interview command, skill, and docs expose a self-serve pending-approval path", () => {
  const command = read("commands/deep-interview.md");
  const skill = read("skills/deep-interview/SKILL.md");
  const docs = read("docs/skills/deep-interview.md");

  for (const [label, content] of Object.entries({ command, skill, docs })) {
    assert.match(content, /deep-interview-runner\.mjs/, `${label} should document the runner path`);
    assert.match(content, /Round 0|topology/i, `${label} should document topology confirmation`);
    assert.match(content, /approval/i, `${label} should document approval gating`);
    assert.match(content, /ralplan/i, `${label} should name the ralplan refinement option`);
    assert.match(content, /ultragoal/i, `${label} should name the ultragoal execution option`);
    assert.doesNotMatch(content, /\/scc\b/, `${label} must not revive the legacy /scc namespace`);
  }

  assert.match(command, /docs\/skills\/deep-interview\.md/);
  assert.match(skill, /docs\/skills\/deep-interview\.md/);
  assert.match(docs, /\.gjc\/specs\/deep-interview-\{slug\}\.md/);
  assert.match(docs, /must fall back safely and increment diagnostic failure accounting/i);
});

test("deep interview internal fragments are private skill-fragments, not public commands", () => {
  const fragments = [
    "skills/deep-interview/references/fragments/auto-research-greenfield.md",
    "skills/deep-interview/references/fragments/auto-answer-uncertain.md",
  ];

  for (const relPath of fragments) {
    const content = read(relPath);
    assert.match(content, /^kind: skill-fragment$/m, `${relPath} must be a skill-fragment`);
    assert.match(content, /^parent: deep-interview$/m, `${relPath} must declare its parent`);
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

test("deep interview files do not ship incompleteness markers", () => {
  const files = [
    "commands/deep-interview.md",
    "skills/deep-interview/SKILL.md",
    "skills/deep-interview/references/fragments/auto-research-greenfield.md",
    "skills/deep-interview/references/fragments/auto-answer-uncertain.md",
    "scripts/deep-interview-runner.mjs",
    "docs/skills/deep-interview.md",
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
