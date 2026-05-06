import test from "node:test";
import assert from "node:assert/strict";
import { classifyIntent } from "../../../skills/unblock/engine/intent.mjs";

test("classifyIntent recognizes valid http URL", () => {
  const r = classifyIntent("https://example.com/path");
  assert.equal(r.kind, "url");
  assert.equal(r.host, "example.com");
});

test("classifyIntent treats bare keyword as keyword", () => {
  const r = classifyIntent("how to bypass cloudflare");
  assert.equal(r.kind, "keyword");
});

test("classifyIntent rejects empty input", () => {
  const r = classifyIntent("");
  assert.equal(r.kind, "invalid");
});

test("classifyIntent treats malformed URL as keyword", () => {
  const r = classifyIntent("ht://broken");
  assert.equal(r.kind, "keyword");
});
