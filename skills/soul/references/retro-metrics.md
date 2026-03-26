# Retro Metrics Specification

Defines what shipping metrics to collect from git history and how to present them.

## Data Collection

### Git Commands

For each project directory:

```bash
# Commits in period with timestamps and stats
git -C {project_path} log --since="{period_start}" --until="{period_end}" \
  --format="%H|%ai|%s" --shortstat --no-merges

# Unique active days
git -C {project_path} log --since="{period_start}" --until="{period_end}" \
  --format="%ad" --date=short --no-merges | sort -u
```

### Period Ranges

| Flag | Range |
|------|-------|
| `week` | last 7 days (default) |
| `month` | last 30 days |
| `quarter` | last 90 days |

### Project Auto-Detection

When `--projects` is not set:

1. Get the parent directory of the current working directory
2. List all sibling directories containing `.git/`
3. Filter: only include directories with at least 1 commit in the period
4. Sort by commit count descending

## Computed Metrics

### Per-Project

| Metric | Computation |
|--------|-------------|
| `commits` | Count of non-merge commits in period |
| `net_lines` | Lines added minus lines removed |
| `files_changed` | Unique files modified |
| `top_files` | 3 most frequently changed files |
| `avg_commit_size` | `net_lines / commits` — categorize as small (<50), medium (50-200), large (>200) |

### Aggregate

| Metric | Computation |
|--------|-------------|
| `total_commits` | Sum across all projects |
| `shipping_streak` | Consecutive calendar days with 1+ commit in ANY project. Count backwards from today until a gap day. |
| `active_days` | Days in period with at least 1 commit |
| `active_ratio` | `active_days / period_days` — percentage |
| `peak_hours` | Top 3 hours (0-23) by commit count across all projects |
| `project_distribution` | Percentage of commits per project |
| `commit_size_profile` | Distribution: N% small, N% medium, N% large |

### Trend Detection (requires 2+ retro entries)

Compare current period against the previous retro entry in `observations.jsonl`:

| Trend | Condition | Label |
|-------|-----------|-------|
| Acceleration | `current_commits > prev_commits * 1.2` | accelerating |
| Steady | `0.8 * prev <= current <= 1.2 * prev` | steady |
| Deceleration | `current_commits < prev_commits * 0.8` | decelerating |
| Focus shift | Top project changed | `shifted: {old} → {new}` |
| Streak growth | `current_streak > prev_streak` | `streak +{N} days` |

## Output Format

```
## Shipping Retro — {period_start} to {period_end}

### Summary
- Total commits: {N} ({trend_label} vs previous)
- Shipping streak: {N} consecutive days
- Active days: {N}/{period_days} ({active_ratio}%)
- Peak hours: {h1}:00, {h2}:00, {h3}:00

### By Project
| Project | Commits | Net Lines | Avg Size | Top Files |
|---------|---------|-----------|----------|-----------|
| {name}  | {n}     | +{a}/-{r} | {size}   | {files}   |

### Commit Size Profile
- Small (<50 lines): {n}% ({count})
- Medium (50-200): {n}% ({count})
- Large (>200): {n}% ({count})

### Trends
{trend_notes — only shown when previous retro data exists}
```

## Integration with Soul Synthesis

When soul-keeper processes `shipping` observations for the "Work Patterns" and "Shipping Cadence" dimensions:

1. **Cadence characterization**: Use streak and active_ratio to characterize — e.g., "daily shipper" (>80% active), "burst shipper" (<50% active but high commit volume), "steady pacer" (60-80% active, consistent commit counts)
2. **Scope behavior**: Use commit_size_profile — e.g., "small-commit iterative" vs "large-batch delivery"
3. **Focus patterns**: Use project_distribution over multiple retros — e.g., "serial focus" (80%+ on one project) vs "parallel operator" (no project >50%)
4. **Time patterns**: Use peak_hours to characterize work rhythm — e.g., "afternoon focused", "bimodal (morning + late night)"

These characterizations feed into Work Patterns with shipping data as quantitative evidence — not replacing behavioral observation, but grounding it.
