import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatObservationFormulaSlotSummary } from '../lib/observationFormula.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const DEFAULT_BLUEPRINT_PATH = join(rootDir, 'data', 'observation_module_blueprints.json');
const DEFAULT_CUE_OUTPUT = join(rootDir, 'data', 'observation_cues.csv');
const DEFAULT_MODULE_OUTPUT = join(rootDir, 'data', 'observation_cue_modules.json');
const DEFAULT_ACTIONS_PATH = join(rootDir, 'data', 'observation_sentence_actions.json');

export function buildObservationCueLibrary({
  blueprintPath = DEFAULT_BLUEPRINT_PATH,
  cueOutputPath = DEFAULT_CUE_OUTPUT,
  moduleOutputPath = DEFAULT_MODULE_OUTPUT,
  actionsPath = DEFAULT_ACTIONS_PATH,
  logger = console,
} = {}) {
  const blueprint = loadBlueprint(blueprintPath);
  const actionIndex = loadActionIndex(actionsPath);

  const cues = [];
  const modules = [];

  blueprint.forEach(moduleDef => {
    const moduleActions = actionIndex.get(moduleDef.id) || createEmptyActionBundle();
    const module = normalizeModule(moduleDef, moduleActions);
    modules.push(module);

    const cueEntries = Array.isArray(moduleDef.cues) ? moduleDef.cues : [];
    cueEntries.forEach(cueDef => {
      const cue = normalizeCue(cueDef, module, moduleActions);
      cues.push(cue);
    });
  });

  writeCueCsv(cues, cueOutputPath);
  writeModuleJson(modules, moduleOutputPath);

  if (logger && typeof logger.info === 'function') {
    logger.info(
      `Observation cue library rebuilt with ${modules.length} modules and ${cues.length} cues.`,
    );
  }

  return { modules, cues, cueOutputPath, moduleOutputPath };
}

function loadBlueprint(path) {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed?.modules)) {
    return parsed.modules;
  }
  if (Array.isArray(parsed)) {
    return parsed;
  }
  throw new Error('Observation module blueprint must expose a modules array.');
}

function loadActionIndex(path) {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  const actions = Array.isArray(parsed?.actions) ? parsed.actions : [];
  const map = new Map();
  actions.forEach(action => {
    if (!action || !action.moduleId) {
      return;
    }
    const existing = map.get(action.moduleId) || createEmptyActionBundle();
    const phrases = Array.isArray(action.phrases) ? action.phrases : [];
    const matchers = Array.isArray(action.matchers) ? action.matchers : [];
    const next = {
      actionIds: [...existing.actionIds, action.id].filter(Boolean),
      phrases: dedupeStrings([...existing.phrases, ...phrases]),
      matchers: dedupeMatchers([...existing.matchers, ...matchers]),
    };
    map.set(action.moduleId, next);
  });
  return map;
}

function createEmptyActionBundle() {
  return { actionIds: [], phrases: [], matchers: [] };
}

function normalizeModule(def, actionBundle) {
  const id = String(def?.id || '').trim();
  if (!id) {
    throw new Error('Module definition missing id');
  }

  const label = String(def.label || '').trim() || formatTitle(id);
  const summary = sanitizeSentence(def.summary || '');
  const slotIds = Array.isArray(def.slotIds) ? def.slotIds.filter(Boolean) : [];
  const slotSummary = slotIds.length
    ? formatObservationFormulaSlotSummary(slotIds, { includeArticle: false })
    : '';

  const cueIds = (Array.isArray(def.cues) ? def.cues : [])
    .map(cue => (cue && typeof cue.id === 'string' ? cue.id.trim() : ''))
    .filter(Boolean);

  const feelings = uniqueStrings(Array.isArray(def.feelings) ? def.feelings : []);
  const needs = uniqueStrings(Array.isArray(def.needs) ? def.needs : []);
  const examples = uniqueStrings(Array.isArray(def.examples) ? def.examples : []).slice(0, 3);

  const builderActionIds = Array.isArray(def.builderActionIds)
    ? uniqueStrings(def.builderActionIds)
    : uniqueStrings(actionBundle.actionIds);

  const matchers = dedupeMatchers([
    ...normalizeSerializedMatchers(Array.isArray(def.builderMatchers) ? def.builderMatchers : []),
    ...normalizeSerializedMatchers(actionBundle.matchers),
  ]);

  const matchPhrases = dedupeStrings([
    ...uniqueStrings(Array.isArray(def.matchPhrases) ? def.matchPhrases : []),
    ...actionBundle.phrases,
  ]);

  return {
    id,
    label,
    summary,
    slotIds,
    slotSummary,
    cueIds,
    feelings,
    needs,
    examples,
    matchers,
    matchPhrases,
    builderActionIds,
  };
}

function normalizeCue(cueDef, module, actionBundle) {
  const id = String(cueDef?.id || '').trim();
  if (!id) {
    throw new Error(`Module ${module.id} defines a cue without an id.`);
  }

  const example = sanitizeSentence(cueDef.example || module.examples?.[0] || '');
  if (!example) {
    throw new Error(`Cue ${id} is missing an example.`);
  }

  const cueFeelings = uniqueStrings(
    (Array.isArray(cueDef.feelings) && cueDef.feelings.length)
      ? cueDef.feelings
      : module.feelings,
  );
  const cueNeeds = uniqueStrings(
    (Array.isArray(cueDef.needs) && cueDef.needs.length)
      ? cueDef.needs
      : module.needs,
  );

  const cuePhrases = dedupeStrings([
    ...uniqueStrings(Array.isArray(cueDef.phrases) ? cueDef.phrases : []),
    ...actionBundle.phrases,
  ]);
  const patterns = cuePhrases.map(phraseToPattern).filter(Boolean);

  return {
    id,
    moduleId: module.id,
    patterns,
    feelings: cueFeelings,
    needs: cueNeeds,
    example,
  };
}

function normalizeSerializedMatchers(matchers) {
  const result = [];
  (Array.isArray(matchers) ? matchers : []).forEach(entry => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const pattern = typeof entry.pattern === 'string' ? entry.pattern : '';
    const tokens = Array.isArray(entry.tokens) ? entry.tokens.map(token => token.trim()).filter(Boolean) : [];
    const flags = typeof entry.flags === 'string' ? entry.flags : 'iu';
    const tokenThresholdRaw = Number.isFinite(entry.tokenThreshold) ? entry.tokenThreshold : 0;
    const tokenThreshold = Math.max(0, Math.floor(tokenThresholdRaw));
    const sourceType = typeof entry.sourceType === 'string' && entry.sourceType.trim()
      ? entry.sourceType.trim()
      : 'builder';
    if (!pattern && !tokens.length) {
      return;
    }
    const key = entry.key || `${pattern}/${flags}` || tokens.join('|');
    result.push({
      key,
      pattern,
      flags,
      tokens,
      tokenThreshold,
      sourceType,
    });
  });
  return result;
}

function writeCueCsv(cues, outputPath) {
  const header = ['cue', 'patterns (|)', 'feelings (|)', 'needs (|)', 'example'];
  const rows = cues.map(cue => [
    cue.id,
    serializeCuePatterns(cue.patterns),
    cue.feelings.join('|'),
    cue.needs.join('|'),
    cue.example,
  ]);
  const csvText = [header, ...rows]
    .map(columns => columns.map(encodeCsvCell).join(','))
    .join('\n')
    .concat('\n');
  writeFileSync(outputPath, csvText);
}

function writeModuleJson(modules, outputPath) {
  const text = JSON.stringify(modules, null, 2);
  writeFileSync(outputPath, `${text}\n`);
}

function phraseToPattern(phrase) {
  const value = typeof phrase === 'string' ? phrase.trim() : '';
  if (!value) {
    return '';
  }
  const escaped = escapeRegExp(value).replace(/\s+/g, '\\s+');
  const startBoundary = /[A-Za-z0-9]/.test(value[0]) ? '\\b' : '';
  const endBoundary = /[A-Za-z0-9]/.test(value[value.length - 1]) ? '\\b' : '';
  return `${startBoundary}${escaped}${endBoundary}`;
}

function serializeCuePatterns(patterns) {
  return (Array.isArray(patterns) ? patterns : [])
    .map(pattern => (typeof pattern === 'string' ? pattern : ''))
    .filter(Boolean)
    .map(pattern => pattern.replace(/([\\|])/g, '\\$1'))
    .join('|');
}

function encodeCsvCell(value) {
  const str = typeof value === 'string' ? value : value == null ? '' : String(value);
  const needsQuotes = /[",\n\r]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function dedupeStrings(values) {
  const seen = new Set();
  const result = [];
  (Array.isArray(values) ? values : []).forEach(value => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    result.push(trimmed);
  });
  return result;
}

function dedupeMatchers(matchers) {
  const seen = new Set();
  const result = [];
  (Array.isArray(matchers) ? matchers : []).forEach(matcher => {
    if (!matcher) {
      return;
    }
    const key = matcher.key || `${matcher.pattern}/${matcher.flags}` || matcher.tokens?.join('|');
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(matcher);
  });
  return result;
}

function uniqueStrings(values) {
  return dedupeStrings(values);
}

function sanitizeSentence(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim();
}

function formatTitle(value) {
  return String(value || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    buildObservationCueLibrary();
  } catch (error) {
    console.error('Failed to rebuild observation cue library');
    throw error;
  }
}
