# Deep Interview Example Transcript

## Initial idea

> Build an intake pipeline that ingests CSVs, normalizes records, provides a reviewer UI with comments and approvals, and exports audit-ready reports.

## Round 0: topology confirmation

Candidate topology:

1. Ingestion: load CSV input safely.
2. Normalization: map raw rows into canonical records.
3. Review UI: inspect, comment, and approve records.
4. Export: create audit-ready reports.

User confirms all four as active.

## Round 1: weakest target

Target: Ingestion / success criteria.

Question: What must happen when a CSV row is malformed?

Answer: Reject the row, keep processing the file, and show row number plus reason.

Result: ingestion success criteria improve; normalization, review UI, and export remain active.

## Round 2: rotation

Target: Normalization / constraints.

Question: Which fields define duplicate records, and what wins when duplicates conflict?

Answer: `record_id` defines duplicates. The latest `updated_at` wins unless a reviewer has already approved an older version.

## Round 3: rotation

Target: Review UI / goal.

Question: What is the first reviewer action after opening the queue?

Answer: Filter records by validation status, inspect details, comment inline, then approve or reject.

## Round 4: rotation

Target: Export / success criteria.

Question: What makes a report audit-ready?

Answer: It includes accepted rows, rejected rows, reasons, reviewer identity, timestamps, and source file id.

## Crystallized output

The spec lists metadata, clarity breakdown, all four topology components, goal, constraints, non-goals, acceptance criteria, resolved assumptions, technical context, ontology, ontology convergence, and the transcript. Execution remains pending approval.
