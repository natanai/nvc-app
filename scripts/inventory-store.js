(function () {
  const STORAGE_KEY = 'nvcApp.inventory';

  function normalizeVisibility(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'public' || normalized === 'followers' || normalized === 'private') {
      return normalized;
    }
    return 'private';
  }

  function normalizeNeedSlugValue(value) {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim().toLowerCase();
  }

  function normalizeNeedSlugList(values) {
    const list = Array.isArray(values) ? values : [values];
    const normalized = [];
    list.flat().forEach((value) => {
      const slug = normalizeNeedSlugValue(value);
      if (slug && !normalized.includes(slug)) {
        normalized.push(slug);
      }
    });
    return normalized;
  }

  function normalizeInventoryEntry(entry) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const normalized = { ...entry };
    normalized.visibility = normalizeVisibility(entry.visibility);
    if (!normalized.visibility) {
      normalized.visibility = 'private';
    }
    const needSlugs = normalizeNeedSlugList(entry.needSlugs || entry.needs || []);
    const needSlug = normalizeNeedSlugValue(entry.needSlug || entry.sourceNeedPage);
    if (needSlug && !needSlugs.includes(needSlug)) {
      needSlugs.unshift(needSlug);
    }
    normalized.needSlugs = needSlugs;
    normalized.needSlug = needSlugs[0] || needSlug || '';
    normalized.tags = normalizeNeedSlugList([entry.tags || [], normalized.needSlugs]);
    return normalized;
  }

  function loadInventorySnapshot() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map((item) => normalizeInventoryEntry(item))
        .filter((item) => item && typeof item === 'object');
    } catch (error) {
      console.warn('Unable to load inventory snapshot', error);
      return [];
    }
  }

  function saveInventorySnapshot(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items || []));
    } catch (error) {
      console.warn('Unable to save inventory snapshot', error);
    }
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `inv_${Date.now().toString(36)}_${Math.random().toString(16).slice(2)}`;
  }

  function addStrategyToSnapshot(snapshot, strategy) {
    const list = Array.isArray(snapshot) ? [...snapshot] : [];
    const needSlugs = normalizeNeedSlugList(strategy?.needIds || []);
    const normalizedVisibility = normalizeVisibility(strategy?.visibility);
    const entry = {
      id: generateId(),
      title: strategy?.title || 'Untitled strategy',
      description: strategy?.body || '',
      need: needSlugs[0] || strategy?.need || '',
      needSlug: needSlugs[0] || '',
      needSlugs,
      tags: normalizeNeedSlugList([needSlugs, strategy?.tags || []]),
      personal: false,
      sourceNeedPage: '',
      strategySlug: strategy?.id ? String(strategy.id) : strategy?.strategySlug || '',
      createdAt: new Date().toISOString(),
      visibility: normalizedVisibility,
    };
    list.push(entry);
    saveInventorySnapshot(list);
    return { snapshot: list, entry };
  }

  if (typeof window !== 'undefined') {
    window.NVCInventoryStore = {
      addStrategyToSnapshot,
      loadInventorySnapshot,
      saveInventorySnapshot,
      normalizeInventoryEntry,
      normalizeVisibility,
      normalizeNeedSlugList,
    };
  }
})();
