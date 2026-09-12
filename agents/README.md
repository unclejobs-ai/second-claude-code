# Agent roster

Pokemon filenames are labels for humans. Dispatch uses the frontmatter `name`.

`Agent(subagent_type: "eevee")` fails. `Agent(subagent_type: "researcher")` is the job. Skills must call job names (`researcher`, `writer`, `deep-reviewer`, …), never the file stem.

These 17 files are **Claude Code** subagents (`agents/*.md`). Codex exposes the 16 skills and does not mirror this Agent roster or `/scc:*` slash commands. Grok install is `grok plugin install unclejobs-ai/second-claude-code --trust` (`.grok-plugin/plugin.json` + `walnut.manifest.yaml`). Do not rewrite these agent files to rename them.

As of Claude Code host **2.1.232** (2026-08-14) the runtime may fork them (`subagent_type: "fork"` keeps the parent prefix). SCC does not implement that fork and does not own a Trajectory. Return the envelope the calling skill asked for. Do not dump search logs into the parent. Do not spawn siblings unless the skill says so.

## Roster

| Job (`name`) | File | Model | When |
|---|---|---|---|
| researcher | eevee.md | sonnet | Collect sources. Use unblock when a URL is gated. |
| analyst | alakazam.md | sonnet | Patterns from a brief that already exists. |
| strategist | mewtwo.md | sonnet | Apply one named framework. Cite or drop the claim. |
| writer | smeargle.md | opus | Draft to the length floor. No padding. |
| editor | ditto.md | opus | Apply the top fixes. Do not invent facts. |
| deep-reviewer | xatu.md | opus | Logic and completeness. Read-only. |
| devil-advocate | absol.md | sonnet | Three weak points, or the review is a stamp. |
| fact-checker | porygon.md | sonnet | Claims with URLs. No URL = not verified. |
| tone-guardian | jigglypuff.md | sonnet | Voice against `SOUL.md` and the voice guide. |
| structure-analyst | unown.md | sonnet | Flow, hierarchy, format floor. |
| pipeline-orchestrator | arceus.md | sonnet | Call skills, never Pokemon names. |
| pipeline-step-executor | machamp.md | sonnet | One pipeline step, then stop. |
| skill-searcher | noctowl.md | haiku | Find candidate skills. Do not install. |
| skill-inspector | magnezone.md | sonnet | Read a candidate. Do not trust the README. |
| skill-evaluator | deoxys.md | sonnet | Score a candidate against a rubric. |
| knowledge-connector | abra.md | haiku | Link two notes. Short envelope. |
| soul-keeper | pikachu.md | opus | Update `SOUL.md`. Not a second memory runtime. |

## Isolation

Reviewers run `permissionMode: plan` where the file sets it. They must not edit the artifact.

Zero findings from every reviewer is **false consensus**. The skill that dispatched them must run an adversarial pass or name three weak points. Silence is not a pass.

Length floors live in `skills/pdca/references/do-phase.md`. Writer and Do gate share those numbers.
