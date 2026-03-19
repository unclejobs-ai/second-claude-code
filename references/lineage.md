# Lineage

Key sources that shaped second-claude's design and what was absorbed from each.

---

## Tiago Forte -- Second Brain

**Source**: Building a Second Brain (BASB), PARA method, CODE framework
**Absorbed**: The PARA classification system (Projects, Areas, Resources, Archives) drives the `/second-claude-code:capture` skill. The CODE cycle (Capture, Organize, Distill, Express) maps directly to the capture-to-write pipeline.

## Andrej Karpathy -- Autoresearch

**Source**: Automated research agent with iterative loop and keep/discard logic
**Absorbed**: The iterative search-analyze-refine loop in `/second-claude-code:research`. The keep/discard pattern where each round evaluates previous findings and discards weak evidence. The concept that research quality scales with iteration count, not prompt cleverness.

## Ars Contexta -- Knowledge Work Framework

**Source**: 6Rs framework, 3 spaces model, queue-based orchestration
**Absorbed**: Record-Reduce-Recombine patterns power the capture and knowledge synthesis flow. Queue orchestration concepts inform how `/second-claude-code:pipeline` sequences skill invocations. The 3-spaces model (personal, shared, public) guides output destination logic.

## Claude Octopus -- Multi-Agent Review

**Source**: Consensus gate pattern, auto-routing between specialist agents
**Absorbed**: The multi-perspective review system in `/second-claude-code:review` with independent parallel dispatch and 2/3 threshold. Auto-routing concept feeds the hook system that detects user intent and suggests skills.

## Pi / badlogic -- Minimalist Plugin Architecture

**Source**: Claude Code plugin design, zero-dependency philosophy, file-based state
**Absorbed**: The entire architectural foundation. Few-but-deep skill philosophy. Zero external dependencies. All state in JSON files within plugin data directory. The proof that a powerful plugin needs nothing beyond Claude Code's built-in capabilities.

## Tw93 -- Prompt Engineering Handbook

**Source**: 6-layer prompt model, context cost analysis, HANDOFF protocol
**Absorbed**: Context-efficiency principle (descriptions under 15 tokens). The layered prompt structure used in all skill definitions. HANDOFF protocol concepts for inter-skill communication. The insight that prompt cost scales with context size, not task complexity.

## Thariq Shubair / Anthropic -- Skill Design Patterns

**Source**: 9 skill categories, gotchas-first documentation, progressive disclosure
**Absorbed**: The skill file format (YAML frontmatter + markdown body). The requirement for Gotchas tables in every SKILL.md. Progressive disclosure principle: SKILL.md is the quick reference, references/ holds the deep content. The categorization that informed which 8 skills to build.
