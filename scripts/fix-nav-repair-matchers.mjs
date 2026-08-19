import { readFileSync, writeFileSync } from 'node:fs';

const primaryPath = 'scripts/apply-static-nav-menu-repair.mjs';
let primary = readFileSync(primaryPath, 'utf8');

if (!primary.includes("lines.findIndex((line) =>") || !primary.includes("line.includes('nav-home')")) {
  const blockStart = primary.indexOf("  if (!text.includes('data-magnet-id=\\\\\"nav-menu\\\\\"')) {");
  const blockEndNeedle = "\n  // Journal is no longer part of the default core board";
  const blockEnd = primary.indexOf(blockEndNeedle, blockStart);
  if (blockStart < 0 || blockEnd < 0) {
    throw new Error('Unable to locate the old Home insertion block in primary repair patcher.');
  }

  const replacement = `  if (!text.includes('data-magnet-id="nav-menu"') && !text.includes('nav-menu')) {
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
  primary = primary.slice(0, blockStart) + replacement + primary.slice(blockEnd);
  writeFileSync(primaryPath, primary);
}

const finishPath = 'scripts/finish-static-nav-menu-repair.mjs';
const finish = readFileSync(finishPath, 'utf8');
if (!finish.includes("line.includes('data-magnet-id') && line.includes('nav-journal')")) {
  throw new Error('Finish repair patcher is not using the semantic Journal matcher.');
}

console.log('One-shot nav repair matchers are semantic.');
