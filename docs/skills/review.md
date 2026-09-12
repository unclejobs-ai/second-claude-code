[한국어](review.ko.md)

# Review

> Run independent specialist reviewers, merge their structured findings, and apply one consensus gate.

## When to use

Use `review` before publishing content, validating a strategy, checking code,
or answering “is this good?”. Reviewers receive only the target and their role;
they do not see one another's reports.

## Quick example

```text
/scc:review README.md --preset content
```

The preset dispatches 2–5 reviewers in parallel. Each returns a verdict, a
0.0–1.0 score, and findings with precise locations, severity, and a concrete
fix. The aggregator deduplicates findings, applies the consensus gate, and
returns one report. Names, scores, and findings in examples are illustrative.

## Presets and reviewers

| Preset | Reviewers | Approval votes |
|---|---|---|
| `content` | deep-reviewer, devil-advocate, tone-guardian | 2/3 |
| `strategy` | deep-reviewer, devil-advocate, fact-checker | 2/3 |
| `code` | deep-reviewer, fact-checker, structure-analyst | 2/3 |
| `security` | code trio; optional `mmbridge security` with `--external` | 2/3 or 3/4 |
| `academic` | deep-reviewer, fact-checker, structure-analyst, devil-advocate | 3/4 |
| `quick` | devil-advocate, fact-checker | 2/2 |
| `full` | all five reviewers | 3/5 |

The primary gate also requires average score `>= 0.7` and no Critical finding.
Any Critical finding forces `MUST FIX`. Final verdicts are `APPROVED`, `MINOR
FIXES`, `NEEDS IMPROVEMENT`, and `MUST FIX`. A threshold miss without a
Critical finding is `NEEDS IMPROVEMENT`.

## Options

| Flag | Values | Default |
|---|---|---|
| `--preset` | `content\|strategy\|code\|security\|academic\|quick\|full` | `content` |
| `--threshold` | fraction `0..1` | `0.67` |
| `--strict` | flag | off |
| `--external` | flag | off |
| `--scope` | `auth\|api\|infra\|all` | `all` (security) |
| `--compliance` | `GDPR,SOC2,HIPAA,PCI-DSS` | none |
| `--team-review` | flag | off |
| `--citation-style` | `APA\|MLA\|Chicago` | `APA` (academic) |

## Output contract

Every finding includes `location`, `severity` (`Critical`, `Major`, or
`Minor`), `description`, and `fix suggestion`. Review reports use the
`## Critic Output` schema described in `references/critic-schema.md`.
Reviewers must not claim fact verification without source URLs. If an upstream
agent helped produce the artifact, it is excluded from the vote; if that leaves
too few independent reviewers, the verdict is `BLOCKED — QUORUM SHORT`.

`--external` is opt-in. If no supported CLI is installed it is ignored; an
external failure never blocks the internal review.

## Works with

| Skill | Relationship |
|---|---|
| `write` | Runs `quick` review internally unless `--skip-review`. |
| `analyze` | Validates a framework analysis. |
| `refine` | Repeats review and applies selected fixes. |
| `pdca` | Supplies the Check-phase verdict. |
