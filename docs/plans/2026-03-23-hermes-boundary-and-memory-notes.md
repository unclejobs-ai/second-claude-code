# Hermes Boundary and Memory Notes

Date: 2026-03-23
Status: adopted as operating guidance

## Decision

- Do not embed `hermes-agent` as a second runtime inside Second Claude Code.
- Keep Second Claude Code as a Claude Code plugin with PDCA orchestration, hooks, subagents, and MMBridge integration.
- Borrow concepts selectively instead of adopting Hermes wholesale.

## What to Borrow

- Stronger separation between user preference memory and project/session recall
- Durable recall patterns for related sessions and follow-up chains
- Explicit approval discipline for external skill installation

## What Not to Borrow

- Messaging gateway runtime
- Cron scheduler as a core plugin dependency
- Hermes-branded agent OS positioning
- A second independent tool/runtime layer inside the plugin

## Memory Boundary

Second Claude Code now treats memory as two different layers:

1. `soul`
   - persistent identity and preference synthesis
   - evidence-backed user profile
   - not a project recall system

2. project recall
   - prior PDCA work, review chains, and MMBridge continuity
   - should come from `mmbridge memory`, handoff artifacts, resume flows, and PDCA recovery state
   - should not be collapsed into `SOUL.md`

## Discovery Boundary

`discover` remains approval-first:

- inspect before recommending
- pin versions before recommending install
- never auto-install
- persist the discovery result so later sessions can review the prior decision

## Standalone Hermes

Hermes can still be useful as a separate operator tool for long-memory research or personal assistant flows. That is compatible with Second Claude Code, but it should remain outside the plugin runtime.
