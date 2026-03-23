# Decomposition Guide

How to split large tasks into independent parallel units.

---

## Split Strategies

### By Topic

Use when: the overarching subject has natural sub-topics with no overlap.

**Examples**:
- "10-part AI trends series" → split by trend: LLM scaling, agentic systems, multimodal, robotics, ...
- "2026 marketing strategy guide" → split by channel: SEO, paid ads, social, email, influencer, ...

**Rule**: Each topic must be independently researchable. If topic B requires understanding topic A first, merge them or make A a prerequisite (which disqualifies it from batch execution).

### By Section

Use when: a large document has clearly bounded sections that can be written in parallel and stitched together.

**Examples**:
- "Annual report" → Executive Summary, Market Analysis, Financials, Risks, Outlook
- "Comprehensive guide" → Introduction, Core Concepts, Advanced Techniques, Case Studies, References

**Rule**: Sections must not share a narrative arc that requires the writer to know what the previous section concluded. Structure-dependent sections (e.g., Conclusion requires all body sections to exist first) must be produced sequentially, not in batch.

### By Competitor / Company

Use when: a research or analysis task covers N named entities with the same evaluation criteria.

**Examples**:
- "8 SaaS competitor analyses" → one unit per company
- "5 AI startup investment reviews" → one unit per startup

**Rule**: Evaluation criteria must be identical across all units. If each company requires a different analytical lens, batch decomposition will produce inconsistent outputs — use `workflow` instead.

### By Framework

Use when: the same subject is being analyzed through multiple distinct frameworks.

**Examples**:
- "Compare 5 AI governance frameworks" → one unit per framework (OECD, EU AI Act, NIST, Singapore Model AI, IEEE)
- "Compare 3 startup evaluation methods" → one unit per methodology (YC, Sequoia, First Round)

**Rule**: The subject being analyzed must be identical across all units. If different units have different subjects, split by subject (use "By Topic" instead).

### By Time Period

Use when: a recurring output covers distinct time windows.

**Examples**:
- "4 weekly newsletter issues" → one unit per week
- "Quarterly market report Q1-Q4" → one unit per quarter

**Rule**: Each time period must have distinct, non-overlapping source material. If the content for Q2 is largely identical to Q1 (e.g., slow-moving market), flag this to the user before decomposing.

### By Persona / Audience

Use when: the same core content must be adapted for multiple distinct audiences.

**Examples**:
- "Investor / developer / end-user product briefs" → one unit per audience
- "Executive / operator / customer report versions" → one unit per audience

**Rule**: Core facts must be identical across units. If the underlying research differs by audience, this is not a persona split — it is a topic split.

---

## Anti-Patterns

### Units That Depend on Each Other

**Bad**: Unit 2 synthesizes Unit 1's findings.
**Why**: If Unit 1 fails or is delayed, Unit 2 has no input. This is a sequential job, not a parallel one.
**Fix**: Merge into a single unit, or use `workflow` with explicit step chaining.

### Units Too Small to Be Meaningful

**Bad**: Decomposing a 500-word article into 5 × 100-word paragraph units.
**Why**: Agent startup overhead exceeds any parallelism benefit. Output quality degrades when each unit lacks sufficient context.
**Rule**: Each unit should produce at least 300 words of output. Merge smaller units.

### Vague Unit Topics

**Bad**: Unit 1: "AI overview", Unit 2: "More AI stuff", Unit 3: "AI implications"
**Why**: Overlap is unavoidable. Agents will produce redundant or contradictory content.
**Fix**: Ask the user for specific, non-overlapping topic boundaries before decomposing.

### Fake Independence

**Bad**: "Unit 5 doesn't depend on Unit 4 *technically*, but the reader expects them to flow together."
**Why**: If the final reader experience requires cross-unit coherence, the units are not truly independent.
**Fix**: If `--synthesize` is set, the synthesizer must handle coherence. Otherwise, flag to user that post-merge editing will be needed.

### Decomposing Sequential Work

**Bad**: "Write intro, then write body using intro's thesis, then write conclusion using body's main points."
**Why**: This is a sequential pipeline, not a parallel batch.
**Fix**: Route to `workflow` with `autopilot` preset instead.

---

## Merge Strategies

### Concatenate

Use when: units are self-contained documents that should be delivered as a collection.

**Apply to**: newsletter series, competitor profiles, framework analyses.

**Method**: Order units by their assigned ID. Prepend each with its label as a heading. Save to `.captures/batch-{run_id}/merged.md`.

**Synthesizer instruction**: "Join outputs in order. Do not editorialize. Preserve each unit's opening and closing intact."

### Interleave

Use when: units cover the same subject from different angles and the final document should weave them together.

**Apply to**: multi-perspective analyses, pros/cons compilations, audience-variant comparisons.

**Method**: The synthesizer reads all outputs, identifies shared structural sections, and alternates perspectives within each section.

**Synthesizer instruction**: "Identify the shared section structure. For each section, present all unit perspectives consecutively. Highlight agreements and contradictions."

### Summarize

Use when: units are research or data outputs that feed into an executive summary.

**Apply to**: market landscape reports, competitive intelligence packs, benchmark comparisons.

**Method**: The synthesizer reads all outputs and produces a top-level summary with a reference table linking to each unit file.

**Synthesizer instruction**: "Produce a 500-800 word summary covering the most important cross-unit patterns. Include a reference table: unit label, key finding, output path."

---

## Decision Tree

```
Is the task naturally divisible into N similar units?
├── No → use pdca or workflow
└── Yes
    ├── Do any units require another unit's output?
    │   ├── Yes → use workflow (sequential steps)
    │   └── No → batch is appropriate
    │
    ├── Is each unit ≥ 300 words of expected output?
    │   ├── No → merge small units until they are
    │   └── Yes → proceed
    │
    ├── Are unit topics specific and non-overlapping?
    │   ├── No → clarify boundaries with user
    │   └── Yes → proceed
    │
    └── N > 10?
        ├── Yes → cap at 10 or use --units N with explicit user approval
        └── No → proceed to Approve gate
```
