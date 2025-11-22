import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const needsDir = path.join(rootDir, 'needs');
const iconsDir = path.join(rootDir, 'icons', 'needs');
const cssOutputPath = path.join(rootDir, 'styles', 'needs-magnet-icons.css');

function hashSlug(slug) {
  let hash = 0;
  for (const ch of slug) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let value = seed || 0;
  return () => {
    value |= 0;
    value = (value + 0x6D2B79F5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(random, min, max) {
  return min + random() * (max - min);
}

function randomInt(random, min, max) {
  return Math.floor(randomBetween(random, min, max + 1));
}

function leafPath(cx, cy, length, width) {
  const x1 = cx - width;
  const x2 = cx + width;
  const y1 = cy - length * 0.35;
  const y2 = cy - length * 0.7;
  const y3 = cy - length;
  return `M ${cx.toFixed(2)} ${cy.toFixed(2)} C ${x1.toFixed(2)} ${y1.toFixed(2)}, ${x1.toFixed(2)} ${y2.toFixed(2)}, ${cx.toFixed(2)} ${y3.toFixed(2)} C ${x2.toFixed(2)} ${y2.toFixed(2)}, ${x2.toFixed(2)} ${y1.toFixed(2)}, ${cx.toFixed(2)} ${cy.toFixed(2)} Z`;
}

function bloomMarkup(random, x, y) {
  const petals = randomInt(random, 4, 7);
  const size = randomBetween(random, 7, 11);
  const width = randomBetween(random, 3, 5.5);
  const rotationOffset = randomBetween(random, 0, Math.PI * 2);

  const petalsMarkup = Array.from({ length: petals }, (_, index) => {
    const angle = rotationOffset + (index / petals) * Math.PI * 2;
    const petalCx = x + Math.cos(angle) * (width * 0.3 + randomBetween(random, 0, 1.5));
    const petalCy = y + Math.sin(angle) * (width * 0.3 + randomBetween(random, 0, 1.5));
    const rotation = (angle * 180) / Math.PI + randomBetween(random, -10, 10);
    return `<path d="${leafPath(petalCx, petalCy, size, width)}" fill="#000" transform="rotate(${rotation.toFixed(2)} ${petalCx.toFixed(2)} ${petalCy.toFixed(2)})" />`;
  }).join('');

  const centerRadius = randomBetween(random, 2.4, 3.6);
  const center = `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${centerRadius.toFixed(2)}" fill="#000" />`;

  return `${petalsMarkup}${center}`;
}

function stemMarkup(random, baseX, baseY, height) {
  const sway = randomBetween(random, -6, 6);
  const controlOffset = randomBetween(random, -5, 5);
  const topX = baseX + sway;
  const topY = baseY - height;
  const c1x = baseX + controlOffset;
  const c1y = baseY - height * 0.35;
  const c2x = baseX + sway * 0.4;
  const c2y = baseY - height * 0.7;
  const path = `<path d="M ${baseX.toFixed(2)} ${baseY.toFixed(2)} C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${topX.toFixed(2)} ${topY.toFixed(2)}" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
  return { path, topX, topY };
}

function leavesMarkup(random, baseX, baseY, height, count) {
  return Array.from({ length: count }, () => {
    const progress = randomBetween(random, 0.25, 0.78);
    const cx = baseX + randomBetween(random, -5.5, 5.5);
    const cy = baseY - height * progress;
    const length = randomBetween(random, 9, 15);
    const width = randomBetween(random, 3.5, 6.5);
    const rotation = randomBetween(random, -50, 50);
    return `<path d="${leafPath(cx, cy, length, width)}" fill="#000" transform="rotate(${rotation.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})" />`;
  }).join('');
}

function groundMarkup(random) {
  const moundCount = randomInt(random, 1, 2);
  return Array.from({ length: moundCount }, () => {
    const cx = randomBetween(random, 24, 40);
    const rx = randomBetween(random, 10, 16);
    const ry = randomBetween(random, 3, 5.5);
    const cy = randomBetween(random, 53, 57);
    return `<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="#000" />`;
  }).join('');
}

function iconMarkup(slug) {
  const random = mulberry32(hashSlug(slug));
  const stemCount = randomInt(random, 2, 4);
  const ground = groundMarkup(random);

  const stems = Array.from({ length: stemCount }, () => {
    const baseX = randomBetween(random, 18, 46);
    const baseY = randomBetween(random, 54, 58);
    const height = randomBetween(random, 20, 32);
    const { path, topX, topY } = stemMarkup(random, baseX, baseY, height);
    const leaves = leavesMarkup(random, baseX, baseY, height, randomInt(random, 1, 3));
    const bloom = bloomMarkup(random, topX, topY - randomBetween(random, 0, 2));
    return `${path}${leaves}${bloom}`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-hidden="true">${ground}${stems}</svg>`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readNeedSlugs() {
  const entries = await fs.readdir(needsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== 'index.html')
    .sort((a, b) => a.localeCompare(b));
}

async function writeIcons(slugs) {
  await ensureDir(iconsDir);
  await Promise.all(slugs.map(async (slug) => {
    const markup = iconMarkup(slug);
    const iconPath = path.join(iconsDir, `${slug}.svg`);
    await fs.writeFile(iconPath, markup, 'utf8');
  }));
}

async function writeCss(slugs) {
  const baseRule = ".magnet[data-magnet-id^='needs-'],\nmain[data-need-slug] {\n  --need-icon: none;\n  --need-icon-visible: 0;\n}\n\n";
  const rules = slugs.map((slug) => `.magnet[data-magnet-id='needs-${slug}'],\nmain[data-need-slug='${slug}'] {\n  --need-icon: url('icons/needs/${slug}.svg');\n  --need-icon-visible: 1;\n}\n`).join('\n');
  const css = `/* Auto-generated by scripts/generate-need-icons.mjs */\n${baseRule}${rules}`;
  await fs.writeFile(cssOutputPath, css, 'utf8');
}

async function main() {
  const slugs = await readNeedSlugs();
  await writeIcons(slugs);
  await writeCss(slugs);
  console.log(`Generated ${slugs.length} need icons.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
