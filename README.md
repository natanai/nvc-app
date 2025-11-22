# allneeds.app

A retro Nonviolent Communication explorer that keeps every tool on-device. Build an inventory of strategies to tend to your basic human needs, journal through faux feelings and feelings, and explore hubs for each category with playful magnet interactions. The static site runs entirely in the browser, stores preferences and notes in `localStorage` with import/export controls, and ships with installable PWA metadata for offline use.

## What the site offers

- **Interactive magnets:** Feelings, needs, faux feelings, and navigation tiles shuffle around a board that works offline. Preferences for physics, layout, and shuffling stay local to the browser.
- **Evidence-backed needs:** Each need page pairs a concise claim with a short narrative and links to supporting sources so readers can independently verify the text.
- **On-device journaling:** Observation cues, faux feelings prompts, and inventory lists never leave the device unless you explicitly export them.

## How the site is built

1. Editors maintain CSV files under `data/` (`Feelings.csv`, `Needs.csv`, `Faux feelings.csv`, and `Strategies.csv`).
2. `npm run build:data` converts those spreadsheets into `data/index.json` and validates cross-links between rows.
3. `npm run build:pages` reads the dataset and writes a static HTML page for each feeling, need, faux feeling, strategy, and category hub.
4. The generated pages plus `styles.css`, `assets/`, and PWA metadata form a static site that any file server can host.

## Run the site locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. (Optional) Rebuild the dataset if you changed any CSVs:
   ```bash
   npm run build:data
   ```

3. Generate the static pages:
   ```bash
   npm run build:pages
   ```

4. Serve the repository root with any static file server. For example:
   ```bash
   python -m http.server 8000
   ```
   Then open <http://localhost:8000/> in your browser.

## How to fact-check the content

1. Open any need page and scroll to the "Supporting sources" list; every citation comes from the `Source Links` column in `data/Needs.csv`.
2. Run the automated link checker to confirm the URLs are reachable and not blocked by interstitials:
   ```bash
   npm run lint:links
   ```
3. Review `_evidence/citations.csv` (exported via `npm run extract:citations`) to see each cited claim, the exact quotation, and the source URL side by side.
4. If you edit evidence, update `_evidence/citations.csv` and propagate the changes back into the pages and `data/Needs.csv` with:
   ```bash
   npm run replace:needs-sources
   ```
5. Re-run `npm run build:pages` to regenerate the static pages so the on-site text matches the verified sources.

## Development workflow

- **Lint the generated scripts:**
  ```bash
  npm run lint
  ```

- **Check supporting sources:**
  ```bash
  npm run lint:links
  ```
  This script validates every URL listed in `data/Needs.csv` under "Supporting Sources". It performs a HEAD/GET request with a
  timeout, fails the build if a link returns a non-200 response, and flags redirects that land on common CAPTCHA or consent
  interstitials. Prefer citing open-access material whenever possible so readers can verify the evidence without subscription
  barriers.

- **Maintain supporting sources evidence:**
  1. Extract the current citations into `_evidence/citations.csv` for review:
     ```bash
     npm run extract:citations
     ```
  2. After editing `_evidence/citations.csv`, push the updates back into the generated need pages and `data/Needs.csv`:
     ```bash
     npm run replace:needs-sources
     ```
     The replacer also regenerates `_evidence/citations.json` so both evidence exports stay in sync.

- **Run the Playwright smoke tests:**
  ```bash
  npm test
  ```

The tests expect the generated pages to be present. Re-run `npm run build:pages` if you modify the data or templates.

If a legitimate source is temporarily unavailable, update the entry in `data/Needs.csv` with a more reliable citation or add the
URL to `scripts/link-suppressions.json`. Suppressions should be rare, include a justification in the commit message or review,
and be removed once the source is reachable again.

## Stable local release snapshot

Run the helper script to create a timestamped ZIP archive without publishing a GitHub release:

```bash
./scripts/run-release-stable-local.sh
```

The script writes the archive to `releases/` by default. Pass a custom directory as the first argument to store the archive
elsewhere.

## Observation cue module system

All observation feedback now comes from a modular cue library that is generated from three data sources:

- `data/Needs.csv` lists each published need together with a short summary and related feelings.
- `data/observation_need_templates.json` maps need categories to reusable cue templates (slot configuration, cue suffixes, examples, and regex patterns). Updating this file is the primary way to add or tweak cues.
- `data/observation_lexicon.json` collects reusable vocabulary. Each entry defines a regular-expression `pattern` or a `tokens` array (with an optional `threshold`) plus an optional `phrase` hint that appears in the editor. Build scripts normalize the tokens so common inflections ("listened," "listening") map to the same matcher.

`npm run build:observation-cues` first runs `scripts/generateNeedObservationBlueprint.mjs`, which reads the needs CSV and category templates to write an updated `data/observation_module_blueprints.json`. It then executes `scripts/buildObservationCueLibrary.mjs`, which compiles the lexicon and blueprint into sanitized outputs:

```bash
npm run build:observation-cues
```

The build writes:

- `data/observation_cue_modules.json` – the compiled module definitions consumed by the observation editor, and
- `data/observation_cues.csv` – the cue list with merged pattern sets and normalized examples.

**Do not edit any of the generated files directly**—always modify the needs data, templates, or lexicon and rebuild.

After updating the lexicon or blueprint, run the focused tests to confirm coverage and structural integrity:

```bash
node tests/observation-module-integrity.test.mjs
node tests/observation-scenario-coverage.test.mjs
```

The integrity test verifies that every module references valid cues, that every cue uses known lexicon keys, and that the compiled output stays in sync. The scenario coverage suite exercises a curated set of positive and challenging observations to ensure the modular system suggests both feelings and needs for each case. New contributions should extend the lexicon and blueprint (rather than hard-coding phrases in the generated CSVs) so future scenarios automatically inherit the broader vocabulary.

## Project structure

```
├── index.html                 # generated home page
├── feelings/                  # generated feeling hub + individual pages
├── needs/                     # generated need hub + individual pages
├── faux feelings/                # generated situation hub + individual pages
├── styles.css                 # shared retro aesthetic
├── data/
│   ├── Feelings.csv
│   ├── Needs.csv
│   ├── Faux feelings.csv
│   ├── Strategies.csv
│   └── index.json            # generated dataset
└── scripts/
    ├── build-data.mjs        # CSV → JSON converter
    └── build-pages.mjs       # static page generator
```

### Spreadsheet columns

The three primary spreadsheets (`Feelings.csv`, `Needs.csv`, and `Faux feelings.csv`) now
own all of the relationships and reverse-inference cues used across the site.

- **Feelings.csv** – each feeling row uses `Row Type = feeling` with fields for
  `Feeling Title`, `Page Summary`, `Related Faux feelings`, `Related Needs`,
  `Body Signal Notes`, and optional `Slug Override`. Additional rows with
  `Row Type = cue` capture reverse-inference body cues through the
  `Cue Region *` and `Cue Option *` columns so no extra CSV is needed for
  body-region data.
- **Needs.csv** – the need copy is organised into `Need Title`, `Category Label`,
  `Page Summary`, `Related Strategies`, `Related Faux feelings`, `Related Feelings`,
  and the claim text pair (`Claim Summary`, `Claim Narrative`). Evidence links now
  live under the `Source Links` column.
- **Faux feelings.csv** – faux feelings list their relationships via `Related Feelings`
  and `Related Needs`, with an optional `Slug Override` to customise URLs.
- **Strategies.csv** – each row keeps the contributor details inline and now
  offers an optional `Slug Override` column alongside `Strategy Summary`,
  `Supports Needs`, `Contributor Name`, and `Contributor Location` so editors
  can lock URLs before renaming a strategy.

The data build now validates strategy slugs and every relationship lookup,
failing fast when any row references an unknown related item or when two
strategies share the same slug. Typos in the spreadsheets now cause
`npm run build:data` to stop so they can be fixed before publishing.

Run `npm run build:data` after editing any of these spreadsheets to regenerate
the JSON dataset and static pages.

## Layout highlights

- **Magnet play:** category, situation, and feeling pages present their entries as draggable magnets with a shuffle button for delightful re-arranging.
- **Category hubs:** each hub displays a grid of clickable entries that navigate to item pages with rich descriptions and related magnets.
- **Cross-linking:** situation and feeling pages list their related magnets in labelled panels, while need pages highlight strategies and include the share-a-strategy form.
- **Responsive retro styling:** keeps the playful palette and pixel fonts while threading feelings, needs, faux feelings, and strategies through the same hierarchy.
