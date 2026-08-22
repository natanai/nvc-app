import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tests/native-action-controls.test.mjs';
let source = readFileSync(path, 'utf8');
const oldAssertion = `  assert.ok(moduleSource.includes("'journal-meta-row--intensity'"));`;
const newAssertions = `  assert.equal(moduleSource.includes("'journal-meta-row--intensity'"), false, 'Journal intensity belongs to each Feeling in the Feeling popup');\n  assert.ok(moduleSource.includes('data-journal-feeling-intensity'));\n  assert.ok(density.includes('.journal-feeling-rating {'));`;
if (!source.includes(oldAssertion)) {
  throw new Error('Expected stale standalone-intensity assertion was not found');
}
source = source.replace(oldAssertion, newAssertions);
writeFileSync(path, source, 'utf8');
console.log('Native action regression contract updated for per-feeling intensity.');
