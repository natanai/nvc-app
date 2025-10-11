# NeedShare Explorer

A retro-styled companion to [needshare.net](https://needshare.net/) that mirrors the Strategy Finder hierarchy. The site now uses classic multi-page navigation: a home page with category cards, hub pages for situations, feelings, and needs, and individual item pages that cross-link related entries or list strategies.

## Getting started

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

## Additional resources

- [Alexithymia Support Lane Review](docs/alexithymia-support-recommendations.md): Summary of hands-on findings and evidence-backed recommendations to enhance the Alexithymia Support lane and Inventory experience.
