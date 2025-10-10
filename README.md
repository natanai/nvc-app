# NeedShare Explorer

An interactive single-page app that mirrors the core flows of [needshare.net](https://needshare.net/) using the feelings, needs, situations, and strategy spreadsheets included in this repository. Browse the relationships between feelings and needs, discover linked situations, and save care strategies into a personal plan for quick reference.

## Getting started

1. Generate the JSON dataset from the source spreadsheets (only required if the spreadsheets change):
   ```bash
   node scripts/build-data.mjs
   ```
   The command parses the CSV exports into `data/index.json`, which the web app consumes at runtime.

2. Serve the `public` directory with any static file server. For example:
   ```bash
   python -m http.server 8000
   ```
   Then open <http://localhost:8000/public/> in your browser.

   > Tip: When using another tooling setup (Vite, Parcel, etc.), ensure the `data` directory is available at `../data/index.json` relative to `public/index.html` or update the fetch path inside `public/app.js`.

## Features

- **Dataset explorer:** toggle between feelings, needs, situations, and strategies while searching across titles, descriptions, and linked relationships.
- **Rich relationship view:** click any linked chip to jump across datasets and follow the threads of associated feelings, needs, and contexts.
- **Care plan builder:** add strategies that resonate to a lightweight plan persisted in `localStorage` for easy revisiting.
- **Responsive design:** modern gradient aesthetic with support for light and dark system themes.

## Project structure

```
├── Feelings.csv
├── Needs.csv
├── Situations.csv
├── Strategies.csv
├── data/
│   └── index.json          # generated dataset
├── public/
│   ├── app.js              # front-end logic
│   ├── index.html
│   └── styles.css
└── scripts/
    └── build-data.mjs      # CSV → JSON converter
```

## Making further changes

- Update the CSV files and rerun `node scripts/build-data.mjs` to refresh the JSON data.
- Customize the UI by editing `public/styles.css` or extend functionality within `public/app.js`.
- The JSON structure in `data/index.json` mirrors the CSV relationships and can be reused for other clients.
