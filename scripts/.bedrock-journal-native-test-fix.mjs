import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tests/native-action-controls.test.mjs';
let source = readFileSync(path, 'utf8');

source = source.replace(
  "  const styles = read('styles.css');\n  const readme = read('README.md');",
  "  const styles = read('styles.css');\n  const density = read('styles/shared-density.css');\n  const readme = read('README.md');",
);
source = source.replace(
`  assert.ok(moduleSource.includes("emotion: 'Use any word that fits. Leave blank if unsure.'"));
  assert.ok(moduleSource.includes("needs: 'Choose any needs that connect. Leave blank if unsure.'"));
  assert.ok(moduleSource.includes("this.needsSummaryEl.hidden = !hasSelection"));
  assert.equal(moduleSource.includes('No needs selected yet.'), false, 'empty needs state must not render a redundant confirmation card');
  assert.ok(styles.includes('.journal-needs-summary[hidden]'), 'canonical Journal CSS must honor the module hidden state');`,
`  assert.ok(moduleSource.includes("emotion: 'Feeling'"));
  assert.ok(moduleSource.includes("needs: 'Needs'"));
  assert.ok(moduleSource.includes("tags: 'Tags'"));
  assert.ok(moduleSource.includes("classes: ['journal-meta-group']"));
  assert.ok(moduleSource.includes("'journal-meta-row--intensity'"));
  assert.equal(moduleSource.includes('data-journal-needs-summary'), false, 'Journal needs must not retain the prototype confirmation layer');
  assert.ok(density.includes('.journal-meta-group {'), 'canonical shared density CSS must own the finished Journal metadata group');`,
);
source = source.replace(
`  assert.match(styles, /@media \\(min-width: 860px\\)[\\s\\S]*?\\.journal-form__grid,[\\s\\S]*?grid-template-columns:\\s*repeat\\(2, minmax\\(0, 1fr\\)\\)/);
  assert.match(styles, /\\.journal-form__field,[\\s\\S]*?border:\\s*1px solid/);`,
`  assert.ok(density.includes('.journal-meta-row + .journal-meta-row'));
  assert.ok(density.includes('.journal-history-controls__choices'));`,
);

if (!source.includes("emotion: 'Feeling'")) throw new Error('Native Journal contract update did not apply');
writeFileSync(path, source, 'utf8');
console.log('Native action regression contract updated for finished Journal UX.');

// Synchronize trigger after the default-branch runner learned this contract.
