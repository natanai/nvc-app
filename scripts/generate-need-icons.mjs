import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const dataPath = path.join(rootDir, 'data', 'index.json');
const outputDir = path.join(rootDir, 'icons', 'needs');

function hashSlug(value) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function selectMotif(need) {
  const slug = need.slug.toLowerCase();
  const text = `${need.title} ${need.category}`.toLowerCase();

  const matchAny = (keywords) => keywords.some((keyword) => text.includes(keyword) || slug.includes(keyword));

  if (matchAny(['space', 'privacy', 'room'])) return 'space';
  if (matchAny(['rest', 'relax', 'ease', 'calm', 'serenity', 'peace'])) return 'rest';
  if (matchAny(['order', 'predictability', 'consistency', 'structure', 'causality'])) return 'order';
  if (matchAny(['clarity', 'understanding', 'integrity', 'honesty', 'authenticity', 'acknowledgement', 'recognition'])) {
    return 'clarity';
  }
  if (matchAny(['growth', 'learning', 'development', 'accomplishment', 'empower', 'flourish', 'fitness'])) return 'growth';
  if (matchAny(['contribution', 'impact', 'purpose', 'effectiveness', 'participation'])) return 'contribution';
  if (matchAny(['play', 'beauty'])) return 'play';
  if (matchAny(['safety', 'security', 'trust', 'dependability', 'reliability', 'stability'])) return 'safety';
  if (matchAny(['autonomy', 'freedom', 'choice', 'control', 'pace', 'self-expression'])) return 'autonomy';
  if (matchAny(['community', 'belonging', 'connection', 'mutuality', 'support', 'love', 'caring', 'friendship', 'mattering'])) {
    return 'belonging';
  }

  const categoryMap = {
    'love/caring': 'belonging',
    'community/belonging': 'belonging',
    'sustenance/health': 'safety',
    'empathy/understanding': 'clarity',
    'meaning/contribution': 'contribution',
    'safety/security': 'safety',
    'autonomy/freedom': 'autonomy',
    'beauty/peace/play': 'play',
    authenticity: 'clarity',
  };

  const categoryKey = (need.category || '').toLowerCase();
  return categoryMap[categoryKey] || 'belonging';
}

function branchingPath(seed) {
  const baseY = 50 + (seed % 6);
  const stemHeight = 18 + ((seed >> 3) % 12);
  const splitY = baseY - stemHeight;
  const spread = 12 + ((seed >> 5) % 8);
  const flare = 8 + ((seed >> 7) % 6);
  const trunk = 6 + ((seed >> 9) % 6);
  const offset = ((seed >> 11) % 5) - 2;
  const cx = 32 + offset;

  const leftTopX = cx - spread;
  const rightTopX = cx + spread;
  const tipY = clamp(splitY - flare, 6, 28);

  const points = [
    `M${cx - trunk / 2} ${baseY}`,
    `L${cx + trunk / 2} ${baseY}`,
    `L${cx + trunk} ${splitY + 4}`,
    `L${rightTopX + trunk / 2} ${splitY + 4}`,
    `L${rightTopX} ${tipY}`,
    `L${cx + trunk / 2} ${splitY + 6}`,
    `L${cx + trunk / 2} ${splitY - 2}`,
    `L${cx - trunk / 2} ${splitY - 2}`,
    `L${cx - trunk / 2} ${splitY + 6}`,
    `L${leftTopX} ${tipY}`,
    `L${leftTopX - trunk / 2} ${splitY + 4}`,
    `L${cx - trunk} ${splitY + 4}`,
    'Z',
  ];

  return points.join('');
}

function belongingPath(seed) {
  const outer = 24 + (seed % 5);
  const inner = outer - (8 + ((seed >> 3) % 5));
  const gap = 10 + ((seed >> 5) % 6);
  const gapOffset = 4 + ((seed >> 7) % 6);
  const cx = 32 + (((seed >> 9) % 5) - 2);
  const cy = 32 + (((seed >> 11) % 5) - 2);
  const gapStart = clamp(cx + outer - gap - gapOffset, 28, 40);

  const outerCircle = `M${cx} ${cy - outer}A${outer} ${outer} 0 1 1 ${cx - 0.1} ${cy - outer}Z`;
  const innerCircle = `M${cx} ${cy - inner}A${inner} ${inner} 0 1 0 ${cx - 0.1} ${cy - inner}Z`;
  const gapCut = `M${gapStart} ${cy - outer - 2}H64V${cy + outer + 2}H${gapStart}Z`;

  return { d: `${outerCircle}${innerCircle}${gapCut}`, fillRule: 'evenodd' };
}

function safetyPath(seed) {
  const baseY = 50 + (seed % 5);
  const topY = 28 - ((seed >> 3) % 4);
  const left = 10 + ((seed >> 5) % 6);
  const right = 54 - ((seed >> 7) % 6);
  const thickness = 8 + ((seed >> 9) % 4);

  return `M${left} ${baseY}Q32 ${topY} ${right} ${baseY}L${right} ${baseY + thickness}L${left} ${baseY + thickness}Z`;
}

function restPath(seed) {
  const upperY = 34 + (seed % 5);
  const lowerY = upperY + 8 + ((seed >> 3) % 5);
  const crest = 6 + ((seed >> 5) % 4);

  return [
    `M10 ${upperY}`,
    `Q22 ${upperY - crest} 32 ${upperY}`,
    `T54 ${upperY}`,
    `L54 ${lowerY}`,
    `Q42 ${lowerY + crest} 32 ${lowerY - 2}`,
    `T10 ${lowerY}`,
    'Z',
  ].join('');
}

function clarityPath(seed) {
  const top = 10 + (seed % 6);
  const base = 52 + ((seed >> 3) % 4);
  const spine = 9 + ((seed >> 5) % 4);
  const shoulder = 14 + ((seed >> 7) % 6);
  const neck = 22 + ((seed >> 9) % 4);

  const halfSpine = spine / 2;
  const halfShoulder = shoulder / 2;

  return [
    `M${32 - halfSpine} ${base}`,
    `H${32 + halfSpine}`,
    `L${32 + halfShoulder} ${neck}`,
    `L${32 + halfSpine} ${neck}`,
    `V${top}`,
    `H${32 - halfSpine}`,
    `V${neck}`,
    `L${32 - halfShoulder} ${neck}`,
    'Z',
  ].join('');
}

function orderPath(seed) {
  const baseY = 52 + (seed % 4);
  const step = 10 + ((seed >> 3) % 4);
  const left1 = 18 + ((seed >> 5) % 4);
  const right1 = 46 - ((seed >> 7) % 4);
  const left2 = left1 + 4;
  const right2 = right1 - 4;
  const left3 = left2 + 4;
  const right3 = right2 - 4;

  return [
    `M${left3} ${baseY - step * 2}H${right3}V${baseY - step}H${left3}Z`,
    `M${left2} ${baseY - step}H${right2}V${baseY}H${left2}Z`,
    `M${left1} ${baseY}H${right1}V${baseY + 6}H${left1}Z`,
  ].join('');
}

function growthPath(seed) {
  const top = 10 + (seed % 6);
  const base = 54 - ((seed >> 3) % 4);
  const flare = 14 + ((seed >> 5) % 6);
  const baseWidth = 8 + ((seed >> 7) % 5);

  const leftTop = clamp(32 - flare, 10, 26);
  const rightTop = clamp(32 + flare, 38, 54);
  const leftBase = 32 - baseWidth;
  const rightBase = 32 + baseWidth;

  return `M${leftBase} ${base}L${rightBase} ${base}L${rightTop} ${top + 2}Q32 ${top} ${leftTop} ${top + 2}Z`;
}

function playPath(seed) {
  const cx = 32;
  const cy = 32;
  const r1 = 12 + (seed % 6);
  const r2 = 8 + ((seed >> 3) % 6);
  const r3 = 6 + ((seed >> 5) % 5);

  return [
    `M${cx + r1} ${cy}`,
    `C${cx + r1} ${cy - r2} ${cx + r2} ${cy - r3} ${cx} ${cy - r1}`,
    `C${cx - r3} ${cy - r3} ${cx - r1} ${cy - r2} ${cx - r1} ${cy}`,
    `C${cx - r1} ${cy + r2} ${cx - r2} ${cy + r3} ${cx} ${cy + r1}`,
    `C${cx + r3} ${cy + r3} ${cx + r1} ${cy + r2} ${cx + r1} ${cy}`,
    'Z',
  ].join('');
}

function contributionPath(seed) {
  const baseY = 52 + (seed % 6);
  const left = 16 + ((seed >> 3) % 6);
  const right = 46 - ((seed >> 5) % 6);
  const cutX = 36 + ((seed >> 7) % 6);
  const tipY = 16 + ((seed >> 9) % 8);

  return `M${left} ${baseY}L${right} ${baseY}L${cutX} ${tipY}L${left} ${baseY - 10}Z`;
}

function spacePath(seed) {
  const frame = 10 + (seed % 4);
  const inset = 8 + ((seed >> 3) % 4);
  const notchWidth = 10 + ((seed >> 5) % 6);
  const notchDepth = 14 + ((seed >> 7) % 6);

  const outer = `M${frame} ${frame}H${64 - frame}V${64 - frame}H${frame}Z`;
  const inner = `M${frame + inset} ${frame + inset}H${64 - frame - inset}V${64 - frame - inset}H${frame + inset}Z`;
  const notchLeft = 32 - notchWidth / 2;
  const notchRight = 32 + notchWidth / 2;
  const notch = `M${notchLeft} ${frame}V${frame + notchDepth}H${notchRight}V${frame}Z`;

  return { d: `${outer}${inner}${notch}`, fillRule: 'evenodd' };
}

function createPathForMotif(motif, seed) {
  switch (motif) {
    case 'autonomy':
      return { d: branchingPath(seed) };
    case 'belonging':
      return belongingPath(seed);
    case 'safety':
      return { d: safetyPath(seed) };
    case 'rest':
      return { d: restPath(seed) };
    case 'clarity':
      return { d: clarityPath(seed) };
    case 'order':
      return { d: orderPath(seed), fillRule: 'nonzero' };
    case 'growth':
      return { d: growthPath(seed) };
    case 'play':
      return { d: playPath(seed) };
    case 'contribution':
      return { d: contributionPath(seed) };
    case 'space':
      return spacePath(seed);
    default:
      return { d: belongingPath(seed).d, fillRule: 'evenodd' };
  }
}

function renderSvg({ d, fillRule }) {
  const ruleAttr = fillRule ? ` fill-rule="${fillRule}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="${d}" fill="#000"${ruleAttr} /></svg>\n`;
}

async function main() {
  const dataRaw = await fs.readFile(dataPath, 'utf8');
  const data = JSON.parse(dataRaw);
  const needs = Array.isArray(data.needs) ? data.needs : [];

  await fs.mkdir(outputDir, { recursive: true });

  for (const need of needs) {
    const motif = selectMotif(need);
    const seed = hashSlug(need.slug);
    const pathDef = createPathForMotif(motif, seed);
    const svg = renderSvg(pathDef);
    const iconPath = path.join(outputDir, `${need.slug}.svg`);
    await fs.writeFile(iconPath, svg, 'utf8');
  }
}

main().catch((error) => {
  console.error('Failed to generate need icons:', error);
  process.exit(1);
});
