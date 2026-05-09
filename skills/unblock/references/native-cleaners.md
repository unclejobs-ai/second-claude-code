# Phase 0d — Native Cleaners

Some sites (Naver Blog, etc.) hide the article body inside an iframe.
Generic fetchers grab the wrapper page and miss the content. Phase 0d
fixes that with two steps:

1. **Rewrite the URL** to the page where the body actually lives.
2. **Extract the body** with a host-specific parser. Output is clean
   markdown — no nav, footer, sidebar, or paywall stub.

When a known host shows up, 0d runs first. If the parser doesn't find a
body, the chain falls through to 0a → 0b → … as usual.

## URL rewrite rules

Rules live in `engine/transforms.mjs` → `IFRAME_FRONTED_RULES`. The
rewrite is logged to `decisions[]` so callers can see what happened, and
the result keeps both the new `url` and the caller's `original_url`.

| Input | Output |
|-------|--------|
| `blog.naver.com/{id}/{logNo}` | `m.blog.naver.com/{id}/{logNo}` |
| `blog.naver.com/PostView.naver?blogId=…&logNo=…` | `m.blog.naver.com/{id}/{logNo}` |

Adding a rule: append a `{ label, test(host), rewrite(urlObj) }` entry.
`rewrite` returns a string URL, or `null` to skip.

## How a cleaner works

Each cleaner is one file: `engine/cleaners/<host>.mjs`. It exports a
function that takes raw HTML and returns markdown plus a few facts about
the post.

```js
extract(html, url) -> {
  ok: true,
  markdown: string,        // ready to render
  title: string,
  author: string | null,
  published: string | null,
  blocks: number,          // body block count
  chars: number,           // body character count
} | null                   // null = skip, fall through to 0a/0b/…
```

`engine/cleaners/index.mjs` lists which host uses which cleaner:

```js
const CLEANERS = [
  { name: "naver",   test: (host) => /(^|\.)blog\.naver\.com$/i.test(host), extract: extractNaverPost },
  { name: "tistory", test: (host) => /\.tistory\.com$/i.test(host),         extract: extractTistoryPost },
  { name: "brunch",  test: (host) => /^brunch\.co\.kr$/i.test(host),        extract: extractBrunchPost },
];
```

## Cleaners shipped

| Cleaner | Hosts | What it walks |
|---------|-------|---------------|
| `naver` | `*.blog.naver.com` (rewritten to `m.blog.naver.com`) | SmartEditor blocks: text, image, quote |
| `tistory` | `*.tistory.com` | `tt_article_useless_p_margin` / `article-view` / `entry-content` |
| `brunch` | `brunch.co.kr` | `wrap_body` → `wrap_item` / `cont` |

## Add a cleaner

1. Write `engine/cleaners/<host>.mjs`. Inside `extract`: strip scripts and
   styles, find the body container, walk it in document order, return
   markdown.
2. Add the host predicate to `engine/cleaners/index.mjs`.
3. Done. The chain picks it up automatically.

Look at `cleaners/naver.mjs` as a reference. ~100 lines, one regex per
block type.

## Real-world result

URL: `https://blog.naver.com/balahk/224279392527`

| | Without 0d | With 0d |
|---|---|---|
| What came back | 314 B (just an iframe warning) | 2,289 chars of clean markdown |
| Time | ~1100 ms | 148 ms |
| Has the actual article? | No | Yes |
| Metadata (author, date) | None | Both |
