import test from "node:test";
import assert from "node:assert/strict";
import { generateVariants, rootUrl, inferAcceptLanguage, inferReferrer } from "../../../skills/unblock/engine/transforms.mjs";

test("generateVariants produces m. subdomain swap when www. present", () => {
  const variants = generateVariants("https://www.example.com/article/1");
  const labels = variants.map((v) => v.url);
  assert.ok(labels.some((u) => u.startsWith("https://m.example.com/")));
});

test("generateVariants produces .json suffix variant", () => {
  const variants = generateVariants("https://example.com/post/abc");
  assert.ok(variants.some((v) => v.url.endsWith(".json")));
});

test("generateVariants produces /rss suffix variant", () => {
  const variants = generateVariants("https://example.com/blog");
  assert.ok(variants.some((v) => v.url.endsWith("/rss") || v.url.endsWith("/feed")));
});

test("rootUrl strips path", () => {
  assert.equal(rootUrl("https://example.com/foo/bar?x=1"), "https://example.com/");
});

test("inferAcceptLanguage maps TLD to language", () => {
  assert.ok(inferAcceptLanguage("https://example.kr/x").startsWith("ko-KR"));
  assert.ok(inferAcceptLanguage("https://example.jp/x").startsWith("ja-JP"));
  assert.ok(inferAcceptLanguage("https://example.com/x").startsWith("en-US"));
});

test("inferReferrer routes by TLD", () => {
  assert.ok(inferReferrer("https://blog.example.kr/x").includes("naver"));
  assert.ok(inferReferrer("https://example.com/x").includes("google"));
});

test("generateVariants handles invalid URL gracefully", () => {
  assert.deepEqual(generateVariants("not-a-url"), []);
});
