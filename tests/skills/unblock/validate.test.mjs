import test from "node:test";
import assert from "node:assert/strict";
import { validate, validateJson, stripHtml } from "../../../skills/unblock/engine/validate.mjs";

test("stripHtml removes scripts/styles/tags and collapses whitespace", () => {
  const html = `<html><head><style>body{}</style></head><body><script>x=1</script><p>Hello   World</p></body></html>`;
  assert.equal(stripHtml(html), "Hello World");
});

test("validate flags status >= 400", () => {
  const r = validate({ status: 403, headers: { "content-type": "text/html" }, body: "<html>" + "x".repeat(500) + "</html>" });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("status_403"));
});

test("validate flags challenge body even on 200", () => {
  const body = `<html><body>Just a moment...<div>cf-browser-verification</div>${"x".repeat(400)}</body></html>`;
  const r = validate({ status: 200, headers: { "content-type": "text/html" }, body });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("challenge_body"));
});

test("validate accepts long, clean HTML body", () => {
  const text = "Lorem ipsum dolor sit amet ".repeat(40);
  const body = `<html><body><article>${text}</article></body></html>`;
  const r = validate({ status: 200, headers: { "content-type": "text/html" }, body });
  assert.equal(r.ok, true);
  assert.equal(r.reasons.length, 0);
});

test("validate flags too-short body", () => {
  const r = validate({ status: 200, headers: { "content-type": "text/html" }, body: "<html><body>tiny</body></html>" });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("body_too_short") || r.reasons.includes("stripped_too_short"));
});

test("validateJson rejects non-JSON content type", () => {
  const r = validateJson({ status: 200, headers: { "content-type": "text/html" }, body: "{}" });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.includes("not_json_content_type"));
});

test("validateJson parses valid JSON", () => {
  const r = validateJson({ status: 200, headers: { "content-type": "application/json" }, body: '{"a":1}' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.parsed, { a: 1 });
});
