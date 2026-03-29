#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, "..");
const SOURCE_ROOT = join(ROOT_DIR, "references", "hermes", "skillpack");

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function listSkills() {
  const result = [];
  for (const category of readdirSync(SOURCE_ROOT, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryPath = join(SOURCE_ROOT, category.name);
    for (const skill of readdirSync(categoryPath, { withFileTypes: true })) {
      if (!skill.isDirectory()) continue;
      result.push({
        category: category.name,
        name: skill.name,
        source: join(categoryPath, skill.name),
      });
    }
  }
  return result.sort((a, b) => `${a.category}/${a.name}`.localeCompare(`${b.category}/${b.name}`));
}

function parseArgs(argv) {
  const args = [...argv];
  const positional = [];
  const flags = {};

  while (args.length > 0) {
    const token = args.shift();
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = args[0];
      if (!next || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = args.shift();
      }
      continue;
    }
    positional.push(token);
  }

  return { positional, flags };
}

function installSkill(skill, targetRoot) {
  const target = join(targetRoot, skill.category, skill.name);
  ensureDir(join(targetRoot, skill.category));
  cpSync(skill.source, target, { recursive: true, force: true });
  return {
    category: skill.category,
    name: skill.name,
    source: skill.source,
    target,
    relative_target: relative(targetRoot, target),
  };
}

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/install-hermes-skillpack.mjs list",
      "  node scripts/install-hermes-skillpack.mjs install --target ~/.hermes/skills",
      "  node scripts/install-hermes-skillpack.mjs install acpx-orchestrator --target ~/.hermes/skills",
    ].join("\n")
  );
}

function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional[0];

  if (command === "list") {
    process.stdout.write(`${JSON.stringify({ skills: listSkills() }, null, 2)}\n`);
    return;
  }

  if (command === "install") {
    const targetRoot = resolve(
      flags.target || process.env.HERMES_SKILLS_DIR || join(process.env.HOME || "~", ".hermes", "skills")
    );
    ensureDir(targetRoot);
    const wanted = positional[1];
    const skills = listSkills();
    const selected = wanted
      ? skills.filter((skill) => skill.name === wanted || `${skill.category}/${skill.name}` === wanted)
      : skills;

    if (selected.length === 0) {
      throw new Error(`No skillpack entry found for "${wanted}"`);
    }

    const installed = selected.map((skill) => installSkill(skill, targetRoot));
    process.stdout.write(
      `${JSON.stringify({ target_root: targetRoot, installed }, null, 2)}\n`
    );
    return;
  }

  usage();
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
