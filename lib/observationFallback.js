export function aggregateFallbackSuggestions(text, cues, options = {}) {
  if (!text || !Array.isArray(cues) || !cues.length) {
    return [];
  }

  const tokens = tokenizeForScore(text);
  const tokenSet = new Set(tokens);
  const normalized = String(text).toLowerCase();

  const candidates = cues
    .map(cue => {
      if (!cue) {
        return null;
      }
      const feelings = normalizeSlugList(cue.feelings);
      const needs = normalizeSlugList(cue.needs);
      if (!feelings.length && !needs.length) {
        return null;
      }
      const score = scoreCueMatch(tokenSet, normalized, cue);
      const label = typeof cue.label === 'string' && cue.label.trim()
        ? cue.label.trim()
        : typeof cue.cue === 'string' && cue.cue.trim()
          ? cue.cue.trim()
          : typeof cue.id === 'string' && cue.id.trim()
            ? cue.id.trim()
            : '';
      return { id: cue.id || '', label, feelings, needs, score };
    })
    .filter(Boolean);

  if (!candidates.length) {
    return [];
  }

  const positive = candidates.filter(entry => entry.score > 0);
  const pool = positive.length ? positive : candidates;

  pool.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const aCount = a.feelings.length + a.needs.length;
    const bCount = b.feelings.length + b.needs.length;
    if (bCount !== aCount) {
      return bCount - aCount;
    }
    const aLabel = a.label || a.id || '';
    const bLabel = b.label || b.id || '';
    return aLabel.localeCompare(bLabel);
  });

  const needLimit = resolveLimit(options.needLimit, 4);
  const feelingLimit = resolveLimit(options.feelingLimit, 4);

  const needStats = new Map();
  pool.forEach((entry, index) => {
    entry.needs.forEach(needSlug => {
      if (!needSlug) {
        return;
      }
      const existing = needStats.get(needSlug) || { slug: needSlug, score: 0, count: 0, firstIndex: index };
      existing.score += entry.score;
      existing.count += 1;
      if (index < existing.firstIndex) {
        existing.firstIndex = index;
      }
      needStats.set(needSlug, existing);
    });
  });

  if (!needStats.size) {
    return [];
  }

  const rankedNeeds = Array.from(needStats.values())
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
    .slice(0, needLimit)
    .filter(entry => Boolean(entry?.slug));

  if (!rankedNeeds.length) {
    return [];
  }

  const needSlugs = rankedNeeds.map(entry => entry.slug);
  const feelings = selectFeelingsFromPool(pool, needSlugs, feelingLimit);

  return [
    {
      needs: needSlugs,
      feelings,
      total: needSlugs.length + feelings.length,
      candidates: pool.length,
    },
  ];
}

export function tokenizeForScore(text) {
  if (!text) {
    return [];
  }
  const matches = String(text)
    .toLowerCase()
    .match(/[a-z0-9'’]+/g);
  return matches ? matches : [];
}

export function scoreCueMatch(tokenSet, normalizedText, cue) {
  const sources = [];
  if (Array.isArray(cue?.phrases)) {
    cue.phrases.forEach(phrase => {
      if (typeof phrase === 'string' && phrase.trim()) {
        sources.push(phrase);
      }
    });
  }
  if (typeof cue?.phrase === 'string' && cue.phrase.trim()) {
    sources.push(cue.phrase);
  }
  if (typeof cue?.example === 'string' && cue.example.trim()) {
    sources.push(cue.example);
  }
  if (typeof cue?.label === 'string' && cue.label.trim()) {
    sources.push(cue.label);
  }
  if (typeof cue?.cue === 'string' && cue.cue.trim()) {
    sources.push(cue.cue);
  }

  let best = 0;
  sources.forEach(source => {
    const sourceTokens = tokenizeForScore(source);
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
    const lower = source.toLowerCase();
    if (normalizedText.includes(lower)) {
      score += Math.min(4, lower.length / 12);
    }
    if (score > best) {
      best = score;
    }
  });

  return best;
}

function selectFeelingsFromPool(pool, needSlugs, limit) {
  const normalizedNeeds = normalizeSlugList(needSlugs);
  const feelingLimit = resolveLimit(limit, 4);
  if (!normalizedNeeds.length || feelingLimit <= 0) {
    return [];
  }

  const needSet = new Set(normalizedNeeds);
  const stats = new Map();

  pool.forEach((entry, index) => {
    const overlap = entry.needs.reduce((count, need) => count + (needSet.has(need) ? 1 : 0), 0);
    if (overlap <= 0) {
      return;
    }
    entry.feelings.forEach(feeling => {
      if (!feeling) {
        return;
      }
      const existing = stats.get(feeling) || { slug: feeling, score: 0, count: 0, firstIndex: index };
      existing.score += overlap;
      existing.count += 1;
      if (index < existing.firstIndex) {
        existing.firstIndex = index;
      }
      stats.set(feeling, existing);
    });
  });

  let ranked = Array.from(stats.values()).sort((a, b) => {
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
  });

  if (ranked.length < feelingLimit) {
    const seen = new Set(ranked.map(entry => entry.slug));
    for (const entry of pool) {
      for (const feeling of entry.feelings) {
        if (!feeling || seen.has(feeling)) {
          continue;
        }
        ranked.push({ slug: feeling, score: 0, count: 0, firstIndex: Infinity });
        seen.add(feeling);
        if (ranked.length >= feelingLimit) {
          break;
        }
      }
      if (ranked.length >= feelingLimit) {
        break;
      }
    }
  }

  return ranked.slice(0, feelingLimit).map(entry => entry.slug);
}

function normalizeSlugList(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  const seen = new Set();
  const result = [];
  values.forEach(value => {
    const slug = normalizeSlug(value);
    if (!slug || seen.has(slug)) {
      return;
    }
    seen.add(slug);
    result.push(slug);
  });
  return result;
}

function normalizeSlug(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return trimmed;
}

function resolveLimit(value, fallback) {
  if (Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (Number.isFinite(fallback)) {
    return Math.max(0, Math.floor(fallback));
  }
  return 0;
}
