import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const needsDir = path.join(rootDir, 'needs');
const iconsDir = path.join(rootDir, 'icons', 'needs');
const cssOutputPath = path.join(rootDir, 'styles', 'needs-magnet-icons.css');

const palette = [
  '#0A2C1C', // soil
  '#0B3B27',
  '#13633F',
  '#1F8757',
  '#2A9F69',
  '#49B982',
  '#63D89D',
  '#9CE4BF', // highlight
];

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

function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

const gridSize = 16;

function setCell(grid, x, y, color) {
  if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
  grid[y][x] = color;
}

function writeRect(grid, x, y, width, height, color) {
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      setCell(grid, x + dx, y + dy, color);
    }
  }
}

function symmetricalRect(grid, centerX, y, halfWidth, height, color) {
  const startX = centerX - halfWidth + 1;
  const width = halfWidth * 2;
  writeRect(grid, startX, y, width, height, color);
}

function derivePlantTheme(slug) {
  const random = mulberry32(hashSlug(slug));
  const stemColor = palette[randomInt(random, 2, 5)];
  const leafColor = palette[randomInt(random, 3, 6)];
  const bloomColor = palette[randomInt(random, 4, palette.length - 1)];
  const potColor = palette[randomInt(random, 0, 2)];
  const rimColor = palette[Math.max(0, randomInt(random, 1, 3) - 1)];
  const accentColor = palette[randomInt(random, 5, palette.length - 1)];
  return { stemColor, leafColor, bloomColor, potColor, rimColor, accentColor };
}

function addPot(grid, theme) {
  const potHeight = 3;
  const potWidth = 10;
  const potTopY = gridSize - potHeight - 1;
  const potStartX = Math.floor((gridSize - potWidth) / 2);
  writeRect(grid, potStartX, potTopY + 1, potWidth, potHeight - 1, theme.potColor);
  writeRect(grid, potStartX, potTopY, potWidth, 1, theme.rimColor);
  return potTopY;
}

function addStem(grid, potTopY, theme, random) {
  const stemHeight = randomInt(random, 6, 9);
  const centerX = 7;
  const stemTopY = Math.max(1, potTopY - stemHeight);
  symmetricalRect(grid, centerX, stemTopY, 1, stemHeight, theme.stemColor);
  return { stemTopY, centerX };
}

function addLeaves(grid, stemTopY, potTopY, centerX, theme, random) {
  const leaves = randomInt(random, 3, 5);
  for (let i = 0; i < leaves; i += 1) {
    const leafHeight = randomInt(random, 1, 2);
    const leafWidth = randomInt(random, 2, 3);
    const y = randomInt(random, stemTopY + 1, potTopY - 2);
    const direction = i % 2 === 0 ? -1 : 1;
    const startX = centerX + (direction === -1 ? -leafWidth : 1);
    writeRect(grid, startX, y, leafWidth, leafHeight, theme.leafColor);
    setCell(grid, centerX, y + leafHeight, theme.stemColor);
  }
}

const bloomPatterns = [
  [
    [0, 0],
    [0, 1],
    [-1, 1],
    [1, 1],
    [-1, 2],
    [0, 2],
    [1, 2],
  ], // bud
  [
    [0, 0],
    [-1, 1],
    [1, 1],
    [-2, 2],
    [0, 2],
    [2, 2],
    [-1, 3],
    [1, 3],
  ], // wide bloom
  [
    [0, 0],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [0, 2],
    [0, 3],
  ], // vertical torch
];

function addBloom(grid, stemTopY, centerX, theme, random) {
  const pattern = bloomPatterns[randomInt(random, 0, bloomPatterns.length - 1)];
  const bloomTop = Math.max(0, stemTopY - 2);
  for (const [dx, dy] of pattern) {
    setCell(grid, centerX + dx, bloomTop + dy, theme.bloomColor);
  }

  const sparkleCount = randomInt(random, 1, 2);
  for (let i = 0; i < sparkleCount; i += 1) {
    const sx = centerX + randomInt(random, -2, 2);
    const sy = Math.max(0, bloomTop - randomInt(random, 1, 2));
    setCell(grid, sx, sy, theme.accentColor);
  }
}

function buildGrid(slug) {
  const random = mulberry32(hashSlug(slug));
  const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
  const theme = derivePlantTheme(slug);

  const potTopY = addPot(grid, theme);
  const { stemTopY, centerX } = addStem(grid, potTopY, theme, random);
  addLeaves(grid, stemTopY, potTopY, centerX, theme, random);
  addBloom(grid, stemTopY, centerX, theme, random);

  return { grid, theme };
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

function gridToRects(grid) {
  const cell = 2;
  const rects = [];

  for (let y = 0; y < grid.length; y += 1) {
    let x = 0;
    while (x < grid[y].length) {
      const color = grid[y][x];
      if (!color) {
        x += 1;
        continue;
      }

      let x2 = x + 1;
      while (x2 < grid[y].length && grid[y][x2] === color) {
        x2 += 1;
      }

      rects.push({
        x: x * cell,
        y: y * cell,
        width: (x2 - x) * cell,
        height: cell,
        color,
      });
      x = x2;
    }
  }

  return rects;
}

function iconMarkup(slug) {
  const { grid } = buildGrid(slug);
  const rects = gridToRects(grid);
  const rectMarkup = rects
    .map((rect) => `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${rect.color}"/>`)
    .join('\n  ');

  return `<svg width="64" height="64" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">\n  ${rectMarkup}\n</svg>`;
}

function colorForSlug(slug) {
  const { theme } = buildGrid(slug);
  return theme.bloomColor;
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
  const baseRule = ".magnet[data-magnet-id^='needs-'],\nmain[data-need-slug] {\n  --need-icon: none;\n  --need-icon-visible: 0;\n  --need-icon-color: #000;\n}\n\n";
  const rules = slugs
    .map((slug) => `.magnet[data-magnet-id='needs-${slug}'],\nmain[data-need-slug='${slug}'] {\n  --need-icon: url('icons/needs/${slug}.svg');\n  --need-icon-visible: 1;\n  --need-icon-color: ${colorForSlug(slug)};\n}\n`)
    .join('\n');
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
