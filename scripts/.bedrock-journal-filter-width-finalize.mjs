import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value, 'utf8');

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`Non-unique ${label}`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

{
  const path = 'scripts/build-pages.mjs';
  let source = read(path);

  source = replaceOnce(
    source,
`      main[data-page-id='inventory-journal'] .journal-history-controls__filters {
        display: flex;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        gap: 0.34rem;
        overflow-x: auto;
        overflow-y: hidden;
        overscroll-behavior-inline: contain;
        scrollbar-width: none;
        contain: inline-size;
        padding-bottom: 0.08rem;
      }

      main[data-page-id='inventory-journal'] .journal-history-controls__filters::-webkit-scrollbar {
        display: none;
      }

      main[data-page-id='inventory-journal'] .journal-history-control {
        flex: 0 0 auto;
        display: block;
      }`,
`      main[data-page-id='inventory-journal'] .journal-history-controls__filters {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        width: 100%;
        min-width: 0;
        max-width: 100%;
        gap: 0.34rem;
      }

      main[data-page-id='inventory-journal'] .journal-history-control {
        display: block;
        min-width: 0;
        max-width: 100%;
      }`,
    'mobile Journal filter rail',
  );

  source = replaceOnce(
    source,
`      main[data-page-id='inventory-journal'] .journal-history-control select {
        width: auto;
        min-width: 7rem;
        min-height: 44px;`,
`      main[data-page-id='inventory-journal'] .journal-history-control select {
        width: 100%;
        min-width: 0;
        max-width: 100%;
        min-height: 44px;`,
    'Journal filter select sizing',
  );

  source = replaceOnce(
    source,
`        main[data-page-id='inventory-journal'] .journal-history-controls__filters {
          overflow-x: visible;
          flex-wrap: wrap;
        }`,
`        main[data-page-id='inventory-journal'] .journal-history-controls__filters {
          grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
        }`,
    'desktop Journal filter layout',
  );

  write(path, source);
}

{
  const path = 'tests/final-hierarchy-ux.test.mjs';
  let source = read(path);
  const old = `  // Regression target: populated Journal content may scroll inside the filter
  // rail, but its intrinsic width must never make the document itself pan.
  for (const source of [build, html]) {
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-history-controls__filters {"), 'Journal must own its populated filter rail at the generator layer');
    assert.ok(source.includes('contain: inline-size;'), 'the horizontal Journal filter rail must contain its intrinsic width instead of widening the document');
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-summary__stat,"), 'Patterns cards must participate in the Journal shrink-to-viewport contract');
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-entry__title-row {"), 'populated entries must participate in the Journal shrink-to-viewport contract');
    assert.ok(source.includes('grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));'), 'Patterns grid minimums must never exceed their available inline size');
    assert.ok(source.includes('overflow-wrap: anywhere;'), 'user Journal content must not export long-token width to the document');
  }`;
  const replacement = `  // Regression target: populated Journal filters must fit the viewport by
  // construction. A wide horizontal select rail proved capable of exporting
  // intrinsic width to mobile Safari's document even when ancestors had
  // min-width:0. Use a bounded grid instead; no document or filter-rail pan is
  // part of the final mobile interaction contract.
  for (const source of [build, html]) {
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-history-controls__filters {"), 'Journal must own its populated filters at the generator layer');
    assert.ok(source.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'), 'mobile Journal filters must use bounded tracks');
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-history-control select {\\n        width: 100%;\\n        min-width: 0;\\n        max-width: 100%;"), 'native selects must shrink inside their grid tracks');
    assert.equal(source.includes('overflow-x: auto;\\n        overflow-y: hidden;\\n        overscroll-behavior-inline: contain;'), false, 'the retired horizontal filter rail must not return');
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-summary__stat,"), 'Patterns cards must participate in the Journal shrink-to-viewport contract');
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-entry__title-row {"), 'populated entries must participate in the Journal shrink-to-viewport contract');
    assert.ok(source.includes('grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));'), 'Patterns grid minimums must never exceed their available inline size');
    assert.ok(source.includes('overflow-wrap: anywhere;'), 'user Journal content must not export long-token width to the document');
  }`;
  if (!source.includes(old)) throw new Error('Missing previous Journal width regression contract');
  source = source.replace(old, replacement);
  write(path, source);
}

{
  const path = 'docs/bedrock-acceptance-checklist.md';
  let source = read(path);
  source = source.replace(
    'the History filter rail may still scroll internally.',
    'the History filters remain bounded inside the viewport without horizontal page or filter-rail panning.',
  );
  write(path, source);
}

console.log('Final Journal filter width repair applied.');
