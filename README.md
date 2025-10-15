# allneeds.app

A retro-styled companion to [allneeds.app](https://allneeds.app/) that mirrors the Strategy Finder hierarchy. The site now uses classic multi-page navigation: a home page with category cards, hub pages for situations, feelings, and needs, and individual item pages that cross-link related entries or list strategies. Build an inventory of strategies to tend to all your basic human needs while every entry, journal note, and preference remains on your device in localStorage with import and export controls.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```

1. (Optional) Regenerate the JSON dataset from the source spreadsheets if they change:
   ```bash
   npm run build:data
   ```
   This command parses the CSV exports into `data/index.json`, which the page generator consumes.

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

- **Run the Playwright smoke tests:**
  ```bash
  npm test
  ```

The tests expect the generated pages to be present. Re-run `npm run build:pages` if you modify the data or templates.

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

- **Magnet play:** category, situation, and feeling pages present their pills as draggable magnets with a shuffle button for delightful re-arranging.
- **Category hubs:** each category displays a grid of clickable entries that navigate to item pages.
- **Cross-linking:** situation and feeling pages list their related items in labelled magnet panels, while need pages highlight strategies and a share-a-strategy form.
- **Responsive retro styling:** keeps the playful palette and pixel fonts from the original magnet explorer while adopting the hierarchical flow of Site A.
