---
name: review
description: "Use when reviewing content, strategy, or code with parallel specialized reviewers"
effort: medium
---

## Iron Law

> **mmbridge failure NEVER blocks the pipeline.**

## Red Flags

- "Looks good to me, no issues found" → STOP, because a review with zero findings is almost always a rubber stamp — at minimum the devil-advocate must attack 3 weak points.
- "I'll just run the quick preset, it's not important" → STOP, because preset selection determines reviewer coverage — match the preset to the content type, not the deadline.
- "The fact-checker verified it" → STOP, because fact-checker findings require source URLs — claims verified without citations are not verified at all.
- "One reviewer flagged it but the others didn't, so it's fine" → STOP, because severity conflicts use the higher severity with a noted disagreement — do not downgrade by vote count alone.
- "The location is somewhere in section 2" → STOP, because every finding must have a precise location (file:line for code, Section > Subsection for prose) — vague locations make findings unactionable.

# Review

Run parallel reviewers with distinct roles, then merge their findings through a consensus gate.

## When to Use

- Pre-publish content checks
- Strategy or plan validation
- Code review
- Any prompt like "review this" or "is this good?"

## Reviewers

| Reviewer | Model | Focus |
|----------|-------|-------|
| `deep-reviewer` | opus | logic, structure, completeness |
| `devil-advocate` | sonnet | weakest points and blind spots |
| `fact-checker` | sonnet | claims, numbers, sources |
| `tone-guardian` | haiku | voice and audience fit |
| `structure-analyst` | haiku | organization and readability |

## Presets

| Preset | Reviewers | MMBridge |
|--------|-----------|----------|
| `content` | deep-reviewer + devil-advocate + tone-guardian | — |
| `strategy` | deep-reviewer + devil-advocate + fact-checker | — |
| `code` | deep-reviewer + fact-checker + structure-analyst | — |
| `security` | deep-reviewer + fact-checker + structure-analyst | `mmbridge security` (via `--external`) |
| `academic` | deep-reviewer + fact-checker + structure-analyst + devil-advocate | — |
| `quick` | devil-advocate + fact-checker | — |
| `full` | all 5 reviewers | — |

## Security Preset

The `security` preset activates security-focused review with optional mmbridge security integration.

### Internal reviewers (security mode)

- **deep-reviewer** (opus): Architecture security analysis — auth flows, data boundaries, privilege escalation paths
- **fact-checker** (sonnet): Known CVE checks, dependency vulnerability scanning, OWASP Top 10 verification
- **structure-analyst** (haiku): Configuration audit — secrets exposure, permission models, environment isolation

### MMBridge Security (via --external)

When `--external` is set and mmbridge is detected, `mmbridge security` runs in parallel with internal reviewers. Consistent with all other presets — `--external` is always opt-in.

```bash
mmbridge security --scope <scope> --json > /tmp/mmbridge-security-${RUN_ID}.json
```

**Option passthrough**:
- `--scope`: `/scc:review --preset security --scope auth` → `mmbridge security --scope auth` (default: `all`)
- `--compliance`: `/scc:review --preset security --compliance GDPR,SOC2` → `mmbridge security --compliance GDPR,SOC2`

### CWE Severity Mapping

mmbridge security uses CWE classification. Map to internal severities per `references/mmbridge-integration.md` § Severity Mapping.

### Consensus gate

mmbridge security counts as 1 additional voter (same as `--external` for other presets):
- Without mmbridge: 2/3 pass (3 internal reviewers)
- With mmbridge: 2/4 pass (3 internal + 1 mmbridge)

## Academic Preset

The `academic` preset activates academic-focused review for research papers, theses, dissertations, and scholarly articles.

### Internal reviewers (academic mode)

- **deep-reviewer** (opus): Argument structure review — thesis clarity, logical flow between sections, claim-evidence alignment, and overall coherence of the academic argument
- **fact-checker** (sonnet): Citation format validation — verifies references conform to the specified style (APA, MLA, or Chicago; default APA), checks for missing citations, inconsistent formatting, and broken cross-references
- **structure-analyst** (haiku): Literature gap analysis — identifies missing key references in the field, undercited foundational works, and areas where additional literature support would strengthen the argument
- **devil-advocate** (sonnet): Methodology critique and evidence quality assessment — challenges research design choices, statistical validity, sample size adequacy, potential biases, and evaluates the strength and relevance of evidence presented

### Option passthrough

- `--citation-style`: `/scc:review --preset academic --citation-style APA` (default: `APA`, accepts `APA`, `MLA`, `Chicago`)

### Academic review focus areas

1. **Citation format validation** — Ensures all in-text citations and bibliography entries conform to the specified style guide (APA 7th, MLA 9th, or Chicago 17th edition). Flags missing DOIs, incorrect author formatting, and inconsistent date formats.
2. **Methodology critique** — Evaluates research design appropriateness, sample selection, data collection methods, analytical frameworks, and reproducibility. Flags unsupported methodological claims.
3. **Literature gap analysis** — Identifies missing seminal works, undercited subfields, over-reliance on a single source, and areas where the literature review fails to establish the research context.
4. **Argument structure review** — Assesses thesis statement clarity, logical progression from introduction through discussion, whether conclusions follow from presented evidence, and internal consistency across sections.
5. **Evidence quality assessment** — Rates evidence on relevance, recency, authority, and sufficiency. Flags anecdotal evidence presented as empirical, outdated sources in fast-moving fields, and claims lacking adequate support.

### Consensus gate

Uses 4 reviewers (same gate logic as other presets):
- 3/4 pass (4 internal reviewers)
- With `--external`: 3/5 pass (4 internal + 1 external)

## Critic Output Format

Every reviewer MUST structure their output according to `references/critic-schema.md`. Each review must include:

1. **Verdict** — `APPROVED | MINOR FIXES | NEEDS IMPROVEMENT | MUST FIX`
2. **Score** — float `0.0` to `1.0` per the scale in `references/critic-schema.md`
3. **Findings** — structured table with severity, category, location, description, and suggestion for each issue
4. **Summary** — one sentence overall assessment

Unstructured prose output is not accepted. Each reviewer emits the `## Critic Output` block defined in `references/critic-schema.md`.

## Consensus Gate

**Score-based consensus** (primary gate):
- Pass condition: average score across reviewers `>= 0.7` AND no Critical findings from any reviewer
- Any Critical finding forces `MUST FIX` regardless of average score or threshold count

**Vote-count gate** (secondary gate, used when score-based gate passes):
- 3-reviewer presets (`content`, `strategy`, `code`): pass with 2/3 approvals
- 4-reviewer preset (`academic`): pass with 3/4 approvals
- 2-reviewer preset (`quick`): pass only with 2/2 unanimous approval
- 5-reviewer preset (`full`): pass with 3/5 approvals

**Final verdicts**: `APPROVED`, `MINOR FIXES`, `NEEDS IMPROVEMENT`, `MUST FIX`
- `NEEDS IMPROVEMENT` = threshold not met but no Critical findings (substantive rework needed)

**Score tracking**: store per-reviewer scores in the review aggregation block for cycle comparison. See `references/consensus-gate.md` for the aggregation format.

## Severity Calibration

Three levels: **Critical** (ship-blocking), **Major** (significant gap), **Minor** (polish). See `references/consensus-gate.md` for detailed criteria and examples.

## Workflow

1. Dispatch preset reviewers in parallel with independent context. Each reviewer receives ONLY the content to review and their role prompt — never another reviewer's findings.
2. Collect structured findings with severity levels.
3. Deduplicate overlapping findings (see Deduplication Rules below).
4. Apply the consensus gate and return a single report.

## Deduplication Rules

See `references/consensus-gate.md` for the full deduplication protocol. Key rule: severity conflicts use the higher severity with a noted disagreement.

## Output

Each finding MUST include all four fields: location, severity, description, and fix suggestion.

```markdown
# Review Report
## Verdict: {APPROVED | MINOR FIXES | NEEDS IMPROVEMENT | MUST FIX}
Consensus: {X}/{Y}

## Score Aggregation

| Reviewer | Score | Verdict |
|----------|-------|---------|
| {reviewer-name} | {0.00} | {APPROVED \| MINOR FIXES \| NEEDS IMPROVEMENT \| MUST FIX} |
| **Average** | **{0.00}** | — |

## Findings

### Critical
- **[reviewer(s)]** `{file:line | Section > Subsection | paragraph N}` — {description with evidence} → **Fix:** {specific actionable suggestion}

### Major
- **[reviewer(s)]** `{location}` — {description} → **Fix:** {specific suggestion}

### Minor
- **[reviewer(s)]** `{location}` — {description} → **Fix:** {specific suggestion}
```

**Format rules**:
- Location must be precise enough to find the issue without re-reading the whole document. Use `file:line` for code, `Section > Subsection` or `paragraph N` for prose.
- Fix suggestion must be a concrete action ("Change X to Y", "Add Z after line N"), never vague ("improve this", "consider revising").
- If multiple reviewers flagged the same finding, list all in the `[reviewer(s)]` tag.

## MMBridge Diff Visualization

When mmbridge is detected (see `references/mmbridge-integration.md`) and the review has completed, offer the user an annotated diff view.

### When to Offer

- After the Review Report is generated
- Only for `code` and `security` presets (diff annotation is most useful for code)
- Do not offer for `content`, `strategy`, `academic`, or `quick` presets

### Command

```bash
mmbridge diff --base-ref <base> > /tmp/mmbridge-diff-${RUN_ID}.md
```

- `--base-ref`: use the same base ref as the review (default: `HEAD~1`)
- `--tool kimi`: filter to show only findings from a specific tool (optional)

### Output

Present the annotated diff to the user as supplementary output after the Review Report. The diff shows exactly which lines each finding maps to, making it easier to act on review feedback.

This is a **display enhancement only** — it does not affect the consensus gate or verdict.

## Options

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--preset` | `content\|strategy\|code\|security\|academic\|quick\|full` | `content` | |
| `--threshold` | number | `0.67` | |
| `--strict` | flag | off | |
| `--external` | flag | off | |
| `--team-review` | flag | off | |
| `--scope` | `auth\|api\|infra\|all` | `all` | Security audit scope (security preset only) |
| `--compliance` | `GDPR,SOC2,HIPAA,PCI-DSS` | — | Compliance frameworks (security preset only) |
| `--citation-style` | `APA\|MLA\|Chicago` | `APA` | Citation style guide (academic preset only) |

## Team Review Workflow

When `--team-review` is set, the standard parallel dispatch is replaced by an Agent Team with deliberation:

1. Team lead creates a team with the 5 reviewer teammates (Xatu, Absol, Porygon, Jigglypuff, Unown).
2. Each reviewer independently reviews the artifact — no shared context at this stage (same isolation guarantee as standard mode).
3. All findings are shared across the team.
4. **Challenge round** (2 minutes max): each reviewer may dispute or reinforce other reviewers' findings. A dispute requires citing a specific counter-finding with evidence. A reinforcement counts as corroboration and raises that finding's weight.
5. Team lead aggregates the challenged findings: disputed findings are downgraded one severity level unless a third reviewer sides with the original; reinforced findings are locked at their current severity.
6. Consensus is computed from challenge-adjusted findings using the standard gate (`average score >= 0.7`, no Critical findings).
7. Team is shut down. Output conforms to the standard Review Report format.

## External Reviewers

When `--external` is set, dispatch a cross-model review in parallel with internal reviewers. The external review counts as 1 additional voter in the consensus gate.

For mmbridge detection, invocation, error handling, and timeout rules, see `references/mmbridge-integration.md`.

### Dispatch

When mmbridge is detected:

```bash
mmbridge review --tool kimi --mode review --stream --export /tmp/mmbridge-review-${RUN_ID}.md
```

Use `--tool kimi` (most reliable). Avoid `--tool all` (known race condition in concurrent writes).

When mmbridge is not found, check for standalone CLIs (`kimi`, `codex`, `gemini`). If found, delegate to the corresponding agent definition (e.g., `kimi-reviewer`). If none found, silently skip `--external`.

### Merging External Findings

1. Parse the mmbridge JSON output file for findings with severity markers.
2. Map severities per `references/mmbridge-integration.md` § Severity Mapping.
3. Add the external review as 1 voter. A 3-reviewer preset becomes 4 voters with `--external`.
4. Deduplicate against internal findings per `references/consensus-gate.md`.

## Gotchas

- Keep reviewers independent so they do not converge too easily.
- Require exact locations for findings.
- `fact-checker` cannot claim verification without source URLs.
- **Team review costs ~2–3x more than standard review** due to the challenge round. Use only for high-stakes content: `--depth deep` PDCA cycles or final-pass `full` preset reviews. Standard review is the default for all other cases.

## Subagents

```yaml
deep-reviewer: { model: opus, constraint: "cite exact sections or lines" }
devil-advocate: { model: sonnet, constraint: "attack exactly 3 weak points when applicable" }
fact-checker: { model: sonnet, tools: [WebSearch, WebFetch], constraint: "include URLs for verified claims" }
tone-guardian: { model: haiku, constraint: "check voice against guide and audience; if .data/soul/SOUL.md exists, include its ## Tone Rules and ## Anti-Patterns sections as primary voice criteria" }
structure-analyst: { model: haiku, constraint: "check flow, hierarchy, and redundancy" }
```
