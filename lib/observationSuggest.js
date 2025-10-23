import { createObservationProfile, matchCueRow } from './observationCueMatcher.js';
import {
  compileObservationCueLibrary,
  formatCueLabel,
  parseObservationCueCSV,
  parseObservationCueModules,
} from './observationCueData.js';
import { formatObservationFormulaSlotSummary } from './observationFormula.js';

const DEFAULT_MAX_MODULE_HITS = 6;

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

export function suggestFromObservation(text, source, maxEach = 6, options = {}) {
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

  const ranked = rankModuleHits(hits);
  const maxModules = Math.max(Number.isFinite(options.maxModules) ? Number(options.maxModules) : DEFAULT_MAX_MODULE_HITS, 0);
  const limitedHits = maxModules > 0 ? ranked.slice(0, maxModules) : ranked;
  const overflow = Math.max(ranked.length - limitedHits.length, 0);

  const feelings = uniqueStrings(limitedHits.flatMap(hit => hit.module.feelings || [])).slice(0, maxEach);
  const needs = uniqueStrings(limitedHits.flatMap(hit => hit.module.needs || [])).slice(0, maxEach);
  const why = limitedHits.map(hit => hit.module.label || formatCueLabel(hit.module.id)).filter(Boolean);
  const modulesSummary = collectMatchedModules(limitedHits);
  const slots = buildSlotSummary(profile.formula, limitedHits);

  return { feelings, needs, why, hits: limitedHits, modules: modulesSummary, slots, overflow, totalHits: ranked.length };
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

function rankModuleHits(hits, options = {}) {
  const scored = (Array.isArray(hits) ? hits : [])
    .map(hit => ({ ...hit, score: scoreModuleHit(hit) }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const aLabel = a.module?.label || formatCueLabel(a.module?.id) || '';
      const bLabel = b.module?.label || formatCueLabel(b.module?.id) || '';
      return aLabel.localeCompare(bLabel);
    });

  const max = Math.max(Number(options.max) || 0, 0);
  if (max && scored.length > max) {
    return scored.slice(0, max);
  }
  return scored;
}

function scoreModuleHit(hit) {
  if (!hit || !hit.module) {
    return 0;
  }
  let score = 0;
  const match = hit.match || {};
  switch (match.type) {
    case 'pattern':
      score += 60;
      break;
    case 'regex':
      score += 50;
      break;
    case 'tokens': {
      const tokenCount = Array.isArray(match.tokens) ? match.tokens.length : 0;
      score += 30 + Math.min(tokenCount, 5) * 4;
      break;
    }
    default:
      score += 10;
  }
  if (typeof match.index === 'number') {
    const proximityBoost = Math.max(0, 20 - Math.min(match.index, 200) / 10);
    score += proximityBoost;
  }
  const slotMatchCount = Array.isArray(hit.slotMatches) ? hit.slotMatches.length : 0;
  const slotCoverageCount = Array.isArray(hit.slotCoverage) ? hit.slotCoverage.length : 0;
  score += slotMatchCount * 12;
  score += slotCoverageCount * 4;
  const gapCount = Array.isArray(hit.slotGaps) ? hit.slotGaps.length : 0;
  score -= gapCount * 3;
  const feelingCount = Array.isArray(hit.module.feelings) ? hit.module.feelings.length : 0;
  const needCount = Array.isArray(hit.module.needs) ? hit.module.needs.length : 0;
  score += Math.min(feelingCount, 3) * 2;
  score += Math.min(needCount, 3) * 2;
  return score;
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
