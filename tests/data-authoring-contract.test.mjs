import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [header, ...records] = rows.filter((candidate) => candidate.some((value) => value !== ''));
  assert.ok(header, 'Feelings.csv must contain a header row.');
  const keys = header.map((value) => value.trim());
  return records.map((values) =>
    Object.fromEntries(keys.map((key, index) => [key, (values[index] ?? '').trim()])),
  );
}

const packageJson = readJson('package.json');
assert.equal(
  packageJson.scripts['build:data'],
  'node scripts/build-data.mjs',
  'build:data must invoke the canonical compiler directly.',
);
assert.match(
  packageJson.scripts.build,
  /build:data.*build:observation-cues.*build:pages/,
  'the canonical full build must verify observation cue artifacts between data and page generation.',
);
assert.match(
  packageJson.scripts['build:observation-cues'],
  /generateNeedObservationBlueprint\.mjs.*buildObservationCueLibrary\.mjs.*calculateObservationFeelingCoverage\.mjs/,
  'observation cue generation must refresh its blueprint, compiled artifacts, and detector statistics together.',
);
assert.equal(existsSync(join(root, 'scripts/build-data-safe.mjs')), false, 'data safe-builder must be retired.');
assert.equal(
  existsSync(join(root, 'scripts/finalize-generated-data.mjs')),
  false,
  'post-generation data finalizer must be retired.',
);

const buildDataSource = readFileSync(join(root, 'scripts/build-data.mjs'), 'utf8');
assert.match(
  buildDataSource,
  /fileURLToPath\(new URL\('\.\.', import\.meta\.url\)\)/,
  'the canonical data compiler must resolve its repository root as a filesystem path on every supported OS.',
);
assert.doesNotMatch(
  buildDataSource,
  /new URL\('\.\.', import\.meta\.url\)\.pathname/,
  'URL pathname strings are not valid Windows filesystem roots.',
);
assert.match(buildDataSource, /reverse-inference-overrides\.json/);
assert.match(buildDataSource, /applyReverseInferenceOverrides/);
assert.match(buildDataSource, /PAGE_TO_MODEL_KEY/);

const cueCompilerSource = readFileSync(join(root, 'scripts/buildObservationCueLibrary.mjs'), 'utf8');
assert.match(
  cueCompilerSource,
  /fileURLToPath\(import\.meta\.url\) === resolve\(process\.argv\[1\]\)/,
  'the observation cue compiler entrypoint must run on Windows and POSIX paths.',
);

const feelingsCsv = readFileSync(join(root, 'data/Feelings.csv'), 'utf8').replace(/^\ufeff/, '');
const cueRows = parseCsv(feelingsCsv).filter(
  (row) => String(row['Row Type'] || '').trim().toLowerCase() === 'cue',
);
const seenCueKeys = new Set();
for (const [index, row] of cueRows.entries()) {
  const regionId = String(row['Cue Region ID'] || '').trim();
  const optionId = String(row['Cue Option ID'] || '').trim();
  const feelingKey = String(row['Cue Feeling Key'] || '').trim();
  if (!regionId || !optionId || !feelingKey) continue;
  assert.notEqual(
    feelingKey,
    'love',
    `Body Cue row ${index + 1} uses legacy feeling key "love"; use "love-caring".`,
  );
  const key = `${regionId}\u0000${optionId}\u0000${feelingKey}`;
  assert.equal(
    seenCueKeys.has(key),
    false,
    `Duplicate Body Cue source key: ${regionId}/${optionId}/${feelingKey}`,
  );
  seenCueKeys.add(key);
}

const reverseInference = readJson('data/reverse-inference.json');
const overrides = readJson('data/reverse-inference-overrides.json');
assert.equal(overrides.schemaVersion, 1, 'reverse-inference overrides must use schemaVersion 1.');
assert.ok(overrides.entries && typeof overrides.entries === 'object' && !Array.isArray(overrides.entries));

const allowedOverrideFields = new Set([
  'zones',
  'needsHypotheses',
  'bodyCueOrder',
  'bodyCueOverrides',
  'evidenceKeysAppend',
]);
for (const [feelingKey, override] of Object.entries(overrides.entries)) {
  const generated = reverseInference[feelingKey];
  assert.ok(generated, `Override references missing reverse-inference entry "${feelingKey}".`);
  for (const field of Object.keys(override)) {
    assert.ok(allowedOverrideFields.has(field), `Unknown override field "${field}" for "${feelingKey}".`);
  }

  if (override.bodyCueOrder) {
    assert.ok(Array.isArray(override.bodyCueOrder), `bodyCueOrder for "${feelingKey}" must be an array.`);
    assert.equal(
      new Set(override.bodyCueOrder).size,
      override.bodyCueOrder.length,
      `bodyCueOrder for "${feelingKey}" contains duplicates.`,
    );
    assert.deepEqual(
      generated.bodyCues.map((cue) => cue.optionId),
      override.bodyCueOrder,
      `Generated body-cue order for "${feelingKey}" must reflect the reviewed override.`,
    );
  }

  if (override.bodyCueOverrides) {
    const generatedCueIds = new Set((generated.bodyCues || []).map((cue) => cue.optionId));
    for (const optionId of Object.keys(override.bodyCueOverrides)) {
      assert.ok(generatedCueIds.has(optionId), `Override for "${feelingKey}" references missing cue "${optionId}".`);
    }
  }
}

console.log(
  `Data authoring contract passed: ${cueRows.length} canonical Body Cue rows and ${Object.keys(overrides.entries).length} reviewed reverse-inference overrides.`,
);
