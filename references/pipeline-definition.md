# Pipeline Definition Reference

Detailed specification for defining and managing pipeline definitions, step fields, data flow, state schema, and worked examples.

---

## Step Fields

Each step declares:

| Field | Required | Description |
|-------|----------|-------------|
| `skill` | yes | The skill to invoke (e.g., `/second-claude-code:research`) |
| `args` | yes | Arguments string. Supports `{{variable}}` placeholders. |
| `output` | yes | Output file path. Supports `{{variable}}` placeholders. |
| `input_from` | no | File path(s) from a previous step's `output`. String for single input, array for multiple inputs. Supports `{{variable}}` placeholders. |
| `on_fail` | no | `abort` (default), `skip`, or `retry` |
| `parallel` | no | `true` to run concurrently with adjacent parallel-marked steps (if no `input_from` dependency) |

## Data Flow

Steps form an explicit dependency graph through `input_from` and `output`:

```
Step 1: output: "research-brief.md"
          |
          v
Step 2: input_from: "research-brief.md"  -->  output: "analysis.md"
          |
          v
Step 3: input_from: "analysis.md"  -->  output: "final-report.md"
```

The orchestrator validates the dependency graph at definition time:
- Every `input_from` value must match a preceding step's `output`.
- Circular dependencies are rejected.
- Parallel steps with cross-references are demoted to sequential execution.

## Variable Resolution Rules

1. **Before execution**: the orchestrator scans all step fields for `{{...}}` patterns.
2. **Unresolved required variables** cause an immediate abort with a clear error listing which variables are missing.
3. **Default values** can be declared in the pipeline definition under `"defaults"`:

```json
{
  "defaults": {
    "topic": "",
    "lang": "ko",
    "framework": "swot"
  }
}
```

Runtime flags override defaults. Defaults override empty.

## Full Definition Example

```json
{
  "name": "market-scan",
  "description": "Research a topic, analyze with a strategic framework, write a report.",
  "defaults": {
    "topic": "",
    "framework": "porter",
    "lang": "en",
    "output_dir": "."
  },
  "steps": [
    {
      "skill": "/second-claude-code:research",
      "args": "\"{{topic}}\" --depth deep --sources web,news,academic --lang {{lang}}",
      "output": "{{output_dir}}/{{run_id}}-research.md",
      "on_fail": "abort"
    },
    {
      "skill": "/second-claude-code:analyze",
      "args": "--framework {{framework}} --with-research --depth deep --lang {{lang}}",
      "input_from": "{{output_dir}}/{{run_id}}-research.md",
      "output": "{{output_dir}}/{{run_id}}-analysis.md",
      "on_fail": "abort"
    },
    {
      "skill": "/second-claude-code:write",
      "args": "--format report --voice expert --skip-research --lang {{lang}}",
      "input_from": "{{output_dir}}/{{run_id}}-analysis.md",
      "output": "{{output_dir}}/{{run_id}}-report.md",
      "on_fail": "retry"
    }
  ]
}
```

## Preset Details

**autopilot**: The default end-to-end pipeline. Research gathers sources, analyze applies a framework (default: SWOT, override with `--var framework=porter`), write produces the artifact, review critiques it, and loop incorporates feedback. Best for polished deliverables.

**quick-draft**: Skips analysis and review. Research feeds directly into write with `--skip-research` disabled so the write step uses the research output as context. Best for time-sensitive first drafts that will be manually refined.

**quality-gate**: Takes an existing file as input (`--var input=path/to/file.md`), runs review, then loop to fix issues. Best for polishing existing content without re-researching.

## State Schema

- Active state: `${CLAUDE_PLUGIN_DATA}/state/pipeline-active.json`
- Run log: `${CLAUDE_PLUGIN_DATA}/pipelines/{name}-run.json`

Canonical active keys:

```json
{
  "name": "market-scan",
  "run_id": "market-scan-20260320T143000",
  "current_step": 2,
  "total_steps": 3,
  "status": "running",
  "resolved_vars": {
    "topic": "edge computing market 2026",
    "framework": "porter",
    "lang": "en",
    "date": "2026-03-20",
    "run_id": "market-scan-20260320T143000",
    "output_dir": "."
  }
}
```
