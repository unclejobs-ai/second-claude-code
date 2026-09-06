# Residual worktree integration — 2026-09-06

## Decisions

- `codex/hermes-phase1`: no new feature to merge. Project memory, session injection, MCP memory tools, registry-first discovery and background-ready workflow guidance already landed in `da278f3` and subsequent revisions. Current memory includes later hardening (`b40f733`). The old metadata parser was intentionally removed in `44f2122` because it had no runtime consumers. Do not restore obsolete snapshots over current implementations.
- `feat/scc-core-v4`: retain the pure core package, build/release verification, portable test discovery, dependency refresh, Stop retry concurrency controls and filesystem boundary fixes. Preserve the final core contract tests and safe event append implementation.
- Exclude mandatory runtime core-gate integration, external-review broker wiring and completion-boundary enforcement. The experimental adapter sets both independent reviewer/provider availability to false, so every check-to-act transition returns `UNPROVEN`, even after successful native review. Its own end-to-end tests demonstrate that only abort remains available. SCC's existing transition and completion behavior remains active.
- Core package version 4.0.0 describes the independent library; the SCC plugin remains 3.0.3. No package publication or plugin installation is performed by this integration.

## Recovery

Original core commits are preserved in a verified local Git bundle under the main repository's `.git/cleanup-backups/2026-09-06/`. Hermes tracked/untracked residual files are archived there as well. Existing local AGENTS.md edits are preserved separately before worktree removal. These backups are local and are not published.

## Validation

The pure package must pass its contract, packed-consumer and strict TypeScript tests; checked-in dist/tarball bytes must reproduce. Hook regressions and the existing full plugin suite must pass with existing PDCA completion behavior unchanged. Regenerate the MCP bundle from maintained sources after dependency/event-log changes.

Final local validation passed: full plugin suite with concurrency 2 and network-only cases skipped; all 74 JavaScript module syntax checks; matching plugin manifest versions; deterministic core distribution/release verification. An independent reviewer also verified a complete legacy PDCA run and rejected symlinked event writes.
