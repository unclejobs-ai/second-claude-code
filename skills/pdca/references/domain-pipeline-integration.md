---
name: domain-pipeline-integration
description: "How PDCA's Do phase passes context to built-in write/analyze skills and optional external capabilities"
---

# Domain Pipeline Integration

This reference describes the boundary between a selected PDCA run and its Do-phase
producer. The built-in producer is `/scc:write` (format-specific) or `/scc:analyze`.
An installed external plugin may provide another producer, but external capabilities are
optional and are not executed by the orchestrator MCP tools.

## Architecture Position

```
PDCA (when selected)
  └── Do
        ├── /scc:write --format <format>
        ├── /scc:analyze <framework>
        ├── /scc:workflow (saved workflow)
        └── optional external capability (explicit invocation)
```

PDCA delegates the production step and validates the returned artifact. It does not invent
or assume unavailable commands such as `/threads`, `/newsletter`, `/academy-shorts`, or
`/card-news`.

## Selection

1. Read the user prompt and Plan output.
2. Select a supported write format when one is named:
   `newsletter`, `article`, `shorts`, `report`, `social`, `card-news`, or the format values
   documented by `skills/write/SKILL.md`.
3. Use `/scc:analyze` for a named strategic framework.
4. Use `/scc:workflow` for a saved multi-step workflow.
5. If an external plugin is explicitly selected, verify that capability is installed before
   invocation. Otherwise use `/scc:write` as the generic fallback.

## Built-in Invocation

For a PDCA-owned Plan and Check, the Do call normally passes:

```text
/scc:write --format <format> --skip-research --skip-review
```

`--skip-research` and `--skip-review` are deliberate boundary flags: Plan already produced
source context and Check owns the independent review. A direct `/scc:write` invocation may
omit them and therefore runs the write skill's default research/review behavior.

## Input Contract

```json
{
  "topic": "string",
  "research_brief_path": "string (optional when source material is supplied)",
  "analysis_path": "string (optional)",
  "dod": ["string"],
  "constraints": ["string"],
  "format_target": "newsletter|article|shorts|report|social|card-news|...",
  "skip_research": true,
  "skip_review": true
}
```

The producer must receive enough context to write the requested artifact. If the user
supplies a source file, `/scc:write` can use `--input`; its skill contract implies
`--skip-research` for that input.

## Output and Validation

The Do artifact should include the fields in `references/phase-schemas.md`: `artifact_path`,
`format`, counts, completeness flags, and reference count. Where the producer reports counts,
PDCA may verify them from the artifact before changing phase.

The distinction matters:

- **Runtime-enforced transition subset:** the state MCP currently checks Plan→Do for a brief,
  `sources_count >= 5`, analysis, and plan approval; Do→Check for artifact presence,
  completeness, and plan integration; Check→Act for a verdict and at least two reviewers;
  Act→Exit for a decision and root cause.
- **Skill contracts:** `/scc:write` format rules (including character floors and section shape),
  source/reference expectations, voice rules, and reviewer behavior are documented contracts
  for the invoked skill. They are not all independently enforced by the state MCP transition.

Below-floor output should be reported and corrected according to the selected skill contract;
do not describe every floor as a universal runtime guarantee.

## Failure Handling

If the selected producer errors, hangs, or returns no artifact:

1. Record the capability, input, and error.
2. Retry only within the active workflow's configured limits.
3. Use `/scc:write` with the explicit requested format as the built-in fallback.
4. Surface the failure when no valid artifact can be produced; do not silently claim an
   external capability ran.

If a caller supplied an external capability, its own internal phases and publishing behavior
remain that plugin's responsibility. PDCA can still review the resulting artifact if it is
returned as the Do output.

## Phase Boundaries

- **Plan:** `/scc:research` uses depth-controlled search (3, 5, or 10+ calls), then
  `/scc:analyze` may structure findings.
- **Do:** `/scc:write` or `/scc:analyze` produces the requested format. In a PDCA-owned run,
  pass the skip flags to avoid repeating Plan or Check.
- **Check:** `/scc:review` runs the selected 2–5 reviewer preset.
- **Act:** Action Router classifies findings and selects Plan, Do, or Refine.

The orchestrator MCP surface can provide plugin inventory and ranked advisory plans. It does
not run an external Skill or command; invocation remains an explicit caller decision.
