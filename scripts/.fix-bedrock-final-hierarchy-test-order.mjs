import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/.bedrock-final-hierarchy-refactor.mjs';
let source = readFileSync(path, 'utf8');
const oldBlock = `  for (const source of [build, html]) {\n    assert.ok(source.includes('journal-fullscreen-button--compact'));\n    assert.ok(source.includes('>New entry<'));\n    assert.ok(source.includes('class="journal-history-controls__filters"'));\n    assert.ok(source.includes('journal-utility-disclosure'));\n    assert.ok(source.indexOf('journal-history-section journal-panel') < source.indexOf('journal-overview-grid'));\n    assert.equal(source.includes('data-journal-summary-toggle'), false);\n    assert.equal(source.includes('journal-page-description'), false);\n    assert.equal((source.match(/data-journal-history/g) || []).length, 1);\n  }`;
const newBlock = `  for (const source of [build, html]) {\n    assert.ok(source.includes('journal-fullscreen-button--compact'));\n    assert.ok(source.includes('>New entry<'));\n    assert.ok(source.includes('class="journal-history-controls__filters"'));\n    assert.ok(source.includes('journal-utility-disclosure'));\n    assert.equal(source.includes('data-journal-summary-toggle'), false);\n    assert.equal(source.includes('journal-page-description'), false);\n    assert.equal((source.match(/data-journal-history/g) || []).length, 1);\n  }\n  assert.ok(html.indexOf('journal-history-section journal-panel') < html.indexOf('journal-overview-grid'));`;
if (!source.includes(oldBlock)) throw new Error('Expected generated hierarchy test block not found');
source = source.replace(oldBlock, newBlock);
writeFileSync(path, source, 'utf8');
console.log('Final hierarchy ordering regression now checks generated HTML only.');
