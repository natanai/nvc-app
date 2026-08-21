# allneeds.app
## What the site does

- **Build a strategies inventory:** capture strategies that support each need, organize them by contributor details, and export/import the inventory from the navigation magnet. This mirrors the site metadata that promises an on-device strategy library.
- **Browse core content:** feelings, faux feelings (common misunderstandings), and needs each have hubs and detail pages with cross-linking magnets.
- **Check evidence:** need pages carry claim summaries plus "Supporting Sources" links pulled directly from the data files so readers can verify every statement.
- **Local-first with optional account sync:** inventory, Journal, Customizer state, and magnet layouts work from browser storage. Bluesky/account features are optional and may sync a saved profile or strategies only when the user explicitly uses those features.

## Bedrock architecture

The production-finalization work is intentionally moving allneeds.app toward a simple ownership rule:

> One canonical source → one deterministic compiler/owner → the final production asset.

The final architecture should not depend on a second layer repairing what the first layer generated. In particular:

- deterministic initial HTML/CSS should arrive correct from the parser rather than being repaired after paint;
- persisted theme, navigation, magnet positions, account state, permissions, and other genuinely user-dependent state remain runtime concerns;
- every generated file must have one declared owner, and a generator must be incapable of deleting or rewriting files it does not own;
- a clean `npm run build` must produce zero diff, and running it a second time must also produce zero diff;
- full profile/backup restoration is one storage transaction: localStorage plus required session mirrors must be coherent before the current document rehydrates;
- compatibility wrappers are transitional scaffolding, not the desired final architecture.

### Current Bedrock transition

The branch currently uses safety wrappers while the historical generators are being canonicalized:

- `scripts/build-pages-safe.mjs` runs the legacy page generator in an isolated staging copy and publishes only declared route outputs. This prevents destructive historical generation behavior from touching unrelated routes.
- `scripts/finalize-static-assets.mjs` still contains post-generation HTML corrections. Those corrections are being moved upstream into their owning templates; the finalizer should then be deleted.
- `scripts/build-data-safe.mjs` similarly isolates the historical data compiler and publishes only declared outputs.
- `scripts/finalize-generated-data.mjs` currently normalizes historical Body Cues/source-model inconsistencies. Those rules should ultimately live in the canonical data compiler/source model rather than a second pass.
- `data/reverse-inference.json` is currently treated conservatively as a reviewed production asset because the historical reverse-inference formula does not yet reproduce all of its live semantics. It must not be silently regenerated until that source model is reconciled.

The target is to delete these safety/finalization layers once `build-pages.mjs` and `build-data.mjs` directly own their exact outputs and reproduce the committed production tree deterministically. Bedrock status and protected runtime invariants are documented further in `docs/bedrock-runtime-contract.md`, `docs/bedrock-home-canary.md`, and `docs/bedrock-route-runtime-matrix.md`.

## How information is organised

- Core editable content lives primarily in `data/*.csv` plus the reviewed JSON/template sources described in the fact-checking playbook. Editors should change the canonical source rather than generated output.
- `npm run build:data` currently routes through the ownership-safe data builder; `npm run build:pages` routes through the ownership-safe page builder.
- Generated pages store citation metadata from `_evidence/` so each claim on a need page can be traced back to its source.
- Generated output is committed, but it is not an authoring source. A correct source change should be reproducible from a clean checkout.

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
npm run build:data     # optional if you changed canonical data sources
npm run build:pages    # generate the static pages
python -m http.server  # or any static server
# visit http://localhost:8000/
```

For a full production verification, run `npm run build` from a clean checkout and confirm it leaves no Git diff.

## Development workflow

- **Evidence lint:** `npm run lint:evidence`
- **Entry point lint:** `npm run lint:entrypoints`
- **Link hygiene:** `npm run lint:links`
- **Evidence maintenance:**
  - `npm run extract:citations`
  - edit `_evidence/citations.csv`
  - `npm run replace:needs-sources`
- **Regression/coverage tests:**
  - `npm run test:data-integrity`
  - `npm run test:customizer`
  - `npm run test:home-regressions`
  - `npm run test:nav-magnets`
  - `npm run test:flicker-jitter`
  - `npm run test:obsolete`

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
├── faux-feelings/             # generated situation hub + individual pages
├── inventory/                 # generated Inventory + dedicated Journal
├── feed/                      # Shared Strategies route
├── observations/              # observation tools
├── styles.css                 # shared base styling
├── data/
│   ├── Feelings.csv
│   ├── Needs.csv
│   ├── Faux Feelings.csv
│   ├── Strategies.csv
│   ├── index.json             # generated dataset
│   ├── body-regions.json      # generated Body Cues data
│   └── reverse-inference.json # reviewed production asset pending source-model reconciliation
└── scripts/
    ├── build-data.mjs
    ├── build-data-safe.mjs    # transitional ownership/safety wrapper
    ├── build-pages.mjs
    ├── build-pages-safe.mjs   # transitional ownership/safety wrapper
    ├── finalize-generated-data.mjs # transitional data normalization
    └── finalize-static-assets.mjs  # transitional post-generation UI normalization
```

### Spreadsheet columns

The three primary spreadsheets (`Feelings.csv`, `Needs.csv`, and `Faux Feelings.csv`) own most core relationships used across the site.

- **Feelings.csv** – each feeling row uses `Row Type = feeling` with fields for `Feeling Title`, `Page Summary`, `Related Faux feelings`, `Related Needs`, `Body Signal Notes`, and optional `Slug Override`. Additional rows with `Row Type = cue` capture body cues through the `Cue Region *` and `Cue Option *` columns.
- **Needs.csv** – the need copy is organised into `Need Title`, `Category Label`, `Page Summary`, `Related Strategies`, `Related Faux feelings`, `Related Feelings`, and the claim text pair (`Claim Summary`, `Claim Narrative`). Evidence links live under the `Source Links` column.
- **Faux Feelings.csv** – faux feelings list their relationships via `Related Feelings` and `Related Needs`, with an optional `Slug Override` to customise URLs.
- **Strategies.csv** – each row keeps the contributor details inline and offers an optional `Slug Override` column alongside `Strategy Summary`, `Supports Needs`, `Contributor Name`, and `Contributor Location` so editors can lock URLs before renaming a strategy.

The data build validates strategy slugs and relationship lookups, failing fast when a row references an unknown related item or when two strategies share the same slug. Run `npm run build:data` after editing canonical data sources, then `npm run build:pages` when generated HTML depends on those changes.

## Layout highlights

- **Magnet play:** category, situation, and feeling pages present their entries as draggable magnets with a shuffle button for delightful re-arranging.
- **Category hubs:** each hub displays a grid of clickable entries that navigate to item pages with rich descriptions and related magnets.
- **Cross-linking:** situation and feeling pages list their related magnets in labelled panels, while need pages highlight strategies and include the share-a-strategy form.
- **Responsive retro styling:** keeps the playful palette while threading feelings, needs, faux feelings, strategies, Body Cues, Journal, and observation tools through the same hierarchy.

## Interaction safeguards

- **Strategy deck controls:** keep pointer-driven swipe handlers from intercepting clicks on interactive elements like the "Save to inventory" buttons inside strategy cards, especially on desktop, so inventory actions remain reliable when updating the deck behavior in `scripts/inventory.js`.
- **Restore ownership:** full profile/backup restore must synchronize required storage mirrors before rehydrating the current document and must protect restored magnet state from the running persistence engine.
- **Route runtime ownership:** Home and Shared Strategies currently prove the lazy-controller model; Inventory, Need detail pages, and the dedicated Journal remain eager until their visible first-load responsibilities are explicitly separated.
