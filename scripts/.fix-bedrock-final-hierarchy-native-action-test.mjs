import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tests/native-action-controls.test.mjs';
let source = readFileSync(path, 'utf8');

const replacements = [
  [
    "  assert.ok(density.includes('.journal-history-controls__choices'));",
    "  assert.ok(pages.includes('journal-history-controls__filters'));\n  assert.ok(pages.includes('journal-utility-disclosure'));\n  assert.equal(pages.includes('data-journal-summary-toggle'), false, 'Patterns disclosure must use native details state rather than a custom runtime toggle');",
  ],
  [
    "  assert.match(styles, /\\.strategy-card--form \\{[\\s\\S]*?border-width:\\s*2px;[\\s\\S]*?box-shadow:\\s*0 6px/);",
    "  assert.match(styles, /\\.strategy-card--form \\{[\\s\\S]*?border:\\s*1\\.5px solid[\\s\\S]*?box-shadow:\\s*none/);",
  ],
  [
    "  assert.match(styles, /\\.strategy-card--form \\.strategy-card--input \\{[\\s\\S]*?border-width:\\s*2px;[\\s\\S]*?box-shadow:\\s*0 3px/);",
    "  assert.match(styles, /\\.strategy-card--form \\.strategy-card--input \\{[\\s\\S]*?border:\\s*1px solid[\\s\\S]*?box-shadow:\\s*none/);",
  ],
  [
    "  assert.ok(styles.includes('min-height: 6.5rem'));",
    "  assert.ok(styles.includes('min-height: 4.75rem'));\n  assert.ok(styles.includes('.strategy-section__header {'));",
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Expected stale native-action assertion not found: ${before}`);
  source = source.replace(before, after);
}

writeFileSync(path, source, 'utf8');
console.log('Native-action density contract updated for final Bedrock hierarchy.');
