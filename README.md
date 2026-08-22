# allneeds.app
## What the site does

- **Build a strategies inventory:** capture strategies that support each need, organize them by contributor details, and export/import the inventory from the navigation magnet. This mirrors the site metadata that promises an on-device strategy library.
- **Browse core content:** feelings, faux feelings (common misunderstandings), and needs each have hubs and detail pages with cross-linking magnets.
- **Check evidence:** need pages carry claim summaries plus "Supporting Sources" links pulled directly from the data files so readers can verify every statement.
- **Local-first with optional account sync:** inventory, Journal, Customizer state, and magnet layouts work from browser storage. Bluesky/account features are optional and may sync a saved profile or strategies only when the user explicitly uses those features.

## Bedrock architecture

The production-finalization work follows one ownership rule:

> One canonical source → one deterministic compiler/owner → the final production asset.

The production architecture should not depend on a second layer repairing what the first layer generated. Deterministic initial HTML/CSS arrives parser-ready; genuinely user-dependent state such as theme, navigation, magnet positions, account state, and permissions remains runtime-owned. Generated files have declared owners, clean builds are reproducible, full restore is transactional, and migration wrappers are not allowed to become permanent architecture.

### Current Bedrock status

Core architecture is now locked behind permanent tests:

- `scripts/build-pages.mjs` directly owns all 180 generated page outputs; former safe-builder/finalizer layers are deleted and repeated generation is byte-stable.
- `scripts/build-data.mjs` directly owns generated core data; canonical Body Cue rows and reviewed reverse-inference overrides are source-authored and validated.
- fact-checking export/import is lossless and CI-enforced.
- deterministic presentation is parser-owned instead of repaired after paint.
- the Need strategy-card deck is route-owned by `scripts/strategy-deck.js`; unrelated eager routes no longer parse it.
- the legacy Inventory `#journal-dashboard` redirect is owned by `scripts/inventory-legacy-journal-redirect.js`, not the shared controller.
- Home and Shared Strategies keep their accepted lazy-controller ownership; routes with immediate controller-owned UI remain eager rather than being bulk-deferred.
- category hubs paint normally and let `scripts/magnets.js` own saved-position restoration and handmade pose. Navigation alone keeps its lightweight saved-layout prepaint path.
- the mobile regression caused by the global JavaScript-readiness magnet gate and fixed root background was repaired at the canonical CSS owner; permanent tests forbid those triggers and the removed compositor workaround.
- shared CSS dependencies are parser-discovered directly rather than hidden behind nested imports. Google Fonts consumers preconnect to both font origins before requesting font CSS, with `tests/font-delivery.test.mjs` enforcing the contract.
- representative first-load JavaScript graphs and large shared assets have explicit regression ceilings.
- a live production-header audit confirmed that Cloudflare serves the public site over HTTP/2 with active compression and static edge caching; no second repository cache/header layer is required for Bedrock.
- the experimental root-scoped service-worker cache canary is retired; `service-worker.js` is a fetch-free retirement shim only. Whole-site warming remains post-Bedrock work.
- `npm run test:obsolete` is now a Bedrock tombstone guard: deleted build wrappers/finalizers must stay deleted, temporary migration scaffolding cannot remain, and the legacy Journal hash cannot drift back into the shared controller.

At this stage, the remaining original Bedrock work is primarily final phone/desktop acceptance and repair of any defect that acceptance actually exposes—not speculative splitting or optimization for its own sake. The completion boundary is documented in `docs/bedrock-acceptance-checklist.md`. Runtime and delivery invariants are documented in `docs/bedrock-runtime-contract.md`, `docs/bedrock-home-canary.md`, `docs/bedrock-route-runtime-matrix.md`, `docs/bedrock-performance-budget.md`, and `docs/bedrock-offline-cache.md`.

## How information is organised

- Core editable content lives primarily in `data/*.csv` plus reviewed JSON/template sources. Editors should change canonical source rather than generated output.
- `data/Feelings.csv` owns Body Cue source rows; `data/reverse-inference-overrides.json` owns only the reviewed exceptions that intentionally differ from formula-derived reverse inference.
- `npm run build:data` invokes the canonical data compiler directly, and `npm run build:pages` invokes the canonical page compiler directly.
- Generated pages store citation metadata from `_evidence/` so each claim on a need page can be traced back to its source.
- Generated output is committed, but it is not an authoring source. A correct source change must be reproducible from a clean checkout.

## Fact-checking the site

- **Spreadsheet-first workflow (GitHub Actions):** trigger the **“Fact-Checking Spreadsheets”** workflow from the Actions tab to download the current `fact-checking/` CSV bundle as an artifact. After editing those sheets, run the **“Apply Fact-Checking Spreadsheets”** workflow to import the folder, rebuild data + pages, and open a pull request with the generated changes—no local Node.js setup required. Both workflows default to the branch that triggered them; use the optional `base-branch` input when you intentionally need to target a different branch.
- **Local workflow (optional):** run `npm run export:fact-checking` to populate the `fact-checking/` folder with the editable source spreadsheets plus generated review snapshots. After editing source sheets, run `npm run import:fact-checking`, then rebuild.
- See `docs/fact-checking-playbook.md` for the full source map and workflow.

## Run the site locally

```bash
npm install
npm run build:data
npm run build:pages
python -m http.server
# visit http://localhost:8000/
```

For a full production verification, run `npm run build` from a clean checkout and confirm it leaves no Git diff.

## Development workflow

- `npm run lint:evidence`
- `npm run lint:entrypoints`
- `npm run lint:links`
- `npm run test:data-integrity`
- `npm run test:customizer`
- `npm run test:home-regressions`
- `npm run test:nav-magnets`
- `npm run test:flicker-jitter`
- `npm run test:performance`
- `npm run test:delivery`
- `npm run test:obsolete`

## Stable local release snapshot

Create a timestamped ZIP without publishing a GitHub release:

```bash
./scripts/run-release-stable-local.sh
```

## Observation cue module system

Observation feedback is generated from `data/Needs.csv`, `data/observation_need_templates.json`, and `data/observation_lexicon.json`. Build it with:

```bash
npm run build:observation-cues
```

Generated observation cue outputs should not be edited directly.

## Project structure

```text
├── index.html
├── service-worker.js
├── feelings/
├── needs/
├── faux-feelings/
├── inventory/
├── feed/
├── observations/
├── styles.css
├── data/
└── scripts/
    ├── build-data.mjs
    ├── build-pages.mjs
    ├── strategy-deck.js
    ├── inventory-legacy-journal-redirect.js
    └── shell-runtime-loader.js
```

## Interaction safeguards

- **Strategy deck controls:** `scripts/strategy-deck.js` preserves the pointer-swipe guard around interactive controls inside strategy cards.
- **Restore ownership:** profile/backup restore synchronizes required storage mirrors before current-document rehydration and protects restored magnet state from the running persistence engine.
- **Route runtime ownership:** Home and Shared Strategies prove the lazy-controller model; Inventory, Need detail pages, and the dedicated Journal remain eager until a clean independent owner actually exists.
- **Offline-cache retirement:** normal browsing does not register a root cache worker during Bedrock acceptance. Full-site warming remains deferred to the post-Bedrock design.
