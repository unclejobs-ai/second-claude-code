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

## Installation Paths and Approval Boundary

Discovery is read-only. Do not run an install, marketplace mutation, package
manager command, or `--yes` flag while searching or scoring. Present the
candidate, the exact source and the command below; wait for the user to approve
that specific candidate and scope before executing it. Approval for one
candidate does not approve the others.

Classify a candidate before showing an install command. Do not turn an arbitrary
GitHub URL into a made-up legacy Claude install shortcut: that syntax is not a
Claude Code CLI command.

| Candidate type | Evidence required | Supported install path after approval |
|----------------|-------------------|---------------------------------------|
| Claude marketplace plugin | Marketplace source plus a valid marketplace/plugin manifest; record the marketplace and plugin names | `claude plugin marketplace add <marketplace-source>` (only if not already configured), then `claude plugin install <plugin-name>@<marketplace-name>` |
| Skills ecosystem repository | A `SKILL.md` and a repository accepted by `skills add`; identify the skill and target agent | `npx --yes skills add <owner>/<repo> --skill <skill-name> --agent claude-code` (use `-g` only when the user approved global scope) |
| npm/library dependency | Upstream documentation explicitly says it installs or supplies a skill | Follow that package's documented command; plain `npm install` is not a generic Claude skill installer |
| Unsupported/manual repository | No supported installer or required manifest | Do not invent a command; offer a custom integration or the upstream instructions for approval |

### Reproducibility

Record the inspected commit, release, or marketplace version in the
recommendation notes. The Claude plugin CLI resolves a plugin by
`plugin-name@marketplace-name`, not by a GitHub repository tag suffix. For the
skills ecosystem, `skills add` accepts the repository and optional skill/agent
selectors; report the resolved source revision or lockfile after installation
instead of pretending that an unsupported tag suffix pins the command.

If the source has no identifiable revision, say so and lower the Recency and
Source Trust scores. A version note is evidence for review, not permission to
install.
