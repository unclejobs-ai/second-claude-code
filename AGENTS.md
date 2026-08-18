# Second Claude Code — Agent Instructions

Claude Code plugin (v2.2.0). PDCA control loop for knowledge work — 18 skills, 17 job-labeled agents, 8 hooks, 31 MCP tools on the pdca-state server. Not a second agent OS.

## Project Structure

```
.claude-plugin/plugin.json — Plugin manifest (name, version, MCP servers)
skills/                     — 18 skill directories (deep-interview, pdca, research, write, analyze, review, refine, loop, evolve, collect, workflow, discover, batch, soul, translate, investigate, viewer, unblock)
agents/                     — 17 job-labeled agents (filename may stay Pokemon; dispatch by `name`)
hooks/                      — 8 lifecycle hooks (session-start, prompt-detect, subagent-start/stop, session-end, compaction, stop-failure)
  hooks.json                — Hook registry (SessionStart, UserPromptSubmit, SubagentStart, SubagentStop, Stop, PreCompact, PostCompact, StopFailure)
mcp/pdca-state-server.mjs   — MCP server (31 tools: PDCA state, cycle memory, soul, project memory, daemon, session recall, orchestrator)
mcp/lib/cycle-memory.mjs    — Cycle memory persistence (phase snapshots, insights, metrics, self-evolution)
commands/                   — Slash commands
config/                     — Runtime configuration
references/                 — Integration docs (mmbridge, etc.)
docs/                       — Architecture docs (EN/KO bilingual)
```

## Key Conventions

- **Language**: Skills, hooks, MCP server are JavaScript ESM (.mjs). No TypeScript.
- **Public loop command**: `/scc:loop`
- **Agent naming**: frontmatter `name` is the job (`researcher`, `writer`). Filename may stay Pokemon. Never dispatch by filename.
- **Bilingual docs**: EN (.md) + KO (.ko.md) maintained independently, not translated
- **PDCA phases**: Plan (researcher+analyst) → Do (writer) → Check (reviewers) → Act (editor)
- **Session model**: same-host Claude subagents. No session fork. Envelopes go to files.

## Verification

```bash
# Syntax check all hooks and MCP server
node --check hooks/*.mjs mcp/*.mjs daemon/*.mjs

# Validate plugin manifest
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"

# Verify all agents have required frontmatter
for f in agents/*.md; do head -1 "$f" | grep -q '^---' || echo "MISSING frontmatter: $f"; done

# Verify all skills have SKILL.md
for d in skills/*/; do [ -f "${d}SKILL.md" ] || echo "MISSING SKILL.md: $d"; done
```

## Do Not

- Add TypeScript or build steps — this is a runtime plugin, no compilation
- Modify agent model tiers without checking docs/architecture.md roster table
- Edit hooks.json directly — it's the plugin hook registry, changes affect all users
