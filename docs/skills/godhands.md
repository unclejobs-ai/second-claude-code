[한국어](godhands.ko.md)

# God Hands

> Extra hands that find, analyze, plan, decompose, benchmark, and improve. Check is never skipped.

**Public orchestrator.** Call `/scc:godhands`. Runtime state and MCP tools stay `pdca_*`. `/scc:pdca` is the slash-only compat name.

## Quick Example

```
/scc:godhands "AI agent market report" --depth deep
```

**What happens:** Gather runs `/scc:research` and `/scc:analyze`. Draft runs `/scc:write --skip-research --skip-review`. Check runs `/scc:review`. Cut routes findings through the Action Router to `/scc:refine` or back to Gather/Draft. Gates are mandatory.

Direct `/scc:write` plus `/scc:godhands` double-reviews unless Draft skips write's internal review.

See [pdca.md](pdca.md) for phase schemas, runtime-enforced gate subsets, and cycle memory. That guide is the engine; this one is the public name.
