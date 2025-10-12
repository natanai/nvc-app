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
    return null;
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return readLegacyPositions(storage);
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
      return legacy;
    }
    return { byId: { ...parsed.byId } };
  } catch {
    return null;
  }
}

export function savePositions(byId) {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    const payload = { version: VERSION, byId: { ...byId } };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors (quota, privacy mode, etc.).
  }
}

export function storageKeyForDebug() {
  return STORAGE_KEY;
}
