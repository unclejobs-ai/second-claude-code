# Plan Phase (Gather) — Checklist

The Plan phase ensures sufficient information exists before production begins.
This is the "measure twice" that prevents "cut wrong" in later phases.

## Entry Conditions

- Topic or question identified
- Scope defined (broad exploration vs. targeted investigation)

## Execution Steps

1. **Scope the question**: What specifically needs to be answered? Rewrite vague requests into concrete research questions.
2. **Select depth**: Match to user intent:
   - `shallow` — Quick facts, 3 searches, <2min
   - `medium` — Balanced coverage, 5 searches + gap analysis
   - `deep` — Comprehensive, 10+ searches, repeated gap-fill
3. **Dispatch research**: Run `/second-claude-code:research --depth {selected}`.
4. **Assess coverage**: After Research Brief is produced, check against the Gate Checklist below.
5. **Optional collect**: If sources are valuable for future reference, run `/second-claude-code:collect` on key URLs.
6. **Optional hunt**: If the topic requires a skill not in the current set, run `/second-claude-code:hunt`.

## Gate Checklist (Plan → Do)

All items must pass before proceeding to Do:

- [ ] **Research Brief exists** — A structured brief with sections, not raw search results
- [ ] **Sources identified** — At least 3 distinct, credible sources cited
- [ ] **Key findings stated** — Clear takeaways, not just data dumps
- [ ] **Gaps acknowledged** — Known unknowns are listed, not hidden
- [ ] **Conflicts noted** — If sources disagree, the disagreement is documented
- [ ] **Scope matches intent** — The brief answers what the user actually asked

### Gate Failure Actions

| Failure | Action |
|---------|--------|
| Brief is too thin | Re-run research with `--depth deep` |
| Sources are low quality | Add `--sources academic` or `--sources news` |
| Critical gap exists | Targeted research on the gap topic only |
| Scope drifted | Re-scope with user and re-research |

## Output to Next Phase

Pass to Do phase:
- Path to Research Brief file (`.captures/research-*.md`)
- Summary of key findings (3-5 bullet points)
- Recommended Do skill: `write` (for content) or `analyze` (for strategic analysis)
