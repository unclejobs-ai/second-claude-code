# Check Phase (Verify) — Checklist

**Permission Mode**: `plan` (read-only). Reviewers must NOT modify the artifact under review. Read-only access is a structural guarantee of review independence — a reviewer who can edit cannot be truly independent.

The Check phase validates the Do phase artifact through multi-perspective review.
This is the quality gate that determines whether work ships or iterates.

## Entry Conditions

- Do phase gate passed (artifact exists and is complete)
- Artifact path known
- Review preset selected (or auto-detected from artifact type)

## Execution Steps

1. **Select preset**: Based on artifact type from Do phase output:
   - Article, newsletter, blog → `content`
   - SWOT, PRD, strategy doc → `strategy`
   - Code → `code`
   - Quick validation → `quick`
   - Pre-publish final pass → `full`
2. **Dispatch review**: Run `/second-claude-code:review --preset {selected}`.
   - Reviewers: Xatu (deep-reviewer), Absol (devil-advocate), Porygon (fact-checker), Jigglypuff (tone-guardian), Unown (structure-analyst)
   - Preset determines which subset is dispatched (see below)
3. **Read verdict**: The review skill returns one of four verdicts.
4. **Route based on verdict**: See Gate Checklist below.

## Verdict Routing

| Verdict | Meaning | Next Action |
|---------|---------|-------------|
| `APPROVED` | Meets quality bar | **EXIT** — Ship it. Save final artifact. |
| `MINOR FIXES` | Small issues only | **Act** with light touch (top 3 fixes) |
| `NEEDS IMPROVEMENT` | Substantive gaps | **Act** with full loop |
| `MUST FIX` | Critical problems | **Act** targeting critical findings first |

## Gate Checklist (Check → Act)

- [ ] **Review report exists** — Structured report with verdict, consensus score, and findings
- [ ] **Verdict is clear** — One of the four standard verdicts
- [ ] **Findings are actionable** — Each finding has location + severity + fix suggestion
- [ ] **No false consensus** — Reviewers were independent (not converged)

### On APPROVED

Stop the PDCA cycle. Report:
- Final verdict and consensus score
- Path to the artifact
- Summary: "Ship it. No Act phase needed."

### On MINOR FIXES / NEEDS IMPROVEMENT / MUST FIX

Proceed to Act phase with:
- Path to artifact
- Path to review report (or review content in context)
- Target: the verdict to beat (usually `APPROVED`)
- Severity priority: Critical → Major → Minor

## Gate Failure Actions

| Failure | Action |
|---------|--------|
| Review didn't run properly | Re-dispatch with explicit preset |
| Findings are vague | Re-run review with `--strict` flag |
| Only 1 reviewer responded | Re-dispatch — review requires parallel reviewers |

## Output to Next Phase

Output must conform to the **CheckOutput schema** (see `references/phase-schemas.md`).
The orchestrator validates all fields before passing the gate.

Pass to Act phase (if not APPROVED):
- Consensus verdict → `verdict` (one of: `APPROVED|MINOR FIXES|NEEDS IMPROVEMENT|MUST FIX`)
- Mean reviewer score → `average_score` (float in [0.0, 1.0])
- Each reviewer's name, individual verdict, and score → `reviewers` (at least 2 required)
- Critical-severity findings → `critical_findings`
- Top improvement suggestions (max 5) → `top_improvements`
- Path to artifact file (for Act phase context)
- Review report (full text or file path)
- Priority-ordered list of findings to address
- Recommended `--max` for loop iterations:
  - MINOR FIXES → `--max 1`
  - NEEDS IMPROVEMENT → `--max 3`
  - MUST FIX → `--max 5`
