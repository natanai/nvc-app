# Pattern Contract

## Current (Baseline)

* Cue patterns are still separated on the literal `|` delimiter. Plain pipes create multiple entries, while `\|` now keeps the pipe inside a single pattern for backward compatibility with existing sheets.【F:lib/observationSuggest.js†L29-L55】
* Each trimmed pattern is compiled with `new RegExp(pattern, 'i')`; no anchors or word boundaries are injected automatically.【F:lib/observationSuggest.js†L83-L114】
* ✅ `no reply` &mdash; matches "no reply" anywhere in the observation text because literals are case-insensitive by default.【F:lib/observationSuggest.js†L83-L114】
* ❌ `cat|dog` (as a single cell) &mdash; still splits into two separate patterns, so alternation requires escaping the pipe or using a group.【F:lib/observationSuggest.js†L29-L55】

## Proposed (Minimal, Safe)

### Delimiter decision

* **Option A (escaped alternation)** — chosen. The loader now treats `\|` as an intra-pattern alternation while preserving `|` as the row delimiter, which required only a small helper change and keeps all legacy CSVs valid.【F:lib/observationSuggest.js†L29-L55】
* Option B (RX: prefix) — rejected because it would force catalog edits for the existing literal-heavy sheet and complicate authoring with two pattern modes.
* Option C (double-pipe delimiter) — rejected due to higher migration cost (rewriting all CSVs or introducing header flags).

### Allowed Regex Subset (current)

These rules are enforced by the pattern preflight and dialect validator before compilation.【F:lib/observationSuggest.js†L58-L121】【F:lib/observationSuggest.js†L132-L250】

* ✅ `release 2.0` — auto-escaped literal; the compiler detects the absence of supported meta characters and escapes punctuation for you.【F:lib/observationSuggest.js†L58-L94】【F:lib/observationSuggest.js†L123-L124】
* ✅ `\bupdate\b` — word boundaries are allowed and compiled directly for exact-word matches.【F:lib/observationSuggest.js†L132-L145】【F:lib/observationSuggest.js†L166-L175】
* ✅ `(?:late|delayed)? reply` — a non-nested optional group with small alternation stays valid and keeps literal spaces outside the group.【F:lib/observationSuggest.js†L152-L210】
* ✅ `(?:20|twenty)` — bounded number alternation inside a non-capturing group is permitted.【F:lib/observationSuggest.js†L152-L210】
* ✅ `hey[’']s` — limited character classes containing only typographic apostrophes remain available.【F:lib/observationSuggest.js†L177-L188】
* ✅ `^quote$` — anchors can be supplied explicitly when needed.【F:lib/observationSuggest.js†L132-L145】
* ❌ `(?<=secret) note` — lookbehind is rejected before compilation.【F:lib/observationSuggest.js†L152-L170】
* ❌ `(name)` — capturing groups are blocked; only `(?:…)` is accepted.【F:lib/observationSuggest.js†L190-L198】
* ❌ `foo.+bar` — unescaped dots that are not part of `.*` are disallowed to avoid overly broad matches.【F:lib/observationSuggest.js†L228-L236】
* ❌ `need\1` — backreferences and numeric escapes are filtered out.【F:lib/observationSuggest.js†L152-L170】

### Auto-literal safety

Patterns that do not use any of the supported dialect tokens are escaped automatically, which keeps today’s literal-heavy spreadsheet working while preventing accidental wildcard behaviour.【F:lib/observationSuggest.js†L58-L94】【F:lib/observationSuggest.js†L132-L149】 Compiled expressions carry metadata so downstream tooling can count literal versus explicit regex usage.【F:lib/observationSuggest.js†L96-L114】

### Regression coverage

`scripts/pattern-contract.test.mjs` exercises the contract end-to-end: literal escaping, word boundaries, optional groups, escaped pipes, and invalid lookbehind all behave as expected.【F:scripts/pattern-contract.test.mjs†L1-L75】 The broader validator harness reports literal-versus-regex counts and surfaces any compile failures for the sanitized CSV.【F:scripts/validate-cues-patterns.mjs†L1-L141】

## How to run

```bash
node scripts/pattern-contract.test.mjs
node scripts/validate-cues-patterns.mjs
```

The first script runs the regression checks above, and the second emits a JSON summary (plus a failure CSV if needed) after compiling every sanitized cue with the new contract.【F:scripts/pattern-contract.test.mjs†L1-L75】【F:scripts/validate-cues-patterns.mjs†L1-L141】
