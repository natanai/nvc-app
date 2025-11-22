import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const needsDir = path.join(rootDir, 'needs');
const iconsDir = path.join(rootDir, 'icons', 'needs');
const cssOutputPath = path.join(rootDir, 'styles', 'needs-magnet-icons.css');

const deepTones = ['#0F0F12', '#15151A', '#1C1C22'];
const midTones = ['#323238', '#3C3C44', '#46464E'];
const lightTones = ['#BFC0C7', '#CACBD1', '#D7D8DD'];

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function lerp(a, b, t) {
  return a + (b - a) * clamp01(t);
}

function hexChannel(hex, index) {
  return parseInt(hex.slice(index, index + 2), 16);
}

function mix(hexA, hexB, t) {
  const a = hexA.replace('#', '').padEnd(6, '0');
  const b = hexB.replace('#', '').padEnd(6, '0');
  const r = Math.round(lerp(hexChannel(a, 0), hexChannel(b, 0), t));
  const g = Math.round(lerp(hexChannel(a, 2), hexChannel(b, 2), t));
  const bChannel = Math.round(lerp(hexChannel(a, 4), hexChannel(b, 4), t));
  const toHex = (channel) => channel.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(bChannel)}`.toUpperCase();
}

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSlug(slug) {
  let hash = 0;
  for (const ch of slug) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return hash >>> 0;
}

function choose(array, rng) {
  return array[Math.floor(rng() * array.length) % array.length];
}

function jitter(base, spread, rng) {
  return base + (rng() * 2 - 1) * spread;
}

function softRing(seeds, colors) {
  const radius = 16 + seeds.rng() * 8;
  const strokeWidth = 1.8 + seeds.rng() * 1.2;
  const dash = 12 + seeds.rng() * 10;
  return `<circle cx="32" cy="32" r="${radius.toFixed(1)}" fill="none" stroke="${colors.frame}" stroke-width="${strokeWidth.toFixed(1)}" stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${dash.toFixed(1)}" opacity="0.82" />`;
}

function beam(seeds, colors) {
  const length = 10 + seeds.rng() * 14;
  const angle = jitter(0, 48, seeds.rng);
  const offset = 8 + seeds.rng() * 8;
  const x1 = 32 - offset;
  const x2 = 32 + offset;
  const y = 32 + jitter(0, 2, seeds.rng);
  return `<g transform="rotate(${angle.toFixed(1)} 32 32)"><line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x1 + length}" y2="${y.toFixed(1)}" stroke="${colors.stroke}" stroke-width="2.6" stroke-linecap="round" opacity="0.72" /><line x1="${x2.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2 - length}" y2="${y.toFixed(1)}" stroke="${colors.stroke}" stroke-width="2.6" stroke-linecap="round" opacity="0.72" /></g>`;
}

function anchor(seeds, colors) {
  const size = 8 + seeds.rng() * 6;
  const radius = 2 + seeds.rng() * 1.4;
  const rotation = jitter(0, 22, seeds.rng);
  const inset = 32 - size / 2;
  return `<rect x="${inset.toFixed(1)}" y="${inset.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" rx="${radius.toFixed(1)}" fill="${colors.fill}" opacity="0.66" transform="rotate(${rotation.toFixed(1)} 32 32)" />`;
}

function pulseDots(seeds, colors) {
  const count = 2 + Math.floor(seeds.rng() * 2);
  const dots = Array.from({ length: count }).map((_, idx) => {
    const distance = 12 + seeds.rng() * 10;
    const angle = seeds.rng() * Math.PI * 2;
    const x = 32 + Math.cos(angle) * distance;
    const y = 32 + Math.sin(angle) * distance;
    const r = 2 + seeds.rng() * 1.4;
    const opacity = 0.48 + idx * 0.08;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${colors.highlight}" opacity="${opacity.toFixed(2)}" />`;
  });
  return dots.join('');
}

function buildSvg(slug) {
  const seed = hashSlug(slug) || 1;
  const rng = mulberry32(seed);
  const seeds = { rng };

  const frame = choose(midTones, rng);
  const fill = mix(frame, choose(deepTones, rng), 0.35);
  const stroke = mix(frame, choose(deepTones, rng), 0.5);
  const highlight = choose(lightTones, rng);

  const pieces = [softRing(seeds, { frame }), beam(seeds, { stroke }), anchor(seeds, { fill }), pulseDots(seeds, { highlight })];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" role="img" aria-hidden="true">${pieces.join('')}</svg>\n`;
  return svg;
}

async function ensureDirectory(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function listNeedSlugs() {
  const entries = await fs.readdir(needsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'))
    .sort();
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
  const header = `/* Auto-generated by scripts/generate-need-icons.mjs */\n`;
  const baseRule = `.magnet[data-magnet-id^='needs-'] {\n  --magnet-icon: none;\n}\n\n`;
  const rules = slugs
    .map((slug) => `.magnet[data-magnet-id='needs-${slug}'] {\n  --magnet-icon: url('icons/needs/${slug}.svg');\n}\n`)
    .join('\n');
  await fs.writeFile(cssOutputPath, `${header}${baseRule}${rules}`, 'utf8');
}

async function main() {
  const slugs = await listNeedSlugs();
  await writeIcons(slugs);
  await writeCss(slugs);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
