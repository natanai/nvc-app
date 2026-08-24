import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

const rootDir = process.cwd();
const ignoredDirectories = new Set(['node_modules', '.git', '.github', '.vscode']);
// Standalone tools intentionally outside the generated app shell. Keep this
// explicit so a new ordinary page cannot silently ship without the Customizer.
const standaloneHtmlFiles = new Set(['feelings/emotions-wheel/index.html']);

function collectHtmlFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      if (!['.github'].includes(entry.name)) {
        continue;
      }
    }
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

const htmlFiles = collectHtmlFiles(rootDir);

if (!htmlFiles.length) {
  throw new Error('Customizer integrity check: no HTML files found to inspect.');
}

const missingStorageSnippet = [];
const missingPreapplyFlag = [];
const missingToggle = [];
const staleHighContrast = [];
const staleContrastAttribute = [];

for (const file of htmlFiles) {
  const contents = readFileSync(file, 'utf8');
  const relativePath = relative(rootDir, file).replaceAll('\\', '/');

  if (standaloneHtmlFiles.has(relativePath)) {
    continue;
  }

  if (!contents.includes("const STORAGE_KEY = 'nvcApp.theme'")) {
    missingStorageSnippet.push(relativePath);
  }

  if (!contents.includes('data-theme-preapplied')) {
    missingPreapplyFlag.push(relativePath);
  }

  if (!contents.includes('data-palette-toggle')) {
    missingToggle.push(relativePath);
  }

  if (contents.includes('themeHighContrast')) {
    staleHighContrast.push(relativePath);
  }

  if (
    contents.includes('data-theme-contrast=') ||
    contents.includes("setAttribute('data-theme-contrast'") ||
    contents.includes('setAttribute("data-theme-contrast"')
  ) {
    staleContrastAttribute.push(relativePath);
  }
}

const issues = [];

if (missingStorageSnippet.length) {
  issues.push(`Missing theme preload script in: ${missingStorageSnippet.join(', ')}`);
}

if (missingPreapplyFlag.length) {
  issues.push(`Missing data-theme-preapplied marker in: ${missingPreapplyFlag.join(', ')}`);
}

if (missingToggle.length) {
  issues.push(`Missing customizer toggle markup in: ${missingToggle.join(', ')}`);
}

if (staleHighContrast.length) {
  issues.push(`Found deprecated high contrast logic in: ${staleHighContrast.join(', ')}`);
}

if (staleContrastAttribute.length) {
  issues.push(`Found deprecated data-theme-contrast attribute in: ${staleContrastAttribute.join(', ')}`);
}

const presetCsv = readFileSync(join(rootDir, 'data', 'color-palettes.csv'), 'utf8').trim();
const [presetHeaderLine, ...presetLines] = presetCsv.split(/\r?\n/);
const presetHeaders = presetHeaderLine.split(',').map((value) => value.trim());
const presetRows = presetLines
  .filter((line) => line.trim())
  .map((line) => {
    const values = line.split(',');
    return Object.fromEntries(presetHeaders.map((header, index) => [header, (values[index] || '').trim()]));
  });

const expectedPresetNames = ['Default', 'Refrigerator', 'Pixel Art', 'Matrix', 'Sticker Book'];
const actualPresetNames = presetRows.map((row) => row.name);
if (JSON.stringify(actualPresetNames) !== JSON.stringify(expectedPresetNames)) {
  issues.push(
    `Customizer presets must be exactly ${expectedPresetNames.join(', ')} in that order; found ${actualPresetNames.join(', ')}.`,
  );
}

if (!presetHeaders.includes('roundness')) {
  issues.push('Customizer preset source must include the roundness column.');
}

const colorKeys = ['plum', 'lavender', 'ink', 'inkSoft', 'rose', 'mint', 'gold', 'sky', 'outline'];
const defaultPreset = presetRows.find((row) => row.name === 'Default');
if (!defaultPreset) {
  issues.push('Customizer presets must include Default.');
} else {
  const authoredDefaultColors = colorKeys.filter((key) => defaultPreset[key]);
  if (authoredDefaultColors.length) {
    issues.push(
      `Default must inherit the canonical site palette rather than duplicate it in color-palettes.csv; found values for ${authoredDefaultColors.join(', ')}.`,
    );
  }
  if (defaultPreset.roundness !== '100') {
    issues.push(`Default preset roundness must remain 100; found ${defaultPreset.roundness || 'blank'}.`);
  }
}

for (const row of presetRows.filter((preset) => preset.name !== 'Default')) {
  for (const key of colorKeys) {
    if (!/^#[0-9A-F]{6}$/i.test(row[key] || '')) {
      issues.push(`${row.name || 'Unnamed preset'} must provide a six-digit hex value for ${key}.`);
    }
  }
  const roundness = Number(row.roundness);
  if (!Number.isInteger(roundness) || roundness < 0 || roundness > 200) {
    issues.push(`${row.name || 'Unnamed preset'} must provide roundness from 0 through 200.`);
  }
}

const refrigeratorPreset = presetRows.find((row) => row.name === 'Refrigerator');
if (
  !refrigeratorPreset ||
  refrigeratorPreset.roundness !== '0' ||
  refrigeratorPreset.lavender.toUpperCase() !== '#FFFFFF' ||
  refrigeratorPreset.ink.toUpperCase() !== '#111111'
) {
  issues.push('Refrigerator must stay a square, white-panel, dark-ink word-magnet preset.');
}

const runtimeSource = readFileSync(join(rootDir, 'scripts', 'inventory.js'), 'utf8');
if (!runtimeSource.includes("const roundnessIndex = headerMap.get('roundness');")) {
  issues.push('Customizer runtime must read preset roundness from the canonical color-palettes.csv source.');
}
if (!runtimeSource.includes('setCornerRoundness(selectedPreset.roundness, { persist: false });')) {
  issues.push('Customizer runtime must apply a selected preset\'s authored corner roundness.');
}
if (!runtimeSource.includes('const nextColors = { ...paletteState.defaultColors };')) {
  issues.push('Default preset fallback must continue to inherit the canonical site palette.');
}

if (issues.length) {
  const message = issues.join('\n');
  throw new Error(`Customizer integrity check failed:\n${message}`);
}

console.log(
  `Customizer integrity check passed for ${htmlFiles.length - standaloneHtmlFiles.size} app-shell HTML files ` +
    `(${standaloneHtmlFiles.size} explicit standalone tool excluded) and ${presetRows.length} canonical presets.`,
);
