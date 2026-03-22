---
name: soul
description: "Observe user patterns and synthesize a persistent identity profile (SOUL.md)"
effort: high
---

# Soul

Build and maintain a persistent user identity profile from behavioral signals observed across sessions. Every claim in SOUL.md must be evidence-backed. Contradictions become conditional rules, not averages.

## When to Use

- User wants a persistent identity profile synthesized from session history
- User wants to understand their own patterns and behavioral tendencies
- Another skill needs user context that goes beyond project preferences
- User wants to track how their communication style or decision patterns shift over time

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `init` | Bootstrap a fresh observation log and SOUL.md stub from a template |
| `learn` | Record new observations from the current session into the observation log |
| `show` | Display current SOUL.md with evidence citations |
| `propose` | Run full synthesis and output a proposed SOUL.md diff — does not write yet |
| `apply` | Write the proposed SOUL.md to `.data/soul/SOUL.md` after user review |
| `diff` | Compare current SOUL.md against a proposed version, highlighting changes |
| `reset` | Archive current SOUL.md and start a fresh observation log |

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--mode` | `manual\|learning\|hybrid` | `hybrid` | manual = only user-triggered; learning = auto-observe every session; hybrid = auto-observe + user-triggered synthesis |
| `--template` | `default\|developer\|writer\|researcher` | `default` | Starter template for `init` |
| `--import` | file path | none | Import observations from an external file into the log |

### Mode Behavior

- **manual**: Observations are only recorded when user explicitly calls `soul learn`. No automatic logging.
- **learning**: SessionStart hook adds a learn call to every session automatically. Synthesis still requires explicit `soul propose`.
- **hybrid**: Same as learning, plus prompts for synthesis after every 10th new observation.

## Workflow

### `init`

1. Check if `.data/soul/` already exists — if so, warn user and require explicit `--force` flag
2. Load template from `references/templates/{template}.md`
3. Create `.data/soul/SOUL.md` (stub from template, all fields empty/TBD)
4. Create `.data/soul/observations.jsonl` (empty log)
5. Write init timestamp and template name to `.data/soul/meta.json`

### `learn`

1. Dispatch **analyst** (Alakazam, sonnet) to scan the current session for signals matching `references/observation-signals.md` catalog
2. Analyst returns structured observations in the format: `{ signal_type, context, raw_text, inferred_pattern, session_id, timestamp }`
3. Validate: reject observations missing `signal_type` or `raw_text`
4. Append valid observations to `.data/soul/observations.jsonl`
5. Report count: "Added N observations (total: M)"

### `show`

1. Read `.data/soul/SOUL.md`
2. For each dimension, load supporting observations from `observations.jsonl` by citation ID
3. Render SOUL.md with evidence citations inline
4. Report observation log stats: total count, last 5 session IDs, oldest/newest timestamps

### `propose`

1. Check minimum threshold: `observations.jsonl` must contain ≥10 sessions OR ≥30 observations. If below threshold, output gap report and stop.
2. Dispatch **soul-keeper** (Pikachu, opus) with full observation log + current SOUL.md (if exists)
3. Soul-keeper applies synthesis algorithm from `references/synthesis-algorithm.md`
4. Output proposed SOUL.md with full evidence citations
5. If current SOUL.md exists: run `diff` automatically and surface any dimension with >30% shift
6. Do NOT write to file — output is for review only

### `apply`

1. Require that `propose` has been run in this session (check for proposed output in conversation)
2. Prompt user: "Apply this soul update? This will overwrite `.data/soul/SOUL.md`. [yes/no]"
3. On yes: write proposed SOUL.md to `.data/soul/SOUL.md`, append apply event to `meta.json`
4. On no: discard proposed output, leave current SOUL.md unchanged

### `diff`

1. Read current `.data/soul/SOUL.md`
2. Read proposed SOUL.md from argument or current session output
3. Diff dimension-by-dimension: new dimensions, removed dimensions, changed characterizations
4. Flag any dimension with semantic shift >30% (see `references/synthesis-algorithm.md` for drift detection)
5. Output side-by-side table

### `reset`

1. Require explicit confirmation: "This will archive your current SOUL.md and start fresh. [yes/no]"
2. On yes: move `.data/soul/SOUL.md` to `.data/soul/archive/SOUL-{timestamp}.md`, clear `observations.jsonl`, reset `meta.json`
3. Template is preserved — only observations and synthesized soul are cleared

## Storage

> **Data directory**: `.data/soul/` relative to the plugin root. Create with `mkdir -p` before writing.

| File | Description |
|------|-------------|
| `.data/soul/SOUL.md` | The synthesized soul document |
| `.data/soul/observations.jsonl` | Append-only observation log (one JSON object per line) |
| `.data/soul/meta.json` | Init timestamp, template, last synthesis date, observation count |
| `.data/soul/archive/` | Archived soul versions from `reset` calls |

### Observation Log Entry Format

```json
{
  "id": "obs-{timestamp}-{n}",
  "session_id": "session-{YYYY-MM-DD}-{topic-slug}",
  "signal_type": "correction|style|expertise|decision|emotional",
  "context": "brief description of what was happening",
  "raw_text": "exact quote or paraphrase of the signal",
  "inferred_pattern": "what this reveals about the user",
  "timestamp": "ISO-8601",
  "weight": 1
}
```

## Subagents

```yaml
soul-keeper: { model: opus, agent: pikachu, constraint: "every dimension needs 2+ evidence citations, contradictions become conditional rules, generic descriptions are rejected" }
analyst: { model: sonnet, agent: alakazam, constraint: "extract signals matching observation catalog, return structured JSON, no inferences beyond what the signal supports" }
```

## Gotchas

### Generic Soul Trap
The most common failure: producing dimensions that could describe any knowledge worker. soul-keeper must run the anti-generic filter on every dimension before output. If a dimension reads like a LinkedIn bio, it is rejected.

### Token Budget
Observation logs can grow large. When calling soul-keeper, summarize observations older than 30 days to a single paragraph per session. Only the last 5 sessions are passed verbatim. Total input to soul-keeper must not exceed 500 tokens of observation data per session in the summary window.

### Contradiction Handling
A user who is "direct in chat but verbose in reports" is NOT contradictory — those are conditional behaviors. Do not force a single characterization. The conditional rule format preserves predictive power; averaging destroys it.

### Privacy
SOUL.md must never contain medical data, financial details, relationship status, or political/religious beliefs unless the user explicitly provides them as work-relevant context. If a sensitive signal is observed, note "sensitive signal omitted" in the observation log without recording the content.

### Drift Approval
A >30% shift in any dimension is not automatically applied. It requires explicit user acknowledgment. Surface it visibly in `propose` output with the phrase "SIGNIFICANT DRIFT DETECTED" before applying.

## Output

- SOUL.md at `.data/soul/SOUL.md`
- Template reference at `references/templates/`
- Observation signals reference at `references/observation-signals.md`
- Synthesis algorithm at `references/synthesis-algorithm.md`
