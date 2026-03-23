# Collect: Formats, Quality Gates & Search

## Markdown Template

```markdown
---
title: "..."
source: "..."
source_type: url | text | file | search
category: project | area | resource | archive
tags: [tag1, tag2, tag3]
collected_at: "YYYY-MM-DDTHH:mm:ssZ"
---

## Summary

(2-3 sentences max)

## Key Points

1. ...
2. ...
3. ...

## Connections

- **[target item title]**: [specific shared principle, pattern, or concept]
```

## Connection Quality Gate

A connection must name a **specific principle, pattern, or concept** — not a topic or domain.

| Quality | Example | Verdict |
|---------|---------|---------|
| Good | "Both use the Zettelkasten principle of atomic notes" | Pass |
| Good | "Shares the PARA classification heuristic for active vs reference" | Pass |
| Good | "Both apply progressive summarization layer 2 (bold key passages)" | Pass |
| Bad | "Related to knowledge management" | Fail — topic, not concept |
| Bad | "Also about productivity" | Fail — domain, not pattern |
| Bad | "Similar content" | Fail — says nothing specific |

If no specific connection exists, set `connections` to an empty array rather than forcing a vague one.

## Search Ranking

Results are scored by match location with the following weights:

| Match Location | Weight | Example |
|----------------|--------|---------|
| Exact tag match | 10 | query `"zettelkasten"` matches tag `zettelkasten` |
| Title substring | 7 | query `"atomic"` found in title `"Atomic Habits Summary"` |
| Key point match | 4 | query `"spaced repetition"` found in a key point |
| Summary match | 2 | query `"retrieval"` found in summary text |

When multiple matches occur in the same item, scores are summed. Results are returned in descending score order. Ties are broken by `collected_at` (newest first).
