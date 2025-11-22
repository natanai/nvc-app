import { readFileSync } from 'fs';
import assert from 'assert/strict';

const homePath = new URL('../index.html', import.meta.url);
const html = readFileSync(homePath, 'utf8');

function expectMatch(label, pattern) {
  assert.ok(pattern.test(html), `${label} is missing from the built home page`);
}

function expectDoor(label) {
  const doorPattern = new RegExp(`<span class="door-card__label">${label}</span>`);
  expectMatch(`${label} doorway`, doorPattern);
}

expectMatch(
  'Home doorway prompt',
  /<p class="home-doorways__prompt">\s*Collect strategies for all your needs\. Start with any door\.\s*<\/p>/,
);

expectDoor('Observations');
expectDoor('Feelings');
expectDoor('Needs');

expectMatch(
  'Feelings doorway support link',
  /<a class="door-card__support" href="alexithymia-support\/">Alexithymia support<\/a>/i,
);

expectMatch(
  'Home support note link',
  /<p class="home-doorways__support-note">\s*<a href="alexithymia-support\/">Alexithymia Support<\/a>\s*<\/p>/,
);
