import { createCueMatchers, createObservationProfile, matchCueRow } from './observationCueMatcher.js';
import {
  evaluateObservationFormula,
  formatObservationFormulaSlotSummary,
} from './observationFormula.js';

export async function loadCueLibrary(csvUrl) {
  const text = await fetch(csvUrl).then(r => r.text());
  const rows = parseCSV(text);
  const cues = rows
    .slice(1)
    .filter(r => r.length >= 5)
    .map((cols, index) => createCueFromColumns(cols, index));
  const modules = buildCueModules(cues);
  const slotIndex = buildSlotIndex(modules);
  return { cues, modules, slotIndex };
}

export async function loadCueRows(csvUrl) {
  const library = await loadCueLibrary(csvUrl);
  return library.cues;
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

function formatCueLabel(slug) {
  const trimmed = typeof slug === 'string' ? slug.trim() : '';
  if (!trimmed) {
    return '';
  }
  const spaced = trimmed.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced
    .split(' ')
    .map(token => (token ? token[0].toUpperCase() + token.slice(1) : ''))
    .join(' ');
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

function buildCueModules(cues) {
  const modulesByKey = new Map();
  cues.forEach(cue => {
    const slotIds = normalizeSlotList(cue.slotCoverage);
    const key = slotIds.length ? slotIds.slice().sort().join('-') : 'general';
    let module = modulesByKey.get(key);
    if (!module) {
      const summary = slotIds.length
        ? formatObservationFormulaSlotSummary(slotIds, { includeArticle: false })
        : '';
      module = {
        id: `module-${key}`,
        slotIds,
        label: slotIds.length
          ? `Formula coverage: ${summary}`
          : 'General observational cues',
        summary: slotIds.length
          ? `Supports the ${summary}.`
          : 'Patterns that still need schema mapping to the observation formula.',
        cues: [],
        examples: [],
      };
      modulesByKey.set(key, module);
    }
    module.cues.push(cue);
    if (cue.phrase) {
      module.examples.push(cue.phrase);
    }
    cue.moduleId = module.id;
  });
  return Array.from(modulesByKey.values()).map(module => ({
    ...module,
    examples: uniqueStrings(module.examples).slice(0, 3),
  }));
}

function buildSlotIndex(modules) {
  const index = {};
  modules.forEach(module => {
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

function resolveCueList(source) {
  if (Array.isArray(source)) {
    return source;
  }
  if (source && Array.isArray(source.cues)) {
    return source.cues;
  }
  return [];
}

function collectMatchedModules(hits, source) {
  const modules = Array.isArray(source?.modules) ? source.modules : [];
  if (!modules.length) {
    return [];
  }
  const lookup = new Map(modules.map(module => [module.id, module]));
  const counts = new Map();
  hits.forEach(hit => {
    const moduleId = hit.moduleId;
    if (!moduleId || !lookup.has(moduleId)) {
      return;
    }
    const existing = counts.get(moduleId) || { ...lookup.get(moduleId), count: 0 };
    existing.count += 1;
    counts.set(moduleId, existing);
  });
  return Array.from(counts.values()).map(entry => ({
    id: entry.id,
    label: entry.label,
    summary: entry.summary,
    slotIds: Array.isArray(entry.slotIds) ? entry.slotIds : [],
    count: entry.count,
  }));
}

function buildSlotSummary(formula, hits) {
  const supportCounts = new Map();
  hits.forEach(hit => {
    const slots = Array.isArray(hit.slotMatches) ? hit.slotMatches : [];
    slots.forEach(slotId => {
      if (!slotId) {
        return;
      }
      supportCounts.set(slotId, (supportCounts.get(slotId) || 0) + 1);
    });
  });
  const coveredIds = Array.from(supportCounts.keys());
  const missingIds = Array.isArray(formula?.missingIds) ? formula.missingIds : [];
  return {
    coveredIds,
    missingIds,
    supportCounts: Object.fromEntries(supportCounts),
    supportSummary: formatObservationFormulaSlotSummary(coveredIds, { includeArticle: false }),
    missingSummary: formatObservationFormulaSlotSummary(missingIds, { includeArticle: false }),
  };
}

function normalizeSlotList(values) {
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

export function suggestFromObservation(text, source, maxEach = 6) {
  const profile = createObservationProfile(text);
  const cues = resolveCueList(source);
  const hits = [];
  cues.forEach(cue => {
    const result = matchCueRow(profile, cue);
    if (result) {
      hits.push(result);
    }
  });
  const feelings = [...new Set(hits.flatMap(h => h.feelings || []))].slice(0, maxEach);
  const needs = [...new Set(hits.flatMap(h => h.needs || []))].slice(0, maxEach);
  const why = hits.map(h => h.cue);
  const modules = collectMatchedModules(hits, source);
  const slots = buildSlotSummary(profile.formula, hits);
  return { feelings, needs, why, hits, modules, slots };
}

function parseCSV(str) {
  const out = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      if (inQ && str[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
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
      if (ch === '\r' && str[i + 1] === '\n') i++;
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
