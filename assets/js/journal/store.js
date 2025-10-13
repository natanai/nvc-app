import { makeEntry } from './model.js';

const STORAGE_KEY = 'journal:v2';
const LEGACY_KEYS = ['nvcApp.journal', 'alexithymiaSupportJournal'];
const DRAFT_PREFIX = 'draft:';
const CORRUPT_PREFIX = 'journal:corrupt:';
const TAG_LIMIT_DEFAULT = 30;

const isBrowser = typeof window !== 'undefined';

const cache = {
  loaded: false,
  entries: [],
  sorted: [],
  byId: new Map(),
  search: new Map(),
};

const getStorage = () => {
  if (!isBrowser) {
    return null;
  }
  try {
    return window.localStorage;
  } catch (error) {
    console.warn('Journal store: localStorage unavailable', error);
    return null;
  }
};

const backupCorrupt = (key, raw) => {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    const payload = JSON.stringify({ key, value: raw });
    storage.setItem(`${CORRUPT_PREFIX}${Date.now()}`, payload);
  } catch (error) {
    console.warn('Journal store: unable to back up corrupt data', error);
  }
};

const parseArray = (raw, key) => {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      backupCorrupt(key, raw);
      const storage = getStorage();
      storage?.setItem?.(key, '[]');
      return [];
    }
    return parsed;
  } catch (error) {
    backupCorrupt(key, raw);
    const storage = getStorage();
    storage?.setItem?.(key, '[]');
    return [];
  }
};

const sanitizeScale = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return undefined;
  }
  const clamped = Math.min(10, Math.max(0, Math.round(number)));
  return clamped;
};

const sanitizeFloat = (value, { min = -Infinity, max = Infinity } = {}) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return undefined;
  }
  const clamped = Math.min(max, Math.max(min, number));
  return clamped;
};

const uniqueStrings = (values) => {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) {
      return;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(normalized);
  });
  return result;
};

const normalizeStringList = (value, { separator = /[,|]/ } = {}) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return uniqueStrings(value.map((item) => (typeof item === 'string' ? item : String(item))));
  }
  if (typeof value === 'string') {
    return uniqueStrings(
      value
        .split(separator)
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }
  return [];
};

const normalizeTags = (value) =>
  normalizeStringList(value, {
    separator: /[,|]/,
  })
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter(Boolean);

const ZONE_PATTERN = /^(low|medium|high)-(pleasant|neutral|unpleasant)$/;

const sanitizeZoneKey = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  if (ZONE_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
};

const normalizeEmotionCandidates = (value) => {
  if (!value) {
    return [];
  }
  if (typeof value === 'string') {
    return normalizeStringList(value).map((emotion) => ({ emotion, confidence: null }));
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Map();
  value.forEach((item) => {
    let emotion = '';
    let confidence = null;
    if (typeof item === 'string') {
      emotion = item.trim();
    } else if (item && typeof item === 'object') {
      if (typeof item.emotion === 'string') {
        emotion = item.emotion.trim();
      } else if (typeof item.key === 'string') {
        emotion = item.key.trim();
      } else if (typeof item.name === 'string') {
        emotion = item.name.trim();
      }
      const candidateConfidence =
        item.confidence ?? item.score ?? item.value ?? item.probability ?? item.weight;
      const normalizedConfidence = sanitizeFloat(candidateConfidence, { min: 0, max: 1 });
      if (typeof normalizedConfidence === 'number') {
        confidence = normalizedConfidence;
      }
    }
    if (!emotion) {
      return;
    }
    const key = emotion.toLowerCase();
    const existing = seen.get(key);
    if (!existing || (typeof confidence === 'number' && confidence > (existing.confidence ?? -1))) {
      seen.set(key, { emotion, confidence: typeof confidence === 'number' ? confidence : null });
    }
  });
  return Array.from(seen.values());
};

const normalizeRegulationUsed = (value) => normalizeStringList(value);

const normalizeNeeds = (value, fallback) => {
  const normalized = normalizeStringList(value);
  if (normalized.length) {
    return normalized;
  }
  if (fallback) {
    return normalizeStringList(fallback);
  }
  return [];
};

const normalizeDate = (value) => {
  if (!value) {
    return new Date().toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  const stringValue = value.toString();
  const parsed = new Date(stringValue);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
};

const coerceEmotion = (value) => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value && typeof value === 'object' && typeof value.key === 'string') {
    return value.key.trim();
  }
  return '';
};

const coerceNotes = (value) => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value && typeof value === 'object') {
    if (typeof value.text === 'string') {
      return value.text.trim();
    }
    if (typeof value.notes === 'string') {
      return value.notes.trim();
    }
    if (typeof value.entry === 'string') {
      return value.entry.trim();
    }
  }
  return '';
};

const normalizeEntry = (raw = {}) => {
  const base = makeEntry();
  const extras = raw && typeof raw === 'object' ? { ...raw } : {};

  const overrides = {};
  const incomingId = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
  overrides.id = incomingId || base.id;

  overrides.dateISO = normalizeDate(
    raw.dateISO ?? raw.timestamp ?? raw.createdAt ?? raw.date ?? raw.savedAt ?? extras.dateISO
  );

  overrides.emotion = coerceEmotion(raw.emotion ?? extras.emotion);

  const intensityCandidate = raw.intensity ?? raw.intensityValue ?? extras.intensity;
  overrides.intensity = sanitizeScale(intensityCandidate);

  const confidenceCandidate = raw.confidence ?? raw.confidenceValue ?? extras.confidence;
  overrides.confidence = sanitizeScale(confidenceCandidate);

  const energyCandidate = raw.energy ?? raw.energyValue ?? extras.energy;
  overrides.energy = sanitizeFloat(energyCandidate, { min: -1, max: 1 });

  const valenceCandidate = raw.valence ?? raw.valenceValue ?? extras.valence;
  overrides.valence = sanitizeFloat(valenceCandidate, { min: -1, max: 1 });

  const zoneCandidate = raw.zone ?? raw.quadrant ?? extras.zone;
  overrides.zone = sanitizeZoneKey(zoneCandidate);

  overrides.emotionCandidates = normalizeEmotionCandidates(
    raw.emotionCandidates ?? raw.candidateEmotions ?? extras.emotionCandidates
  );

  const chosenConfidenceCandidate =
    raw.chosenEmotionConfidence ?? raw.chosenConfidence ?? extras.chosenEmotionConfidence;
  const normalizedChosenConfidence = sanitizeFloat(chosenConfidenceCandidate, { min: 0, max: 1 });
  overrides.chosenEmotionConfidence =
    typeof normalizedChosenConfidence === 'number' ? normalizedChosenConfidence : undefined;

  overrides.sensations = normalizeStringList(
    raw.sensations ?? raw.bodySignals ?? raw.bodySensations ?? extras.sensations
  );
  overrides.needs = normalizeNeeds(raw.needs ?? extras.needs, raw.need ?? raw.primaryNeed);
  overrides.strategies = normalizeStringList(raw.strategies ?? raw.strategy ?? raw.actions ?? extras.strategies);
  overrides.tags = normalizeTags(raw.tags ?? raw.tagList ?? raw.tag ?? extras.tags);
  overrides.notes = coerceNotes(raw.notes ?? raw.text ?? raw.entry ?? extras.notes ?? extras.text);

  overrides.regulationUsed = normalizeRegulationUsed(
    raw.regulationUsed ?? raw.skills ?? raw.interventions ?? extras.regulationUsed
  );

  const source = typeof raw.source === 'string' ? raw.source.trim().toLowerCase() : '';
  overrides.source = source === 'lane' ? 'lane' : 'journal';

  return {
    ...base,
    ...extras,
    ...overrides,
    sensations: Array.isArray(overrides.sensations) ? overrides.sensations : [],
    needs: Array.isArray(overrides.needs) ? overrides.needs : [],
    strategies: Array.isArray(overrides.strategies) ? overrides.strategies : [],
    tags: Array.isArray(overrides.tags) ? overrides.tags : [],
    emotionCandidates: Array.isArray(overrides.emotionCandidates)
      ? overrides.emotionCandidates.map(({ emotion, confidence }) => ({
          emotion,
          confidence: typeof confidence === 'number' ? confidence : null,
        }))
      : [],
    regulationUsed: Array.isArray(overrides.regulationUsed) ? overrides.regulationUsed : [],
  };
};

const cloneEntry = (entry) => ({
  ...entry,
  sensations: Array.isArray(entry.sensations) ? [...entry.sensations] : [],
  needs: Array.isArray(entry.needs) ? [...entry.needs] : [],
  strategies: Array.isArray(entry.strategies) ? [...entry.strategies] : [],
  tags: Array.isArray(entry.tags) ? [...entry.tags] : [],
  emotionCandidates: Array.isArray(entry.emotionCandidates)
    ? entry.emotionCandidates
        .map((candidate) => {
          if (!candidate) {
            return null;
          }
          if (typeof candidate === 'string') {
            const emotion = candidate.trim();
            return emotion ? { emotion, confidence: null } : null;
          }
          if (typeof candidate === 'object') {
            const emotion =
              typeof candidate.emotion === 'string'
                ? candidate.emotion
                : typeof candidate.key === 'string'
                ? candidate.key
                : '';
            if (!emotion) {
              return null;
            }
            const confidence = Number.isFinite(candidate.confidence)
              ? Number(candidate.confidence)
              : null;
            return { emotion, confidence };
          }
          return null;
        })
        .filter(Boolean)
    : [],
  regulationUsed: Array.isArray(entry.regulationUsed) ? [...entry.regulationUsed] : [],
});

const sortEntries = (entries) =>
  [...entries].sort((a, b) => new Date(b.dateISO || 0) - new Date(a.dateISO || 0));

const rebuildCache = (entries) => {
  const sorted = sortEntries(entries);
  cache.entries = entries;
  cache.sorted = sorted;
  cache.byId = new Map(sorted.map((entry) => [entry.id, entry]));
  const search = new Map();
  sorted.forEach((entry) => {
    const haystack = [
      entry.notes || '',
      entry.emotion || '',
      ...(Array.isArray(entry.tags) ? entry.tags : []),
      ...(Array.isArray(entry.needs) ? entry.needs : []),
    ]
      .join(' ')
      .toLowerCase();
    search.set(entry.id, haystack);
  });
  cache.search = search;
  cache.loaded = true;
};

const persistEntries = (entries) => {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('Journal store: unable to persist entries', error);
  }
};

const loadEntriesFromStorage = () => {
  const storage = getStorage();
  if (!storage) {
    rebuildCache([]);
    return [];
  }

  const raw = storage.getItem(STORAGE_KEY);
  let entries = parseArray(raw, STORAGE_KEY).map((item) => normalizeEntry(item));

  let changed = false;
  LEGACY_KEYS.forEach((key) => {
    const legacyRaw = storage.getItem(key);
    if (!legacyRaw) {
      storage.removeItem(key);
      return;
    }
    const legacyEntries = parseArray(legacyRaw, key).map((item) => normalizeEntry(item));
    if (legacyEntries.length) {
      changed = true;
    }
    legacyEntries.forEach((entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      if (entries.some((existing) => existing.id === entry.id)) {
        return;
      }
      entries.push(entry);
    });
    storage.removeItem(key);
  });

  const byId = new Map();
  const deduped = [];
  entries.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    if (byId.has(entry.id)) {
      return;
    }
    byId.set(entry.id, entry);
    deduped.push(entry);
  });

  if (changed || deduped.length !== entries.length) {
    entries = sortEntries(deduped);
    persistEntries(entries);
  } else {
    entries = deduped;
  }

  rebuildCache(entries);
  return entries;
};

const ensureEntries = () => {
  if (!cache.loaded) {
    loadEntriesFromStorage();
  }
  return cache.entries;
};

const list = (opts = {}) => {
  ensureEntries();
  const { q = null, from = null, to = null, tag = null } = opts || {};
  const searchTerm = typeof q === 'string' ? q.trim().toLowerCase() : '';
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const tagFilter = typeof tag === 'string' ? tag.trim().toLowerCase() : '';

  let results = cache.sorted;

  if (searchTerm) {
    results = results.filter((entry) => (cache.search.get(entry.id) || '').includes(searchTerm));
  }

  if (tagFilter) {
    results = results.filter((entry) =>
      Array.isArray(entry.tags) && entry.tags.some((value) => value.toLowerCase().includes(tagFilter))
    );
  }

  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    results = results.filter((entry) => new Date(entry.dateISO || 0) >= fromDate);
  }

  if (toDate && !Number.isNaN(toDate.getTime())) {
    results = results.filter((entry) => new Date(entry.dateISO || 0) <= toDate);
  }

  return results.map((entry) => cloneEntry(entry));
};

const get = (id) => {
  if (!id) {
    return null;
  }
  ensureEntries();
  const entry = cache.byId.get(id);
  return entry ? cloneEntry(entry) : null;
};

const writeEntries = (entries) => {
  const next = sortEntries(entries);
  const clones = next.map((entry) => cloneEntry(entry));
  rebuildCache(clones);
  persistEntries(cache.entries);
  return cache.entries;
};

const create = (entry = {}) => {
  const normalized = normalizeEntry(entry);
  const entries = [...ensureEntries()];
  const index = entries.findIndex((item) => item.id === normalized.id);
  if (index >= 0) {
    entries.splice(index, 1, normalized);
  } else {
    entries.push(normalized);
  }
  writeEntries(entries);
  return cloneEntry(cache.byId.get(normalized.id));
};

const update = (id, patch = {}) => {
  if (!id) {
    return null;
  }
  const current = get(id);
  if (!current) {
    return null;
  }
  const merged = normalizeEntry({ ...current, ...patch, id });
  const entries = [...ensureEntries()];
  const index = entries.findIndex((entryItem) => entryItem.id === id);
  if (index === -1) {
    return null;
  }
  entries.splice(index, 1, merged);
  writeEntries(entries);
  return cloneEntry(cache.byId.get(id));
};

const remove = (id) => {
  if (!id) {
    return false;
  }
  const entries = [...ensureEntries()];
  const next = entries.filter((entry) => entry.id !== id);
  if (next.length === entries.length) {
    return false;
  }
  writeEntries(next);
  return true;
};

const allTagsRecent = (limit = TAG_LIMIT_DEFAULT) => {
  ensureEntries();
  const seen = new Set();
  const results = [];
  for (const entry of cache.sorted) {
    if (!Array.isArray(entry.tags)) {
      continue;
    }
    for (const tag of entry.tags) {
      const normalized = typeof tag === 'string' ? tag.trim() : '';
      if (!normalized) {
        continue;
      }
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push(normalized);
      if (results.length >= limit) {
        return results;
      }
    }
  }
  return results;
};

const saveDraft = (pathname, draft) => {
  if (!pathname || !isBrowser) {
    return;
  }
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    if (!draft || (typeof draft === 'object' && !Object.keys(draft).length)) {
      storage.removeItem(`${DRAFT_PREFIX}${pathname}`);
      return;
    }
    storage.setItem(`${DRAFT_PREFIX}${pathname}`, JSON.stringify(draft));
  } catch (error) {
    console.warn('Journal store: unable to save draft', error);
  }
};

const loadDraft = (pathname) => {
  if (!pathname || !isBrowser) {
    return null;
  }
  const storage = getStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(`${DRAFT_PREFIX}${pathname}`);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Journal store: unable to load draft', error);
    return null;
  }
};

const clearDraft = (pathname) => {
  if (!pathname || !isBrowser) {
    return;
  }
  const storage = getStorage();
  storage?.removeItem?.(`${DRAFT_PREFIX}${pathname}`);
};

const entrySignature = (entry) => `${entry.dateISO ?? ''}|${(entry.notes ?? '').trim()}`;

const importEntries = (entries = []) => {
  if (!Array.isArray(entries) || !entries.length) {
    return { added: 0, updated: 0 };
  }
  ensureEntries();
  const existing = [...cache.entries];
  const map = new Map(existing.map((entry) => [entry.id, entry]));
  const signatureMap = new Map(existing.map((entry) => [entrySignature(entry), entry.id]));
  let added = 0;
  let updated = 0;

  entries.forEach((entry) => {
    const normalized = normalizeEntry(entry);
    const signature = entrySignature(normalized);
    if (signature && signatureMap.has(signature) && !map.has(normalized.id)) {
      return;
    }
    if (map.has(normalized.id)) {
      map.set(normalized.id, normalized);
      updated += 1;
    } else {
      map.set(normalized.id, normalized);
      if (signature) {
        signatureMap.set(signature, normalized.id);
      }
      added += 1;
    }
  });

  const next = Array.from(map.values());
  writeEntries(next);
  return { added, updated };
};

const store = {
  list,
  get,
  create,
  update,
  remove,
  allTagsRecent,
  importEntries,
  loadDraft,
  saveDraft,
  clearDraft,
};

if (isBrowser) {
  if (!window.NVCJournal) {
    window.NVCJournal = {};
  }
  window.NVCJournal.store = store;
  window.NVCJournalStore = store;
  try {
    window.dispatchEvent(new CustomEvent('nvc-journal-store-ready', { detail: store }));
  } catch (error) {
    // Ignore environments without CustomEvent support.
  }
}

export { list, get, create, update, remove, allTagsRecent, importEntries, loadDraft, saveDraft, clearDraft };
export default store;
