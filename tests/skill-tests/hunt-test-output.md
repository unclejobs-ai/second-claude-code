# Hunt Skill Execution Results

**Query**: "terraform 보안 감사할 수 있는 스킬 있어?"
**Date**: 2026-03-20
**Mode**: Full hunt (local scan + external search)

---

## Phase 1: Local Skill Scan

Scanned 7 local skills in `skills/`:

| Skill | Description | Terraform Security Match |
|-------|-------------|--------------------------|
| `review` | Parallel reviewers for content/strategy/code review | No -- general-purpose code review, not IaC-specific |
| `analyze` | Strategic frameworks (SWOT, RICE, OKR, etc.) | No -- business strategy, not infrastructure |
| `research` | Multi-round web research and synthesis | No -- research tool, not security auditing |
| `write` | Content production (newsletters, articles, reports) | No -- content writing |
| `loop` | Iterative review-fix cycles | No -- quality improvement loop, not security |
| `pipeline` | Chain multiple skills into workflows | No -- orchestration, not domain-specific |
| `collect` | PARA knowledge collection | No -- knowledge management |
| `hunt` | Find and install new skills | Meta-skill (self) |

**Local scan result**: No local skill covers terraform security auditing. Proceeding to external search.

---

## Phase 2: External Search

### Search Sources Used

| Source | Status | Results |
|--------|--------|---------|
| Local `skills/` | Completed | 0 matches |
| `npm search` | Completed | No direct claude-terraform-security packages found |
| `gh search repos` | Completed | 5 candidates identified |
| WebSearch (web) | Completed | 6 candidates identified |

### CLI Availability

- `npx`: available (`/opt/homebrew/bin/npx`)
- `npm`: available (`/opt/homebrew/bin/npm`)
- `gh`: available (`/opt/homebrew/bin/gh`)

---

## Phase 3: Candidate Evaluation

### Candidate 1: antonbabenko/terraform-skill

| Criterion | Score (1-5) | Weight | Weighted |
|-----------|-------------|--------|----------|
| Relevance | 5 | 30% | 1.50 |
| Popularity | 5 | 20% | 1.00 |
| Recency | 5 | 20% | 1.00 |
| Dependencies | 4 | 15% | 0.60 |
| Source trust | 5 | 15% | 0.75 |
| **Total** | | | **4.85** |

- **Description**: The Claude Agent Skill for Terraform and OpenTofu -- testing, modules, CI/CD, and production patterns
- **Stars**: 1,350
- **Last updated**: 2026-03-19
- **Author**: Anton Babenko (renowned Terraform community leader, creator of terraform-aws-modules)
- **Source**: [github.com/antonbabenko/terraform-skill](https://github.com/antonbabenko/terraform-skill)
- **Install**: `claude install antonbabenko/terraform-skill`
- **Security audit capability**: Covers Terraform best practices, module validation, and production patterns. Acts as a "senior Terraform architect" persona for Claude. Includes security-relevant guidance for IaC patterns, though it is a broad Terraform skill rather than a pure security-only scanner.
- **Verdict**: STRONG RECOMMENDATION

### Candidate 2: hashicorp/agent-skills

| Criterion | Score (1-5) | Weight | Weighted |
|-----------|-------------|--------|----------|
| Relevance | 4 | 30% | 1.20 |
| Popularity | 4 | 20% | 0.80 |
| Recency | 5 | 20% | 1.00 |
| Dependencies | 4 | 15% | 0.60 |
| Source trust | 5 | 15% | 0.75 |
| **Total** | | | **4.35** |

- **Description**: A collection of Agent skills and Claude Code plugins for HashiCorp products (Terraform, Vault, Consul, Packer)
- **Stars**: 475
- **Last updated**: 2026-03-19
- **Author**: HashiCorp (official -- the creators of Terraform)
- **Source**: [github.com/hashicorp/agent-skills](https://github.com/hashicorp/agent-skills)
- **Install**: `claude install hashicorp/agent-skills`
- **Security audit capability**: Official HashiCorp skills covering Terraform, Vault, Consul. Being from the Terraform creators, it has authoritative knowledge of security best practices. Vault integration is particularly relevant for secrets management auditing.
- **Verdict**: STRONG RECOMMENDATION

### Candidate 3: levnikolaevich/claude-code-skills

| Criterion | Score (1-5) | Weight | Weighted |
|-----------|-------------|--------|----------|
| Relevance | 3 | 30% | 0.90 |
| Popularity | 3 | 20% | 0.60 |
| Recency | 5 | 20% | 1.00 |
| Dependencies | 3 | 15% | 0.45 |
| Source trust | 3 | 15% | 0.45 |
| **Total** | | | **3.40** |

- **Description**: 6-plugin suite covering project bootstrap, documentation, codebase audits (security, quality, architecture, tests), Agile pipeline, performance optimization, GitHub workflows
- **Stars**: 226
- **Last updated**: 2026-03-19
- **Author**: levnikolaevich (community)
- **Source**: [github.com/levnikolaevich/claude-code-skills](https://github.com/levnikolaevich/claude-code-skills)
- **Install**: `claude install levnikolaevich/claude-code-skills`
- **Security audit capability**: Includes a general codebase audit skill that covers security checks, but not Terraform-specific. Useful as a complementary general security audit layer.
- **Verdict**: VIABLE WITH CAVEATS -- general-purpose, not Terraform-specific

### Candidate 4: ahmedasmar/devops-claude-skills

| Criterion | Score (1-5) | Weight | Weighted |
|-----------|-------------|--------|----------|
| Relevance | 4 | 30% | 1.20 |
| Popularity | 2 | 20% | 0.40 |
| Recency | 5 | 20% | 1.00 |
| Dependencies | 3 | 15% | 0.45 |
| Source trust | 3 | 15% | 0.45 |
| **Total** | | | **3.50** |

- **Description**: A Claude Code Skills Marketplace for DevOps workflows, including Terraform IaC with state inspection and module validators
- **Stars**: 102
- **Last updated**: 2026-03-19
- **Author**: ahmedasmar (community)
- **Source**: [github.com/ahmedasmar/devops-claude-skills](https://github.com/ahmedasmar/devops-claude-skills)
- **Install**: `claude install ahmedasmar/devops-claude-skills`
- **Security audit capability**: DevOps-focused with Terraform state inspection tools, module validators, and troubleshooting guides. Covers IaC validation for Terraform, Ansible, Docker, Kubernetes, and CloudFormation.
- **Verdict**: VIABLE WITH CAVEATS -- broader DevOps scope, moderate community size

### Candidate 5: harish-garg/security-scanner-plugin

| Criterion | Score (1-5) | Weight | Weighted |
|-----------|-------------|--------|----------|
| Relevance | 2 | 30% | 0.60 |
| Popularity | 1 | 20% | 0.20 |
| Recency | 4 | 20% | 0.80 |
| Dependencies | 3 | 15% | 0.45 |
| Source trust | 2 | 15% | 0.30 |
| **Total** | | | **2.35** |

- **Description**: Claude Code Plugin for scanning code for vulnerabilities using GitHub's official data
- **Stars**: 6
- **Last updated**: 2026-03-15
- **Author**: harish-garg (individual)
- **Source**: [github.com/harish-garg/security-scanner-plugin](https://github.com/harish-garg/security-scanner-plugin)
- **Install**: `claude install harish-garg/security-scanner-plugin`
- **Security audit capability**: General code vulnerability scanning using GitHub advisory data. Not Terraform-specific.
- **Verdict**: MENTION ONLY -- low popularity, not IaC-focused

### Also Noted (MCP Servers, not Claude Code skills)

- **Datadog Code Security MCP Server**: Supports IaC scanning including Terraform via SAST, secrets detection, and SCA. Not a Claude Code skill/plugin but an MCP server integration.
- **nwiizo/tfmcp**: Terraform MCP tool for managing Terraform environments with security policies and audit logging. Experimental.
- **hashicorp/terraform-mcp-server**: Official HashiCorp Terraform MCP server (npm: `terraform-mcp-server`). Registry operations, not security-focused.

---

## Phase 4: Ranked Recommendations

| Rank | Candidate | Score | Install Command |
|------|-----------|-------|-----------------|
| 1 | `antonbabenko/terraform-skill` | **4.85** | `claude install antonbabenko/terraform-skill` |
| 2 | `hashicorp/agent-skills` | **4.35** | `claude install hashicorp/agent-skills` |
| 3 | `ahmedasmar/devops-claude-skills` | **3.50** | `claude install ahmedasmar/devops-claude-skills` |
| 4 | `levnikolaevich/claude-code-skills` | **3.40** | `claude install levnikolaevich/claude-code-skills` |
| 5 | `harish-garg/security-scanner-plugin` | **2.35** | `claude install harish-garg/security-scanner-plugin` |

### Recommendation

For **Terraform 보안 감사**, the recommended approach is:

1. **Primary**: Install `antonbabenko/terraform-skill` (score 4.85). This is the most popular, most focused, and most authoritative Terraform skill for Claude Code. Created by the community's most prominent Terraform expert. It provides senior-architect-level guidance on Terraform security patterns, module best practices, and production hardening.

2. **Complementary**: Install `hashicorp/agent-skills` (score 4.35). As the official HashiCorp collection, it provides authoritative coverage of Terraform plus Vault (secrets management), Consul, and Packer. The combination of both gives comprehensive IaC security coverage.

3. **Optional enhancement**: If you also want general code vulnerability scanning beyond IaC, consider `levnikolaevich/claude-code-skills` for its codebase audit capability.

**Awaiting explicit approval before installing any packages.**

---

## Hunt Skill Test Results

- Local scan performed: yes
- External search performed: yes
- Candidates found: 5 (plus 3 MCP server mentions)
- Recommendation given: yes
- Install command provided: yes
- Key weakness: npm search did not surface Claude Code-specific terraform security packages directly -- the most relevant results came from WebSearch and GitHub search. The `npx skills search` command referenced in the SKILL.md does not appear to be a real CLI tool yet (no marketplace CLI exists), so that search source was skipped. Also, without actually reading each repo's full contents, the evaluation relies on metadata (stars, description, recency) rather than deep code inspection.
- Key strength: The multi-source search strategy (WebSearch + GitHub + npm) cast a wide net effectively. The scoring rubric from SKILL.md produced clearly differentiated rankings that match intuitive quality ordering. The top two candidates (antonbabenko and hashicorp) are genuinely authoritative, well-maintained, and highly relevant. The safety protocol (no auto-install, approval required) was followed correctly.
- Overall quality: 8
