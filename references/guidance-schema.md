# Guidance Schema — SKILL.md Authoring Guide

How to write a SKILL.md file for the second-claude plugin.

## Contract

Every SKILL.md must be a standalone instruction set that Claude can follow without external context. The file is injected into the conversation when the skill is invoked.

## Required Sections

### Frontmatter (YAML)

```yaml
---
name: skill-name
description: "Under 15 tokens. Third-person capability statement, not an instruction."
platforms: [macos, linux]  # Optional
required_environment_variables:
  - name: API_KEY
    prompt: Service API key
    required_for: enhanced mode
metadata:
  second_codex:
    fallback_for_capabilities: [web]   # Optional
    requires_capabilities: [bash]      # Optional
    supports_background: true          # Optional
---
```

- `name`: kebab-case, matches the directory name.
- `description`: Used by Claude to decide when to invoke the skill. Write it as a trigger-rich capability statement (e.g., "Use when applying strategic frameworks such as SWOT, RICE, OKR"). Do not exceed 15 tokens.
- `platforms`: Optional OS filter. Valid values: `macos`, `linux`, `windows`.
- `required_environment_variables`: Optional secret/setup hints. Use when the skill can still be discovered but needs runtime setup for full functionality.
- `metadata.second_codex.fallback_for_capabilities`: Optional capability-based fallback list. The skill should surface only when those capabilities are missing.
- `metadata.second_codex.requires_capabilities`: Optional hard requirements. The skill should be hidden or treated as unavailable when these capabilities are absent.
- `metadata.second_codex.supports_background`: Optional boolean. Mark `true` when the skill is safe to attach to automation, background runs, or future daemon execution.

### Title and One-Liner

```markdown
# Skill Name

One sentence explaining what the skill produces and when it runs.
```

### When to Use

3-5 bullet points describing trigger conditions. Include both explicit (user says "review this") and implicit (another skill needs a quality gate) triggers.

### Workflow

Numbered steps that Claude follows sequentially. Each step should be:
- Concrete (name the tool, the file, or the subagent)
- Testable (you can verify it happened)
- Bounded (finite, not open-ended)

### Options

Table of flags with values and defaults. Keep to 5 or fewer options.

### Output

Show the expected markdown structure. Claude will match this format.

### Gotchas

3-5 failure modes specific to Claude's behavior. Format:

| Pattern | Mitigation |
|---------|------------|
| What Claude does wrong | What it should do instead |

### Subagents

YAML block listing each subagent with model tier and constraints:

```yaml
agent-name: { model: haiku|sonnet|opus, tools: [...], constraint: "one sentence" }
```

## Optional Sections

- **State**: If the skill persists state across turns, document the file path and JSON schema.
- **Integration**: How this skill calls or is called by other skills.
- **Depth**: If the skill has multiple depth levels (quick/standard/thorough).
- **Metadata Notes**: If you use capability fallbacks or background support, explain the operational tradeoff in one short paragraph.

## Progressive Disclosure

For skills with extensive reference material:
- Keep SKILL.md under 1000 words.
- Put templates, frameworks, and voice guides in `references/` subdirectories.
- SKILL.md references these files by path; Claude loads them on demand.

## Gotchas File

Each skill may have a `gotchas.md` alongside SKILL.md. This file contains extended failure patterns. If both SKILL.md and gotchas.md contain the same pattern, gotchas.md is authoritative.

## Agent Files

Agent definitions live in `agents/` at the plugin root. Each `.md` file defines one agent with YAML frontmatter:

```yaml
---
description: "Role description with example trigger phrases"
model: haiku | sonnet | opus
color: blue | cyan | green | yellow | magenta | red
---
```

The body contains the system prompt: role, process steps, output format, and rules.

## Model Tier Guidelines

| Tier | Model | Use For |
|------|-------|---------|
| Fast | haiku | Search, extraction, fact-checking, lightweight classification |
| Standard | sonnet | Analysis, synthesis, code generation, orchestration |
| Quality | opus | Editorial writing, deep review, architectural decisions |

Choose the cheapest tier that meets the quality requirement. Never use opus for tasks haiku can handle.
