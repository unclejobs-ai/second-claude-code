---
name: capture
description: "Knowledge capture — URL, text, file to structured storage with PARA classification"
---

# Capture

Capture any input -- URL, text, file, conversation excerpt -- extract key insights, classify using PARA, and store in the knowledge base. Implements the CODE pipeline (Capture, Organize, Distill, Express).

## When to Use

- User shares a URL, article, or reference to save for later
- Conversation produces an insight worth preserving
- Building a knowledge base for a project or research area
- Another skill (e.g., `/scc:research`) produces findings to archive

## Internal Flow

```
input (URL / text / file / clipboard)
        │
        ▼
source recognition ──► URL? ──► WebFetch + extract
        │                        │
        ├──► text? ──► direct ───┤
        │                        │
        └──► file? ──► Read ─────┘
                                 │
                                 ▼
                    analyst(haiku) ──► Reduce to 3 key points
                                 │
                                 ▼
                    connector(haiku) ──► Reflect: link to existing knowledge
                                 │
                                 ▼
                    PARA classification ──► store as JSON
```

### Step-by-Step

1. **Source recognition**: Detect input type. URL triggers WebFetch/crawl. File path triggers Read. Raw text is used directly. Clipboard triggers paste capture.
2. **Extract**: Pull the substantive content from the source. Strip navigation, ads, boilerplate. Keep the signal.
3. **Reduce** (haiku model): Distill to exactly 3 key points. No more. This forces prioritization over completeness.
4. **Reflect** (haiku model): Search existing knowledge store for related entries. Identify shared concepts, contradictions, or extensions. Require specific shared concepts -- no vague "related to" connections.
5. **Classify**: Apply PARA category based on clear criteria (see below). Add relevant tags.
6. **Store**: Write structured JSON to the knowledge directory.

## PARA Classification Criteria

| Category | Criteria | Example |
|----------|----------|---------|
| **Project** | Has a deadline or deliverable. Active, time-bound. | "AI newsletter launch - March 2026" |
| **Area** | Ongoing responsibility. No end date. | "Claude Code best practices" |
| **Resource** | Reference material. Useful but not actionable now. | "Research paper on RAG architectures" |
| **Archive** | Inactive. Completed or no longer relevant. | "Old competitor analysis Q4 2025" |

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--tags` | `"tag1,tag2"` | auto-generated | Override auto-tagging |
| `--category` | `project\|area\|resource\|archive` | auto-classified | Override PARA classification |
| `--search` | `"query"` | -- | Search stored knowledge instead of capturing |
| `--connect` | `true\|false` | `true` | Enable/disable connection to existing entries |

## Storage Format

Path: `${CLAUDE_PLUGIN_DATA}/knowledge/{para-category}/{slug}.json`

```json
{
  "title": "Iterative Research Patterns in AI Agents",
  "source": "https://example.com/article",
  "source_type": "url",
  "captured_at": "2026-03-19T10:00:00Z",
  "category": "resource",
  "tags": ["ai-agents", "research-patterns", "iteration"],
  "summary": "Survey of how AI agents implement multi-round research loops with quality gates.",
  "key_points": [
    "Gap-analysis between rounds improves coverage by 40% vs single-pass",
    "Quality scoring enables keep/discard decisions per iteration",
    "Session persistence is critical for long research tasks"
  ],
  "connections": [
    {
      "entry": "resource/karpathy-autoresearch",
      "relation": "extends",
      "shared_concept": "iterative gap-filling search pattern"
    }
  ],
  "raw_excerpt": "(first 500 chars of source for provenance)"
}
```

## Search

`/scc:capture --search "query"` scans all stored JSON files:

- Full-text search across title, summary, key_points, and tags
- Returns ranked results with relevance snippets
- Supports tag filtering: `--search "RAG" --tags "ai-agents"`

## Gotchas

These failure modes are common. The skill design explicitly counters each one.

| Failure Mode | Mitigation |
|-------------|------------|
| Captures everything verbatim | Reduce step enforces max 3 key points. Analyst must prioritize, not transcribe. |
| Wrong PARA classification | Clear criteria table above. Project requires a deadline. Area requires ongoing responsibility. When ambiguous, default to Resource. |
| Superficial connections | Connector must name the specific shared concept. "Related to X" is rejected. Must be "shares concept Y with X". |
| Duplicate entries | Check for existing entries with same source URL or >80% title similarity before creating new entry. |
| Stale knowledge | Entries older than 6 months without access auto-move to Archive on next search. |

## Patterns Absorbed

- **Tiago Forte CODE**: Capture, Organize, Distill, Express -- the full knowledge management pipeline
- **Ars Contexta 6Rs**: Record (capture), Reduce (3 key points), Reflect (connections) -- the first three Rs
- **PARA method**: Project, Area, Resource, Archive -- clear organizational taxonomy with actionable criteria

## Subagent Dispatch

```yaml
analyst:
  model: haiku
  tools: [WebFetch]
  constraint: "max 3 key points, no verbatim copying, must prioritize"

connector:
  model: haiku
  tools: [Glob, Read]
  constraint: "search existing knowledge, require specific shared concepts"
```

## Integration

- Called by `/scc:research` to store findings for future reference
- Called by `/scc:pipeline` as a capture step in automated workflows
- Knowledge store is searchable by all other skills via `--search`
