# Second Claude Code

Claude Code plugin (v1.0.0). PDCA-native knowledge work system — 13 skills, 17 agents, 8 hooks, 24 MCP tools across 3 servers.

## Project Structure

```
.claude-plugin/plugin.json  — Plugin manifest (name, version, MCP servers)
skills/                     — 13 skill directories (pdca, research, write, analyze, review, refine, loop, collect, workflow, discover, batch, soul, translate)
agents/                     — 17 agent definitions (.md files, Pokemon-themed)
hooks/                      — 8 lifecycle hooks (session-start, prompt-detect, subagent-start/stop, session-end, compaction, stop-failure)
  hooks.json                — Hook registry (SessionStart, UserPromptSubmit, SubagentStart, SubagentStop, Stop, PreCompact, PostCompact, StopFailure)
mcp/pdca-state-server.mjs   — MCP server (24 tools: PDCA state, cycle memory, soul, project memory, daemon, session recall)
mcp/lib/cycle-memory.mjs    — Cycle memory persistence (phase snapshots, insights, metrics, self-evolution)
hooks/lib/                  — Shared runtime modules: agent tracker, fact checker, file mutex sync, mmbridge adapter, report generator, soul observer
mcp/lib/                    — Handler modules: pdca, soul, memory, session, daemon, loop, cycle-memory
commands/                   — Slash commands
config/                     — Runtime configuration
references/                 — Integration docs (mmbridge, etc.)
docs/                       — Architecture docs (EN/KO bilingual)
```

## Key Conventions

- **Language**: Skills, hooks, MCP server are JavaScript ESM (.mjs). No TypeScript.
- **Public loop command**: `/second-claude-code:loop`
- **Agent naming**: Pokemon-themed (Arceus=orchestrator, Pikachu=soul, Eevee=researcher, etc.)
- **Bilingual docs**: EN (.md) + KO (.ko.md) maintained independently, not translated
- **PDCA phases**: Plan (Eevee+Alakazam) → Do (Smeargle) → Check (Xatu+Absol+Porygon+Jigglypuff+Unown) → Act (Ditto)
- **Cycle memory**: Phase artifacts and insights persist across sessions in `.data/cycles/`
- **Domain-aware PDCA**: `pdca_start_run` accepts `domain` (code|content|analysis|pipeline) for stage-specific contracts

## Verification

```bash
# Syntax check all hooks and MCP server
node --check hooks/*.mjs hooks/lib/*.mjs mcp/*.mjs mcp/lib/*.mjs

# Validate plugin manifest
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"

# Verify all agents have required frontmatter
for f in agents/*.md; do head -1 "$f" | grep -q '^---' || echo "MISSING frontmatter: $f"; done

# Verify all skills have SKILL.md
for d in skills/*/; do [ -f "${d}SKILL.md" ] || echo "MISSING SKILL.md: $d"; done

# Run full test suite (323 tests; 322 passing, 1 skipped)
npm test
```

## Do Not

- Add TypeScript or build steps — this is a runtime plugin, no compilation
- Modify agent model tiers without checking docs/architecture.md roster table
- Edit hooks.json directly — it's the plugin hook registry, changes affect all users
