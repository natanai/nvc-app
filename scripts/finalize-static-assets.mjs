import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const htmlTargets = [
  'index.html',
  'alexithymia-support',
  'faux-feelings',
  'feelings',
  'needs',
  'inventory',
  'observations',
  'feed',
];

function collectHtml(target, output = []) {
  if (!existsSync(target)) return output;
  const stats = statSync(target);
  if (stats.isFile()) {
    if (target.toLowerCase().endsWith('.html')) output.push(target);
    return output;
  }

  for (const entry of readdirSync(target)) {
    collectHtml(join(target, entry), output);
  }
  return output;
}

function finalizeSharedHtml(html) {
  let output = html;

  output = output
    .replaceAll('💾 Save to device', 'Save to device')
    .replaceAll('☁️ Save to profile', 'Save to profile')
    .replaceAll(
      '<h2 id="journal-form-heading" class="section-title">Log a new entry</h2>',
      '<h2 id="journal-form-heading" class="section-title">New entry</h2>',
    )
    .replaceAll(
      '<p class="journal-form-section__hint">Tag what\'s present right now. Unsure of the feeling? Leave it blank and lean on the notes.</p>',
      '<p class="journal-form-section__hint">Tag what’s present now. Feeling optional—notes are enough.</p>',
    );

  output = output.replace(
    /<p class="strategy-form__notice">Personal strategies you add stay on this browser\.[\s\S]*?<\/p>/g,
    '<p class="strategy-form__notice">Backup, restore, and account sync are in Menu → Account &amp; data.</p>',
  );

  return output;
}

function finalizeFeedHtml(html) {
  let output = html;

  output = output
    .replace('<li aria-current="page">Strategy feed</li>', '<li aria-current="page">Shared strategies</li>')
    .replace('<h1 class="page-title">Strategy feed</h1>', '<h1 class="page-title">Shared strategies</h1>')
    .replace(/\s*<p class="page-description">\s*Browse strategies that other allneeds users have chosen to share\.[\s\S]*?<\/p>/, '')
    .replace(/\s*<p class="page-description">\s*The “From people you follow” feed uses Bluesky’s public API,[\s\S]*?<\/p>/, '')
    .replace(/\s*<h2 class="section-heading">Filters<\/h2>/, '')
    .replace(/\s*<button\s+class="feed-controls__icon-button"[\s\S]*?data-feed-follows-check[\s\S]*?<\/button>/, '')
    .replace(/\s*<button class="feed-controls__button" type="button" data-feed-fetch>[\s\S]*?<\/button>/, '')
    .replace(/\s*<p class="feed-follows-status" data-feed-follows-status><\/p>/, '')
    .replace(/\s*<p class="feed-action-hint">\s*Select a filter and click “Pull strategies” to retrieve the latest feed\.\s*<\/p>/, '')
    .replace(/\s*<p class="feed-action-hint">\s*Follow-based results require Bluesky public visibility plus an active sign-in session\.\s*<\/p>/, '');

  return output;
}

const htmlFiles = htmlTargets.flatMap((target) => collectHtml(join(rootDir, target)));
let changedFiles = 0;

for (const file of htmlFiles) {
  const before = readFileSync(file, 'utf8');
  let after = finalizeSharedHtml(before);
  if (relative(rootDir, file).replaceAll('\\', '/') === 'feed/index.html') {
    after = finalizeFeedHtml(after);
  }
  if (after !== before) {
    writeFileSync(file, after);
    changedFiles += 1;
  }
}

// These buttons are created only when profile saving becomes available, so the
// source implementation itself must carry the final user-facing label. This is
// still a build-time source normalization: no browser-side label repair exists.
const inventoryScriptPath = join(rootDir, 'scripts', 'inventory.js');
if (existsSync(inventoryScriptPath)) {
  const before = readFileSync(inventoryScriptPath, 'utf8');
  const after = before.replaceAll('☁️ Save to profile', 'Save to profile');
  if (after !== before) {
    writeFileSync(inventoryScriptPath, after);
    changedFiles += 1;
  }
}

console.log(`Finalized static UI in ${changedFiles} file${changedFiles === 1 ? '' : 's'}.`);
