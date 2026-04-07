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
mmbridge memory search "<topic keywords>" --json
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
- [ ] **Brief meets length floor** — At least 3,000 chars body (target 4,000-6,000). Below floor → fail gate, re-run research
- [ ] **Sources identified** — At least 5 distinct, credible sources cited (was 3, raised because Do phase needs source variety to avoid single-narrative bias)
- [ ] **Facts catalogued** — At least 8 discrete facts with dates, numbers, names, or direct quotes attached. Below 8 → fail gate
- [ ] **Comparison table present** — At least one structured comparison (alternatives, before/after, or competing positions) with 3+ rows
- [ ] **Quotes captured** — At least 1 direct quote with named source for use in Do phase. Quoted speakers must include role + organization + date
- [ ] **Gaps acknowledged** — Known unknowns are listed explicitly, not hidden. At least 1 acknowledged gap (no research is exhaustive)
- [ ] **Conflicts noted** — If sources disagree, the disagreement is documented with both positions and the reason for the divergence
- [ ] **Media inventory** — For content output formats (article/threads/newsletter/shorts), at least 1 referenceable image/screenshot/diagram is downloaded or its source URL is verified accessible
- [ ] **Analysis artifact exists** — Structured framework output from analyze skill
- [ ] **Scope verified** — Question Protocol or user context confirms scope alignment

### Gate Failure Actions

| Failure | Action |
|---------|--------|
| Brief char_count < 3,000 | Re-run research with `--depth deep`. The brief is structurally too thin to support a 4,000+ char Do output. |
| Sources < 5 | Continue research with broader query terms or add `--sources academic --sources news` |
| Facts < 8 | Re-run research with explicit instruction to extract more discrete data points. A single 2-paragraph source rarely yields enough — pull from at least 3 sources. |
| Comparison table missing | Add a comparison pass: ask the researcher to identify alternatives or competing positions and tabulate them |
| No quotes | Re-run with explicit instruction to find 1+ named-source quotes (avoid anonymous "experts say" phrases) |
| Media inventory empty | Run media collection: WebFetch images, OG screenshots, or reference diagrams |
| Critical gap exists | Targeted research on the gap topic only — single focused query, not full re-run |
| Scope drifted | Re-scope with user and re-research |
| Analysis missing | Run analyze with explicit framework selection |

## Research Brief Length Floors (Hard Contracts)

The Research Brief is the foundation for the Do phase. A thin brief produces a thin artifact. PDCA enforces minimum brief substance to prevent the "shallow Plan → shallow Do" failure chain.

| Brief Type | Min chars (body) | Target chars | Min facts | Min sources | Min quotes | Notes |
|-----------|------------------|--------------|-----------|-------------|------------|-------|
| Single-topic content brief (article, threads) | 3,000 | 4,000-6,000 | 8 | 5 | 1 | Must include 1 comparison table |
| Multi-topic newsletter brief | 5,000 | 7,000-10,000 | 15 (3+/topic) | 8 | 2 | Must include topic-by-topic breakdown |
| Strategy/analysis brief (SWOT, market scan) | 4,000 | 5,000-7,000 | 10 | 6 | 2 | Must include competing positions + counterevidence |
| Code/technical brief (architecture, refactor) | 3,500 | 4,500-6,000 | 8 (incl. file/line refs) | 4 | 1 | Must include 1+ code snippets or architecture diagrams |
| Shorts/video brief | 2,500 | 3,000-4,500 | 6 (visual + narrative) | 4 | 1 | Must include scene structure proposal |

### Why Brief Floor Exceeds Output Floor in Some Cases

A research brief is a **superset** of what ends up in the Do output. The brief contains:
- Facts that DO use (kept)
- Facts that DO discards (compressed or cut for length)
- Source links (not all appear in output)
- Notes about reliability and conflicts (rarely surface in final)

Therefore the brief should be **at least 60-80% of the target Do output length** to give the writer enough material to select from. A brief equal in length to the Do output forces the writer to use everything, which leads to dump-all-data style writing instead of curated selection.

### Brief Quality Signals (Reviewed at Gate)

Beyond length floors, the brief must demonstrate:

1. **Source diversity** — sources should not all be from the same publisher, same author, or same date. At least 2 distinct publishers, at least 2 distinct dates if topic is news.
2. **Triangulation** — at least one fact must be confirmed by 2+ independent sources. The brief should mark which facts are single-source vs cross-verified.
3. **Cutoff awareness** — for time-sensitive topics, the brief must include the latest verified date and explicitly note any older facts that may need re-verification.
4. **Korean source presence** — for Korean audience output, at least 1 Korean-language source if the topic has any Korean coverage. (Not required for niche English-only topics.)
5. **Structured frontmatter** — brief must have YAML frontmatter with `topic`, `date`, `slug`, `source_count`, `fact_count`, `gap_count` for downstream automation.

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
