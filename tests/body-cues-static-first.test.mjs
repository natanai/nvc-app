import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../feelings/body-cues/index.html', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../scripts/body-cues-tool.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/body-cues.css', import.meta.url), 'utf8');
const mobileCss = readFileSync(new URL('../styles/body-cues-mobile.css', import.meta.url), 'utf8');

assert.match(html, /styles\/body-cues\.css/);
assert.match(html, /styles\/body-cues-mobile\.css[^>]*media="\(max-width: 640px\)"/);
assert.match(html, /<h2 id="body-cues-magnets-heading">Possible feelings<\/h2>/);
assert.match(html, /data-body-cues-active-count>0 cues selected/);
assert.match(html, /data-body-cues-pin-toggle/);
assert.match(html, /class="body-cues-tool__option" data-option-id=/);
assert.match(html, /class="body-cues-tool__slider"[\s\S]*?aria-valuetext="Off"/);

assert.doesNotMatch(runtime, /loadEnhancementStyles/);
assert.doesNotMatch(runtime, /body-cues-enhancements/);
assert.doesNotMatch(runtime, /createElement\(['"]link['"]\)/);
assert.doesNotMatch(runtime, /function enhanceStructure/);
assert.doesNotMatch(runtime, /function createSlider/);
assert.match(runtime, /function hydrateControls/);

assert.match(css, /@media \(min-width: 900px\)[\s\S]*?\.body-cues-page \.body-cues-tool__region \{[\s\S]*?flex-shrink: 0;/);
assert.match(mobileCss, /@media \(max-width: 640px\)/);

console.log('Body Cues static-first regression checks passed.');
