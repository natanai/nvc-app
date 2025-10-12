import { DEBUG_MAGNETS } from './debug.js';

const PATH_KEY = window.location.pathname.replace(/\/index\.html?$/i, '');
const STORAGE_KEY = `magnets:${PATH_KEY}`;
const VERSION = 2;
const LEGACY_PREFIX = 'magnetPositions:';

const getStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const readLegacyPositions = (storage) => {
  try {
    const legacyKey = `${LEGACY_PREFIX}${PATH_KEY}:0`;
    const raw = storage.getItem(legacyKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.magnets !== 'object') {
      return null;
    }
    const byId = {};
    for (const [id, value] of Object.entries(parsed.magnets)) {
      if (!value || typeof value !== 'object') {
        continue;
      }
      const entry = value;
      const xPct = typeof entry.xPct === 'number' ? entry.xPct : 0;
      const yPct = typeof entry.yPct === 'number' ? entry.yPct : 0;
      byId[id] = { xPct, yPct };
    }
    return Object.keys(byId).length ? { byId } : null;
  } catch {
    return null;
  }
};

export function loadPositions() {
  const storage = getStorage();
  if (!storage) {
    if (DEBUG_MAGNETS) {
      console.info('[magnets] restore', 0);
    }
    return null;
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = readLegacyPositions(storage);
      if (DEBUG_MAGNETS) {
        const count = legacy?.byId ? Object.keys(legacy.byId).length : 0;
        console.info('[magnets] restore', count);
      }
      return legacy;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.byId !== 'object') {
      const legacy = readLegacyPositions(storage);
      if (legacy) {
        try {
          const payload = { version: VERSION, byId: { ...legacy.byId } };
          storage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
          // ignore
        }
      }
      if (DEBUG_MAGNETS) {
        const count = legacy?.byId ? Object.keys(legacy.byId).length : 0;
        console.info('[magnets] restore', count);
      }
      return legacy;
    }
    const result = { byId: { ...parsed.byId } };
    if (DEBUG_MAGNETS) {
      console.info('[magnets] restore', Object.keys(result.byId).length);
    }
    return result;
  } catch {
    if (DEBUG_MAGNETS) {
      console.info('[magnets] restore', 0);
    }
    return null;
  }
}

export function savePositions(byId) {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  const count = byId ? Object.keys(byId).length : 0;
  try {
    const payload = { version: VERSION, byId: { ...byId } };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    if (DEBUG_MAGNETS) {
      console.info('[magnets] save', count);
    }
  } catch {
    // Ignore storage errors (quota, privacy mode, etc.).
    if (DEBUG_MAGNETS) {
      console.info('[magnets] save', count);
    }
  }
}

export function storageKeyForDebug() {
  return STORAGE_KEY;
}
