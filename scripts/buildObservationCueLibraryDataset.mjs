import fs from 'fs/promises';
import path from 'path';

import {
  compileObservationCueLibrary,
  parseObservationCueCSV,
  parseObservationCueModules,
} from '../lib/observationCueData.js';

const ROOT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

const DEFAULT_CSV_PATH = path.join(DATA_DIR, 'observation_cues.sanitized.csv');
const DEFAULT_MODULE_PATH = path.join(DATA_DIR, 'observation_cue_modules.json');
const DEFAULT_OUTPUT_PATH = path.join(DATA_DIR, 'observation_cue_library.json');

async function readText(filePath, fallback = '') {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}

function serializeRegex(value) {
  if (!value) {
    return null;
  }
  if (value instanceof RegExp) {
    return { source: value.source, flags: value.flags };
  }
  if (typeof value === 'object' && typeof value.source === 'string') {
    return { source: value.source, flags: typeof value.flags === 'string' ? value.flags : '' };
  }
  return null;
}

function serializeMatcher(matcher) {
  if (!matcher || typeof matcher !== 'object') {
    return null;
  }
  const regex = serializeRegex(matcher.regex);
  if (!regex) {
    return null;
  }
  return {
    key: typeof matcher.key === 'string' ? matcher.key : '',
    regex,
    tokens: Array.isArray(matcher.tokens) ? matcher.tokens.slice() : [],
    tokenSet: matcher.tokenSet instanceof Set ? Array.from(matcher.tokenSet) : [],
    tokenThreshold: Number.isFinite(matcher.tokenThreshold) ? matcher.tokenThreshold : 0,
    sourceType: typeof matcher.sourceType === 'string' ? matcher.sourceType : '',
    sources: Array.isArray(matcher.sources) ? matcher.sources.slice() : [],
  };
}

function serializeCue(cue) {
  if (!cue || typeof cue !== 'object') {
    return null;
  }
  return {
    id: cue.id,
    cue: cue.cue,
    label: cue.label,
    example: cue.example,
    phrase: cue.phrase,
    phrases: Array.isArray(cue.phrases) ? cue.phrases.slice() : [],
    feelings: Array.isArray(cue.feelings) ? cue.feelings.slice() : [],
    needs: Array.isArray(cue.needs) ? cue.needs.slice() : [],
    slotCoverage: Array.isArray(cue.slotCoverage) ? cue.slotCoverage.slice() : [],
    slotSummary: cue.slotSummary,
    moduleId: typeof cue.moduleId === 'string' ? cue.moduleId : '',
    patterns: Array.isArray(cue.patterns)
      ? cue.patterns.map(serializeRegex).filter(Boolean)
      : [],
    matchers: Array.isArray(cue.matchers)
      ? cue.matchers.map(serializeMatcher).filter(Boolean)
      : [],
  };
}

function serializeModule(module) {
  if (!module || typeof module !== 'object') {
    return null;
  }
  return {
    id: module.id,
    label: module.label,
    summary: module.summary,
    slotIds: Array.isArray(module.slotIds) ? module.slotIds.slice() : [],
    slotSummary: module.slotSummary,
    cueIds: Array.isArray(module.cueIds) ? module.cueIds.slice() : [],
    feelings: Array.isArray(module.feelings) ? module.feelings.slice() : [],
    needs: Array.isArray(module.needs) ? module.needs.slice() : [],
    examples: Array.isArray(module.examples) ? module.examples.slice() : [],
    guidance: Array.isArray(module.guidance) ? module.guidance.slice() : [],
    matchers: Array.isArray(module.matchers)
      ? module.matchers.map(serializeMatcher).filter(Boolean)
      : [],
  };
}

function serializeSlotIndex(index) {
  if (!index || typeof index !== 'object') {
    return {};
  }
  return Object.keys(index).reduce((acc, key) => {
    const value = index[key];
    acc[key] = Array.isArray(value) ? value.slice() : [];
    return acc;
  }, {});
}

function serializeCueLibrary(library) {
  const cues = Array.isArray(library?.cues) ? library.cues.map(serializeCue).filter(Boolean) : [];
  const modules = Array.isArray(library?.modules) ? library.modules.map(serializeModule).filter(Boolean) : [];
  return {
    cues,
    modules,
    slotIndex: serializeSlotIndex(library?.slotIndex),
  };
}

function buildCueLibraryDataset(library) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    cues: Array.isArray(library?.cues) ? library.cues : [],
    modules: Array.isArray(library?.modules) ? library.modules : [],
    slotIndex: library?.slotIndex && typeof library.slotIndex === 'object'
      ? library.slotIndex
      : {},
  };
}

async function main({
  csvPath = DEFAULT_CSV_PATH,
  modulePath = DEFAULT_MODULE_PATH,
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) {
  const [csvText, moduleText] = await Promise.all([
    readText(csvPath, ''),
    readText(modulePath, '[]'),
  ]);

  const cues = parseObservationCueCSV(csvText);
  const modules = parseObservationCueModules(moduleText);
  const library = compileObservationCueLibrary({ cues, modules });

  const serializedLibrary = serializeCueLibrary(library);
  const dataset = buildCueLibraryDataset(serializedLibrary);
  await fs.writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
  console.log(`Wrote cue library dataset to ${path.relative(ROOT_DIR, outputPath)}`);
}

main().catch(error => {
  console.error('Failed to build observation cue library dataset', error);
  process.exitCode = 1;
});
