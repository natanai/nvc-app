import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

test('Observations has one route-specific presentation owner', async () => {
  const html = await fs.readFile(path.join(root, 'observations/index.html'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles/observations.css'), 'utf8');
  const guide = await fs.readFile(path.join(root, 'scripts/observation-guide.mjs'), 'utf8');

  const routeLink = '<link rel="stylesheet" href="../styles/observations.css" />';
  assert.ok(html.includes(routeLink));
  assert.ok(html.indexOf(routeLink) > html.indexOf('<link rel="stylesheet" href="../styles.css" fetchpriority="high" />'));
  assert.ok(css.includes('single route-specific stylesheet for /observations/'));
  assert.ok(css.includes('@media (max-width: 640px)'));
  assert.ok(!css.includes('!important'));
  assert.ok(!guide.includes('observationsCriticalCssPath'));
  assert.ok(guide.includes('OBSERVATIONS_STYLESHEET_LINK'));
  await assert.rejects(fs.access(path.join(root, 'styles/observations-critical.css')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'styles/observations-mobile.css')), { code: 'ENOENT' });
});

test('Observation task order is authored in DOM rather than CSS order patches', async () => {
  const html = await fs.readFile(path.join(root, 'observations/index.html'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles/observations.css'), 'utf8');
  const input = html.indexOf('id="observation-text"');
  const suggestions = html.indexOf('id="observation-suggestions"');
  const quickCheck = html.indexOf('class="observation-editor__slot-header"');
  const example = html.indexOf('id="observation-example-toggle"');

  assert.ok(input >= 0 && suggestions > input && quickCheck > suggestions && example > quickCheck);
  assert.ok(!css.includes('.observation-editor__field > *'));
  assert.ok(!css.includes('order: 30;'));
  assert.ok(html.includes('id="observation-suggestions" class="observation-suggestions" aria-live="polite" data-mode="editing"'));
});

test('Exact and nearby provenance is post-load and sourced from loaded matches', async () => {
  const html = await fs.readFile(path.join(root, 'observations/index.html'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles/observations.css'), 'utf8');
  const editor = await fs.readFile(path.join(root, 'assets/js/observation-editor.js'), 'utf8');

  const heading = html.indexOf('class="observation-suggestions__heading"');
  const summary = html.indexOf('id="observation-detection-summary"');
  const actionRow = html.indexOf('class="observation-suggestions__action-row"');
  assert.ok(heading >= 0 && summary > heading && actionRow > summary);
  assert.ok(html.slice(summary, actionRow).includes('hidden'));
  assert.ok(editor.includes("const moduleCount = Array.isArray(suggestions?.modules) ? suggestions.modules.length : 0;"));
  assert.ok(editor.includes('state.detectionMatchLimit = Math.max(exactTotal, 1);'));
  assert.ok(editor.includes('renderDetectionSummary();'));
  assert.ok(css.includes(".observation-suggestions__action[data-action='done']"));
  assert.ok(css.includes("content: '•';"));
});

test('Equivalent Observation disclosures use one chevron language on phones', async () => {
  const html = await fs.readFile(path.join(root, 'observations/index.html'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles/observations.css'), 'utf8');
  const guide = await fs.readFile(path.join(root, 'scripts/observation-guide.mjs'), 'utf8');

  assert.ok(html.includes('observation-overview__summary-icon" aria-hidden="true">›</span>'));
  assert.ok(guide.includes('observation-guide__toggle-icon" aria-hidden="true">›</span>'));
  assert.ok(css.includes('.observation-editor__example-toggle::after'));
  assert.ok(css.includes('.observation-editor__recipe-toggle::after'));
  assert.ok(!css.includes("content: '<';"));
  assert.ok(css.includes('.observation-suggestions__why-toggle::after'));
  assert.ok(css.includes('.observation-guide__mobile-summary::after'));
  assert.ok(css.includes("content: '›';"));
  assert.ok(css.includes('var(--obs-group-bg)'));
  assert.ok(css.includes('var(--obs-separator)'));
});
