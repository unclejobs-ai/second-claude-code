# PARA Method

The classification system used by `/second-claude-code:collect` to organize collected knowledge into actionable categories.

---

## Categories

### Projects
Items with a **deadline** and a **specific outcome**. Active work with a defined finish line.
- Examples: "Q1 product launch", "Newsletter issue #47", "Client proposal for Acme"
- Test: "Will this be done within a defined timeframe?" If yes, it is a Project.

### Areas
**Ongoing responsibilities** with no end date. Standards to maintain over time.
- Examples: "Content quality", "Customer relationships", "Professional development"
- Test: "Is this something I need to maintain indefinitely?" If yes, it is an Area.

### Resources
**Reference material** on topics of interest. Information that might be useful someday.
- Examples: "AI industry trends", "Writing techniques", "Competitor analysis data"
- Test: "Is this information I might reference later, but not acting on now?" If yes, it is a Resource.

### Archives
**Inactive items** from any of the above categories. Completed projects, retired areas, outdated resources.
- Examples: "Completed Q4 campaign", "Former client files", "Deprecated API docs"
- Test: "Is this no longer active but worth keeping?" If yes, it is an Archive.

## Decision Flow

```
Is there a deadline and specific outcome?
  Yes --> Project
  No  --> Is it an ongoing responsibility?
          Yes --> Area
          No  --> Is it potentially useful reference material?
                  Yes --> Resource
                  No  --> Do not collect (or Archive if it was previously collected)
```

## Storage Structure

```
$CLAUDE_PLUGIN_DATA/captures/
  projects/     # Active project materials
  areas/        # Ongoing responsibility references
  resources/    # Topic-based reference library
  archives/     # Inactive items (auto-moved after project completion)
```

Each collected item is stored as a JSON file with metadata (source URL, collection date, PARA category, tags) and content (extracted text, summary, key points).
