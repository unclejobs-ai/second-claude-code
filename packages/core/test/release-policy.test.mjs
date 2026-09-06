import assert from "node:assert/strict";
import test from "node:test";

const policyPromise = import("../../../scripts/core-release-policy.mjs");

test("packed manifest policy rejects lifecycle execution and runtime dependencies", async () => {
  const { assertSafePackedManifest } = await policyPromise;
  const safe = {
    name: "@second-claude/core",
    version: "4.0.0",
    scripts: { build: "tsc -p tsconfig.json", test: "node --test" }
  };

  assert.doesNotThrow(() => assertSafePackedManifest(safe));
  for (const script of ["preinstall", "install", "postinstall", "prepare", "prepack"]) {
    assert.throws(
      () => assertSafePackedManifest({ ...safe, scripts: { ...safe.scripts, [script]: "node malicious.mjs" } }),
      new RegExp(`forbidden lifecycle script ${script}`)
    );
  }
  for (const dependencyField of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "bundledDependencies",
    "bundleDependencies"
  ]) {
    const value = dependencyField.includes("bundled") || dependencyField.includes("bundleD")
      ? ["unsafe-package"]
      : { "unsafe-package": "1.0.0" };
    assert.throws(
      () => assertSafePackedManifest({ ...safe, [dependencyField]: value }),
      new RegExp(`runtime dependency field ${dependencyField}`)
    );
  }
});
