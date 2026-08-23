import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, value) => writeFileSync(path, value, 'utf8');

{
  const path = 'scripts/build-pages.mjs';
  let source = read(path);
  const start = source.indexOf('function journalHistoryPrepaintScript()');
  const end = source.indexOf('function renderInventoryJournalPage', start);
  if (start < 0 || end < 0) throw new Error('Journal prepaint owner not found');
  const before = source.slice(start, end);
  const after = before.replace(/<\\+\/script>/g, '</script>');
  if (after === before) throw new Error('Escaped Journal prepaint closing tag not found');
  if ((before.match(/<\\+\/script>/g) || []).length !== 1) throw new Error('Expected exactly one escaped Journal prepaint closing tag');
  source = source.slice(0, start) + after + source.slice(end);
  write(path, source);
}

{
  const path = 'tests/final-hierarchy-ux.test.mjs';
  let source = read(path);
  const anchor = `  assert.ok(html.includes('data-journal-prepaint'), 'generated Journal must ship the tiny state bootstrap');\n`;
  if (!source.includes(anchor)) throw new Error('Journal prepaint test anchor not found');
  const addition = `  const prepaintStart = build.indexOf('function journalHistoryPrepaintScript()');\n  const prepaintEnd = build.indexOf('function renderInventoryJournalPage', prepaintStart);\n  const prepaintOwner = build.slice(prepaintStart, prepaintEnd);\n  assert.ok(prepaintOwner.includes('</script>'), 'Journal prepaint bootstrap must emit a real HTML closing script tag');\n  assert.equal(/<\\\\+\\/script>/.test(prepaintOwner), false, 'escaped script closers must never leak into generated HTML');\n  assert.equal(html.includes('<\\\\/script>'), false, 'generated Journal must not ship an escaped script closing tag');\n`;
  source = source.replace(anchor, anchor + addition);
  write(path, source);
}

console.log('Journal prepaint closing tag repaired at the generator owner.');
