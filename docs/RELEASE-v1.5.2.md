# Release v1.5.2

v1.5.2 adds Deep Interview as the 18th public command/skill and introduces a Code Engineering Lane for `domain=code` PDCA runs. The release keeps Second Claude's Plan -> Do -> Check -> Act architecture intact while improving both sides of code work: clearer requirements before execution, then stricter planning, implementation isolation, independent validation, cleanup, and durable handoff state during execution.

## Added

- **Deep Interview** — `/scc:deep-interview`, `skills/deep-interview/`, and `scripts/deep-interview-runner.mjs` provide Socratic requirements discovery with Round 0 topology confirmation, ambiguity scoring, ontology convergence, language-preserving specs, internal auto-mode fragments, and approval-gated handoff.
- **Code Engineering Lane** — `skills/pdca/references/code-engineering-lane.md` defines the code-work specialization.
- **Borrowed discipline, not a new runtime** — the lane absorbs useful practices from `engineering-discipline` and `Hyper-Waterfall`: worker-validator separation, stage reports, human approval gates, issue/branch/session continuity, PR or local handoff, clean-ai-slop, and Rob Pike style measurement for performance claims.
- **Stage report template** — long or multi-stage code work now has a concrete progress-report shape covering goal, changed surface, verification, failures, and decision.

## Changed

- **Code stage contracts** — `config/stage-contracts.json` now requires executable acceptance criteria, rollback path, approval-gate status, branch/worktree isolation or a direct-edit reason, validator/reviewer proof, cleanup/simplification, and final handoff state.
- **PDCA skill contract** — `skills/pdca/SKILL.md` now loads the Code Engineering Lane before planning code work.
- **Public docs** — README, Korean README, architecture docs, Deep Interview guides, and PDCA skill guides now describe the 18-skill surface consistently.
- **Release metadata** — package metadata, plugin manifest, marketplace metadata, and badges now align on v1.5.2.

## Verification

- `npm run test` — 427 tests, 426 pass, 0 fail, 1 skipped
- `node --test tests/contracts/skill-contracts.test.mjs`
- `node --check tests/contracts/skill-contracts.test.mjs`
- `node --check hooks/*.mjs mcp/*.mjs daemon/*.mjs`
- `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"`
- `node -e "JSON.parse(require('fs').readFileSync('config/stage-contracts.json','utf8'))"`
- Agent frontmatter and skill `SKILL.md` checks

No breaking changes. v1.5.1 deployments upgrade transparently.
