# Pattern semantics (current behavior)

- Patterns come from the `patterns (|)` column split on literal `|` characters; no escaping is supported, so a `|` inside the CSV always starts a new pattern entry.【F:lib/observationSuggest.js†L6-L13】
- Each pattern is trimmed and compiled with the case-insensitive flag. If the literal text fails, the sanitizer retries after rewriting any `.?*` sequences to `.*` as a convenience shim.【F:lib/observationSuggest.js†L28-L43】
- No anchors or word boundaries are added automatically. Whatever the CSV supplies—including `^`, `$`, or `\b`—is used verbatim in the `RegExp` constructor; patterns that cannot compile are silently skipped with a console warning.【F:lib/observationSuggest.js†L34-L49】
- UI hint text strips leading `^`, trailing `$`, literal `\b`, and `.*` wildcards for readability only; this does not affect the matcher itself.【F:lib/observationSuggest.js†L52-L62】

## Allowed Regex Subset (current)
✅ `^at \d{1,2}:\d{2} pm` – Anchors, character classes, and quantifiers work because the raw string passes directly to `new RegExp(..., 'i')`.【F:lib/observationSuggest.js†L28-L43】

✅ `he said "[^"]+"` – Quoted classes and escapes survive intact; UI hints will drop the anchors and ellipsize `.*`, but the compiled matcher retains them.【F:lib/observationSuggest.js†L28-L62】

✅ `\bheard\b` – Word boundaries stay in place; the hint removes `\b`, yet the regex still enforces boundaries.【F:lib/observationSuggest.js†L52-L62】

❌ `angry|upset` as a single cell – The splitter interprets this as two patterns (`angry` and `upset`), so alternation inside a single regex is not possible today.【F:lib/observationSuggest.js†L6-L13】

❌ `[` – Invalid expressions throw during compilation; the helper catches the error and drops that pattern from the cue entirely.【F:lib/observationSuggest.js†L34-L49】

If alternation or escaped pipes are required in the future, the CSV parsing strategy would need to change, because the current delimiter logic has no escape mechanism.【F:lib/observationSuggest.js†L6-L13】
