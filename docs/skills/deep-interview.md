# Deep Interview Skill

Deep Interview turns vague ideas into approval-gated specifications. It is a requirements workflow, not an implementation workflow. It confirms the scope topology first, asks one targeted Socratic question per round, reports ambiguity after every answer, and stops at a pending-approval spec.

## Quick example

```bash
/second-claude-code:deep-interview "I want to improve this plugin but I am not sure what matters"

node scripts/deep-interview-runner.mjs start --idea "Improve this plugin" --json
node scripts/deep-interview-runner.mjs answer --answer "The topology looks right" --json
node scripts/deep-interview-runner.mjs status --json
node scripts/deep-interview-runner.mjs finalize --slug second-claude-code-deep-interview-v1 --json
```

**What happens:** the runner resolves the ambiguity threshold, creates resumable interview state, locks Round 0 topology, scores each answer, writes `.gjc/specs/deep-interview-{slug}.md`, and returns approval options. It never executes ralplan, ultragoal, team, commits, formatters, or source mutation from the interview runtime.

## When to use

Use `/second-claude-code:deep-interview` when:

- the user has a vague idea and wants assumptions exposed before execution;
- multiple components could be built independently and the topology is not stable;
- brownfield work needs repository facts gathered before asking the user to decide;
- the output should feed ralplan consensus, ultragoal, or team only after explicit approval.

Use direct execution only when the request already includes concrete files, symbols, acceptance criteria, or an approved plan.

## Runtime flow

1. Resolve `gjc.deepInterview.ambiguityThreshold` from project settings, user settings, or the default `0.05`.
2. Detect brownfield versus greenfield and gather repository facts before asking codebase questions.
3. Run Round 0 topology confirmation and lock every top-level component.
4. Ask one question per round, targeting the weakest active component and clarity dimension.
5. Score ambiguity using the greenfield or brownfield weighted formula.
6. Preserve the session language in questions, options, reports, and specs.
7. Persist the final spec at `.gjc/specs/deep-interview-{slug}.md`.
8. Stop at pending approval options; do not execute ralplan, ultragoal, or team from the interview.

## Scoring model

| Project type | Goal | Constraints | Success criteria | Brownfield context |
|---|---:|---:|---:|---:|
| Greenfield | 40% | 30% | 30% | - |
| Brownfield | 35% | 25% | 25% | 15% |

Ambiguity is `1 - weighted_clarity`. The default resolved threshold is `0.05`, but settings may lower or raise it. Multi-component interviews use the weakest active component/dimension pair and rotate between tied weak components so one detailed sibling cannot hide unclear siblings.

## State and artifacts

- Runtime state: `${CLAUDE_PLUGIN_DATA}/deep-interview-active.json` through the existing state manager.
- Final specs: `.gjc/specs/deep-interview-{slug}.md`.
- Internal fragments: `skills/deep-interview/references/fragments/auto-research-greenfield.md` and `auto-answer-uncertain.md`.
- Contract tests: `tests/runtime/deep-interview-runner.test.mjs` and `tests/contracts/deep-interview-contracts.test.mjs`.

## Safety gates

- Round 0 topology must happen before scored rounds.
- Multi-component interviews must rotate across weak sibling components instead of overfitting to one detailed component.
- Auto-mode fragments are internal `kind: skill-fragment` prompts only; they are not public commands or `skill://` routes.
- Auto-mode responses must validate exact shape, non-empty rationale/fallback fields, and `low|medium|high` confidence.
- Invalid auto-mode output must fall back safely and increment diagnostic failure accounting.
- Final output is a pending-approval spec, not execution.

## Reference docs

- [Protocol](../../skills/deep-interview/references/protocol.md)
- [Scoring](../../skills/deep-interview/references/scoring.md)
- [Fixtures](../../skills/deep-interview/references/fixtures.md)
- [Troubleshooting](../../skills/deep-interview/references/troubleshooting.md)
- [Example transcript](../../skills/deep-interview/references/example-transcript.md)
- [Acceptance checklist](../../skills/deep-interview/references/acceptance-checklist.md)
- [Gotchas](../../skills/deep-interview/gotchas.md)

## Troubleshooting

| Symptom | Fix |
|---|---|
| The interview asks about facts already visible in the repo | Gather brownfield context first and cite file paths or symbols in the next question. |
| Ambiguity does not fall | Target the weakest component/dimension pair and use ontology-style questions if core nouns are unstable. |
| Session language regresses unexpectedly | Preserve `language.instruction` in state and pass it into question, spec, and option rendering. |
| Auto-mode response looks plausible but malformed | Reject it through the validator, record `architect_failures`, and continue the manual interview path. |
| User wants implementation immediately | Persist the spec, show the risk if ambiguity is still high, and require explicit execution approval. |
