import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  return readFileSync(path.join(root, relPath), "utf8");
}

test("guidance schema documents Hermes-style optional metadata fields", () => {
  const guidance = read("references/guidance-schema.md");

  assert.match(guidance, /platforms:/);
  assert.match(guidance, /required_environment_variables:/);
  assert.match(guidance, /fallback_for_capabilities/);
  assert.match(guidance, /requires_capabilities/);
  assert.match(guidance, /supports_background/);
});

test("workflow and discover docs describe skill-attached automation and registry-first discovery", () => {
  const workflow = read("skills/workflow/SKILL.md");
  const discover = read("skills/discover/SKILL.md");

  assert.match(workflow, /skill-attached task/i);
  assert.match(workflow, /background-ready/i);
  assert.match(discover, /official\/local\/verified registry/i);
  assert.match(discover, /registry-first/i);
});

test("memory architecture reference separates project, identity, and recall layers", () => {
  const referencePath = path.join(root, "references", "memory-architecture.md");
  assert.equal(existsSync(referencePath), true, "memory architecture reference should exist");

  const reference = read("references/memory-architecture.md");
  assert.match(reference, /Project Memory/);
  assert.match(reference, /Soul Identity/);
  assert.match(reference, /Session Recall/);
  assert.match(reference, /MMBridge Memory/);
});

test("companion daemon design spec captures substrate responsibilities", () => {
  const specPath = path.join(
    root,
    "docs",
    "superpowers",
    "specs",
    "2026-03-23-companion-daemon-design.md"
  );
  assert.equal(existsSync(specPath), true, "companion daemon design spec should exist");

  const spec = read("docs/superpowers/specs/2026-03-23-companion-daemon-design.md");
  assert.match(spec, /scheduler/i);
  assert.match(spec, /background runs/i);
  assert.match(spec, /notification routing/i);
  assert.match(spec, /session recall index/i);
});
