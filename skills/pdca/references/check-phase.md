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
   - **Reviewer diversity is enforced** — see "Reviewer Model Diversity Rule" section below
   - For `--depth deep` PDCA cycles, add `--team-review` to enable interactive deliberation. In team review, reviewers complete independent assessments first, then enter a challenge round where they dispute or reinforce each other's findings. This catches issues that independent parallel reviews miss — particularly contradictory findings where one reviewer's blind spot cancels another's valid concern.
3. **Read verdict**: The review skill returns one of four verdicts.
4. **Route based on verdict**: See Gate Checklist below.

## Reviewer Model Diversity Rule (Hard Contract)

PDCA's Check phase **enforces reviewer model diversity** to prevent false consensus. Two reviewers running on the same model are not actually independent — they share the same training data, the same biases, and the same blind spots. They will agree on things they should disagree on.

### Diversity Requirements

| Requirement | Threshold | Why |
|------------|-----------|-----|
| Minimum reviewer count | **2** (3 for `--depth deep`) | Single-reviewer = no consensus check |
| Maximum same-model reviewers | **1 per model** | Two reviewers on the same model produce correlated errors |
| External model required | **At least 1** for `content`, `strategy`, `full` presets | Internal model perspective alone misses issues that external models catch |
| Model diversity score | **≥ 0.6** (if >2 reviewers) | Computed as (distinct models / total reviewers) |

### Approved External Models for Cross-Review

When the Check phase requires an external model (per the rule above), use one of:

- **Codex GPT-5.4** (via `codex:codex-rescue` agent or `mmbridge_review --tool codex`)
- **Kimi K2.5** (via `kimi-reviewer` agent or `mmbridge_review --tool kimi`)
- **Qwen** (via `qwen-reviewer` agent or `mmbridge_review --tool qwen`)
- **Gemini** (via `gemini-design-reviewer` agent or `mmbridge_review --tool gemini`)
- **Droid** (via `mmbridge_review --tool droid`)

The orchestrator picks 1 external model based on artifact type:
- Code → Codex (best for code reasoning)
- Korean content → Kimi or Qwen (best Korean understanding)
- Strategy/analysis → Codex or Gemini (best for structured reasoning)
- General content → any of the above; rotate to avoid model staleness

### Reviewer Composition Examples

| Preset + Depth | Reviewers Dispatched | Diversity Check |
|---------------|---------------------|-----------------|
| `content`, shallow | Internal sonnet (Xatu) + External Kimi | 2 reviewers, 2 distinct models, 1 external ✓ |
| `content`, medium | Internal sonnet (Xatu) + Internal opus (Absol) + External Codex | 3 reviewers, 3 distinct models, 1 external ✓ |
| `content`, deep | Internal sonnet (Xatu) + Internal opus (Absol) + External Codex + External Kimi | 4 reviewers, 4 distinct models, 2 external ✓ |
| `strategy`, medium | Internal opus (Mewtwo perspective) + Internal sonnet (Porygon) + External Gemini | 3 reviewers, 3 distinct models, 1 external ✓ |
| `code`, medium | Internal sonnet (general) + External Codex + Internal haiku (Unown) | 3 reviewers, 3 distinct models, 1 external ✓ |

### Diversity Failure Actions

| Failure | Action |
|---------|--------|
| Only 1 reviewer responded | Re-dispatch — single reviewer is structurally invalid (was already a rule, kept) |
| 2 reviewers but same model | Re-dispatch with explicit model assignment for the second reviewer (force diversity) |
| No external model included for `content`/`strategy`/`full` presets | Add 1 external model reviewer before passing the gate |
| All reviewers agree (false consensus signal) | Run 1 additional external model in adversarial mode (`--devil-advocate`) to surface what the others missed |

### False Consensus Detection

When all reviewers return `APPROVED` with high agreement (avg score > 0.9, no critical findings, no top improvements), PDCA treats this as **suspicious** rather than confirming. Real artifacts almost always have some tension between reviewers — perfect agreement usually means they're all looking at the same surface and missing the same depth.

In false consensus state:

1. Log: "Reviewers in unanimous high agreement — running adversarial pass"
2. Dispatch 1 additional reviewer using `--mode adversarial` and an external model that wasn't already used
3. If adversarial reviewer also returns APPROVED → genuine consensus, ship
4. If adversarial reviewer returns MINOR/NEEDS/MUST → re-evaluate with the new findings

This prevents "everyone said it's fine" from being a Goodharted exit signal.

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
- [ ] **No false consensus** — Reviewers were independent (not converged)
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
