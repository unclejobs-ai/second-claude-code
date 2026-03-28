# Hermes Operator Skillpack

These files are **external operator assets** for Hermes users.

They are not wired into the Second Claude Code runtime. They exist so a Hermes
operator can use this repository's local scripts and conventions without
reinterpreting the repo every time.

## Files

- `acpx-orchestrator-skill.md`: use `acpx` as a multi-agent coding execution layer
- `mmbridge-quality-skill.md`: use `mmbridge` for review, security, gate, and handoff flows

## Boundary

- Hermes stays outside the plugin runtime
- Second Claude Code stays a Claude Code plugin
- These skills only call local scripts or installed CLIs through Hermes terminal/process tools

## Intended Usage

1. Put the relevant skill text into Hermes as a local skill
2. Give Hermes terminal/process access
3. Keep `acpx` and `mmbridge` installed on the host where Hermes runs
4. Run against this repository by pointing Hermes at the repo root
