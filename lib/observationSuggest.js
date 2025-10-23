import { createObservationProfile, matchCueRow } from './observationCueMatcher.js';
import {
  compileObservationCueLibrary,
  formatCueLabel,
  parseObservationCueCSV,
  parseObservationCueModules,
} from './observationCueData.js';
import { formatObservationFormulaSlotSummary } from './observationFormula.js';

export async function loadCueLibrary(
  csvUrl,
  modulesUrl = '/data/observation_cue_modules.json',
) {
  const [csvText, moduleText] = await Promise.all([
    fetch(csvUrl).then(r => r.text()),
    fetch(modulesUrl)
      .then(r => (r.ok ? r.text() : '[]'))
      .catch(() => '[]'),
  ]);
  const cues = parseObservationCueCSV(csvText);
  const moduleDefs = parseObservationCueModules(moduleText);
  return compileObservationCueLibrary({ cues, modules: moduleDefs });
}

export async function loadCueRows(csvUrl) {
  const library = await loadCueLibrary(csvUrl);
  return library.cues;
}

export function suggestFromObservation(text, source, maxEach = 6) {
  const profile = createObservationProfile(text);
  const library = resolveCueLibrary(source);
  const modules = resolveModuleList(library);

  const hits = [];
  modules.forEach(module => {
    const hit = matchModule(profile, module);
    if (hit) {
      hits.push(hit);
    }
  });

  const feelings = uniqueStrings(hits.flatMap(hit => hit.module.feelings || [])).slice(0, maxEach);
  const needs = uniqueStrings(hits.flatMap(hit => hit.module.needs || [])).slice(0, maxEach);
  const why = hits.map(hit => hit.module.label || formatCueLabel(hit.module.id)).filter(Boolean);
  const modulesSummary = collectMatchedModules(hits);
  const slots = buildSlotSummary(profile.formula, hits);

  return { feelings, needs, why, hits, modules: modulesSummary, slots };
}

function resolveCueLibrary(source) {
  if (!source) {
    return { cues: [], modules: [], slotIndex: {} };
  }
  if (Array.isArray(source)) {
    return { cues: source, modules: [], slotIndex: {} };
  }
  return {
    cues: Array.isArray(source.cues) ? source.cues : [],
    modules: Array.isArray(source.modules) ? source.modules : [],
    slotIndex: source.slotIndex || {},
  };
}

function resolveModuleList(source) {
  if (Array.isArray(source)) {
    return [];
  }
  if (Array.isArray(source.modules)) {
    return source.modules;
  }
  if (Array.isArray(source?.modules)) {
    return source.modules;
  }
  return [];
}

function matchModule(profile, module) {
  if (!profile || !module || !Array.isArray(module.matchers) || !module.matchers.length) {
    return null;
  }
  const row = {
    matchers: module.matchers,
    slotCoverage: Array.isArray(module.slotIds) ? module.slotIds : [],
  };
  const result = matchCueRow(profile, row);
  if (!result) {
    return null;
  }
  return {
    module,
    match: result.match,
    slotMatches: result.slotMatches || [],
    slotGaps: result.slotGaps || [],
  };
}

function collectMatchedModules(hits) {
  const counts = new Map();
  hits.forEach(hit => {
    const module = hit.module;
    if (!module) {
      return;
    }
    const existing = counts.get(module.id) || {
      id: module.id,
      label: module.label,
      summary: module.summary,
      slotIds: Array.isArray(module.slotIds) ? module.slotIds : [],
      count: 0,
      slotMatches: new Set(),
      slotGaps: new Set(),
    };
    existing.count += 1;
    (hit.slotMatches || []).forEach(id => existing.slotMatches.add(id));
    (hit.slotGaps || []).forEach(id => existing.slotGaps.add(id));
    counts.set(module.id, existing);
  });
  return Array.from(counts.values()).map(entry => ({
    id: entry.id,
    label: entry.label,
    summary: entry.summary,
    slotIds: entry.slotIds,
    count: entry.count,
    slotMatches: Array.from(entry.slotMatches),
    slotGaps: Array.from(entry.slotGaps),
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
