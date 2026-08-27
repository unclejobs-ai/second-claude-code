# Second Claude Code — Agent Instructions

Claude Code plugin (v3.0.2). PDCA-native knowledge work system — 15 skills, 18 commands, 17 agents, 9 hook events, 31 MCP tools on the pdca-state server (3 MCP servers total: pdca-state, playwright, mmbridge).

## Project Structure

```
.claude-plugin/plugin.json — Plugin manifest (name, version, MCP servers)
skills/                     — 15 skill directories (coach, pdca, research, write, analyze, review, refine, loop, evolve, collect, workflow, discover, batch, soul, translate) plus skills/unblock/ which holds the fetch engine but ships no SKILL.md
agents/                     — 17 agent definitions (.md files, Pokemon-themed)
hooks/                      — 8 hook files across 9 events (session-start, prompt-detect, subagent-start/stop, review-result, session-end, compaction serves PreCompact+PostCompact, stop-failure)
  hooks.json                — Hook registry (SessionStart, UserPromptSubmit, SubagentStart, SubagentStop, PostToolUse, Stop, PreCompact, PostCompact, StopFailure)
mcp/pdca-state-server.mjs   — Maintainer source for the pdca-state MCP server
mcp/pdca-state-server.bundle.mjs — Checked-in runtime artifact executed by the plugin manifest (31 tools)
scripts/build-mcp.mjs       — Maintainer-only bundle and third-party notice generator
mcp/lib/cycle-memory.mjs    — Cycle memory persistence (phase snapshots, insights, metrics, self-evolution)
commands/                   — Slash commands
config/                     — Runtime configuration
references/                 — Integration docs (mmbridge, etc.)
docs/                       — Architecture docs (EN/KO bilingual)
```

## Key Conventions

- **Language**: Skills, hooks, MCP server are JavaScript ESM (.mjs). No TypeScript.
- **Public loop command**: `/scc:loop`
- **Agent naming**: Pokemon-themed (Arceus=orchestrator, Pikachu=soul, Eevee=researcher, etc.)
- **Bilingual docs**: EN (.md) + KO (.ko.md) maintained independently, not translated
- **PDCA phases**: Plan (Eevee+Alakazam) → Do (Smeargle) → Check (Xatu+Absol+Porygon+Jigglypuff+Unown) → Act (Ditto)

## Verification

```bash
# Syntax check all hooks and MCP server
node --check hooks/*.mjs mcp/*.mjs daemon/*.mjs

# Validate plugin manifest
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"

# Verify all agents have required frontmatter
for f in agents/*.md; do head -1 "$f" | grep -q '^---' || echo "MISSING frontmatter: $f"; done

# Verify all skills have SKILL.md — skills/unblock/ is engine-only by design
for d in skills/*/; do [ -f "${d}SKILL.md" ] || [ "$d" = "skills/unblock/" ] || echo "MISSING SKILL.md: $d"; done

# Regenerate and verify checked-in release artifacts
npm run build:mcp
git diff --exit-code -- mcp/pdca-state-server.bundle.mjs THIRD_PARTY_NOTICES.md
```

## Do Not

- Add install-time compilation. Maintainers regenerate the checked-in MCP bundle
  and third-party notices with `npm run build:mcp`; user installs must not build
  or fetch runtime dependencies.
- Modify agent model tiers without checking docs/architecture.md roster table
- Edit hooks.json directly — it's the plugin hook registry, changes affect all users
