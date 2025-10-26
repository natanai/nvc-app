import { normalizeSlug } from './observationSuggest.js';

function tokenizeForScore(text) {
  return (text || '').toLowerCase().match(/[a-z0-9'’]+/g) || [];
}

function scoreCueMatch(tokenSet, normalizedText, cue) {
  const sources = [];
  if (Array.isArray(cue?.phrases)) {
    sources.push(...cue.phrases);
  }
  if (cue?.phrase) {
    sources.push(cue.phrase);
  }
  if (cue?.example) {
    sources.push(cue.example);
  }
  if (cue?.label) {
    sources.push(cue.label);
  }
  if (cue?.cue) {
    sources.push(cue.cue);
  }

  let best = 0;
  sources.forEach(source => {
    const value = typeof source === 'string' ? source.trim() : '';
    if (!value) {
      return;
    }
    const sourceTokens = tokenizeForScore(value);
    if (!sourceTokens.length) {
      return;
    }
    let matches = 0;
    sourceTokens.forEach(token => {
      if (tokenSet.has(token)) {
        matches += 1;
      }
    });
    let score = matches;
    if (matches) {
      score += matches / sourceTokens.length;
    }
    const lower = value.toLowerCase();
    if (normalizedText.includes(lower)) {
      score += Math.min(4, lower.length / 12);
    }
    if (score > best) {
      best = score;
    }
  });

  return best;
}

function rankFallbackCandidates(candidates) {
  const positive = candidates.filter(entry => entry.score > 0);
  const pool = positive.length ? positive : candidates;

  return pool
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const aCount = a.feelings.length + a.needs.length;
      const bCount = b.feelings.length + b.needs.length;
      if (bCount !== aCount) {
        return bCount - aCount;
      }
      const aLabel = a.cue?.label || a.cue?.cue || '';
      const bLabel = b.cue?.label || b.cue?.cue || '';
      return aLabel.localeCompare(bLabel);
    });
}

export function computeFallbackSuggestion(text, cues, options = {}) {
  if (!text || !Array.isArray(cues) || !cues.length) {
    return null;
  }

  const needLimit = Math.max(1, Math.floor(options.needLimit || 4));
  const feelingLimit = Math.max(0, Math.floor(options.feelingLimit || 4));

  const tokens = tokenizeForScore(text);
  const tokenSet = new Set(tokens);
  const normalized = text.toLowerCase();

  const candidates = cues
    .map(cue => {
      const feelings = (Array.isArray(cue?.feelings) ? cue.feelings : [])
        .map(normalizeSlug)
        .filter(Boolean);
      const needs = (Array.isArray(cue?.needs) ? cue.needs : [])
        .map(normalizeSlug)
        .filter(Boolean);
      if (!feelings.length && !needs.length) {
        return null;
      }
      const score = scoreCueMatch(tokenSet, normalized, cue);
      return { cue, feelings, needs, score };
    })
    .filter(Boolean);

  if (!candidates.length) {
    return null;
  }

  const ranked = rankFallbackCandidates(candidates);

  const needStats = new Map();
  const feelingByNeed = new Map();

  ranked.forEach(entry => {
    entry.needs.forEach(needSlug => {
      const existing = needStats.get(needSlug) || { slug: needSlug, score: 0, hits: 0 };
      existing.score += entry.score;
      existing.hits += 1;
      needStats.set(needSlug, existing);

      if (!feelingByNeed.has(needSlug)) {
        feelingByNeed.set(needSlug, new Map());
      }
      const feelingStats = feelingByNeed.get(needSlug);
      entry.feelings.forEach(feelingSlug => {
        const stat = feelingStats.get(feelingSlug) || { slug: feelingSlug, score: 0, hits: 0 };
        stat.score += entry.score;
        stat.hits += 1;
        feelingStats.set(feelingSlug, stat);
      });
    });
  });

  const prioritizedNeedSlugs = [];
  const seenNeeds = new Set();

  ranked.forEach(entry => {
    entry.needs.forEach(needSlug => {
      if (!needSlug || seenNeeds.has(needSlug) || prioritizedNeedSlugs.length >= needLimit) {
        return;
      }
      seenNeeds.add(needSlug);
      prioritizedNeedSlugs.push(needSlug);
    });
  });

  if (prioritizedNeedSlugs.length < needLimit) {
    const remaining = Array.from(needStats.values())
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (b.hits !== a.hits) {
          return b.hits - a.hits;
        }
        return a.slug.localeCompare(b.slug);
      })
      .map(entry => entry.slug);

    for (const slug of remaining) {
      if (!slug || seenNeeds.has(slug)) {
        continue;
      }
      prioritizedNeedSlugs.push(slug);
      seenNeeds.add(slug);
      if (prioritizedNeedSlugs.length >= needLimit) {
        break;
      }
    }
  }

  if (!prioritizedNeedSlugs.length) {
    return null;
  }

  const combinedFeelingStats = new Map();
  prioritizedNeedSlugs.forEach(needSlug => {
    const feelingStats = feelingByNeed.get(needSlug);
    if (!feelingStats) {
      return;
    }
    feelingStats.forEach((stat, slug) => {
      const existing = combinedFeelingStats.get(slug) || { slug, score: 0, hits: 0 };
      existing.score += stat.score;
      existing.hits += stat.hits;
      combinedFeelingStats.set(slug, existing);
    });
  });

  const rankedFeelings = Array.from(combinedFeelingStats.values())
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.hits !== a.hits) {
        return b.hits - a.hits;
      }
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, feelingLimit)
    .map(entry => entry.slug);

  return { needSlugs: prioritizedNeedSlugs, feelingSlugs: rankedFeelings };
}
