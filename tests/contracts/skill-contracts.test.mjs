import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  return readFileSync(path.join(root, relPath), "utf8");
}

test("skill descriptions use trigger-only frontmatter", () => {
  const skillsDir = path.join(root, "skills");
  const skillNames = readdirSync(skillsDir);

  for (const skillName of skillNames) {
    const file = path.join(skillsDir, skillName, "SKILL.md");
    const content = readFileSync(file, "utf8");
    const match = content.match(/^description:\s*"([^"\n]+)"/m);

    assert.ok(match, `${skillName} should declare a description`);
    assert.match(
      match[1],
      /^Use when /,
      `${skillName} description should start with "Use when "`
    );
  }
});

test("review presets only reference implemented reviewer agents", () => {
  const expectedAgents = [
    "deep-reviewer",
    "devil-advocate",
    "fact-checker",
    "tone-guardian",
    "structure-analyst",
  ];

  for (const agent of expectedAgents) {
    assert.equal(
      existsSync(path.join(root, "agents", `${agent}.md`)),
      true,
      `${agent} agent definition should exist`
    );
  }

  const reviewSkill = read("skills/review/SKILL.md");
  const readme = read("README.md");
  const consensusGate = read("references/consensus-gate.md");

  const expectedPresetLines = [
    "| `content` | deep-reviewer + devil-advocate + tone-guardian |",
    "| `strategy` | deep-reviewer + devil-advocate + fact-checker |",
    "| `code` | deep-reviewer + fact-checker + structure-analyst |",
  ];

  for (const line of expectedPresetLines) {
    assert.ok(reviewSkill.includes(line), `review skill should include ${line}`);
  }

  assert.ok(
    readme.includes("| `content` | deep-reviewer + devil-advocate + tone-guardian |"),
    "README should document the content preset"
  );
  assert.ok(
    readme.includes("| `strategy` | deep-reviewer + devil-advocate + fact-checker |"),
    "README should document the strategy preset"
  );
  assert.ok(
    readme.includes("| `code` | deep-reviewer + fact-checker + structure-analyst |"),
    "README should document the code preset"
  );

  assert.ok(
    consensusGate.includes("| content | deep-reviewer + devil-advocate + tone-guardian |"),
    "consensus gate should document the content preset"
  );
  assert.ok(
    consensusGate.includes("| strategy | deep-reviewer + devil-advocate + fact-checker |"),
    "consensus gate should document the strategy preset"
  );
  assert.ok(
    consensusGate.includes("| code | deep-reviewer + fact-checker + structure-analyst |"),
    "consensus gate should document the code preset"
  );
});

test("analyze supports exactly the framework templates it advertises", () => {
  const expectedFrameworks = [
    "swot",
    "rice",
    "okr",
    "prd",
    "lean-canvas",
    "persona",
    "journey-map",
    "pricing",
    "gtm",
    "north-star",
    "porter",
    "pestle",
    "ansoff",
    "battlecard",
    "value-prop",
  ];

  const analyzeSkill = read("skills/analyze/SKILL.md");
  const analyzeCommand = read("commands/analyze.md");
  const templateDir = path.join(root, "skills", "analyze", "references", "frameworks");
  const actualTemplates = readdirSync(templateDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""))
    .sort();

  assert.deepEqual(actualTemplates, [...expectedFrameworks].sort());

  for (const framework of expectedFrameworks) {
    assert.ok(
      analyzeSkill.includes(`| \`${framework}\` |`),
      `analyze skill should list ${framework}`
    );
  }

  const commandMatch = analyzeCommand.match(/\(([^)]+)\)/);
  assert.ok(commandMatch, "analyze command should declare a framework list");
  const commandFrameworks = commandMatch[1].split("|");
  assert.deepEqual(commandFrameworks, expectedFrameworks);
  assert.match(
    analyzeSkill,
    /skills\/analyze\/references\/frameworks\/\{framework\}\.md/,
    "analyze skill should point at the actual framework template path"
  );
});

test("command wrappers map each /scc command to the matching bare skill", () => {
  const commandNames = [
    "research",
    "write",
    "analyze",
    "review",
    "loop",
    "collect",
    "pipeline",
    "hunt",
  ];

  for (const name of commandNames) {
    const content = read(path.join("commands", `${name}.md`));
    assert.match(
      content,
      new RegExp(`Invoke the \`/second-claude-code:${name}\` command`, "i"),
      `${name} command should document its public command name`
    );
    assert.match(
      content,
      new RegExp(`loaded \`${name}\` skill`, "i"),
      `${name} command should point to the matching bare skill`
    );
    assert.doesNotMatch(
      content,
      /Use the Skill tool to invoke/i,
      `${name} command should execute directly rather than emit meta instructions`
    );
  }
});

test("README install and command namespace match the plugin surface", () => {
  const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
  const readme = read("README.md");
  const readmeKo = read("README.ko.md");
  const expectedInstall = "claude plugin add github:EungjePark/second-claude-code";
  const publicPrefix = `/${plugin.name}:`;

  for (const doc of [readme, readmeKo]) {
    assert.match(doc, new RegExp(expectedInstall.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(doc, /github:parkeungje\/second-claude\b/);
    assert.doesNotMatch(doc, /\/scc:/);
    assert.match(
      doc,
      new RegExp(publicPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      "README should document the public slash command prefix from plugin.json"
    );
  }
});

test("analyze framework templates use the standardized section layout", () => {
  const templateDir = path.join(root, "skills", "analyze", "references", "frameworks");
  const requiredSections = [
    "## When to Use",
    "## When NOT to Use",
    "## Required Sections",
    "## Evidence Expectations",
    ["## Recommended Actions", "## Recommended Outputs"],
  ];

  for (const name of readdirSync(templateDir).filter((entry) => entry.endsWith(".md"))) {
    const content = read(path.join("skills", "analyze", "references", "frameworks", name));
    for (const section of requiredSections) {
      const alternatives = Array.isArray(section) ? section : [section];
      assert.ok(
        alternatives.some((s) => content.includes(s)),
        `${name} should include ${alternatives.join(" or ")}`
      );
    }
  }
});

test("numeric contracts stay aligned across docs", () => {
  const writeSkill = read("skills/write/SKILL.md");
  const writerAgent = read("agents/writer.md");
  const newsletterTemplate = read("templates/newsletter.md");
  const writeGotchas = read("skills/write/gotchas.md");
  const captureSkill = read("skills/collect/SKILL.md");
  const captureGotchas = read("skills/collect/gotchas.md");
  const researchSkill = read("skills/research/SKILL.md");
  const researchGotchas = read("skills/research/gotchas.md");

  for (const expected of [
    "newsletter 2000",
    "article 3000",
    "report 4000",
  ]) {
    const [type, count] = expected.split(" ");
    assert.match(
      writeSkill,
      new RegExp(`${type}[\\s\\S]*${count}`, "i"),
      `write skill should require ${count} words for ${type}`
    );
    assert.match(
      writerAgent,
      new RegExp(`${type}[\\s\\S]*${count}`, "i"),
      `writer agent should require ${count} words for ${type}`
    );
    assert.match(
      writeGotchas,
      new RegExp(`${type} ${count}`, "i"),
      `write gotchas should require ${count} words for ${type}`
    );
  }

  assert.match(
    newsletterTemplate,
    /at least 2000 words/i,
    "newsletter template checklist should require 2000 words"
  );
  assert.match(
    captureSkill,
    /exactly 3 key points/i,
    "collect skill should require exactly 3 key points"
  );
  assert.match(
    captureGotchas,
    /key_points exactly 3/i,
    "collect gotchas should align to exactly 3 key points"
  );
  assert.match(
    researchSkill,
    /shallow.*3 searches/i,
    "research skill should define shallow depth as 3 searches"
  );
  assert.match(
    researchSkill,
    /medium.*5 searches/i,
    "research skill should define medium depth as 5 searches"
  );
  assert.match(
    researchSkill,
    /deep.*10 searches/i,
    "research skill should define deep depth as 10 searches"
  );
  assert.match(
    researchGotchas,
    /shallow=3, medium=5, deep=10/i,
    "research gotchas should align to the depth search counts"
  );
});

test("core docs and skills outside bilingual READMEs do not contain Hangul", () => {
  const targets = [
    "agents",
    "commands",
    "hooks",
    "references",
    "skills",
    "templates",
    "tests",
  ];

  function walk(relPath, acc) {
    const absPath = path.join(root, relPath);
    const entries = readdirSync(absPath, { withFileTypes: true });
    for (const entry of entries) {
      const childRel = path.join(relPath, entry.name);
      if (entry.isDirectory()) {
        walk(childRel, acc);
      } else {
        acc.push(childRel);
      }
    }
  }

  const files = [];
  for (const target of targets) {
    if (target.endsWith(".md")) {
      files.push(target);
    } else {
      walk(target, files);
    }
  }

  for (const file of files) {
    assert.doesNotMatch(file, /[\uAC00-\uD7A3]/, `${file} path should not contain Hangul`);
    const content = read(file);
    assert.doesNotMatch(content, /[\uAC00-\uD7A3]/, `${file} should not contain Hangul`);
  }
});

test("skill files stay within the documented 120-line limit", () => {
  const skillDirs = readdirSync(path.join(root, "skills"));
  for (const dir of skillDirs) {
    const relPath = path.join("skills", dir, "SKILL.md");
    const lineCount = read(relPath).split("\n").length;
    assert.ok(lineCount <= 120, `${relPath} should stay at or under 120 lines`);
  }
});
