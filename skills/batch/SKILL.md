---
name: batch
description: "Use when decomposing large tasks into independent parallel units"
effort: high
---

# Batch

Decompose large knowledge work tasks into independent parallel units, each executed in its own worktree.
Inspired by Claude Code's `/batch` command — designed for high-volume, homogeneous content production.

## When to Use

- User needs 5+ similar artifacts produced from distinct source material (e.g., 10 newsletter issues, 8 competitor analyses)
- The work has a clear unit of decomposition (by topic, by section, by competitor, by framework)
- Sequential execution would take too long and units do not depend on each other
- Output quality benefits from independent focus per unit rather than a shared context window

## Workflow

### 1. Analyze

Dispatch an Explore agent to understand the full scope of the request:
- How many units does the task naturally decompose into?
- What is the unit type: topic, competitor, framework, section, time period, persona?
- What skill handles each unit (default: `write`)?
- What shared context applies to all units (format, voice, audience, constraints)?

### 2. Decompose

Break the task into 2–10 independent units. Each unit specification must include:

```yaml
unit:
  id: <integer, 1-indexed>
  label: <short human-readable title>
  topic: <specific topic for this unit — no overlap with other units>
  skill: <write|research|analyze|review|refine>
  output: <file path: .captures/batch-{run_id}/{slug}.md>
  shared_context: <reference to shared context block>
```

**Independence requirements** (non-negotiable):
- Each unit produces a separate output file
- No unit uses another unit's output as input
- Units can complete in any order without inconsistency
- If a candidate unit depends on another unit's output → merge them into one unit or flag as sequential

**Unit count limits**:
- Minimum: 2 (batching 1 unit is a no-op)
- Default maximum: 10
- Override with `--units N`

### 3. Approve

Present the full decomposition plan to the user before any execution begins. This gate is mandatory — no exceptions.

Present as a table:

| # | Label | Topic | Skill | Output File |
|---|-------|-------|-------|-------------|
| 1 | ... | ... | write | .captures/batch-{run_id}/01-slug.md |
| 2 | ... | ... | write | .captures/batch-{run_id}/02-slug.md |

Show: total units, estimated cost (units × avg token cost), parallelism setting.

**Wait for explicit approval.** On rejection: re-decompose with user's feedback and re-present.

### 4. Execute

After approval, spawn one agent per unit. Each agent runs in an isolated worktree:

```yaml
isolation: worktree
worktree_path: worktree-batch-{run_id}-unit-{id}
```

Concurrency is capped at `--parallel` (default: 3). Units beyond the cap queue and start as slots open.

Each unit agent receives:
- The unit specification (topic, skill, output path)
- The shared context block
- The selected skill's full instruction set

### 5. Monitor

Track status per unit: `PENDING | RUNNING | DONE | FAILED`.

Print a live status table as units complete. On unit failure:
- Log the failure with the unit's error
- Continue remaining units (do not abort the batch)
- Collect all failures for the synthesis report

### 6. Synthesize

After all units complete (or time out), produce a Batch Summary Report:

```
## Batch Summary — {topic} ({YYYY-MM-DD})

Units: {done}/{total} completed
Failed: {failed_ids} (if any)

### Output Files
| # | Label | Status | Path |
|---|-------|--------|------|
...

### Synthesis
{Optional: if --synthesize is set, produce a combined document merging all outputs}

### Failures
{For each failed unit: label, error summary, recommended action}
```

Save report to `.captures/batch-{run_id}/00-summary.md`.

## Options

| Flag | Values | Default | Effect |
|------|--------|---------|--------|
| `--units N` | integer 2–20 | auto (up to 10) | Override max unit count |
| `--skill` | `write\|research\|analyze\|refine` | `write` | Skill each unit runs |
| `--topic` | string | (required) | The overarching topic being decomposed |
| `--parallel` | integer 1–5 | `3` | Max concurrent unit agents |
| `--synthesize` | flag | off | After all units complete, merge outputs into one document |
| `--lang` | `ko\|en` | `ko` | Output language passed to each unit skill |
| `--format` | write-skill formats | `article` | Passed to each unit's write skill |

## State

State persisted at `.data/state/batch-{run_id}.json`. Schema:

```json
{
  "run_id": "batch-{timestamp}",
  "topic": "...",
  "status": "PENDING | RUNNING | DONE | FAILED",
  "units": [...],
  "parallel": 3,
  "created_at": "ISO-8601",
  "completed_at": "ISO-8601 | null"
}
```

## Subagents

```yaml
explorer:   { model: haiku,  tools: [Read], constraint: "scope analysis only, no writing" }
decomposer: { model: sonnet, tools: [],     constraint: "produce unit specs, verify independence" }
unit_agent: { model: varies, isolation: worktree, constraint: "run assigned skill, write to assigned output path only" }
synthesizer: { model: opus,  tools: [Read, Write], constraint: "merge outputs faithfully, no hallucinated content" }
```

## Gotchas

- **Cost scales linearly**: 10 units × write skill cost = 10× a single write invocation. Always show estimated cost at the Approve gate.
- **Decomposition quality determines output quality**: Vague unit topics produce vague output. If the topic cannot be made specific, ask the user before decomposing.
- **Never skip the Approve gate**: Decomposition errors are cheap to fix before execution and expensive after.
- **Worktree cleanup**: After synthesis, discard unit worktrees. Do not leave orphaned worktrees.
- **No cross-unit dependencies**: If the user's requested task has inherent sequencing (e.g., part 2 builds on part 1's conclusion), this is not a batch job — route to `workflow` instead.
- **Partial failure is not total failure**: If 2 of 10 units fail, deliver the 8 successes and report the 2 failures clearly. Do not withhold completed work.

See `references/decomposition-guide.md` for split strategies, anti-patterns, and merge strategies.
