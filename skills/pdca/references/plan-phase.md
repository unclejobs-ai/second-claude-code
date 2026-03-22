# Plan Phase (Gather) — Checklist

**Permission Mode**: `plan` (read-only). Research agents must NOT write or modify artifact files during this phase. State file updates (pdca-active.json) are the only writes permitted.

The Plan phase ensures sufficient information exists before production begins.
This is the "measure twice" that prevents "cut wrong" in later phases.

## Entry Conditions

- Topic or question identified
- OR Act→Plan cycle return (with identified research gap)

## Question Protocol

Before dispatching research, run the Question Protocol (see `references/question-protocol.md`):

1. Check skip conditions (2+ sentences of context, explicit format, `--no-questions`, automation mode)
2. If not skipped: ask up to 3 scope-clarifying questions
3. If user doesn't respond: save assumptions to state and proceed
4. If Act→Plan return: skip questions — the research gap is already identified

## MMBridge Cross-Session Context

When mmbridge is detected (see `references/mmbridge-integration.md`), query project memory at the start of the Plan phase for relevant prior work.

### When to Query

- At Plan phase entry, before dispatching the researcher
- Only if the topic has potential overlap with prior PDCA cycles

### Command

```bash
mmbridge memory search "<topic keywords>" --format json
```

### Integration

If relevant prior findings are returned:
1. Include them as "Prior Context" in the researcher's input — this prevents re-researching already-settled questions
2. Flag any prior decisions that may need re-evaluation (e.g., "Last analyzed 2024-01-15 — market conditions may have changed")
3. Prior findings do NOT count toward the `sources_count` gate (they are context, not fresh research)

### No Results

If `mmbridge memory search` returns no results or fails, proceed normally. This is a **context enhancement only** — the Plan phase works identically without it.

## Execution Steps

1. **Question Protocol**: Check scope clarity → ask or skip (see `references/question-protocol.md`)
2. **Dispatch research**: Run `/second-claude-code:research --depth {selected}` (Eevee)
   - For `--depth deep`: consider dispatching 2 research angles in parallel
3. **Verify Research Brief**: Confirm structured brief exists with sources
4. **Dispatch analyze**: Run `/second-claude-code:analyze --skip-challenge` (Alakazam + Mewtwo)
   - Pass Research Brief as input context
   - Framework auto-selected from topic or defaults to "structured synthesis"
5. **Verify Analysis**: Confirm structured framework output exists
6. **Plan Mode Briefing**: Enter Plan Mode and write a plan file containing:
   - Research summary (3-5 key findings)
   - Analysis highlights (top insights from the framework)
   - Proposed Do phase approach (skill, format, estimated scope)
   - Assumptions made during Plan (if any)
   - Known gaps or constraints
   Exit Plan Mode. Wait for user approval.
   - On approval → proceed to Do phase
   - On rejection → capture user feedback as explicit constraints → re-run Plan from step 2

   **Skip condition**: `--no-questions` flag is set (automation mode — skip Plan Mode briefing entirely)

## Skill Chain: research → analyze

The Plan phase chains two skills internally:

| Step | Skill | Agent | Purpose |
|------|-------|-------|---------|
| 1 | `/scc:research` | Eevee (researcher) | Data collection and source gathering |
| 2 | `/scc:analyze --skip-challenge` | Alakazam (analyst) + Mewtwo (strategist) | Structure findings into actionable framework |

The `--skip-challenge` flag on analyze bypasses the devil's advocate challenge round. This is intentional: adversarial pressure is applied in the Check phase on Do output, not on Plan artifacts. Running a challenge round during Plan would waste a full analysis pass on a brief that has not yet been turned into a deliverable.

## Gate Checklist (Plan → Do)

All items must pass before proceeding to Do:

- [ ] **Research Brief exists** — A structured brief with sections, not raw search results
- [ ] **Sources identified** — At least 3 distinct, credible sources cited
- [ ] **Key findings stated** — Clear takeaways, not just data dumps
- [ ] **Gaps acknowledged** — Known unknowns are listed, not hidden
- [ ] **Conflicts noted** — If sources disagree, the disagreement is documented
- [ ] **Analysis artifact exists** — Structured framework output from analyze skill
- [ ] **Scope verified** — Question Protocol or user context confirms scope alignment

### Gate Failure Actions

| Failure | Action |
|---------|--------|
| Brief is too thin | Re-run research with `--depth deep` |
| Sources are low quality | Add `--sources academic` or `--sources news` |
| Critical gap exists | Targeted research on the gap topic only |
| Scope drifted | Re-scope with user and re-research |
| Analysis missing | Run analyze with explicit framework selection |

## Gotchas

- Plan analysis has no challenge round by default. For high-stakes topics (`--depth deep`), consider running `/second-claude-code:analyze --challenge` manually before approving the Plan→Do gate.

## Output to Next Phase

Output must conform to the **PlanOutput schema** (see `references/phase-schemas.md`).
The orchestrator validates all fields before passing the gate.

Pass to Do phase:
- Path to Research Brief file (`.captures/research-*.md`) → `research_brief_path`
- Path to Analysis artifact (`.captures/analyze-*.md`) → `analysis_path`
- Count of distinct sources cited → `sources_count` (must be `>= 3`)
- Known unknowns → `gaps`
- Saved assumptions from Question Protocol → `assumptions`
- Definition of Done criteria extracted from scope → `dod`
- Summary of key findings (3-5 bullet points, for Do phase context only)
- Recommended Do skill: `write` (for content) or `analyze` (for deeper strategic analysis)
- Constraints from Question Protocol answers (if any)
