# Coach Skill

Coach settles forks. A fork is a request with more than one defensible direction — the test is whether another competent agent, reading the same evidence, could reach a different defensible answer, not whether this one feels uncertain. Coach confirms the scope topology, asks one question per round, scores ambiguity after each answer, records each settled fork as a standard under the project, and stops at approval options.

## Quick example

```bash
/scc:coach "the voice of these posts is off and I need today's draft"

node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" start --idea "Settle the voice direction" --json
node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" answer --answer "The topology looks right" --json
node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" status --json
node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" record-fork --file fork.json --json
node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" finalize --json
```

**What happens:** the runner resolves the ambiguity threshold, creates resumable state under the project's `.scc/`, locks Round 0 topology, scores each answer, writes one `.scc/standards/<id>/STANDARD.md` per settled fork, and returns approval options. It never runs commits, formatters, or source mutation from the coach runtime.

## When to use

Use `/scc:coach` when:

- the request has two or more directions that are each defensible on the evidence;
- the evidence supports declining the request as written, and that has to be the user's call rather than yours;
- multiple components could be built independently and the topology is not stable;
- a decision made here will constrain later work and needs to survive the session.

Use direct execution when a standard on file already covers the fork, or the request already carries concrete files, symbols, acceptance criteria, or an approved plan.

## Runtime flow

1. Resolve `scc.coach.ambiguityThreshold` from project settings, user settings, or the default `0.05`.
2. Read `.scc/standards/*/STANDARD.md`. A fork already settled there is followed and cited, not reopened.
3. Detect brownfield versus greenfield and gather repository facts before asking codebase questions.
4. Run Round 0 topology confirmation and lock every top-level component.
5. Ask one question per round, targeting the weakest active component and clarity dimension, with every defensible direction as an option.
6. Score ambiguity using the greenfield or brownfield weighted formula.
7. Preserve the session language in questions, options, reports, and standards.
8. Record each settled fork with `record-fork --file <path>` before drafting the artifact.
9. Stop at pending approval options: `confirm`, `continue`, `plan-mode`.

`finalize` refuses while the topology is unconfirmed or ambiguity sits above the threshold, and names which one is open. That is not a hard stop — the spec allows a user to accept residual risk — but the acceptance has to be explicit and on the record: `--accept-risk "<why>"` stores the reason, the risks, and the numbers it was accepted against. A bare `--accept-risk` with no reason is refused, so acceptance cannot become reflexive.

`confirm` closes a finalized interview and removes `.scc/state/coach.json`. The decisions survive in their standards; state was only the resumable remainder, and once confirmed there is nothing to resume. That also settles a three-way disagreement: session-end read `pending_approval` as closed, `start` read it as open, and SessionStart offered to resume it. With the file gone, all three agree.

## The fork file

`record-fork` reads its input from a file rather than argv, because the payload carries newlines and non-ASCII prose that a shell round-trip mangles.

| Field | Meaning |
|---|---|
| `id` | Lowercase, digits and hyphens, 1-64 characters. Becomes the standard directory name. |
| `title` | What the fork was, in the user's terms. |
| `chosen` | The direction the user picked. |
| `rejected` | The other defensible directions, each with `label` and `why` it lost. |
| `payload` | The content the standard carries forward. |
| `review_when` | The condition that would reopen the decision. |
| `triggers` | Phrases that should surface this standard again later. |

## Compliance checks

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/standard-check.mjs" <target path> [--standard <id>] [--json]
```

Runs every active standard's checks against one artifact and exits 1 if any fails. Two standards whose checks cannot both be satisfied produce two failures and no arbitration — the runner reports the conflict and a human resolves it by retiring one.

A check is data the runner interprets, never a string it executes. Standards live in the user's project and travel through its repository, so `run:`-style fields are refused with an error rather than ignored; an author who thinks a check is enforced while the runner steps over it is worse off than one with no check at all. The same refusal covers unknown checker ids and unknown fields.

| Checker | Args | Fails when |
|---|---|---|
| `regex-absent` | `pattern`, `flags` | the pattern appears in the body |
| `regex-present` | `pattern`, `flags` | the pattern is missing |
| `length-between` | `unit` (`char`\|`word`), `min`, `max` | the body falls outside the range |
| `similarity-below` | `a`, `b` (heading paths such as `S-A#closing`), `threshold` | the two sections score at or above the ceiling |
| `frontmatter-equals` | `field`, `value` | the target's frontmatter field differs |

Each checker ships a fixture under `tests/fixtures/standard-checks/<checker>/` that it must reject. The fixtures live in this repository rather than in the user's project, because a project-supplied fixture would be another input crossing the trust boundary. A checker that starts passing its own fixture breaks the suite.

A standard with no checks is reported `UNCHECKED` — visible, not verified, and never a pass. It does not set exit 1, because it is not a violation.

### Adversarial checks

An `adversarial` check names a question no regex settles — whether two posts read as one voice, whether a claim is overstated. It is `UNPROVEN` until a reviewer's answer is on file:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/coach-runner.mjs" record-verdict --file <verdict.json>
```

The verdict carries `standard`, the exact `ask`, `verdict` (`pass`/`fail`), `reviewer`, an optional `note`, and `target_sha256` — the hash of the artifact the reviewer actually read, which `standard-check` prints alongside every `UNPROVEN` line. Answers append to `.scc/checks/adversarial.jsonl`; the log is append-only because five sessions share the project and a read-modify-write would drop whichever verdict lost the race.

Binding a verdict to bytes is what keeps it honest: edit the artifact and its answers go back to `UNPROVEN`, since a review of last week's draft says nothing about this one. Verdicts are recorded through the coach runner rather than through `standard-check`, so the tool that grades the work is never the tool that records passing grades.

## Retiring a standard

A standard is retired, never deleted. `supersede --id <id>` flips its frontmatter to `status: superseded` and leaves the file where it is, so the rejected directions stay on record and a later session cannot re-propose an option that already lost. `listActiveStandards` and the SessionStart hook skip retired records; the file remains readable.

Pass `--file <fork.json>` as well when a new decision takes the old one's place. The replacement is written first, carrying `supersedes: "<old id>"`, and only then is the old record retired — a colliding replacement id aborts while the existing standard is still active, rather than leaving the project with none. Run it during an interview and the replacement id is appended to state; run it standalone and no state is required.

## Scoring model

| Project type | Goal | Constraints | Success criteria | Brownfield context |
|---|---:|---:|---:|---:|
| Greenfield | 40% | 30% | 30% | - |
| Brownfield | 35% | 25% | 25% | 15% |

Ambiguity is `1 - weighted_clarity`. The default resolved threshold is `0.05`, but settings may lower or raise it. Multi-component runs use the weakest active component/dimension pair and rotate between tied weak components so one detailed sibling cannot hide unclear siblings.

## State and artifacts

- Runtime state: `<project>/.scc/state/coach.json`.
- Standards: `<project>/.scc/standards/<id>/STANDARD.md`, one per settled fork.
- Internal fragments: `skills/coach/references/fragments/auto-research-greenfield.md` and `auto-answer-uncertain.md`.
- Contract tests: `tests/runtime/coach-runner.test.mjs`, `tests/runtime/coach-cli.test.mjs`, and `tests/contracts/coach-contracts.test.mjs`.

## Safety gates

- Round 0 topology must happen before scored rounds.
- Multi-component runs must rotate across weak sibling components instead of overfitting to one detailed component.
- Auto-mode fragments are internal `kind: skill-fragment` prompts only; they are not public commands or `skill://` routes.
- Auto-mode responses must validate exact shape, non-empty rationale/fallback fields, and `low|medium|high` confidence.
- Invalid auto-mode output must fall back safely and increment diagnostic failure accounting.
- Final output is a recorded standard plus approval options, not execution.

## Reference docs

- [Protocol](../../skills/coach/references/protocol.md)
- [Scoring](../../skills/coach/references/scoring.md)
- [Fixtures](../../skills/coach/references/fixtures.md)
- [Troubleshooting](../../skills/coach/references/troubleshooting.md)
- [Example transcript](../../skills/coach/references/example-transcript.md)
- [Acceptance checklist](../../skills/coach/references/acceptance-checklist.md)
- [Gotchas](../../skills/coach/gotchas.md)

## Troubleshooting

| Symptom | Fix |
|---|---|
| Coach asks about facts already visible in the repo | Gather brownfield context first and cite file paths or symbols in the next question. |
| A direction gets picked without the user seeing the alternatives | Ask whether another competent agent could answer differently; if so, put every direction in one question. |
| Ambiguity does not fall | Target the weakest component/dimension pair and use ontology-style questions if core nouns are unstable. |
| Session language regresses unexpectedly | Preserve `language.instruction` in state and pass it into question, standard, and option rendering. |
| Auto-mode response looks plausible but malformed | Reject it through the validator, record `architect_failures`, and continue the manual path. |
| `record-fork` refuses the id | Ids are `^[a-z0-9][a-z0-9-]{0,63}$`. Give the fork an ASCII id; the title carries the user's wording. |
| User wants implementation immediately | Record the standard, show the risk if ambiguity is still high, and require explicit execution approval. |
