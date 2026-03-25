---
version: 0
synthesized_at: TBD
sessions_used: 0
observations_used: 0
template: developer
previous_version: none
---

# Soul: [User Name or Handle]

> This is a behavioral identity profile for a software developer, synthesized from observed session signals.
> Every dimension is evidence-backed. Contradictions appear as conditional rules, not averages.

---

## Identity

**[Core engineering characterization — the one sentence that captures this developer's philosophy, tech identity, and what distinguishes them from a generic engineer]**

*Why this is specific*: [Brief note on what observation evidence made this non-generic — e.g., stack choices, architecture instincts]

---

## Communication Preferences

**Characterization**: [Specific pattern — e.g., terse in chat, detailed in docs, prefers code over prose]

**Evidence**:
- [obs-id] — [context] — [what happened] — [what it reveals]
- [obs-id] — [context] — [what happened] — [what it reveals]

**Conditional rules**: In [code review]: [behavior X]. In [architecture discussion]: [behavior Y].

**Predictive value**: In a new context, expect [predicted behavior] when [trigger condition].

---

## Expertise

**Primary languages**: [List with proficiency: expert/proficient/familiar]
**Frameworks & tools**: [List with confidence: high/medium/emerging]
**Architecture preferences**: [Patterns favored — e.g., event-driven, monorepo, microservices]

**Evidence**:
- [obs-id] — [context] — [what happened] — [domain confirmed]
- [obs-id] — [context] — [what happened] — [domain confirmed]

**Known gaps**: [Tech areas where the user revealed unfamiliarity]

**Predictive value**: Expect [depth level] when the topic is [domain]. Expect [different depth] for [gap domain].

---

## Decision Style

**Characterization**: [How this developer makes technical trade-offs — specific patterns, not just "pragmatic"]

**Evidence**:
- [obs-id] — [context] — [decision made] — [what the pattern reveals]
- [obs-id] — [context] — [decision made] — [what the pattern reveals]

**Trade-off patterns**:
- Performance vs readability: [observed lean]
- Abstraction vs simplicity: [observed lean]
- Speed-to-ship vs correctness: [observed lean]

**Predictive value**: When presented with [type of technical choice], expect [decision behavior].

---

## Work Patterns

**Characterization**: [How this developer structures work — planning depth, iteration style]

**Debugging approach**: [Top-down / bottom-up / printf / debugger / read-the-source]
**Code review style**: [Thorough / high-level / nitpicky / logic-focused]
**Testing preferences**: [TDD / test-after / integration-heavy / minimal]

**Evidence**:
- [obs-id] — [context] — [what happened] — [pattern revealed]
- [obs-id] — [context] — [what happened] — [pattern revealed]

**Predictive value**: When the task is [type], expect [work pattern behavior].

---

## Shipping Cadence

**Cadence type**: [daily shipper / burst shipper / steady pacer — derived from active_ratio and streak data]

**Commit profile**: [small-commit iterative / large-batch delivery / mixed — from commit_size_profile]

**Focus pattern**: [serial focus / parallel operator — from project_distribution across retros]

**Work rhythm**: [morning / afternoon / bimodal / late night — from peak_hours]

**Evidence** (from retro observations):
- [retro-id] — [period] — [total commits, streak, active ratio] — [pattern it reveals]
- [retro-id] — [period] — [total commits, streak, active ratio] — [pattern it reveals]

**Trends**: [accelerating / steady / decelerating — from multi-retro comparison, if available]

**Predictive value**: Expect [shipping behavior] during [time context]. Project focus likely on [project] given recent trajectory.

---

## Code Preferences

**Style**: Indentation [tabs/spaces, width]. Naming [camelCase/snake_case]. Organization [colocation/barrel exports/etc].
**Documentation**: [Inline comment philosophy, docstring detail, README expectations]
**PR style**: [Terse / detailed / structured template]. **Comment style**: [Rare / liberal / TODO-heavy / why-not-what]

**Evidence**: [obs-id] — [context] — [preference revealed]

**Predictive value**: When generating code, expect [specific style patterns].

---

## Tone Rules

**Active tone rules** derived from observed corrections and preferences:

| Rule | Trigger | Source |
|------|---------|--------|
| [e.g., "no verbose explanations for simple code changes"] | [When this applies] | [obs-id] |
| [e.g., "use code blocks, not prose, to show solutions"] | [When this applies] | [obs-id] |

**Register mapping**: Code review [register]. Architecture [register]. Debugging [register].

---

## Anti-Patterns

Behaviors, outputs, and coding patterns this developer has explicitly rejected:

| Anti-Pattern | Context | Evidence |
|-------------|---------|----------|
| [e.g., "over-abstraction before need"] | [When rejected] | [obs-id] |
| [e.g., "comments restating the code"] | [When rejected] | [obs-id] |
| [e.g., "premature optimization"] | [When rejected] | [obs-id] |

---

## Observation Log Stats

- Total observations: [N]
- Sessions covered: [N]
- Date range: [oldest] to [newest]
- Last synthesis: [date]
- Dimensions with strong evidence (3+ obs): [list]
- Dimensions with emerging evidence (2 obs): [list]
- Dimensions dropped (< 2 obs): [list]
