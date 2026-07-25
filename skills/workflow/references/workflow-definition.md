# Workflow: Definition Schema & Examples

## Step Definition

Each step in a workflow definition is a JSON object with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `skill` | string | yes | Valid `/scc:*` command name |
| `args` | string | no | Arguments passed to the skill (supports `{{variables}}`) |
| `input_from` | string \| string[] | no | The `output` **file path** of an earlier step. Pass an array to read several. |
| `output` | string | yes | File path where this step writes its result |
| `parallel` | boolean | no | If `true`, runs concurrently with adjacent parallel steps (default: `false`) |
| `on_fail` | string | no | `"abort"` stops the pipeline, `"retry"` re-runs the step, `"continue"` moves on |
| `name` | string | no | Human-readable step name (auto-generated from skill if omitted) |

> `input_from` takes a **file path, not a step name** — `tests/runtime/plugin-smoke.test.mjs`
> validates every value against the set of `output` paths declared by earlier steps, and that check
> is the only enforcement there is. This table previously described step names and an
> `on_fail` vocabulary of `stop`/`skip`, neither of which any template or test ever used.
>
> Because the comparison is literal, an `input_from` written with `{{variables}}` must resolve to
> the *same string* as the producing step's `output`. Copy the producer's `output` verbatim rather
> than rebuilding the path by hand.

## Variable Resolution Order

Variables in `args`, `output`, and `input_from` fields are resolved **once at run start** in this order:

1. **Runtime flags** — `--topic`, `--output_dir`, `--var key=value` from the `run` command
2. **Definition defaults** — `defaults` object in the workflow JSON
3. **Built-in variables** — `{{date}}` (YYYY-MM-DD), `{{run_id}}` (name-timestamp)

If any `{{variable}}` remains unresolved after all three passes, the workflow aborts with an error listing the unresolved tokens.

## Variable Value Safety Constraint

Variable values are **positional content strings**. They are interpolated literally into the `args` string as a single value unit — they must not contain embedded flag sequences that alter the command's argument structure.

**Validation rule**: Before interpolation, every resolved variable value is checked against the pattern `--[a-zA-Z][-a-zA-Z0-9_]*`. If a match is found, the workflow run is aborted immediately with an error identifying the offending variable and value.

**Rationale**: A value like `"AI trends --publish notion"` would expand `{{topic}} --depth medium` into `AI trends --publish notion --depth medium`, injecting an unintended `--publish` flag into the step. This constraint closes that injection vector.

**Correct usage**: Pass flag-like intent as separate named variables, not embedded in topic or value strings.

```json
// WRONG — injects --publish flag into write step's args
{ "run": "workflow run autopilot --topic \"AI trends --publish notion\"" }

// CORRECT — keep flags and topic content separate
{ "run": "workflow run autopilot --topic \"AI trends\" --var publish_target=notion" }
```

## Workflow JSON Schema

```json
{
  "name": "my-workflow",
  "description": "What this workflow does",
  "steps": [
    {
      "name": "research",
      "skill": "/scc:research",
      "args": "{{topic}} --depth medium",
      "output": "{{output_dir}}/{{run_id}}-research.md"
    },
    {
      "name": "write",
      "skill": "/scc:write",
      "args": "--format newsletter --skip-research --skip-review --input {{output_dir}}/{{run_id}}-research.md",
      "input_from": "{{output_dir}}/{{run_id}}-research.md",
      "output": "{{output_dir}}/{{run_id}}-draft.md"
    },
    {
      "name": "review",
      "skill": "/scc:review",
      "args": "{{output_dir}}/{{run_id}}-draft.md --preset content",
      "input_from": "{{output_dir}}/{{run_id}}-draft.md",
      "output": "{{output_dir}}/{{run_id}}-review.md"
    }
  ],
  "defaults": {
    "output_dir": "./output"
  }
}
```

## Preset Definitions

### autopilot

```json
{
  "steps": [
    { "skill": "/scc:research", "args": "{{topic}} --depth medium", "output": "research.md" },
    { "skill": "/scc:analyze", "args": "--framework swot {{topic}} --input research.md", "input_from": "research.md", "output": "analysis.md" },
    { "skill": "/scc:write", "args": "--format newsletter --skip-research --skip-review --input research.md", "input_from": "research.md", "output": "draft.md" },
    { "skill": "/scc:review", "args": "draft.md --preset content", "input_from": "draft.md", "output": "review.md" },
    { "skill": "/scc:refine", "args": "--file draft.md --review review.md --max 3", "input_from": ["draft.md", "review.md"], "output": "final.md" }
  ]
}
```

Note: The `write` step passes `--skip-research` and `--skip-review` because research and review are handled as separate workflow steps.

### quick-draft

```json
{
  "steps": [
    { "skill": "/scc:research", "args": "{{topic}} --depth shallow", "output": "research.md" },
    { "skill": "/scc:write", "args": "--format newsletter --skip-research --input research.md", "input_from": "research.md", "output": "draft.md" }
  ]
}
```

### quality-gate

```json
{
  "steps": [
    { "skill": "/scc:review", "args": "{{topic}} --preset content", "output": "review.md" },
    { "skill": "/scc:refine", "args": "--file {{topic}} --review review.md --max 3", "input_from": "review.md", "output": "final.md" }
  ]
}
```

## State Schema

Active workflow state is saved at `${CLAUDE_PLUGIN_DATA}/state/workflow-active.json`:

```json
{
  "workflow_name": "my-workflow",
  "run_id": "my-workflow-20260320T120000",
  "started_at": "2026-03-20T12:00:00Z",
  "resolved_vars": { "topic": "AI agents", "date": "2026-03-20", "output_dir": "./output" },
  "steps": [
    { "name": "research", "status": "done", "output": "./output/research.md", "completed_at": "..." },
    { "name": "write", "status": "running", "output": null, "started_at": "..." },
    { "name": "review", "status": "pending", "output": null }
  ],
  "current_step": 1
}
```

Step `status` values: `pending`, `running`, `done`, `failed`, `skipped`.

On resume, the orchestrator reads this file and continues from the first non-`done` step, reusing `resolved_vars` from saved state (not re-resolving from flags).
