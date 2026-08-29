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

Completion validation takes a host-supplied current artifact hash, producer identity, and reviewer-availability context. Every artifact and reviewer evidence item must be attributed to that producer. Non-minimal profiles cannot complete without current, passing, independent reviewer evidence and completed `critic` and `promote` stages. A reviewer result proves approval only when it is exactly `"pass"` or `true`; `"warning"`, numeric scores, and other results remain unproven.

Evolution validation remains host-neutral: the host supplies the current candidate artifact hash, resolves canonical branch/worktree existence and identity, then passes an `EvolutionIsolationAttestation`, an explicit evaluation timestamp, and a maximum attestation age. Core requires current, passing reviewer evidence attributed to the candidate creator and rejects self-review. Timestamps use canonical UTC ISO 8601 with milliseconds (`YYYY-MM-DDTHH:mm:ss.sssZ`), and proof remains fresh through the inclusive maximum-age boundary. Core binds isolation proof exactly to the candidate, branch, and worktree and rejects incomplete, future, stale, mismatched, nonexistent, base/current, or creator/evaluator-supplied isolation evidence without reading the filesystem or consulting a clock.
