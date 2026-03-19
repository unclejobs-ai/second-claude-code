---
name: hunt
description: "Dynamic skill discovery — find, evaluate, and install new skills on demand"
---

# Hunt

When the existing 8 skills cannot handle a task, search for external skills across marketplaces, evaluate candidates, and install with user approval. The meta-skill that extends the plugin's capabilities.

## When to Use

- User requests a capability not covered by current skills
- A pipeline step needs a skill that does not exist locally
- User wants to browse available skills for a domain
- Periodic skill inventory refresh

## Internal Flow

```
task description
        │
        ▼
search local skills ──► match found? ──YES──► suggest existing skill
        │
       NO
        │
        ▼
search marketplace (npx skills search)
        │
        ▼
evaluate candidates ──► score + rank
        │
        ▼
present to user with recommendation
        │
        ▼
user approves? ──YES──► install (npx skills add)
        │                       │
       NO                       ▼
        │               verify installation
        ▼                       │
offer alternatives:             ▼
  - refine search          skill ready
  - create via skill-creator
```

### Step-by-Step

1. **Local scan**: Search installed skills by name, description, and tags. If a match exists, suggest it with usage example. No external search needed.
2. **Marketplace search**: Query skills.sh marketplace via `npx skills search "{query}"`. Also check npm registry and GitHub for skill packages.
3. **Evaluate**: Score each candidate on five criteria (see Evaluation Criteria below). Rank and filter.
4. **Present**: Show user a ranked list with recommendation. Include install count, last update, and one-line description for each.
5. **Install**: On user approval only, run `npx skills add {package}`. Verify the skill loads correctly.
6. **Fallback**: If no suitable skill exists, offer to create a custom one via skill-creator template.

## Search Sources

| Source | How | Priority |
|--------|-----|----------|
| Local installed | Scan `skills/` directory | 1st (always check first) |
| skills.sh marketplace | `npx skills search` (89K+ skills) | 2nd |
| npm registry | `npm search --json` with skill keywords | 3rd |
| GitHub | `gh search repos` with topic filter | 4th |

## Evaluation Criteria

Each candidate is scored on a 1-5 scale across five dimensions:

| Criterion | Weight | What to Check |
|-----------|--------|---------------|
| **Relevance** | 30% | Does the description match the task need? |
| **Popularity** | 20% | Install count and star rating |
| **Recency** | 20% | Last update date. Penalize > 6 months stale. |
| **Dependencies** | 15% | Fewer is better. Heavy deps are a risk. |
| **Source trust** | 15% | Known publisher, verified badge, active maintainer |

### Score Thresholds

- **4.0+**: Strong recommendation. Present as top pick.
- **3.0-3.9**: Viable option. Present with caveats.
- **Below 3.0**: Do not recommend. Mention only if nothing better exists.

## Safety Protocol

These rules are non-negotiable.

- **Never auto-install.** Always present candidates and wait for explicit user approval.
- **Verify package source.** Check publisher, repository link, and download count before recommending.
- **Pin versions.** Install with exact version, not `latest` or floating range.
- **Audit dependencies.** Flag packages with > 20 transitive dependencies.
- **Sandbox first.** New skills are loaded in restricted mode until user confirms they work.

## Output

```
## Skill Hunt Results: "{query}"

### Recommended
1. **skill-name** (v1.2.3) - "Short description"
   - Installs: 12.4K | Stars: 89 | Updated: 2026-02-15
   - Score: 4.2/5 (relevance: 5, popularity: 4, recency: 4, deps: 3, trust: 5)
   - Install: `npx skills add skill-name@1.2.3`

### Alternatives
2. **other-skill** (v0.8.1) - "Description"
   - Score: 3.5/5 | Caveat: last updated 4 months ago

### Not Found?
No perfect match? I can create a custom skill using the skill-creator template.
```

## Gotchas

These failure modes are common. The skill design explicitly counters each one.

| Failure Mode | Mitigation |
|-------------|------------|
| Fabricates skill names | Every recommendation must come from actual search results. No invented package names. Verify with `npx skills info`. |
| Recommends outdated packages | Check last-update date. Flag anything > 6 months old. Penalize in scoring. |
| Installs too eagerly | Never auto-install. Present options, wait for user "yes". No exceptions. |
| Search terms too generic | If initial search returns > 20 results, auto-refine with domain-specific keywords. Ask user for clarification if still too broad. |
| Installed skill does not work | Post-install verification: load skill and run a dry-run. Report failure immediately. |

## Patterns Absorbed

- **skills.sh marketplace**: Structured skill discovery across 89K+ packages with metadata
- **Thariq "skill search skill"**: Meta-pattern of a skill whose purpose is finding other skills
- **LobeHub task-based search UX**: Present results grouped by task relevance, not alphabetically

## Subagent Dispatch

```yaml
searcher:
  model: haiku
  tools: [Bash, WebSearch]
  constraint: "actual search results only, no fabricated names"

evaluator:
  model: sonnet
  tools: [Read]
  constraint: "score all 5 criteria, apply weights, rank by composite score"
```

## Integration

- Called when any `/scc:*` skill cannot handle a request
- Called by `/scc:pipeline` when a step references an unknown skill
- Installed skills become available to all other skills immediately
