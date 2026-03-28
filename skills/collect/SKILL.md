---
name: collect
description: "Use when collecting URLs, notes, files, or excerpts into structured PARA knowledge"
effort: low
---

## Iron Law

> **Collected knowledge must always be classified.**

## Red Flags

- "I can write tests later" → STOP. Write them now.
- "This change is too small to review" → STOP. Small bugs become P0 incidents.
- "I don't need to check previous cycle insights" → STOP. You will repeat the same mistake.
- "This is good enough" → STOP. Check the checklist.
- "No time to follow every step" → STOP. Skipped steps cost 3x more later.

# Collect

Collect a source, reduce it, connect it to existing knowledge, and store it in a PARA-shaped knowledge base.

## When to Use

- Save a URL, note, file, or excerpt for later use
- Preserve a useful insight from the current conversation
- Archive findings from another skill such as `/second-claude-code:research`

## Workflow

0. **Check existing knowledge**: search `${CLAUDE_PLUGIN_DATA}/knowledge/` for items with overlapping tags or titles before creating a new entry. If a duplicate exists, update it instead of creating a new one.
1. Detect source type: URL, raw text, file path, or search request.
2. **Dispatch analyst subagent** (extract + reduce): Extract the useful content, strip boilerplate, produce exactly 3 key points and a short summary. This MUST run as a separate subagent, not inline.
3. **Dispatch connector subagent** (find shared concept): Using only the stored knowledge base (not the analyst's output framing), find a specific shared concept connecting the new item to existing knowledge. This MUST run as a separate subagent to prevent bias from the analyst's framing.
4. Merge analyst and connector outputs.
5. Classify it into PARA and save structured JSON + markdown.
6. **Verify output**: Confirm JSON has all required fields, `key_points` has exactly 3 items, connections pass the quality gate. If any check fails, fix before saving.

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

> **Data directory**: `${CLAUDE_PLUGIN_DATA}` is set by the plugin system. If unavailable, fall back to `.data/` relative to the plugin root. Before writing state files, verify the directory exists with `mkdir -p`.

- Path: `${CLAUDE_PLUGIN_DATA}/knowledge/{para-category}/{slug}.json`
- Required fields: `title`, `source`, `source_type`, `collected_at`, `category`, `tags`, `summary`, `key_points`, `connections`
- `key_points` must contain exactly 3 items

## Dual Output

Each item is saved as `.json` (machine-readable index) and `.md` (YAML frontmatter + readable prose) at the same slug path. See `references/para-method.md` for the markdown template and search ranking weights.

## Connection Quality Gate

A connection must name a **specific principle, pattern, or concept** — not a topic or domain.

| PASS | FAIL |
|------|------|
| "Applies the Observer pattern — both use event-driven decoupling" | "Related to software design" |
| "Shares the PARA progressive summarization principle" | "Also about knowledge management" |
| "Uses the same cold-start mitigation as Netflix recommendations" | "Similar to AI" |

If no specific connection exists, set `connections` to an empty array. Never force a connection.

## Search Mode

Trigger: pass `--search "query"` instead of a source to retrieve rather than save.
Invocation: `/second-claude-code:collect --search "query"`
What it does: scans all stored JSON under `${CLAUDE_PLUGIN_DATA}/knowledge/`, ranks results by tag overlap and title similarity, and returns the top matches with their summary and PARA category.
See `references/para-method.md` for full ranking weights.

## Gotchas

- Do not store the source verbatim.
- Do not create vague connections like "related to AI."
- Do not create a new entry when an update to an existing entry would suffice.
- Do not skip the output verification step.
- When classification is ambiguous, default to `resource`.

## Subagents

```yaml
analyst: { model: haiku, tools: [WebFetch], constraint: "produce exactly 3 key points", dispatch: required }
connector: { model: haiku, tools: [Glob, Read], constraint: "name a specific shared concept", dispatch: required }
```

**Dispatch requirement**: Both subagents MUST be dispatched as separate agents (e.g., via `superpowers:dispatching-parallel-agents`). Running either inline violates isolation: the connector must not see the analyst's framing, only the raw source and existing knowledge base. If subagent dispatch is unavailable, run them sequentially with explicit context barriers — pass only the original source URL/text to the connector, never the analyst's summary.
