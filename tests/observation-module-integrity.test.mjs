import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  compileObservationCueLibrary,
  parseObservationCueCSV,
  parseObservationCueModules,
} from '../lib/observationCueData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function loadLibrary() {
  const csvPath = path.join(rootDir, 'data', 'observation_cues.sanitized.csv');
  const modulesPath = path.join(rootDir, 'data', 'observation_cue_modules.json');
  const [csvText, modulesText] = await Promise.all([
    fs.readFile(csvPath, 'utf8'),
    fs.readFile(modulesPath, 'utf8'),
  ]);
  const cues = parseObservationCueCSV(csvText);
  const moduleDefs = parseObservationCueModules(modulesText);
  return compileObservationCueLibrary({ cues, modules: moduleDefs });
}

async function loadBlueprint() {
  const blueprintPath = path.join(rootDir, 'data', 'observation_module_blueprints.json');
  const text = await fs.readFile(blueprintPath, 'utf8');
  const parsed = JSON.parse(text);
  return Array.isArray(parsed?.modules) ? parsed.modules : Array.isArray(parsed) ? parsed : [];
}

async function loadDataset() {
  const datasetPath = path.join(rootDir, 'data', 'index.json');
  const text = await fs.readFile(datasetPath, 'utf8');
  const parsed = JSON.parse(text);
  return parsed && typeof parsed === 'object' ? parsed : {};
}

async function run() {
  const [library, blueprintModules, dataset] = await Promise.all([loadLibrary(), loadBlueprint(), loadDataset()]);
  const { modules, cues } = library;

  const availableFeelings = new Set((Array.isArray(dataset?.feelings) ? dataset.feelings : []).map(item => item?.slug).filter(Boolean));
  const availableNeeds = new Set((Array.isArray(dataset?.needs) ? dataset.needs : []).map(item => item?.slug).filter(Boolean));
  assert.ok(availableFeelings.size > 0, 'Expected at least one feeling in dataset index');
  assert.ok(availableNeeds.size > 0, 'Expected at least one need in dataset index');

  const referencedFeelings = new Set();
  const referencedNeeds = new Set();

  function checkSlugs({ type, values, moduleId, cueId, origin }) {
    const arr = Array.isArray(values) ? values : [];
    const availableSet = type === 'feelings' ? availableFeelings : availableNeeds;
    const referencedSet = type === 'feelings' ? referencedFeelings : referencedNeeds;
    const label = type === 'feelings' ? 'feeling' : 'need';
    const cueSuffix = cueId ? ` cue ${cueId}` : '';
    const location = `${origin} ${moduleId}${cueSuffix}`.trim();
    arr.forEach(value => {
      assert.ok(value, `${location} includes empty ${label} slug`);
      assert.ok(
        availableSet.has(value),
        `${location} references unknown ${label} slug "${value}"`,
      );
      referencedSet.add(value);
    });
  }

  blueprintModules.forEach(module => {
    checkSlugs({ type: 'feelings', values: module.feelings, moduleId: module.id, origin: 'blueprint module' });
    checkSlugs({ type: 'needs', values: module.needs, moduleId: module.id, origin: 'blueprint module' });
    (Array.isArray(module.cues) ? module.cues : []).forEach(cue => {
      checkSlugs({
        type: 'feelings',
        values: cue.feelings,
        moduleId: module.id,
        cueId: cue.id,
        origin: 'blueprint cue',
      });
      checkSlugs({
        type: 'needs',
        values: cue.needs,
        moduleId: module.id,
        cueId: cue.id,
        origin: 'blueprint cue',
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

    checkSlugs({ type: 'feelings', values: module.feelings, moduleId: module.id, origin: 'compiled module' });
    checkSlugs({ type: 'needs', values: module.needs, moduleId: module.id, origin: 'compiled module' });

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

    checkSlugs({ type: 'feelings', values: cue.feelings, moduleId: cue.moduleId, cueId: cue.id, origin: 'compiled cue' });
    checkSlugs({ type: 'needs', values: cue.needs, moduleId: cue.moduleId, cueId: cue.id, origin: 'compiled cue' });
  });

  const fallbackModules = modules.filter(module => module.id.startsWith('module-'));
  assert.strictEqual(fallbackModules.length, 0, 'No fallback modules should be generated');

  const autoModules = modules.filter(module => module.auto);
  assert.strictEqual(autoModules.length, 0, 'Auto-generated modules should not be required');

  async function verifyPages(subdir, slugs) {
    for (const slug of slugs) {
      const pagePath = path.join(rootDir, subdir, slug, 'index.html');
      try {
        await fs.access(pagePath);
      } catch (error) {
        assert.fail(`No ${subdir} page found for slug "${slug}"`);
      }
    }
  }

  await verifyPages('feelings', referencedFeelings);
  await verifyPages('needs', referencedNeeds);

  console.log('Observation module integrity checks passed.');
}

run().catch(error => {
  console.error('Observation module integrity failed');
  throw error;
});
