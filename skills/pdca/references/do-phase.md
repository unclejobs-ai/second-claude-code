# Do Phase (Produce) — Checklist

The Do phase transforms research into a concrete artifact.
Inputs come from the Plan phase gate; outputs go to the Check phase gate.

## Entry Conditions

- Plan phase gate passed (Research Brief exists and is sufficient)
- OR user explicitly provides source material and skips Plan
- Production format decided (article, report, analysis, etc.)

## Skill Selection

| User Intent | Skill | Notes |
|-------------|-------|-------|
| "Write an article/report/newsletter" | `/second-claude-code:write` | Loads format spec from `references/formats/` |
| "Analyze with SWOT/Porter/RICE" | `/second-claude-code:analyze` | Selects framework from prompt |
| "Run a multi-step workflow" | `/second-claude-code:pipeline` | Uses predefined or custom pipeline |
| Multiple outputs needed | Chain skills in sequence | e.g., analyze then write |

## Execution Steps

1. **Load Plan artifacts**: Read the Research Brief from Plan phase.
2. **Select skill**: Based on user intent (see table above).
3. **Pass context**: Feed Research Brief as input to the selected skill.
4. **Execute**: Run the skill with appropriate options.
5. **Save artifact**: Ensure output is written to a file, not just printed.
6. **Assess completeness**: Check against the Gate Checklist below.

## Gate Checklist (Do → Check)

All items must pass before proceeding to Check:

- [ ] **Artifact exists** — A file was created (not just console output)
- [ ] **Artifact is complete** — All sections filled, no "[TODO]" or "[TBD]" placeholders
- [ ] **Research integrated** — Plan phase findings are actually used, not ignored
- [ ] **Format followed** — If a format spec exists, it was followed
- [ ] **Length appropriate** — Matches the format's expected range
- [ ] **Voice consistent** — Tone matches the target audience

### Gate Failure Actions

| Failure | Action |
|---------|--------|
| Artifact is incomplete | Complete missing sections before review |
| Research not used | Re-run write with explicit instruction to cite Plan findings |
| Format violated | Check format spec in `skills/write/references/formats/` and fix |
| Too short/long | Adjust scope and regenerate |

## Output to Next Phase

Pass to Check phase:
- Path to artifact file
- Artifact type (article, report, analysis, etc.)
- Recommended review preset:
  - Article/newsletter → `content`
  - Strategy/analysis → `strategy`
  - Code → `code`
  - Quick validation → `quick`
