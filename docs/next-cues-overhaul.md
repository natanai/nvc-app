# Next‑Gen Cues (Step 1)
This branch introduces a modular cues system. It is not wired to production yet.
- **Lexicons**: small synonym lists (actors, requests, etc.).
- **Families**: cue families with slots and compact, dialect‑safe patterns.
- **Compiler**: builds a single bundle (JSON + CSV) for the UI to consume later.

**Regex Dialect (Step‑1)**
Allowed: `\\b`, `(?: … )`, optional `(?: … )?`, class for apostrophes `[’']`, small alternations `(?:x|y)`, intentional `.*` within a clause.
Forbidden: lookbehind, backrefs, nested groups, nested quantifiers, inline flags.

**Build**
```
node scripts/next/build-cues.mjs
```
Artifacts:
- `data/generated/cues.bundle.json`
- `data/generated/observation_cues.generated.csv`

## How to build & validate (Step 2)
Run the build, validator, and coverage harness in order:
```
node scripts/next/build-cues.mjs
node scripts/next/validate-cues.mjs
node scripts/next/test-coverage.mjs
```

### Validation

> Faux-feelings enforcement applies **only** to FEELINGS slugs in generated cues. Mentions inside patterns or examples (e.g., verbs like “denied”, “rejected”) are allowed and logged as **non-blocking** advisory signals.
