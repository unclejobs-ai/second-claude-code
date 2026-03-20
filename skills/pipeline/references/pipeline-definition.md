# Pipeline: Definition Schema & Examples

## Step Definition

Each step in a pipeline definition is a JSON object with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `skill` | string | yes | Valid `/second-claude-code:*` command name |
| `args` | string | no | Arguments passed to the skill (supports `{{variables}}`) |
| `input_from` | string | no | Step name whose `output` file becomes this step's input |
| `output` | string | yes | File path where this step writes its result |
| `parallel` | boolean | no | If `true`, runs concurrently with adjacent parallel steps (default: `false`) |
| `on_fail` | string | no | `"stop"` (default) or `"skip"` — behavior on step failure |
| `name` | string | no | Human-readable step name (auto-generated from skill if omitted) |

## Variable Resolution Order

Variables in `args` and `output` fields are resolved **once at run start** in this order:

1. **Runtime flags** — `--topic`, `--output_dir`, `--var key=value` from the `run` command
2. **Definition defaults** — `defaults` object in the pipeline JSON
3. **Built-in variables** — `{{date}}` (YYYY-MM-DD), `{{run_id}}` (name-timestamp)

If any `{{variable}}` remains unresolved after all three passes, the pipeline aborts with an error listing the unresolved tokens.

## Pipeline JSON Schema

```json
{
  "name": "my-pipeline",
  "description": "What this pipeline does",
  "steps": [
    {
      "name": "research",
      "skill": "research",
      "args": "{{topic}} --depth medium",
      "output": "{{output_dir}}/{{run_id}}-research.md"
    },
    {
      "name": "write",
      "skill": "write",
      "args": "--format newsletter --skip-research --skip-review --input {{output_dir}}/{{run_id}}-research.md",
      "input_from": "research",
      "output": "{{output_dir}}/{{run_id}}-draft.md"
    },
    {
      "name": "review",
      "skill": "review",
      "args": "{{output_dir}}/{{run_id}}-draft.md --preset content",
      "input_from": "write",
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
    { "skill": "research", "args": "{{topic}} --depth medium", "output": "research.md" },
    { "skill": "analyze", "args": "--framework swot {{topic}} --input research.md", "input_from": "research", "output": "analysis.md" },
    { "skill": "write", "args": "--format newsletter --skip-research --skip-review --input research.md", "input_from": "research", "output": "draft.md" },
    { "skill": "review", "args": "draft.md --preset content", "input_from": "write", "output": "review.md" },
    { "skill": "loop", "args": "--file draft.md --review review.md --max 3", "input_from": "review", "output": "final.md" }
  ]
}
```

Note: The `write` step passes `--skip-research` and `--skip-review` because research and review are handled as separate pipeline steps.

### quick-draft

```json
{
  "steps": [
    { "skill": "research", "args": "{{topic}} --depth shallow", "output": "research.md" },
    { "skill": "write", "args": "--format newsletter --skip-research --input research.md", "input_from": "research", "output": "draft.md" }
  ]
}
```

### quality-gate

```json
{
  "steps": [
    { "skill": "review", "args": "{{topic}} --preset content", "output": "review.md" },
    { "skill": "loop", "args": "--file {{topic}} --review review.md --max 3", "input_from": "review", "output": "final.md" }
  ]
}
```

## State Schema

Active pipeline state is saved at `${CLAUDE_PLUGIN_DATA}/state/pipeline-active.json`:

```json
{
  "pipeline_name": "my-pipeline",
  "run_id": "my-pipeline-20260320T120000",
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
