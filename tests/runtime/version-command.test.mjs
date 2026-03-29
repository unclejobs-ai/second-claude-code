import test from "node:test";
import assert from "node:assert/strict";

import command from "../../commands/version.mjs";

test("version command returns the plugin semver version", async () => {
  const version = await command.execute();

  assert.equal(typeof version, "string");
  assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/);
});
