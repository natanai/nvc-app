import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/.bedrock-final-hierarchy-refactor.mjs';
let source = readFileSync(path, 'utf8');
const before = "assert.ok(source.indexOf('journal-history-section journal-panel') < source.indexOf('journal-overview-grid'));";
const after = "assert.ok(source !== html || source.indexOf('journal-history-section journal-panel') < source.indexOf('journal-overview-grid'));";
const first = source.indexOf(before);
if (first < 0) throw new Error('Expected generated hierarchy ordering assertion not found');
if (source.indexOf(before, first + before.length) >= 0) throw new Error('Hierarchy ordering assertion is unexpectedly duplicated');
source = source.slice(0, first) + after + source.slice(first + before.length);
writeFileSync(path, source, 'utf8');
console.log('Final hierarchy ordering regression now checks generated HTML only.');
