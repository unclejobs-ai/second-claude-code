# Phase 0d — URL Normalization & Native Cleaners

Phase 0d turns iframe-fronted blogs and similar hosts into the fastest-path
success in the chain. Two parts: a pre-chain URL rewrite and a host-specific
body extractor.

## URL normalization

Before any probe runs, hosts that hide their body inside an iframe shell are
rewritten to their canonical body URL. The rewrite is logged to
`decisions[]` with `action: "normalize"`, and both the rewritten `url` and
the caller's `original_url` appear on the result envelope.

Rules live in `engine/transforms.mjs` → `IFRAME_FRONTED_RULES`. Initial rule:

| From | To |
|------|----|
| `blog.naver.com/{id}/{logNo}` | `m.blog.naver.com/{id}/{logNo}` |
| `blog.naver.com/PostView.naver?blogId=…&logNo=…` | `m.blog.naver.com/{id}/{logNo}` |

To add a rule, append a `{ label, test(host), rewrite(urlObj) }` entry to
`IFRAME_FRONTED_RULES`. `rewrite` returns a string URL or `null` to skip.

## Phase 0d native cleaners

Host-dispatched body extractors that turn raw HTML into chrome-free
markdown — no nav, footer, sidebar, or paywall stub. When a cleaner matches,
0d runs first; when it fails the chain falls through to 0a → 0b → … as
usual.

Each cleaner lives in `engine/cleaners/<host>.mjs` and exports:

```js
extract(html, url) -> {
  ok: true,
  markdown: string,        // ready-to-render
  title: string,
  author: string | null,
  published: string | null,
  blocks: number,          // count of body components
  chars: number,           // body character length
} | null                   // returning null = no-match, fall through
```

`engine/cleaners/index.mjs` keeps the dispatch table:

```js
const CLEANERS = [
  { name: "naver",   test: (host) => /(^|\.)blog\.naver\.com$/i.test(host), extract: extractNaverPost },
  { name: "tistory", test: (host) => /\.tistory\.com$/i.test(host),         extract: extractTistoryPost },
  { name: "brunch",  test: (host) => /^brunch\.co\.kr$/i.test(host),        extract: extractBrunchPost },
];
```

### Shipped cleaners

| Cleaner | Hosts | Selectors |
|---------|-------|-----------|
| `naver` | `*.blog.naver.com` (after normalization → `m.blog.naver.com`) | SmartEditor `se-text-paragraph` / `se-image` / `se-quotation-line`, in document order |
| `tistory` | `*.tistory.com` | `tt_article_useless_p_margin` / `article-view` / `entry-content` / `tt-entry-content` |
| `brunch` | `brunch.co.kr` | `wrap_body` → `wrap_item` / `cont` / `text` |

## Adding a host

1. Write `engine/cleaners/<host>.mjs` with an `extract(html, url)` function
   matching the contract above. Strip scripts/styles, find the body
   container, walk content blocks in document order, return markdown.
2. Register the host predicate in `engine/cleaners/index.mjs`.
3. The orchestrator (`pickCleaner`, `phase0Order`) picks 0d up automatically.

## Effect (live measurement)

URL: `https://blog.naver.com/balahk/224279392527`

| | Before | After |
|---|---|---|
| Phase | 0b jina-reader | 0d native-clean |
| Body | 314 B (jina envelope only) | 2,289 chars chrome-free markdown |
| Latency | ~1100 ms | 148 ms (~7× faster) |
| Metadata | none | author, published, block count |
| Trace | — | `decisions: [normalize, reorder]` |
