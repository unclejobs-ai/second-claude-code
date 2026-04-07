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
  "brief_char_count": "number (body of research brief, excludes frontmatter)",
  "sources_count": "number (>= 5)",
  "facts_count": "number (>= 8)",
  "quotes_count": "number (>= 1, must have named speakers)",
  "comparison_tables_count": "number (>= 1 for content briefs)",
  "media_inventory_count": "number (>= 1 for content output formats)",
  "meets_brief_floor": "boolean (must be true)",
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
| `brief_char_count` | number | yes | UTF-8 char count of brief body, excludes frontmatter and reference list |
| `sources_count` | number | yes | Must be `>= 5`; gate fails if `< 5` (raised from 3 to enforce source variety) |
| `facts_count` | number | yes | Must be `>= 8`; discrete fact count with dates/numbers/names attached |
| `quotes_count` | number | yes | Must be `>= 1`; quotes must have named speakers (no anonymous "experts say") |
| `comparison_tables_count` | number | yes | Must be `>= 1` for content output briefs (article/threads/newsletter); may be `0` for code briefs |
| `media_inventory_count` | number | yes | Must be `>= 1` for content output formats; may be `0` for code/strategy briefs |
| `meets_brief_floor` | boolean | yes | Must be `true`. Compare `brief_char_count` against the brief type's row in `plan-phase.md` Research Brief Length Floors table. `false` is a gate failure. |
| `gaps` | string[] | yes | At least 1 acknowledged gap (no research is exhaustive — claiming zero gaps is itself a red flag) |
| `assumptions` | string[] | yes | May be empty array `[]` if none exist |
| `dod` | string[] | yes | At least 1 criterion required |

### Validation Failure Actions

| Failing Field | Action |
|---------------|--------|
| `research_brief_path` missing or file absent | Re-run `/scc:research` |
| `analysis_path` missing or file absent | Re-run `/scc:analyze` |
| `meets_brief_floor: false` | Re-run research with `--depth deep`. Brief is structurally too thin to support a proper Do output. |
| `sources_count < 5` | Continue research with broader queries or additional source types (`--sources academic --sources news`) |
| `facts_count < 8` | Re-run with explicit instruction to extract more discrete data points across multiple sources |
| `quotes_count < 1` | Re-run with explicit instruction to find named-source quotes; reject "전문가들은", "experts say" patterns |
| `comparison_tables_count < 1` (for content briefs) | Add a comparison pass: identify alternatives or competing positions and tabulate |
| `media_inventory_count < 1` (for content briefs) | Run media collection: WebFetch images, OG screenshots, or reference diagrams |
| `gaps` empty | Brief is overconfident — explicitly identify at least 1 unknown |
| `dod` empty | Extract DoD from scope/Question Protocol answers before proceeding |

---

## DoOutput

Produced at the end of the Do phase, passed to Check.

```json
{
  "artifact_path": "string",
  "format": "string (newsletter|article|threads|report|shorts|social|card-news|swot|prd)",
  "char_count": "number (body only, excludes frontmatter and references)",
  "section_count": "number (H2 or bold-marked sections)",
  "meets_length_floor": "boolean",
  "meets_section_floor": "boolean",
  "plan_findings_integrated": "boolean",
  "sections_complete": "boolean",
  "references_count": "number (sources cited in artifact)"
}
```

### Field Rules

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| `artifact_path` | string | yes | File must exist on disk |
| `format` | string | yes | One of the enumerated format values |
| `char_count` | number | yes | UTF-8 character count of body only (no frontmatter, no references) |
| `section_count` | number | yes | Count of distinct H2 or bold-labeled sections |
| `meets_length_floor` | boolean | yes | Must be `true`. Compare `char_count` against the format's row in `do-phase.md` Length Floors table. `false` is a gate failure. |
| `meets_section_floor` | boolean | yes | Must be `true`. Compare `section_count` against the format's row in `do-phase.md` Length Floors table. `false` is a gate failure. |
| `plan_findings_integrated` | boolean | yes | Must be `true`; `false` is a gate failure |
| `sections_complete` | boolean | yes | Must be `true`; `false` is a gate failure |
| `references_count` | number | yes | Must be `>= 3`. Count of distinct sources cited inside the artifact body. If artifact has fewer than 3 references, the Plan→Do integration is incomplete. |

### Validation Failure Actions

| Failing Field | Action |
|---------------|--------|
| `artifact_path` missing or file absent | Re-run write skill |
| `plan_findings_integrated: false` | Re-run write with explicit instruction to cite Plan findings |
| `sections_complete: false` | Complete missing sections before proceeding |
| `char_count` is 0 or missing | Artifact is empty — re-run write skill |
| `meets_length_floor: false` | Re-run writer with explicit minimum target. Tell the writer which scope is missing (which Plan finding was not expanded). Do NOT pad with filler. |
| `meets_section_floor: false` | The artifact is structurally too thin. Re-run writer with explicit instruction to add the missing sections. |
| `references_count < 3` | Inject Plan phase sources into artifact's references section. If Plan brief had fewer than 3 sources, the Plan gate was wrongly passed — re-enter Plan phase. |

### Cross-Reference

For format-specific length floors, see `references/do-phase.md` § "Length Floors by Format".
The Do phase orchestrator must compute `meets_length_floor` and `meets_section_floor` by looking up the artifact's format in that table.

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
      "model": "string (sonnet|opus|haiku|codex|kimi|qwen|gemini|droid)",
      "is_external": "boolean",
      "verdict": "string",
      "score": "number"
    }
  ],
  "distinct_models_count": "number (>= 2)",
  "external_model_count": "number (>= 1 for content/strategy/full presets)",
  "diversity_score": "number (0.0-1.0, distinct_models / total_reviewers)",
  "false_consensus_check_passed": "boolean",
  "critical_findings": ["string"],
  "p0_count": "number",
  "p1_count": "number",
  "p2_count": "number",
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
| `reviewers[].model` | string | yes | Specific model identifier — used to enforce diversity |
| `reviewers[].is_external` | boolean | yes | True for Codex/Kimi/Qwen/Gemini/Droid; false for internal Claude variants |
| `reviewers[].verdict` | string | yes | Non-empty |
| `reviewers[].score` | number | yes | Float in range `[0.0, 1.0]` |
| `distinct_models_count` | number | yes | Must be `>= 2`. Two reviewers on the same model = not actually independent. |
| `external_model_count` | number | yes | Must be `>= 1` for `content`/`strategy`/`full` presets. May be `0` for `quick` preset. |
| `diversity_score` | number | yes | `distinct_models_count / total_reviewers`. Must be `>= 0.6` when `total_reviewers > 2`. |
| `false_consensus_check_passed` | boolean | yes | If all reviewers gave `APPROVED` with `average_score > 0.9` and `critical_findings == []`, an adversarial pass must run before this can be `true`. |
| `critical_findings` | string[] | yes | May be empty array `[]` if none |
| `p0_count` | number | yes | Count of P0-severity findings (credibility killers) |
| `p1_count` | number | yes | Count of P1-severity findings (must fix before publish) |
| `p2_count` | number | yes | Count of P2-severity findings (style polish) |
| `top_improvements` | string[] | yes | Maximum 5 items; may be empty if `APPROVED` |
| `review_preset` | string | no | One of the preset values; used by mmbridge gate for `--mode` mapping |

### Validation Failure Actions

| Failing Field | Action |
|---------------|--------|
| `verdict` not a standard value | Re-dispatch review — malformed output |
| `reviewers` has fewer than 2 entries | Re-dispatch review — single reviewer is not valid |
| `distinct_models_count < 2` | Re-dispatch with forced model diversity (assign different model to second reviewer) |
| `external_model_count < 1` for content/strategy/full | Add 1 external model reviewer (Codex, Kimi, Qwen, Gemini, or Droid) before passing gate |
| `diversity_score < 0.6` (when >2 reviewers) | Re-dispatch enough reviewers on distinct models to raise the score |
| `false_consensus_check_passed: false` | Run adversarial pass with external model not already used; re-evaluate based on new findings |
| `average_score` out of range | Re-dispatch review — scoring error |
| `p0_count >= 1` (any credibility killer) | Trigger 5+ Rule "hard credibility" path → full rewrite |
| `p0_count + p1_count >= 5` AND findings span 3+ categories (BOTH required) | Trigger 5+ Rule "volume + spread" path → full rewrite |
| 4 P1 with 3 categories (volume not met) | NO 5+ trigger — route via Action Router (DO/REFINE) |
| 6 P1 in 1 category (spread not met) | NO 5+ trigger — route via Action Router (typically REFINE) |

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
