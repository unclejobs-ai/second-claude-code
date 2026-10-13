import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker";

// Match the schema features used by pdca-state and exercise the supported
// provider independently of MCP transport. These checks also run with Node's
// --disallow-code-generation-from-strings flag.
test("interpreted schema validation retains nested types, bounds and required fields", () => {
  const validate = new CfWorkerJsonSchemaValidator().getValidator({
    type: "object",
    required: ["phase", "result"],
    properties: {
      phase: { type: "string", enum: ["plan", "do", "check", "act"] },
      result: {
        type: "object",
        required: ["sources_count"],
        properties: {
          sources_count: { type: "integer", minimum: 0 },
          average_score: { type: ["number", "null"] },
          critical_findings: { type: "array" },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  });
  const valid = { phase: "plan", result: { sources_count: 1, average_score: null, critical_findings: [] } };
  assert.equal(validate(valid).valid, true);
  assert.equal(validate(valid).data, valid);
  for (const invalid of [
    { result: { sources_count: 1 } },
    { phase: "invalid", result: { sources_count: 1 } },
    { phase: "plan", result: { sources_count: -1 } },
    { phase: "plan", result: { sources_count: 1.5 } },
    { phase: "plan", result: { sources_count: "1" } },
    { phase: "plan", result: { sources_count: 1, unexpected: true } },
    { ...valid, unexpected: true },
  ]) {
    const result = validate(invalid);
    assert.equal(result.valid, false);
    assert.equal(result.data, undefined);
    assert.equal(typeof result.errorMessage, "string");
  }
});

test("interpreted schema validation supports local refs, formats and declared dialect", () => {
  const validate = new CfWorkerJsonSchemaValidator().getValidator({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    required: ["contact"],
    properties: { contact: { $ref: "#/$defs/contact" } },
    $defs: { contact: { type: "string", format: "email" } },
  });
  assert.equal(validate({ contact: "maintainer@example.com" }).valid, true);
  assert.equal(validate({ contact: "not-an-email" }).valid, false);
  assert.equal(validate({ contact: 42 }).valid, false);
});

test("release bundle does not ship a string-executing JSON Schema compiler", () => {
  const bundle = readFileSync(new URL("../../mcp/pdca-state-server.bundle.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(bundle, /\b(?:eval\s*\(|new\s+Function\s*\()/);
  assert.doesNotMatch(bundle, /node_modules\/ajv(?:-formats)?\//);
  assert.match(bundle, /CfWorkerJsonSchemaValidator/);
});
