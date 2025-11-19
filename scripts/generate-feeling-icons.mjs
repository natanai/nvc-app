import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const feelingsDir = path.join(rootDir, 'feelings');
const iconsDir = path.join(rootDir, 'icons', 'feelings');
const cssOutputPath = path.join(rootDir, 'styles', 'feelings-magnet-icons.css');

const basePalette = [
  '#392351',
  '#2F2A57',
  '#1F1230',
  '#4B2E5E',
  '#2E4C4F',
  '#324A68',
  '#533F66',
  '#274053',
  '#4C2B3F',
];

const accentPalette = [
  '#FFB3CB',
  '#96FBC7',
  '#F7FFAE',
  '#D3F1FF',
  '#FF9F6E',
  '#68C7FF',
  '#FFD166',
  '#8F6FE5',
  '#EC92FF',
  '#5ED9C7',
  '#FFCF9F',
  '#C4E9FF',
];

function lighten(hex, amount) {
  const value = hex.replace('#', '').trim();
  const normalized = value.length === 3
    ? value.split('').map((ch) => ch + ch).join('')
    : value.padEnd(6, '0');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const lightenChannel = (channel) => Math.min(255, Math.round(channel + (255 - channel) * amount));
  const toHex = (channel) => channel.toString(16).padStart(2, '0');
  return `#${toHex(lightenChannel(r))}${toHex(lightenChannel(g))}${toHex(lightenChannel(b))}`.toUpperCase();
}

function hashSlug(slug) {
  let hash = 0;
  for (const ch of slug) {
    hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  }
  return hash >>> 0;
}

function pickColor(palette, index, avoid) {
  let choice = palette[index % palette.length];
  let attempts = 0;
  while (avoid && avoid.includes(choice) && attempts < palette.length) {
    index += 1;
    choice = palette[index % palette.length];
    attempts += 1;
  }
  return choice;
}

const shapeGenerators = [
  (colors, seeds) => {
    const radius = 16 + (seeds.primary % 6);
    return `<circle cx="32" cy="32" r="${radius}" fill="${colors.accent}" opacity="0.82" />`;
  },
  (colors, seeds) => {
    const size = 22 + (seeds.primary % 12);
    const radius = 6 + (seeds.secondary % 6);
    const rotation = (seeds.tertiary % 120) - 60;
    const x = 32 - size / 2;
    const y = 32 - size / 2;
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size}" height="${size}" rx="${radius}" fill="${colors.accent}" opacity="0.8" transform="rotate(${rotation} 32 32)" />`;
  },
  (colors, seeds) => {
    const top = 14 + (seeds.primary % 8);
    const bottom = 50 - (seeds.secondary % 6);
    const left = 16 + (seeds.tertiary % 6);
    const right = 48 - (seeds.quaternary % 6);
    return `<polygon points="32 ${top} ${right} ${bottom} ${left} ${bottom}" fill="${colors.accent}" opacity="0.78" />`;
  },
  (colors, seeds) => {
    const rx = 12 + (seeds.primary % 8);
    const ry = 18 + (seeds.secondary % 8);
    const rotation = (seeds.tertiary % 90) - 45;
    return `<ellipse cx="32" cy="32" rx="${rx}" ry="${ry}" fill="${colors.accent}" opacity="0.8" transform="rotate(${rotation} 32 32)" />`;
  },
  (colors, seeds) => {
    const height = 30 + (seeds.secondary % 12);
    const width = 18 + (seeds.primary % 10);
    const rotation = (seeds.tertiary % 100) - 50;
    const x = 32 - width / 2;
    const y = 32 - height / 2;
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width}" height="${height}" rx="${width / 2}" fill="${colors.accent}" opacity="0.78" transform="rotate(${rotation} 32 32)" />`;
  },
  (colors, seeds) => {
    const rotation = (seeds.secondary % 140) - 70;
    return `<path d="M${22 + (seeds.primary % 6)} ${18 + (seeds.secondary % 6)}C${26 + (seeds.primary % 10)} ${12 + (seeds.tertiary % 8)}, ${46 - (seeds.secondary % 10)} ${20 + (seeds.tertiary % 10)}, ${42 - (seeds.primary % 6)} ${34 + (seeds.secondary % 6)}C${38 - (seeds.primary % 8)} ${44 - (seeds.secondary % 8)}, ${24 + (seeds.tertiary % 8)} ${46 - (seeds.primary % 8)}, ${20 + (seeds.secondary % 6)} ${36 + (seeds.tertiary % 6)}Z" fill="${colors.accent}" opacity="0.82" transform="rotate(${rotation} 32 32)" />`;
  },
];

const overlayGenerators = [
  (colors, seeds) => {
    const radius = 12 + (seeds.secondary % 6);
    const dash1 = 5 + (seeds.primary % 5);
    const dash2 = 3 + (seeds.tertiary % 4);
    return `<circle cx="32" cy="32" r="${radius}" fill="none" stroke="${colors.detail}" stroke-width="2.4" stroke-dasharray="${dash1} ${dash2}" opacity="0.78" />`;
  },
  (colors, seeds) => {
    const startX = 18 + (seeds.primary % 8);
    const endX = 46 - (seeds.secondary % 8);
    const height = 24 + (seeds.tertiary % 8);
    return `<path d="M${startX} ${height}C${24 + (seeds.primary % 10)} ${12 + (seeds.secondary % 10)}, ${40 - (seeds.tertiary % 10)} ${12 + (seeds.quaternary % 10)}, ${endX} ${height}" fill="none" stroke="${colors.detail}" stroke-width="2.6" stroke-linecap="round" opacity="0.74" />`;
  },
  (colors, seeds) => {
    const x1 = 20 + (seeds.primary % 12);
    const y1 = 44 - (seeds.secondary % 10);
    const x2 = 44 - (seeds.secondary % 12);
    const y2 = 20 + (seeds.tertiary % 10);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors.detail}" stroke-width="2.8" stroke-linecap="round" opacity="0.68" />`;
  },
  (colors, seeds) => {
    const offset = 26 + (seeds.primary % 8);
    return `<path d="M${22 + (seeds.secondary % 6)} ${offset}q10 ${-12 - (seeds.primary % 6)} 20 0" fill="none" stroke="${colors.detail}" stroke-width="2.4" stroke-linecap="round" opacity="0.76" />`;
  },
  (colors, seeds) => {
    const p1x = 18 + (seeds.primary % 8);
    const p1y = 30 + (seeds.secondary % 6);
    const p2x = 26 + (seeds.secondary % 6);
    const p2y = 20 + (seeds.tertiary % 6);
    const p3x = 34 + (seeds.primary % 6);
    const p3y = 38 - (seeds.secondary % 6);
    const p4x = 42 + (seeds.tertiary % 4);
    const p4y = 28 + (seeds.primary % 6);
    return `<polyline points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}" fill="none" stroke="${colors.detail}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />`;
  },
];

const accentGenerators = [
  (colors, seeds) => {
    const cx = 24 + (seeds.primary % 16);
    const cy = 20 + (seeds.secondary % 18);
    const r = 4 + (seeds.tertiary % 4);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${colors.highlight}" opacity="0.85" />`;
  },
  (colors, seeds) => {
    const radius = 10 + (seeds.secondary % 6);
    return `<path d="M${28 + (seeds.primary % 6)} ${18 + (seeds.secondary % 6)}a${radius} ${radius} 0 1 1 -8 ${16 + (seeds.tertiary % 8)}" fill="none" stroke="${colors.highlight}" stroke-width="2.1" opacity="0.72" />`;
  },
  (colors, seeds) => {
    const cx1 = 20 + (seeds.primary % 12);
    const cy1 = 44 - (seeds.secondary % 10);
    const r1 = 3 + (seeds.tertiary % 3);
    const cx2 = 44 - (seeds.secondary % 10);
    const cy2 = 20 + (seeds.primary % 10);
    const r2 = 2 + (seeds.quaternary % 3);
    return `<circle cx="${cx1}" cy="${cy1}" r="${r1}" fill="${colors.highlight}" opacity="0.78" /><circle cx="${cx2}" cy="${cy2}" r="${r2}" fill="${colors.highlight}" opacity="0.65" />`;
  },
  (colors, seeds) => {
    const startY = 28 + (seeds.secondary % 8);
    return `<path d="M${24 + (seeds.primary % 8)} ${startY}c4 ${-6 + (seeds.tertiary % 6)} 12 ${6 + (seeds.secondary % 6)} 16 0" fill="none" stroke="${colors.highlight}" stroke-width="2" stroke-linecap="round" opacity="0.78" />`;
  },
];

async function ensureDirectory(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function listFeelingSlugs() {
  const entries = await fs.readdir(feelingsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'))
    .sort();
}

function buildSvg(slug) {
  const hash = hashSlug(slug);
  const seeds = {
    primary: hash & 0xff,
    secondary: (hash >>> 8) & 0xff,
    tertiary: (hash >>> 16) & 0xff,
    quaternary: (hash >>> 24) & 0xff,
  };

  const baseColor = pickColor(basePalette, hash, []);
  const accentColor = pickColor(accentPalette, hash >>> 3, [baseColor]);
  const detailColor = pickColor(accentPalette, hash >>> 5, [baseColor, accentColor]);
  const highlightColor = lighten(detailColor, 0.35);

  const shape = shapeGenerators[hash % shapeGenerators.length];
  const overlay = overlayGenerators[(hash >>> 7) % overlayGenerators.length];
  const accent = accentGenerators[(hash >>> 11) % accentGenerators.length];

  const body = [
    `<circle cx="32" cy="32" r="28" fill="none" stroke="${baseColor}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />`,
    shape({ accent: accentColor }, seeds),
    overlay({ detail: detailColor }, seeds),
    accent({ highlight: highlightColor }, seeds),
  ]
    .filter(Boolean)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" role="img" aria-hidden="true">${body}</svg>\n`;
}

async function writeIcons(slugs) {
  await ensureDirectory(iconsDir);
  await Promise.all(
    slugs.map(async (slug) => {
      const svg = buildSvg(slug);
      const filePath = path.join(iconsDir, `${slug}.svg`);
      await fs.writeFile(filePath, svg, 'utf8');
    })
  );
}

async function writeCss(slugs) {
  const header = `/* Auto-generated by scripts/generate-feeling-icons.mjs */\n`;
  const baseRule = `.magnet[data-magnet-id^='feelings-'] {\n  --magnet-icon: none;\n}\n\n`;
  const rules = slugs
    .map((slug) => `.magnet[data-magnet-id='feelings-${slug}'] {\n  --magnet-icon: url('icons/feelings/${slug}.svg');\n}\n`)
    .join('\n');
  await fs.writeFile(cssOutputPath, `${header}${baseRule}${rules}`, 'utf8');
}

async function main() {
  const slugs = await listFeelingSlugs();
  await writeIcons(slugs);
  await writeCss(slugs);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
