# Soul Synthesis Algorithm

This document defines the algorithm soul-keeper (Pikachu, opus) follows when producing or updating SOUL.md.

## Minimum Threshold

Synthesis requires one of:
- **Session-based**: ≥10 distinct sessions in the observation log
- **Volume-based**: ≥30 total observations in the observation log

If neither threshold is met, output a gap report:

```
## Gap Report

Current observation pool: {N} sessions, {M} observations
Required: 10 sessions OR 30 observations
Shortfall: {X} more sessions OR {Y} more observations

Recommendation: Continue in learning mode. Re-run `soul propose` when threshold is met.
Top 3 dimensions with emerging (but unconfirmed) patterns:
- [dimension]: [N] signals, [strongest signal summary]
```

Do not produce a partial SOUL.md when below threshold. A weak soul is worse than no soul.

## Step 1: Signal Grouping

Group all observations by dimension:

| Dimension | Signal Types That Feed It |
|-----------|--------------------------|
| Communication Preferences | Style, Correction (tone/format) |
| Expertise | Expertise signals, Correction (vocabulary/depth) |
| Decision Style | Decision signals |
| Work Patterns | Style (request framing), Decision (speed/quality trade-offs), Shipping (commit cadence, size profile) |
| Shipping Cadence | Shipping signals (retro metrics — cadence type, focus pattern, work rhythm, trends) |
| Emotional Profile | Emotional signals |

Observations may belong to multiple dimensions. Do not force single assignment — duplicate if relevant.

## Step 2: Recency Weighting

Apply 2x weight to observations from the 5 most recent sessions:

```
effective_weight = base_weight × (2 if session_rank <= 5 else 1)
```

`session_rank` is determined by session timestamp, rank 1 = most recent.

This means a 30-observation pool with 15 recent observations has an effective weight of 45 — drift toward recent behavior is expected and correct.

## Step 3: Evidence Threshold Per Dimension

For each dimension:
- Count observations (using effective weight, not raw count)
- **Minimum 2 raw observations** (not weighted) required to claim a dimension
- Dimensions with only 1 observation go to the "insufficient evidence" list

If a dimension has 2+ raw observations but they contradict each other, proceed to Step 4 before discarding.

## Step 4: Contradiction Detection and Resolution

A contradiction exists when two observations in the same dimension suggest opposite behaviors.

**Resolution protocol**:
1. Identify the trigger context for each observation
2. If contexts differ (e.g., "in chat vs. in final documents"), express as conditional rule:
   - Format: `"In [context A], [behavior X]; in [context B], [behavior Y]"`
   - Both observations count as evidence for a single conditional dimension
3. If trigger contexts cannot be distinguished, mark as "unresolved — needs more observations"
4. Never average: "somewhat X" destroys predictive power

**Examples**:

| Observation A | Observation B | Resolution |
|---------------|---------------|------------|
| "User requests very short responses in chat" | "User's final deliverables are 3000+ words" | "Brevity in interactive sessions; thoroughness in artifacts" |
| "User approves first option offered" | "User reverses choices after seeing implementation" | "Fast initial approval, but outcome-driven — expects iteration" |
| "User uses formal register in deliverables" | "User uses casual language in exploratory conversations" | "Register matches artifact type, not relationship" |

## Step 5: Anti-Generic Filter

Before including any dimension in SOUL.md, apply this test:

**Test**: Would this description fit 80% of professionals in the user's apparent field?

**Forbidden patterns**:
- "Values quality and thoroughness"
- "Prefers clear communication"
- "Iterates based on feedback"
- "Detail-oriented and organized"
- "Strategic thinker"

**If the dimension fails the test**: Return to the raw observations and re-derive. Ask: "What specifically distinguishes THIS user's behavior from the norm?" If no distinction can be found from the observations, drop the dimension.

**Pass examples**:
- "Interrupts structured analysis mid-task when a reframing becomes visible — observed 3× abandoning planned output to pursue the new angle"
- "Accepts verbose output only when the artifact IS the deliverable; rejects it during planning/exploration phases"
- "Prefers options presented as a forced choice between 2 distinct approaches, not a spectrum — rarely asks for a middle option"

## Step 6: Drift Detection (updates only)

When an existing SOUL.md is present, compare each dimension:

**Drift score** = semantic similarity between old characterization and proposed characterization, where 0.0 = identical and 1.0 = completely opposite.

| Drift Score | Action |
|-------------|--------|
| < 0.30 | Accept automatically — minor refinement |
| 0.30 – 0.60 | Flag with "DRIFT DETECTED" — show old vs. new — require user acknowledgment |
| > 0.60 | Flag with "SIGNIFICANT DRIFT DETECTED" — block apply until user explicitly approves |

**Drift calculation heuristic** (since we cannot run embeddings):
- Same core claim, different wording → ~0.1
- Opposite claim, same dimension → ~0.8
- New conditional rule added to a previously unconditional claim → ~0.3
- Condition removed from a conditional rule → ~0.4

## Step 7: Output Assembly

Produce SOUL.md using the template at `references/templates/default.md`.

Populate each section:
- State the characterization in the first sentence
- Follow with evidence block (minimum 2 citations per dimension)
- For conditional dimensions, state the rule first, then cite evidence for each branch
- End each dimension with a "Predictive value" note: what would this dimension predict about user behavior in a new context?

## Token Budget

When passing observations to soul-keeper:

1. Last 5 sessions: full verbatim observation entries
2. Sessions 6–20: one-sentence summary per observation, grouped by session
3. Sessions 21+: aggregate paragraph per month, noting dominant signal types only
4. Total observation input to soul-keeper: ≤500 tokens
5. Current SOUL.md: pass in full (it is the baseline for drift detection)

If the log exceeds budget: the analyst runs a compression pass first, producing a structured summary within the token limit. Soul-keeper receives the compressed summary, not the raw log.

## Versioning

Each SOUL.md begins with a metadata block:

```yaml
---
version: N
synthesized_at: ISO-8601
sessions_used: N
observations_used: N
template: default|developer|writer|researcher
previous_version: path/to/archive (if update)
---
```

Increment `version` on every `apply` call. Version 1 = first synthesis.

## Shipping Cadence Synthesis

Shipping observations are quantitative, not behavioral. Apply different rules:

### Evidence Threshold
- Minimum **2 retro entries** to claim a Shipping Cadence dimension (same as behavioral dimensions)
- A single retro entry goes to "insufficient evidence" — the pattern needs repetition to be meaningful

### Characterization Rules
Use the classification from `references/retro-metrics.md` § Integration with Soul Synthesis:
- Cadence type from `active_ratio` and `streak`
- Commit profile from `commit_size_profile`
- Focus pattern from `project_distribution` across retros
- Work rhythm from `peak_hours`

### Anti-Generic Filter for Shipping
These are forbidden because they describe most active developers:
- "Ships code regularly"
- "Active contributor"
- "Works across multiple projects"

Pass examples:
- "Daily shipper with 85%+ active ratio, never gaps more than 1 day — even weekends show commits"
- "Serial focus: 80%+ commits on one project for 2-3 weeks, then hard switch. Rarely parallel."
- "Bimodal rhythm: 2-4 PM burst + 10 PM-midnight second wind. Dead zone 6-9 PM."

### Cross-Referencing with Behavioral Signals
Shipping data grounds behavioral observations:
- If Work Patterns says "prefers small iterative steps" but commit profile shows 60% large commits → flag contradiction, apply conditional rule
- If Decision Style says "fast shipper" but streak is broken with 3-day gaps → refine characterization
- If Expertise shows "primary: project X" but shipping shows 80% commits in project Y → note divergence between expertise depth and current focus
