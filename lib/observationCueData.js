import { createCueMatchers } from './observationCueMatcher.js';
import {
  evaluateObservationFormula,
  formatObservationFormulaSlotSummary,
  getObservationFormulaSlotById,
} from './observationFormula.js';

export function parseObservationCueCSV(csvText) {
  const text = typeof csvText === 'string' ? csvText : '';
  if (!text.trim()) {
    return [];
  }
  const rows = parseCSV(text);
  if (!rows.length) {
    return [];
  }
  const cues = rows
    .slice(1)
    .filter(row => row && row.length >= 5)
    .map((cols, index) => createCueFromColumns(cols, index))
    .filter(Boolean);
  return cues;
}

export function parseObservationCueModules(jsonText) {
  if (!jsonText) {
    return [];
  }
  try {
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (Array.isArray(parsed?.modules)) {
      return parsed.modules;
    }
    return [];
  } catch (error) {
    console.warn('Unable to parse observation cue modules JSON', error);
    return [];
  }
}

export function compileObservationCueLibrary({ cues = [], modules: moduleDefs = [] } = {}) {
  const cueList = Array.isArray(cues) ? cues.slice() : [];
  const cuesById = new Map(cueList.map(cue => [cue.id, cue]));
  const normalizedModuleDefs = Array.isArray(moduleDefs) ? moduleDefs : [];
  const modules = [];
  const assignedCueIds = new Set();

  normalizedModuleDefs.forEach(def => {
    const module = compileCueModuleDefinition(def, cuesById);
    if (!module) {
      return;
    }
    modules.push(module);
    module.cueIds.forEach(id => assignedCueIds.add(id));
  });

  cueList.forEach(cue => {
    if (assignedCueIds.has(cue.id)) {
      return;
    }
    const fallbackModule = createFallbackModule(cue);
    modules.push(fallbackModule);
    assignedCueIds.add(cue.id);
  });

  const slotIndex = buildSlotIndex(modules);

  modules.forEach(module => {
    module.cueIds.forEach(id => {
      const cue = cuesById.get(id);
      if (cue) {
        cue.moduleId = module.id;
      }
    });
  });

  return { cues: cueList, modules, slotIndex };
}

export function formatCueLabel(value) {
  return formatTitle(value);
}

export function formatTitle(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(token => (token ? token[0].toUpperCase() + token.slice(1) : ''))
    .join(' ');
}

function createCueFromColumns(cols, index) {
  const [cue, patternsRaw, feelingsRaw, needsRaw, example] = cols;
  const rawPatterns = (patternsRaw || '')
    .split('|')
    .map(p => (p || '').trim())
    .filter(Boolean);
  const patterns = rawPatterns.map(p => compilePattern(p)).filter(Boolean);
  const feelings = (feelingsRaw || '').split('|').map(s => s.trim()).filter(Boolean);
  const needs = (needsRaw || '').split('|').map(s => s.trim()).filter(Boolean);
  const patternHints = rawPatterns.map(p => formatCuePhrase(p)).filter(Boolean);
  const cueValue = (cue || '').trim();
  const exampleText = (example || '').trim();
  const matchers = createCueMatchers({ patterns: rawPatterns, example: exampleText });
  const slotCoverage = deriveSlotCoverage({ exampleText, patternHints, cueValue });
  const slotSummary = formatObservationFormulaSlotSummary(slotCoverage, { includeArticle: false });
  return {
    id: cueValue || `cue-${index}`,
    cue: cueValue,
    label: formatCueLabel(cueValue),
    patterns,
    feelings,
    needs,
    example: exampleText,
    phrase: chooseCuePhrase(patternHints, cueValue),
    phrases: patternHints,
    matchers,
    slotCoverage,
    slotSummary,
  };
}

function compileCueModuleDefinition(def, cuesById) {
  if (!def || typeof def !== 'object') {
    return null;
  }
  const id = typeof def.id === 'string' ? def.id.trim() : '';
  if (!id) {
    return null;
  }
  const label = typeof def.label === 'string' ? def.label.trim() : '';
  const summary = typeof def.summary === 'string' ? def.summary.trim() : '';
  const cueIds = normalizeIdList(def.cueIds).filter(cueId => cuesById.has(cueId));
  if (!cueIds.length) {
    return null;
  }
  const moduleCues = cueIds.map(cueId => cuesById.get(cueId)).filter(Boolean);
  if (!moduleCues.length) {
    return null;
  }

  const manualSlotIds = normalizeIdList(def.slotIds);
  const slotIds = manualSlotIds.length ? manualSlotIds : collectSlotCoverage(moduleCues);
  const slotSummary = formatObservationFormulaSlotSummary(slotIds, { includeArticle: false });
  const detectorMatchers = createModuleDetectors(def.detectors, moduleCues);
  const cueMatchers = dedupeMatchers(moduleCues.flatMap(cue => cue.matchers || []));
  const matchers = dedupeMatchers([...detectorMatchers, ...cueMatchers]);

  const cuesFeelings = uniqueStrings(moduleCues.flatMap(cue => cue.feelings || []));
  const cuesNeeds = uniqueStrings(moduleCues.flatMap(cue => cue.needs || []));
  const examples = collectModuleExamples(def.examples, moduleCues);

  const slotGuidance = slotIds
    .map(slotId => getObservationFormulaSlotById(slotId)?.label)
    .filter(Boolean);

  return {
    id,
    label: label || formatCueLabel(id),
    summary,
    slotIds,
    slotSummary,
    cueIds,
    feelings: cuesFeelings,
    needs: cuesNeeds,
    matchers,
    examples,
    guidance: slotGuidance,
  };
}

function createFallbackModule(cue) {
  const slotIds = Array.isArray(cue.slotCoverage) ? cue.slotCoverage.slice() : [];
  const slotSummary = formatObservationFormulaSlotSummary(slotIds, { includeArticle: false });
  return {
    id: `module-${cue.id}`,
    label: cue.label || formatCueLabel(cue.cue || cue.id),
    summary: slotSummary ? `Supports the ${slotSummary}.` : 'Legacy cue coverage.',
    slotIds,
    slotSummary,
    cueIds: [cue.id],
    feelings: uniqueStrings(cue.feelings || []),
    needs: uniqueStrings(cue.needs || []),
    matchers: dedupeMatchers(cue.matchers || []),
    examples: cue.example ? [cue.example] : [],
    guidance: slotIds.map(slotId => getObservationFormulaSlotById(slotId)?.label).filter(Boolean),
  };
}

function buildSlotIndex(modules) {
  const index = {};
  (Array.isArray(modules) ? modules : []).forEach(module => {
    const slotIds = Array.isArray(module.slotIds) ? module.slotIds : [];
    slotIds.forEach(slotId => {
      if (!slotId) {
        return;
      }
      if (!index[slotId]) {
        index[slotId] = [];
      }
      index[slotId].push(module.id);
    });
  });
  return index;
}

function collectModuleExamples(examples, moduleCues) {
  const provided = Array.isArray(examples) ? examples.filter(Boolean) : [];
  if (provided.length) {
    return uniqueStrings(provided).slice(0, 3);
  }
  const cueExamples = moduleCues
    .map(cue => cue.example)
    .filter(Boolean);
  return uniqueStrings(cueExamples).slice(0, 3);
}

function createModuleDetectors(detectors, moduleCues) {
  const entries = Array.isArray(detectors) ? detectors : [];
  const matchers = entries
    .map(detector => createDetectorMatcher(detector))
    .filter(Boolean);
  if (matchers.length) {
    return matchers;
  }
  const phrases = moduleCues.flatMap(cue => cue.phrases || []);
  if (phrases.length) {
    return dedupeMatchers(createCueMatchers({ patterns: phrases }));
  }
  return [];
}

function createDetectorMatcher(detector) {
  if (!detector || typeof detector !== 'object') {
    return null;
  }
  if (detector.type === 'regex') {
    const pattern = typeof detector.pattern === 'string' ? detector.pattern : '';
    if (!pattern) {
      return null;
    }
    const flags = typeof detector.flags === 'string' ? detector.flags : 'i';
    try {
      const regex = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
      return {
        key: `regex:${pattern}/${flags}`,
        regex,
        tokenSet: new Set(),
        tokenThreshold: 0,
        sourceType: 'detector',
        sources: ['detector'],
      };
    } catch (error) {
      console.warn('Skipping invalid module regex detector', pattern, error);
      return null;
    }
  }
  if (detector.type === 'tokens') {
    const tokens = Array.isArray(detector.tokens)
      ? detector.tokens.map(token => (typeof token === 'string' ? token.trim().toLowerCase() : ''))
      : [];
    const meaningful = tokens.filter(Boolean);
    if (!meaningful.length) {
      return null;
    }
    const threshold = Number.isFinite(detector.threshold)
      ? Math.max(1, Math.floor(detector.threshold))
      : meaningful.length;
    return {
      key: `tokens:${meaningful.join('|')}|${threshold}`,
      regex: null,
      tokens: meaningful,
      tokenSet: new Set(meaningful),
      tokenThreshold: threshold,
      sourceType: 'detector',
      sources: ['detector'],
    };
  }
  if (detector.type === 'phrase') {
    const phrase = typeof detector.value === 'string' ? detector.value.trim() : '';
    if (!phrase) {
      return null;
    }
    return createCueMatchers({ patterns: [phrase] })[0] || null;
  }
  return null;
}

function dedupeMatchers(matchers) {
  const map = new Map();
  (Array.isArray(matchers) ? matchers : []).forEach(matcher => {
    if (!matcher) {
      return;
    }
    const key = matcher.key || matcher.regex?.source || '';
    if (!key || map.has(key)) {
      return;
    }
    map.set(key, matcher);
  });
  return Array.from(map.values());
}

function collectSlotCoverage(cues) {
  const collected = new Set();
  (Array.isArray(cues) ? cues : []).forEach(cue => {
    (cue.slotCoverage || []).forEach(slotId => {
      const trimmed = typeof slotId === 'string' ? slotId.trim() : '';
      if (trimmed) {
        collected.add(trimmed);
      }
    });
  });
  return Array.from(collected);
}

function deriveSlotCoverage({ exampleText, patternHints, cueValue }) {
  const samples = [];
  if (exampleText) {
    samples.push(exampleText);
  }
  if (Array.isArray(patternHints) && patternHints.length) {
    samples.push(patternHints.join('. '));
  }
  if (cueValue) {
    samples.push(formatCueLabel(cueValue));
  }
  const collected = new Set();
  samples.filter(Boolean).forEach(sample => {
    const evaluation = evaluateObservationFormula(sample);
    const ids = Array.isArray(evaluation?.completedIds) ? evaluation.completedIds : [];
    ids.forEach(id => {
      const trimmed = typeof id === 'string' ? id.trim() : '';
      if (trimmed) {
        collected.add(trimmed);
      }
    });
  });
  return Array.from(collected);
}

function chooseCuePhrase(patternHints, cueValue) {
  const candidates = Array.isArray(patternHints) ? patternHints.filter(Boolean) : [];
  if (candidates.length) {
    const sorted = [...new Set(candidates)].sort((a, b) => a.length - b.length);
    return sorted[0];
  }
  const fallbackLabel = formatCueLabel(cueValue);
  if (fallbackLabel) {
    return fallbackLabel;
  }
  const fallback = formatCuePhrase(cueValue);
  return fallback || cueValue || '';
}

function formatCuePhrase(rawPattern) {
  const trimmed = typeof rawPattern === 'string' ? rawPattern.trim() : '';
  if (!trimmed) {
    return '';
  }
  const withoutAnchors = trimmed.replace(/^[\^]/, '').replace(/[\$]$/, '');
  return withoutAnchors
    .replace(/\\b/g, '')
    .replace(/\.\*/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
}

function compilePattern(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    return null;
  }

  const attempts = [trimmed];
  const sanitized = trimmed.replace(/\.\?\*/g, '.*');
  if (sanitized !== trimmed) {
    attempts.push(sanitized);
  }

  for (const attempt of attempts) {
    try {
      return new RegExp(attempt, 'i');
    } catch (error) {
      // continue
    }
  }

  console.warn('Skipping invalid observation cue pattern', trimmed);
  return null;
}

function parseCSV(str) {
  const out = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      if (inQ && str[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQ = !inQ;
      }
    } else if (ch === ',' && !inQ) {
      row.push(cur);
      cur = '';
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (cur.length || row.length) {
        row.push(cur);
        out.push(row);
        row = [];
        cur = '';
      }
      if (ch === '\r' && str[i + 1] === '\n') {
        i += 1;
      }
    } else {
      cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    out.push(row);
  }
  return out;
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

function normalizeIdList(values) {
  const seen = new Set();
  const normalized = [];
  (Array.isArray(values) ? values : []).forEach(value => {
    const id = typeof value === 'string' ? value.trim() : '';
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    normalized.push(id);
  });
  return normalized;
}
