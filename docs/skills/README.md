# Skill guides

These guides are the human-facing reference for `/scc:*`. They describe the
current runtime contract, useful invocation examples, and the boundaries that
matter when choosing a command.

## What is available

The catalog contains **15 skills** and **3 tool-only commands**:

| Kind | Names | What it means |
|---|---|---|
| Skills | `analyze`, `batch`, `coach`, `collect`, `discover`, `evolve`, `loop`, `pdca`, `refine`, `research`, `review`, `soul`, `translate`, `workflow`, `write` | Reasoning, research, production, quality, stateful learning, or orchestration workflows. These may dispatch agents and apply the contracts documented here. |
| Tools | `standard-check`, `unblock`, `viewer` | Deterministic utilities. They fetch, inspect, check, or serve data; they do not occupy a skill slot or imply a judgment pass. |

Each guide has an English file and a Korean counterpart (`*.ko.md`). The two
files are translations of the same contract; examples may use the language of
the guide, but flags, defaults, gates, and safety boundaries must match.

## Choosing a guide

- Gather or investigate: `research`, `collect`, `discover`.
- Produce or improve: `write`, `analyze`, `translate`, `refine`.
- Verify or orchestrate: `review`, `pdca`, `workflow`, `batch`.
- Settle a genuine decision fork first: `coach`.
- Maintain prompt assets: `loop`, `evolve` (maintainer-only).
- Learn and apply a persisted voice profile: `soul`.
- Use `unblock`, `standard-check`, or `viewer` when you need the corresponding
  utility, not a new reasoning workflow.

## Contract conventions

Examples are illustrative, not promises of fixed scores, source counts, or
review outcomes. A guide calls out whether a behavior is runtime-enforced,
skill-level guidance, or user approval. External installs, paid providers, and
publishing remain opt-in where stated by the command contract.
