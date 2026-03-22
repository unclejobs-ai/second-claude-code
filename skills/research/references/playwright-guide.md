# Playwright MCP — Quick Reference

Playwright MCP exposes a real Chromium browser as MCP tools. The researcher agent uses it as a fallback when `WebFetch` cannot retrieve readable content from a URL.

## Available Tools

### Navigation

| Tool | Signature | Description |
|------|-----------|-------------|
| `browser_navigate` | `browser_navigate(url: string)` | Load a URL in the browser. Waits for network idle before returning. |
| `browser_snapshot` | `browser_snapshot()` | Return the accessibility tree of the current page as structured text. |

### Interaction (for login walls and gated content)

| Tool | Signature | Description |
|------|-----------|-------------|
| `browser_click` | `browser_click(element: string)` | Click an element identified by its accessible label or role path. |
| `browser_type` | `browser_type(element: string, text: string)` | Type text into a form field identified by its accessible label. |

## Availability Check

Before using any Playwright tool, treat it as optional. If a call returns a tool-not-found error or MCP connection error, log the URL as unreachable in Gaps & Limitations and continue.

## Usage Patterns

### Pattern 1 — Basic fallback (most common)

```
# WebFetch failed on url
browser_navigate(url)
tree = browser_snapshot()
# Parse tree for headings, paragraphs, data cells
```

### Pattern 2 — SPA with lazy-loaded content

```
browser_navigate(url)
# Wait state is automatic (network idle)
tree = browser_snapshot()
# If key sections are missing, click to expand:
browser_click("Show more")
tree = browser_snapshot()   # re-snapshot after interaction
```

### Pattern 3 — Public login wall (cookie-gated preview)

```
browser_navigate(url)
tree = browser_snapshot()
# Locate the sign-in form:
browser_click("Sign in with Google")   # or equivalent accessible label
# If a free preview section exists above the fold, extract it now
# Do NOT attempt to bypass paywalls or authenticate with real credentials
```

### Pattern 4 — `--interactive` mode (force Playwright for all URLs)

When the `--interactive` flag is set, skip WebFetch entirely:

```
for each url in fetch_list:
    browser_navigate(url)
    tree = browser_snapshot()
    extract relevant content from tree
```

## Accessibility Tree Parsing

`browser_snapshot()` returns a tree like:

```
heading "Article Title" [level=1]
  paragraph "First paragraph text..."
  heading "Section 2" [level=2]
    paragraph "Section content..."
  table
    rowheader "Metric"  columnheader "Value"
    cell "Revenue"  cell "$4.2B"
```

Extraction strategy:
1. Collect all `heading` nodes as section markers.
2. Under each heading, collect `paragraph` text as body content.
3. For `table` nodes, extract `rowheader`/`columnheader`/`cell` values into key-value pairs.
4. Ignore `navigation`, `banner`, `contentinfo`, and `complementary` landmark roles — these are chrome, not content.

## Cost Controls

- **Hard cap**: 3 Playwright navigations per research round.
- Track the count. On reaching 3: stop Playwright fetches, note skipped URLs in Gaps & Limitations.
- Each `browser_navigate` + `browser_snapshot` pair counts as 1 navigation.
- Additional `browser_snapshot()` calls on the same loaded page do NOT count toward the cap.
- `browser_click` + `browser_snapshot` re-snapshot on the same page also does NOT count.

## Error Handling

| Error | Action |
|-------|--------|
| Tool not found / MCP unavailable | Log URL in Gaps & Limitations, continue without Playwright |
| Navigation timeout | Log URL as unreachable, continue |
| Empty accessibility tree | Log URL as JS-only with no accessible content, discard |
| Login required with no free preview | Log URL as paywalled, discard |
