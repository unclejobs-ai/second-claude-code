# Discover: Evaluation, Scoring & Decision Framework

## Candidate Inspection

For the **top 3 candidates** after initial scoring, perform deep inspection before finalizing scores. This step prevents recommending packages based on misleading metadata.

**Inspection workflow**:

1. **Fetch README/SKILL.md**: Use `gh api repos/{owner}/{repo}/contents/README.md` (base64-decode the response) or `gh api repos/{owner}/{repo}/readme` with `Accept: application/vnd.github.raw`. If a `SKILL.md` exists, prefer it over README.
2. **Verify claimed capabilities**: Cross-check the README's feature list against the user's actual need. A repo titled "terraform-security" that only covers formatting is not relevant.
3. **Check dependency footprint**: Look for `package.json`, `requirements.txt`, or similar. Flag if dependencies exceed 10 direct deps or include native modules.
4. **Assess maintenance signals**: Check open issues count, last commit date on default branch (not just last release), and whether the repo responds to issues.
5. **Record inspection notes**: Add a 1-2 sentence "Inspection Note" to each candidate's output block summarizing what was found vs. what metadata claimed.

**If GitHub API is unavailable**: Note "inspection skipped — gh CLI unavailable" and lower the candidate's Source Trust score by 1 point.

## Evaluation Weights

Each criterion is scored on a 1-5 scale. The weighted sum produces a final score (1.0-5.0).

| Criterion | Weight | Scoring Guide |
|-----------|--------|---------------|
| Relevance | 30% | 5 = exact match to need, 3 = partial overlap, 1 = tangential |
| Popularity | 20% | 5 = 1000+ stars or 10k+ weekly downloads, 3 = 100-999, 1 = <50 |
| Recency | 20% | 5 = updated within 30 days, 3 = within 6 months, 1 = >1 year stale |
| Dependencies | 15% | 5 = zero or minimal deps, 3 = moderate (5-15), 1 = heavy or native deps |
| Source trust | 15% | See Trust Tier mapping in SKILL.md |

## Scoring Transparency

Every candidate presented to the user **must** include the full score breakdown table, not just the final number. Format:

```
| Criterion    | Score | Weight | Weighted | Rationale                          |
|--------------|-------|--------|----------|------------------------------------|
| Relevance    | 4     | 30%    | 1.20     | Covers IaC but not security-specific |
| Popularity   | 5     | 20%    | 1.00     | 2,100 stars                        |
| Recency      | 5     | 20%    | 1.00     | Last commit 3 days ago             |
| Dependencies | 4     | 15%    | 0.60     | 3 direct deps, no native modules   |
| Source trust  | 4     | 15%    | 0.60     | Tier 2, verified org author        |
| **Total**    |       |        | **4.40** |                                    |
```

The **Rationale** column is mandatory. It makes the scoring auditable and helps the user understand why a candidate ranked where it did.

## Thresholds and Build vs Install Decision

| Score Range | Action |
|-------------|--------|
| `4.0+` | Strong recommendation — install with confidence |
| `3.0-3.9` | Viable with caveats — list limitations clearly |
| `<3.0` | Do NOT recommend installation |

### Build vs Install Threshold

If **no candidate scores above 3.0**, do not recommend installing a mediocre skill. Instead:

1. State clearly: "No existing skill meets the quality bar for this task."
2. Suggest **building a custom pipeline** using existing local skills (e.g., `pipeline` + `review` + `research` composed together).
3. Provide a concrete skeleton: which local skills to chain, what the pipeline would look like, and estimated effort.
4. Only mention sub-3.0 candidates as "also found but not recommended" with a one-line reason for each.

## Version Pinning

When recommending installation, **always specify a pinned version or commit hash**. Never recommend a bare repo URL.

| Install Method | Pinning Format | Example |
|----------------|----------------|---------|
| `claude install` (GitHub) | `owner/repo@<tag or commit>` | `claude install antonbabenko/terraform-skill@v1.2.0` |
| `npm install` | `package@<exact version>` | `npm install claude-terraform-audit@2.1.0` |
| Manual clone | Specific commit SHA | `git clone ... && git checkout abc1234` |

**How to find the version**:
- Use `gh api repos/{owner}/{repo}/releases/latest` to get the latest release tag.
- If no releases exist, use `gh api repos/{owner}/{repo}/commits?per_page=1` to get the HEAD commit SHA.
- If neither is available, note "no stable release — pin to commit `<sha>`" and lower Recency score by 1.
