# Body Scan to Emotion Mapping Review

## Overview of current implementation

The alexithymia support experience converts user-selected body sensations into suggested emotions inside `scripts/alexithymia-support.js`. Each body region enumerates qualitative sensations alongside a fixed weight map of emotions. The final suggestion score multiplies the emotion weight by the user-selected intensity and ranks the totals to present "Body-based matches". 【F:scripts/alexithymia-support.js†L20-L228】【F:scripts/alexithymia-support.js†L1420-L1463】

The same file also contains a static "emotion library" that lists descriptive body signals for each feeling. These entries are surfaced throughout the flow without any inline citations or references. 【F:scripts/alexithymia-support.js†L360-L714】

Outside of the alexithymia support script, the canonical dataset is compiled from CSV spreadsheets via `scripts/build-data.mjs`. The `Body` column in `data/Feelings.csv` feeds each emotion's "bodySignals" list in the generated JSON bundle, again without pointing to empirical sources. 【F:scripts/build-data.mjs†L101-L139】【F:data/Feelings.csv†L1-L16】

## Scientific verification

A repository-wide search found no citations, bibliographies, or links to peer-reviewed research that justify the body sensation/emotion pairings. None of the hard-coded weightings, descriptive "insight" text, or CSV body-signal lists reference validated assessment tools (e.g., PANAS, LEAS), psychophysiological datasets, or clinical guidance. The implementation appears to rely on internally-authored heuristics rather than externally verified mappings.

Because of this, we cannot confirm that the current suggestions meet the user's request for scientific reliability or third-party verification. Delivering that assurance would require sourcing evidence-based correlations between interoceptive cues and discrete emotions, documenting those citations alongside the code, and ideally encoding provenance metadata with each mapping.

## Recommendations

* **Source and cite research** – Identify empirical studies, clinical manuals, or reputable psychoeducational resources that describe bodily correlates for emotions. Incorporate inline citations (e.g., DOI, textbook, or organization publications) wherever the app surfaces those correlations.
* **Track provenance in data** – Extend the data schema so each body sensation entry includes fields such as `source`, `publicationYear`, and `evidenceNotes`. This would let the UI communicate confidence levels or display links for further reading.
* **Expert review** – Before shipping updates, have licensed clinicians or researchers review the mappings and attest to their appropriateness for the intended audience.
* **Ongoing validation** – If observational or user feedback data are available, analyze it to verify whether the suggested feelings align with user-reported emotions, and iterate based on findings.

Until such steps are taken, the body scan conversion logic should be treated as an unverified heuristic rather than a scientifically validated assessment.
