import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { resolveReviewAggregationConfig } from "../../hooks/lib/review-config.mjs";

const root = process.cwd();

test("Codex-exposed skills use the host-neutral runtime path contract", () => {
  const runtimeContract = path.join(root, "skills", "runtime-paths.md");
  assert.equal(existsSync(runtimeContract), true, "skills/runtime-paths.md must define portable paths");

  for (const skillDir of readdirSync(path.join(root, "skills"), { withFileTypes: true })) {
    if (!skillDir.isDirectory()) continue;
    const skillPath = path.join(root, "skills", skillDir.name, "SKILL.md");
    if (!existsSync(skillPath)) continue;
    const contents = readFileSync(skillPath, "utf8");
    assert.doesNotMatch(
      contents,
      /CLAUDE_PLUGIN_(?:ROOT|DATA)/,
      `${skillDir.name} exposes a Claude-only runtime path to Codex`
    );
    if (/<plugin-(?:root|data)>/.test(contents)) {
      assert.match(
        contents,
        /\.\.\/runtime-paths\.md/,
        `${skillDir.name} must load the host-neutral runtime path contract`
      );
    }
  }
});

function read(relPath) {
  return readFileSync(path.join(root, relPath), "utf8");
}

function markdownFilesUnder(relPath) {
  const start = path.join(root, relPath);
  const files = [];
  const scanStack = [start];

  while (scanStack.length > 0) {
    const current = scanStack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        scanStack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function activePublicDocFiles() {
  return [
    ...markdownFilesUnder("skills"),
    ...markdownFilesUnder(path.join("docs", "skills")),
    path.join(root, "docs", "architecture.md"),
    path.join(root, "docs", "architecture.ko.md"),
  ];
}

function routingContractDocFiles() {
  return [
    path.join(root, "README.md"),
    path.join(root, "README.ko.md"),
    path.join(root, "docs", "notion-manual.md"),
    path.join(root, "docs", "notion-manual.ko.md"),
    path.join(root, "docs", "orchestrator-architecture.md"),
    path.join(root, "docs", "orchestrator-architecture.ko.md"),
    path.join(root, "docs", "skills", "pdca.md"),
    path.join(root, "docs", "skills", "pdca.ko.md"),
    path.join(root, "skills", "pdca", "gotchas.md"),
    path.join(root, "references", "lineage.md"),
  ];
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

test("skill descriptions use trigger-only frontmatter", () => {
  const skillsDir = path.join(root, "skills");
  const skillNames = readdirSync(skillsDir).filter((name) => existsSync(path.join(skillsDir, name, "SKILL.md")));

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
    const relPath = findAgentFileByName(agent);
    assert.equal(
      relPath !== null && existsSync(path.join(root, relPath)),
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
    readme.includes("| `content` | Deep + Advocate + Tone |"),
    "README should document the content preset"
  );
  assert.ok(
    readme.includes("| `strategy` | Deep + Advocate + Facts |"),
    "README should document the strategy preset"
  );
  assert.ok(
    readme.includes("| `code` | Deep + Facts + Structure |"),
    "README should document the code preset"
  );

  assert.ok(
    consensusGate.includes("| content | Xatu (deep-reviewer) + Absol (devil-advocate) + Jigglypuff (tone-guardian) |"),
    "consensus gate should document the content preset"
  );
  assert.ok(
    consensusGate.includes("| strategy | Xatu (deep-reviewer) + Absol (devil-advocate) + Porygon (fact-checker) |"),
    "consensus gate should document the strategy preset"
  );
  assert.ok(
    consensusGate.includes("| code | Xatu (deep-reviewer) + Porygon (fact-checker) + Unown (structure-analyst) |"),
    "consensus gate should document the code preset"
  );
});

test("consensus gate docs use the runtime Math.round rule for external voters", () => {
  const consensusGate = read("skills/review/references/consensus-gate.md");
  const presets = ["content", "strategy", "code", "security", "academic", "quick", "full"];

  assert.match(consensusGate, /required\s*=\s*Math\.round\(threshold \* total_voters\)/);
  assert.doesNotMatch(consensusGate, /`ceil\(/, "consensus docs must not describe the old ceil gate");

  for (const preset of presets) {
    const config = resolveReviewAggregationConfig({ preset });
    const internalRequired = Math.round(config.threshold * config.expected_reviewers);
    const externalRequired = Math.round(config.threshold * (config.expected_reviewers + 1));
    const row = new RegExp(
      "\\| `" + preset + "` \\| " +
      internalRequired + "/" + config.expected_reviewers + " pass \\| " +
      externalRequired + "/" + (config.expected_reviewers + 1) + " pass \\|"
    );
    assert.match(
      consensusGate,
      row,
      `${preset} external denominator/required count should follow the hook config`
    );
  }
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
  const commandNames = readdirSync(path.join(root, "commands"))
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => fileName.replace(/\.md$/, ""))
    .sort();

  for (const name of commandNames) {
    const content = read(path.join("commands", `${name}.md`));
    // A tool-only command has no skill to point at. It carries its own runbook,
    // which is exactly why it does not need a slot in the skill list.
    if (!existsSync(path.join(root, "skills", name, "SKILL.md"))) {
      assert.match(
        content,
        /CLAUDE_PLUGIN_ROOT/,
        `${name} is a tool-only command and must carry the command that runs it`
      );
      assert.doesNotMatch(
        content,
        /(loaded|through the) `[a-z-]+` skill/i,
        `${name} has no skill and must not tell the model to load one`
      );
      continue;
    }
    assert.match(
      content,
      new RegExp(`Invoke the \`/scc:${name}\` command`, "i"),
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

test("skill guide indexes classify skills and tool-only commands from disk", () => {
  const skillNames = readdirSync(path.join(root, "skills"))
    .filter((name) => existsSync(path.join(root, "skills", name, "SKILL.md")))
    .sort();
  const commandNames = readdirSync(path.join(root, "commands"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
  const toolOnlyNames = commandNames.filter((name) => !skillNames.includes(name));

  for (const relPath of ["docs/skills/README.md", "docs/skills/README.ko.md"]) {
    const content = read(relPath);
    const skillsRow = content.match(/\| (?:Skills|스킬) \| ([^\n]+?) \|/)?.[1] || "";
    const toolsRow = content.match(/\| (?:Tools|도구) \| ([^\n]+?) \|/)?.[1] || "";
    const listedSkills = [...skillsRow.matchAll(/`([^`]+)`/g)].map((match) => match[1]).sort();
    const listedTools = [...toolsRow.matchAll(/`([^`]+)`/g)].map((match) => match[1]).sort();

    assert.deepEqual(listedSkills, skillNames, `${relPath} should list every SKILL.md directory`);
    assert.deepEqual(listedTools, toolOnlyNames, `${relPath} should list only command wrappers without SKILL.md`);
  }
});

test("active public docs do not use the legacy /second-claude-code namespace", () => {
  const offenders = [];

  for (const fullPath of activePublicDocFiles()) {
    const content = readFileSync(fullPath, "utf8");
    if (/\/second-claude-code:/.test(content)) {
      offenders.push(path.relative(root, fullPath));
    }
  }

  assert.deepEqual(offenders.sort(), []);
});

test("active public docs reference only registered public commands", () => {
  const commandNames = new Set(
    readdirSync(path.join(root, "commands"))
      .filter((fileName) => fileName.endsWith(".md"))
      .map((fileName) => fileName.replace(/\.md$/, ""))
  );
  const offenders = [];

  for (const fullPath of activePublicDocFiles()) {
    const content = readFileSync(fullPath, "utf8");
    for (const match of content.matchAll(/\/scc:([a-z-]+)/g)) {
      if (!commandNames.has(match[1])) {
        offenders.push(`${path.relative(root, fullPath)} -> ${match[0]}`);
      }
    }
  }

  assert.deepEqual(offenders.sort(), []);
});

test("routing docs do not promise prompt-hook skill invocation", () => {
  const forbidden = [
    /router reads intent/i,
    /라우터가 (?:한국어든 영어든 )?의도를 읽/i,
    /router handles the rest/i,
    /라우터가 알아서 붙/i,
    /roughly 50 Korean trigger patterns and 77 English/i,
    /Auto-routing via prompt-detect/i,
    /prompt-detect.*detects user intent and suggests skills/i,
    /Called before internal fallback when `getDispatchPlan\(\)`/i,
    /내부 fallback 전에 호출/i,
    /ORCHESTRATOR 지시/i,
    /pdca로 라우팅 — 여기서 즉시 반환/i,
  ];
  const offenders = [];
  for (const fullPath of routingContractDocFiles()) {
    const content = readFileSync(fullPath, "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(content)) offenders.push(`${path.relative(root, fullPath)} -> ${pattern}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("research command wrapper preserves the research brief auto-save contract", () => {
  const researchCommand = read("commands/research.md");
  assert.match(researchCommand, /\.captures\/research-\{slug\}-\{YYYY-MM-DD\}\.md/);
  assert.match(researchCommand, /saved path/i);
});

test("pdca documents the code engineering lane contract", () => {
  const koreanLaneName = "\uCF54\uB4DC \uC5D4\uC9C0\uB2C8\uC5B4\uB9C1 \uB808\uC778";
  const lanePath = path.join(root, "skills", "pdca", "references", "code-engineering-lane.md");
  assert.equal(existsSync(lanePath), true, "PDCA should provide a code engineering lane reference");

  const lane = read(path.join("skills", "pdca", "references", "code-engineering-lane.md"));
  for (const phrase of [
    "engineering-discipline",
    "Hyper-Waterfall",
    "human approval gate",
    "worker-validator",
    "stage report",
    "clean-ai-slop",
    "Rob Pike",
  ]) {
    assert.match(lane, new RegExp(phrase), `code engineering lane should include ${phrase}`);
  }

  assert.match(read("skills/pdca/SKILL.md"), /Code Engineering Lane/);
  assert.match(read("skills/pdca/SKILL.md"), /references\/code-engineering-lane\.md/);
  assert.match(read("README.md"), /Code Engineering Lane/);
  assert.match(read("docs/architecture.md"), /Code Engineering Lane/);
  assert.match(read("docs/skills/pdca.md"), /Code Engineering Lane/);
  assert.match(read("docs/architecture.ko.md"), new RegExp(koreanLaneName));
  assert.match(read("docs/skills/pdca.ko.md"), new RegExp(koreanLaneName));
  assert.match(read("README.ko.md"), new RegExp(koreanLaneName));

  const stageContracts = JSON.parse(read("config/stage-contracts.json"));
  const codeDodText = ["plan", "do", "check", "act"]
    .flatMap((phase) => stageContracts.contracts[phase].code.dod)
    .join("\n");

  for (const phrase of [
    "Executable acceptance criteria",
    "Human approval gate",
    "Stage report",
    "Validator/reviewer proof",
    "clean-ai-slop",
    "baseline and after measurement",
    "handoff state",
  ]) {
    assert.match(codeDodText, new RegExp(phrase), `code stage contracts should include ${phrase}`);
  }
});

test("loop surfaces are documented across primary docs", () => {
  const readme = read("README.md");
  const readmeKo = read("README.ko.md");
  const architecture = read("docs/architecture.md");
  const architectureKo = read("docs/architecture.ko.md");
  const claude = read("CLAUDE.md");

  // Derived, not hardcoded: this assertion shipped as a literal 18 and then
  // held the docs at 18 while the skill list changed underneath it.
  const skillCount = readdirSync(path.join(root, "skills")).filter((name) =>
    existsSync(path.join(root, "skills", name, "SKILL.md"))
  ).length;

  for (const doc of [readme, readmeKo, architecture, architectureKo, claude]) {
    assert.match(
      doc,
      new RegExp(`${skillCount} (commands|slash commands|skills)|${skillCount}\uAC1C (\uC2A4\uD0AC|\uC2AC\uB798\uC2DC)`, "i"),
      `top-level docs should say ${skillCount} skills, matching what is on disk`
    );
    assert.match(
      doc,
      /\/scc:loop/,
      "top-level docs should mention the public loop command"
    );
  }
});

test("README install and command namespace match the plugin surface", () => {
  const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
  const readme = read("README.md");
  const readmeKo = read("README.ko.md");
  const expectedInstall = [
    "claude plugin marketplace add unclejobs-ai/second-claude-code",
    `claude plugin install ${plugin.name}`,
  ];
  const publicPrefix = `/${plugin.name}:`;

  for (const doc of [readme, readmeKo]) {
    for (const line of expectedInstall) {
      assert.match(
        doc,
        new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        "README should document the marketplace install flow the CLI actually supports"
      );
    }
    assert.doesNotMatch(
      doc,
      /claude plugin add github:/,
      "`claude plugin add` is not a CLI command — it prints help and installs nothing"
    );
    assert.doesNotMatch(doc, /github:parkeungje\/second-claude\b/);
    assert.doesNotMatch(doc, /\/second-claude-code:/);
    assert.match(
      doc,
      new RegExp(publicPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      "README should document the public slash command prefix from plugin.json"
    );
  }
});

test("discover documents use supported install paths and an explicit approval boundary", () => {
  const discoverDocs = [read("docs/skills/discover.md"), read("docs/skills/discover.ko.md")];
  const scoringRefs = [
    read("references/discover-scoring.md"),
    read("skills/discover/references/discover-scoring.md"),
  ];

  for (const doc of discoverDocs) {
    assert.match(doc, /claude plugin marketplace add/);
    assert.match(doc, /claude plugin install/);
    assert.match(doc, /npx --yes skills find/);
    assert.match(doc, /npx --yes skills add/);
    assert.match(doc, /(?:explicit approval|명시적 승|승인)/i);
    assert.doesNotMatch(doc, /claude\s+install\b/,
      "discover docs must not advertise the unsupported Claude install shortcut");
  }

  for (const ref of scoringRefs) {
    assert.match(ref, /Candidate type|후보 유형/);
    assert.match(ref, /plugin-name@marketplace-name/);
    assert.match(ref, /npx --yes skills add/);
    assert.match(ref, /Discovery is read-only|Discovery itself never runs|탐색 중에는/);
    assert.doesNotMatch(ref, /claude\s+install\b/,
      "discover scoring references must not encode an unsupported install command");
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
  const writerAgentPath = findAgentFileByName("writer");
  assert.ok(writerAgentPath, "writer agent definition should exist");
  const writerAgent = read(writerAgentPath);
  const newsletterTemplate = read("templates/newsletter.md");
  const writeGotchas = read("skills/write/gotchas.md");
  const captureSkill = read("skills/collect/SKILL.md");
  const captureGotchas = read("skills/collect/gotchas.md");
  const researchSkill = read("skills/research/SKILL.md");
  const researchGotchas = read("skills/research/gotchas.md");

  for (const expected of [
    "newsletter 10000",
    "article 4000",
    "report 5000",
  ]) {
    const [type, count] = expected.split(" ");
    assert.match(
      writeSkill,
      new RegExp(`${type}[^\\n]*${count}[^\\n]*chars`, "i"),
      `write skill should require ${count} chars for ${type}`
    );
    assert.match(
      writerAgent,
      new RegExp(`${type}[^\\n]*${count}`, "i"),
      `writer agent should require ${count} chars for ${type}`
    );
    assert.match(
      writeGotchas,
      new RegExp(`${type} ${count}`, "i"),
      `write gotchas should require ${count} chars for ${type}`
    );
  }

  const articleFormat = read("skills/write/references/formats/article.md");
  const reportFormat = read("skills/write/references/formats/report.md");
  const shortsFormat = read("skills/write/references/formats/shorts.md");
  const writeGuide = read("docs/skills/write.md");

  assert.match(
    articleFormat,
    /4000 chars/i,
    "article format spec should require 4000 chars"
  );
  assert.match(
    reportFormat,
    /5000 chars/i,
    "report format spec should require 5000 chars"
  );
  assert.match(
    shortsFormat,
    /1800 chars/i,
    "shorts format spec should require 1800 chars"
  );
  assert.match(
    writerAgent,
    /shorts[\s\S]*1800/i,
    "writer agent should require 1800 chars for shorts"
  );
  assert.match(
    writeSkill,
    /shorts[\s\S]*1800/i,
    "write skill should require 1800 chars for shorts"
  );
  assert.match(
    writeGuide,
    /10,000 chars[\s\S]*4,000 chars[\s\S]*5,000 chars[\s\S]*1,800 chars/i,
    "public write guide should use the Do-phase char floors"
  );

  assert.match(
    newsletterTemplate,
    /at least 10000 chars/i,
    "newsletter template checklist should require 10000 chars"
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
    /shallow.*3.*(searches|Jina Search calls|WebSearch)/i,
    "research skill should define shallow depth as 3 searches"
  );
  assert.match(
    researchSkill,
    /medium.*5.*(searches|Jina Search calls|WebSearch)/i,
    "research skill should define medium depth as 5 searches"
  );
  assert.match(
    researchSkill,
    /deep.*10.*(searches|Jina Search calls|WebSearch)/i,
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

  // Prefix-based Korean allowlist: directories where Korean content is expected.
  // hooks/ and tests/ have no English/Korean twin to protect \u2014 a hook or test file is Korean
  // or it isn't, there is no *.ko.md counterpart it could drift from \u2014 so they are allowlisted
  // by directory rather than by exact file, which otherwise needs a new entry every time a hook
  // or test file picks up Korean text. skills/pdca, skills/soul and skills/translate stay as
  // their own prefixes for the same reason. Everything else (docs/skills/*.md beside *.ko.md,
  // the two READMEs) keeps the exact strictness it had before this change.
  const koreanAllowlistPrefixes = [
    "hooks/",
    "tests/",
    "skills/pdca/",
    "skills/soul/",
    "skills/translate/",
  ];

  for (const file of files) {
    if (koreanAllowlistPrefixes.some((prefix) => file.startsWith(prefix))) continue;
    assert.doesNotMatch(file, /[\uAC00-\uD7A3]/, `${file} path should not contain Hangul`);
    const content = read(file);
    assert.doesNotMatch(content, /[\uAC00-\uD7A3]/, `${file} should not contain Hangul`);
  }
});

// Orchestrator skills (pdca, refine) intentionally exceed the 1000-word limit due to their
// extensive phase schemas, gate checklists, and state management specifications.
// Skills with Iron Law + Red Flags philosophy sections may also slightly exceed the limit.
const WORD_LIMIT_EXEMPTIONS = new Set(["pdca", "refine", "review", "soul", "batch", "translate", "workflow"]);

test("skill files stay within the documented 1000-word limit", () => {
  const skillDirs = readdirSync(path.join(root, "skills")).filter((dir) =>
    existsSync(path.join(root, "skills", dir, "SKILL.md"))
  );
  for (const dir of skillDirs) {
    if (WORD_LIMIT_EXEMPTIONS.has(dir)) continue;
    const relPath = path.join("skills", dir, "SKILL.md");
    const wordCount = read(relPath).split(/\s+/).filter(Boolean).length;
    assert.ok(wordCount <= 1000, `${relPath} should stay at or under 1000 words (got ${wordCount})`);
  }
});

test("skill Subagents blocks name real agents, or say plainly that they do not", () => {
  const agentNames = new Set(
    readdirSync(path.join(root, "agents"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => read(path.join("agents", f)).match(/^name:\s*(.+)$/m)?.[1]?.trim())
      .filter(Boolean)
  );

  // A role key that is neither a real agent nor declared generic is unreachable: dispatching it
  // resolves nothing, so the model/tools written beside it are silently ignored.
  const GENERIC_DISCLAIMER = /not entries in `agents\/`/;
  const offenders = [];

  for (const skillDir of readdirSync(path.join(root, "skills"), { withFileTypes: true })) {
    if (!skillDir.isDirectory()) continue;
    const relPath = path.join("skills", skillDir.name, "SKILL.md");
    if (!existsSync(path.join(root, relPath))) continue;

    const content = read(relPath);
    const section = content.split(/^## Subagents\s*$/m)[1];
    if (!section) continue;
    if (GENERIC_DISCLAIMER.test(section.split(/^## /m)[0])) continue;

    const block = section.match(/```yaml\n([\s\S]*?)```/)?.[1] ?? "";
    for (const line of block.split("\n")) {
      const role = line.match(/^([A-Za-z][\w-]*):\s*\{/)?.[1];
      // `reviewer: { skill: ... }` delegates to a skill, not an agent.
      if (!role || /\{\s*skill:/.test(line)) continue;
      if (!agentNames.has(role)) offenders.push(`${relPath}: ${role}`);
    }
  }

  assert.deepEqual(offenders.sort(), []);
});

test("the agent catalog lists every agent, with the tier each one actually declares", () => {
  // This table drifted for months: two agents kept a haiku tier they had been upgraded off, the
  // 17th was never added, and six rows used short names that match no agent.
  const actual = new Map(
    readdirSync(path.join(root, "agents"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => read(path.join("agents", f)))
      .map((body) => [
        body.match(/^name:\s*(.+)$/m)?.[1]?.trim(),
        body.match(/^model:\s*(.+)$/m)?.[1]?.trim(),
      ])
      .filter(([name]) => name)
  );

  const doc = read("references/agent-catalog-notes.md");
  const listed = new Map(
    [...doc.matchAll(/^\| ([a-z][\w-]*) \| \w+ \| (\w+) \|/gm)].map((m) => [m[1], m[2]])
  );

  assert.deepEqual([...actual.keys()].sort(), [...listed.keys()].sort(), "catalog rows vs agents/");
  for (const [name, model] of actual) {
    assert.equal(listed.get(name), model, `${name} tier in catalog`);
  }
  assert.match(doc, new RegExp(`## Current Agents \\(${actual.size}\\)`), "header count");
});

test("every skill guide exists in both languages", () => {
  const guides = readdirSync(path.join(root, "docs", "skills")).filter((f) => f.endsWith(".md"));
  const english = guides.filter((f) => !f.endsWith(".ko.md"));
  const missing = english
    .filter((f) => !guides.includes(f.replace(/\.md$/, ".ko.md")))
    .map((f) => `docs/skills/${f}`);
  assert.deepEqual(missing, []);
});

test("the viewer guide names the producer, not just the server", () => {
  // Both guides described PDCA as writing state.json + artifacts/*.json directly. It never did,
  // which is why the viewer rendered an empty page — the fix was easy to land in SKILL.md and miss
  // in the user-facing guide.
  for (const file of ["docs/skills/viewer.md", "docs/skills/viewer.ko.md"]) {
    assert.match(read(file), /viewer-session\.mjs/, `${file} should name the producer`);
  }
});

test("roster diagrams show the tier distribution the agents actually declare", () => {
  // review-flow.svg and agent-roster.svg have each drifted from agents/ at least once. A diagram
  // that is merely out of date still reads as authoritative, so the counts are pinned here.
  const expected = {};
  const jobNames = [];
  for (const file of readdirSync(path.join(root, "agents")).filter((f) => f.endsWith(".md"))) {
    const body = read(path.join("agents", file));
    const model = body.match(/^model:\s*(.+)$/m)?.[1]?.trim();
    const name = body.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    if (model) expected[model] = (expected[model] ?? 0) + 1;
    if (name) jobNames.push(name);
  }

  for (const svg of ["docs/images/agent-roster.svg", "docs/images/agent-roster.ko.svg"]) {
    const body = read(svg);

    for (const name of jobNames) {
      assert.match(
        body,
        new RegExp(`>${name}<`),
        `${svg} must label the dispatch name ${name}`
      );
    }

    // Per-agent labels: one `>tier<` per row.
    const perAgent = {};
    for (const [, tier] of body.matchAll(/>(opus|sonnet|haiku)</g)) {
      perAgent[tier] = (perAgent[tier] ?? 0) + 1;
    }
    assert.deepEqual(perAgent, expected, `${svg} per-agent tier labels`);

    // Legend totals: `>tier (N)<`. Counting only the bare form left these unchecked, which is how
    // a legend reading "sonnet (9)" survived a pass that fixed every row beneath it.
    const legend = Object.fromEntries(
      [...body.matchAll(/>(opus|sonnet|haiku) \((\d+)\)</g)].map(([, tier, n]) => [tier, Number(n)])
    );
    if (Object.keys(legend).length) {
      assert.deepEqual(legend, expected, `${svg} legend totals`);
    }
  }
});
