# New Feeling Intake Form

Complete this form whenever you want to introduce a new feeling word. Each field maps to the data and pages generated from `data/Feelings.csv`, `data/poems_formatted.txt`, and the alexithymia support scripts so the feeling can appear across the site.

## 1. Basic metadata
- **Feeling title**  _(How it should appear in headings and navigation.)_
- **Slug**  _(Optional. Leave blank to auto-generate from the title; supply only if the slug must differ.)_
- **One-sentence summary**  _(Used on the feeling page and in the dataset.)_

## 2. Body signals copy
List the body sensations that describe how this feeling shows up. Separate each entry with a semicolon if you want them to stay together as one paragraph, or use separate lines for distinct bullets.

```
- Sensation 1
- Sensation 2
- Sensation 3
```

## 3. Related situations
Identify the situations that should link to this feeling. Use existing situation titles where possible; note any new situations that must be created.

| Situation title | Existing page slug? | Notes |
| --- | --- | --- |
|  |  |  |
|  |  |  |

## 4. Related needs
List the needs that should appear on the feeling page. Use existing need titles, and flag any new needs to author.

| Need title | Existing page slug? | Notes |
| --- | --- | --- |
|  |  |  |
|  |  |  |

## 5. Poem reflection
Provide the poem excerpt and source link that will appear in the “Poem reflection” section.

- **Poem excerpt**  _(Paste exactly as it should render, including line breaks and attribution.)_
- **Poem URL**  _(Link to continue reading.)_
- **Poem title / poet**  _(For internal tracking if not obvious from the excerpt.)_

## 6. Alexithymia support mapping
Choose the canonical emotion this feeling should map to for body-cue inference and regulation guidance. This controls how the site links the feeling to evidence, breathing suggestions, and quadrant guidance.

- **Canonical emotion key**  _(e.g., `sadness`, `anxiety`, `anger`.)_
- **Does this word need a new canonical entry?**  _(If yes, outline the definition, body signals, contexts, needs, regulation tips, and communication prompt for the new entry.)_
- **Slug aliases**  _(List any additional slugs or spelling variants that should resolve to this feeling.)_

## 7. Cross-link updates
List every existing page that should start referencing this feeling so the CSV sources can be updated in the next edit pass.

| File or dataset | Column / section | Required change |
| --- | --- | --- |
| `Needs.csv` | `Related Feelings` for … | Add “Feeling Title” |
| `Situations.csv` | `Related Feelings` for … | Add “Feeling Title” |
|  |  |  |

## 8. QA checklist
- [ ] `data/Feelings.csv` row drafted with all columns filled.
- [ ] `data/poems_formatted.txt` entry prepared with excerpt and URL.
- [ ] Feeling slug added to `FEELING_SLUG_ALIASES` (or confirmed existing mapping) for reverse inference.
- [ ] Related needs and situations updated in their respective CSVs.
- [ ] New canonical emotion requirements documented (if applicable).

Fill out this document and attach it to your change request so the implementation can follow the checklist without missing dependencies.
