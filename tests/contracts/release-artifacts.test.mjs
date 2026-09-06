import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

test("CI requires the bundled MCP artifact and notices to be tracked and drift-free", () => {
  const workflow = readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
  for (const artifact of ["mcp/pdca-state-server.bundle.mjs", "THIRD_PARTY_NOTICES.md"]) {
    assert.match(workflow, new RegExp(`git ls-files --error-unmatch ${artifact.replaceAll(".", "\\.")}`));
    assert.match(workflow, new RegExp(`git diff --exit-code --[^\\n]*${artifact.replaceAll(".", "\\.")}`));
    assert.equal(existsSync(path.join(root, artifact)), true, `${artifact} must exist in the release tree`);
  }
});

test("CI verifies the checked-in core tarball and checksum without regenerating them", () => {
  const workflow = readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
  const packageManifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  for (const artifact of [
    "packages/core/release/second-claude-core-4.0.0.tgz",
    "packages/core/release/second-claude-core-4.0.0.tgz.sha256",
  ]) {
    assert.match(workflow, new RegExp(`git ls-files --error-unmatch ${artifact.replaceAll(".", "\\.")}`));
    assert.equal(existsSync(path.join(root, artifact)), true, `${artifact} must exist in the release tree`);
  }
  assert.match(workflow, /npm run verify:core-release/);
  assert.equal(packageManifest.scripts["verify:core-release"], "node scripts/verify-core-release.mjs");

  const verifier = readFileSync(path.join(root, "scripts", "verify-core-release.mjs"), "utf8");
  assert.match(verifier, /createHash\("sha256"\)/);
  assert.match(verifier, /Buffer\.compare\(freshTarball, checkedTarball\)/);
  assert.doesNotMatch(verifier, /writeFile|rename|copyFile/);
});

test("npm test discovery stays portable across the supported Node CI matrix", () => {
  const workflow = readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
  const packageManifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

  assert.equal(packageManifest.scripts.test, "node --test");
  assert.equal(
    packageManifest.scripts["test:core"],
    "npm run verify:core-release && node --test packages/core/test/*.test.mjs"
  );
  assert.doesNotMatch(packageManifest.scripts.test, /\*\*|['"]/);
  assert.doesNotMatch(packageManifest.scripts["test:core"], /\*\*|['"]/);
  assert.match(workflow, /node-version:\s*\[20, 22\]/);
  assert.match(workflow, /name:\s*Full test suite\s*\n\s*run:\s*npm test/);
});

test("generated notices cover every dependency bundled into the MCP server", () => {
  const noticesPath = path.join(root, "THIRD_PARTY_NOTICES.md");
  assert.equal(existsSync(noticesPath), true);
  const notices = readFileSync(noticesPath, "utf8");
  const expectedPackages = [
    "@modelcontextprotocol/sdk",
    "ajv",
    "ajv-formats",
    "fast-deep-equal",
    "fast-uri",
    "json-schema-traverse",
    "zod",
    "zod-to-json-schema",
  ];
  for (const packageName of expectedPackages) {
    assert.match(notices, new RegExp(`^## ${packageName.replace("/", "\\/")}@`, "m"));
  }
  assert.match(notices, /Permission is hereby granted, free of charge/);
});

test("generated release artifacts use normalized line endings without trailing whitespace", () => {
  for (const artifact of ["mcp/pdca-state-server.bundle.mjs", "THIRD_PARTY_NOTICES.md"]) {
    const contents = readFileSync(path.join(root, artifact), "utf8");
    assert.doesNotMatch(contents, /\r/);
    assert.doesNotMatch(contents, /[ \t]+$/m);
    assert.equal(contents.endsWith("\n"), true, `${artifact} must end with a newline`);
  }
});
