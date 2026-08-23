import { createObservationProfile, matchCueRow } from './observationCueMatcher.js';
import {
  compileObservationCueLibrary,
  formatCueLabel,
  parseObservationCueCSV,
  parseObservationCueModules,
} from './observationCueData.js';
import { formatObservationFormulaSlotSummary } from './observationFormula.js';

const DEFAULT_MAX_MODULE_HITS = 6;
const DEFAULT_NEED_SUGGESTION_LIMIT = 4;
const DEFAULT_FEELING_SUGGESTION_LIMIT = 4;

export async function loadCueLibrary(
  csvUrl,
  modulesUrl = '/data/observation_cue_modules.json',
) {
  const readAsset = async (url, label) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to load ${label}: HTTP ${response.status}`);
    }
    return response.text();
  };

  const [cueResult, moduleResult] = await Promise.allSettled([
    readAsset(csvUrl, 'observation cue rows'),
    readAsset(modulesUrl, 'observation cue modules'),
  ]);

  const cues = cueResult.status === 'fulfilled'
    ? parseObservationCueCSV(cueResult.value)
    : [];
  const moduleDefs = moduleResult.status === 'fulfilled'
    ? parseObservationCueModules(moduleResult.value)
    : [];

  if (cueResult.status === 'rejected') {
    console.warn('Observation cue rows unavailable; continuing with the compiled module artifact.', cueResult.reason);
  }
  if (moduleResult.status === 'rejected') {
    console.warn('Observation cue modules unavailable; continuing with cue-row modules.', moduleResult.reason);
  }

  const library = compileObservationCueLibrary({ cues, modules: moduleDefs });
  if (!library.modules.length) {
    const causes = [cueResult, moduleResult]
      .filter(result => result.status === 'rejected')
      .map(result => result.reason?.message || String(result.reason || 'unknown load failure'));
    throw new Error(`Observation detector has no usable modules${causes.length ? `: ${causes.join('; ')}` : ''}.`);
  }
  return library;
}

export async function loadCueRows(csvUrl) {
  const library = await loadCueLibrary(csvUrl);
  return library.cues;
}

export function collectCatalogFeelings(catalog, needs, mode = 'unmet', limit = 4) {
  const bucketKey = mode === 'met' ? 'met' : 'unmet';
  const needSlugs = (Array.isArray(needs) ? needs : []).map(normalizeSlug).filter(Boolean);
  if (!needSlugs.length) {
    return [];
  }
  const registry = catalog?.feelingsByNeed;
  if (!(registry instanceof Map)) {
    return [];
  }
  const cappedLimit = Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 4));
  if (cappedLimit <= 0) {
    return [];
  }

  const stats = new Map();
  needSlugs.forEach((needSlug, needIndex) => {
    const entry = registry.get(needSlug);
    if (!entry) {
      return;
    }
    const feelings = Array.isArray(entry[bucketKey]) ? entry[bucketKey] : [];
    feelings.forEach((feelingSlug, feelingIndex) => {
      const slug = normalizeSlug(feelingSlug);
      if (!slug) {
        return;
      }
      const weight = 1 / (feelingIndex + 1);
      const existing = stats.get(slug) || {
        slug,
        score: 0,
        count: 0,
        firstNeedIndex: needIndex,
        firstFeelingIndex: feelingIndex,
      };
      existing.score += weight;
      existing.count += 1;
      if (needIndex < existing.firstNeedIndex) {
        existing.firstNeedIndex = needIndex;
      }
      if (feelingIndex < existing.firstFeelingIndex) {
        existing.firstFeelingIndex = feelingIndex;
      }
      stats.set(slug, existing);
    });
  });

  return Array.from(stats.values())
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      if (a.firstNeedIndex !== b.firstNeedIndex) {
        return a.firstNeedIndex - b.firstNeedIndex;
      }
      if (a.firstFeelingIndex !== b.firstFeelingIndex) {
        return a.firstFeelingIndex - b.firstFeelingIndex;
      }
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, cappedLimit)
    .map(entry => entry.slug);
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

  const maxEachLimit = Number.isFinite(maxEach) ? Math.max(0, Math.floor(maxEach)) : Infinity;
  const requestedNeedLimit = resolveSuggestionLimit(options.maxNeeds, DEFAULT_NEED_SUGGESTION_LIMIT);
  const requestedFeelingLimit = resolveSuggestionLimit(options.maxFeelings, DEFAULT_FEELING_SUGGESTION_LIMIT);
  const needLimit = Math.min(requestedNeedLimit, maxEachLimit);
  const feelingLimit = Math.min(requestedFeelingLimit, maxEachLimit);

  const needs = collectNearestNeeds(limitedHits, needLimit);
  const feelingsForNeeds = collectFeelingsForNeeds(limitedHits, needs, feelingLimit);
  const fallbackFeelingLimit = feelingLimit > 0
    ? feelingLimit
    : maxEachLimit > 0
      ? maxEachLimit
      : 0;
  const feelings = feelingsForNeeds.length
    ? feelingsForNeeds
    : collectFeelings(limitedHits, fallbackFeelingLimit);
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

function resolveSuggestionLimit(value, fallback) {
  if (Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  return Math.max(0, Math.floor(fallback));
}

function collectNearestNeeds(hits, limit) {
  if (!Array.isArray(hits) || limit <= 0) {
    return [];
  }
  const seen = new Set();
  const result = [];
  for (const hit of hits) {
    const needs = Array.isArray(hit?.module?.needs) ? hit.module.needs : [];
    for (const need of needs) {
      const slug = normalizeSlug(need);
      if (!slug || seen.has(slug)) {
        continue;
      }
      seen.add(slug);
      result.push(slug);
      if (result.length >= limit) {
        return result;
      }
    }
  }
  return result;
}

function collectFeelingsForNeeds(hits, needs, limit) {
  if (!Array.isArray(hits) || limit <= 0) {
    return [];
  }
  const normalizedNeeds = (Array.isArray(needs) ? needs : []).map(normalizeSlug).filter(Boolean);
  if (!normalizedNeeds.length) {
    return [];
  }
  const needSet = new Set(normalizedNeeds);
  const stats = new Map();

  hits.forEach((hit, index) => {
    const moduleNeeds = (Array.isArray(hit?.module?.needs) ? hit.module.needs : [])
      .map(normalizeSlug)
      .filter(Boolean);
    if (!moduleNeeds.length) {
      return;
    }
    const overlap = moduleNeeds.reduce((count, need) => count + (needSet.has(need) ? 1 : 0), 0);
    if (overlap <= 0) {
      return;
    }
    const feelings = Array.isArray(hit?.module?.feelings) ? hit.module.feelings : [];
    feelings.forEach(feeling => {
      const slug = normalizeSlug(feeling);
      if (!slug) {
        return;
      }
      const existing = stats.get(slug) || { slug, score: 0, count: 0, firstIndex: index };
      existing.score += overlap;
      existing.count += 1;
      if (index < existing.firstIndex) {
        existing.firstIndex = index;
      }
      stats.set(slug, existing);
    });
  });

  return Array.from(stats.values())
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      if (a.firstIndex !== b.firstIndex) {
        return a.firstIndex - b.firstIndex;
      }
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, limit)
    .map(entry => entry.slug);
}

function collectFeelings(hits, limit) {
  if (!Array.isArray(hits) || limit <= 0) {
    return [];
  }
  const feelings = uniqueStrings(
    hits.flatMap(hit => (Array.isArray(hit?.module?.feelings) ? hit.module.feelings : [])),
  );
  const boundedLimit = Math.max(0, Math.floor(limit));
  if (boundedLimit === 0) {
    return [];
  }
  return feelings.slice(0, boundedLimit);
}

export function normalizeSlug(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return trimmed;
}
