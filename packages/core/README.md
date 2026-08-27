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
