import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const examplesDir = path.join(root, "references", "hermes", "examples");

test("hermes example payloads are valid JSON and include required keys", () => {
  const files = readdirSync(examplesDir).filter((file) => file.endsWith(".json"));
  assert.ok(files.length >= 3);

  for (const file of files) {
    const parsed = JSON.parse(readFileSync(path.join(examplesDir, file), "utf8"));
    assert.equal(typeof parsed.cwd, "string");
    assert.equal(typeof parsed.task, "string");
    assert.equal(Array.isArray(parsed.acpx.roles), true);
    assert.equal(parsed.acpx.roles.length >= 1, true);
    assert.equal(typeof parsed.mmbridge.enabled, "boolean");
  }
});
