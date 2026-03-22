# Discover Scoring & Inspection Reference

Detailed scoring methodology, candidate inspection workflow, and version pinning rules for the discover skill.

---

## Candidate Inspection

For the **top 3 candidates** after initial scoring, perform deep inspection before finalizing scores.

**Inspection workflow**:

1. **Fetch README/SKILL.md**: Use `gh api repos/{owner}/{repo}/contents/README.md` (base64-decode the response) or `gh api repos/{owner}/{repo}/readme` with `Accept: application/vnd.github.raw`. If a `SKILL.md` exists, prefer it over README.
2. **Verify claimed capabilities**: Cross-check the README's feature list against the user's actual need.
3. **Check dependency footprint**: Look for `package.json`, `requirements.txt`, or similar. Flag if dependencies exceed 10 direct deps or include native modules.
4. **Assess maintenance signals**: Check open issues count, last commit date on default branch, and whether the repo responds to issues.
5. **Record inspection notes**: Add a 1-2 sentence "Inspection Note" to each candidate's output block.

**If GitHub API is unavailable**: Note "inspection skipped -- gh CLI unavailable" and lower Source Trust score by 1.

## Scoring Transparency

Every candidate presented to the user **must** include the full score breakdown table. Format:

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

The **Rationale** column is mandatory. It makes the scoring auditable and helps the user understand the ranking.

## Version Pinning

When recommending installation, **always specify a pinned version or commit hash**.

| Install Method | Pinning Format | Example |
|----------------|----------------|---------|
| `claude install` (GitHub) | `owner/repo@<tag or commit>` | `claude install antonbabenko/terraform-skill@v1.2.0` |
| `npm install` | `package@<exact version>` | `npm install claude-terraform-audit@2.1.0` |
| Manual clone | Specific commit SHA | `git clone ... && git checkout abc1234` |

**How to find the version**:
- Use `gh api repos/{owner}/{repo}/releases/latest` to get the latest release tag.
- If no releases exist, use `gh api repos/{owner}/{repo}/commits?per_page=1` to get the HEAD commit SHA.
- If neither is available, note "no stable release -- pin to commit `<sha>`" and lower Recency score by 1.
