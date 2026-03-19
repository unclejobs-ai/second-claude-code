---
name: collect
description: "Use when collecting URLs, notes, files, or excerpts into structured PARA knowledge"
---

# Collect

Collect a source, reduce it, connect it to existing knowledge, and store it in a PARA-shaped knowledge base.

## When to Use

- Save a URL, note, file, or excerpt for later use
- Preserve a useful insight from the current conversation
- Archive findings from another skill such as `/second-claude-code:research`

## Workflow

1. Detect source type: URL, raw text, file path, or search request.
2. **Dispatch analyst subagent** (extract + reduce): Extract the useful content, strip boilerplate, produce exactly 3 key points and a short summary. This MUST run as a separate subagent, not inline.
3. **Dispatch connector subagent** (find shared concept): Using only the stored knowledge base (not the analyst's output framing), find a specific shared concept connecting the new item to existing knowledge. This MUST run as a separate subagent to prevent bias from the analyst's framing.
4. Merge analyst and connector outputs.
5. Classify it into PARA and save structured JSON + markdown.

## PARA Criteria

| Category | Rule |
|----------|------|
| `project` | Active work with a deadline or deliverable |
| `area` | Ongoing responsibility |
| `resource` | Reference material |
| `archive` | Inactive material |

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--tags` | `"tag1,tag2"` | auto |
| `--category` | `project\|area\|resource\|archive` | auto |
| `--search` | `"query"` | off |
| `--connect` | `true\|false` | `true` |

## Storage

- Path: `${CLAUDE_PLUGIN_DATA}/knowledge/{para-category}/{slug}.json`
- Required fields: `title`, `source`, `source_type`, `collected_at`, `category`, `tags`, `summary`, `key_points`, `connections`
- `key_points` must contain exactly 3 items

## Dual Output

Each collected item is saved in two formats:

| Format | Purpose | Path |
|--------|---------|------|
| `.json` | Machine-readable search index | `${CLAUDE_PLUGIN_DATA}/knowledge/{category}/{slug}.json` |
| `.md` | Human-readable note | `${CLAUDE_PLUGIN_DATA}/knowledge/{category}/{slug}.md` |

The markdown file uses YAML frontmatter for metadata and renders the same key points and connections as readable prose.

See `references/para-method.md` for the markdown template, connection quality gate, and search ranking weights.

## Connection Quality Gate

A connection must name a **specific principle, pattern, or concept** -- not a topic or domain. If no specific connection exists, set `connections` to an empty array.

## Search

`/second-claude-code:collect --search "query"` scans stored JSON and returns ranked matches. See `references/para-method.md` for search ranking weights.

## Gotchas

- Do not store the source verbatim.
- Do not create vague connections like "related to AI."
- When classification is ambiguous, default to `resource`.

## Subagents

```yaml
analyst: { model: haiku, tools: [WebFetch], constraint: "produce exactly 3 key points", dispatch: required }
connector: { model: haiku, tools: [Glob, Read], constraint: "name a specific shared concept", dispatch: required }
```

**Dispatch requirement**: Both subagents MUST be dispatched as separate agents (e.g., via `superpowers:dispatching-parallel-agents`). Running either inline violates isolation: the connector must not see the analyst's framing, only the raw source and existing knowledge base. If subagent dispatch is unavailable, run them sequentially with explicit context barriers — pass only the original source URL/text to the connector, never the analyst's summary.
