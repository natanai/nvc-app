const fs = require('fs');
const path = require('path');

const needsDir = path.join(__dirname, '..', 'needs');
const iconsDir = path.join(__dirname, '..', 'icons', 'needs');

const keywords = {
  ascend: ['autonomy', 'freedom', 'choice', 'choose', 'act-freely', 'empowerment', 'self-expression', 'growth', 'space', 'accomplishment', 'causality', 'participation', 'contribution', 'accomplishment', 'mattering'],
  embrace: ['belonging', 'connection', 'community', 'closeness', 'friendship', 'support', 'mutuality', 'love', 'caring', 'nurturing', 'inclusion', 'consideration', 'empathy', 'appreciation', 'peace', 'serenity', 'calm', 'rest', 'relaxation', 'acceptance'],
  grounded: ['safety', 'security', 'predictability', 'reliability', 'dependability', 'accountability', 'consistency', 'order', 'predictability', 'stability', 'commitment', 'trust'],
  clarity: ['clarity', 'understanding', 'honesty', 'integrity', 'justice', 'fairness', 'honor', 'respect', 'authenticity', 'transparency', 'recognition']
};

const presets = {
  ascend: { points: 9, noise: 0.26, stretchX: 0.92, stretchY: 1.2, bias: 'upper', smooth: true, lean: -2 },
  embrace: { points: 8, noise: 0.18, stretchX: 0.98, stretchY: 1.05, bias: 'center', smooth: true, lean: 0 },
  grounded: { points: 7, noise: 0.16, stretchX: 1.08, stretchY: 0.9, bias: 'lower', smooth: false, lean: 0 },
  clarity: { points: 6, noise: 0.12, stretchX: 1, stretchY: 1, bias: 'balanced', smooth: false, lean: 0 },
  balanced: { points: 8, noise: 0.2, stretchX: 1, stretchY: 1, bias: 'balanced', smooth: true, lean: 0 }
};

function slugStyle(slug) {
  const lower = slug.toLowerCase();
  for (const [style, keys] of Object.entries(keywords)) {
    if (keys.some((k) => lower.includes(k))) return presets[style];
  }
  return presets.balanced;
}

function seedRandom(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i += 1) {
    h = (h << 5) - h + seedStr.charCodeAt(i);
    h |= 0;
  }
  return function rand() {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

function generatePoints(slug, preset) {
  const rand = seedRandom(slug);
  const points = [];
  const center = { x: 32 + preset.lean, y: 32 };
  const baseRadius = 18 + rand() * 6;
  const start = -Math.PI / 2 + rand() * 0.6 - 0.3;

  for (let i = 0; i < preset.points; i += 1) {
    const angle = start + (i / preset.points) * Math.PI * 2;
    const bias = (() => {
      switch (preset.bias) {
        case 'upper':
          return 1 + 0.2 * Math.cos(angle);
        case 'lower':
          return 1 - 0.18 * Math.cos(angle);
        case 'center':
          return 1 + 0.12 * Math.sin(angle * 2);
        default:
          return 1;
      }
    })();
    const radius = baseRadius * (1 + (rand() - 0.5) * preset.noise * 2) * bias;
    const x = center.x + Math.cos(angle) * radius * preset.stretchX;
    const y = center.y + Math.sin(angle) * radius * preset.stretchY;
    points.push({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
  }
  return points;
}

function buildPath(points, smooth) {
  if (!smooth) {
    const [first, ...rest] = points;
    const segments = rest.map((p) => `${p.x} ${p.y}`).join(' L ');
    return `M ${first.x} ${first.y} L ${segments} Z`;
  }

  const mids = points.map((point, i) => {
    const next = points[(i + 1) % points.length];
    return { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
  });

  let path = `M ${mids[0].x} ${mids[0].y}`;
  for (let i = 0; i < points.length; i += 1) {
    const ctrl = points[i];
    const end = mids[(i + 1) % mids.length];
    path += ` Q ${ctrl.x} ${ctrl.y} ${end.x} ${end.y}`;
  }
  return `${path} Z`;
}

function buildIcon(slug) {
  const preset = slugStyle(slug);
  const points = generatePoints(slug, preset);
  const path = buildPath(points, preset.smooth);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' aria-hidden='true'>\n  <path fill='black' d='${path}'/>\n</svg>\n`;
  return svg;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generateAll() {
  ensureDir(iconsDir);
  const entries = fs.readdirSync(needsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  entries.forEach((entry) => {
    const slug = entry.name;
    const svg = buildIcon(slug);
    const outPath = path.join(iconsDir, `${slug}.svg`);
    fs.writeFileSync(outPath, svg, 'utf8');
  });
}

generateAll();
