# Coach Troubleshooting

| Problem | Likely cause | Resolution |
|---|---|---|
| Threshold source is missing | Phase 0 was skipped or settings were read after state creation | Resolve settings before any state write or question, then persist `threshold_source`. |
| Round 1 starts without topology | Legacy state or direct answer path bypassed Round 0 | Migrate state to `topology.status = legacy_missing` and run topology confirmation before scoring unless the forks are already recorded. |
| The same component is targeted repeatedly | Tie rotation is not using `last_targeted_component_id` | Recompute weakest target across active components and rotate tied weak siblings. |
| User-facing text changes language | The render path ignored `language.instruction` | Pass language into question, progress, standard, and approval option rendering. |
| Auto-mode crashes on malformed output | The validator iterates an invalid container | Validate container type first and iterate only real arrays. |
| Auto-mode answer makes the score too clean | Tentative architect answer was treated as user-confirmed truth | Apply the confidence cap and ask for explicit confirmation before recording a standard. |
| Brownfield question asks facts the repo knows | Exploration was skipped | Read relevant code/docs first and cite the evidence in the question. |
| Final output starts implementation | Approval bridge was bypassed | Record the standards and return pending approval options only. |
| A direction was chosen without the user seeing the alternatives | The divergence test was never applied | Ask whether another competent agent could answer differently on the same evidence; if so, put every direction in one question. |
| `record-fork` rejects the id | The id is not `^[a-z0-9][a-z0-9-]{0,63}$` | Give the fork an ASCII id; the user's wording belongs in `title`. |

## Recovery commands

```bash
node scripts/coach-runner.mjs status --json
node scripts/coach-runner.mjs resume --json
node scripts/coach-runner.mjs answer --answer "The topology looks right" --json
node scripts/coach-runner.mjs record-fork --file <path> --json
node scripts/coach-runner.mjs finalize --json
```

Use `clear` only when intentionally discarding the active coach state.
