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
  const moduleIds = new Set();

  normalizedModuleDefs.forEach(def => {
    const module = compileCueModuleDefinition(def, cuesById);
    if (!module) {
      return;
    }
    module.id = ensureUniqueModuleId(module.id, moduleIds);
    modules.push(module);
    moduleIds.add(module.id);
    module.cueIds.forEach(id => assignedCueIds.add(id));
  });

  const automaticModules = buildAutomaticCueModules({ cueList, assignedCueIds, moduleIds });
  automaticModules.forEach(module => {
    modules.push(module);
    moduleIds.add(module.id);
    module.cueIds.forEach(id => assignedCueIds.add(id));
  });

  cueList.forEach(cue => {
    if (assignedCueIds.has(cue.id)) {
      return;
    }
    const fallbackModule = createFallbackModule(cue);
    fallbackModule.id = ensureUniqueModuleId(fallbackModule.id, moduleIds);
    modules.push(fallbackModule);
    moduleIds.add(fallbackModule.id);
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
  const rawPatterns = splitCuePatternColumn(patternsRaw);
  const patterns = rawPatterns.map(p => compilePattern(p)).filter(Boolean);
  const feelings = (feelingsRaw || '').split('|').map(s => s.trim()).filter(Boolean);
  const needs = (needsRaw || '').split('|').map(s => s.trim()).filter(Boolean);
  const patternHints = rawPatterns.map(p => formatCuePhrase(p)).filter(Boolean);
  const cueValue = (cue || '').trim();
  const exampleText = (example || '').trim();
  const matchers = createCueMatchers({ patterns: rawPatterns, example: exampleText, sourceType: 'builder' });
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

  const phraseMatchers = Array.isArray(def.matchPhrases)
    ? createCueMatchers({ patterns: def.matchPhrases, sourceType: 'builder' })
    : [];
  const prebuiltMatchers = normalizeSerializedMatchers(def.matchers);
  const cueMatchers = dedupeMatchers(moduleCues.flatMap(cue => cue.matchers || []));
  const matchers = dedupeMatchers([...prebuiltMatchers, ...phraseMatchers, ...cueMatchers]);

  const cuesFeelings = uniqueStrings(moduleCues.flatMap(cue => cue.feelings || []));
  const cuesNeeds = uniqueStrings(moduleCues.flatMap(cue => cue.needs || []));
  const examples = collectModuleExamples(def.examples, moduleCues);

  const slotGuidance = slotIds
    .map(slotId => getObservationFormulaSlotById(slotId)?.label)
    .filter(Boolean);

  const matchPhrases = uniqueStrings(
    Array.isArray(def.matchPhrases)
      ? [...def.matchPhrases, ...moduleCues.flatMap(cue => cue.phrases || [])]
      : moduleCues.flatMap(cue => cue.phrases || []),
  );

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
    matchPhrases,
  };
}

function buildAutomaticCueModules({ cueList, assignedCueIds, moduleIds }) {
  const groups = new Map();
  (Array.isArray(cueList) ? cueList : []).forEach(cue => {
    if (!cue || assignedCueIds.has(cue.id)) {
      return;
    }
    const key = deriveAutomaticModuleKey(cue);
    if (!key) {
      return;
    }
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(cue);
  });

  const modules = [];
  groups.forEach((groupCues, key) => {
    if (!Array.isArray(groupCues) || groupCues.length < 2) {
      return;
    }
    const module = createAutomaticModule(key, groupCues, moduleIds);
    if (module) {
      modules.push(module);
    }
  });
  return modules;
}

function deriveAutomaticModuleKey(cue) {
  const id = typeof cue?.id === 'string' ? cue.id.trim() : '';
  if (!id) {
    return '';
  }
  const segments = id.split('-').filter(Boolean);
  if (segments.length < 2) {
    return '';
  }
  const prefix = segments[0];
  if (!prefix || prefix.length < 3) {
    return '';
  }
  if (/^\d+$/.test(prefix)) {
    return '';
  }
  return prefix.toLowerCase();
}

function createAutomaticModule(prefix, moduleCues, moduleIds) {
  const slotIds = collectSlotCoverage(moduleCues);
  const slotSummary = formatObservationFormulaSlotSummary(slotIds, { includeArticle: false });
  const cueIds = moduleCues.map(cue => cue.id);
  const matchers = dedupeMatchers(moduleCues.flatMap(cue => cue.matchers || []));
  const usableMatchers = matchers.length
    ? matchers
    : dedupeMatchers(createCueMatchers({
        patterns: moduleCues.flatMap(cue => cue.phrases || []).filter(Boolean),
        example: moduleCues.map(cue => cue.example).filter(Boolean).join(' '),
        sourceType: 'builder',
      }));
  if (!usableMatchers.length) {
    return null;
  }

  const roleLabel = formatCueLabel(prefix);
  const label = formatAutomaticModuleLabel(roleLabel);
  const actions = deriveCommonActionPhrases(moduleCues, prefix);
  const summary = buildAutomaticModuleSummary(roleLabel, actions, slotSummary);
  const examples = collectModuleExamples(null, moduleCues);
  const feelings = uniqueStrings(moduleCues.flatMap(cue => cue.feelings || []));
  const needs = uniqueStrings(moduleCues.flatMap(cue => cue.needs || []));
  const guidance = slotIds.map(slotId => getObservationFormulaSlotById(slotId)?.label).filter(Boolean);

  const baseId = `auto-${prefix.replace(/[^a-z0-9]+/gi, '-')}`.replace(/-+/g, '-').toLowerCase();
  const id = ensureUniqueModuleId(baseId, moduleIds);

  return {
    id,
    label,
    summary,
    slotIds,
    slotSummary,
    cueIds,
    feelings,
    needs,
    matchers: usableMatchers,
    examples,
    guidance,
    auto: true,
  };
}

function formatAutomaticModuleLabel(roleLabel) {
  if (roleLabel) {
    return `${roleLabel} observation cues`;
  }
  return 'Observation cue module';
}

function buildAutomaticModuleSummary(roleLabel, actions, slotSummary) {
  const subject = roleLabel ? `${roleLabel.toLowerCase()} observations` : 'related observations';
  let summary = `Collects ${subject}`;
  if (actions.length) {
    summary += ` like ${formatActionList(actions)}`;
  }
  summary += '.';
  if (slotSummary) {
    summary += ` Supports the ${slotSummary}.`;
  }
  return summary;
}

function deriveCommonActionPhrases(moduleCues, prefix) {
  const prefixLower = typeof prefix === 'string' ? prefix.toLowerCase() : '';
  const actionPhrases = [];
  (Array.isArray(moduleCues) ? moduleCues : []).forEach(cue => {
    const id = typeof cue?.id === 'string' ? cue.id.toLowerCase() : '';
    if (prefixLower && id.startsWith(`${prefixLower}-`)) {
      const remainder = id.slice(prefixLower.length + 1).replace(/-/g, ' ');
      if (remainder) {
        actionPhrases.push(remainder);
      }
    }
  });
  if (!actionPhrases.length) {
    moduleCues.forEach(cue => {
      const phrase = typeof cue?.phrase === 'string' ? cue.phrase : '';
      if (phrase) {
        actionPhrases.push(phrase);
      }
    });
  }
  const normalized = uniqueNormalizedStrings(actionPhrases);
  return normalized.slice(0, 3).map(formatActionPhrase);
}

function formatActionPhrase(value) {
  const formatted = formatCueLabel(value);
  if (!formatted) {
    return '';
  }
  return formatted[0].toLowerCase() + formatted.slice(1);
}

function formatActionList(items) {
  const list = items.filter(Boolean);
  if (!list.length) {
    return '';
  }
  if (list.length === 1) {
    return list[0];
  }
  if (list.length === 2) {
    return `${list[0]} and ${list[1]}`;
  }
  return `${list[0]}, ${list[1]}, or ${list[2]}`;
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

function ensureUniqueModuleId(id, moduleIds) {
  const existingIds = moduleIds instanceof Set ? moduleIds : new Set();
  let candidate = typeof id === 'string' && id.trim() ? id.trim() : 'observation-module';
  if (!existingIds.has(candidate)) {
    return candidate;
  }
  let index = 2;
  while (existingIds.has(`${candidate}-${index}`)) {
    index += 1;
  }
  return `${candidate}-${index}`;
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

function normalizeSerializedMatchers(matchers) {
  const result = [];
  (Array.isArray(matchers) ? matchers : []).forEach(entry => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const pattern = typeof entry.pattern === 'string' ? entry.pattern.trim() : '';
    const flags = typeof entry.flags === 'string' ? entry.flags : 'iu';
    let regex = null;
    if (pattern) {
      try {
        regex = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
      } catch (error) {
        regex = null;
      }
    }
    const tokens = Array.isArray(entry.tokens)
      ? entry.tokens.map(token => normalizeTokenValue(token)).filter(Boolean)
      : [];
    const tokenThresholdRaw = Number.isFinite(entry.tokenThreshold) ? entry.tokenThreshold : 0;
    const tokenThreshold = Math.max(0, Math.floor(tokenThresholdRaw));
    const key = typeof entry.key === 'string' && entry.key.trim()
      ? entry.key.trim()
      : pattern
        ? `${pattern}/${flags}`
        : tokens.length
          ? `tokens:${tokens.join('|')}@${tokenThreshold || (tokens.length >= 2 ? 2 : 1)}`
          : '';
    if (!key) {
      return;
    }
    result.push({
      key,
      regex,
      tokens,
      tokenSet: new Set(tokens),
      tokenThreshold: tokenThreshold || (tokens.length >= 2 ? 2 : tokens.length === 1 ? 1 : 0),
      sourceType: typeof entry.sourceType === 'string' ? entry.sourceType : 'builder',
      sources: Array.isArray(entry.sources) ? entry.sources.slice() : ['builder'],
    });
  });
  return result;
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

function splitCuePatternColumn(raw) {
  const source = typeof raw === 'string' ? raw : '';
  if (!source) {
    return [];
  }
  const patterns = [];
  let current = '';
  let escaping = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === '\\') {
      escaping = true;
      continue;
    }
    if (char === '|') {
      const trimmed = current.trim();
      if (trimmed) {
        patterns.push(trimmed);
      }
      current = '';
      continue;
    }
    current += char;
  }
  const trimmed = current.trim();
  if (trimmed) {
    patterns.push(trimmed);
  }
  return patterns.map(pattern => pattern.replace(/\\([\\|])/g, '$1'));
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

function uniqueNormalizedStrings(values) {
  const seen = new Map();
  (Array.isArray(values) ? values : []).forEach(value => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) {
      return;
    }
    const normalized = trimmed.toLowerCase();
    if (!seen.has(normalized)) {
      seen.set(normalized, trimmed);
    }
  });
  return Array.from(seen.values());
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
