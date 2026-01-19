# allneeds.app
## What the site does

- **Build a strategies inventory:** capture strategies that support each need, organize them by contributor details, and export/import the inventory from the navigation magnet. This mirrors the site metadata that promises an on-device strategy library.
- **Browse core content:** feelings, faux feelings (common misunderstandings), and needs each have hubs and detail pages with cross-linking magnets.
- **Check evidence:** need pages carry claim summaries plus "Supporting Sources" links pulled directly from the data files so readers can verify every statement.
- **Stay on-device:** inventories, journal customizations, and magnet layouts persist in the browser; nothing leaves the user’s machine.

## How information is organised

- The authoritative data lives in `data/*.csv` files. Editors update those sheets to add or change content.
- `npm run build:data` converts the CSVs into `data/index.json`, and `npm run build:pages` turns that dataset into static HTML under `index.html`, `feelings/`, `faux feelings/`, `needs/`, and `inventory/`.
- Generated pages store citation metadata from `_evidence/` so each claim on a need page can be traced back to its source.

## Fact-checking the site

- **Spreadsheet-first workflow (GitHub Actions):** trigger the **“Fact-Checking Spreadsheets”** workflow from the Actions tab to download the current `fact-checking/` CSV bundle as an artifact. After editing those sheets, run the **“Apply Fact-Checking Spreadsheets”** workflow to import the folder, rebuild data + pages, and open a pull request with the generated changes—no local Node.js setup required. Both workflows default to the branch that triggered them; use the optional `base-branch` input when you intentionally need to target a different branch.
  - **Web-only checklist:** edit `fact-checking/` files on your branch → run **Fact-Checking Spreadsheets** on the same branch → run **Apply Fact-Checking Spreadsheets** on that branch to push the imports into `_evidence/` and regenerate the site outputs.
- **Local workflow (optional):** run `npm run export:fact-checking` to populate the `fact-checking/` folder with every dataset as spreadsheets (core CSVs, citations, reverse-inference weights, body-region cues, and observation metadata). After editing those sheets, run `npm run import:fact-checking` to write the changes back into the `data/` and `_evidence/` sources.
- **Start with the Fact-Checking Playbook:** see `docs/fact-checking-playbook.md` for a single map of every data file, where each set of numbers or citations lives, and how to rebuild pages after edits.
- **On-page checks:** open any need page and follow the "Supporting Sources" links to the cited material.
- **Link hygiene:** run `npm run lint:links` to verify every URL under `Source Links` in `data/Needs.csv` responds correctly.
- **Citations workflow:** run `npm run extract:citations` to export `_evidence/citations.csv`, review or edit it, then apply changes with `npm run replace:needs-sources` so the need pages and CSV stay in sync.
- **Temporary link suppressions:** if a source is down but valid, add a temporary entry to `scripts/link-suppressions.json` with a brief justification and remove it once the link is stable again.

## Run the site locally (no prior knowledge needed)

```bash
npm install            # install dependencies
npm run build:data     # optional if you changed the CSVs
npm run build:pages    # generate the static pages
python -m http.server  # or any static server
# visit http://localhost:8000/
```

## Development workflow

- **Lint generated scripts:** `npm run lint`
- **Link hygiene:** `npm run lint:links`
- **Evidence maintenance:**
  - `npm run extract:citations`
  - edit `_evidence/citations.csv`
  - `npm run replace:needs-sources`
- **Playwright smoke tests:** `npm test`

Re-run `npm run build:pages` before tests if you updated data or templates. Prefer open-access citations so readers can check the evidence without paywalls.

## Stable local release snapshot

Create a timestamped ZIP without publishing a GitHub release:

```
./scripts/run-release-stable-local.sh
```

The script writes the archive to `releases/` by default. Pass a custom directory as the first argument to store it elsewhere.

## Observation cue module system

Observation feedback is generated from three inputs:

- `data/Needs.csv` — each need with summaries and related feelings.
- `data/observation_need_templates.json` — reusable cue templates per category (slots, suffixes, examples, patterns).
- `data/observation_lexicon.json` — reusable vocabulary with regex patterns or token lists and optional prompt phrases.

Build the library with:

```
npm run build:observation-cues
```

The pipeline writes:

- `data/observation_cue_modules.json` — compiled module definitions for the observation editor.
- `data/observation_cues.csv` — cue list with merged pattern sets and normalized examples.

Always edit the source data (CSV, templates, lexicon) instead of the generated files. After updates, run:

```
node tests/observation-module-integrity.test.mjs
node tests/observation-scenario-coverage.test.mjs
```

The integrity test confirms valid cue references and synchronized outputs; the scenario coverage suite checks that the vocabulary supports diverse observations. Extend the lexicon and templates rather than hard-coding phrases so new scenarios inherit improvements automatically.

## Project structure

```
├── index.html                 # generated home page
├── feelings/                  # generated feeling hub + individual pages
├── needs/                     # generated need hub + individual pages
├── faux feelings/             # generated situation hub + individual pages
├── styles.css                 # shared retro aesthetic
├── data/
│   ├── Feelings.csv
│   ├── Needs.csv
│   ├── Faux Feelings.csv
│   ├── Strategies.csv
│   └── index.json             # generated dataset
└── scripts/
    ├── build-data.mjs         # CSV → JSON converter
    └── build-pages.mjs        # static page generator
```

### Spreadsheet columns

The three primary spreadsheets (`Feelings.csv`, `Needs.csv`, and `Faux Feelings.csv`) own all relationships and reverse-inference cues used across the site.

- **Feelings.csv** – each feeling row uses `Row Type = feeling` with fields for `Feeling Title`, `Page Summary`, `Related Faux feelings`, `Related Needs`, `Body Signal Notes`, and optional `Slug Override`. Additional rows with `Row Type = cue` capture reverse-inference body cues through the `Cue Region *` and `Cue Option *` columns so no extra CSV is needed for body-region data.
- **Needs.csv** – the need copy is organised into `Need Title`, `Category Label`, `Page Summary`, `Related Strategies`, `Related Faux feelings`, `Related Feelings`, and the claim text pair (`Claim Summary`, `Claim Narrative`). Evidence links live under the `Source Links` column.
- **Faux Feelings.csv** – faux feelings list their relationships via `Related Feelings` and `Related Needs`, with an optional `Slug Override` to customise URLs.
- **Strategies.csv** – each row keeps the contributor details inline and offers an optional `Slug Override` column alongside `Strategy Summary`, `Supports Needs`, `Contributor Name`, and `Contributor Location` so editors can lock URLs before renaming a strategy.

The data build validates strategy slugs and every relationship lookup, failing fast when any row references an unknown related item or when two strategies share the same slug. Typos in the spreadsheets cause `npm run build:data` to stop so they can be fixed before publishing.

Run `npm run build:data` after editing any of these spreadsheets to regenerate the JSON dataset and static pages.

## Layout highlights

- **Magnet play:** category, situation, and feeling pages present their entries as draggable magnets with a shuffle button for delightful re-arranging.
- **Category hubs:** each hub displays a grid of clickable entries that navigate to item pages with rich descriptions and related magnets.
- **Cross-linking:** situation and feeling pages list their related magnets in labelled panels, while need pages highlight strategies and include the share-a-strategy form.
- **Responsive retro styling:** keeps the playful palette and pixel fonts while threading feelings, needs, faux feelings, and strategies through the same hierarchy.
