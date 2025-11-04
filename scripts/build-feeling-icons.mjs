import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify as fallbackSlugify } from '../lib/slugify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const dataPath = join(rootDir, 'data', 'index.json');
const outputDir = join(rootDir, 'icons', 'feelings');

const palettes = [
  { start: '#FDE68A', end: '#F97316', accent: '#38BDF8', stroke: '#2D0A3E' },
  { start: '#C8E6C9', end: '#81C784', accent: '#FFB74D', stroke: '#1B4332' },
  { start: '#BBDEFB', end: '#64B5F6', accent: '#EC407A', stroke: '#0F3D91' },
  { start: '#F8BBD0', end: '#F06292', accent: '#5C6BC0', stroke: '#7A1E4D' },
  { start: '#FFE0B2', end: '#FB8C00', accent: '#26C6DA', stroke: '#5C2B00' },
  { start: '#D1C4E9', end: '#9575CD', accent: '#4DD0E1', stroke: '#312A78' },
  { start: '#B2EBF2', end: '#4DD0E1', accent: '#FF8A65', stroke: '#005260' },
  { start: '#FFCCBC', end: '#FF7043', accent: '#4DB6AC', stroke: '#7C2800' },
  { start: '#DCEDC8', end: '#AED581', accent: '#7986CB', stroke: '#2E6B1F' },
  { start: '#F3E8FF', end: '#C4B5FD', accent: '#60A5FA', stroke: '#423075' },
];

const accentFactories = [
  (palette, hash) => {
    const radius = 6 + (hash % 4);
    const offsetX = 26 + (hash % 12);
    const offsetY = 18 + ((hash >> 4) % 10);
    const rightX = 72 + ((hash >> 7) % 18);
    const rightY = 34 + ((hash >> 9) % 12);
    const rightRadius = Math.max(4, radius - 2);
    const soft = lighten(palette.accent, 0.35);
    return `<g opacity="0.82">\n      <circle cx="${offsetX}" cy="${offsetY}" r="${radius}" fill="${palette.accent}" />\n      <circle cx="${rightX}" cy="${rightY}" r="${rightRadius}" fill="${soft}" />\n    </g>`;
  },
  (palette, hash) => {
    const baseY = 20 + (hash % 8);
    const gap = 6 + ((hash >> 3) % 4);
    const width = 84;
    const stroke = lighten(palette.accent, 0.1);
    const accent = darken(palette.accent, 0.05);
    return `<g opacity="0.78">\n      <path d="M18 ${baseY}h${width}" stroke="${accent}" stroke-width="${3 + (hash % 3)}" stroke-linecap="round" />\n      <path d="M18 ${baseY + gap}h${width}" stroke="${stroke}" stroke-width="${2 + ((hash >> 6) % 3)}" stroke-linecap="round" stroke-dasharray="6 ${4 + ((hash >> 8) % 6)}" />\n    </g>`;
  },
  (palette, hash) => {
    const peak = 14 + ((hash >> 5) % 8);
    const baseLeft = 24 + ((hash >> 7) % 8);
    const baseRight = 94 - ((hash >> 3) % 8);
    const accent = palette.accent;
    const soft = lighten(accent, 0.4);
    return `<path d="M${baseLeft} ${38 - peak * 0.25} Q ${(baseLeft + baseRight) / 2} ${peak}, ${baseRight} ${38 - peak * 0.25} L ${baseRight - 6} ${42 + peak * 0.15} Q ${(baseLeft + baseRight) / 2} ${46 + peak * 0.35}, ${baseLeft + 6} ${42 + peak * 0.15} Z" fill="${accent}" fill-opacity="0.68" stroke="${soft}" stroke-width="2" stroke-linejoin="round" />`;
  },
  (palette, hash) => {
    const startX = 24 + ((hash >> 4) % 10);
    const startY = 22 + ((hash >> 7) % 10);
    const length = 54 + ((hash >> 9) % 12);
    const angle = ((hash % 50) - 25) * (Math.PI / 180);
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    const accent = darken(palette.accent, 0.15);
    const glow = lighten(palette.accent, 0.45);
    return `<g opacity="0.65">\n      <path d="M${startX} ${startY} l${dx.toFixed(2)} ${dy.toFixed(2)}" stroke="${accent}" stroke-width="4" stroke-linecap="round" />\n      <path d="M${startX + 6} ${startY + 8} l${(dx * 0.7).toFixed(2)} ${(dy * 0.7).toFixed(2)}" stroke="${glow}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="5 ${3 + ((hash >> 11) % 5)}" />\n    </g>`;
  },
];

const sparkFactories = [
  (palette, hash) => {
    const base = darken(palette.end, 0.2);
    const start = 22 + ((hash >> 3) % 8);
    const width = 76;
    return `<path d="M18 ${start} C 36 ${start - 6}, 84 ${start - 6}, ${18 + width} ${start}" fill="none" stroke="${base}" stroke-width="3.5" stroke-linecap="round" opacity="0.35" />`;
  },
  (palette, hash) => {
    const highlight = lighten(palette.start, 0.5);
    const offset = ((hash >> 6) % 12) - 6;
    return `<path d="M${26 + offset} 16 C ${42 + offset} 12, ${78 + offset} 12, ${94 + offset} 18" fill="none" stroke="${highlight}" stroke-width="3" stroke-linecap="round" opacity="0.55" />`;
  },
  (palette, hash) => {
    const color = lighten(palette.accent, 0.55);
    const cx = 30 + ((hash >> 4) % 12);
    const cy = 40 + ((hash >> 8) % 8);
    return `<ellipse cx="${cx}" cy="${cy}" rx="${12 + (hash % 6)}" ry="${6 + ((hash >> 10) % 4)}" fill="${color}" fill-opacity="0.28" />`;
  },
];

function hashString(value) {
  let hash = 0;
  const stringValue = String(value || '');
  for (let i = 0; i < stringValue.length; i += 1) {
    hash = (hash << 5) - hash + stringValue.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '').trim();
  if (!normalized) {
    return { r: 0, g: 0, b: 0 };
  }
  const expanded = normalized.length === 3
    ? normalized.split('').map((ch) => ch + ch).join('')
    : normalized.padStart(6, '0').slice(0, 6);
  const intVal = parseInt(expanded, 16);
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
}

function rgbToHex({ r, g, b }) {
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`.toUpperCase();
}

function mix(colorA, colorB, amount = 0.5) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const ratio = Math.max(0, Math.min(1, amount));
  return rgbToHex({
    r: a.r * (1 - ratio) + b.r * ratio,
    g: a.g * (1 - ratio) + b.g * ratio,
    b: a.b * (1 - ratio) + b.b * ratio,
  });
}

function lighten(color, amount = 0.2) {
  return mix(color, '#FFFFFF', amount);
}

function darken(color, amount = 0.2) {
  return mix(color, '#000000', amount);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolvePalette(hash) {
  return palettes[hash % palettes.length];
}

function renderAccent(palette, hash) {
  const factory = accentFactories[hash % accentFactories.length];
  return factory(palette, hash >>> 2);
}

function renderSpark(palette, hash) {
  const factory = sparkFactories[hash % sparkFactories.length];
  return factory(palette, hash >>> 3);
}

function createSvgContent({ slug, title, palette, hash }) {
  const gradientId = `magnet-grad-${slug}`;
  const sheenId = `magnet-sheen-${slug}`;
  const highlightColor = lighten(palette.start, 0.45);
  const depthColor = darken(palette.end, 0.25);
  const rotation = (hash % 60) - 30;
  const accent = renderAccent(palette, hash);
  const spark = renderSpark(palette, hash);
  const decorative = `${accent}\n  ${spark}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60" role="img">\n  <title>${escapeXml(`Feeling magnet for ${title}`)}</title>\n  <desc>${escapeXml(`Decorative magnet illustration generated for the feeling “${title}”.`)}</desc>\n  <defs>\n    <linearGradient id="${gradientId}" x1="0" y1="0" x2="120" y2="60" gradientUnits="userSpaceOnUse" gradientTransform="rotate(${rotation} 60 30)">\n      <stop offset="0%" stop-color="${palette.start}" />\n      <stop offset="100%" stop-color="${palette.end}" />\n    </linearGradient>\n    <linearGradient id="${sheenId}" x1="24" y1="12" x2="96" y2="12" gradientUnits="userSpaceOnUse">\n      <stop offset="0%" stop-color="${highlightColor}" stop-opacity="0.85" />\n      <stop offset="100%" stop-color="${highlightColor}" stop-opacity="0" />\n    </linearGradient>\n  </defs>\n  <path d="M18 6h84a12 12 0 0 1 12 12v24a12 12 0 0 1-12 12H18A12 12 0 0 1 6 42V18A12 12 0 0 1 18 6Z" fill="url(#${gradientId})" stroke="${palette.stroke}" stroke-width="4" stroke-linejoin="round" />\n  <path d="M22 46c12 8 64 8 76 0" fill="none" stroke="${depthColor}" stroke-width="5" stroke-linecap="round" opacity="0.28" />\n  <path d="M24 18c10-6 62-6 72 0" fill="none" stroke="url(#${sheenId})" stroke-width="4" stroke-linecap="round" opacity="0.8" />\n  ${decorative}\n</svg>\n`;
}

function buildIcons() {
  let data;
  try {
    data = JSON.parse(readFileSync(dataPath, 'utf8'));
  } catch (error) {
    console.error('Unable to read feelings data from', dataPath);
    throw error;
  }
  const feelings = Array.isArray(data?.feelings) ? data.feelings : [];
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  let written = 0;
  const seen = new Set();

  for (const entry of feelings) {
    if (!entry) {
      continue;
    }
    const title = entry.title || entry.name || '';
    if (!title) {
      continue;
    }
    const rawSlug = (entry.slug || '').trim();
    const slug = (rawSlug || fallbackSlugify(title)).trim();
    if (!slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    const hash = hashString(slug);
    const palette = resolvePalette(hash);
    const svg = createSvgContent({ slug, title, palette, hash });
    const outputPath = join(outputDir, `${slug}.svg`);
    writeFileSync(outputPath, svg);
    written += 1;
  }

  console.log(`Generated ${written} feeling icon${written === 1 ? '' : 's'} in ${join('icons', 'feelings')}`);
}

buildIcons();
