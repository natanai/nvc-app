# allneeds.app

A retro Nonviolent Communication explorer that keeps every tool on-device. Build an inventory of strategies to tend to your basic human needs, journal through situations and feelings, and explore hubs for each category with playful magnet interactions. The static site runs entirely in the browser, stores preferences and notes in localStorage with import/export controls, and ships with installable PWA metadata for offline use.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```

1. (Optional) Regenerate the JSON dataset from the source spreadsheets if they change:
   ```bash
   npm run build:data
   ```
   This command parses the CSV exports into `data/index.json`, which the page generator consumes. If any relationship cell points to a title that does not exist in the corresponding spreadsheet, the build stops with an error that calls out both the referenced and parent titles so typos are easy to spot.

2. Build the static pages:
   ```bash
   npm run build:pages
   ```
   The script produces `index.html`, category hubs, and an `index.html` for each item at `situations/<slug>/`, `feelings/<slug>/`, and `needs/<slug>/`.

3. Serve the repository root with any static file server. For example:
   ```bash
   python -m http.server 8000
   ```
   Then open <http://localhost:8000/> in your browser.

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

To reproduce the `release-stable-local` GitHub Actions workflow without pushing a release, run the helper script:

```bash
./scripts/run-release-stable-local.sh
```

The script creates a timestamped ZIP archive under `releases/` that mirrors the artifact the workflow would publish. Pass a
custom directory as the first argument to store the archive elsewhere.

## Project structure

```
├── index.html                 # generated home page
├── feelings/                  # generated feeling hub + individual pages
├── needs/                     # generated need hub + individual pages
├── situations/                # generated situation hub + individual pages
├── styles.css                 # shared retro aesthetic
├── data/
│   ├── Feelings.csv
│   ├── Needs.csv
│   ├── Situations.csv
│   ├── Strategies.csv
│   └── index.json            # generated dataset
└── scripts/
    ├── build-data.mjs        # CSV → JSON converter
    └── build-pages.mjs       # static page generator
```

## Layout highlights

- **Magnet play:** category, situation, and feeling pages present their entries as draggable magnets with a shuffle button for delightful re-arranging.
- **Category hubs:** each hub displays a grid of clickable entries that navigate to item pages with rich descriptions and related magnets.
- **Cross-linking:** situation and feeling pages list their related magnets in labelled panels, while need pages highlight strategies and include the share-a-strategy form.
- **Responsive retro styling:** keeps the playful palette and pixel fonts while threading feelings, needs, situations, and strategies through the same hierarchy.
