import { emptyEntry } from './model.js';

const STORAGE_KEY = 'journal:v2';
const LEGACY_KEYS = ['nvcApp.journal', 'alexithymiaSupportJournal'];
const DRAFT_PREFIX = 'draft:';
const TAG_HISTORY_LIMIT = 50;

let cachedEntries = null;

const isBrowser = typeof window !== 'undefined';
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

const unique = (items) => {
  const seen = new Set();
  const result = [];
  items.forEach((item) => {
    const key = item.toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  });
  return result;
};

const sanitizeScale = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return undefined;
  }
  const clamped = Math.min(10, Math.max(1, Math.round(number)));
  return clamped;
};

const sanitizeFloat = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const normalizeStringList = (value, { separator = /[,|]/, transform = (v) => v } = {}) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return unique(
      value
        .map((item) => transform(typeof item === 'string' ? item : String(item)))
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }
  if (typeof value === 'string') {
    return unique(
      value
        .split(separator)
        .map((item) => transform(item))
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }
  return [];
};

const normalizeTags = (value) =>
  normalizeStringList(value, {
    transform: (item) => (typeof item === 'string' ? item.replace(/^#/, '') : String(item)),
  });

const normalizeNeeds = (value, fallback) => {
  const normalized = normalizeStringList(value);
  if (!normalized.length && fallback) {
    return normalizeStringList(fallback);
  }
  return normalized;
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

const normalizeEntry = (rawEntry = {}) => {
  const base = emptyEntry();
  const normalized = {
    ...base,
    source: 'journal',
  };

  const incomingId = typeof rawEntry.id === 'string' && rawEntry.id.trim() ? rawEntry.id.trim() : '';
  normalized.id = incomingId || base.id;

  const emotionValue =
    typeof rawEntry.emotion === 'string'
      ? rawEntry.emotion
      : typeof rawEntry.emotion?.key === 'string'
      ? rawEntry.emotion.key
      : '';
  normalized.emotion = emotionValue.trim();

  normalized.intensity = sanitizeScale(rawEntry.intensity ?? rawEntry.intensityValue);
  normalized.confidence = sanitizeScale(rawEntry.confidence ?? rawEntry.confidenceValue);

  normalized.energy = sanitizeFloat(rawEntry.energy ?? rawEntry.energyValue);
  normalized.valence = sanitizeFloat(rawEntry.valence ?? rawEntry.valenceValue);

  normalized.sensations = normalizeStringList(rawEntry.sensations ?? rawEntry.bodySignals ?? rawEntry.bodySensations);
  normalized.needs = normalizeNeeds(rawEntry.needs, rawEntry.need ?? rawEntry.primaryNeed);
  normalized.strategies = normalizeStringList(rawEntry.strategies ?? rawEntry.strategy ?? rawEntry.actions);
  normalized.tags = normalizeTags(rawEntry.tags ?? rawEntry.tagList ?? rawEntry.tag);

  const noteValue =
    typeof rawEntry.notes === 'string'
      ? rawEntry.notes
      : typeof rawEntry.text === 'string'
      ? rawEntry.text
      : typeof rawEntry.entry === 'string'
      ? rawEntry.entry
      : '';
  normalized.notes = noteValue.trim();

  normalized.dateISO = normalizeDate(
    rawEntry.dateISO ?? rawEntry.timestamp ?? rawEntry.createdAt ?? rawEntry.date ?? rawEntry.savedAt
  );

  const source = typeof rawEntry.source === 'string' ? rawEntry.source.trim().toLowerCase() : '';
  normalized.source = source === 'lane' ? 'lane' : 'journal';

  return normalized;
};

const cloneEntry = (entry) => ({
  ...entry,
  sensations: Array.isArray(entry.sensations) ? [...entry.sensations] : [],
  needs: Array.isArray(entry.needs) ? [...entry.needs] : [],
  strategies: Array.isArray(entry.strategies) ? [...entry.strategies] : [],
  tags: Array.isArray(entry.tags) ? [...entry.tags] : [],
});

const sortEntries = (entries) =>
  [...entries].sort((a, b) => new Date(b.dateISO || 0) - new Date(a.dateISO || 0));

const readEntriesFromKey = (key) => {
  const storage = getStorage();
  if (!storage) {
    return [];
  }
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => normalizeEntry(item)).filter((item) => item && typeof item === 'object');
  } catch (error) {
    console.warn('Journal store: unable to read entries from', key, error);
    return [];
  }
};

const persistEntries = (entries) => {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('Journal store: unable to save entries', error);
  }
};

const entrySignature = (entry) => `${entry.dateISO ?? ''}|${(entry.notes ?? '').trim()}`;

const loadAllEntries = () => {
  if (cachedEntries) {
    return cachedEntries.map((entry) => cloneEntry(entry));
  }

  let entries = readEntriesFromKey(STORAGE_KEY);
  const signatures = new Set(entries.map((entry) => entrySignature(entry)));
  let changed = false;

  LEGACY_KEYS.forEach((key) => {
    const legacyEntries = readEntriesFromKey(key);
    if (!legacyEntries.length) {
      const storage = getStorage();
      storage?.removeItem?.(key);
      return;
    }
    legacyEntries.forEach((legacy) => {
      const signature = entrySignature(legacy);
      if (signature && signatures.has(signature)) {
        return;
      }
      signatures.add(signature);
      entries.push(legacy);
      changed = true;
    });
    const storage = getStorage();
    storage?.removeItem?.(key);
  });

  if (changed) {
    entries = sortEntries(entries);
    persistEntries(entries);
  }

  cachedEntries = entries;
  return entries.map((entry) => cloneEntry(entry));
};

const writeEntries = (entries) => {
  const sorted = sortEntries(entries);
  cachedEntries = sorted.map((entry) => cloneEntry(entry));
  persistEntries(sorted);
  return cachedEntries.map((entry) => cloneEntry(entry));
};

const list = ({ q, from, to, tag } = {}) => {
  const entries = loadAllEntries();
  let filtered = entries;
  const searchTerm = typeof q === 'string' ? q.trim().toLowerCase() : '';
  if (searchTerm) {
    filtered = filtered.filter((entry) => {
      const haystack = [
        entry.notes ?? '',
        entry.emotion ?? '',
        ...(Array.isArray(entry.tags) ? entry.tags : []),
        ...(Array.isArray(entry.needs) ? entry.needs : []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }

  const tagFilter = typeof tag === 'string' ? tag.trim().toLowerCase() : '';
  if (tagFilter) {
    filtered = filtered.filter((entry) =>
      Array.isArray(entry.tags) && entry.tags.some((value) => value.toLowerCase().includes(tagFilter))
    );
  }

  const fromDate = from ? new Date(from) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    filtered = filtered.filter((entry) => new Date(entry.dateISO || 0) >= fromDate);
  }

  const toDate = to ? new Date(to) : null;
  if (toDate && !Number.isNaN(toDate.getTime())) {
    filtered = filtered.filter((entry) => new Date(entry.dateISO || 0) <= toDate);
  }

  return sortEntries(filtered).map((entry) => cloneEntry(entry));
};

const get = (id) => {
  if (!id) {
    return null;
  }
  const entries = loadAllEntries();
  const match = entries.find((entry) => entry.id === id);
  return match ? cloneEntry(match) : null;
};

const create = (entry = {}) => {
  const normalized = normalizeEntry({ ...entry, id: entry.id });
  if (!entry.source) {
    normalized.source = 'journal';
  }
  const entries = loadAllEntries();
  const existingIndex = entries.findIndex((item) => item.id === normalized.id);
  if (existingIndex >= 0) {
    entries.splice(existingIndex, 1, normalized);
  } else {
    entries.push(normalized);
  }
  writeEntries(entries);
  return cloneEntry(normalized);
};

const update = (id, patch = {}) => {
  if (!id) {
    return null;
  }
  const entries = loadAllEntries();
  const index = entries.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return null;
  }
  const current = entries[index];
  const merged = normalizeEntry({ ...current, ...patch, id });
  entries.splice(index, 1, merged);
  writeEntries(entries);
  return cloneEntry(merged);
};

const remove = (id) => {
  if (!id) {
    return false;
  }
  const entries = loadAllEntries();
  const next = entries.filter((entry) => entry.id !== id);
  if (next.length === entries.length) {
    return false;
  }
  writeEntries(next);
  return true;
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
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
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

const importEntries = (entries = []) => {
  if (!Array.isArray(entries) || !entries.length) {
    return { added: 0, updated: 0 };
  }
  const existing = loadAllEntries();
  const map = new Map(existing.map((entry) => [entry.id, entry]));
  const signatureSet = new Map(existing.map((entry) => [entrySignature(entry), entry.id]));
  let added = 0;
  let updated = 0;

  entries.forEach((entry) => {
    const normalized = normalizeEntry(entry);
    const signature = entrySignature(normalized);
    if (signature && signatureSet.has(signature) && !map.has(normalized.id)) {
      return;
    }
    if (map.has(normalized.id)) {
      map.set(normalized.id, normalized);
      updated += 1;
    } else {
      map.set(normalized.id, normalized);
      if (signature) {
        signatureSet.set(signature, normalized.id);
      }
      added += 1;
    }
  });

  const next = Array.from(map.values());
  writeEntries(next);
  return { added, updated };
};

const tagHistory = () => {
  const entries = loadAllEntries();
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    if (!Array.isArray(entry.tags)) {
      continue;
    }
    for (const tag of entry.tags) {
      const normalized = tag.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(tag);
      if (result.length >= TAG_HISTORY_LIMIT) {
        return result;
      }
    }
  }
  return result;
};

const store = {
  list,
  get,
  create,
  update,
  remove,
  importEntries,
  loadDraft,
  saveDraft,
  clearDraft,
  tagHistory,
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

export { list, get, create, update, remove, importEntries, loadDraft, saveDraft, clearDraft, tagHistory };
export default store;
