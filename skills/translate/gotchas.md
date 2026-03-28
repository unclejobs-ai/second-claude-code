# Translate Gotchas

## Common failure patterns in translation

### 1. Translating code blocks
**Symptom**: Variable names, function calls, or code comments inside fenced code blocks get translated
**Fix**: Never translate content inside ``` fences or backtick spans. Only translate surrounding prose. If `--style creative`, comments adjacent to code (outside fences) may be translated.

### 2. Inconsistent speech levels
**Symptom**: Translation mixes 존댓말 (formal) and 반말 (casual) within the same document
**Fix**: Lock speech level at the start based on soul tone rules or default (해요체). Verify consistency in the QA step.

### 3. Ignoring glossary mappings
**Symptom**: Technical terms translated differently across paragraphs, or using the wrong term when a glossary mapping exists
**Fix**: Load the glossary before translation begins. Ditto (editor) must cross-check every glossary term in the QA pass.

### 4. Over-localizing in preserve mode
**Symptom**: Document structure is rearranged, headings are merged or split, or table columns are reordered
**Fix**: In `preserve` mode, the document skeleton (headings, lists, tables, code blocks) must remain identical. Only natural-language text within those structures is translated.

### 5. Guessing the target language
**Symptom**: Translator assumes English→Korean when the user wanted Korean→English
**Fix**: Detect source language from the input text. If the prompt doesn't clearly indicate the target, ask before proceeding. Never assume.

### 6. Losing markdown emphasis
**Symptom**: Bold, italic, or strikethrough markers disappear after translation
**Fix**: Treat `**`, `*`, `~~` as structural markers. Wrap the translated text with the same markers in the same positions.

### 7. Translating proper nouns
**Symptom**: Company names, product names, or personal names are incorrectly translated or transliterated
**Fix**: Keep proper nouns as-is unless a glossary entry provides an explicit mapping. Korean proper nouns use Revised Romanization when translating to English.

### 8. Dropping context in creative mode
**Symptom**: Creative translation loses the original meaning by over-adapting idioms or cultural references
**Fix**: Even in `creative` mode, the core meaning must be preserved. Ditto (editor) QA must verify semantic accuracy, not just fluency.

### 9. YAML frontmatter corruption
**Symptom**: YAML keys get translated, breaking the document's metadata
**Fix**: In YAML frontmatter (between `---` delimiters), translate only human-readable string values. Never translate keys, booleans, numbers, or date values.

### 10. URL and link breakage
**Symptom**: URLs inside markdown links get partially translated or corrupted
**Fix**: Preserve `[text](url)` structure. Translate only the `text` portion. The `url` portion must remain byte-identical.
