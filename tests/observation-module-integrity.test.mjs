import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compileObservationCueLibrary,
  parseObservationCueCSV,
  parseObservationCueModules,
  splitCuePatternColumn,
} from '../lib/observationCueData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

assert.deepEqual(
  splitCuePatternColumn(String.raw`\\b(?:one\|two)\\b|plain`),
  [String.raw`\b(?:one|two)\b`, 'plain'],
  'escaped regex alternation pipes must survive the generated CSV delimiter decoder',
);

async function loadLibrary() {
  const csvPath = path.join(rootDir, 'data', 'observation_cues.csv');
  const modulesPath = path.join(rootDir, 'data', 'observation_cue_modules.json');
  const [csvText, modulesText] = await Promise.all([
    fs.readFile(csvPath, 'utf8'),
    fs.readFile(modulesPath, 'utf8'),
  ]);
  const invalidPatternWarnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (String(args[0] || '').startsWith('Skipping invalid observation')) {
      invalidPatternWarnings.push(args.map(String).join(' '));
      return;
    }
    originalWarn(...args);
  };

  try {
    const cues = parseObservationCueCSV(csvText);
    const moduleDefs = parseObservationCueModules(modulesText);
    const library = compileObservationCueLibrary({ cues, modules: moduleDefs });
    assert.deepEqual(
      invalidPatternWarnings,
      [],
      'generated observation cue patterns must all compile as complete regex expressions',
    );
    return library;
  } finally {
    console.warn = originalWarn;
  }
}

async function loadNeedTemplates() {
  const templatePath = path.join(rootDir, 'data', 'observation_need_templates.json');
  const text = await fs.readFile(templatePath, 'utf8');
  return JSON.parse(text);
}

async function loadTaxonomy() {
  const taxonomyPath = path.join(rootDir, 'data', 'observation_taxonomy.json');
  const text = await fs.readFile(taxonomyPath, 'utf8');
  return JSON.parse(text);
}

async function loadBlueprint() {
  const blueprintPath = path.join(rootDir, 'data', 'observation_module_blueprints.json');
  const text = await fs.readFile(blueprintPath, 'utf8');
  const parsed = JSON.parse(text);
  return Array.isArray(parsed?.modules) ? parsed.modules : Array.isArray(parsed) ? parsed : [];
}

async function listLandingPageSlugs(directory) {
  const absolute = path.join(rootDir, directory);
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  const slugs = new Set();

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const slug = entry.name;
    const landingPagePath = path.join(absolute, slug, 'index.html');

    try {
      await fs.access(landingPagePath);
      slugs.add(slug);
    } catch {
      // ignore directories without landing pages
    }
  }

  return slugs;
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function assertVocabulary({
  values,
  slugSet,
  context,
  kind,
  transform = value => value,
}) {
  for (const rawValue of values ?? []) {
    assert.strictEqual(
      typeof rawValue,
      'string',
      `${context} lists a ${kind} value that is not a string`,
    );

    const slug = transform(rawValue);
    assert.ok(slug, `${context} lists a ${kind} value without a slug`);
    assert.ok(
      slugSet.has(slug),
      `${context} references ${kind} "${rawValue}" (slug "${slug}") without a landing page`,
    );
  }
}

async function run() {
  const [library, blueprintModules, needTemplates, taxonomy, feelingSlugs, needSlugs] = await Promise.all([
    loadLibrary(),
    loadBlueprint(),
    loadNeedTemplates(),
    loadTaxonomy(),
    listLandingPageSlugs('feelings'),
    listLandingPageSlugs('needs'),
  ]);
  const { modules, cues } = library;

  Object.entries(needTemplates).forEach(([category, template]) => {
    (Array.isArray(template?.cues) ? template.cues : []).forEach(cue => {
      (Array.isArray(cue?.patterns) ? cue.patterns : []).forEach(pattern => {
        assert.doesNotThrow(
          () => new RegExp(pattern, 'iu'),
          `canonical observation template ${category}/${cue?.suffix || '(missing suffix)'} contains a fragmented regex`,
        );
      });
    });
  });

  assert.ok(modules.length > 0, 'Expected compiled modules');
  assert.ok(cues.length > 0, 'Expected cue rows');

  assert.strictEqual(
    modules.length,
    blueprintModules.length,
    'Module count should match blueprint definitions',
  );

  const blueprintCueIds = new Set();
  const blueprintModuleMap = new Map();
  blueprintModules.forEach(module => {
    blueprintModuleMap.set(module.id, module);
    (Array.isArray(module.cues) ? module.cues : []).forEach(cue => {
      if (cue?.id) {
        blueprintCueIds.add(cue.id);
      }
    });
  });

  assert.strictEqual(cues.length, blueprintCueIds.size, 'Cue count should match blueprint cues');

  modules.forEach(module => {
    assert.ok(module.id, 'module missing id');
    const expectedModule = blueprintModuleMap.get(module.id);
    assert.ok(expectedModule, `unexpected module compiled: ${module.id}`);
    assert.ok(Array.isArray(module.matchers), `module ${module.id} missing matchers array`);
    assert.ok(module.matchers.length > 0, `module ${module.id} should expose matchers`);
    assert.ok(
      module.matchers.some(matcher => matcher?.sourceType === 'detector'),
      `module ${module.id} should include lexicon detectors`,
    );
    if (Array.isArray(module.slotIds) && module.slotIds.length) {
      assert.ok(module.slotSummary && module.slotSummary.length > 0, `module ${module.id} missing slot summary`);
    }
    assert.ok(Array.isArray(module.feelings) && module.feelings.length > 0, `module ${module.id} missing feelings`);
    assert.ok(Array.isArray(module.needs) && module.needs.length > 0, `module ${module.id} missing needs`);

    assertVocabulary({
      values: module.feelings,
      slugSet: feelingSlugs,
      context: `compiled module ${module.id}`,
      kind: 'feeling',
    });
    assertVocabulary({
      values: module.needs,
      slugSet: needSlugs,
      context: `compiled module ${module.id}`,
      kind: 'need',
    });

    const expectedCueIds = new Set(
      (Array.isArray(expectedModule.cues) ? expectedModule.cues : []).map(cue => cue.id).filter(Boolean),
    );
    assert.strictEqual(
      module.cueIds.length,
      expectedCueIds.size,
      `module ${module.id} should include all blueprint cues`,
    );
    module.cueIds.forEach(id => {
      assert.ok(expectedCueIds.has(id), `module ${module.id} unexpectedly references cue ${id}`);
    });
  });

  const assigned = new Set(modules.flatMap(module => module.cueIds || []));
  cues.forEach(cue => {
    assert.ok(assigned.has(cue.id), `cue ${cue.id} was not assigned to a module`);
    assert.ok(cue.moduleId, `cue ${cue.id} missing moduleId`);
    assert.ok(blueprintCueIds.has(cue.id), `cue ${cue.id} not defined in blueprint`);
  });

  blueprintModules.forEach(module => {
    const context = `blueprint module ${module?.id ?? '(missing id)'}`;
    assertVocabulary({
      values: module?.feelings,
      slugSet: feelingSlugs,
      context,
      kind: 'feeling',
    });
    assertVocabulary({
      values: module?.needs,
      slugSet: needSlugs,
      context,
      kind: 'need',
    });
  });

  const families = Array.isArray(taxonomy?.families) ? taxonomy.families : [];
  families.forEach(family => {
    const patterns = Array.isArray(family?.patterns) ? family.patterns : [];
    patterns.forEach(pattern => {
      const context = `taxonomy ${family?.id ?? '(missing id)'} pattern ${pattern?.id ?? '(missing id)'}`;
      assertVocabulary({
        values: pattern?.feelings,
        slugSet: feelingSlugs,
        context,
        kind: 'feeling',
        transform: slugify,
      });
      assertVocabulary({
        values: pattern?.needs,
        slugSet: needSlugs,
        context,
        kind: 'need',
        transform: slugify,
      });
    });
  });

  const fallbackModules = modules.filter(module => module.id.startsWith('module-'));
  assert.strictEqual(fallbackModules.length, 0, 'No fallback modules should be generated');

  const autoModules = modules.filter(module => module.auto);
  assert.strictEqual(autoModules.length, 0, 'Auto-generated modules should not be required');

  console.log('Observation module integrity checks passed.');
}

run().catch(error => {
  console.error('Observation module integrity failed');
  throw error;
});
