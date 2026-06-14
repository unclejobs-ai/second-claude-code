# Deep Interview Troubleshooting

| Problem | Likely cause | Resolution |
|---|---|---|
| Threshold source is missing | Phase 0 was skipped or settings were read after state creation | Resolve settings before any state write or question, then persist `threshold_source`. |
| Round 1 starts without topology | Legacy state or direct answer path bypassed Round 0 | Migrate state to `topology.status = legacy_missing` and run topology confirmation before scoring unless a final spec already exists. |
| The same component is targeted repeatedly | Tie rotation is not using `last_targeted_component_id` | Recompute weakest target across active components and rotate tied weak siblings. |
| User-facing text changes language | The render path ignored `language.instruction` | Pass language into question, progress, spec, and approval option rendering. |
| Auto-mode crashes on malformed output | The validator iterates an invalid container | Validate container type first and iterate only real arrays. |
| Auto-mode answer makes the score too clean | Tentative architect answer was treated as user-confirmed truth | Apply the confidence cap and ask for explicit confirmation before threshold-crossing spec generation. |
| Brownfield question asks facts the repo knows | Exploration was skipped | Read relevant code/docs first and cite the evidence in the question. |
| Final output starts implementation | Approval bridge was bypassed | Persist the spec and return pending approval options only. |

## Recovery commands

```bash
node scripts/deep-interview-runner.mjs status --json
node scripts/deep-interview-runner.mjs resume --json
node scripts/deep-interview-runner.mjs answer --answer "The topology looks right" --json
node scripts/deep-interview-runner.mjs finalize --slug <slug> --json
```

Use `clear` only when intentionally discarding the active interview state.
