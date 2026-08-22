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
  const path = 'assets/js/journal/module.js';
  let source = read(path);
  source = replaceOnce(
    source,
    "  const notesId = `${config.idPrefix}-notes`;  const notesId = `${config.idPrefix}-notes`;",
    "  const notesId = `${config.idPrefix}-notes`;",
    'duplicated Journal notes id declaration',
  );
  write(path, source);
}

{
  const path = 'tests/journal-per-feeling-intensity.test.mjs';
  let source = read(path);
  if (!source.includes("test('Journal module remains importable after the per-feeling refactor'")) {
    source += `\n\ntest('Journal module remains importable after the per-feeling refactor', async () => {\n  const moduleUrl = new URL('../assets/js/journal/module.js', import.meta.url);\n  const loaded = await import(\`${'${moduleUrl.href}'}?syntax=${'${Date.now()}'}\`);\n  assert.equal(typeof loaded.renderJournalForm, 'function');\n});\n`;
  }
  write(path, source);
}

{
  const path = 'docs/bedrock-acceptance-checklist.md';
  let source = read(path);
  source = replaceOnce(
    source,
    '- the Journal native-UX contract: Feeling and Needs are catalog-backed popup multi-selectors whose options stay hidden until opened, Tags retain example text and free-form tagging, Feeling/Intensity/Needs/Tags share one compact metadata group, and Journal History can filter individual values from multi-feeling entries;',
    '- the Journal native-UX contract: Feeling and Needs use catalog-backed popups whose options stay hidden until opened; each Feeling row owns its own 0–10 intensity where 0 means unselected; Tags retain example text and free-form tagging; and Journal History preserves, displays, summarizes, and filters individual Feeling/intensity pairs;',
    'automated Journal acceptance bullet',
  );

  const oldSteps = `2. Confirm Feeling, Intensity, Needs, and Tags read as one compact metadata group rather than four unrelated cards. Feeling and Intensity should be immediately adjacent.\n3. Before tapping either selector, confirm **no Feeling or Need words are already displayed as an option list**. The rows should simply offer **Choose feelings** and **Choose needs**.\n4. Open Feeling. Confirm a popup/dropout list appears containing valid Feelings from the site's feelings catalog, that more than one Feeling can be selected, and that closing the popup collapses the catalog again.\n5. Open Needs. Confirm a popup/dropout list appears containing valid Needs from the site's needs catalog, that more than one Need can be selected, and that closing the popup collapses the catalog again.\n6. Confirm opening either selector does not automatically summon the iPhone keyboard; use the popup search field separately when you actually want to search.\n7. Confirm Tags remains a free-form field and shows useful examples such as \`work, weekend, boundaries\` when empty.\n8. Adjust Intensity, choose multiple Feelings and Needs, add multiple Tags, and save a temporary entry. Confirm it appears in Journal History with the selected Feelings and intensity together and Needs/Tags represented compactly.\n9. Edit that entry and confirm all selected Feelings, Needs, Tags, and Intensity are restored correctly, then save the edit.\n10. In Journal History, exercise Search and the Feeling, Need, Tag, Date, and Sort controls. For a multi-feeling entry, confirm filtering by either individual selected Feeling finds the entry. Confirm **Clear** returns to the unfiltered history.\n11. Delete the temporary entry.\n12. Open the Journal overlay from one ordinary non-Journal page and confirm it opens on the first tap and uses the same popup multi-selector interaction model.\n13. Repeat the editor check once with Safari's on-screen keyboard visible from another field and once after the browser chrome has collapsed/expanded.\n\nPass condition: Feeling and Needs expose only valid site vocabulary through collapsed-by-default multi-select popups, Tags remains lightweight/free-form with examples, selected values round-trip through save/edit/history correctly, touch targets remain comfortable, and dedicated/overlay paths both initialize correctly.`;
  const newSteps = `2. Confirm the resting metadata group is compact: **Feeling**, **Needs**, and **Tags**. There should be no standalone Intensity row because intensity now belongs to each Feeling.\n3. Before tapping either selector, confirm **no Feeling or Need words are already displayed as an option list**. The rows should simply offer **Choose feelings** and **Choose needs**.\n4. Open Feeling. Confirm a popup/dropout list appears containing valid Feelings from the site's feelings catalog. Each row should place the Feeling word on the left and its own **0–10 intensity scale** on the right.\n5. Confirm all Feeling scales begin at **0** when unselected. Move one Feeling above 0 and confirm it becomes selected; choose a different intensity for a second Feeling; return one scale to 0 and confirm that Feeling is removed from the selection.\n6. Close and reopen Feeling and confirm the independent ratings are preserved. Opening the selector should not automatically summon the iPhone keyboard; use search only when wanted.\n7. Open Needs. Confirm a popup/dropout list appears containing valid Needs from the site's needs catalog, that more than one Need can be selected, and that closing the popup collapses the catalog again.\n8. Confirm Tags remains a free-form field and shows useful examples such as \`work, weekend, boundaries\` when empty.\n9. Save a temporary entry with at least two Feelings at different non-zero intensities, multiple Needs, and multiple Tags. Confirm Journal History displays each Feeling with its own intensity rather than one intensity for the whole entry.\n10. Edit that entry and confirm every Feeling/intensity pair, Need, and Tag is restored correctly, then save the edit.\n11. In Journal History, exercise Search and the Feeling, Need, Tag, Date, and Sort controls. For a multi-feeling entry, confirm filtering by either individual Feeling finds the entry. Confirm **Clear** returns to the unfiltered history.\n12. Delete the temporary entry.\n13. Open the Journal overlay from one ordinary non-Journal page and confirm it opens on the first tap and uses the same per-Feeling intensity selector and Needs popup.\n14. Repeat the editor check once with Safari's on-screen keyboard visible from another field and once after the browser chrome has collapsed/expanded.\n\nPass condition: each selected Feeling owns an independent 1–10 rating and setting it to 0 removes that Feeling; Needs exposes only valid site vocabulary through a collapsed-by-default multi-select popup; Tags remains lightweight/free-form with examples; Feeling/intensity pairs round-trip through save/edit/history correctly; touch targets remain comfortable; and dedicated/overlay paths both initialize correctly.`;
  source = replaceOnce(source, oldSteps, newSteps, 'phone Journal acceptance steps');
  write(path, source);
}

console.log('Final per-feeling Journal cleanup applied.');
