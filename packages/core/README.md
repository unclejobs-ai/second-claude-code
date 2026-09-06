# `@second-claude/core`

Host-neutral quality contracts and pure policy decisions shared by Second Claude integrations.

The package ships checked-in ESM and TypeScript declarations. Consumers import `dist/index.js` directly without invoking a package manager or compiler at runtime. The SCC plugin does not activate this package as a mandatory workflow gate; its existing PDCA transition behavior is preserved. Persistence, environment access, hook input, MCP transport, and execution remain adapter responsibilities.

```js
import {
  classifyQualityProfile,
  evaluateGate,
  validatePlan
} from "@second-claude/core";
```

The shared cross-host fixture is exported at `@second-claude/core/fixtures/quality-contract.json`.

Completion validation takes a host-supplied current artifact hash, producer identity, and reviewer-availability context. Every artifact and reviewer evidence item must be attributed to that producer. Non-minimal profiles cannot complete without current, passing, independent reviewer evidence and completed `critic` and `promote` stages. A reviewer result proves approval only when it is exactly `"pass"` or `true`; `"warning"`, numeric scores, and other results remain unproven.

Core evaluates this contract; it does not authenticate the host or manufacture provenance. An integrating host must establish reviewer identity outside worker-controlled artifacts before reporting independent reviewer or provider availability. Same-user, locally HMAC-tagged records are diagnostic telemetry, not independent proof: code running as that user can read the key and forge a record. The abandoned experimental standalone adapter could not establish that proof and always returned `UNPROVEN`; it is deliberately not enabled in SCC.

Evolution validation remains host-neutral: the host supplies the current candidate artifact hash, resolves canonical branch/worktree existence and identity, then passes an `EvolutionIsolationAttestation`, an explicit evaluation timestamp, and a maximum attestation age. Core requires nonblank candidate, creator, evaluator, and held-out benchmark identities; finite baseline/candidate scores; a strict held-out score improvement; and current, passing reviewer evidence attributed to the candidate creator. It rejects self-review. Timestamps use canonical UTC ISO 8601 with milliseconds (`YYYY-MM-DDTHH:mm:ss.sssZ`), and proof remains fresh through the inclusive maximum-age boundary. Core binds isolation proof exactly to the candidate, branch, and worktree and rejects incomplete, future, stale, mismatched, nonexistent, base/current, or creator/evaluator-supplied isolation evidence without reading the filesystem or consulting a clock.
