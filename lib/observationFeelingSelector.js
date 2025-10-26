export function chooseFeelingsForNeeds(feelingsByNeed, needSlugs, mode = 'unmet', limit = 4) {
  const normalizedMode = mode === 'met' ? 'met' : 'unmet';
  const max = resolveLimit(limit, 4);
  if (max <= 0) {
    return [];
  }

  const normalizedNeeds = normalizeSlugList(needSlugs);
  if (!normalizedNeeds.length) {
    return [];
  }

  const seen = new Set();
  const results = [];

  normalizedNeeds.forEach(needSlug => {
    const entry = getFeelingsEntry(feelingsByNeed, needSlug);
    if (!entry) {
      return;
    }
    const candidates = Array.isArray(entry[normalizedMode]) ? entry[normalizedMode] : [];
    candidates.forEach(slug => {
      const normalized = normalizeSlug(slug);
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      results.push(normalized);
    });
  });

  return results.slice(0, max);
}

function getFeelingsEntry(index, needSlug) {
  if (!index || !needSlug) {
    return null;
  }
  if (typeof index.get === 'function') {
    return index.get(needSlug) || null;
  }
  if (typeof index === 'object' && index !== null) {
    return index[needSlug] || null;
  }
  return null;
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
