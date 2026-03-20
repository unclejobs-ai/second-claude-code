# Do Phase (Produce) — Checklist

The Do phase is a **pure executor**. It transforms Plan artifacts into a concrete output.
It does NOT research (Plan did that) and does NOT review (Check will do that).

## Entry Conditions

- Plan phase gate passed (Research Brief + Analysis exist)
- OR Act→Do cycle return (review findings provided as constraints)
- OR user explicitly provides source material and skips Plan
- Production format decided (from Question Protocol or prompt)

## Pure Execution Principle

Do phase skills run in **stripped mode**:
- `/scc:write --skip-research --skip-review` — No internal research or review
- Plan already gathered data; Check will verify quality
- This prevents duplicate work and keeps phase boundaries clean

On Act→Do return: review findings are passed as constraints to the write prompt, focusing the rewrite on specific issues.

## Skill Selection

| User Intent | Skill | Mode |
|-------------|-------|------|
| Content (article, report, newsletter) | `/scc:write --skip-research --skip-review` | Pure execution |
| Different framework analysis | `/scc:analyze` | Different from Plan's framework |
| Multi-step workflow | `/scc:pipeline` | Uses predefined pipeline |

## Pre-Flight Check (Mandatory)

Before any execution, verify Plan artifacts exist:

1. Check for PDCA state file (`pdca-active.json`)
2. **No state file** → **STOP**: "No active PDCA session found. Run Plan first or provide `--source {file}`."
3. **State file exists, topic mismatch** (state topic ≠ current request) → **STOP**: "Active session is for '{state.topic}'. Start a new cycle with Plan or provide `--source {file}`."
4. **State file exists, topic matches, artifacts present** → proceed to Execution Steps
5. **State file exists, topic matches, artifacts null** → **STOP**: "Plan phase incomplete — artifacts not yet produced. Run Plan first or provide `--source {file}`."
6. **No state file but `--source {file}` provided** → use provided source, proceed

This prevents producing content from nothing when `--phase do` is used directly, and catches stale state from prior sessions.

## Execution Steps

1. **Load Plan artifacts**: Read Research Brief + Analysis from Plan phase (or `--source` file)
2. **Select skill**: Based on user intent or Plan recommendation
3. **Pass context**: Feed Plan artifacts as input
4. **On Act→Do return**: Inject review findings as constraints
   ```
   Constraints from review:
   - [finding 1]: address by...
   - [finding 2]: fix by...
   ```
5. **Execute**: Run skill with `--skip-research --skip-review`
6. **Save artifact**: Ensure output is written to a file
7. **Assess completeness**: Check against the Gate Checklist below

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
| Format violated | Check format spec and fix |
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
