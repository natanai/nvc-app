# Catalog & cue contracts

## Required cue fields
- `cue` must be a slug-like identifier (`^[a-z0-9-]+$`) and unique; validation trims it and rejects duplicates.【F:scripts/validateObservationCues.mjs†L4-L123】【F:scripts/validateObservationCues.mjs†L137-L171】
- `patterns (|)` must include at least one pipe-delimited entry that compiles as a regular expression. Each entry is trimmed before compilation.【F:scripts/validateObservationCues.mjs†L172-L190】【F:lib/observationSuggest.js†L6-L18】【F:lib/observationSuggest.js†L28-L49】
- `feelings (|)` and `needs (|)` columns may be empty individually, but at least one of them must list slugs that resolve to catalog entries. Validation slugifies each token the same way as build-time scripts to ensure they reference the published taxonomy.【F:scripts/validateObservationCues.mjs†L192-L219】
- `example` must survive `sanitizeObservationText`; empty or lint-rejected examples remove the row during sanitization before it ever reaches the browser.【F:scripts/sanitizeObservationCues.mjs†L52-L88】【F:lib/observationSanitize.js†L3-L93】

## Slug generation rules
- Build-time data processing lowercases labels, replaces non-alphanumeric characters with hyphens, and trims leading/trailing hyphens to form canonical slugs; optional `Slug Override` values win when present.【F:scripts/build-data.mjs†L82-L87】【F:scripts/build-data.mjs†L336-L372】
- Needs CSV rows are deduplicated by the resulting slug before export, ensuring every cue reference points to a unique slug entry.【F:scripts/build-data.mjs†L156-L199】【F:scripts/build-data.mjs†L357-L372】
- Faux feeling matchers in the sanitizer reuse slugs (or slugified titles) split on hyphens, so dashed slugs are required for reliable detection.【F:scripts/sanitizeObservationCues.mjs†L229-L246】
- Cue IDs are trimmed in the sanitizer and must already be slugs—validation enforces this, and browser code assumes hyphen-separated IDs when building labels and links.【F:scripts/sanitizeObservationCues.mjs†L78-L88】【F:scripts/validateObservationCues.mjs†L137-L165】【F:assets/js/observations.js†L779-L860】

## Allowed slugs in catalogs today
- **Feelings** – 38 published slugs (e.g., `hurt`, `terrified`, `bewildered`, `sad`, `frightened`, `lonely`, `angry`, `frustrated`, `scared`, `upset`).【F:scripts/build-data.mjs†L336-L351】【7420cc†L1-L21】
- **Needs** – 67 slugs (e.g., `love-caring`, `nurturing`, `connection`, `belonging`, `support`, `consideration`, `need-for-all-living-things-to-flourish`, `inclusion`, `community`, `safety`).【F:scripts/build-data.mjs†L352-L368】【7420cc†L21-L27】
- **Faux feelings** – 55 slugs (e.g., `abandoned`, `abused`, `attacked`, `not-accepted`, `belittled`, `betrayed`, `blamed`, `bullied`, `caged-boxed-in`, `cheated`).【F:scripts/build-data.mjs†L369-L372】【7420cc†L27-L29】

Cue rows must reference these slugs (or values that slugify to them) so the browser can hydrate catalog metadata via the maps built when the page loads.【F:assets/js/observations.js†L779-L860】【F:lib/observationSuggest.js†L11-L23】
