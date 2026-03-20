# Plan Phase (Gather) — Checklist

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

## Execution Steps

1. **Question Protocol**: Check scope clarity → ask or skip (see `references/question-protocol.md`)
2. **Dispatch research**: Run `/second-claude-code:research --depth {selected}` (Eevee)
   - For `--depth deep`: consider dispatching 2 research angles in parallel
3. **Verify Research Brief**: Confirm structured brief exists with sources
4. **Dispatch analyze**: Run `/second-claude-code:analyze --skip-challenge` (Alakazam + Mewtwo)
   - Pass Research Brief as input context
   - Framework auto-selected from topic or defaults to "structured synthesis"
5. **Verify Analysis**: Confirm structured framework output exists

## Skill Chain: research → analyze

The Plan phase chains two skills internally:

| Step | Skill | Agent | Purpose |
|------|-------|-------|---------|
| 1 | `/scc:research` | Eevee (researcher) | Data collection and source gathering |
| 2 | `/scc:analyze --skip-challenge` | Alakazam (analyst) + Mewtwo (strategist) | Structure findings into actionable framework |

The `--skip-challenge` flag on analyze bypasses the devil's advocate challenge round, since Check phase handles adversarial review.

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

## Output to Next Phase

Pass to Do phase:
- Path to Research Brief file (`.captures/research-*.md`)
- Path to Analysis artifact (`.captures/analyze-*.md`)
- Summary of key findings (3-5 bullet points)
- Recommended Do skill: `write` (for content) or `analyze` (for deeper strategic analysis)
- Constraints from Question Protocol answers (if any)
