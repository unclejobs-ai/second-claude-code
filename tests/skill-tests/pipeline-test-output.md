# Pipeline Skill Test: `weekly-report`

**Trigger**: "research -> analyze -> write 체인을 weekly-report라는 파이프라인으로 만들어줘"
**Date**: 2026-03-20

---

## Pipeline Definition

Saved to: `templates/weekly-report-pipeline.json`

```json
{
  "name": "weekly-report",
  "description": "Weekly report pipeline: research current topics, analyze with a strategic framework, then write a polished report. Designed for recurring weekly team or leadership reporting.",
  "steps": [
    {
      "skill": "/second-claude-code:research",
      "args": "--depth medium --sources web,news --lang ko",
      "output": "research-brief.md",
      "on_fail": "abort"
    },
    {
      "skill": "/second-claude-code:analyze",
      "args": "--framework swot --with-research --depth standard --lang ko",
      "input_from": "research-brief.md",
      "output": "analysis.md",
      "on_fail": "abort"
    },
    {
      "skill": "/second-claude-code:write",
      "args": "--format report --voice expert --skip-research --lang ko",
      "input_from": "analysis.md",
      "output": "weekly-report.md",
      "on_fail": "retry"
    }
  ]
}
```

---

## Step-by-Step Execution Walkthrough

### Step 1: Research (`/second-claude-code:research`)

| Property | Value |
|----------|-------|
| Skill | `/second-claude-code:research` |
| Args | `--depth medium --sources web,news --lang ko` |
| Input | None (first step) |
| Output | `research-brief.md` |
| On Fail | `abort` (research is foundational; no point continuing without it) |
| Subagents | `researcher` (haiku) -> `analyst` (sonnet) -> optional 2nd researcher -> `writer` (sonnet) |

**What happens**: The research skill executes 5 WebSearch calls with varied query phrasings across web and news sources. A sonnet-level analyst structures findings and identifies gaps. If gaps are critical, a second research round runs 3-5 targeted searches. A writer synthesizes everything into a Research Brief with Executive Summary, Key Findings, Data Points, Gaps, and Sources.

**Output file**: `research-brief.md` -- a structured markdown document following the Research Brief template.

---

### Step 2: Analyze (`/second-claude-code:analyze`)

| Property | Value |
|----------|-------|
| Skill | `/second-claude-code:analyze` |
| Args | `--framework swot --with-research --depth standard --lang ko` |
| Input | `research-brief.md` (from Step 1) |
| Output | `analysis.md` |
| On Fail | `abort` (analysis is required to produce a meaningful report) |
| Subagents | `strategist` (sonnet) -> `devil-advocate` (sonnet) |

**What happens**: The analyze skill loads `skills/analyze/references/frameworks/swot.md` as its framework template. The `strategist` subagent reads the research brief and applies the SWOT framework -- Strengths, Weaknesses, Opportunities, Threats -- with evidence from the research. The `devil-advocate` subagent then attacks the 3 weakest points, surfaces blind spots, and challenges assumptions. Both outputs are synthesized into a balanced analysis with recommended actions.

**Output file**: `analysis.md` -- a SWOT Analysis document with Analysis, Challenge, Balanced Insight, and Recommended Actions sections.

---

### Step 3: Write (`/second-claude-code:write`)

| Property | Value |
|----------|-------|
| Skill | `/second-claude-code:write` |
| Args | `--format report --voice expert --skip-research --lang ko` |
| Input | `analysis.md` (from Step 2) |
| Output | `weekly-report.md` |
| On Fail | `retry` (writing can be retried without losing upstream work) |
| Subagents | `writer` (opus) -> `editor` (opus) |

**What happens**: Research is skipped (`--skip-research`) because Step 1 already handled it. The `writer` subagent drafts a report (minimum 4000 words with numbered recommendations) in expert voice using the analysis as source material. The write skill then internally invokes `/second-claude-code:review` with the `content` preset. The `editor` subagent addresses all Critical and Major issues from the review.

**Output file**: `weekly-report.md` -- a polished Korean-language weekly report in expert voice.

---

## Data Flow Diagram

```
Step 1: research                Step 2: analyze              Step 3: write
+-----------------------+       +---------------------+      +---------------------+
| researcher (haiku)    |       | strategist (sonnet) |      | writer (opus)       |
| -> WebSearch x5       |       | -> Apply SWOT       |      | -> Draft report     |
| analyst (sonnet)      |  -->  | devil-advocate      | -->  | editor (opus)       |
| -> gap analysis       |       | -> Challenge x3     |      | -> Review & polish  |
| writer (sonnet)       |       |                     |      |                     |
| -> synthesize brief   |       |                     |      |                     |
+-----------------------+       +---------------------+      +---------------------+
  output:                         output:                      output:
  research-brief.md               analysis.md                  weekly-report.md
```

All data flows through files. No shared memory between steps.

---

## State Management

When running, the orchestrator writes active state to `${CLAUDE_PLUGIN_DATA}/state/pipeline-active.json`:

```json
// Before Step 1
{"name": "weekly-report", "current_step": 0, "total_steps": 3, "status": "running"}

// After Step 1 completes
{"name": "weekly-report", "current_step": 1, "total_steps": 3, "status": "running"}

// After Step 2 completes
{"name": "weekly-report", "current_step": 2, "total_steps": 3, "status": "running"}

// After Step 3 completes
{"name": "weekly-report", "current_step": 3, "total_steps": 3, "status": "completed"}
```

Run log saved to: `${CLAUDE_PLUGIN_DATA}/pipelines/weekly-report-run.json`

If interrupted mid-run, resuming `/scc:pipeline run "weekly-report"` will detect the active state and continue from `current_step`.

---

## How to Run

```
/scc:pipeline run "weekly-report"
```

Or with a topic argument:

```
/scc:pipeline run "weekly-report" --topic "이번 주 AI 업계 동향"
```

### Other Pipeline Commands

```
/scc:pipeline list          # Show all saved pipelines
/scc:pipeline show "weekly-report"  # Inspect this pipeline's definition
/scc:pipeline delete "weekly-report"  # Remove the pipeline
```

---

## Design Decisions

1. **`on_fail: abort` for Steps 1-2, `retry` for Step 3**: Research and analysis are foundational. If they fail, downstream work is worthless. Writing, however, can be retried without re-running the entire chain since the input files from Steps 1-2 are already saved.

2. **`--skip-research` on the write step**: The research skill already ran as Step 1. Without this flag, the write skill would redundantly invoke research again (per its default workflow).

3. **SWOT as the default framework**: SWOT provides a balanced four-quadrant view suitable for weekly reporting. The user can customize this by editing the pipeline definition to use any supported framework (RICE, OKR, Porter, etc.).

4. **Korean language throughout**: All three steps use `--lang ko` for consistent output language. The research step will include Korean search queries in at least 30% of searches per the research skill's language rules.

5. **No parallel steps**: This is a strictly sequential pipeline. Each step depends on the output of the previous step via `input_from`, so parallelization is not applicable here.

6. **Expert voice for report format**: The write skill's voice guide maps `expert` as the default for reports. This produces authoritative, data-driven prose appropriate for leadership consumption.

---

## Constraints Validation

| Constraint | Status |
|-----------|--------|
| Maximum 10 steps | PASS (3 steps) |
| Every step declares `output` | PASS |
| `input_from` and `output` compatibility | PASS (each `input_from` matches the previous step's `output`) |
| No shared memory assumption | PASS (all data passes through files) |
| Intermediate outputs saved | PASS (each step saves its own output before the next begins) |

---

## Pipeline Skill Test Results
- Pipeline defined: yes
- Steps count: 3
- Steps reference real skills: yes (research, analyze, write -- all have SKILL.md definitions in skills/)
- Saved for reuse: yes (saved to templates/weekly-report-pipeline.json)
- Run command shown: yes (`/scc:pipeline run "weekly-report"`)
- Key weakness: The pipeline definition does not allow runtime parameterization of the topic -- the `args` are static. A real implementation would need a template variable system (e.g., `--topic {{topic}}`) to avoid editing the JSON each time the weekly topic changes. Additionally, the pipeline skill lacks a mechanism to validate that referenced skills actually exist at definition time.
- Key strength: The step chain faithfully follows the SKILL.md execution model -- sequential steps, file-based data passing, state persistence, and per-step failure strategies. The design decisions (skip-research on write, abort vs retry) show awareness of the gotchas documented in pipeline/gotchas.md. The definition format exactly matches the existing autopilot-pipeline.json convention.
- Overall quality: 7
