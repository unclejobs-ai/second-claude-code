# `@second-claude/core`

Host-neutral quality contracts and pure policy decisions shared by Second Claude integrations.

The package ships checked-in ESM and TypeScript declarations. Plugin startup imports `dist/index.js` directly and never invokes a package manager or compiler. Persistence, environment access, hook input, MCP transport, and execution remain adapter responsibilities.

```js
import {
  classifyQualityProfile,
  evaluateGate,
  validatePlan
} from "@second-claude/core";
```

The shared cross-host fixture is exported at `@second-claude/core/fixtures/quality-contract.json`.

Completion validation takes a host-supplied current artifact hash, producer identity, and reviewer-availability context. Non-minimal profiles cannot complete without current, passing, independent reviewer evidence and completed `critic` and `promote` stages.

Evolution validation remains host-neutral: the host resolves branch/worktree existence and identity, then passes an `EvolutionIsolationAttestation`. Core binds that attestation to the proposal and rejects missing, mismatched, nonexistent, base/current, or creator/evaluator-supplied isolation evidence without reading the filesystem.
