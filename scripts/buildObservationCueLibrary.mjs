import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeObservationPlaceholders } from '../lib/observationPlaceholders.js';
import { sanitizeObservationText } from '../lib/observationSanitize.js';
import { slugify } from '../lib/slugify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const DEFAULT_LEXICON_PATH = join(rootDir, 'data', 'observation_lexicon.json');
const DEFAULT_BLUEPRINT_PATH = join(rootDir, 'data', 'observation_module_blueprints.json');
const DEFAULT_CUE_OUTPUT = join(rootDir, 'data', 'observation_cues.csv');
const DEFAULT_MODULE_OUTPUT = join(rootDir, 'data', 'observation_cue_modules.json');
const DEFAULT_INDEX_PATH = join(rootDir, 'data', 'index.json');

export function buildObservationCueLibrary({
  lexiconPath = DEFAULT_LEXICON_PATH,
  blueprintPath = DEFAULT_BLUEPRINT_PATH,
  cueOutputPath = DEFAULT_CUE_OUTPUT,
  moduleOutputPath = DEFAULT_MODULE_OUTPUT,
  indexPath = DEFAULT_INDEX_PATH,
  logger = console,
} = {}) {
  const lexicon = loadLexicon(lexiconPath);
  const blueprint = loadBlueprint(blueprintPath);

  const compiled = compileFromBlueprint({ lexicon, blueprint });
  const sanitized = sanitizeCompiledLibrary({ ...compiled, indexPath, logger });

  writeCueCsv(sanitized.cues, cueOutputPath);
  writeModuleJson(sanitized.modules, moduleOutputPath);

  if (logger && typeof logger.info === 'function') {
    logger.info(
      `Observation cue library rebuilt with ${sanitized.modules.length} modules and ${sanitized.cues.length} cues (sanitized ${sanitized.stats.changed} examples, dropped ${sanitized.stats.dropped}${
        sanitized.stats.droppedFauxFeelings > 0
          ? ` including ${sanitized.stats.droppedFauxFeelings} faux feelings`
          : ''
      }${
        sanitized.stats.droppedDuplicates > 0 ? ` and ${sanitized.stats.droppedDuplicates} duplicates` : ''
      }).`,
    );
  }

  return {
    modules: sanitized.modules,
    cues: sanitized.cues,
    cueOutputPath,
    moduleOutputPath,
    stats: sanitized.stats,
  };
}

function loadLexicon(path) {
  const text = readFileSync(path, 'utf8');
  const parsed = JSON.parse(text);
  return normalizeLexicon(parsed);
}

function loadBlueprint(path) {
  const text = readFileSync(path, 'utf8');
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed?.modules)) {
    return parsed.modules.map(module => ({ ...module }));
  }
  if (Array.isArray(parsed)) {
    return parsed.map(module => ({ ...module }));
  }
  throw new Error('Observation module blueprint must expose a modules array.');
}

function compileFromBlueprint({ lexicon, blueprint }) {
  const cues = [];
  const modules = [];
  const cueIds = new Set();

  blueprint.forEach(moduleDef => {
    const normalizedModule = normalizeModule(moduleDef);
    const moduleLexiconEntries = collectLexiconEntries(normalizedModule.lexiconKeys, lexicon);
    const moduleDetectors = dedupeDetectors([
      ...buildLexiconDetectors(moduleLexiconEntries),
      ...normalizeDetectors(normalizedModule.detectors || []),
    ]);

    const moduleCues = [];
    normalizedModule.cues.forEach(cueDef => {
      if (cueIds.has(cueDef.id)) {
        throw new Error(`Duplicate cue id detected: ${cueDef.id}`);
      }
      const cueLexiconEntries = collectLexiconEntries(
        cueDef.lexiconKeys && cueDef.lexiconKeys.length ? cueDef.lexiconKeys : normalizedModule.lexiconKeys,
        lexicon,
      );
      const cuePatterns = dedupePatterns([
        ...collectPatternsFromLexicon(cueLexiconEntries),
        ...collectPatternsFromLexiconEntries(cueDef.lexiconKeys || [], lexicon),
        ...collectPhrasePatterns(cueDef.phrases || []),
        ...normalizePatterns(cueDef.patterns || []),
      ]);

      const cueFeelings = uniqueStrings(
        cueDef.feelings && cueDef.feelings.length ? cueDef.feelings : normalizedModule.feelings,
      );
      const cueNeeds = uniqueStrings(
        cueDef.needs && cueDef.needs.length ? cueDef.needs : normalizedModule.needs,
      );
      const example = cueDef.example || '';
      if (!example) {
        throw new Error(`Cue ${cueDef.id} is missing an example.`);
      }

      cueIds.add(cueDef.id);
      cues.push({
        id: cueDef.id,
        patterns: cuePatterns,
        feelings: cueFeelings,
        needs: cueNeeds,
        example,
      });
      moduleCues.push({
        id: cueDef.id,
        feelings: cueFeelings,
        needs: cueNeeds,
      });
    });

    const moduleFeelings = uniqueStrings(
      normalizedModule.feelings && normalizedModule.feelings.length
        ? normalizedModule.feelings
        : moduleCues.flatMap(cue => cue.feelings || []),
    );
    const moduleNeeds = uniqueStrings(
      normalizedModule.needs && normalizedModule.needs.length
        ? normalizedModule.needs
        : moduleCues.flatMap(cue => cue.needs || []),
    );

    modules.push({
      id: normalizedModule.id,
      label: normalizedModule.label,
      summary: normalizedModule.summary,
      slotIds: normalizedModule.slotIds,
      detectors: moduleDetectors,
      examples: uniqueStrings(normalizedModule.examples || []).slice(0, 3),
      cueIds: moduleCues.map(cue => cue.id),
      feelings: moduleFeelings,
      needs: moduleNeeds,
    });
  });

  return { modules, cues };
}

function normalizeModule(def) {
  const id = String(def?.id || '').trim();
  if (!id) {
    throw new Error('Module definition missing id');
  }
  const label = String(def.label || '').trim() || formatTitle(id);
  const summary = sanitizeSentence(def.summary || '');
  const slotIds = Array.isArray(def.slotIds) ? def.slotIds.filter(Boolean) : [];
  const lexiconKeys = Array.isArray(def.lexiconKeys) ? def.lexiconKeys.filter(Boolean) : [];
  const feelings = uniqueStrings(Array.isArray(def.feelings) ? def.feelings : []);
  const needs = uniqueStrings(Array.isArray(def.needs) ? def.needs : []);
  const examples = Array.isArray(def.examples)
    ? def.examples
        .filter(Boolean)
        .map(example => normalizeObservationPlaceholders(sanitizeSentence(example)))
    : [];
  const detectors = Array.isArray(def.detectors) ? def.detectors : [];
  const cues = Array.isArray(def.cues)
    ? def.cues.map(cue => normalizeCue(cue, id)).filter(Boolean)
    : [];
  if (!cues.length) {
    throw new Error(`Module ${id} must define at least one cue.`);
  }
  return { id, label, summary, slotIds, lexiconKeys, feelings, needs, examples, detectors, cues };
}

function normalizeCue(def, moduleId) {
  const id = String(def?.id || '').trim();
  if (!id) {
    throw new Error(`Module ${moduleId} defines a cue without an id.`);
  }
  const lexiconKeys = Array.isArray(def.lexiconKeys) ? def.lexiconKeys.filter(Boolean) : [];
  const feelings = uniqueStrings(Array.isArray(def.feelings) ? def.feelings : []);
  const needs = uniqueStrings(Array.isArray(def.needs) ? def.needs : []);
  const example = def.example ? normalizeObservationPlaceholders(sanitizeSentence(def.example)) : '';
  const patterns = normalizePatterns(def.patterns || []);
  const phrases = Array.isArray(def.phrases) ? def.phrases.filter(Boolean) : [];
  return { id, lexiconKeys, feelings, needs, example, patterns, phrases };
}

function normalizeLexicon(raw) {
  const map = new Map();
  if (!raw || typeof raw !== 'object') {
    return map;
  }
  Object.entries(raw).forEach(([key, entries]) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) {
      return;
    }
    const normalizedEntries = (Array.isArray(entries) ? entries : [])
      .map((entry, index) => normalizeLexiconEntry(normalizedKey, entry, index))
      .filter(Boolean);
    if (normalizedEntries.length) {
      map.set(normalizedKey, normalizedEntries);
    }
  });
  return map;
}

function normalizeLexiconEntry(key, entry, index) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const patternRaw = typeof entry.pattern === 'string' ? entry.pattern.trim() : '';
  const phrasePattern = !patternRaw && typeof entry.phrase === 'string' ? phraseToPattern(entry.phrase) : '';
  const pattern = patternRaw || phrasePattern;
  const flags = typeof entry.flags === 'string' ? entry.flags : 'iu';
  const tokens = uniqueStrings(
    (Array.isArray(entry.tokens) ? entry.tokens : [])
      .map(token => normalizeTokenValue(token))
      .filter(Boolean),
  );
  let threshold = Number.isFinite(entry.threshold) ? Math.max(1, Math.floor(entry.threshold)) : 0;
  if (!threshold) {
    threshold = tokens.length >= 3 ? 3 : tokens.length >= 2 ? 2 : tokens.length === 1 ? 1 : 0;
  }
  const hint = typeof entry.phrase === 'string' ? entry.phrase.trim() : '';
  if (!pattern && !tokens.length) {
    throw new Error(`Lexicon entry ${key}[${index}] must define a pattern or tokens.`);
  }
  return { key, pattern, flags, tokens, threshold, hint };
}

function collectLexiconEntries(keys, lexicon) {
  const entries = [];
  (Array.isArray(keys) ? keys : []).forEach(key => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) {
      return;
    }
    const lexiconEntries = lexicon.get(normalizedKey);
    if (lexiconEntries && lexiconEntries.length) {
      entries.push(...lexiconEntries);
    }
  });
  return entries;
}

function collectPatternsFromLexicon(entries) {
  return dedupePatterns(
    entries
      .map(entry => {
        if (entry.pattern) {
          return entry.pattern;
        }
        if (entry.tokens && entry.tokens.length) {
          return buildTokenPattern(entry.tokens);
        }
        return '';
      })
      .filter(Boolean),
  );
}

function collectPatternsFromLexiconEntries(keys, lexicon) {
  const entries = collectLexiconEntries(keys, lexicon);
  return collectPatternsFromLexicon(entries);
}

function buildLexiconDetectors(entries) {
  const detectors = [];
  entries.forEach(entry => {
    if (entry.pattern) {
      detectors.push({ type: 'regex', pattern: entry.pattern, flags: entry.flags || 'iu' });
    }
    if (entry.tokens && entry.tokens.length) {
      detectors.push({ type: 'tokens', tokens: entry.tokens, threshold: Math.max(1, entry.threshold || 0) });
    }
  });
  return detectors;
}

function normalizeDetectors(detectors) {
  return (Array.isArray(detectors) ? detectors : [])
    .map(detector => {
      if (!detector || typeof detector !== 'object') {
        return null;
      }
      if (detector.type === 'regex') {
        const pattern = typeof detector.pattern === 'string' ? detector.pattern.trim() : '';
        if (!pattern) {
          return null;
        }
        const flags = typeof detector.flags === 'string' ? detector.flags : 'iu';
        return { type: 'regex', pattern, flags };
      }
      if (detector.type === 'tokens') {
        const tokens = uniqueStrings(
          (Array.isArray(detector.tokens) ? detector.tokens : [])
            .map(token => normalizeTokenValue(token))
            .filter(Boolean),
        );
        if (!tokens.length) {
          return null;
        }
        const thresholdRaw = Number.isFinite(detector.threshold) ? detector.threshold : tokens.length >= 2 ? 2 : 1;
        const threshold = Math.max(1, Math.min(tokens.length, Math.floor(thresholdRaw)));
        return { type: 'tokens', tokens, threshold };
      }
      return null;
    })
    .filter(Boolean);
}

function dedupeDetectors(detectors) {
  const result = [];
  const seen = new Set();
  detectors.forEach(detector => {
    if (!detector) {
      return;
    }
    const key = detector.type === 'regex'
      ? `regex:${detector.pattern}/${detector.flags || 'iu'}`
      : `tokens:${detector.tokens.join('+')}@${detector.threshold}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(detector);
  });
  return result;
}

function normalizePatterns(patterns) {
  return dedupePatterns(
    (Array.isArray(patterns) ? patterns : [])
      .map(pattern => (typeof pattern === 'string' ? pattern.trim() : ''))
      .filter(Boolean),
  );
}

function collectPhrasePatterns(phrases) {
  return dedupePatterns(
    (Array.isArray(phrases) ? phrases : [])
      .map(phrase => phraseToPattern(phrase))
      .filter(Boolean),
  );
}

function dedupePatterns(patterns) {
  const seen = new Set();
  const result = [];
  patterns.forEach(pattern => {
    const key = pattern.replace(/\s+/g, ' ');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(pattern);
    }
  });
  return result;
}

function phraseToPattern(phrase) {
  const value = typeof phrase === 'string' ? phrase.trim() : '';
  if (!value) {
    return '';
  }
  const escaped = escapeRegExp(value).replace(/\s+/g, '\\s+');
  const startBoundary = /[A-Za-z0-9]$/.test(value[0]) ? '\\b' : '';
  const endBoundary = /[A-Za-z0-9]$/.test(value[value.length - 1]) ? '\\b' : '';
  return `${startBoundary}${escaped}${endBoundary}`;
}

function buildTokenPattern(tokens) {
  const normalized = tokens.map(token => escapeRegExp(token)).filter(Boolean);
  if (!normalized.length) {
    return '';
  }
  if (normalized.length === 1) {
    return `\\b${normalized[0]}\\b`;
  }
  const joiner = "(?:[^\\p{L}\\p{N}']+[\\p{L}\\p{N}']+){0,3}?[^\\p{L}\\p{N}']+";
  let pattern = `\\b${normalized[0]}\\b`;
  for (let i = 1; i < normalized.length; i += 1) {
    pattern += `${joiner}\\b${normalized[i]}\\b`;
  }
  return pattern;
}

function uniqueStrings(values) {
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

function sanitizeSentence(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTokenValue(token) {
  if (token == null) {
    return '';
  }
  const lower = String(token)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u2018-\u201b]/g, "'")
    .replace(/[\u201c-\u201f]/g, '"');
  const trimmed = lower.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
  if (!trimmed) {
    return '';
  }
  const withoutPossessive = trimmed.endsWith("'s") ? trimmed.slice(0, -2) : trimmed;
  const collapsed = withoutPossessive.replace(/'/g, '');
  const ascii = collapsed.replace(/[\u0300-\u036f]/g, '');
  const cleaned = ascii.replace(/[^a-z0-9]/g, '');
  if (!cleaned) {
    return '';
  }
  return stemToken(cleaned);
}

function stemToken(token) {
  if (token.length <= 3) {
    return token;
  }
  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith('ses') || token.endsWith('xes') || token.endsWith('zes')) {
    return token.slice(0, -2);
  }
  if (token.endsWith('ing') && token.length > 5) {
    return token.slice(0, -3);
  }
  if (token.endsWith('ed') && token.length > 4) {
    return token.slice(0, -2);
  }
  return token;
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

function encodeCsvCell(value) {
  const str = typeof value === 'string' ? value : value == null ? '' : String(value);
  const needsQuotes = /[",\n\r]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function serializeCuePatterns(patterns) {
  return (Array.isArray(patterns) ? patterns : [])
    .map(pattern => (typeof pattern === 'string' ? pattern : ''))
    .filter(Boolean)
    .map(pattern => pattern.replace(/([\\|])/g, '\\$1'))
    .join('|');
}

function sanitizeCompiledLibrary({ modules, cues, indexPath, logger }) {
  const catalog = loadObservationCatalog(indexPath);
  const fauxFeelingMatchers = buildFauxFeelingMatchers(catalog.fauxFeelings);
  const seenExamples = new Set();
  const keptCueIds = new Set();
  const sanitizedCues = [];
  let dropped = 0;
  let changed = 0;
  let droppedFauxFeelings = 0;
  let droppedDuplicates = 0;

  cues.forEach(cue => {
    const sanitizedExample = sanitizeObservationText(cue.example || '', catalog);
    const exampleSource = sanitizedExample || cue.example || '';
    const normalizedExample = sanitizeWhitespace(exampleSource);
    if (!normalizedExample) {
      dropped += 1;
      return;
    }

    const sanitizedFeelings = filterOutFauxFeelingValues(cue.feelings, fauxFeelingMatchers);

    if (cueContainsFauxFeeling({ ...cue, example: normalizedExample, feelings: sanitizedFeelings }, fauxFeelingMatchers)) {
      dropped += 1;
      droppedFauxFeelings += 1;
      return;
    }

    const exampleKey = `${cue.id.trim().toLowerCase()}::${normalizedExample.toLowerCase()}`;
    if (seenExamples.has(exampleKey)) {
      dropped += 1;
      droppedDuplicates += 1;
      return;
    }

    if (sanitizeWhitespace(cue.example || '') !== normalizedExample) {
      changed += 1;
    }

    seenExamples.add(exampleKey);
    keptCueIds.add(cue.id);
    sanitizedCues.push({
      ...cue,
      example: normalizedExample,
      feelings: sanitizedFeelings,
    });
  });

  const cueMap = new Map(sanitizedCues.map(cue => [cue.id, cue]));
  const sanitizedModules = modules
    .map(module => {
      const filteredCueIds = module.cueIds.filter(id => cueMap.has(id));
      if (!filteredCueIds.length) {
        if (logger && typeof logger.warn === 'function') {
          logger.warn(`Dropping module ${module.id} because all cues were filtered.`);
        }
        return null;
      }
      const sanitizedExamples = filteredCueIds
        .map(id => cueMap.get(id)?.example)
        .filter(Boolean)
        .slice(0, 3);
      const sanitizedModuleFeelings = filterOutFauxFeelingValues(module.feelings, fauxFeelingMatchers);
      return {
        ...module,
        cueIds: filteredCueIds,
        examples: sanitizedExamples.length ? sanitizedExamples : module.examples.slice(0, 3),
        feelings: sanitizedModuleFeelings,
      };
    })
    .filter(Boolean);

  return {
    modules: sanitizedModules,
    cues: sanitizedCues,
    stats: {
      kept: sanitizedCues.length,
      dropped,
      changed,
      droppedFauxFeelings,
      droppedDuplicates,
    },
  };
}

function loadObservationCatalog(indexPath) {
  const text = readFileSync(indexPath, 'utf8');
  const data = JSON.parse(text);
  const feelings = new Map();
  const needs = new Map();
  const fauxFeelings = new Map();

  if (Array.isArray(data?.feelings)) {
    data.feelings.forEach(item => {
      if (item?.slug) {
        feelings.set(item.slug, {
          slug: item.slug,
          title: item.title || item.slug,
        });
      }
    });
  }

  if (Array.isArray(data?.needs)) {
    data.needs.forEach(item => {
      if (item?.slug) {
        needs.set(item.slug, {
          slug: item.slug,
          title: item.title || item.slug,
        });
      }
    });
  }

  if (Array.isArray(data?.fauxFeelings)) {
    data.fauxFeelings.forEach(item => {
      if (item?.slug) {
        fauxFeelings.set(item.slug, {
          slug: item.slug,
          title: item.title || item.slug,
          feelings: Array.isArray(item.feelings) ? item.feelings.map(f => f.slug).filter(Boolean) : [],
          needs: Array.isArray(item.needs) ? item.needs.map(n => n.slug).filter(Boolean) : [],
        });
      }
    });
  }

  return { feelings, needs, fauxFeelings };
}

function buildFauxFeelingMatchers(fauxFeelings) {
  if (!(fauxFeelings instanceof Map)) {
    return [];
  }
  return [...fauxFeelings.values()]
    .map(item => buildFauxFeelingMatcher(item?.slug, item?.title))
    .filter(Boolean);
}

function buildFauxFeelingMatcher(slug, title) {
  const baseSlug = typeof slug === 'string' && slug ? slug : slugify(title || '');
  if (!baseSlug) {
    return null;
  }
  const tokens = baseSlug
    .split('-')
    .map(token => token.trim())
    .filter(Boolean)
    .map(escapeRegExpLiteral);
  if (!tokens.length) {
    return null;
  }
  const pattern = tokens.join('(?:[-\s]+)');
  return new RegExp(`\\b${pattern}\\b`, 'i');
}

function escapeRegExpLiteral(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cueContainsFauxFeeling(cue, matchers) {
  if (!Array.isArray(matchers) || !matchers.length) {
    return false;
  }
  const cells = [
    cue.example,
    ...(Array.isArray(cue.feelings) ? cue.feelings : []),
  ];
  return cells.some(cell => {
    if (typeof cell !== 'string' || !cell) {
      return false;
    }
    return matchers.some(regex => regex.test(cell));
  });
}

function filterOutFauxFeelingValues(values, matchers) {
  if (!Array.isArray(values) || !matchers || !matchers.length) {
    return Array.isArray(values) ? values.filter(Boolean) : [];
  }
  return values.filter(value => !matchesAnyFauxFeeling(value, matchers));
}

function matchesAnyFauxFeeling(value, matchers) {
  if (typeof value !== 'string' || !value) {
    return false;
  }
  return matchers.some(regex => regex.test(value));
}

function sanitizeWhitespace(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/\s+/g, ' ');
}

function writeModuleJson(modules, outputPath) {
  const text = JSON.stringify(modules, null, 2);
  writeFileSync(outputPath, `${text}\n`);
}

function formatTitle(value) {
  const parts = String(value || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1));
  return parts.join(' ');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    buildObservationCueLibrary();
  } catch (error) {
    console.error('Failed to rebuild observation cue library');
    throw error;
  }
}
