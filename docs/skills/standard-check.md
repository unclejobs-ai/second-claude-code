[한국어](standard-check.ko.md)

# Standard Check

> Runs the standards recorded under `.scc/standards/` against one artifact. Exit 1 on any violation.

`standard-check` is a command, not a skill. It interprets checks and reports what they say; the
judgment lives in the standards themselves, which `/scc:coach` wrote when you settled the fork.

## Quick Example

```bash
/scc:standard-check drafts/launch-post.md
```

```
FAIL no-hype / regex-absent — the target contains "단순히", which /단순히/ forbids
UNPROVEN no-hype — adversarial, needs an independent reviewer: does this read without overstatement?
  record answers against target_sha256 d0281896bfe6678dfd0e4fdc65299e1218d07676141d2a86c14eadab62465474
1 failure(s) across 1 checked standard(s)
```

## Options

| Flag | Values | Default |
|------|--------|---------|
| `--standard` | a standard id | every active standard |
| `--json` | — | human-readable output |

Retired standards are skipped. `--standard` with an id that is not active is an error, not an empty
run.

## Checkers

Five, fixed. A standard names one by id and passes structured arguments.

| Checker | Args | Fails when |
|---|---|---|
| `regex-absent` | `pattern`, `flags` | the pattern appears in the body |
| `regex-present` | `pattern`, `flags` | the pattern is missing |
| `length-between` | `unit` (`char`\|`word`), `min`, `max` | the body falls outside the range |
| `similarity-below` | `a`, `b`, `threshold` | two sections score at or above the ceiling |
| `frontmatter-equals` | `field`, `value` | the target's frontmatter field differs |

`similarity-below` takes heading paths — `S-A#closing` is the `closing` heading nested under `S-A`.
Similarity is the Dice coefficient over character bigrams, which holds up in Korean where
whitespace tokens undercount overlap.

Frontmatter is separated from the body before any checker runs, so a body regex cannot match
metadata and `frontmatter-equals` cannot match prose.

## Results that are not passes

| Result | Meaning | Exit 1? |
|---|---|---|
| `FAIL` | a check said no | yes |
| `UNPROVEN` | adversarial, no reviewer answer on file for these bytes | no |
| `UNCHECKED` | the standard has no checks at all | no |

Neither `UNPROVEN` nor `UNCHECKED` is a violation, and neither is a pass. Report them as what they
are. A standard with no checks is visible, not verified.

## Answering an adversarial check

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" record-verdict --file verdict.json
```

```json
{
  "standard": "no-hype",
  "ask": "does this read without overstatement?",
  "target_sha256": "d0281896…",
  "verdict": "pass",
  "reviewer": "codex",
  "note": "optional"
}
```

A verdict is refused outright when its `reviewer` is listed in the standard's `participants` — whoever helped settle the fork cannot pass the work it governs.

The `target_sha256` is the hash `standard-check` printed. Edit the artifact and its verdicts return
to `UNPROVEN` — a review of last week's draft says nothing about this one. Verdicts append to
`.scc/checks/adversarial.jsonl`, and they go through the coach runner rather than through this
command, so the tool that grades the work never records the passing grade.

## Hard Rules

- **A check is data, not code.** A standard travels through a repository. `run:`, `command:`, and
  `shell:` fields are refused with an error, as are unknown checker ids and unknown fields. Skipping
  them silently would leave the author believing a check is enforced.
- **A checker must be able to say no.** Each ships a must-fail fixture under
  `tests/fixtures/standard-checks/<checker>/`. The suite fails if a checker starts passing its own
  fixture. The fixtures live in this repository, because a project-supplied fixture would be another
  input crossing the trust boundary.
- **Conflicts are reported, not resolved.** Two standards that cannot both be satisfied produce two
  failures. Retiring one is a human decision.
- **You do not grade your own work.** If the artifact under check is one you produced this session,
  say so when you report the result.

## Adding a checker

Add it to `scripts/lib/standard-checkers.mjs` and ship a fixture directory it must reject. There is
no path for a project to supply its own checker code, and that is the point.

## Works With

- [Coach](coach.md) — writes the standards this runs
