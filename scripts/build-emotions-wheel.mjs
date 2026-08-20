import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const scaffoldPath = join(rootDir, 'feelings', 'calm', 'index.html');
const outputPath = join(rootDir, 'feelings', 'emotions-wheel', 'index.html');

const DESCRIPTION = 'Explore a static, interactive emotions wheel linked to the feelings and faux-feelings already supported by allneeds.app.';
const CANONICAL = 'https://allneeds.app/feelings/emotions-wheel/';

const baseGroups = [
  {
    label: 'Joyful', href: '../joyful/', color: '#b5df8c',
    ring2: [
      ['Excited', '../excited/'], ['Inspired', '../inspired/'], ['Calm', '../calm/'], ['Hopeful', '../hopeful/'],
    ],
    ring3: [
      ['Thrilled', '../excited/'], ['Eager', '../excited/'], ['Creative', '../inspired/'], ['Moved', '../inspired/'],
      ['Relaxed', '../relaxed/'], ['Peaceful', '../peaceful/'], ['Optimistic', '../hopeful/'], ['Confident', '../proud/'],
    ],
  },
  {
    label: 'Sad', href: '../sad/', color: '#b7c1f0',
    ring2: [
      ['Hurt', '../hurt/'], ['Lonely', '../lonely/'], ['Powerless', '../powerless/'], ['Disappointment', '../disappointment/'],
    ],
    ring3: [
      ['Wounded', '../hurt/'], ['In pain', '../in-pain/'], ['Isolated', '../../faux-feelings/isolated/'], ['Unseen', '../../faux-feelings/unseen/'],
      ['Helpless', '../helpless/'], ['Hopeless', '../desperation/'], ['Blue', '../sad/'], ['Regretful', '../disappointment/'],
    ],
  },
  {
    label: 'Angry', href: '../angry/', color: '#f4a4be',
    ring2: [
      ['Frustrated', '../frustrated/'], ['Upset', '../upset/'], ['Irritated', '../irritated/'], ['Enraged', '../enraged/'],
    ],
    ring3: [
      ['Annoyed', '../frustrated/'], ['Thwarted', '../thwarted/'], ['Distressed', '../distressed/'], ['Resentful', '../resentful/'],
      ['Agitated', '../agitated/'], ['Hostile', '../hostile/'], ['Mad', '../angry/'], ['Antagonistic', '../antagonistic/'],
    ],
  },
  {
    label: 'Scared', href: '../scared/', color: '#f6c48f',
    ring2: [
      ['Fear', '../fear/'], ['Anxious', '../anxious/'], ['Frightened', '../frightened/'], ['Terrified', '../terrified/'],
    ],
    ring3: [
      ['Alarmed', '../alarmed/'], ['Worried', '../fear/'], ['Tense', '../tense/'], ['Overwhelmed', '../overwhelmed/'],
      ['Uneasy', '../anxiety/'], ['Unsafe', '../../faux-feelings/threatened/'], ['Shaky', '../frightened/'], ['Panic', '../terrified/'],
    ],
  },
  {
    label: 'Confused', href: '../confused/', color: '#92dad3',
    ring2: [
      ['Bewildered', '../bewildered/'], ['Embarrassed', '../embarrassed/'], ['Shocked', '../../faux-feelings/threatened/'], ['Misunderstood', '../../faux-feelings/misunderstood/'],
    ],
    ring3: [
      ['Perplexed', '../bewildered/'], ['Unsure', '../confused/'], ['Ashamed', '../embarrassed/'], ['Self-conscious', '../embarrassed/'],
      ['Startled', '../../faux-feelings/threatened/'], ['Unsteady', '../overwhelmed/'], ['Overlooked', '../../faux-feelings/unheard/'], ['Dismissed', '../../faux-feelings/discounted-diminished/'],
    ],
  },
];

const svgSize = 860;
const center = svgSize / 2;
const radii = { innerStart: 56, ring1End: 175, ring2End: 285, ring3End: 395 };

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function trimNumber(value) {
  return Number(value.toFixed(3)).toString();
}

function toPoint(radius, angle) {
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
}

function ringSlicePath(innerRadius, outerRadius, startAngle, endAngle) {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const p1 = toPoint(outerRadius, startAngle);
  const p2 = toPoint(outerRadius, endAngle);
  const p3 = toPoint(innerRadius, endAngle);
  const p4 = toPoint(innerRadius, startAngle);
  return [
    `M ${trimNumber(p1.x)} ${trimNumber(p1.y)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${trimNumber(p2.x)} ${trimNumber(p2.y)}`,
    `L ${trimNumber(p3.x)} ${trimNumber(p3.y)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${trimNumber(p4.x)} ${trimNumber(p4.y)}`,
    'Z',
  ].join(' ');
}

function textTransform(radius, startAngle, endAngle) {
  const mid = (startAngle + endAngle) / 2;
  const point = toPoint(radius, mid);
  const degrees = (mid * 180) / Math.PI;
  const spin = degrees > 90 && degrees < 270 ? degrees + 180 : degrees;
  return `translate(${trimNumber(point.x)} ${trimNumber(point.y)}) rotate(${trimNumber(spin)})`;
}

function sliceMarkup({ label, href, color, innerRadius, outerRadius, start, end }) {
  const textRadius = (innerRadius + outerRadius) / 2;
  return `          <a href="${escapeHtml(href)}" class="wheel-slice-link" aria-label="${escapeHtml(label)}">
            <path class="wheel-slice-path" fill="${color}" d="${ringSlicePath(innerRadius, outerRadius, start, end)}"></path>
            <text class="wheel-label" transform="${textTransform(textRadius, start, end)}">${escapeHtml(label)}</text>
          </a>`;
}

function renderWheel() {
  const slices = [];
  const baseSlice = (Math.PI * 2) / baseGroups.length;

  baseGroups.forEach((group, index) => {
    const groupStart = -Math.PI / 2 + index * baseSlice;
    const groupEnd = groupStart + baseSlice;
    slices.push(sliceMarkup({
      label: group.label,
      href: group.href,
      color: group.color,
      innerRadius: radii.innerStart,
      outerRadius: radii.ring1End,
      start: groupStart,
      end: groupEnd,
    }));

    const secondSlice = (groupEnd - groupStart) / group.ring2.length;
    group.ring2.forEach(([label, href], subIndex) => {
      const start = groupStart + secondSlice * subIndex;
      slices.push(sliceMarkup({
        label, href, color: group.color,
        innerRadius: radii.ring1End, outerRadius: radii.ring2End,
        start, end: start + secondSlice,
      }));
    });

    const outerSlice = (groupEnd - groupStart) / group.ring3.length;
    group.ring3.forEach(([label, href], outerIndex) => {
      const start = groupStart + outerSlice * outerIndex;
      slices.push(sliceMarkup({
        label, href, color: group.color,
        innerRadius: radii.ring2End, outerRadius: radii.ring3End,
        start, end: start + outerSlice,
      }));
    });
  });

  return `<svg viewBox="0 0 ${svgSize} ${svgSize}" role="img" aria-label="Interactive emotion and feeling wheel" xmlns="http://www.w3.org/2000/svg">
${slices.join('\n')}
          <circle cx="${center}" cy="${center}" r="${radii.innerStart - 1}" class="wheel-center"></circle>
          <text class="wheel-center-text" x="${center}" y="${center + 5}">Feelings</text>
        </svg>`;
}

const wheelStyles = `    <style>
      .wheel-page { gap: 1rem; }
      .wheel-header { display: grid; gap: 0.6rem; }
      .wheel-shell {
        border: 2px solid color-mix(in srgb, var(--outline) 28%, transparent);
        border-radius: var(--radius-2xl);
        padding: clamp(0.45rem, 2vw, 1rem);
        background: color-mix(in srgb, #ffffff 84%, var(--lavender));
        overflow: hidden;
      }
      .emotion-wheel { width: min(100%, 900px); margin: 0 auto; aspect-ratio: 1; }
      .emotion-wheel svg { display: block; width: 100%; height: 100%; }
      .wheel-slice-path { stroke: #ffffff; stroke-width: 1.5; transition: filter 140ms ease; }
      .wheel-slice-link:hover .wheel-slice-path,
      .wheel-slice-link:focus .wheel-slice-path,
      .wheel-slice-link:focus-visible .wheel-slice-path { filter: brightness(1.06) saturate(1.15); }
      .wheel-slice-link:focus-visible { outline: none; }
      .wheel-label {
        fill: var(--ink); font-size: 10px; font-weight: 600;
        text-anchor: middle; dominant-baseline: middle; pointer-events: none;
      }
      .wheel-center {
        fill: color-mix(in srgb, #ffffff 80%, var(--rose));
        stroke: color-mix(in srgb, var(--outline) 30%, transparent); stroke-width: 1.25;
      }
      .wheel-center-text { fill: var(--ink); font-size: 16px; font-weight: 700; text-anchor: middle; }
      .wheel-help { margin: 0.85rem 0 0; color: var(--ink-soft); font-size: 0.88rem; text-align: center; }
      @media (max-width: 640px) {
        .wheel-shell { margin-inline: -0.35rem; }
        .wheel-label { font-size: 9.5px; }
        .wheel-help { font-size: 0.8rem; }
      }
    </style>`;

const breadcrumb = `      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="../../">Home</a></li>
          <li><a href="../">Feelings</a></li>
          <li aria-current="page">Emotions wheel</li>
        </ol>
      </nav>`;

const main = `      <main id="main" class="page wheel-page" role="main">
        <header class="page-header wheel-header">
          <h1 class="page-title">Interactive emotions wheel</h1>
          <p class="page-description">Explore groups of related feelings. Every segment links to an existing allneeds feeling or faux-feeling page.</p>
        </header>
        <section class="wheel-shell" aria-label="Emotion and feeling wheel">
          <div class="emotion-wheel">${renderWheel()}</div>
          <p class="wheel-help">Outer-ring synonyms route to the closest supported allneeds entry.</p>
        </section>
      </main>`;

let html = readFileSync(scaffoldPath, 'utf8');

const replacements = [
  [/<title>[\s\S]*?<\/title>/, '<title>emotions wheel • allneeds.app</title>'],
  [/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${DESCRIPTION}" />`],
  [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${CANONICAL}" />`],
  [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${CANONICAL}" />`],
  [/<meta property="og:title" content="[^"]*" \/>/, '<meta property="og:title" content="emotions wheel • allneeds.app" />'],
  [/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${DESCRIPTION}" />`],
  [/<meta name="twitter:title" content="[^"]*" \/>/, '<meta name="twitter:title" content="emotions wheel • allneeds.app" />'],
  [/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${DESCRIPTION}" />`],
  [/<meta name="twitter:url" content="[^"]*" \/>/, `<meta name="twitter:url" content="${CANONICAL}" />`],
  [/<nav class="breadcrumbs" aria-label="Breadcrumb">[\s\S]*?<\/nav>/, breadcrumb],
  [/<main id="main"[\s\S]*?<\/main>/, main],
];

for (const [pattern, replacement] of replacements) {
  if (!pattern.test(html)) {
    throw new Error(`Emotions wheel scaffold did not match expected pattern: ${pattern}`);
  }
  html = html.replace(pattern, replacement);
}

html = html.replace(/\n\s*<script src="\.\.\/\.\.\/scripts\/feeling-reverse-inference\.js" type="module"><\/script>/, '');
html = html.replace('  </head>', `${wheelStyles}\n  </head>`);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html);
console.log(`Generated ${outputPath}`);
