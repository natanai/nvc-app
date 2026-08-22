import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value, 'utf8');

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Non-unique ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

{
  const path = 'scripts/build-pages.mjs';
  let source = read(path);

  source = replaceOnce(
    source,
`      main[data-page-id='inventory-journal'] .journal-page {
        display: grid;
        gap: clamp(0.65rem, 1.8vw, 0.95rem);
      }
`,
`      main[data-page-id='inventory-journal'] .journal-page {
        display: grid;
        gap: clamp(0.65rem, 1.8vw, 0.95rem);
      }

      /* Journal inline-size containment contract. Populated History introduces
         a horizontally scrollable filter rail, while Patterns and entry text
         add intrinsic content. Every nested grid/flex item in that path must
         be allowed to shrink to the viewport so intrinsic width stays inside
         the component instead of widening the document on mobile Safari. */
      .page-wrapper,
      main[data-page-id='inventory-journal'],
      main[data-page-id='inventory-journal'] .journal-page,
      main[data-page-id='inventory-journal'] .journal-history-section,
      main[data-page-id='inventory-journal'] .journal-history-controls,
      main[data-page-id='inventory-journal'] .journal-overview-grid,
      main[data-page-id='inventory-journal'] .journal-utility-disclosure,
      main[data-page-id='inventory-journal'] .journal-utility-disclosure__body,
      main[data-page-id='inventory-journal'] .journal-summary,
      main[data-page-id='inventory-journal'] .journal-summary__stat,
      main[data-page-id='inventory-journal'] .journal-history,
      main[data-page-id='inventory-journal'] .journal-entry,
      main[data-page-id='inventory-journal'] .journal-entry__title-row {
        min-width: 0;
        max-width: 100%;
      }

      main[data-page-id='inventory-journal'] .journal-entry__title-row {
        flex-wrap: wrap;
      }

      main[data-page-id='inventory-journal'] .journal-entry__emotion,
      main[data-page-id='inventory-journal'] .journal-entry__notes,
      main[data-page-id='inventory-journal'] .journal-summary__value,
      main[data-page-id='inventory-journal'] .journal-summary__list,
      main[data-page-id='inventory-journal'] .journal-value-token {
        min-width: 0;
        max-width: 100%;
        overflow-wrap: anywhere;
      }
`,
    'Journal page root rule',
  );

  source = replaceOnce(
    source,
`      main[data-page-id='inventory-journal'] .journal-history-controls__filters {
        display: flex;
        gap: 0.34rem;
        overflow-x: auto;
        overscroll-behavior-inline: contain;
        scrollbar-width: none;
        padding-bottom: 0.08rem;
      }
`,
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
`,
    'Journal filter rail',
  );

  source = replaceOnce(
    source,
`      main[data-page-id='inventory-journal'] .journal-summary {
        padding-top: 0.05rem;
      }
`,
`      main[data-page-id='inventory-journal'] .journal-summary {
        padding-top: 0.05rem;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
      }
`,
    'Journal summary grid',
  );

  write(path, source);
}

{
  const path = 'tests/final-hierarchy-ux.test.mjs';
  let source = read(path);
  source = replaceOnce(
    source,
`  assert.ok(runtime.includes("'No matches'"), 'filtered-empty history must distinguish no matches from no entries');
});`,
`  assert.ok(runtime.includes("'No matches'"), 'filtered-empty history must distinguish no matches from no entries');
  for (const source of [build, html]) {
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-history-controls__filters {"), 'Journal must own its populated filter rail at the generator layer');
    assert.ok(source.includes('contain: inline-size;'), 'the horizontal Journal filter rail must contain its intrinsic width instead of widening the document');
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-summary__stat,"), 'Patterns cards must participate in the Journal shrink-to-viewport contract');
    assert.ok(source.includes("main[data-page-id='inventory-journal'] .journal-entry__title-row {"), 'populated entries must participate in the Journal shrink-to-viewport contract');
    assert.ok(source.includes('grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));'), 'Patterns grid minimums must never exceed their available inline size');
    assert.ok(source.includes('overflow-wrap: anywhere;'), 'user Journal content must not export long-token width to the document');
  }
});`,
    'final hierarchy Journal assertions',
  );
  write(path, source);
}

{
  const path = 'docs/bedrock-acceptance-checklist.md';
  let source = read(path);
  source = replaceOnce(
    source,
`4. Saved entries should scan like a dense native log/list: Feeling/intensity first, quiet date metadata, a concise note body when present, small Need/Tag facets, and secondary Edit/Delete actions. Entries should be separated without each becoming another heavy shadowed card.`,
`4. Saved entries should scan like a dense native log/list: Feeling/intensity first, quiet date metadata, a concise note body when present, small Need/Tag facets, and secondary Edit/Delete actions. Entries should be separated without each becoming another heavy shadowed card. With filters, entries, and Patterns populated, the document itself must remain locked to the viewport width: the filter rail may scroll internally, but swiping elsewhere on the page must not pan the entire Journal sideways.`,
    'Journal width acceptance step',
  );
  write(path, source);
}

console.log('Journal mobile inline-size containment repair applied.');
