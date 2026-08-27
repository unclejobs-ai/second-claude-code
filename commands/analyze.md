---
description: "Do/Produce phase -- apply strategic frameworks such as SWOT, RICE, OKR, and Lean Canvas"
argument-hint: swot "our product" or porter "cloud market"
---

Invoke the `/scc:analyze` command to apply a strategic framework through the `analyze` skill.

## Arguments
- First argument: framework name (swot|rice|okr|prd|lean-canvas|persona|journey-map|pricing|gtm|north-star|porter|pestle|ansoff|battlecard|value-prop)
- Second argument: subject to analyze
- `--depth quick|standard|thorough` (default: standard)
- `--skip-challenge` skip the depth-default challenge pass (use only when explicitly requested)

Challenge passes are selected by depth: standard runs one and thorough runs two. The supported
override is `--skip-challenge`; challenge is already the default at those depths.

## Your task
Perform the analysis now using the plugin's loaded `analyze` skill and the provided arguments.

- Use the requested framework if one is supplied.
- Return the final analysis directly.
- Do not say that you are invoking or have invoked a skill.
