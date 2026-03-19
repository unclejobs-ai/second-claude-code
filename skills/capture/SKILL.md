---
name: capture
description: "Use when saving URLs, notes, files, or excerpts into structured PARA knowledge"
---

# Capture

Capture a source, reduce it, connect it to existing knowledge, and store it in a PARA-shaped knowledge base.

## When to Use

- Save a URL, note, file, or excerpt for later use
- Preserve a useful insight from the current conversation
- Archive findings from another skill such as `/second-claude-code:research`

## Workflow

1. Detect source type: URL, raw text, file path, or search request.
2. Extract the useful content and strip boilerplate.
3. Reduce it to exactly 3 key points and a short summary.
4. Connect it to existing knowledge through a specific shared concept.
5. Classify it into PARA and save structured JSON.

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
- Required fields: `title`, `source`, `source_type`, `captured_at`, `category`, `tags`, `summary`, `key_points`, `connections`
- `key_points` must contain exactly 3 items

## Search

`/second-claude-code:capture --search "query"` scans stored JSON and returns ranked matches across title, summary, key points, and tags.

## Gotchas

- Do not store the source verbatim.
- Do not create vague connections like "related to AI."
- When classification is ambiguous, default to `resource`.

## Subagents

```yaml
analyst: { model: haiku, tools: [WebFetch], constraint: "produce exactly 3 key points" }
connector: { model: haiku, tools: [Glob, Read], constraint: "name a specific shared concept" }
```
