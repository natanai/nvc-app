import { readFileSync, writeFileSync } from 'node:fs';

const primaryPath = 'scripts/apply-static-nav-menu-repair.mjs';
let primary = readFileSync(primaryPath, 'utf8');

const oldHomeBlock = `  if (!text.includes('data-magnet-id=\\\\\"nav-menu\\\\\"')) {
    const homeLineNeedle = '            <a class=\\\\\"pill magnet site-nav__magnet site-nav__magnet--home\\\\\" data-magnet-id=\\\\\"nav-home\\\\\"';
    assertIncludes(text, homeLineNeedle, 'nav Home markup');
    text = text.replace(homeLineNeedle, menuMarkup + homeLineNeedle);
  }
`;

const newHomeBlock = `  if (!text.includes('data-magnet-id="nav-menu"') && !text.includes('data-magnet-id=\\\\\"nav-menu\\\\\"')) {
    const lines = text.split('\\n');
    const homeIndex = lines.findIndex((line) =>
      line.includes('site-nav__magnet--home')
      && line.includes('data-magnet-id')
      && line.includes('nav-home'));
    if (homeIndex < 0) throw new Error('Unable to locate nav Home markup');
    lines.splice(homeIndex, 0, ...menuMarkup.trimEnd().split('\\n'));
    text = lines.join('\\n');
  }
`;

if (!primary.includes(oldHomeBlock)) {
  throw new Error('Unable to locate the over-escaped Home matcher in primary repair patcher.');
}
primary = primary.replace(oldHomeBlock, newHomeBlock);
writeFileSync(primaryPath, primary);

const finishPath = 'scripts/finish-static-nav-menu-repair.mjs';
let finish = readFileSync(finishPath, 'utf8');
const oldJournalLine = `  const index = lines.findIndex((line) => line.includes('data-magnet-id=\\\\\\\"nav-journal\\\\\\\"'));`;
const newJournalLine = `  const index = lines.findIndex((line) => line.includes('data-magnet-id') && line.includes('nav-journal'));`;
if (!finish.includes(oldJournalLine)) {
  throw new Error('Unable to locate the over-escaped Journal matcher in finish repair patcher.');
}
finish = finish.replace(oldJournalLine, newJournalLine);
writeFileSync(finishPath, finish);

console.log('One-shot nav repair matchers corrected.');
