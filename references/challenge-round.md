# Challenge Round Protocol

The adversarial review mechanism used by `/second-claude-code:analyze` to stress-test strategic analyses.

---

## Round 1 (Devil's Advocate)

After the initial analysis, a devil-advocate pass must:
1. Identify the 3 weakest points in the analysis.
2. For each weak point: state the attack, explain why it matters, and propose a concrete fix.
3. Surface blind spots and unstated assumptions.

## Round 2 (Source Audit -- `deep` only)

A second pass specifically attacks sourcing quality:
1. Flag every claim that relies on reputation rather than a cited source.
2. Identify which quadrant has the thinnest evidence and propose specific research to fill it.
3. Check for confirmation bias: are negative findings about competitors sourced as rigorously as positive findings about the subject?

## Preservation Rule

The challenge output MUST be preserved in the final synthesis, not discarded. The balanced output should incorporate the devil's advocate findings and any source audit corrections.
