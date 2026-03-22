---
name: phase-schemas
description: "Structured output schemas for PDCA phase gates — defines required fields, types, and validation rules for each phase output"
---

# PDCA Phase Output Schemas

Each phase must produce output that conforms to its schema before the gate is passed.
Missing required fields are treated as a gate failure — the phase must complete before proceeding.

---

## PlanOutput

Produced at the end of the Plan phase, passed to Do.

```json
{
  "topic": "string",
  "research_brief_path": "string (.captures/ path)",
  "analysis_path": "string (.captures/ path)",
  "sources_count": "number (>= 3)",
  "gaps": ["string"],
  "assumptions": ["string"],
  "dod": ["string (Definition of Done criteria)"]
}
```

### Field Rules

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| `topic` | string | yes | Non-empty; matches `pdca-active.json` topic |
| `research_brief_path` | string | yes | Must be an existing `.captures/` path |
| `analysis_path` | string | yes | Must be an existing `.captures/` path |
| `sources_count` | number | yes | Must be `>= 3`; gate fails if `< 3` |
| `gaps` | string[] | yes | May be empty array `[]` if none exist |
| `assumptions` | string[] | yes | May be empty array `[]` if none exist |
| `dod` | string[] | yes | At least 1 criterion required |

### Validation Failure Actions

| Failing Field | Action |
|---------------|--------|
| `research_brief_path` missing or file absent | Re-run `/scc:research` |
| `analysis_path` missing or file absent | Re-run `/scc:analyze` |
| `sources_count < 3` | Re-run research with `--depth deep` or `--sources academic` |
| `dod` empty | Extract DoD from scope/Question Protocol answers before proceeding |

---

## DoOutput

Produced at the end of the Do phase, passed to Check.

```json
{
  "artifact_path": "string",
  "format": "string (newsletter|article|report|shorts|social|card-news)",
  "word_count": "number",
  "plan_findings_integrated": "boolean",
  "sections_complete": "boolean"
}
```

### Field Rules

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| `artifact_path` | string | yes | File must exist on disk |
| `format` | string | yes | One of the enumerated format values |
| `word_count` | number | yes | Must be `> 0` |
| `plan_findings_integrated` | boolean | yes | Must be `true`; `false` is a gate failure |
| `sections_complete` | boolean | yes | Must be `true`; `false` is a gate failure |

### Validation Failure Actions

| Failing Field | Action |
|---------------|--------|
| `artifact_path` missing or file absent | Re-run write skill |
| `plan_findings_integrated: false` | Re-run write with explicit instruction to cite Plan findings |
| `sections_complete: false` | Complete missing sections before proceeding |
| `word_count` is 0 or missing | Artifact is empty — re-run write skill |

---

## CheckOutput

Produced at the end of the Check phase, passed to Act.

```json
{
  "verdict": "APPROVED|MINOR FIXES|NEEDS IMPROVEMENT|MUST FIX",
  "average_score": "number (0.0-1.0)",
  "reviewers": [
    {
      "name": "string",
      "verdict": "string",
      "score": "number"
    }
  ],
  "critical_findings": ["string"],
  "top_improvements": ["string (max 5)"],
  "review_preset": "string (content|strategy|code|security|quick|full)"
}
```

### Field Rules

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| `verdict` | string | yes | One of the four standard verdict values |
| `average_score` | number | yes | Float in range `[0.0, 1.0]` |
| `reviewers` | object[] | yes | At least 2 reviewers required (no false consensus) |
| `reviewers[].name` | string | yes | Non-empty |
| `reviewers[].verdict` | string | yes | Non-empty |
| `reviewers[].score` | number | yes | Float in range `[0.0, 1.0]` |
| `critical_findings` | string[] | yes | May be empty array `[]` if none |
| `top_improvements` | string[] | yes | Maximum 5 items; may be empty if `APPROVED` |
| `review_preset` | string | no | One of the preset values; used by mmbridge gate for `--mode` mapping |

### Validation Failure Actions

| Failing Field | Action |
|---------------|--------|
| `verdict` not a standard value | Re-dispatch review — malformed output |
| `reviewers` has fewer than 2 entries | Re-dispatch review — single reviewer is not valid |
| `average_score` out of range | Re-dispatch review — scoring error |

---

## ActOutput

Produced at the end of the Act phase, used for cycle routing or exit.

```json
{
  "decision": "exit|plan|do|refine",
  "root_cause_category": "string",
  "improvements_applied": ["string"],
  "next_cycle_constraints": ["string"]
}
```

### Field Rules

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| `decision` | string | yes | One of: `exit`, `plan`, `do`, `refine` |
| `root_cause_category` | string | yes | Non-empty; from Action Router classification |
| `improvements_applied` | string[] | yes | At least 1 item if `decision != "exit"` |
| `next_cycle_constraints` | string[] | yes | May be empty if `decision == "exit"` |

### Validation Failure Actions

| Failing Field | Action |
|---------------|--------|
| `decision` not a valid value | Re-run Action Router classification |
| `root_cause_category` empty | Action Router did not classify — re-run classification |
| `improvements_applied` empty when not exiting | Act phase did not produce changes — re-run |

---

## Schema Validation at Phase Gates

At each gate, the orchestrator must:

1. Collect the phase output as a structured object
2. Check all required fields are present and non-null
3. Validate type constraints and enumerated values
4. Validate numeric range constraints
5. If any field fails → **gate failure** (do not proceed to next phase)
6. If all fields pass → write validated output to `pdca-active.json` under the relevant `artifacts` key and mark gate as `"passed"`

Validation rule: **missing required fields are gate failures, not warnings.**
A phase that cannot produce a complete, valid output has not completed its job.
