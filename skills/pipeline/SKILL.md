---
name: pipeline
description: "Custom workflow builder — chain skills into reusable automation pipelines"
---

# Pipeline

Create, save, and run multi-step workflows that chain `/scc:*` skills together. Each pipeline is a reusable automation sequence stored as JSON.

## When to Use

- A recurring workflow involves 3+ skill invocations in sequence
- User wants to automate a repeatable process (e.g., weekly newsletter)
- Building a custom content or research pipeline

## Subcommands

| Command | Usage | Effect |
|---------|-------|--------|
| `create` | `/scc:pipeline create "name"` | Interactive builder -- define steps one by one |
| `run` | `/scc:pipeline run "name"` | Execute a saved pipeline |
| `list` | `/scc:pipeline list` | Show all saved pipelines with last-run dates |
| `show` | `/scc:pipeline show "name"` | Display pipeline steps and configuration |
| `delete` | `/scc:pipeline delete "name"` | Remove a saved pipeline |

## Internal Flow

```
create/load pipeline definition
        │
        ▼
    step 1: skill(args) ──► output file
        │
        ▼ (output feeds next step)
    step 2: skill(args) ──► output file
        │
        ▼
    ...repeat...
        │
        ▼
    step N: skill(args) ──► final output
        │
        ▼
    pipeline complete ──► summary report
```

### Execution Model

Each step runs as a fresh subagent (Ars Contexta queue pattern). Steps share data through output files, not memory. Previous step output is passed as input to the next step via the filesystem.

## Pipeline Definition Format

Stored at `${CLAUDE_PLUGIN_DATA}/pipelines/{name}.json`:

```json
{
  "name": "weekly-digest",
  "steps": [
    {
      "skill": "research",
      "args": {"topic": "weekly AI news", "depth": "medium"},
      "output": "research-brief.md",
      "on_fail": "abort"
    },
    {
      "skill": "write",
      "args": {"type": "newsletter", "voice": "mentor"},
      "input_from": "research-brief.md",
      "output": "newsletter-draft.md",
      "on_fail": "abort"
    },
    {
      "skill": "review",
      "args": {"preset": "content"},
      "input_from": "newsletter-draft.md",
      "output": "review-feedback.md",
      "on_fail": "skip"
    },
    {
      "skill": "loop",
      "args": {"target": "4.5+", "max": 2},
      "input_from": "newsletter-draft.md",
      "output": "newsletter-final.md",
      "on_fail": "retry"
    }
  ],
  "created_at": "2026-03-19T10:00:00Z",
  "last_run": "2026-03-19T15:30:00Z",
  "run_count": 3
}
```

### Error Handling per Step

| `on_fail` | Behavior |
|-----------|----------|
| `abort` | Stop pipeline. Preserve all previous step outputs. |
| `skip` | Log warning, continue to next step without output. |
| `retry` | Retry once with same inputs. Abort on second failure. |

## Example: Weekly Digest (shorthand)

```
research "weekly AI news" --depth medium → write newsletter --voice mentor → review --preset content → loop --target "4.5+" --max 2
```

## State Persistence

Execution state saves to `${CLAUDE_PLUGIN_DATA}/pipelines/{name}-run.json` with fields: `{pipeline, status, current_step, completed_steps[], started_at}`. If a session ends mid-pipeline, the next session detects this file and resumes from the last completed step. All step outputs are on disk and survive interruption.

## Constraints

- Max 10 steps per pipeline. Each step must declare an `output` file.
- Steps share no memory -- only files. Pipeline names must be unique.

## Gotchas

These failure modes are common. The skill design explicitly counters each one.

| Failure Mode | Mitigation |
|-------------|------------|
| Steps share no memory | Data passes exclusively through output files. Each step reads its `input_from` file. |
| Session ends mid-pipeline | Run state persists to JSON. Resumes from last completed step on next session. |
| Error in step N loses previous work | All step outputs are written to disk immediately. Previous outputs survive regardless of later failures. |
| Infinite pipeline | Hard cap of 10 steps enforced at creation time. |
| Steps produce incompatible output | Pipeline validation checks that each step's `output` matches the next step's `input_from`. |

## Patterns Absorbed

- **Academy Shorts 4-stage pipeline**: Research, write, review, loop -- the canonical content pipeline
- **Ars Contexta queue orchestration**: Fresh subagent per step, output-file handoff, session-safe state
- **Octopus /octo:factory**: Named pipeline templates with create/run/list/delete lifecycle

## Subagent Dispatch

```yaml
orchestrator:
  model: sonnet
  tools: [Read, Write, Bash]
  constraint: "execute steps sequentially, save state after each step"

step_executor:
  model: varies (per skill)
  tools: per skill definition
  constraint: "fresh context per step, read input file, write output file"
```

## Integration

- Calls any `/scc:*` skill as a pipeline step
- Called by user directly for automation workflows
- Pipeline definitions are portable -- can be shared as JSON files
