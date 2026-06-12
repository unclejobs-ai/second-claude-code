# Release v1.5.2

v1.5.2 adds a Code Engineering Lane for `domain=code` PDCA runs. The change keeps Second Claude's Plan -> Do -> Check -> Act architecture intact, but tightens repository work around executable plans, implementation isolation, independent validation, cleanup, and durable handoff state.

## Added

- **Code Engineering Lane** — `skills/pdca/references/code-engineering-lane.md` defines the code-work specialization.
- **Borrowed discipline, not a new runtime** — the lane absorbs useful practices from `engineering-discipline` and `Hyper-Waterfall`: worker-validator separation, stage reports, human approval gates, issue/branch/session continuity, PR or local handoff, clean-ai-slop, and Rob Pike style measurement for performance claims.
- **Stage report template** — long or multi-stage code work now has a concrete progress-report shape covering goal, changed surface, verification, failures, and decision.

## Changed

- **Code stage contracts** — `config/stage-contracts.json` now requires executable acceptance criteria, rollback path, approval-gate status, branch/worktree isolation or a direct-edit reason, validator/reviewer proof, cleanup/simplification, and final handoff state.
- **PDCA skill contract** — `skills/pdca/SKILL.md` now loads the Code Engineering Lane before planning code work.
- **Public docs** — README, Korean README, architecture docs, and PDCA skill guides now describe the code lane consistently.
- **Release metadata** — package metadata, plugin manifest, marketplace metadata, and badges now align on v1.5.2.

## Verification

- `npm test` — 406 tests, 405 pass, 0 fail, 1 skipped
- `node --test tests/contracts/skill-contracts.test.mjs`
- `node --check tests/contracts/skill-contracts.test.mjs`
- `node --check hooks/*.mjs mcp/*.mjs daemon/*.mjs`
- `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"`
- `node -e "JSON.parse(require('fs').readFileSync('config/stage-contracts.json','utf8'))"`
- Agent frontmatter and skill `SKILL.md` checks

No breaking changes. v1.5.1 deployments upgrade transparently.
