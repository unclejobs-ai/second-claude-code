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
2. **Dispatch review**: Run `/scc:review --preset {selected}`.
   - Reviewers: Xatu (deep-reviewer, opus), Absol (devil-advocate, sonnet), Porygon (fact-checker, sonnet), Jigglypuff (tone-guardian, sonnet), Unown (structure-analyst, sonnet)
   - Preset determines which subset is dispatched (see below)
   - Presets dispatch the configured subset; the runtime gate only requires at least two reported reviewers.
   - For `--depth deep` PDCA cycles, add `--team-review` to enable interactive deliberation. In team review, reviewers complete independent assessments first, then enter a challenge round where they dispute or reinforce each other's findings. This catches issues that independent parallel reviews miss — particularly contradictory findings where one reviewer's blind spot cancels another's valid concern.
3. **Read verdict**: The review skill returns one of four verdicts.
4. **Route based on verdict**: See Gate Checklist below.

## Reviewer roster and gate boundary

The review skill contract defines the panel and preset-specific checks. The built-in roster is
Xatu (`deep-reviewer`, opus), Absol (`devil-advocate`, sonnet), Porygon (`fact-checker`, sonnet),
Jigglypuff (`tone-guardian`, sonnet), and Unown (`structure-analyst`, sonnet). Presets dispatch
between 2 and 5 of these reviewers: `quick` 2; `content`, `strategy`, `code`, and `security` 3;
`academic` 4; `full` 5. `--external` is optional and only adds a detected external pass.

The PDCA state MCP runtime enforces a smaller Check→Act subset: a verdict must be set and at least
two reviewers must report. Model diversity, external coverage, score thresholds, and any
adversarial/false-consensus follow-up are review-skill or advisory contracts; they are not implied
runtime guarantees of the PDCA transition.

## Verdict Routing

| Verdict | Meaning | Next Action |
|---------|---------|-------------|
| `APPROVED` | Meets quality bar | **EXIT** — Ship it. Save final artifact. |
| `MINOR FIXES` | Small issues only | **Act** with light touch (top 3 fixes) |
| `NEEDS IMPROVEMENT` | Substantive gaps | **Act** with full refine |
| `MUST FIX` | Critical problems | **Act** targeting critical findings first |

## Gate Checklist (Check → Act)

- [ ] **Review report exists** — Structured report with verdict, consensus score, and findings
- [ ] **Verdict is clear** — One of the four standard verdicts
- [ ] **Findings are actionable** — Each finding has location + severity + fix suggestion
- [ ] **Reviewer independence** — Keep reviewer contexts independent; additional consensus checks are skill-level behavior
- [ ] **MMBridge gate advisory** (optional) — If mmbridge available, coverage check logged

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
- Recommended `--max` for refine iterations:
  - MINOR FIXES → `--max 1`
  - NEEDS IMPROVEMENT → `--max 3`
  - MUST FIX → `--max 5`

## MMBridge Gate Advisory

When mmbridge is detected (see `references/mmbridge-integration.md`), run a coverage check
after the internal consensus gate completes.

### Execution

After internal consensus gate produces a verdict:

```bash
mmbridge gate --mode <mode> --format json > /tmp/mmbridge-gate-${RUN_ID}.json
```

- `--mode review`: for content/strategy/code presets
- `--mode security`: for security preset
- `--mode architecture`: for structural reviews

The mode is determined by the `review_preset` field in the CheckOutput schema.

### Interpretation

The gate result is **advisory only** — it does NOT override the consensus verdict.

| Gate Output | Action |
|------------|--------|
| Coverage adequate | Log: "mmbridge gate: coverage OK" |
| Coverage gaps found | Warn: "mmbridge gate: {n} files uncovered — {file list}" |
| Gate command failed | Log error, proceed with internal verdict only |

### Recording

If PDCA state MCP is available, record the gate result as metadata on the Check→Act transition:

```
pdca_transition({ phase: "act", metadata: { mmbridge_gate: { coverage: score, uncovered: [...] } } })
```

If MCP is not available, include the gate result in the review report output as an appendix.
