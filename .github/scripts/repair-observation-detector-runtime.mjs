import { promises as fs } from 'node:fs';

const read = path => fs.readFile(path, 'utf8');
const write = (path, content) => fs.writeFile(path, content, 'utf8');

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing expected ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected one ${label}, found more than one`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let suggest = await read('lib/observationSuggest.js');
suggest = replaceOnce(
  suggest,
  `export async function loadCueLibrary(\n  csvUrl,\n  modulesUrl = '/data/observation_cue_modules.json',\n) {\n  const [csvText, moduleText] = await Promise.all([\n    fetch(csvUrl).then(r => r.text()),\n    fetch(modulesUrl)\n      .then(r => (r.ok ? r.text() : '[]'))\n      .catch(() => '[]'),\n  ]);\n  const cues = parseObservationCueCSV(csvText);\n  const moduleDefs = parseObservationCueModules(moduleText);\n  return compileObservationCueLibrary({ cues, modules: moduleDefs });\n}`,
  `export async function loadCueLibrary(\n  csvUrl,\n  modulesUrl = '/data/observation_cue_modules.json',\n) {\n  const readAsset = async (url, label) => {\n    const response = await fetch(url);\n    if (!response.ok) {\n      throw new Error(\`Unable to load \${label}: HTTP \${response.status}\`);\n    }\n    return response.text();\n  };\n\n  const [cueResult, moduleResult] = await Promise.allSettled([\n    readAsset(csvUrl, 'observation cue rows'),\n    readAsset(modulesUrl, 'observation cue modules'),\n  ]);\n\n  const cues = cueResult.status === 'fulfilled'\n    ? parseObservationCueCSV(cueResult.value)\n    : [];\n  const moduleDefs = moduleResult.status === 'fulfilled'\n    ? parseObservationCueModules(moduleResult.value)\n    : [];\n\n  if (cueResult.status === 'rejected') {\n    console.warn('Observation cue rows unavailable; continuing with the compiled module artifact.', cueResult.reason);\n  }\n  if (moduleResult.status === 'rejected') {\n    console.warn('Observation cue modules unavailable; continuing with cue-row modules.', moduleResult.reason);\n  }\n\n  const library = compileObservationCueLibrary({ cues, modules: moduleDefs });\n  if (!library.modules.length) {\n    const causes = [cueResult, moduleResult]\n      .filter(result => result.status === 'rejected')\n      .map(result => result.reason?.message || String(result.reason || 'unknown load failure'));\n    throw new Error(\`Observation detector has no usable modules\${causes.length ? \`: \${causes.join('; ')}\` : ''}.\`);\n  }\n  return library;\n}`,
  'cue library loader',
);
await write('lib/observationSuggest.js', suggest);

let cueData = await read('lib/observationCueData.js');
cueData = replaceOnce(
  cueData,
  `  const cueIds = normalizeIdList(def.cueIds).filter(cueId => cuesById.has(cueId));\n  if (!cueIds.length) {\n    return null;\n  }\n  const moduleCues = cueIds.map(cueId => cuesById.get(cueId)).filter(Boolean);\n  if (!moduleCues.length) {\n    return null;\n  }\n\n  const manualSlotIds = normalizeIdList(def.slotIds);\n  const slotIds = manualSlotIds.length ? manualSlotIds : collectSlotCoverage(moduleCues);\n  const slotSummary = formatObservationFormulaSlotSummary(slotIds, { includeArticle: false });\n  const detectorMatchers = createModuleDetectors(def.detectors, moduleCues);\n  const cueMatchers = dedupeMatchers(moduleCues.flatMap(cue => cue.matchers || []));\n  const matchers = dedupeMatchers([...detectorMatchers, ...cueMatchers]);\n\n  const cuesFeelings = uniqueStrings(moduleCues.flatMap(cue => cue.feelings || []));\n  const cuesNeeds = uniqueStrings(moduleCues.flatMap(cue => cue.needs || []));\n  const examples = collectModuleExamples(def.examples, moduleCues);`,
  `  const declaredCueIds = normalizeIdList(def.cueIds);\n  const cueIds = declaredCueIds.filter(cueId => cuesById.has(cueId));\n  const moduleCues = cueIds.map(cueId => cuesById.get(cueId)).filter(Boolean);\n\n  const manualSlotIds = normalizeIdList(def.slotIds);\n  const slotIds = manualSlotIds.length ? manualSlotIds : collectSlotCoverage(moduleCues);\n  const slotSummary = formatObservationFormulaSlotSummary(slotIds, { includeArticle: false });\n  const detectorMatchers = createModuleDetectors(def.detectors, moduleCues);\n  const cueMatchers = dedupeMatchers(moduleCues.flatMap(cue => cue.matchers || []));\n  const matchers = dedupeMatchers([...detectorMatchers, ...cueMatchers]);\n  if (!matchers.length) {\n    return null;\n  }\n\n  const declaredFeelings = normalizeIdList(def.feelings);\n  const declaredNeeds = normalizeIdList(def.needs);\n  const cuesFeelings = uniqueStrings(\n    declaredFeelings.length ? declaredFeelings : moduleCues.flatMap(cue => cue.feelings || []),\n  );\n  const cuesNeeds = uniqueStrings(\n    declaredNeeds.length ? declaredNeeds : moduleCues.flatMap(cue => cue.needs || []),\n  );\n  const examples = collectModuleExamples(def.examples, moduleCues);`,
  'module compiler cue dependency',
);
await write('lib/observationCueData.js', cueData);

let tests = await read('tests/observation-suggest.test.mjs');
const exampleTestEnd = `  assert.ok(result.feelings.includes('disappointment'));\n});\n`;
const exampleTestReplacement = `  assert.ok(result.feelings.includes('disappointment'));\n});\n\ntest('generated module artifact keeps exact matching alive without cue-row delivery', () => {\n  const observation =\n    'Last Thursday, two days after my partner and I had agreed to have dinner together at home at 7 p.m., I arrived back at the apartment at 6:50 p.m. and started setting the table. At 7:15 p.m. my partner was not home yet, and at 7:20 p.m. I saw a message on my phone sent at 6:55 p.m. that said, "I decided to stay late at work and will eat here tonight."';\n\n  const modulesJson = readFileSync(new URL('../data/observation_cue_modules.json', import.meta.url), 'utf8');\n  const modules = parseObservationCueModules(modulesJson);\n  const library = compileObservationCueLibrary({ cues: [], modules });\n  const result = suggestFromObservation(observation, library, 4);\n\n  assert.ok(library.modules.length > 0, 'compiled module artifact should be self-sufficient for exact detection');\n  assert.ok(result.hits.length > 0, 'the built-in example should produce an exact module hit');\n  assert.ok(result.needs.length > 0, 'exact module hits should retain need suggestions');\n  assert.ok(result.feelings.length > 0, 'exact module hits should retain feeling suggestions');\n});\n`;
tests = replaceOnce(tests, exampleTestEnd, exampleTestReplacement, 'observation example regression');
await write('tests/observation-suggest.test.mjs', tests);

let pkg = await read('package.json');
pkg = replaceOnce(
  pkg,
  `    "test:data-integrity": "node tests/data-integrity.test.mjs && node tests/data-authoring-contract.test.mjs",`,
  `    "test:data-integrity": "node tests/data-integrity.test.mjs && node tests/data-authoring-contract.test.mjs && node tests/observation-suggest.test.mjs",`,
  'data-integrity observation detector coverage',
);
await write('package.json', pkg);

let doc = await read('docs/observations-mobile-layout.md');
const docAnchor = `## Non-negotiable behavior\n`;
const docInsert = `## Detector delivery resilience\n\nThe generated \`data/observation_cue_modules.json\` artifact is sufficient to preserve exact-match detection and its feeling/need suggestions even if the supplemental cue-row CSV cannot be delivered. The CSV still enriches cue-level and nearby/fallback behavior when available. Runtime loading treats those assets independently instead of allowing one failed fetch to silently zero the entire detector. The built-in example is a permanent regression fixture and must produce at least one exact module hit under the normal runtime limits.\n\n`;
doc = replaceOnce(doc, docAnchor, docInsert + docAnchor, 'observations detector documentation');
await write('docs/observations-mobile-layout.md', doc);
