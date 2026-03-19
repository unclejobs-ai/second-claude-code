# Hunt Skill Retest Results

**Date**: 2026-03-20
**Previous Score**: 8/10
**Target Score**: 9/10

---

## Changes Applied

### 1. Source Prioritization (addresses: reliance on nonexistent marketplace CLI)

Added a **Source Prioritization** section with explicit search order and trust tiers:
- Priority 1: Local skills (Tier 1, trust score 5)
- Priority 2: GitHub repos with SKILL.md (Tier 2, trust score 4)
- Priority 3: npm packages with claude-code keyword (Tier 3, trust score 3)
- Priority 4: General web search (Tier 4, trust score 2)

Removed the `npx skills search` entry from the source table (nonexistent tool). Added a gotcha to skip nonexistent CLI tools silently instead of listing them as sources.

Trust tier scores are adjustable with clear bump criteria (verified org, scoped package, inspection confirmation).

### 2. Deep Inspection / Candidate Inspection (addresses: reliance on metadata rather than deep code inspection)

Added a dedicated **Candidate Inspection** section. For the top 3 candidates, the workflow now requires:
- Fetching README/SKILL.md via `gh api` with specific command examples
- Verifying claimed capabilities against actual content
- Checking dependency footprint
- Assessing maintenance signals beyond last-release date
- Recording inspection notes in the output

Added a new `inspector` subagent (model: sonnet) dedicated to this step.

### 3. Scoring Transparency (addresses: opaque scoring)

Added a **Scoring Transparency** section requiring every candidate to show:
- Full breakdown table with Score, Weight, Weighted columns
- A mandatory **Rationale** column explaining each score
- Example template provided in the SKILL.md itself

The Evaluation Weights table now includes a **Scoring Guide** column with concrete thresholds (e.g., "5 = 1000+ stars", "3 = 100-999").

### 4. Build vs Install Threshold (addresses: recommending mediocre skills)

Added a **Build vs Install Threshold** subsection under Thresholds:
- If no candidate scores above 3.0, explicitly recommend building a custom pipeline
- Provide a concrete skeleton using local skills
- Sub-3.0 candidates are mentioned as "not recommended" with a reason, not as options

The `<3.0` threshold action changed from "mention only if nothing else exists" to "Do NOT recommend installation."

### 5. Version Pinning (addresses: bare repo URLs in install commands)

Added a **Version Pinning** section with:
- Pinning formats for each install method (claude install, npm, manual clone)
- Concrete examples with version tags and commit SHAs
- Workflow for finding the version via `gh api repos/{owner}/{repo}/releases/latest`
- Fallback to HEAD commit SHA when no releases exist
- Score penalty (Recency -1) when no stable release is available

Added a gotcha: "Never recommend a bare repo URL without a pinned version or commit hash."

---

## Self-Assessment

| Criterion | Before (8/10) | After | Notes |
|-----------|---------------|-------|-------|
| Source prioritization | Flat list, included nonexistent CLI | Strict priority order with trust tiers | Eliminates the `npx skills search` gap |
| Deep inspection | Not present; metadata-only evaluation | Full Candidate Inspection workflow with gh API commands | Directly addresses the primary weakness |
| Scoring transparency | Weights defined but output format not enforced | Mandatory rationale column in breakdown table | Users can audit every score |
| Fallback for poor matches | "mention only" for sub-3.0 | Build vs Install decision with custom pipeline suggestion | Prevents mediocre installs |
| Version pinning | "Pin exact versions" (one-liner, no guidance) | Dedicated section with formats, examples, and fallback strategy | Actionable and concrete |
| Subagent coverage | 2 agents (searcher, evaluator) | 3 agents (searcher, inspector, evaluator) | Inspector handles the new deep inspection step |
| Gotchas | 3 items | 6 items, including nonexistent CLI and bare URL guards | Covers known failure modes from original test |

**Revised Score: 9/10**

**Remaining gap to 10/10**: The skill does not yet address (a) automated security scanning of candidate repos (e.g., running `gh api repos/{owner}/{repo}/secret-scanning/alerts`), (b) caching/deduplication of search results across repeated hunts in the same session, or (c) integration with a hypothetical future marketplace API when one becomes available. These are forward-looking enhancements that do not affect current operational quality.
