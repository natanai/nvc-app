import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(source, label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one source match, found ${count}`);
  }
  return source.replace(before, after);
}

const compilerPath = 'scripts/build-pages.mjs';
let compiler = readFileSync(compilerPath, 'utf8');

compiler = replaceOnce(
  compiler,
  'add deterministic hub decoration owner',
  "const NAV_MAGNET_STORAGE_KEY = 'site-nav';\n\nconst magnetPrefillScript = (storageKey) => String.raw`",
  `const NAV_MAGNET_STORAGE_KEY = 'site-nav';
const HUB_MAGNET_TILT_OPTIONS = [-2, -1, 0, 1, 2];
const HUB_MAGNET_OFFSET_OPTIONS = [-3, -2, -1, 0, 1, 2, 3];

const stableHubMagnetDecorationStyle = (magnetId) => {
  let hash = 2166136261;
  const value = String(magnetId || '');
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const tilt = HUB_MAGNET_TILT_OPTIONS[hash % HUB_MAGNET_TILT_OPTIONS.length];
  const offsetHash = Math.imul(hash ^ 0x9e3779b9, 2654435761) >>> 0;
  const offset = HUB_MAGNET_OFFSET_OPTIONS[offsetHash % HUB_MAGNET_OFFSET_OPTIONS.length];
  return \`--magnet-tilt: \${tilt}deg; --magnet-offset: \${offset}px;\`;
};

const magnetPrefillScript = (storageKey, includeDecoration = false) => String.raw\``,
);

compiler = replaceOnce(
  compiler,
  'make hub prepaint transform visually final without changing nav output',
  "            el.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';",
  `${'${includeDecoration'}
              ? "            el.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) translateY(calc(var(--magnet-offset, 0px) + var(--magnet-hover-offset, 0px))) rotate(var(--magnet-tilt, 0))';"
              : "            el.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';"}`,
);

compiler = replaceOnce(
  compiler,
  'author stable hub decoration in markup',
  `  const magnets = items
  .map((item) => {
    const label = escapeHtml(item.title);
    return \`<a class="pill magnet" data-magnet-id="\${type}-\${item.slug}" href="\${item.slug}/"><span class="magnet__label">\${label}</span></a>\`;
  })
  .join('');`,
  `  const magnets = items
  .map((item) => {
    const label = escapeHtml(item.title);
    const magnetId = \`\${type}-\${item.slug}\`;
    const decorationStyle = stableHubMagnetDecorationStyle(magnetId);
    return \`<a class="pill magnet" data-magnet-id="\${magnetId}" style="\${decorationStyle}" href="\${item.slug}/"><span class="magnet__label">\${label}</span></a>\`;
  })
  .join('');`,
);

compiler = replaceOnce(
  compiler,
  'enable visually final prepaint for generated hubs',
  "${magnetPrefillScript(type + '-hub-v4')}",
  "${magnetPrefillScript(type + '-hub-v4', true)}",
);

writeFileSync(compilerPath, compiler);

const runtimePath = 'scripts/magnets.js';
let runtime = readFileSync(runtimePath, 'utf8');
runtime = replaceOnce(
  runtime,
  'preserve compiler-authored hub decoration through hydration',
  `const applyMagnetDecorations = (element, index) => {
  element.classList.add('magnet');
  element.style.order = String(index);
  const tilt = randomFrom(TILT_OPTIONS);
  const offset = randomFrom(OFFSET_OPTIONS);
  element.style.setProperty('--magnet-tilt', \`\${tilt}deg\`);
  element.style.setProperty('--magnet-offset', \`\${offset}px\`);
};`,
  `const applyMagnetDecorations = (element, index) => {
  element.classList.add('magnet');
  element.style.order = String(index);
  if (!element.style.getPropertyValue('--magnet-tilt').trim()) {
    const tilt = randomFrom(TILT_OPTIONS);
    element.style.setProperty('--magnet-tilt', \`\${tilt}deg\`);
  }
  if (!element.style.getPropertyValue('--magnet-offset').trim()) {
    const offset = randomFrom(OFFSET_OPTIONS);
    element.style.setProperty('--magnet-offset', \`\${offset}px\`);
  }
};`,
);
writeFileSync(runtimePath, runtime);

const stylesPath = 'styles.css';
let styles = readFileSync(stylesPath, 'utf8');
styles = replaceOnce(
  styles,
  'disable fixed document background on coarse touch pointers',
  `@media (hover: hover) and (pointer: fine) {
  html {
    scrollbar-gutter: stable;
  }
}
`,
  `@media (hover: hover) and (pointer: fine) {
  html {
    scrollbar-gutter: stable;
  }
}

@media (hover: none) and (pointer: coarse) {
  html {
    /* Fixed root backgrounds can force expensive full-page recompositing during
       momentum scrolling on mobile browsers. Keep the same gradient but let it
       move with the document on touch-first devices. */
    background-attachment: scroll;
  }
}
`,
);
styles = replaceOnce(
  styles,
  'stabilize feeling illustration paint layer',
  `  opacity: 0.9;
  pointer-events: none;
  z-index: 0;
  mix-blend-mode: normal;
}`,
  `  opacity: 0.9;
  pointer-events: none;
  z-index: 0;
  mix-blend-mode: normal;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  transform: translateZ(0);
}`,
);
writeFileSync(stylesPath, styles);

const workerPath = 'service-worker.js';
let worker = readFileSync(workerPath, 'utf8');
worker = replaceOnce(
  worker,
  'advance static cache version for magnet rendering repair',
  "const CACHE_VERSION = 'bedrock-v1';",
  "const CACHE_VERSION = 'bedrock-v2';",
);
writeFileSync(workerPath, worker);
