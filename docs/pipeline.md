# Observation cue pipeline

```text
observation_cues.csv row
  ↓ sanitizeObservationCues (scripts)
  ↓ observation_cues.sanitized.csv
  ↓ loadCueRows (lib)
  ↓ sanitizeCues & suggestFromObservation (browser)
  ↓ buildSuggestionLinks → UI chips/panels
```

- **Sanitizing source CSV** – `scripts/sanitizeObservationCues.mjs` reads the raw cue sheet, builds feeling/need/faux-feeling maps from `index.json`, and walks each data row to normalize the example text and trim cue IDs before writing `observation_cues.sanitized.csv`. Rows drop when the example fails sanitation, contains faux feelings, or duplicates an earlier sanitized example.【F:scripts/sanitizeObservationCues.mjs†L14-L118】【F:scripts/sanitizeObservationCues.mjs†L176-L267】
- **Pattern compilation** – `loadCueRows` fetches the sanitized CSV, splits the `patterns (|)` column on literal pipes, trims each entry, and compiles case-insensitive `RegExp` objects (with a fallback that rewrites `.?*` to `.*` if the first compile fails). Feelings and needs columns are also split on pipes and trimmed into slug arrays.【F:lib/observationSuggest.js†L1-L24】【F:lib/observationSuggest.js†L28-L49】
- **Cue label helpers** – `formatCuePhrase` strips anchors and `\b` markers for UI hints, while `formatCueLabel` expands slugs into title case strings. `chooseCuePhrase` favors the shortest unique hint for display.【F:lib/observationSuggest.js†L52-L89】
- **Browser sanitization** – The UI loads `index.json` to build catalog maps, then calls `sanitizeCues` to trim cue IDs, dedupe hint phrases, and drop any feelings/needs not in the catalog before suggestions run.【F:assets/js/observations.js†L779-L860】
- **Matching & aggregation** – `suggestFromObservation` lowercases the search text, evaluates each cue’s regex array, and returns deduped feelings and needs with a `why` list of matching cue IDs. The UI then formats chips/links via `buildSuggestionLinks` and explains matches in the side panel.【F:lib/observationSuggest.js†L91-L97】【F:assets/js/observations.js†L150-L215】【F:assets/js/observations.js†L738-L757】
