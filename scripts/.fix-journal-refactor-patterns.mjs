import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/.bedrock-journal-native-refactor.mjs';
let source = readFileSync(path, 'utf8');

const oldFeeling = String.raw`    /  const emotionId = \`\\$\\{config\\.idPrefix\\}-emotion\`;[\\s\\S]*?  grid\\.append\\(emotionField\\);/,`;
const newFeeling = String.raw`    /  const emotionId = \`\\$\\{config\\.idPrefix\\}-emotion\`;[\\s\\S]*?\\n  \\);\\n\\n  const intensityId/,`;
if (!source.includes(oldFeeling)) throw new Error('Old feeling matcher not found');
source = source.replace(oldFeeling, newFeeling);

const oldIntensity = String.raw`    /  const intensityId = \`\\$\\{config\\.idPrefix\\}-intensity\`;[\\s\\S]*?  grid\\.append\\(intensityField\\);/,`;
const newIntensity = String.raw`    /  const intensityId = \`\\$\\{config\\.idPrefix\\}-intensity\`;[\\s\\S]*?\\n  grid\\.append\\(intensityField\\);\\n\\n  const needsField/,`;
if (!source.includes(oldIntensity)) throw new Error('Old intensity matcher not found');
source = source.replace(oldIntensity, newIntensity);

source = source.replace(
  "  );`,\n    'Journal feeling row',",
  "  );\n\n  const intensityId`,\n    'Journal feeling row',",
);
source = source.replace(
  "  grid.append(intensityField);`,\n    'Journal intensity row',",
  "  grid.append(intensityField);\n\n  const needsField`,\n    'Journal intensity row',",
);

writeFileSync(path, source, 'utf8');
console.log('Journal refactor matchers corrected.');

// Trigger only; final runner no longer executes this script.
