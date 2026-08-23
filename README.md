# allneeds.app
## What the site does

- **Build a strategies inventory:** capture strategies that support each need, organize them by contributor details, and export/import the inventory from the navigation magnet. This mirrors the site metadata that promises an on-device strategy library.
- **Browse core content:** feelings, faux feelings (common misunderstandings), and needs each have hubs and detail pages with cross-linking magnets.
- **Check evidence:** need pages carry claim summaries plus "Supporting Sources" links pulled directly from the data files so readers can verify every statement.
- **Local-first with optional account sync:** inventory, Journal, Customizer state, and magnet layouts work from browser storage. Bluesky/account features are optional and may sync a saved profile or strategies only when the user explicitly uses those features.

## Bedrock architecture

allneeds.app uses a simple ownership rule:

> One canonical source → one deterministic compiler/owner → the final production asset.

The architecture must not depend on a second layer repairing what the first layer generated. In particular:

- deterministic initial HTML/CSS should arrive correct from the parser rather than being repaired after paint;
- persisted theme, navigation, magnet positions, account state, permissions, and other genuinely user-dependent state remain runtime concerns;
- every generated file must have one declared owner, and a generator must be incapable of deleting or rewriting files it does not own;
- a clean `npm run build` must produce zero diff, and running it a second time must also produce zero diff;
- full profile/backup restoration is one storage transaction: localStorage plus required session mirrors must be coherent before the current document rehydrates;
- compatibility wrappers are migration scaffolding, not production architecture.

### Root-level UX changes

Bedrock changes how UI work should be made, not just how the current site happens to look. Before changing a rendered screen, trace the element back to the layer that actually owns it, then change that owner.

- **Generated markup:** edit the template/compiler that emits it (normally `scripts/build-pages.mjs`), then rebuild. **Do not edit generated HTML as the source of a UI fix.**
- **Deterministic presentation:** edit the existing component/style owner that should define the final first-paint appearance. Do not append a late corrective override merely to cancel an older rule; consolidate or remove the older rule so one layer remains authoritative.
- **Runtime behavior:** JavaScript should own genuinely stateful behavior such as user choices, persisted data, authentication, drag state, or interaction lifecycle. It should not rewrite deterministic markup or CSS after paint just to make the page look correct.
- **Responsive design:** start from one shared component contract. Use narrow-screen rules for genuine space constraints and wider-screen rules to use available room (for example, additional columns), rather than maintaining separate mobile and desktop versions of the same UI.
- **Regression proof:** preserve accessibility hooks and storage contracts, add or update a focused test for the ownership/UX invariant, run the canonical build, and require zero generated diff on the clean final head.

If you cannot name the canonical markup owner, style owner, and behavior owner for the thing you are changing, trace those first. A screenshot-specific override, generated-file edit, duplicate controller, or post-paint normalizer is not a Bedrock repair.

### Current Bedrock status

As of the 2026-08-23 repository audit, the core page and data authoring pipelines have completed their canonicalization passes and the accepted Bedrock baseline is merged into `inventory-core-overhaul`. The active `performance/immediate-response-v1` branch is a post-Bedrock acceptance canary: its source architecture satisfies the ownership rules below, while production promotion still depends on the live-device checks in the remaining acceptance plan.

The audit also closed four inconsistencies at their canonical owners. Repository-root resolution in the data builder, link checker, and permanent regression tests now uses real filesystem paths, so the direct authoring and proof paths work on Windows as well as CI/Linux. The observation-cue compiler now runs as a script on both platforms, the canonical build verifies its outputs and detector statistics, and 27 fragmented source regexes were restored and regenerated with a zero-invalid-pattern integrity guard. The duplicated Observations navigation bootstrap was replaced with the same shared prepaint owner used by generated routes. On Observations itself, the Journal continuation is now one explicit handoff surface with explanatory copy and a distinct **Open in Journal** action; it no longer masquerades as another disclosure row or depend on a visually weak validity line. The action still opens the one shared Journal form already populated with the submitted observation.

The accepted baseline and current canary now have these permanent boundaries:

- `scripts/build-pages.mjs` is the canonical owner for all 180 generated page outputs. It has explicit route scopes, does not recursively reset mixed-ownership directories, and directly emits the final committed HTML, including the shared navigation serialization, prepaint-critical navigation CSS, and canonical shell script order.
- the former `scripts/finalize-static-assets.mjs` post-generation repair pass and `scripts/build-pages-safe.mjs` staging/semantic-preservation wrapper have been deleted. Direct generation was converged against all 180 owned outputs, the page regression suite passed, and the normal authoring build adds no further page diff.
- `scripts/build-data.mjs` is the canonical owner for `data/index.json`, `data/body-regions.json`, and `data/reverse-inference.json`. `npm run build:data` invokes it directly.
- Body Cue rows are authored in `data/Feelings.csv`. Duplicate region/option/feeling rows and the legacy `love` cue key were removed from the canonical source, and the permanent data-authoring contract prevents either source defect from returning.
- formula-derived reverse inference remains the default. The small set of reviewed production exceptions lives explicitly in `data/reverse-inference-overrides.json`, which the canonical compiler validates and applies while generating `data/reverse-inference.json`.
- the former `scripts/build-data-safe.mjs` staging wrapper and `scripts/finalize-generated-data.mjs` repair pass have been deleted. Direct data generation preserves the reviewed production semantics and is byte-deterministic on repeated runs.
- `npm run build` runs the canonical data, observation-cue, and page compilers directly. Site Quality CI validates the committed site first, runs the real authoring build, and fails if generated artifacts differ from the committed tree. The observation-cue compiler entry point and its escaped pattern serialization are cross-platform, so checked-in cue regexes cannot remain stale or silently fragment on Windows.
- the **Push Poems**, rebuild, and fact-checking workflows route regeneration through these same declared owners rather than a second repair layer or broad collateral staging.
- representative first-load JavaScript graphs and the largest shared browser assets have explicit regression ceilings in `tests/performance-budget.test.mjs`, so validated lazy-loading gains cannot silently disappear as the codebase evolves.
- category hubs paint normally and let the existing magnet runtime own saved-position restoration and handmade tilt/offset. Navigation alone retains the established lightweight saved-state prepaint path. Permanent regressions forbid the global JavaScript-readiness visibility gate, mobile fixed-root-background trigger, and compensating Feeling-art compositor hack identified during Bedrock phone testing. `scripts/nav-prepaint.mjs` is the shared build-time owner for navigation visibility and responsive position prefill, including on the hand-owned Observations route. Observations keeps its inline critical region navigation-only and parser-discovers `styles/observations.css` after `styles.css`. That one route stylesheet owns Observations desktop and phone presentation, including its single <=640px native-app block; the former route-critical/mobile split is retired so the screen cannot drift between two Observations style owners.
- the Need strategy-card deck has been extracted byte-for-byte from the former `inventory.js` tail into route-owned `scripts/strategy-deck.js`. Need pages still load the Inventory runtime for their real save controls, while unrelated routes do not need to parse deck behavior.
- the legacy Inventory `#journal-dashboard` compatibility redirect is owned by `scripts/inventory-legacy-journal-redirect.js` rather than the shared controller. The obsolete-architecture guard keeps that hash and the deleted safe-build/finalizer layers from drifting back into shared ownership.
- shared CSS dependencies are parser-discovered directly rather than hidden behind nested imports. Google Fonts consumers preconnect to both font origins before requesting font CSS, and `tests/font-delivery.test.mjs` makes that delivery order permanent.
- a live production-header audit confirmed that the published site is served through Cloudflare with HTTP/2, active compression, and static edge caching. A repeated CSS request produced a Cloudflare cache hit, so adding a second repository-owned cache/header layer is not a Bedrock requirement.
- the earlier root-scoped Bedrock service-worker cache canary is retired. Home does not register a cache worker; it only removes a lingering `/service-worker.js` registration and the retired `allneeds-static-*` cache namespace after normal load/idle. `service-worker.js` is a fetch-free retirement shim for browsers that previously installed the experiment.

The accepted ownership and delivery boundaries are documented in `docs/bedrock-runtime-contract.md`, `docs/bedrock-home-canary.md`, `docs/bedrock-route-runtime-matrix.md`, `docs/bedrock-performance-budget.md`, and `docs/bedrock-offline-cache.md`. The shared iOS-inspired interaction grammar is documented in `docs/native-app-visual-language.md`, with the Observations route contract in `docs/observations-layout.md`.

### Post-Bedrock immediate-response canary

`performance/immediate-response-v1` is a designated live-device performance canary built from the merged Bedrock baseline. It is intentionally **not production truth until phone and desktop acceptance is complete**.

The canary expands the proven intent-loaded shell model without weakening immediately visible function:

- Feelings, Needs, and Faux Feelings indexes no longer parser-load the large shared `scripts/inventory.js` controller.
- Feeling detail pages keep magnets and `scripts/feeling-reverse-inference.js` eager, while loading `inventory.js` only when a shared shell capability is requested.
- Faux Feeling detail pages keep their content/magnets eager and use the same shell intent-loader boundary.
- Body Cues keeps its dedicated `scripts/body-cues-tool.js`, Body Cues CSS, magnets, and shared shell eager while deferring unrelated Inventory-controller work.
- Need detail pages remain eager because their personal-strategy form and save/profile controls are immediately visible.
- Inventory, dedicated Journal, and Alexithymia Support remain eager because their primary visible features directly depend on their current controllers.
- On phone, Observations now has one explicit primary task path: write the observation → Load matches → review results. Quick Check, examples, recipe guidance, and exact/nearby provenance remain available as secondary support rather than competing with the primary action. Exact/nearby counts are displayed only after Load matches and are derived from the same loaded suggestion result that produced the visible Needs and Feelings.
- After results load, Journal continuation is presented as a distinct next-step handoff rather than a disclosure. Its readiness copy and action share one grouped surface, and the button opens the shared Journal already populated in the same browser task.

`tests/route-runtime-ownership.test.mjs` protects the behavior boundary and `tests/performance-budget.test.mjs` protects the measured startup reduction. On the current canary, representative raw direct JavaScript is about 101.9 KiB for the three category hubs, 118.2 KiB for a Feeling detail, 101.9 KiB for a Faux Feeling detail, and 116.8 KiB for Body Cues, versus 337.3 KiB for the intentionally eager Need-detail reference route. See `docs/bedrock-performance-budget.md` for exact scope and limitations of this metric.

When testing this branch, verify both primary route interactions and first use of Customizer, Journal, Account & data, backup/restore, and sharing. The small `scripts/shell-runtime-loader.js` is responsible for loading the canonical controller on those explicit intents and replaying an early interaction after initialization where necessary. Do not merge the canary solely because source-level CI is green; real phone and desktop acceptance is part of the performance change.

### Remaining Bedrock acceptance plan

There is no known open canonical-owner migration after the 2026-08-23 audit. The remaining work is a bounded acceptance sequence:

1. **Automated final-head gate:** run the complete Site Quality suite, the canonical build twice, and the zero-diff generated-output check on the exact published head. Any failure is repaired at its declared compiler, style, or runtime owner before proceeding.
2. **Observations on a real iPhone:** write both the built-in example and a manual observation; load results; confirm exact/nearby appears inside **Why these matches?** and agrees with the visible suggestions; confirm the Journal handoff is clearly an action rather than a disclosure; and confirm Journal opens already populated. Repeat after Safari chrome collapses/expands and once with the keyboard involved.
3. **Immediate-response shell paths on phone:** from an ordinary non-Inventory page, exercise first use of Menu, Customizer, Journal, Account & data, backup/export, and sharing. This is the outstanding acceptance boundary for the intent-loaded canary, not a request to reopen completed Bedrock architecture work.
4. **Desktop spot check:** verify Observations uses the available width, the Journal handoff opens prefilled, and the same first-use shell paths remain responsive. A short pass is sufficient unless it exposes a viewport-specific defect.
5. **Close the canary:** record the accepted phone/desktop result in the PR, update this status if the shipped ownership differs, confirm no migration scaffolding remains, and only then promote or merge the canary.
6. **Separate content follow-up:** the data-integrity report still identifies 20 Alexithymia feeling labels that do not have same-slug Feeling pages. Review them as aliases versus genuinely missing vocabulary, map aliases to canonical pages where appropriate, add any intentionally missing entries at the data owner, and then tighten that report from warning to regression. This does not require reopening Bedrock architecture, but it should not remain indefinite warning noise.
7. **Separate evidence follow-up:** replace the retired CDC sleep URL in the canonical Needs source with its current official page, regenerate the evidence/fact-checking bundles through their declared workflows, and teach the link verifier to distinguish publisher access blocks from genuinely missing pages. This is evidence maintenance rather than an Observations or Bedrock acceptance blocker.

If a device check exposes a defect, repeat only the affected acceptance section after fixing the named owner. Further PWA, asset, or speculative controller optimization remains outside the Bedrock finish line unless a measured acceptance failure requires it.

## How information is organised

- Core editable content lives primarily in `data/*.csv` plus reviewed JSON/template sources. Editors should change canonical source rather than generated output.
- `data/Feelings.csv` owns Body Cue source rows; `data/reverse-inference-overrides.json` owns only the reviewed exceptions that intentionally differ from formula-derived reverse inference.
- `npm run build:data` invokes the canonical data compiler directly, and `npm run build:pages` invokes the canonical page compiler directly.
- Generated pages store citation metadata from `_evidence/` so each claim on a need page can be traced back to its source.
- Generated output is committed, but it is not an authoring source. A correct source change must be reproducible from a clean checkout.

## Fact-checking the site

- **Spreadsheet-first workflow (GitHub Actions):** trigger the **“Fact-Checking Spreadsheets”** workflow from the Actions tab to download the current `fact-checking/` CSV bundle as an artifact. After editing those sheets, run the **“Apply Fact-Checking Spreadsheets”** workflow to import the folder, rebuild data + pages, and open a pull request with the generated changes—no local Node.js setup required. Both workflows default to the branch that triggered them; use the optional `base-branch` input when you intentionally need to target a different branch.
  - **Web-only checklist:** edit `fact-checking/` files on your branch → run **Fact-Checking Spreadsheets** on the same branch → run **Apply Fact-Checking Spreadsheets** on that branch to push the imports into canonical sources and regenerate the site outputs.
- **Local workflow (optional):** run `npm run export:fact-checking` to populate the `fact-checking/` folder with the editable source spreadsheets plus generated review snapshots. `reverse-inference-overrides.csv` round-trips the reviewed reverse-inference exceptions; `reverse-inference.csv` and `body-regions.csv` are reference snapshots generated from canonical source. After editing source sheets, run `npm run import:fact-checking`, then rebuild.
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

For a full production verification, run `npm run build` from a clean checkout and confirm it leaves no Git diff. The production baseline does not install a service worker for normal browsing; `service-worker.js` exists only as a retirement shim for browsers that installed the earlier cache experiment.

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
  - `npm run test:flicker-jitter` (includes runtime ownership, cache-retirement, magnet first-paint/mobile compositing, and strategy-deck ownership contracts)
  - `npm run test:performance`
  - `npm run test:delivery`
  - `npm run test:obsolete`

Re-run `npm run build:data` after changing canonical data sources and `npm run build:pages` when the generated HTML depends on those changes. Prefer open-access citations so readers can check the evidence without paywalls.

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
├── service-worker.js          # retirement shim for the abandoned root cache canary
├── feelings/                  # generated feeling hub + individual pages
├── needs/                     # generated need hub + individual pages
├── faux-feelings/             # generated situation hub + individual pages
├── inventory/                 # generated Inventory + dedicated Journal
├── feed/                      # Shared Strategies route
├── observations/              # observation tools
├── styles.css                 # shared base styling
├── styles/observations.css        # single Observations route presentation owner
├── data/
│   ├── Feelings.csv                       # feelings + canonical Body Cue rows
│   ├── Needs.csv
│   ├── Faux Feelings.csv
│   ├── Strategies.csv
│   ├── reverse-inference-overrides.json   # reviewed exceptions to formula output
│   ├── index.json                         # generated dataset
│   ├── body-regions.json                  # generated Body Cues data
│   └── reverse-inference.json             # generated reverse-inference index
└── scripts/
    ├── build-data.mjs          # canonical data compiler
    ├── build-pages.mjs         # canonical page compiler
    ├── nav-prepaint.mjs        # shared build-time navigation visibility and position prefill owner
    ├── strategy-deck.js        # Need-only strategy card deck runtime
    ├── inventory-legacy-journal-redirect.js # Inventory-only compatibility redirect
    └── shell-runtime-loader.js # shared shell intent-loader + retired-cache cleanup owner
```

### Spreadsheet columns

The three primary spreadsheets (`Feelings.csv`, `Needs.csv`, and `Faux Feelings.csv`) own most core relationships used across the site.

- **Feelings.csv** – each feeling row uses `Row Type = feeling` with fields for `Feeling Title`, `Page Summary`, `Related Faux feelings`, `Related Needs`, `Body Signal Notes`, and optional `Slug Override`. Additional rows with `Row Type = cue` capture Body Cues through the `Cue Region *` and `Cue Option *` columns. Cue source keys must be unique by region/option/feeling and must use canonical feeling keys such as `love-caring` rather than legacy aliases.
- **Needs.csv** – the need copy is organised into `Need Title`, `Category Label`, `Page Summary`, `Related Strategies`, `Related Faux feelings`, `Related Feelings`, and the claim text pair (`Claim Summary`, `Claim Narrative`). Evidence links live under the `Source Links` column.
- **Faux Feelings.csv** – faux feelings list their relationships via `Related Feelings` and `Related Needs`, with an optional `Slug Override` to customise URLs.
- **Strategies.csv** – strategy entries link to one or more needs via `Related Needs`; the optional `Strategy URL` powers the small link icon rendered next to a strategy in the Need and Inventory cards.
- **Observations** – the observation tool draws from `data/observation_cues.json` plus its compiled module/lexicon sources; the Observation Guide content itself is authored in `data/observation-guide.json` and regenerated through the observation-guide compiler.
