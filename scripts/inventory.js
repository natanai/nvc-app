const STORAGE_KEY = 'nvcApp.inventory';
const THEME_STORAGE_KEY = 'nvcApp.theme';
const JOURNAL_EDIT_QUERY_KEY = 'e';
const JOURNAL_EDIT_HASH = '#edit';
const LEGACY_JOURNAL_HASHES = new Set(['#journal-dashboard']);
const PERSONAL_STRATEGIES_EMAIL_ADDRESS = 'ahiccup@gmail.com';
const PERSONAL_STRATEGIES_EMAIL_SUBJECT = 'Strategies for allneeds.app!';
const PERSONAL_STRATEGIES_EMAIL_BODY =
  'Hi Nat,\n\nI just exported my personal strategies from allneeds.app and attached the file for you.\n\nWith care,';
const BACKEND_BASE_URL = 'https://backend.allneeds.app/api';
const BACKEND_SNAPSHOT_KEY = 'allneeds_export_v1';
const VISIBILITY_VALUES = ['private', 'followers', 'public'];
const SAVE_TARGET_DEVICE = 'device';
const SAVE_TARGET_PROFILE = 'profile';

function normalizeVisibilityValue(value) {
  try {
    if (window?.NVCInventoryStore?.normalizeVisibility) {
      return window.NVCInventoryStore.normalizeVisibility(value);
    }
  } catch (error) {
    // ignore
  }
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (VISIBILITY_VALUES.includes(normalized)) {
    return normalized;
  }
  return 'private';
}

function redirectLegacyJournalHash() {
  if (typeof window === 'undefined') {
    return;
  }

  const { hash = '', pathname = '', href = '' } = window.location || {};
  if (!hash) {
    return;
  }

  const normalizedHash = hash.trim().toLowerCase();
  if (!LEGACY_JOURNAL_HASHES.has(normalizedHash)) {
    return;
  }

  const normalizedPath = (pathname || '').toLowerCase();
  if (!normalizedPath.includes('/inventory') || normalizedPath.includes('/inventory/journal')) {
    return;
  }

  if (typeof document === 'undefined') {
    return;
  }

  const basePath = document.body?.dataset?.basePath || '';
  let target = `${basePath}inventory/journal/`;

  try {
    target = new URL(target, href || window.location.href).href;
  } catch (error) {
    // Ignore resolution errors and rely on the relative URL fallback.
  }

  try {
    window.location.replace(target);
  } catch (error) {
    window.location.href = target;
  }
}

redirectLegacyJournalHash();

const DEFAULT_PALETTE = {
  plum: '#74569B',
  lavender: '#EDE4FF',
  ink: '#1F1230',
  inkSoft: '#392351',
  rose: '#FFB3CB',
  mint: '#96FBC7',
  gold: '#F7FFAE',
  sky: '#D3F1FF',
  outline: '#12081F',
};

const COLOR_INPUTS = [
  { key: 'plum', varName: '--plum', label: 'Canvas glow' },
  { key: 'lavender', varName: '--lavender', label: 'Panel mist' },
  { key: 'ink', varName: '--ink', label: 'Ink' },
  { key: 'inkSoft', varName: '--ink-soft', label: 'Soft ink' },
  { key: 'rose', varName: '--rose', label: 'Blush accent' },
  { key: 'mint', varName: '--mint', label: 'Mint accent' },
  { key: 'gold', varName: '--gold', label: 'Sunbeam accent' },
  { key: 'sky', varName: '--sky', label: 'Sky accent' },
  { key: 'outline', varName: '--outline', label: 'Outline' },
];

const DEFAULT_ROUNDNESS = 100;
const ROUNDNESS_MIN = 0;
const ROUNDNESS_MAX = 200;
const ROUNDNESS_STEP = 10;

function parseStoredUpdatedAt(value) {
  if (typeof value !== 'string') {
    return 0;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed[0] !== '{') {
    return 0;
  }

  try {
    const parsed = JSON.parse(trimmed);
    const candidate = parsed && typeof parsed === 'object' ? parsed.updatedAt : null;
    return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0;
  } catch (error) {
    return 0;
  }
}

function collectStorageCandidates(key) {
  const candidates = [];
  const errors = [];

  if (typeof window === 'undefined') {
    return { candidates, errors };
  }

  try {
    if (window.localStorage) {
      const raw = window.localStorage.getItem(key);
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (value) {
        candidates.push({ value, index: candidates.length });
      }
    }
  } catch (error) {
    errors.push(error);
  }

  try {
    if (window.sessionStorage) {
      const raw = window.sessionStorage.getItem(key);
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (value) {
        candidates.push({ value, index: candidates.length });
      }
    }
  } catch (error) {
    errors.push(error);
  }

  return { candidates, errors };
}

function selectMostRecentStorageCandidate(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { value: '', index: 0 };
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  let best = candidates[0];
  let bestTimestamp = parseStoredUpdatedAt(best.value);
  let bestIndex = typeof best.index === 'number' ? best.index : 0;

  for (let i = 1; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const timestamp = parseStoredUpdatedAt(candidate.value);
    const index = typeof candidate.index === 'number' ? candidate.index : i;
    if (timestamp > bestTimestamp || (timestamp === bestTimestamp && index < bestIndex)) {
      best = candidate;
      bestTimestamp = timestamp;
      bestIndex = index;
    }
  }

  return best;
}

function storageGetItem(key) {
  if (!key) {
    return { value: '', error: null };
  }

  const { candidates, errors } = collectStorageCandidates(key);

  if (!candidates.length) {
    return { value: '', error: errors[errors.length - 1] || null };
  }

  const preferred = selectMostRecentStorageCandidate(candidates);
  return { value: preferred.value || '', error: null };
}

function storageSetItem(key, value) {
  if (!key) {
    return { success: false, error: null };
  }

  const errors = [];
  let success = false;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      success = true;
    }
  } catch (error) {
    errors.push(error);
    try {
      if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.removeItem === 'function') {
        window.localStorage.removeItem(key);
      }
    } catch (removeError) {
      errors.push(removeError);
    }
  }

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
      success = true;
    }
  } catch (error) {
    errors.push(error);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage && typeof window.sessionStorage.removeItem === 'function') {
        window.sessionStorage.removeItem(key);
      }
    } catch (removeError) {
      errors.push(removeError);
    }
  }

  return { success, error: success ? null : errors[errors.length - 1] || null };
}

function storageRemoveItem(key) {
  if (!key) {
    return { success: false, error: null };
  }

  const errors = [];
  let success = false;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      success = true;
    }
  } catch (error) {
    errors.push(error);
  }

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(key);
      success = true;
    }
  } catch (error) {
    errors.push(error);
  }

  return { success, error: success ? null : errors[errors.length - 1] || null };
}

const paletteState = {
  container: null,
  toggle: null,
  mobileToggle: null,
  panel: null,
  panelScroll: null,
  presetSelect: null,
  inputs: new Map(),
  swatches: new Map(),
  presets: [],
  currentColors: {},
  defaultColors: {},
  currentPreset: '',
  lastTrigger: null,
  styleElement: null,
  cornerSlider: null,
  cornerValue: null,
  cornerRoundness: DEFAULT_ROUNDNESS,
  tiltField: null,
  tiltToggle: null,
  tiltStatus: null,
  tiltSnapshot: null,
  swatchDrag: null,
  suppressClose: false,
  suppressCloseTimer: null,
};

const NAV_SETTINGS_STORAGE_KEY = 'nvcApp.navSettings';

const NAV_ITEM_DEFINITIONS = [
  {
    id: 'home',
    magnetId: 'nav-home',
    label: 'Home magnet',
    defaultEnabled: true,
    alwaysEnabled: true,
    getElement: (nav) => nav?.querySelector('[data-magnet-id="nav-home"]') || null,
  },
  {
    id: 'customizer',
    magnetId: 'nav-customizer',
    label: 'Customizer magnet',
    defaultEnabled: true,
    alwaysEnabled: true,
    getElement: (nav, toggle) =>
      toggle || nav?.querySelector('[data-magnet-id="nav-customizer"][data-palette-toggle]') || null,
  },
  {
    id: 'journal',
    magnetId: 'nav-journal',
    label: 'Journal magnet',
    defaultEnabled: false,
    getElement: (nav) => nav?.querySelector('[data-magnet-id="nav-journal"]') || null,
  },
  {
    id: 'inventory',
    magnetId: 'nav-inventory',
    label: 'Inventory magnet',
    defaultEnabled: true,
    getElement: (nav) => nav?.querySelector('[data-magnet-id="nav-inventory"]') || null,
  },
  {
    id: 'observations',
    magnetId: 'nav-observations',
    label: 'Observations magnet',
    defaultEnabled: true,
    getElement: (nav) => nav?.querySelector('[data-magnet-id="nav-observations"]') || null,
  },
  {
    id: 'fauxFeelings',
    magnetId: 'nav-faux-feelings',
    label: 'Faux feelings magnet',
    defaultEnabled: false,
    getElement: (nav) => nav?.querySelector('[data-magnet-id="nav-faux-feelings"]') || null,
    createElement: () => {
      const basePath = typeof state?.basePath === 'string' ? state.basePath : document.body?.dataset?.basePath || '';
      const link = document.createElement('a');
      link.className = 'pill magnet site-nav__magnet site-nav__magnet--faux-feelings';
      link.href = `${basePath}faux-feelings/`;
      link.dataset.magnetId = 'nav-faux-feelings';
      link.dataset.navDynamic = 'true';
      const label = document.createElement('span');
      label.className = 'site-nav__magnet-label';
      label.textContent = 'Faux feelings';
      link.appendChild(label);
      return link;
    },
  },
  {
    id: 'feelings',
    magnetId: 'nav-feelings',
    label: 'Feelings magnet',
    defaultEnabled: true,
    getElement: (nav) => nav?.querySelector('[data-magnet-id="nav-feelings"]') || null,
  },
  {
    id: 'needs',
    magnetId: 'nav-needs',
    label: 'Needs magnet',
    defaultEnabled: true,
    getElement: (nav) => nav?.querySelector('[data-magnet-id="nav-needs"]') || null,
  },
  {
    id: 'bodyCues',
    magnetId: 'nav-body-cues',
    label: 'Body cues magnet',
    defaultEnabled: false,
    isSupplemental: true,
    getElement: (nav) => nav?.querySelector('[data-magnet-id="nav-body-cues"]') || null,
    createElement: () => {
      const basePath = typeof state?.basePath === 'string' ? state.basePath : document.body?.dataset?.basePath || '';
      const link = document.createElement('a');
      link.className = 'pill magnet site-nav__magnet site-nav__magnet--body-cues';
      link.href = `${basePath}feelings/body-cues/`;
      link.dataset.magnetId = 'nav-body-cues';
      link.dataset.navDynamic = 'true';
      const label = document.createElement('span');
      label.className = 'site-nav__magnet-label';
      label.textContent = 'Body cues';
      link.appendChild(label);
      return link;
    },
  },
  {
    id: 'journalDashboard',
    magnetId: 'nav-journal-dashboard',
    label: 'Journal History magnet',
    defaultEnabled: false,
    isSupplemental: true,
    getElement: (nav) => nav?.querySelector('[data-magnet-id="nav-journal-dashboard"]') || null,
    createElement: () => {
      const basePath = typeof state?.basePath === 'string' ? state.basePath : document.body?.dataset?.basePath || '';
      const link = document.createElement('a');
      link.className = 'pill magnet site-nav__magnet site-nav__magnet--journal-dashboard';
      link.href = `${basePath}inventory/journal/`;
      link.dataset.magnetId = 'nav-journal-dashboard';
      link.dataset.navDynamic = 'true';
      const label = document.createElement('span');
      label.className = 'site-nav__magnet-label';
      label.textContent = 'Journal History';
      link.appendChild(label);
      return link;
    },
  },
];

const navState = {
  initialized: false,
  nav: null,
  board: null,
  items: new Map(),
  settings: null,
  optionsEl: null,
  controls: new Map(),
};

const SECTION_ALIASES = new Map([
  ['/alexithymia-support/', '/feelings/'],
]);

const state = {
  inventory: [],
  needs: [],
  feelings: [],
  needsBySlug: new Map(),
  savedStrategySlugs: new Set(),
  strategyButtons: new Map(),
  profileSaveButtons: new Set(),
  basePath: '',
  inventoryListEl: null,
  inventorySummaryEl: null,
  inventoryMessageEl: null,
  inventoryForm: null,
  inventorySubmitButton: null,
  inventoryEditingId: null,
  strategiesContainerEl: null,
  inventoryToggleButton: null,
  jumpToStrategiesButton: null,
  inventoryListHeading: null,
  showStrategies: false,
  summaryFilter: 'all',
  summaryFilterButtons: [],
  inventoryView: 'needs',
  inventoryViewButtons: [],
  needsViewPanel: null,
  strategiesViewPanel: null,
  strategySearchInput: null,
  strategyCountEl: null,
  strategyBadgeEl: null,
  needsStatusEl: null,
  expandedNeedSlug: '',
  strategySearch: '',
  inventoryFormShell: null,
  journalEntries: [],
  journalStore: null,
  journalForm: null,
  journalStatusEl: null,
  journalMessageEl: null,
  journalHistoryEl: null,
  journalEmptyEl: null,
  journalSummaryEl: null,
  journalSummaryToggle: null,
  journalFiltersForm: null,
  journalIntensityDisplay: null,
  journalIntensityInput: null,
  journalNeedsSelect: null,
  journalEmotionInput: null,
  journalNotesInput: null,
  journalSaveButton: null,
  journalTagsInput: null,
  journalTagSuggestionsEl: null,
  journalInlineContainer: null,
  journalFormSectionEl: null,
  journalOverlayContainer: null,
  journalOverlayLayer: null,
  journalOverlayDialog: null,
  journalOverlayContent: null,
  journalOverlayOpenButton: null,
  journalOverlayOpenTriggers: [],
  journalOverlayActiveTrigger: null,
  journalOverlayCloseButton: null,
  journalOverlayHeading: null,
  journalOverlayOpen: false,
  journalOverlayHistoryEl: null,
  journalOverlayDelegatedListenerAttached: false,
  journalController: null,
  journalTagSuggestions: [],
  journalTagActiveIndex: -1,
  journalDraftPath: '',
  journalDraftTimer: null,
  journalEditingId: '',
  journalEditingEntry: null,
  journalFilters: { search: '', tag: '', sort: 'newest', range: 'all' },
  journalSummaryCollapsed: false,
  journalSavedTimer: null,
  journalSaveLabel: '',
  viewportHeightListenersAttached: false,
  journalStoreListenersAttached: false,
  journalModuleReadyPromise: null,
};

const SUMMARY_FILTERS = new Set(['all', 'missing', 'ready', 'none']);

function updateViewportHeightCustomProperty() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  if (!root?.style) {
    return;
  }
  const vh = window.innerHeight * 0.01;
  root.style.setProperty('--vh', `${vh}px`);
}

function setupViewportHeightProperty() {
  if (typeof window === 'undefined') {
    return;
  }
  updateViewportHeightCustomProperty();
  if (state.viewportHeightListenersAttached) {
    return;
  }
  window.addEventListener('resize', updateViewportHeightCustomProperty);
  window.addEventListener('orientationchange', updateViewportHeightCustomProperty);
  state.viewportHeightListenersAttached = true;
}

function normalizeNeedSlugValue(value) {
  if (value == null) {
    return '';
  }
  const trimmed = value.toString().trim().toLowerCase();
  return trimmed;
}

function normalizeNeedSlugList(raw) {
  if (raw == null) {
    return [];
  }

  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split('|') : [raw];
  const seen = new Set();
  const normalized = [];

  values.forEach((value) => {
    if (Array.isArray(value)) {
      normalizeNeedSlugList(value).forEach((slug) => {
        if (!seen.has(slug)) {
          seen.add(slug);
          normalized.push(slug);
        }
      });
      return;
    }

    const slug = normalizeNeedSlugValue(value);
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      normalized.push(slug);
    }
  });

  return normalized;
}

function normalizeTagsList(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((tag) => (typeof tag === 'string' ? tag.trim() : String(tag).trim()))
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split('|')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function resolveJournalStore() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.NVCJournalStore || window.NVCJournal?.store || null;
}

function ensureJournalStore() {
  if (!state.journalStore) {
    state.journalStore = resolveJournalStore();
  }
  return state.journalStore;
}

function updateJournalEntriesFromStore() {
  const store = ensureJournalStore();
  state.journalEntries = store ? store.list() : [];
  updateJournalTagSource();
  renderJournalOverlayHistory();
  renderJournalHistory();
}

function updateJournalTagSource() {
  const store = ensureJournalStore();
  if (store && typeof store.allTagsRecent === 'function') {
    state.journalTagSuggestions = store.allTagsRecent(40);
  } else if (store && typeof store.tagHistory === 'function') {
    state.journalTagSuggestions = store.tagHistory();
  } else {
    state.journalTagSuggestions = [];
  }
}

function sanitizeContributorName(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'placeholder' ? trimmed : '';
}

function sanitizeLocation(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizeStrategySlug(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function normalizeInventoryEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const normalized = { ...entry };
  const contributorSource = entry.contributor && typeof entry.contributor === 'object' ? entry.contributor : {};
  const contributorName = sanitizeContributorName(contributorSource.name || entry.firstName || '');
  const contributorLocation = sanitizeLocation(contributorSource.location || entry.location || '');
  if (contributorName || contributorLocation) {
    normalized.contributor = {};
    if (contributorName) {
      normalized.contributor.name = contributorName;
    }
    if (contributorLocation) {
      normalized.contributor.location = contributorLocation;
    }
  } else {
    delete normalized.contributor;
  }
  normalized.firstName = contributorName;
  normalized.location = contributorLocation;
  normalized.need = typeof entry.need === 'string' ? entry.need.trim() : normalized.need || '';
  const normalizedSlug = normalizeNeedSlugValue(entry.needSlug || entry.sourceNeedPage);
  normalized.needSlug = normalizedSlug;
  const normalizedNeedSlugs = normalizeNeedSlugList(entry.needSlugs || entry.needs || []);
  normalized.strategySlug = normalizeStrategySlug(entry.strategySlug || '');
  if (typeof normalized.sourceNeedPage === 'string') {
    normalized.sourceNeedPage = normalized.sourceNeedPage.trim();
  }
  const tags = normalizeTagsList(entry.tags);
  if (normalizedSlug && !normalizedNeedSlugs.includes(normalizedSlug)) {
    normalizedNeedSlugs.push(normalizedSlug);
  }
  const normalizedTagSlugs = normalizeNeedSlugList([...tags, ...normalizedNeedSlugs]);
  const nextTags = [...tags];
  normalizedTagSlugs.forEach((slug) => {
    if (!nextTags.some((tag) => normalizeNeedSlugValue(tag) === slug)) {
      nextTags.push(slug);
    }
  });
  normalized.needSlugs = normalizedNeedSlugs;
  if (!normalized.needSlug && normalizedNeedSlugs.length) {
    normalized.needSlug = normalizedNeedSlugs[0];
  }
  normalized.tags = nextTags;
  normalized.visibility = normalizeVisibilityValue(entry.visibility);
  return normalized;
}

function isValidNeedSlug(slug) {
  const normalized = normalizeNeedSlugValue(slug);
  if (!normalized) {
    return false;
  }
  if (!state.needsBySlug.size) {
    return true;
  }
  const need = state.needsBySlug.get(normalized);
  if (!need || !need.slug) {
    return false;
  }
  return normalizeNeedSlugValue(need.slug) === normalized;
}

function resolveNeedSlugsFromTags(tags, fallbackSlug = '') {
  const combined = normalizeNeedSlugList([tags || [], fallbackSlug || '']);
  if (!combined.length) {
    return [];
  }
  const resolved = [];
  combined.forEach((slug) => {
    if (!slug || resolved.includes(slug)) {
      return;
    }
    if (isValidNeedSlug(slug)) {
      resolved.push(slug);
    }
  });
  if (!resolved.length) {
    const normalizedFallback = normalizeNeedSlugValue(fallbackSlug);
    if (normalizedFallback) {
      resolved.push(normalizedFallback);
    }
  }
  return resolved;
}

function resolveEntryNeedSlugs(entry) {
  if (!entry || typeof entry !== 'object') {
    return [];
  }
  const candidates = normalizeNeedSlugList([
    entry.needSlugs || [],
    entry.needSlug,
    entry.sourceNeedPage,
    entry.tags || [],
  ]);
  const resolved = [];
  candidates.forEach((slug) => {
    if (!slug || resolved.includes(slug)) {
      return;
    }
    if (isValidNeedSlug(slug)) {
      resolved.push(slug);
    }
  });
  if (!resolved.length && entry.need) {
    const matched = findNeedSlugByTitle(entry.need);
    if (matched) {
      resolved.push(matched);
    }
  }
  return resolved;
}

function haveSharedNeedSlugs(existing, candidate) {
  if (!Array.isArray(existing) || !Array.isArray(candidate) || !existing.length || !candidate.length) {
    return false;
  }
  const normalizedExisting = new Set(existing.map((slug) => normalizeNeedSlugValue(slug)).filter(Boolean));
  return candidate.some((slug) => normalizedExisting.has(normalizeNeedSlugValue(slug)));
}

function resolveAssetPath(path) {
  try {
    const basePath = document.body?.dataset?.basePath ?? '';
    const base = new URL(basePath || './', window.location.href);
    return new URL(path, base).toString();
  } catch (error) {
    console.warn('Unable to resolve asset path', error);
    return path;
  }
}

function getDefaultNavSettings() {
  const order = NAV_ITEM_DEFINITIONS.map((item) => item.id);
  const enabled = {};
  NAV_ITEM_DEFINITIONS.forEach((item) => {
    enabled[item.id] = item.alwaysEnabled ? true : item.defaultEnabled !== false;
  });
  return { order, enabled };
}

function normalizeNavSettings(raw) {
  const defaults = getDefaultNavSettings();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const knownIds = new Set(NAV_ITEM_DEFINITIONS.map((item) => item.id));
  const definitionMap = new Map(NAV_ITEM_DEFINITIONS.map((item) => [item.id, item]));
  const seen = new Set();
  const order = [];

  if (Array.isArray(raw.order)) {
    raw.order.forEach((id) => {
      if (typeof id !== 'string' || !knownIds.has(id) || seen.has(id)) {
        return;
      }
      seen.add(id);
      order.push(id);
    });
  }

  defaults.order.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  });

  const enabled = { ...defaults.enabled };
  if (raw.enabled && typeof raw.enabled === 'object') {
    for (const [id, value] of Object.entries(raw.enabled)) {
      if (!knownIds.has(id)) {
        continue;
      }
      const definition = definitionMap.get(id);
      if (definition?.alwaysEnabled) {
        enabled[id] = true;
        continue;
      }
      enabled[id] = value !== false;
    }
  }

  definitionMap.forEach((definition, id) => {
    if (definition?.alwaysEnabled) {
      enabled[id] = true;
    }
  });

  return { order, enabled };
}

function loadNavSettings() {
  try {
    const { value } = storageGetItem(NAV_SETTINGS_STORAGE_KEY);
    if (!value) {
      return getDefaultNavSettings();
    }
    const parsed = JSON.parse(value);
    return normalizeNavSettings(parsed);
  } catch (error) {
    console.warn('Unable to read navigation settings', error);
    return getDefaultNavSettings();
  }
}

function saveNavSettings(settings) {
  try {
    const serialized = JSON.stringify(settings);
    const { success, error } = storageSetItem(NAV_SETTINGS_STORAGE_KEY, serialized);
    if (!success && error) {
      console.warn('Unable to persist navigation settings', error);
    }
  } catch (error) {
    console.warn('Unable to serialize navigation settings', error);
  }
}

function ensureNavItemElement(id) {
  const item = navState.items.get(id);
  if (!item) {
    return null;
  }

  if (item.element instanceof HTMLElement) {
    return item.element;
  }

  let element = null;
  if (typeof item.getElement === 'function') {
    element = item.getElement(navState.nav, navState.board, navState.items.get('customizer')?.element || null);
  }
  if (!(element instanceof HTMLElement) && typeof item.createElement === 'function') {
    element = item.createElement(navState.nav, navState.board);
  }

  if (element instanceof HTMLElement) {
    const hydrated = { ...item, element };
    element.dataset.navItemId = id;
    if (item.magnetId && !element.dataset.magnetId) {
      element.dataset.magnetId = item.magnetId;
    }
    if (item.isSupplemental) {
      element.dataset.navSupplemental = 'true';
    } else {
      delete element.dataset.navSupplemental;
    }
    navState.items.set(id, hydrated);
    return element;
  }

  return null;
}

function setNavItemVisibility(element, enabled) {
  if (!(element instanceof HTMLElement)) {
    return { becameVisible: false, visibilityChanged: false };
  }

  const wasVisible = element.dataset?.navEnabled === 'true'
    || (element.getAttribute('data-nav-hidden') !== 'true'
      && element.getAttribute('aria-hidden') !== 'true'
      && element.hidden !== true
      && element.style.visibility !== 'hidden');

  if (enabled) {
    if (Object.prototype.hasOwnProperty.call(element.dataset, 'navStoredTabIndex')) {
      const stored = element.dataset.navStoredTabIndex;
      if (stored) {
        element.setAttribute('tabindex', stored);
      } else {
        element.removeAttribute('tabindex');
      }
      delete element.dataset.navStoredTabIndex;
    } else {
      element.removeAttribute('tabindex');
    }
    element.removeAttribute('data-nav-hidden');
    element.removeAttribute('aria-hidden');
    element.style.visibility = '';
    element.style.pointerEvents = '';
  } else {
    if (!Object.prototype.hasOwnProperty.call(element.dataset, 'navStoredTabIndex')) {
      const stored = element.getAttribute('tabindex');
      if (stored != null) {
        element.dataset.navStoredTabIndex = stored;
      } else {
        element.dataset.navStoredTabIndex = '';
      }
    }
    element.setAttribute('tabindex', '-1');
    element.setAttribute('data-nav-hidden', 'true');
    element.setAttribute('aria-hidden', 'true');
    element.style.visibility = 'hidden';
    element.style.pointerEvents = 'none';
  }

  return { becameVisible: !wasVisible && enabled, visibilityChanged: wasVisible !== enabled };
}

function scheduleNavLayoutReseed() {
  if (typeof window === 'undefined') {
    return;
  }

  const scheduleNavLayout = () => {
    if (window.NVCNavLayout && typeof window.NVCNavLayout.reseed === 'function') {
      window.NVCNavLayout.reseed();
      return true;
    }
    return false;
  };

  const enqueueNavLayout = () => {
    if (!Array.isArray(window.__pendingNavLayoutRequests)) {
      window.__pendingNavLayoutRequests = [];
    }
    window.__pendingNavLayoutRequests.push(scheduleNavLayout);
  };

  const triggerNavLayout = () => {
    if (!scheduleNavLayout()) {
      enqueueNavLayout();
    }
  };

  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(triggerNavLayout);
  } else {
    window.setTimeout(triggerNavLayout, 0);
  }
}

function applyNavSettings() {
  if (!navState.board || !navState.settings) {
    return;
  }

  const { order, enabled } = navState.settings;
  let hasSupplementalItems = false;
  let navItemsBecameVisible = false;
  const fragment = document.createDocumentFragment();

  order.forEach((id) => {
    const element = ensureNavItemElement(id);
    const definition = navState.items.get(id);
    if (!(element instanceof HTMLElement) || !definition) {
      return;
    }
    const isEnabled = definition.alwaysEnabled ? true : enabled[id] !== false;
    const { becameVisible } = setNavItemVisibility(element, isEnabled);
    if (becameVisible) {
      navItemsBecameVisible = true;
    }
    element.dataset.navEnabled = isEnabled ? 'true' : 'false';
    if (definition.isSupplemental && isEnabled) {
      hasSupplementalItems = true;
    }
    fragment.appendChild(element);
  });

  navState.board.appendChild(fragment);

  if (navState.nav) {
    if (hasSupplementalItems) {
      navState.nav.setAttribute('data-nav-expanded', 'true');
    } else {
      navState.nav.removeAttribute('data-nav-expanded');
    }
  }

  if (typeof highlightNavigation === 'function') {
    highlightNavigation();
  }

  updateNavControlStates();

  if (navItemsBecameVisible) {
    scheduleNavLayoutReseed();
  }
}

function setNavItemEnabled(id, enabled) {
  if (!navState.settings) {
    return;
  }
  const definition = navState.items.get(id);
  if (definition?.alwaysEnabled) {
    return;
  }
  suppressPaletteAutoClose();
  const nextEnabled = { ...navState.settings.enabled, [id]: enabled !== false };
  navState.settings = { ...navState.settings, enabled: nextEnabled };
  saveNavSettings(navState.settings);
  applyNavSettings();
}

function resetNavSettings(options = {}) {
  const { persist = true } = options;
  const defaults = getDefaultNavSettings();
  navState.settings = defaults;
  if (persist) {
    saveNavSettings(navState.settings);
  }
  applyNavSettings();
  renderNavCustomizerControls();
}

function setupNavState(nav, toggle) {
  if (!nav || !(nav instanceof HTMLElement)) {
    return;
  }

  navState.nav = nav;
  navState.board =
    nav.querySelector('[data-magnet-board]') || nav.querySelector('.site-nav__row--primary') || nav;
  navState.items.clear();

  NAV_ITEM_DEFINITIONS.forEach((definition) => {
    let element = null;
    if (typeof definition.getElement === 'function') {
      element = definition.getElement(nav, toggle);
    }
    if (element instanceof HTMLElement) {
      element.dataset.navItemId = definition.id;
      if (definition.magnetId && !element.dataset.magnetId) {
        element.dataset.magnetId = definition.magnetId;
      }
      if (definition.isSupplemental) {
        element.dataset.navSupplemental = 'true';
      }
    }
    navState.items.set(definition.id, { ...definition, element: element instanceof HTMLElement ? element : null });
  });

  navState.settings = loadNavSettings();
  applyNavSettings();
  navState.initialized = true;
}

function renderNavCustomizerControls() {
  if (!navState.optionsEl) {
    return;
  }
  const container = navState.optionsEl;
  container.innerHTML = '';
  navState.controls.clear();

  if (!navState.settings) {
    return;
  }

  NAV_ITEM_DEFINITIONS.forEach((definition) => {
    const optionId = definition.id;
    const labelText = definition.label || optionId;
    const option = document.createElement(definition.alwaysEnabled ? 'div' : 'label');
    option.className = 'palette-nav-option';
    option.setAttribute('data-nav-option', optionId);

    if (!definition.alwaysEnabled) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'palette-nav-option__checkbox';
      checkbox.addEventListener('change', () => {
        setNavItemEnabled(optionId, checkbox.checked);
      });
      option.appendChild(checkbox);
      navState.controls.set(optionId, checkbox);
    }

    const text = document.createElement('span');
    text.className = 'palette-nav-option__label';
    text.textContent = labelText;
    option.appendChild(text);

    if (definition.alwaysEnabled) {
      const badge = document.createElement('span');
      badge.className = 'palette-nav-option__badge';
      badge.textContent = 'Always on';
      option.appendChild(badge);
    }

    container.appendChild(option);
  });

  updateNavControlStates();
}

function updateNavControlStates() {
  if (!navState.settings || !navState.optionsEl) {
    return;
  }

  const { enabled } = navState.settings;

  NAV_ITEM_DEFINITIONS.forEach((definition) => {
    const optionId = definition.id;
    const isEnabled = definition.alwaysEnabled ? true : enabled[optionId] !== false;
    const option = navState.optionsEl.querySelector(
      `[data-nav-option="${
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(optionId) : optionId.replace(/"/g, '\\"')
      }"]`,
    );
    if (option instanceof HTMLElement) {
      option.dataset.navEnabled = isEnabled ? 'true' : 'false';
    }
    const control = navState.controls.get(optionId);
    if (control instanceof HTMLInputElement) {
      control.checked = isEnabled;
      control.setAttribute('aria-checked', isEnabled ? 'true' : 'false');
    }
  });
}

function isJournalModuleReady() {
  if (typeof window === 'undefined') {
    return false;
  }
  const journal = window.NVCJournal || window.NVCJournalStore;
  return Boolean(
    journal
      && typeof window.NVCJournal?.renderForm === 'function'
      && typeof window.NVCJournal?.createForm === 'function'
  );
}

function ensureJournalModuleReady() {
  if (isJournalModuleReady()) {
    return Promise.resolve();
  }
  if (state.journalModuleReadyPromise) {
    return state.journalModuleReadyPromise;
  }
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Document unavailable'));
  }

  state.journalModuleReadyPromise = new Promise((resolve, reject) => {
    let script = document.querySelector('script[data-journal-module-loader]');
    const handleLoad = () => {
      if (script) {
        script.dataset.journalModuleLoaded = 'true';
      }
      resolve();
    };
    const handleError = (event) => {
      console.warn('Journal module: failed to load', event);
      reject(new Error('Unable to load journal module script'));
    };

    if (!script) {
      script = document.createElement('script');
      script.type = 'module';
      script.src = resolveAssetPath('assets/js/journal/module.js');
      script.dataset.journalModuleLoader = 'true';
      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });
      (document.head || document.body || document.documentElement).appendChild(script);
    } else if (script.dataset.journalModuleLoaded === 'true') {
      resolve();
    } else {
      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });
    }
  }).catch((error) => {
    state.journalModuleReadyPromise = null;
    throw error;
  });

  return state.journalModuleReadyPromise;
}

function ensureJournalStatusElement(container, message) {
  if (!(container instanceof HTMLElement)) {
    return null;
  }
  let status = container.querySelector('[data-journal-status]');
  if (!status) {
    status = document.createElement('p');
    status.className = 'journal-status';
    status.setAttribute('data-journal-status', '');
    container.append(status);
  }
  if (typeof message === 'string') {
    status.textContent = message;
  }
  return status;
}

function isMobilePaletteLayout() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(max-width: 720px)').matches;
}

function setPaletteExpanded(expanded) {
  const value = expanded ? 'true' : 'false';
  paletteState.toggle?.setAttribute('aria-expanded', value);
  paletteState.mobileToggle?.setAttribute('aria-expanded', value);
}

function rememberPaletteTrigger(element) {
  if (element instanceof HTMLElement) {
    paletteState.lastTrigger = element;
  }
}

function updateTiltPermissionUI(snapshot) {
  const toggle = paletteState.tiltToggle;
  const statusEl = paletteState.tiltStatus;
  const field = paletteState.tiltField;
  if (!toggle || !statusEl) {
    return;
  }

  const liveState = snapshot && typeof snapshot === 'object'
    ? snapshot
    : (typeof window !== 'undefined' && window.NVCMagnetTiltState) || null;

  const hasOrientationSensors = typeof window !== 'undefined'
    && typeof window.DeviceOrientationEvent !== 'undefined';
  const supportsTiltPermissionRequests = hasOrientationSensors
    && typeof window.DeviceOrientationEvent.requestPermission === 'function';

  const supported = liveState && 'supported' in liveState
    ? Boolean(liveState.supported)
    : supportsTiltPermissionRequests;
  const available = liveState && 'available' in liveState
    ? Boolean(liveState.available)
    : hasOrientationSensors;

  let permissionState = liveState && typeof liveState.state === 'string'
    ? liveState.state
    : null;

  if (permissionState !== 'granted' && permissionState !== 'denied' && permissionState !== 'unknown') {
    permissionState = supportsTiltPermissionRequests
      ? 'unknown'
      : (hasOrientationSensors ? 'granted' : 'unknown');
  }

  const pending = liveState && 'pending' in liveState
    ? Boolean(liveState.pending)
    : false;

  paletteState.tiltSnapshot = {
    supported,
    available,
    state: permissionState,
    pending,
  };

  const isGranted = permissionState === 'granted';
  toggle.setAttribute('aria-checked', isGranted ? 'true' : 'false');
  const disableToggle = pending || !available || (!supported && permissionState === 'granted');
  toggle.disabled = disableToggle;
  if (disableToggle) {
    toggle.setAttribute('aria-disabled', 'true');
  } else {
    toggle.removeAttribute('aria-disabled');
  }

  let label = 'Request permission';
  let statusText = '';
  let statusState = '';

  if (!available) {
    label = 'Unavailable';
    statusText = 'Tilt controls are not supported on this device.';
    statusState = 'error';
  } else if (pending) {
    label = 'Requesting…';
    statusText = 'Waiting for device permission…';
    statusState = 'pending';
  } else if (isGranted) {
    label = 'On';
    statusText = supported
      ? 'Device tilt control is active.'
      : 'Tilt responds automatically.';
  } else if (permissionState === 'denied') {
    label = 'Request again';
    statusText = 'Permission denied. Tap to try again.';
    statusState = 'error';
  } else {
    statusText = 'Request permission to let magnets follow your device tilt.';
  }

  toggle.textContent = label;
  toggle.dataset.state = pending ? 'pending' : permissionState;
  statusEl.textContent = statusText;
  statusEl.dataset.state = statusState;
  statusEl.hidden = !statusText;

  if (field) {
    if (!available) {
      field.setAttribute('data-tilt-unavailable', 'true');
    } else {
      field.removeAttribute('data-tilt-unavailable');
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('magnettiltstatuschange', (event) => {
    if (event && typeof event === 'object' && 'detail' in event) {
      updateTiltPermissionUI(event.detail);
    } else {
      updateTiltPermissionUI(null);
    }
  });
}

function isPaletteEventTarget(target) {
  if (typeof Node === 'undefined' || !(target instanceof Node)) {
    return false;
  }
  if (paletteState.container?.contains(target)) {
    return true;
  }
  if (paletteState.mobileToggle?.contains?.(target)) {
    return true;
  }
  return false;
}

function suppressPaletteAutoClose() {
  paletteState.suppressClose = true;
  if (typeof window !== 'undefined') {
    if (paletteState.suppressCloseTimer !== null) {
      window.clearTimeout(paletteState.suppressCloseTimer);
    }
    paletteState.suppressCloseTimer = window.setTimeout(() => {
      paletteState.suppressClose = false;
      paletteState.suppressCloseTimer = null;
    }, 0);
  }
}

function setupScrollTopButton() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const requiredSegments = 3;
  const minScrollToShow = 120;
  const scrollListeners = { scroll: null, resize: null };
  let button = null;
  let isVisible = false;
  let segmentsScrolled = 0;
  let segmentSize = 0;
  let nextThreshold = 0;

  const mobileQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 720px)') : null;

  function getScrollY() {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }

  function computeSegmentSize() {
    return Math.max(200, Math.round(window.innerHeight * 0.45));
  }

  function updateVisibility() {
    if (!button) {
      return;
    }
    const shouldShow = segmentsScrolled >= requiredSegments && getScrollY() > minScrollToShow;
    if (shouldShow === isVisible) {
      return;
    }
    isVisible = shouldShow;
    button.classList.toggle('is-visible', shouldShow);
    button.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    button.tabIndex = shouldShow ? 0 : -1;
  }

  function handleScroll() {
    if (!button) {
      return;
    }
    const scrollY = getScrollY();
    while (scrollY >= nextThreshold && segmentsScrolled < requiredSegments) {
      segmentsScrolled += 1;
      nextThreshold = segmentSize * (segmentsScrolled + 1);
    }
    updateVisibility();
  }

  function handleResize() {
    if (!button) {
      return;
    }
    segmentSize = computeSegmentSize();
    nextThreshold = segmentSize * (segmentsScrolled + 1);
    updateVisibility();
  }

  function enableButton() {
    if (button || !document.body) {
      return;
    }

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'scroll-top-button';
    button.setAttribute('aria-label', 'Return to top');

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '↑';
    const label = document.createElement('span');
    label.className = 'visually-hidden';
    label.textContent = 'Return to top';
    button.append(icon, label);

    button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.body.appendChild(button);

    segmentsScrolled = 0;
    segmentSize = computeSegmentSize();
    nextThreshold = segmentSize;
    isVisible = false;
    updateVisibility();

    scrollListeners.scroll = handleScroll;
    scrollListeners.resize = () => {
      handleResize();
      if (!mobileQuery) {
        toggleForFallback();
      }
    };
    window.addEventListener('scroll', scrollListeners.scroll, { passive: true });
    window.addEventListener('resize', scrollListeners.resize);
    handleScroll();
  }

  function disableButton() {
    if (!button) {
      return;
    }
    window.removeEventListener('scroll', scrollListeners.scroll || handleScroll);
    window.removeEventListener('resize', scrollListeners.resize || handleResize);
    button.remove();
    button = null;
    isVisible = false;
    segmentsScrolled = 0;
    nextThreshold = 0;
  }

  function toggleForFallback() {
    if (window.innerWidth <= 720) {
      enableButton();
    } else {
      disableButton();
    }
  }

  if (mobileQuery) {
    const handleChange = (event) => {
      if (event.matches) {
        enableButton();
        handleScroll();
      } else {
        disableButton();
      }
    };
    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', handleChange);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(handleChange);
    }
    if (mobileQuery.matches) {
      enableButton();
      handleScroll();
    }
  } else {
    const fallbackResize = () => {
      toggleForFallback();
    };
    window.addEventListener('resize', fallbackResize);
    toggleForFallback();
  }
}

let inventoryRuntimeInitialized = false;

function initializeInventoryRuntime() {
  if (inventoryRuntimeInitialized) {
    return;
  }
  inventoryRuntimeInitialized = true;

  state.basePath = document.body?.dataset?.basePath || '';
  state.journalDraftPath = typeof window !== 'undefined' ? window.location.pathname : '';
  setupViewportHeightProperty();
  state.inventory = loadInventory();
  refreshSavedStrategyIndex();
  state.journalStore = resolveJournalStore();
  updateJournalEntriesFromStore();
  highlightNavigation();
  initCustomizer().catch((error) => {
    console.warn('Unable to set up the customizer', error);
  });
  updateInventoryCount();
  setupNeedPage();
  setupInventoryPage();
  attachDelegatedJournalOverlayTriggerListener();
  setupJournalSection();
  renderJournalViews();
  loadJournalReferenceData();
  setupScrollTopButton();
  updateBackendSyncButtons();
  updateVisibilityControls();
  updateProfileSaveButtonStates();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeInventoryRuntime, { once: true });
} else {
  initializeInventoryRuntime();
}

if (typeof window !== 'undefined') {
  window.addEventListener('allneeds:bsky-login-changed', (event) => {
    updateBackendSyncButtons();
    updateVisibilityControls();
    updateProfileSaveButtonStates();

    const session = event?.detail;
    const did = session?.did || session?.sub || null;
    const reason = session?.reason || '';
    if (!did || reason !== 'signin') {
      return;
    }

    loadSnapshotFromBackend().catch((error) => {
      console.error('Failed to auto-load backend snapshot after sign-in', error);
    });
  });
}

if (
  typeof window !== 'undefined' &&
  typeof process !== 'undefined' &&
  process?.env?.NVC_TEST === '1'
) {
  window.__NVC_INVENTORY_TESTS__ = {
    highlightNavigation,
    resolveNavCustomizerToggle,
  };
}

function loadInventory() {
  try {
    if (window?.NVCInventoryStore?.loadInventorySnapshot) {
      return window.NVCInventoryStore.loadInventorySnapshot();
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => normalizeInventoryEntry(item))
      .filter((item) => item && typeof item === 'object');
  } catch (error) {
    console.warn('Unable to load inventory from storage', error);
    return [];
  }
}

function saveInventory(items) {
  try {
    if (window?.NVCInventoryStore?.saveInventorySnapshot) {
      window.NVCInventoryStore.saveInventorySnapshot(items);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('Unable to save inventory to storage', error);
  }
}


function refreshSavedStrategyIndex() {
  const slugs = new Set();
  if (Array.isArray(state.inventory)) {
    state.inventory.forEach((entry) => {
      const slug = normalizeStrategySlug(entry?.strategySlug || '');
      if (slug) {
        slugs.add(slug);
      }
    });
  }
  state.savedStrategySlugs = slugs;
}

function isStrategySaved(slug) {
  const normalizedSlug = normalizeStrategySlug(slug);
  if (!normalizedSlug) {
    return false;
  }
  return state.savedStrategySlugs.has(normalizedSlug);
}

function isSignedIn() {
  return Boolean(getCurrentDid());
}

function updateProfileSaveButtonStates() {
  const signedIn = isSignedIn();
  state.profileSaveButtons.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    button.disabled = !signedIn;
    button.setAttribute('aria-disabled', signedIn ? 'false' : 'true');
    button.title = signedIn ? '' : 'Sign in to save to profile';
  });
}

function registerProfileSaveButton(button) {
  if (!button) {
    return;
  }
  state.profileSaveButtons.add(button);
  updateProfileSaveButtonStates();
}

function updateStrategySaveButton(button, isSaved) {
  if (!button) {
    return;
  }
  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent?.trim() || '💾 Save to device';
  }
  if (!button.dataset.savedLabel) {
    button.dataset.savedLabel = '✓ Saved on this device';
  }
  const defaultLabel = button.dataset.defaultLabel;
  const savedLabel = button.dataset.savedLabel;
  button.textContent = isSaved ? savedLabel : defaultLabel;
  button.dataset.saved = isSaved ? 'true' : 'false';
  button.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
  button.classList.toggle('strategy-card__save--saved', Boolean(isSaved));
}

function updateStrategySaveButtonStates() {
  state.strategyButtons.forEach((buttons, slug) => {
    const saved = isStrategySaved(slug);
    buttons.forEach((button) => {
      updateStrategySaveButton(button, saved);
    });
  });
}

function registerStrategySaveButton(slug, button) {
  const normalizedSlug = normalizeStrategySlug(slug);
  if (!normalizedSlug || !button) {
    return;
  }
  if (!state.strategyButtons.has(normalizedSlug)) {
    state.strategyButtons.set(normalizedSlug, new Set());
  }
  const buttonSet = state.strategyButtons.get(normalizedSlug);
  buttonSet.add(button);
  updateStrategySaveButton(button, isStrategySaved(normalizedSlug));
}


function setupNeedPage() {
  const main = document.querySelector('main[data-need-slug]');
  if (!main) {
    return;
  }

  const needSlug = main.dataset.needSlug;
  const needName = main.dataset.needName || main.dataset.needTitle || 'Need';
  const needTitle = main.dataset.needTitle || needName;
  const feedback = main.querySelector('[data-inventory-feedback]');

  const cards = main.querySelectorAll('.strategy-card');
  cards.forEach((card) => {
    const saveToDeviceButton = card.querySelector('.strategy-card__save');
    if (!saveToDeviceButton) {
      return;
    }

    saveToDeviceButton.textContent = '💾 Save to device';
    saveToDeviceButton.classList.add('strategy-card__save--device');

    let saveToProfileButton = card.querySelector('[data-save-to-profile-button="true"]');
    if (!saveToProfileButton) {
      saveToProfileButton = document.createElement('button');
      saveToProfileButton.type = 'button';
      saveToProfileButton.className = saveToDeviceButton.className;
      saveToProfileButton.dataset.saveToProfileButton = 'true';
      saveToProfileButton.textContent = 'Save to profile';
      saveToDeviceButton.insertAdjacentElement('afterend', saveToProfileButton);
    }
    saveToProfileButton.classList.add('strategy-card__save--profile');
    registerProfileSaveButton(saveToProfileButton);

    const strategySlug = normalizeStrategySlug(card.dataset.strategySlug || '');
    if (strategySlug) {
      registerStrategySaveButton(strategySlug, saveToDeviceButton);
    }

    const saveFromCard = async (saveTarget = SAVE_TARGET_DEVICE) => {
      if (saveTarget === SAVE_TARGET_PROFILE && !isSignedIn()) {
        showFeedback(feedback, 'Sign in to save to profile.', 'warning');
        return;
      }
      const title = card.querySelector('.strategy-card__title')?.textContent?.trim() || 'Untitled strategy';
      const description = card.querySelector('.strategy-card__description')?.textContent?.trim() || '';

      const tags = buildStrategyTags(card.dataset.strategyTags, needSlug);
      const needSlugs = resolveNeedSlugsFromTags(tags, needSlug);
      const firstName = sanitizeContributorName(card.dataset.firstName || '');
      const location = sanitizeLocation(card.dataset.location || '');
      const normalizedTags = Array.from(
        new Set([...tags, ...needSlugs].map((tag) => tag?.toString().trim()).filter(Boolean))
      );
      const primaryNeedSlug = needSlugs[0] || needSlug;

      const entry = {
        id: generateId(),
        title,
        description,
        need: needTitle,
        needSlug: primaryNeedSlug,
        needSlugs,
        tags: normalizedTags,
        personal: false,
        sourceNeedPage: strategySlug ? needSlug : '',
        strategySlug,
        createdAt: new Date().toISOString(),
        visibility: normalizeVisibilityValue(card.dataset.visibility || 'private'),
      };
      if (firstName || location) {
        entry.contributor = {};
        if (firstName) {
          entry.contributor.name = firstName;
          entry.firstName = firstName;
        }
        if (location) {
          entry.contributor.location = location;
          entry.location = location;
        }
      }

      const duplicate = state.inventory.find(
        (item) =>
          item.title.trim().toLowerCase() === entry.title.trim().toLowerCase() &&
          haveSharedNeedSlugs(resolveEntryNeedSlugs(item), needSlugs)
      );

      if (duplicate) {
        const confirmDuplicate = window.confirm(
          'You already saved a strategy with this title for this need. Save another copy?'
        );
        if (!confirmDuplicate) {
          showFeedback(feedback, 'Skipped saving duplicate strategy.', 'warning');
          return;
        }
      }

      const nextInventory = [...state.inventory, entry];
      persistInventory(nextInventory, {
        feedbackElement: feedback,
        feedbackMessage:
          saveTarget === SAVE_TARGET_PROFILE
            ? `Saved “${title}” to your profile and device for ${needName}.`
            : `Saved “${title}” to your device for ${needName}.`,
      });
      if (saveTarget === SAVE_TARGET_PROFILE) {
        await saveSnapshotToBackend();
      }
    };

    saveToDeviceButton.addEventListener('click', () => {
      saveFromCard(SAVE_TARGET_DEVICE);
    });

    saveToProfileButton.addEventListener('click', () => {
      saveFromCard(SAVE_TARGET_PROFILE);
    });
  });

  const suggestionForm = main.querySelector('#suggestion-form');
  if (suggestionForm) {
    const message = suggestionForm
      .closest('[data-strategy-form-container]')
      ?.querySelector('[data-form-message]');

    const saveTargetField = document.createElement('input');
    saveTargetField.type = 'hidden';
    saveTargetField.name = 'save-target';
    saveTargetField.value = SAVE_TARGET_DEVICE;
    suggestionForm.appendChild(saveTargetField);

    const formSaveToDevice = suggestionForm.querySelector('.strategy-form__submit');
    if (formSaveToDevice) {
      formSaveToDevice.textContent = '💾 Save to device';
      formSaveToDevice.classList.add('strategy-card__save--device');
      formSaveToDevice.addEventListener('click', () => {
        saveTargetField.value = SAVE_TARGET_DEVICE;
      });

      let formSaveToProfile = suggestionForm.querySelector('[data-save-to-profile-button="true"]');
      if (!formSaveToProfile) {
        formSaveToProfile = document.createElement('button');
        formSaveToProfile.type = 'submit';
        formSaveToProfile.className = formSaveToDevice.className;
        formSaveToProfile.dataset.saveToProfileButton = 'true';
        formSaveToProfile.textContent = 'Save to profile';
        formSaveToProfile.addEventListener('click', () => {
          saveTargetField.value = SAVE_TARGET_PROFILE;
        });
        formSaveToDevice.insertAdjacentElement('afterend', formSaveToProfile);
      }
      formSaveToProfile.classList.add('strategy-form__submit--secondary', 'strategy-card__save--profile');
      registerProfileSaveButton(formSaveToProfile);

      let saveTargetHint = suggestionForm.querySelector('[data-save-target-hint="true"]');
      if (!saveTargetHint) {
        saveTargetHint = document.createElement('p');
        saveTargetHint.className = 'strategy-save-target-hint';
        saveTargetHint.dataset.saveTargetHint = 'true';
        saveTargetHint.textContent = 'Device keeps it local. Profile also syncs to backend.';
        formSaveToProfile.insertAdjacentElement('afterend', saveTargetHint);
      }
    }

    suggestionForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = new FormData(suggestionForm);
      const title = (formData.get('title') || '').toString().trim();
      const description = (formData.get('description') || '').toString().trim();
      const selectedNeedValues = formData
        .getAll('need')
        .map((value) => value?.toString().trim())
        .filter(Boolean);
      const firstName = sanitizeContributorName(formData.get('name'));
      const location = sanitizeLocation(formData.get('location'));
      const visibility = (formData.get('strategy-visibility') || '').toString();
      const normalizedVisibility = normalizeVisibilityValue(visibility);
      const saveTarget = (formData.get('save-target') || SAVE_TARGET_DEVICE).toString();

      if (saveTarget === SAVE_TARGET_PROFILE && !isSignedIn()) {
        showFormMessage(message, 'Sign in to save to profile.', 'warning');
        return;
      }

      if (!title || !description) {
        showFormMessage(message, 'Please share a strategy name and description before saving.', 'error');
        return;
      }

      const needSelect = suggestionForm.querySelector('select[name="need"]');
      const selectedNeedOptions =
        needSelect instanceof HTMLSelectElement
          ? Array.from(needSelect.selectedOptions)
              .map((option) => ({
                slug: option.value?.toString().trim(),
                title: option.textContent?.trim() || option.value,
              }))
              .filter((item) => item.slug)
          : [];

      let selectedNeedSlugs = normalizeNeedSlugList(selectedNeedValues);
      if (!selectedNeedSlugs.length && needSlug) {
        selectedNeedSlugs = [normalizeNeedSlugValue(needSlug)];
      }

      const selectedNeedTitles = selectedNeedOptions
        .filter((option) => selectedNeedSlugs.includes(normalizeNeedSlugValue(option.slug)))
        .map((option) => option.title)
        .filter(Boolean);

      const primaryNeedSlug = selectedNeedSlugs[0] || normalizeNeedSlugValue(needSlug);
      const primaryNeedTitle = selectedNeedTitles[0] || needTitle;

      const tags = buildStrategyTags(selectedNeedSlugs.join('|'), primaryNeedSlug);
      const needSlugs = resolveNeedSlugsFromTags(tags, primaryNeedSlug);
      if (!needSlugs.length) {
        showFormMessage(message, 'Select at least one need before saving.', 'error');
        return;
      }

      const normalizedTags = Array.from(
        new Set([...tags, ...needSlugs].map((tag) => tag?.toString().trim()).filter(Boolean))
      );

      const entry = {
        id: generateId(),
        title,
        description,
        need: primaryNeedTitle,
        needSlug: needSlugs[0] || primaryNeedSlug,
        needSlugs,
        tags: normalizedTags,
        personal: true,
        sourceNeedPage: '',
        strategySlug: '',
        createdAt: new Date().toISOString(),
        visibility: normalizedVisibility,
      };
      if (firstName || location) {
        entry.contributor = {};
        if (firstName) {
          entry.contributor.name = firstName;
          entry.firstName = firstName;
        }
        if (location) {
          entry.contributor.location = location;
          entry.location = location;
        }
      }

      const duplicate = state.inventory.find(
        (item) =>
          item.title.trim().toLowerCase() === entry.title.trim().toLowerCase() &&
          haveSharedNeedSlugs(resolveEntryNeedSlugs(item), needSlugs)
      );

      if (duplicate) {
        const confirmDuplicate = window.confirm(
          'You already saved a strategy with this title for one of the selected needs. Save another copy?'
        );
        if (!confirmDuplicate) {
          showFormMessage(message, 'Skipped saving duplicate strategy.', 'warning');
          return;
        }
      }

      const nextInventory = [...state.inventory, entry];
      persistInventory(nextInventory);
      if (saveTarget === SAVE_TARGET_PROFILE) {
        await saveSnapshotToBackend();
      }

      suggestionForm.reset();
      saveTargetField.value = SAVE_TARGET_DEVICE;
      showFormMessage(
        message,
        saveTarget === SAVE_TARGET_PROFILE
          ? `Saved “${title}” to your profile and device. A backend sync was triggered automatically.`
          : `Saved “${title}” to your device. Visit the inventory page anytime to export a backup.`,
        'success'
      );
    });
  }
}
function setupInventoryPage() {
  const listEl = document.getElementById('inventory-list');
  if (!listEl) {
    return;
  }

  state.inventoryListEl = listEl;
  state.inventorySummaryEl = document.getElementById('inventory-summary');
  state.inventoryMessageEl = document.querySelector('[data-inventory-message]');
  state.strategiesContainerEl = document.querySelector('[data-strategies-container]');
  state.showStrategies = state.strategiesContainerEl ? !state.strategiesContainerEl.hidden : false;
  state.inventoryToggleButton = document.querySelector('[data-inventory-toggle]');
  state.jumpToStrategiesButton = document.querySelector('[data-jump-to-strategies]');
  state.inventoryListHeading = document.getElementById('inventory-list-heading');
  state.summaryFilterButtons = Array.from(document.querySelectorAll('[data-summary-filter]'));
  state.inventoryViewButtons = Array.from(document.querySelectorAll('[data-inventory-view]'));
  state.needsViewPanel = document.querySelector('[data-inventory-view-panel="needs"]');
  state.strategiesViewPanel = document.querySelector('[data-inventory-view-panel="strategies"]');
  state.strategySearchInput = document.querySelector('[data-inventory-strategy-search]');
  state.strategyCountEl = document.querySelector('[data-inventory-strategy-count]');
  state.strategyBadgeEl = document.querySelector('[data-inventory-strategy-badge]');
  state.needsStatusEl = document.querySelector('[data-inventory-needs-status]');
  state.inventoryFormShell = document.querySelector('[data-inventory-form-shell]');

  if (state.inventoryToggleButton) {
    state.inventoryToggleButton.addEventListener('click', () => {
      setShowStrategies(!state.showStrategies);
    });
  }

  if (state.jumpToStrategiesButton) {
    state.jumpToStrategiesButton.addEventListener('click', handleJumpToStrategies);
  }

  state.summaryFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.summaryFilter || 'all';
      setSummaryFilter(filter);
    });
  });

  state.inventoryViewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setInventoryView(button.dataset.inventoryView || 'needs');
    });
  });

  if (state.strategySearchInput) {
    state.strategySearchInput.addEventListener('input', () => {
      state.strategySearch = state.strategySearchInput.value || '';
      renderInventoryList();
    });
  }

  document.querySelectorAll('[data-inventory-form-open]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      openInventoryFormForNeed('');
    });
  });

  updateStrategiesVisibility();
  updateInventoryToggleLabel();
  updateSummaryFilterButtons();

  captureNeedsFromForm();
  renderInventoryViews();

  const form = document.getElementById('inventory-form');
  if (form) {
    state.inventoryForm = form;
    state.inventorySubmitButton = form.querySelector('.strategy-form__submit');
    const saveTargetField = document.createElement('input');
    saveTargetField.type = 'hidden';
    saveTargetField.name = 'save-target';
    saveTargetField.value = SAVE_TARGET_DEVICE;
    form.appendChild(saveTargetField);

    if (state.inventorySubmitButton) {
      state.inventorySubmitButton.textContent = '💾 Save to device';
      state.inventorySubmitButton.classList.add('strategy-card__save--device');
      state.inventorySubmitButton.addEventListener('click', () => {
        saveTargetField.value = SAVE_TARGET_DEVICE;
      });

      let saveToProfileButton = form.querySelector('[data-save-to-profile-button="true"]');
      if (!saveToProfileButton) {
        saveToProfileButton = document.createElement('button');
        saveToProfileButton.type = 'submit';
        saveToProfileButton.className = state.inventorySubmitButton.className;
        saveToProfileButton.dataset.saveToProfileButton = 'true';
        saveToProfileButton.textContent = 'Save to profile';
        saveToProfileButton.addEventListener('click', () => {
          saveTargetField.value = SAVE_TARGET_PROFILE;
        });
        state.inventorySubmitButton.insertAdjacentElement('afterend', saveToProfileButton);
      }
      saveToProfileButton.classList.add('strategy-form__submit--secondary', 'strategy-card__save--profile');
      registerProfileSaveButton(saveToProfileButton);

      let saveTargetHint = form.querySelector('[data-save-target-hint="true"]');
      if (!saveTargetHint) {
        saveTargetHint = document.createElement('p');
        saveTargetHint.className = 'strategy-save-target-hint';
        saveTargetHint.dataset.saveTargetHint = 'true';
        saveTargetHint.textContent = 'Device keeps it local. Profile also syncs to backend.';
        saveToProfileButton.insertAdjacentElement('afterend', saveTargetHint);
      }
    }

    setInventoryFormMode({ entry: null });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const title = (formData.get('title') || '').toString().trim();
      const description = (formData.get('description') || '').toString().trim();
      const needSlugs = normalizeNeedSlugList(formData.getAll('need'));
      const firstName = sanitizeContributorName(formData.get('name'));
      const location = sanitizeLocation(formData.get('location'));
      const visibility = (formData.get('strategy-visibility') || '').toString();
      const normalizedVisibility = normalizeVisibilityValue(visibility);
      const saveTarget = (formData.get('save-target') || SAVE_TARGET_DEVICE).toString();

      if (saveTarget === SAVE_TARGET_PROFILE && !isSignedIn()) {
        showInventoryMessage('Sign in to save to profile.', 'warning');
        return;
      }

      if (!title || !description || !needSlugs.length) {
        showInventoryMessage('Please fill in the title, description, and at least one need before adding.', 'error');
        return;
      }

      const tags = Array.from(new Set(needSlugs));
      const primaryNeedSlug = needSlugs[0];
      const needTitle = state.needsBySlug.get(primaryNeedSlug)?.title || primaryNeedSlug;
      const resolvedNeedSlugs = resolveNeedSlugsFromTags(tags, primaryNeedSlug);

      const editingId = state.inventoryEditingId;
      const existingEntry = editingId ? state.inventory.find((item) => item.id === editingId) : null;

      const entry = {
        id: existingEntry?.id || generateId(),
        title,
        description,
        need: needTitle,
        needSlug: resolvedNeedSlugs[0] || primaryNeedSlug,
        needSlugs: resolvedNeedSlugs,
        tags: Array.from(new Set([...tags, ...resolvedNeedSlugs])),
        personal: existingEntry?.personal ?? true,
        sourceNeedPage: existingEntry?.sourceNeedPage || '',
        strategySlug: existingEntry?.strategySlug || '',
        createdAt: existingEntry?.createdAt || new Date().toISOString(),
        updatedAt: existingEntry ? new Date().toISOString() : undefined,
        visibility: normalizedVisibility,
      };
      if (firstName || location) {
        entry.contributor = {};
        if (firstName) {
          entry.contributor.name = firstName;
          entry.firstName = firstName;
        }
        if (location) {
          entry.contributor.location = location;
          entry.location = location;
        }
      }

      const duplicate = state.inventory.find(
        (item) =>
          item.id !== entry.id &&
          item.title.trim().toLowerCase() === entry.title.trim().toLowerCase() &&
          haveSharedNeedSlugs(resolveEntryNeedSlugs(item), resolvedNeedSlugs)
      );

      if (duplicate) {
        const confirmDuplicate = window.confirm(
          'You already saved a strategy with this title for one of the selected needs. Save another copy?'
        );
        if (!confirmDuplicate) {
          showInventoryMessage('Skipped saving duplicate strategy.', 'warning');
          return;
        }
      }

      let nextInventory = [];
      if (existingEntry) {
        nextInventory = state.inventory.map((item) => (item.id === entry.id ? entry : item));
      } else {
        nextInventory = [...state.inventory, entry];
      }

      persistInventory(nextInventory, {
        inventoryMessage: existingEntry
          ? (saveTarget === SAVE_TARGET_PROFILE
              ? `Updated “${title}” in your profile and device.`
              : `Updated “${title}” on your device.`)
          : (saveTarget === SAVE_TARGET_PROFILE
              ? `Added “${title}” to your profile and device.`
              : `Added “${title}” to your device. Strategies you add stay on this browser, so export a localStorage JSON backup whenever you want an archive.`),
        openList: true,
      });
      if (saveTarget === SAVE_TARGET_PROFILE) {
        await saveSnapshotToBackend();
      }
      form.reset();
      saveTargetField.value = SAVE_TARGET_DEVICE;
      setInventoryFormMode({ entry: null });
      const needSelect = form.querySelector('#inventory-need');
      if (needSelect) {
        needSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  const exportButton = document.getElementById('inventory-export');
  if (exportButton) {
    exportButton.addEventListener('click', handleExportInventory);
  }

  const personalEmailButton = document.getElementById('inventory-email-personal');
  if (personalEmailButton) {
    personalEmailButton.addEventListener('click', handleEmailPersonalStrategies);
  }

  const importTrigger = document.getElementById('inventory-import-trigger');
  const importInput = document.getElementById('inventory-import');
  if (importTrigger && importInput) {
    importTrigger.addEventListener('click', () => {
      importInput.click();
    });
    importInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      handleImportInventory(file);
      importInput.value = '';
    });
  }

  const backendSaveButton = document.querySelector('[data-backend-save-button]');
  const backendLoadButton = document.querySelector('[data-backend-load-button]');

  if (backendSaveButton) {
    backendSaveButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (backendSaveButton.getAttribute('aria-disabled') === 'true') {
        setBackendStatusMessage('Sign in with Bluesky on the Inventory page to save.');
        return;
      }
      saveSnapshotToBackend();
    });
  }

  if (backendLoadButton) {
    backendLoadButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (backendLoadButton.getAttribute('aria-disabled') === 'true') {
        setBackendStatusMessage('Sign in with Bluesky on the Inventory page to load journal history.');
        return;
      }
      loadSnapshotFromBackend();
    });
  }


  if (state.inventoryListEl) {
    state.inventoryListEl.addEventListener('click', (event) => {
      const editButton = event.target.closest('[data-action="edit"]');
      if (editButton) {
        const { id } = editButton.dataset;
        if (!id) {
          return;
        }
        const entry = state.inventory.find((item) => item.id === id);
        if (!entry || !entry.personal) {
          return;
        }
        setInventoryFormMode({ entry });
        return;
      }
      const button = event.target.closest('[data-action="delete"]');
      if (!button) {
        return;
      }
      const { id } = button.dataset;
      if (!id) {
        return;
      }
      const entry = state.inventory.find((item) => item.id === id);
      if (!entry) {
        return;
      }
      const confirmed = window.confirm(`Remove “${entry.title}” from your inventory?`);
      if (!confirmed) {
        return;
      }
      const nextInventory = state.inventory.filter((item) => item.id !== id);
      persistInventory(nextInventory, {
        inventoryMessage: `Removed “${entry.title}” from your inventory.`,
      });
    });
  }

  if (state.inventorySummaryEl) {
    state.inventorySummaryEl.addEventListener('click', (event) => {
      const editButton = event.target.closest('[data-action="edit"]');
      if (editButton) {
        const entry = state.inventory.find((item) => item.id === editButton.dataset.id);
        if (entry?.personal) setInventoryFormMode({ entry });
        return;
      }

      const deleteButton = event.target.closest('[data-action="delete"]');
      if (deleteButton) {
        const entry = state.inventory.find((item) => item.id === deleteButton.dataset.id);
        if (!entry) return;
        if (!window.confirm(`Remove “${entry.title}” from your inventory?`)) return;
        persistInventory(state.inventory.filter((item) => item.id !== entry.id), {
          inventoryMessage: `Removed “${entry.title}” from your inventory.`,
        });
        return;
      }

      const addButton = event.target.closest('[data-add-strategy-for-need]');
      if (addButton) {
        openInventoryFormForNeed(addButton.dataset.addStrategyForNeed || '');
        return;
      }

      const focusButton = event.target.closest('.inventory-summary__focus');
      if (!focusButton) return;
      const slug = focusButton.dataset.needSlug || '';
      state.expandedNeedSlug = state.expandedNeedSlug === slug ? '' : slug;
      renderInventorySummary();
      applySummaryFilter();
    });
  }
}

function highlightNavigation() {
  const navLinks = [
    ...document.querySelectorAll('.site-nav__link[href]'),
    ...document.querySelectorAll('.site-nav__magnet[href]'),
  ];
  if (!navLinks.length) {
    return;
  }

  const currentPath = normalizePath(window.location.pathname);
  const aliasPath = resolveSectionAlias(currentPath);
  const candidatePaths = aliasPath ? [currentPath, aliasPath] : [currentPath];
  let activeLink = null;
  let longestMatch = 0;

  const entries = navLinks.map((link) => {
    const href = link.getAttribute('href');
    if (!href) {
      return { link, linkPath: null };
    }

    try {
      const linkUrl = new URL(href, window.location.href);
      const linkPath = normalizePath(linkUrl.pathname);
      return { link, linkPath };
    } catch (error) {
      return { link, linkPath: null };
    }
  });

  entries.forEach(({ link, linkPath }) => {
    if (!linkPath) {
      return;
    }

    candidatePaths.forEach((candidatePath) => {
      if (!candidatePath) {
        return;
      }

      if (linkPath === '/' && candidatePath !== '/') {
        return;
      }

      if (candidatePath === linkPath || candidatePath.startsWith(linkPath)) {
        if (linkPath.length > longestMatch) {
          activeLink = link;
          longestMatch = linkPath.length;
        }
      }
    });
  });

  if (activeLink) {
    navLinks.forEach((link) => {
      if (link === activeLink) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }
}

function normalizePath(pathname) {
  if (!pathname) {
    return '/';
  }

  let normalized = pathname.replace(/index\.html$/i, '');
  if (!normalized.endsWith('/')) {
    normalized += '/';
  }

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  return normalized === '//' ? '/' : normalized;
}

function resolveSectionAlias(pathname) {
  if (!pathname) {
    return null;
  }

  for (const [pattern, target] of SECTION_ALIASES.entries()) {
    const normalizedPattern = normalizePath(pattern);
    const normalizedTarget = normalizePath(target);

    const patternIndex = pathname.indexOf(normalizedPattern);
    if (patternIndex === -1) {
      continue;
    }

    const prefix = pathname.slice(0, patternIndex);
    return normalizePath(`${prefix}${normalizedTarget}`);
  }

  return null;
}

async function initCustomizer() {
  if (!document.body || paletteState.container) {
    return;
  }

  storageRemoveItem('themeHighContrast');
  buildPaletteUi();

  const themePreapplied = document.documentElement.getAttribute('data-theme-preapplied') === 'true';
  // When a saved theme is preapplied during the first paint the computed
  // styles on :root already include the customized values. In that case we do
  // not treat them as defaults so that “Reset to default” and the presets keep
  // referencing the real baseline palette from styles.css.
  const computedDefaults = themePreapplied ? {} : sanitizeColorsMap(readComputedColors());
  paletteState.defaultColors = { ...DEFAULT_PALETTE, ...computedDefaults };
  paletteState.currentColors = { ...paletteState.defaultColors };

  const savedTheme = loadSavedTheme();
  if (savedTheme?.roundness !== undefined) {
    setCornerRoundness(savedTheme.roundness, { persist: false });
  } else {
    setCornerRoundness(DEFAULT_ROUNDNESS, { persist: false });
  }
  if (savedTheme?.values && Object.keys(savedTheme.values).length) {
    applyColors(savedTheme.values, {
      presetName: savedTheme.preset || '',
      persist: false,
      replace: true,
      skipDomUpdate: themePreapplied,
    });
  } else {
    applyColors(paletteState.currentColors, { persist: false, replace: true, skipDomUpdate: themePreapplied });
  }

  populatePresetSelect();

  try {
    const presets = await fetchColorPresets();
    if (Array.isArray(presets) && presets.length) {
      paletteState.presets = presets;
      populatePresetSelect();
    }
  } catch (error) {
    console.warn('Unable to load color presets from data folder', error);
  }
}

function resolveNavCustomizerToggle(nav) {
  if (!nav) {
    return null;
  }

  const existingNavToggle = nav.querySelector('[data-palette-toggle]');
  if (existingNavToggle instanceof HTMLElement) {
    if (!existingNavToggle.hasAttribute('type')) {
      existingNavToggle.setAttribute('type', 'button');
    }
    existingNavToggle.setAttribute('aria-haspopup', 'dialog');
    if (!existingNavToggle.hasAttribute('data-palette-toggle')) {
      existingNavToggle.setAttribute('data-palette-toggle', '');
    }
    return existingNavToggle;
  }

  const mobileToggle = document.createElement('button');
  mobileToggle.type = 'button';
  mobileToggle.className = 'site-nav__link site-nav__link--customizer';
  mobileToggle.setAttribute('data-palette-toggle', '');
  mobileToggle.setAttribute('aria-haspopup', 'dialog');

  const mobileGlyph = document.createElement('span');
  mobileGlyph.className = 'site-nav__glyph';
  mobileGlyph.setAttribute('aria-hidden', 'true');
  mobileGlyph.textContent = '+';

  const mobileSrLabel = document.createElement('span');
  mobileSrLabel.className = 'visually-hidden';
  mobileSrLabel.textContent = 'Open customizer';

  mobileToggle.append(mobileGlyph, mobileSrLabel);

  const primaryRow = nav.querySelector('.site-nav__row--primary');
  if (primaryRow) {
    const homeLink = primaryRow.querySelector('.site-nav__link--home');
    if (homeLink?.nextSibling) {
      primaryRow.insertBefore(mobileToggle, homeLink.nextSibling);
    } else if (homeLink) {
      primaryRow.appendChild(mobileToggle);
    } else {
      primaryRow.insertBefore(mobileToggle, primaryRow.firstChild ?? null);
    }
  } else {
    nav.appendChild(mobileToggle);
  }

  return mobileToggle;
}

function buildPaletteUi() {
  const container = document.createElement('div');
  container.className = 'palette-corner';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'palette-corner__toggle';
  toggle.setAttribute('aria-haspopup', 'dialog');

  const glyph = document.createElement('span');
  glyph.className = 'palette-corner__glyph';
  glyph.textContent = '+';
  toggle.appendChild(glyph);

  const srLabel = document.createElement('span');
  srLabel.className = 'visually-hidden';
  srLabel.textContent = 'Open customizer';
  toggle.appendChild(srLabel);

  const nav = document.querySelector('.site-nav');
  const mobileToggle = resolveNavCustomizerToggle(nav);

  if (!navState.initialized) {
    setupNavState(nav, mobileToggle);
  }

  toggle.setAttribute('aria-expanded', 'false');
  if (mobileToggle) {
    mobileToggle.setAttribute('aria-expanded', 'false');
  }

  const panel = document.createElement('div');
  panel.className = 'palette-corner__panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Customizer');
  panel.hidden = true;
  panel.tabIndex = -1;

  const form = document.createElement('form');
  form.className = 'palette-form';
  form.setAttribute('data-palette-form', '');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  const header = document.createElement('div');
  header.className = 'palette-form__header';

  const title = document.createElement('p');
  title.className = 'palette-form__title';
  title.textContent = 'Customizer';

  const subtitle = document.createElement('p');
  subtitle.className = 'palette-form__subtitle';
  subtitle.textContent = 'Fine-tune colors, corners, and device controls.';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'palette-form__close';
  closeButton.innerHTML = '<span aria-hidden="true">×</span><span class="visually-hidden">Close customizer</span>';
  closeButton.addEventListener('click', () => {
    closePalettePanel({ restoreFocus: true });
  });

  header.append(title, subtitle, closeButton);
  form.appendChild(header);

  const presetField = document.createElement('label');
  presetField.className = 'palette-form__field palette-form__field--select';

  const presetLabel = document.createElement('span');
  presetLabel.className = 'palette-form__label';
  presetLabel.textContent = 'Presets';

  const presetSelect = document.createElement('select');
  presetSelect.className = 'palette-form__select';
  presetSelect.setAttribute('data-palette-preset', '');
  presetSelect.innerHTML = '<option value="">Current colors</option>';
  presetSelect.addEventListener('change', (event) => {
    const selectedName = event.target.value;
    if (!selectedName) {
      paletteState.currentPreset = '';
      saveTheme({ values: paletteState.currentColors, preset: '' });
      return;
    }

    const selectedPreset = paletteState.presets.find((preset) => preset.name === selectedName);
    if (selectedPreset) {
      applyColors(selectedPreset.colors, { presetName: selectedPreset.name, replace: true });
    }
  });

  presetField.append(presetLabel, presetSelect);
  form.appendChild(presetField);

  const roundnessField = document.createElement('label');
  roundnessField.className = 'palette-form__field palette-form__field--slider';

  const roundnessHeader = document.createElement('span');
  roundnessHeader.className = 'palette-form__label-row';

  const roundnessLabel = document.createElement('span');
  roundnessLabel.className = 'palette-form__label';
  roundnessLabel.textContent = 'Corner roundness';

  const roundnessValue = document.createElement('span');
  roundnessValue.className = 'palette-form__value';
  roundnessValue.textContent = formatRoundnessLabel(paletteState.cornerRoundness);

  roundnessHeader.append(roundnessLabel, roundnessValue);

  const roundnessSlider = document.createElement('input');
  roundnessSlider.type = 'range';
  roundnessSlider.className = 'palette-form__slider';
  roundnessSlider.min = String(ROUNDNESS_MIN);
  roundnessSlider.max = String(ROUNDNESS_MAX);
  roundnessSlider.step = String(ROUNDNESS_STEP);
  roundnessSlider.value = String(paletteState.cornerRoundness);
  roundnessSlider.name = 'corner-roundness';

  roundnessSlider.addEventListener('input', () => {
    setCornerRoundness(roundnessSlider.valueAsNumber, { persist: false, skipSliderUpdate: true });
  });

  roundnessSlider.addEventListener('change', () => {
    setCornerRoundness(roundnessSlider.valueAsNumber);
  });

  roundnessField.append(roundnessHeader, roundnessSlider);
  form.appendChild(roundnessField);

  paletteState.cornerSlider = roundnessSlider;
  paletteState.cornerValue = roundnessValue;
  updateRoundnessDisplay(paletteState.cornerRoundness);

  const grid = document.createElement('div');
  grid.className = 'palette-form__grid';
  form.appendChild(grid);

  COLOR_INPUTS.forEach((color) => {
    const field = document.createElement('label');
    field.className = 'palette-form__field';

    const fieldLabel = document.createElement('span');
    fieldLabel.className = 'palette-form__label';
    fieldLabel.textContent = color.label;

    const fieldInner = document.createElement('span');
    fieldInner.className = 'palette-form__field-inner';

    const swatch = document.createElement('span');
    swatch.className = 'palette-form__swatch';
    swatch.addEventListener('pointerdown', (event) => {
      handleSwatchPointerDown(event, color.key);
    });

    const input = document.createElement('input');
    input.className = 'palette-form__input';
    input.type = 'text';
    input.maxLength = 7;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.inputMode = 'text';
    input.setAttribute('pattern', '^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$');
    input.setAttribute('title', 'Use a hex color like #A1B2C3');
    input.dataset.colorKey = color.key;
    input.addEventListener('input', () => {
      input.setCustomValidity('');
      const preview = sanitizeHex(input.value);
      const swatchTarget = paletteState.swatches.get(color.key);
      if (swatchTarget) {
        if (preview) {
          swatchTarget.style.backgroundColor = preview;
        } else {
          const fallback =
            paletteState.currentColors[color.key] ||
            paletteState.defaultColors[color.key] ||
            '';
          swatchTarget.style.backgroundColor = fallback || 'transparent';
        }
      }
    });
    input.addEventListener('change', handleColorInputChange);

    fieldInner.append(swatch, input);
    field.append(fieldLabel, fieldInner);
    grid.appendChild(field);

    paletteState.inputs.set(color.key, input);
    paletteState.swatches.set(color.key, swatch);
  });

  const navField = document.createElement('div');
  navField.className = 'palette-form__field palette-form__field--nav';

  const navLabel = document.createElement('span');
  navLabel.className = 'palette-form__label';
  navLabel.textContent = 'Navigation magnets';

  const navDescription = document.createElement('span');
  navDescription.className = 'palette-form__description';
  navDescription.textContent = 'Choose which magnets appear in the top navigation bar.';

  const navOptions = document.createElement('div');
  navOptions.className = 'palette-nav-options';

  navField.append(navLabel, navDescription, navOptions);
  form.appendChild(navField);

  navState.optionsEl = navOptions;
  renderNavCustomizerControls();

  const tiltField = document.createElement('div');
  tiltField.className = 'palette-form__field palette-form__field--toggle';

  const tiltInfo = document.createElement('div');
  tiltInfo.className = 'palette-form__toggle-info';

  const tiltLabel = document.createElement('span');
  tiltLabel.className = 'palette-form__label';
  tiltLabel.id = 'paletteTiltLabel';
  tiltLabel.textContent = 'Device tilt access';

  const tiltDescription = document.createElement('span');
  tiltDescription.className = 'palette-form__description';
  tiltDescription.id = 'paletteTiltDescription';
  tiltDescription.textContent = 'Let magnets respond to how you hold your phone.';

  tiltInfo.append(tiltLabel, tiltDescription);

  const tiltControls = document.createElement('div');
  tiltControls.className = 'palette-form__toggle-controls';

  const tiltToggle = document.createElement('button');
  tiltToggle.type = 'button';
  tiltToggle.className = 'palette-form__switch';
  tiltToggle.setAttribute('role', 'switch');
  tiltToggle.setAttribute('aria-labelledby', 'paletteTiltLabel');
  tiltToggle.setAttribute('aria-describedby', 'paletteTiltDescription paletteTiltStatus');
  tiltToggle.textContent = 'Request permission';
  tiltToggle.addEventListener('click', () => {
    if (tiltToggle.disabled) {
      return;
    }
    const snapshot = paletteState.tiltSnapshot || ((typeof window !== 'undefined' && window.NVCMagnetTiltState) || {});
    if (snapshot && snapshot.pending) {
      return;
    }
    if (snapshot && snapshot.supported === false && snapshot.available && snapshot.state === 'granted') {
      return;
    }
    window.dispatchEvent(new CustomEvent('magnettiltrequest'));
  });

  const tiltStatus = document.createElement('span');
  tiltStatus.className = 'palette-form__status';
  tiltStatus.id = 'paletteTiltStatus';
  tiltStatus.setAttribute('aria-live', 'polite');

  tiltControls.append(tiltToggle, tiltStatus);
  tiltField.append(tiltInfo, tiltControls);
  form.appendChild(tiltField);

  paletteState.tiltField = tiltField;
  paletteState.tiltToggle = tiltToggle;
  paletteState.tiltStatus = tiltStatus;

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'palette-form__clear';
  clearButton.textContent = 'Delete localStorage';
  clearButton.addEventListener('click', () => {
    const confirmationMessage = [
      'Deleting localStorage will remove all saved customizations, inventory entries, journal entries, and any other data stored in this browser.',
      'If you have anything you want to keep, please export backups of your inventory and journal before continuing.',
      'Do you want to delete localStorage now?',
    ].join('\n\n');

    const confirmed =
      typeof window === 'undefined' || typeof window.confirm !== 'function'
        ? true
        : window.confirm(confirmationMessage);

    if (!confirmed) {
      return;
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch (error) {
      console.warn('Unable to clear localStorage', error);
    }

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.clear();
      }
    } catch (error) {
      console.warn('Unable to clear sessionStorage', error);
    }

    clearSavedTheme();

    try {
      if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
        window.location.reload();
      }
    } catch (error) {
      console.warn('Unable to reload after clearing storage', error);
    }
  });

  const actions = document.createElement('div');
  actions.className = 'palette-form__actions';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'palette-form__reset';
  resetButton.setAttribute('data-palette-reset', '');
  resetButton.textContent = 'Reset to default';
  resetButton.addEventListener('click', () => {
    suppressPaletteAutoClose();
    applyColors(paletteState.defaultColors, { presetName: '', replace: true });
    resetNavSettings();
    setCornerRoundness(DEFAULT_ROUNDNESS);
  });

  actions.append(resetButton);

  const footer = document.createElement('div');
  footer.className = 'palette-form__footer';
  footer.append(clearButton);

  form.append(actions, footer);

  const panelScroll = document.createElement('div');
  panelScroll.className = 'palette-corner__panel-scroll';
  panelScroll.appendChild(form);

  panel.appendChild(panelScroll);
  container.append(toggle, panel);
  document.body.appendChild(container);

  const handleToggle = (element) => {
    if (!element) {
      return;
    }

    rememberPaletteTrigger(element);
    if (element.getAttribute('aria-expanded') === 'true') {
      closePalettePanel({ restoreFocus: false });
    } else {
      openPalettePanel();
    }
  };

  toggle.addEventListener('click', () => {
    handleToggle(toggle);
  });

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      handleToggle(mobileToggle);
    });
  }

  document.addEventListener('click', (event) => {
    if (!paletteState.container) {
      return;
    }
    if (paletteState.suppressClose) {
      return;
    }
    if (
      paletteState.toggle?.getAttribute('aria-expanded') !== 'true' &&
      paletteState.mobileToggle?.getAttribute('aria-expanded') !== 'true'
    ) {
      return;
    }
    if (!isPaletteEventTarget(event.target)) {
      closePalettePanel();
    }
  });

  document.addEventListener('keydown', (event) => {
    const expanded =
      paletteState.toggle?.getAttribute('aria-expanded') === 'true' ||
      paletteState.mobileToggle?.getAttribute('aria-expanded') === 'true';
    if (event.key === 'Escape' && expanded) {
      closePalettePanel({ restoreFocus: true });
    }
  });

  paletteState.container = container;
  paletteState.toggle = toggle;
  paletteState.mobileToggle = mobileToggle;
  paletteState.panel = panel;
  paletteState.panelScroll = panelScroll;
  paletteState.presetSelect = presetSelect;

  updateTiltPermissionUI(typeof window !== 'undefined' ? window.NVCMagnetTiltState : null);
}

function openPalettePanel() {
  if (!paletteState.panel || !paletteState.toggle) {
    return;
  }

  setPaletteExpanded(true);
  paletteState.container?.classList.add('is-open');
  paletteState.panel.hidden = false;

  if (paletteState.panelScroll) {
    paletteState.panelScroll.scrollTop = 0;
  } else {
    paletteState.panel.scrollTop = 0;
  }

  const slider = paletteState.cornerSlider;
  const presetSelect = paletteState.presetSelect;
  const shouldAutoFocus = !isMobilePaletteLayout();
  window.requestAnimationFrame(() => {
    if (slider instanceof HTMLElement && shouldAutoFocus) {
      slider.focus();
      return;
    }

    if (presetSelect instanceof HTMLElement && shouldAutoFocus) {
      presetSelect.focus();
      return;
    }

    paletteState.panel?.focus();
  });
}

function closePalettePanel(options = {}) {
  const { restoreFocus = false } = options;
  if (!paletteState.panel) {
    return;
  }

  setPaletteExpanded(false);
  paletteState.container?.classList.remove('is-open');
  paletteState.panel.hidden = true;

  if (restoreFocus && paletteState.lastTrigger instanceof HTMLElement) {
    paletteState.lastTrigger.focus();
  }
}

function handleColorInputChange(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  const key = input.dataset.colorKey;
  if (!key) {
    return;
  }

  const sanitized = sanitizeHex(input.value);
  if (!sanitized) {
    input.setCustomValidity('Use a hex color like #A1B2C3');
    input.reportValidity();
    updateInputsFromState();
    return;
  }

  input.value = sanitized;
  applyColors({ [key]: sanitized }, { presetName: '' });
}

function handleSwatchPointerDown(event, key) {
  if (typeof PointerEvent === 'undefined' || !(event instanceof PointerEvent)) {
    return;
  }

  const swatch = event.currentTarget;
  if (!(swatch instanceof HTMLElement)) {
    return;
  }

  const baseHex =
    sanitizeHex(
      paletteState.currentColors[key] ||
        paletteState.defaultColors[key] ||
        DEFAULT_PALETTE[key] ||
        paletteState.currentColors.ink ||
        DEFAULT_PALETTE.ink
    ) || '#000000';

  const startHsl = hexToHsl(baseHex);
  if (!startHsl) {
    return;
  }

  event.preventDefault();

  try {
    swatch.setPointerCapture(event.pointerId);
  } catch (error) {
    // Ignore browsers that do not support pointer capture.
  }

  paletteState.swatchDrag = {
    key,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startHsl,
    startHex: baseHex,
    previewHex: baseHex,
    swatch,
  };

  swatch.addEventListener('pointermove', handleSwatchPointerMove);
  swatch.addEventListener('pointerup', handleSwatchPointerUp);
  swatch.addEventListener('pointercancel', handleSwatchPointerCancel);
}

function handleSwatchPointerMove(event) {
  if (typeof PointerEvent === 'undefined' || !(event instanceof PointerEvent)) {
    return;
  }

  const drag = paletteState.swatchDrag;
  if (!drag || event.pointerId !== drag.pointerId) {
    return;
  }

  const deltaX = event.clientX - drag.startX;
  const deltaY = event.clientY - drag.startY;

  const hue = normalizeHue(drag.startHsl.h + deltaX * 0.5);
  const next = { ...drag.startHsl, h: hue };

  if (event.shiftKey) {
    next.s = clampNumber(drag.startHsl.s - deltaY * 0.5, 0, 100);
  } else {
    next.l = clampNumber(drag.startHsl.l - deltaY * 0.3, 5, 95);
  }

  const nextHex = hslToHex(next);
  if (!nextHex || nextHex === drag.previewHex) {
    return;
  }

  drag.previewHex = nextHex;
  applyColors({ [drag.key]: nextHex }, { presetName: '', persist: false });
}

function handleSwatchPointerUp(event) {
  finalizeSwatchPointerInteraction(event, { commit: true });
}

function handleSwatchPointerCancel(event) {
  finalizeSwatchPointerInteraction(event, { commit: false });
}

function finalizeSwatchPointerInteraction(event, options = {}) {
  if (typeof PointerEvent === 'undefined' || !(event instanceof PointerEvent)) {
    return;
  }

  const drag = paletteState.swatchDrag;
  const swatch = event.currentTarget;
  if (!drag || !(swatch instanceof HTMLElement) || event.pointerId !== drag.pointerId) {
    return;
  }

  const { commit = false } = options;

  try {
    swatch.releasePointerCapture(event.pointerId);
  } catch (error) {
    // Ignore browsers that do not support pointer capture.
  }

  swatch.removeEventListener('pointermove', handleSwatchPointerMove);
  swatch.removeEventListener('pointerup', handleSwatchPointerUp);
  swatch.removeEventListener('pointercancel', handleSwatchPointerCancel);

  const hexToApply = commit ? drag.previewHex || drag.startHex : drag.startHex;
  const persist = commit;

  if (hexToApply) {
    applyColors({ [drag.key]: hexToApply }, { presetName: '', persist });
  }

  paletteState.swatchDrag = null;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function normalizeHue(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function hexToRgb(hex) {
  const sanitized = sanitizeHex(hex);
  if (!sanitized) {
    return null;
  }

  const value = sanitized.slice(1);
  if (value.length === 3) {
    const r = Number.parseInt(value[0] + value[0], 16);
    const g = Number.parseInt(value[1] + value[1], 16);
    const b = Number.parseInt(value[2] + value[2], 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      return null;
    }
    return { r, g, b };
  }

  if (value.length === 6) {
    const r = Number.parseInt(value.slice(0, 2), 16);
    const g = Number.parseInt(value.slice(2, 4), 16);
    const b = Number.parseInt(value.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      return null;
    }
    return { r, g, b };
  }

  return null;
}

function rgbToHex(rgb) {
  if (!rgb) {
    return '';
  }
  const toHex = (component) => Math.round(clampNumber(component, 0, 255)).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

function rgbToHsl(rgb) {
  if (!rgb) {
    return null;
  }

  const r = clampNumber(rgb.r, 0, 255) / 255;
  const g = clampNumber(rgb.g, 0, 255) / 255;
  const b = clampNumber(rgb.b, 0, 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
}

function hueToRgb(p, q, t) {
  let temp = t;
  if (temp < 0) {
    temp += 1;
  }
  if (temp > 1) {
    temp -= 1;
  }
  if (temp < 1 / 6) {
    return p + (q - p) * 6 * temp;
  }
  if (temp < 1 / 2) {
    return q;
  }
  if (temp < 2 / 3) {
    return p + (q - p) * (2 / 3 - temp) * 6;
  }
  return p;
}

function hslToRgb(hsl) {
  if (!hsl) {
    return null;
  }

  const h = normalizeHue(hsl.h) / 360;
  const s = clampNumber(hsl.s, 0, 100) / 100;
  const l = clampNumber(hsl.l, 0, 100) / 100;

  if (s === 0) {
    const value = Math.round(l * 255);
    return { r: value, g: value, b: value };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hueToRgb(p, q, h) * 255);
  const b = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);

  return { r, g, b };
}

function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }
  return rgbToHsl(rgb);
}

function hslToHex(hsl) {
  const rgb = hslToRgb(hsl);
  return rgbToHex(rgb);
}

function ensurePaletteStyleElement() {
  if (paletteState.styleElement?.isConnected) {
    return paletteState.styleElement;
  }

  if (!document.head) {
    return null;
  }

  const style = document.createElement('style');
  style.dataset.paletteOverrides = 'true';
  document.head.appendChild(style);
  paletteState.styleElement = style;
  return style;
}

function updatePaletteStyleElement() {
  const hasDifference = COLOR_INPUTS.some(({ key }) => {
    const current = paletteState.currentColors[key];
    const base = paletteState.defaultColors[key];
    if (!current && !base) {
      return false;
    }
    return current !== base;
  });

  if (!hasDifference) {
    if (paletteState.styleElement?.isConnected) {
      paletteState.styleElement.textContent = '';
    }
    return;
  }

  const style = ensurePaletteStyleElement();
  if (!style) {
    return;
  }

  const declarations = COLOR_INPUTS.map(({ key, varName }) => {
    const value = paletteState.currentColors[key];
    return value ? `  ${varName}: ${value};` : '';
  }).filter(Boolean);

  style.textContent = declarations.length ? `:root {\n${declarations.join('\n')}\n}` : '';
}

function applyColors(colors, options = {}) {
  const { presetName = '', persist = true, replace = false, skipDomUpdate = false } = options;
  const root = document.documentElement;

  if (replace) {
    const nextColors = { ...paletteState.defaultColors };
    COLOR_INPUTS.forEach(({ key }) => {
      const candidate = sanitizeHex(colors[key]);
      if (candidate) {
        nextColors[key] = candidate;
      }
    });
    paletteState.currentColors = nextColors;
  } else {
    const sanitized = sanitizeColorsMap(colors);
    paletteState.currentColors = { ...paletteState.currentColors, ...sanitized };
  }

  COLOR_INPUTS.forEach(({ key, varName }) => {
    const value = paletteState.currentColors[key];
    if (value && !skipDomUpdate) {
      root?.style?.setProperty(varName, value);
    }
  });

  if (!skipDomUpdate && root) {
    const buttonBase =
      paletteState.currentColors.rose || paletteState.defaultColors.rose || DEFAULT_PALETTE.rose;
    if (buttonBase) {
      root.style.setProperty('--btn-bg', buttonBase);
    }

    const outlineBase =
      paletteState.currentColors.outline || paletteState.defaultColors.outline || DEFAULT_PALETTE.outline;
    if (outlineBase) {
      root.style.setProperty('--shadow', `color-mix(in srgb, ${outlineBase} 55%, transparent)`);
    }

    root.style.setProperty('--btn-fg', '#111111');
    root.style.setProperty('--chip-fg', '#111111');
    root.removeAttribute('data-theme-contrast');
    root.style.removeProperty('--chip-bg');
    runAutoContrast();
  }

  updatePaletteStyleElement();

  paletteState.currentPreset = presetName || '';
  updateInputsFromState();

  if (paletteState.presetSelect && paletteState.presetSelect.value !== paletteState.currentPreset) {
    paletteState.presetSelect.value = paletteState.currentPreset;
  }

  if (persist) {
    saveTheme({ values: paletteState.currentColors, preset: paletteState.currentPreset });
  }
}

function runAutoContrast() {
  try {
    if (window.NVCContrast && typeof window.NVCContrast.autoContrast === 'function') {
      window.NVCContrast.autoContrast('--btn-bg', '--btn-fg');
    }
  } catch (error) {
    console.warn('Unable to auto-adjust button contrast', error);
  }
}

function updateInputsFromState() {
  COLOR_INPUTS.forEach(({ key }) => {
    const value = paletteState.currentColors[key] || paletteState.defaultColors[key] || '';
    const input = paletteState.inputs.get(key);
    const swatch = paletteState.swatches.get(key);
    if (input) {
      input.value = value;
    }
    if (swatch) {
      swatch.style.backgroundColor = value || 'transparent';
    }
  });
}

function readComputedColors() {
  const computed = getComputedStyle(document.documentElement);
  const colors = {};
  COLOR_INPUTS.forEach(({ key, varName }) => {
    const raw = computed.getPropertyValue(varName).trim();
    const sanitized = sanitizeHex(raw);
    if (sanitized) {
      colors[key] = sanitized;
    }
  });
  return colors;
}

function sanitizeHex(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(prefixed) ? prefixed.toUpperCase() : '';
}

function sanitizeColorsMap(colors) {
  const sanitized = {};
  if (!colors || typeof colors !== 'object') {
    return sanitized;
  }

  COLOR_INPUTS.forEach(({ key }) => {
    const value = sanitizeHex(colors[key]);
    if (value) {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

function clampRoundness(value) {
  const number = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(number)) {
    return DEFAULT_ROUNDNESS;
  }
  return Math.min(ROUNDNESS_MAX, Math.max(ROUNDNESS_MIN, Math.round(number)));
}

function formatRoundnessLabel(value) {
  const clamped = clampRoundness(value);
  return `${clamped}%`;
}

function applyCornerScaleToRoot(roundness) {
  const root = document.documentElement;
  if (!root?.style) {
    return;
  }
  const scale = clampRoundness(roundness) / 100;
  root.style.setProperty('--corner-scale', scale.toString());
}

function updateRoundnessDisplay(roundness) {
  if (paletteState.cornerValue) {
    paletteState.cornerValue.textContent = formatRoundnessLabel(roundness);
  }
}

function setCornerRoundness(value, options = {}) {
  const { persist = true, skipDomUpdate = false, skipSliderUpdate = false } = options;
  const clamped = clampRoundness(value);
  paletteState.cornerRoundness = clamped;

  if (!skipDomUpdate) {
    applyCornerScaleToRoot(clamped);
  }

  if (!skipSliderUpdate && paletteState.cornerSlider) {
    paletteState.cornerSlider.value = String(clamped);
  }

  updateRoundnessDisplay(clamped);

  if (persist) {
    saveTheme({
      values: paletteState.currentColors,
      preset: paletteState.currentPreset,
      roundness: clamped,
    });
  }
}

function normalizeThemePayload(theme) {
  if (!theme || typeof theme !== 'object') {
    return null;
  }

  return {
    values: sanitizeColorsMap(theme.values),
    preset: typeof theme.preset === 'string' ? theme.preset : '',
    roundness: clampRoundness(theme.roundness),
  };
}

function saveTheme(theme) {
  if (!theme || typeof theme !== 'object') {
    return;
  }

  const payload = {
    values: sanitizeColorsMap(theme.values || paletteState.currentColors),
    preset: typeof theme.preset === 'string' ? theme.preset : '',
    roundness: clampRoundness(
      typeof theme.roundness === 'number' ? theme.roundness : paletteState.cornerRoundness,
    ),
    updatedAt: Date.now(),
  };

  const serialized = JSON.stringify(payload);
  const { success, error } = storageSetItem(THEME_STORAGE_KEY, serialized);
  if (!success && error) {
    console.warn('Unable to persist color theme', error);
  }
}

function clearSavedTheme() {
  storageRemoveItem(THEME_STORAGE_KEY);
  storageRemoveItem('themeHighContrast');

  const root = document.documentElement;
  if (root?.style) {
    COLOR_INPUTS.forEach(({ varName }) => {
      root.style.removeProperty(varName);
    });
    root.style.removeProperty('--btn-bg');
    root.style.removeProperty('--btn-fg');
    root.style.removeProperty('--chip-fg');
    root.style.removeProperty('--chip-bg');
    root.style.removeProperty('--shadow');
  }

  paletteState.currentPreset = '';
  paletteState.currentColors = { ...paletteState.defaultColors };
  if (paletteState.styleElement?.isConnected) {
    paletteState.styleElement.textContent = '';
  }
  updatePaletteStyleElement();
  updateInputsFromState();
  setCornerRoundness(DEFAULT_ROUNDNESS, { persist: false });
  if (paletteState.presetSelect) {
    paletteState.presetSelect.value = '';
  }
  document.documentElement?.removeAttribute('data-theme-preapplied');
  runAutoContrast();
}

function loadSavedTheme() {
  const { value, error } = storageGetItem(THEME_STORAGE_KEY);
  if (!value) {
    if (error) {
      console.warn('Unable to read saved color theme', error);
    }
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    const normalized = normalizeThemePayload(parsed);
    return normalized;
  } catch (parseError) {
    console.warn('Unable to parse saved color theme', parseError);
    return null;
  }
}

async function fetchColorPresets() {
  const path = resolveAssetPath('data/color-palettes.csv');
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load presets: ${response.status}`);
  }

  const text = await response.text();
  return parseColorPaletteCsv(text);
}

function populatePresetSelect() {
  const select = paletteState.presetSelect;
  if (!select) {
    return;
  }

  Array.from(select.querySelectorAll('option[data-generated="true"]')).forEach((option) => option.remove());

  paletteState.presets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.name;
    option.textContent = preset.name;
    option.dataset.generated = 'true';
    select.appendChild(option);
  });

  if (paletteState.currentPreset) {
    const match = paletteState.presets.some((preset) => preset.name === paletteState.currentPreset);
    select.value = match ? paletteState.currentPreset : '';
  } else {
    select.value = '';
  }
}

function parseColorPaletteCsv(text) {
  if (typeof text !== 'string') {
    return [];
  }

  const rows = parsePaletteCsvRows(text);
  if (!rows.length) {
    return [];
  }

  const header = rows.shift().map((cell) => cell.trim());
  const headerMap = new Map();
  header.forEach((name, index) => {
    if (name) {
      headerMap.set(name.toLowerCase(), index);
    }
  });

  const nameIndex = headerMap.get('name');
  if (typeof nameIndex !== 'number') {
    return [];
  }

  const presets = [];
  rows.forEach((cells) => {
    if (!cells || !cells.length) {
      return;
    }

    const rawName = cells[nameIndex]?.trim();
    if (!rawName) {
      return;
    }

    const colors = {};
    COLOR_INPUTS.forEach(({ key }) => {
      const columnIndex = headerMap.get(key.toLowerCase());
      if (typeof columnIndex === 'number') {
        colors[key] = cells[columnIndex]?.trim();
      }
    });

    const sanitized = sanitizeColorsMap(colors);
    if (Object.keys(sanitized).length) {
      presets.push({ name: rawName, colors: sanitized });
    }
  });

  return presets;
}

function parsePaletteCsvRows(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current);
  rows.push(row);

  return rows.filter((cells) => cells.some((cell) => cell.trim().length));
}

function applyNeedsData(needs) {
  if (!Array.isArray(needs)) {
    state.needs = [];
    state.needsBySlug = new Map();
    return;
  }
  const normalized = needs
    .map((item) => ({ slug: item.slug || item.value || '', title: item.title || item.label || '' }))
    .filter((item) => item.slug && item.title);
  state.needs = normalized;
  state.needsBySlug = new Map();
  normalized.forEach((need) => {
    const slugKey = need.slug?.toLowerCase();
    if (slugKey) {
      state.needsBySlug.set(slugKey, need);
    }
    const titleKey = need.title?.toLowerCase();
    if (titleKey && !state.needsBySlug.has(titleKey)) {
      state.needsBySlug.set(titleKey, need);
    }
  });

  if (backfillInventoryNeedSlugs()) {
    renderInventoryViews();
  }
}

function captureNeedsFromForm() {
  const select = document.getElementById('inventory-need');
  let needs = [];

  if (select) {
    select.querySelectorAll('option').forEach((option) => {
      const value = option.value;
      if (!value) {
        return;
      }
      const title = option.textContent?.trim() || value;
      needs.push({ slug: value, title });
    });
  } else {
    const loader = window.NVCJournal?.loadNeedsFromScript;
    if (typeof loader === 'function') {
      const loaded = loader();
      if (Array.isArray(loaded)) {
        needs = loaded;
      }
    }
  }

  applyNeedsData(needs);
  populateJournalNeedsOptions();
}

function loadJournalReferenceData() {
  const loadData = () => {
    const loadNeeds = window.NVCJournal?.loadNeedsList;
    const loadFeelings = window.NVCJournal?.loadFeelingsList;
    if (typeof loadNeeds !== 'function' && typeof loadFeelings !== 'function') {
      return;
    }
    const basePath = state.basePath;
    const needsPromise = typeof loadNeeds === 'function' ? loadNeeds({ basePath }) : Promise.resolve([]);
    const feelingsPromise = typeof loadFeelings === 'function' ? loadFeelings({ basePath }) : Promise.resolve([]);
    Promise.all([
      needsPromise.catch((error) => {
        console.warn('Inventory: unable to load needs list', error);
        return [];
      }),
      feelingsPromise.catch((error) => {
        console.warn('Inventory: unable to load feelings list', error);
        return [];
      }),
    ]).then(([needs, feelings]) => {
      if (Array.isArray(needs) && needs.length) {
        applyNeedsData(needs);
        if (state.journalController && typeof state.journalController.setNeedsOptions === 'function') {
          state.journalController.setNeedsOptions(needs);
          state.journalNeedsSelect = state.journalController.needsSelect;
        } else {
          populateJournalNeedsOptions();
        }
      }
      if (Array.isArray(feelings) && feelings.length) {
        state.feelings = feelings;
        if (state.journalController && typeof state.journalController.setEmotionOptions === 'function') {
          state.journalController.setEmotionOptions(feelings);
        }
      }
    });
  };

  if (isJournalModuleReady()) {
    loadData();
    return;
  }

  const readyPromise = ensureJournalModuleReady();
  if (readyPromise && typeof readyPromise.then === 'function') {
    readyPromise
      .then(() => {
        loadData();
      })
      .catch((error) => {
        console.warn('Inventory: unable to initialize journal reference data', error);
      });
  }
}

function renderInventoryViews() {
  renderInventorySummary();
  applySummaryFilter();
  renderInventoryList();
  updateInventoryCount();
  updateStrategiesVisibility();
  updateInventoryToggleLabel();
  renderJournalViews();
}

function setupJournalSection() {
  const panel = document.querySelector('[data-inventory-section="journal"]');
  if (!panel) {
    setupStandaloneJournalOverlay();
    registerJournalStoreListeners();
    return;
  }
  state.journalInlineContainer = document.querySelector('[data-journal-inline-container]');
  state.journalFormSectionEl =
    state.journalInlineContainer?.querySelector('.journal-form-section') || panel.querySelector('.journal-form-section');
  const mount = panel.querySelector('[data-journal-module]');

  const initializeInlineJournal = () => {
    const renderJournalForm = window.NVCJournal?.renderForm;
    if (typeof renderJournalForm === 'function' && mount) {
      try {
        renderJournalForm(mount, {
          variant: mount.dataset.journalVariant || 'inventory',
          idPrefix: mount.dataset.journalIdPrefix || 'journal',
        });
      } catch (error) {
        console.warn('Unable to render shared journal form', error);
      }
    }

    const createJournalForm = window.NVCJournal?.createForm;
    if (typeof createJournalForm === 'function') {
      const needsData = state.needs.length
        ? state.needs
        : typeof window.NVCJournal?.loadNeedsFromScript === 'function'
        ? window.NVCJournal.loadNeedsFromScript()
        : [];
      try {
        state.journalController = createJournalForm(panel, {
          draftPath: state.journalDraftPath,
          needs: needsData,
          autoDraft: false,
        });
      } catch (error) {
        console.warn('Unable to initialize shared journal module', error);
        state.journalController = null;
      }
    }

    state.journalForm = state.journalController?.form || panel.querySelector('[data-journal-form]');
    state.journalStatusEl = state.journalController?.statusEl || panel.querySelector('[data-journal-status]');
    state.journalMessageEl = state.journalController?.messageEl || panel.querySelector('[data-journal-message]');
    state.journalHistoryEl = panel.querySelector('[data-journal-history]');
    state.journalEmptyEl = panel.querySelector('[data-journal-empty]');
    state.journalSummaryEl = panel.querySelector('[data-journal-summary]');
    state.journalSummaryToggle = panel.querySelector('[data-journal-summary-toggle]');
    state.journalFiltersForm = panel.querySelector('[data-journal-filters]');
    state.journalIntensityDisplay =
      state.journalController?.intensityDisplay || panel.querySelector('[data-journal-intensity-display]');
    state.journalNeedsSelect = state.journalController?.needsSelect || panel.querySelector('[data-journal-needs]');
    state.journalEmotionInput = state.journalController?.emotionInput || panel.querySelector('#journal-emotion');
    state.journalNotesInput = state.journalController?.notesInput || panel.querySelector('#journal-notes');
    state.journalIntensityInput = state.journalController?.intensityInput || panel.querySelector('#journal-intensity');
    state.journalTagsInput = state.journalController?.tagsInput || panel.querySelector('#journal-tags');
    state.journalTagSuggestionsEl =
      state.journalController?.tagSuggestionsEl || panel.querySelector('[data-journal-tag-suggestions]');
    state.journalSaveButton = state.journalController?.saveButton || panel.querySelector('[data-journal-submit]');
    if (state.journalSaveButton) {
      state.journalSaveLabel = state.journalSaveButton.textContent || 'Save entry';
      state.journalSaveButton.dataset.defaultLabel = state.journalSaveLabel;
    }

    if (state.journalForm) {
      state.journalForm.addEventListener('submit', handleJournalFormSubmit);
      state.journalForm.addEventListener('input', handleJournalFormInput);
      state.journalForm.addEventListener('change', handleJournalFormInput);
    }

    const journalClear = panel.querySelector('[data-journal-clear]');
    if (journalClear) {
      journalClear.addEventListener('click', handleJournalFormClear);
    }

    state.journalHistoryEl?.addEventListener('click', handleJournalHistoryClick);

    if (state.journalFiltersForm) {
      state.journalFiltersForm.addEventListener('input', handleJournalFiltersChange);
    }
    const filtersReset = panel.querySelector('[data-journal-filters-reset]');
    filtersReset?.addEventListener('click', handleJournalFiltersReset);

    if (state.journalSummaryToggle) {
      state.journalSummaryToggle.addEventListener('click', () => {
        state.journalSummaryCollapsed = !state.journalSummaryCollapsed;
        updateJournalSummaryVisibility();
      });
    }

    if (state.journalNeedsSelect) {
      const needsEvent = state.journalNeedsSelect instanceof HTMLSelectElement ? 'change' : 'input';
      state.journalNeedsSelect.addEventListener(needsEvent, () => {
        resetJournalSaveButton();
        scheduleJournalDraftSave();
      });
    }

    const journalExport = panel.querySelector('#journal-export');
    journalExport?.addEventListener('click', handleJournalExport);

    const journalImportTrigger = panel.querySelector('#journal-import-trigger');
    const journalImportInput = panel.querySelector('#journal-import');
    if (journalImportTrigger && journalImportInput) {
      journalImportTrigger.addEventListener('click', () => journalImportInput.click());
      journalImportInput.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (file) {
          handleJournalImport(file);
        }
        journalImportInput.value = '';
      });
    }

    populateJournalNeedsOptions();
    if (!state.journalController) {
      const initialIntensity = Number(state.journalIntensityInput?.value);
      updateJournalIntensityDisplay(Number.isFinite(initialIntensity) ? initialIntensity : 5);
    }
    updateJournalSummaryVisibility();
    applyJournalDraft();
  };

  const finalizeJournalSetup = () => {
    setupJournalOverlay();
    registerJournalStoreListeners();
  };

  if (isJournalModuleReady()) {
    initializeInlineJournal();
    finalizeJournalSetup();
    return;
  }

  const statusEl = mount ? ensureJournalStatusElement(mount, 'Loading journal form…') : null;

  ensureJournalModuleReady()
    .then(() => {
      if (statusEl) {
        statusEl.remove();
      }
      initializeInlineJournal();
    })
    .catch((error) => {
      console.warn('Unable to initialize shared journal module', error);
      if (statusEl) {
        statusEl.textContent = 'Journal form unavailable right now. Please refresh the page to try again.';
      } else if (mount) {
        ensureJournalStatusElement(mount, 'Journal form unavailable right now. Please refresh the page to try again.');
      }
    })
    .finally(() => {
      finalizeJournalSetup();
    });
}

function setupJournalOverlay() {
  const containers = Array.from(document.querySelectorAll('[data-journal-overlay]'));
  const container =
    containers.find((element) => element?.querySelector('[data-support-journal-layer]')) ||
    containers[0] ||
    null;
  state.journalOverlayContainer = container || null;
  state.journalOverlayLayer = container?.querySelector('[data-support-journal-layer]') || null;
  state.journalOverlayDialog = container?.querySelector('[data-support-journal-dialog]') || null;
  state.journalOverlayContent = container?.querySelector('[data-journal-overlay-content]') || null;
  state.journalOverlayCloseButton = container?.querySelector('[data-support-journal-close]') || null;
  state.journalOverlayHeading = container?.querySelector('[data-support-journal-heading]') || null;
  state.journalOverlayHistoryEl = container?.querySelector('[data-journal-overlay-history]') || null;

  const openButtons = Array.from(document.querySelectorAll('[data-support-journal-open]')).filter((button) => {
    if (!(button instanceof HTMLElement)) {
      return false;
    }
    return !button.hasAttribute('data-journal-overlay-ignore');
  });
  state.journalOverlayOpenTriggers = [];
  state.journalOverlayOpenButton = container?.querySelector('[data-support-journal-open]') || openButtons[0] || null;

  if (!container) {
    attachDelegatedJournalOverlayTriggerListener();
    return;
  }

  if (state.journalOverlayHeading && !state.journalOverlayHeading.id) {
    state.journalOverlayHeading.id = 'global-support-journal-heading';
  }

  if (state.journalOverlayLayer) {
    if (!state.journalOverlayLayer.id) {
      state.journalOverlayLayer.id = 'global-support-journal-layer';
    }
    state.journalOverlayLayer.dataset.state = 'closed';
    state.journalOverlayLayer.setAttribute('aria-hidden', 'true');
  }

  const overlayId = getJournalOverlayId();

  openButtons.forEach((button) => bindJournalOverlayTrigger(button, overlayId));

  if (state.journalOverlayCloseButton) {
    state.journalOverlayCloseButton.addEventListener('click', () => closeJournalOverlay());
  }

  if (state.journalOverlayLayer) {
    state.journalOverlayLayer.addEventListener('click', handleJournalOverlayLayerClick);
  }

  if (state.journalOverlayHistoryEl) {
    state.journalOverlayHistoryEl.addEventListener('click', handleJournalOverlayHistoryClick);
  }

  restoreJournalFormToInline();
  renderJournalOverlayHistory();
}

function shouldIgnoreJournalOverlayTrigger(element) {
  if (!(element instanceof HTMLElement)) {
    return true;
  }
  if (element.dataset.journalOverlayIgnore === 'true') {
    return true;
  }
  if (element.hasAttribute('data-journal-overlay-ignore')) {
    return true;
  }
  return false;
}

function getJournalOverlayId() {
  if (state.journalOverlayLayer) {
    if (!state.journalOverlayLayer.id) {
      state.journalOverlayLayer.id = 'global-support-journal-layer';
    }
    return state.journalOverlayLayer.id;
  }
  return 'global-support-journal-layer';
}

function bindJournalOverlayTrigger(button, overlayId = getJournalOverlayId()) {
  if (!(button instanceof HTMLElement) || shouldIgnoreJournalOverlayTrigger(button)) {
    return;
  }

  const existingIndex = state.journalOverlayOpenTriggers.indexOf(button);
  if (existingIndex === -1) {
    state.journalOverlayOpenTriggers.push(button);
  }
  if (!state.journalOverlayOpenButton) {
    state.journalOverlayOpenButton = button;
  }

  button.dataset.journalOverlayBound = 'true';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', button.getAttribute('aria-expanded') || 'false');
  if (overlayId) {
    button.setAttribute('aria-controls', overlayId);
  }

  button.removeEventListener('click', handleJournalOverlayTriggerClick);
  button.addEventListener('click', handleJournalOverlayTriggerClick);
}

function handleJournalOverlayTriggerClick(event) {
  const button = event.currentTarget;
  if (!(button instanceof HTMLElement) || shouldIgnoreJournalOverlayTrigger(button)) {
    return;
  }

  if (!state.journalOverlayLayer) {
    setupJournalOverlay();
    if (!state.journalOverlayLayer) {
      return;
    }
  }

  event.preventDefault();
  if (state.journalOverlayOpenTriggers.indexOf(button) === -1) {
    state.journalOverlayOpenTriggers.push(button);
  }
  state.journalOverlayActiveTrigger = button;
  openJournalOverlay();
}

function handleDelegatedJournalOverlayTrigger(event) {
  if (!(event.target instanceof Element)) {
    return;
  }
  const trigger = event.target.closest('[data-support-journal-open]');
  if (!(trigger instanceof HTMLElement)) {
    return;
  }
  if (trigger.dataset.journalOverlayBound === 'true' || shouldIgnoreJournalOverlayTrigger(trigger)) {
    return;
  }

  if (!state.journalOverlayLayer) {
    setupJournalOverlay();
  }
  const overlayId = getJournalOverlayId();
  bindJournalOverlayTrigger(trigger, overlayId);
  trigger.setAttribute('aria-expanded', trigger.getAttribute('aria-expanded') || 'false');
  event.preventDefault();
  state.journalOverlayActiveTrigger = trigger;
  openJournalOverlay();
}

function attachDelegatedJournalOverlayTriggerListener() {
  if (state.journalOverlayDelegatedListenerAttached) {
    return;
  }
  if (typeof document === 'undefined') {
    return;
  }
  document.addEventListener('click', handleDelegatedJournalOverlayTrigger, true);
  state.journalOverlayDelegatedListenerAttached = true;
}

function setupStandaloneJournalOverlay() {
  setupJournalOverlay();
  const container = state.journalOverlayContent;
  if (!container) {
    return;
  }

  let formSection = container.querySelector('.journal-form-section');
  if (!formSection) {
    formSection = document.createElement('section');
    formSection.className = 'journal-form-section';
    formSection.setAttribute('aria-labelledby', 'journal-form-heading');

    const header = document.createElement('div');
    header.className = 'journal-form-section__header';

    const heading = document.createElement('h2');
    heading.id = 'journal-form-heading';
    heading.className = 'section-title';
    heading.textContent = 'Log a new entry';

    const hint = document.createElement('p');
    hint.className = 'journal-form-section__hint';
    hint.textContent = "Tag what's present right now. Unsure of the feeling? Leave it blank and lean on the notes.";

    header.append(heading, hint);
    formSection.append(header);

    const module = document.createElement('div');
    module.className = 'journal-module';
    module.dataset.journalModule = '';
    module.dataset.journalVariant = 'inventory';
    module.dataset.journalIdPrefix = 'journal';

    formSection.append(module);
    container.prepend(formSection);
  }

  let mount = formSection.querySelector('[data-journal-module]');
  if (!mount) {
    mount = document.createElement('div');
    mount.className = 'journal-module';
    mount.dataset.journalModule = '';
    mount.dataset.journalVariant = 'inventory';
    mount.dataset.journalIdPrefix = 'journal';
    formSection.append(mount);
  }

  state.journalFormSectionEl = formSection;

  const initializeOverlayJournal = () => {
    const renderJournalForm = window.NVCJournal?.renderForm;
    if (typeof renderJournalForm === 'function') {
      try {
        renderJournalForm(mount, {
          variant: mount.dataset.journalVariant || 'inventory',
          idPrefix: mount.dataset.journalIdPrefix || 'journal',
        });
      } catch (error) {
        console.warn('Unable to render shared journal form', error);
      }
    }

    const createJournalForm = window.NVCJournal?.createForm;
    if (typeof createJournalForm === 'function') {
      const needsData = state.needs.length
        ? state.needs
        : typeof window.NVCJournal?.loadNeedsFromScript === 'function'
        ? window.NVCJournal.loadNeedsFromScript()
        : [];
      try {
        state.journalController = createJournalForm(formSection, {
          draftPath: state.journalDraftPath,
          needs: needsData,
          autoDraft: false,
        });
      } catch (error) {
        console.warn('Unable to initialize shared journal module', error);
        state.journalController = null;
      }
    }

    state.journalForm = state.journalController?.form || formSection.querySelector('[data-journal-form]');
    state.journalStatusEl = state.journalController?.statusEl || formSection.querySelector('[data-journal-status]');
    state.journalMessageEl =
      state.journalController?.messageEl || container.querySelector('[data-journal-message]');
    state.journalIntensityDisplay =
      state.journalController?.intensityDisplay || formSection.querySelector('[data-journal-intensity-display]');
    state.journalNeedsSelect = state.journalController?.needsSelect || formSection.querySelector('[data-journal-needs]');
    state.journalEmotionInput = state.journalController?.emotionInput || formSection.querySelector('[data-journal-emotion]');
    state.journalNotesInput = state.journalController?.notesInput || formSection.querySelector('[data-journal-notes]');
    state.journalIntensityInput = state.journalController?.intensityInput || formSection.querySelector('[data-journal-intensity]');
    state.journalTagsInput = state.journalController?.tagsInput || formSection.querySelector('[data-journal-tags]');
    state.journalTagSuggestionsEl =
      state.journalController?.tagSuggestionsEl || formSection.querySelector('[data-journal-tag-suggestions]');
    state.journalSaveButton = state.journalController?.saveButton || formSection.querySelector('[data-journal-submit]');
    if (state.journalSaveButton) {
      state.journalSaveLabel = state.journalSaveButton.textContent || 'Save entry';
      state.journalSaveButton.dataset.defaultLabel = state.journalSaveLabel;
    }

    if (state.journalForm) {
      state.journalForm.addEventListener('submit', handleJournalFormSubmit);
      state.journalForm.addEventListener('input', handleJournalFormInput);
      state.journalForm.addEventListener('change', handleJournalFormInput);
    }

    if (state.journalNeedsSelect) {
      const needsEvent = state.journalNeedsSelect instanceof HTMLSelectElement ? 'change' : 'input';
      state.journalNeedsSelect.addEventListener(needsEvent, () => {
        resetJournalSaveButton();
        scheduleJournalDraftSave();
      });
    }

    populateJournalNeedsOptions();
    if (!state.journalController) {
      const initialIntensity = Number(state.journalIntensityInput?.value);
      updateJournalIntensityDisplay(Number.isFinite(initialIntensity) ? initialIntensity : 5);
    }
    applyJournalDraft();
    renderJournalOverlayHistory();
  };

  if (isJournalModuleReady()) {
    initializeOverlayJournal();
    return;
  }

  const statusEl = ensureJournalStatusElement(mount, 'Loading journal form…');

  ensureJournalModuleReady()
    .then(() => {
      if (statusEl) {
        statusEl.remove();
      }
      initializeOverlayJournal();
    })
    .catch((error) => {
      console.warn('Unable to initialize shared journal module', error);
      ensureJournalStatusElement(mount, 'Journal form unavailable right now. Please refresh the page to try again.');
    });
}

function registerJournalStoreListeners() {
  if (state.journalStoreListenersAttached) {
    return;
  }
  state.journalStoreListenersAttached = true;

  if (typeof window !== 'undefined') {
    window.addEventListener('nvc-journal-store-ready', () => {
      state.journalStore = resolveJournalStore();
      updateJournalEntriesFromStore();
      renderJournalViews();
      if (!state.journalEditingId) {
        const editId = getJournalEditIdFromLocation();
        if (editId) {
          startJournalEdit(editId, { focusHistory: false });
        }
      }
    });
  }

  const initialEditId = getJournalEditIdFromLocation();
  if (initialEditId && !state.journalEditingId) {
    startJournalEdit(initialEditId, { focusHistory: true });
  }
}

function updateJournalOverlayTriggerExpanded(expanded) {
  const value = expanded ? 'true' : 'false';
  state.journalOverlayOpenTriggers.forEach((button) => {
    if (button instanceof HTMLElement) {
      button.setAttribute('aria-expanded', value);
    }
  });
}

function moveJournalFormToOverlay() {
  if (!state.journalOverlayContent || !state.journalFormSectionEl) {
    return;
  }
  if (state.journalOverlayContent.contains(state.journalFormSectionEl)) {
    return;
  }
  state.journalOverlayContent.appendChild(state.journalFormSectionEl);
}

function restoreJournalFormToInline() {
  if (!state.journalInlineContainer || !state.journalFormSectionEl) {
    return;
  }
  if (state.journalInlineContainer.contains(state.journalFormSectionEl)) {
    return;
  }
  state.journalInlineContainer.appendChild(state.journalFormSectionEl);
}

function enableJournalOverlayDialogAttributes() {
  if (!state.journalOverlayDialog) {
    return;
  }
  state.journalOverlayDialog.setAttribute('role', 'dialog');
  state.journalOverlayDialog.setAttribute('aria-modal', 'true');
  if (state.journalOverlayHeading?.id) {
    state.journalOverlayDialog.setAttribute('aria-labelledby', state.journalOverlayHeading.id);
  }
}

function disableJournalOverlayDialogAttributes() {
  if (!state.journalOverlayDialog) {
    return;
  }
  state.journalOverlayDialog.removeAttribute('role');
  state.journalOverlayDialog.removeAttribute('aria-modal');
  state.journalOverlayDialog.removeAttribute('aria-labelledby');
}

function openJournalOverlay() {
  if (!state.journalOverlayLayer || state.journalOverlayOpen) {
    return;
  }
  moveJournalFormToOverlay();
  state.journalOverlayOpen = true;
  state.journalOverlayLayer.dataset.state = 'open';
  state.journalOverlayLayer.setAttribute('aria-hidden', 'false');
  updateJournalOverlayTriggerExpanded(true);
  enableJournalOverlayDialogAttributes();
  if (document.body?.classList) {
    document.body.classList.add('has-support-journal-open');
  }
  renderJournalOverlayHistory();
  const focusDialog = () => {
    if (!state.journalOverlayDialog) {
      return;
    }
    try {
      state.journalOverlayDialog.focus({ preventScroll: true });
    } catch (error) {
      state.journalOverlayDialog.focus();
    }
  };
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(focusDialog);
  } else {
    focusDialog();
  }
  document.addEventListener('keydown', handleJournalOverlayKeydown);
}

function closeJournalOverlay(options = {}) {
  const { returnFocus = true } = options;
  if (!state.journalOverlayLayer || !state.journalOverlayOpen) {
    return;
  }
  state.journalOverlayOpen = false;
  state.journalOverlayLayer.dataset.state = 'closed';
  state.journalOverlayLayer.setAttribute('aria-hidden', 'true');
  updateJournalOverlayTriggerExpanded(false);
  if (returnFocus) {
    const focusTarget = state.journalOverlayActiveTrigger || state.journalOverlayOpenButton;
    if (focusTarget instanceof HTMLElement) {
      focusTarget.focus();
    }
  }
  state.journalOverlayActiveTrigger = null;
  disableJournalOverlayDialogAttributes();
  if (document.body?.classList) {
    document.body.classList.remove('has-support-journal-open');
  }
  document.removeEventListener('keydown', handleJournalOverlayKeydown);
  restoreJournalFormToInline();
}

function handleJournalOverlayLayerClick(event) {
  if (!state.journalOverlayLayer || event.target !== state.journalOverlayLayer) {
    return;
  }
  closeJournalOverlay();
}

function handleJournalOverlayKeydown(event) {
  if (event.key === 'Escape' || event.key === 'Esc') {
    closeJournalOverlay();
  }
}

function handleJournalOverlayHistoryClick(event) {
  const link = event.target.closest('a');
  if (!link) {
    return;
  }
  closeJournalOverlay({ returnFocus: false });
}

function populateJournalNeedsOptions() {
  if (state.journalController && typeof state.journalController.setNeedsOptions === 'function') {
    state.journalController.setNeedsOptions(state.needs);
    state.journalNeedsSelect = state.journalController.needsSelect;
    return;
  }

  const select = state.journalNeedsSelect;
  if (!select) {
    return;
  }
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  select.innerHTML = '';
  if (!state.needs.length) {
    return;
  }
  state.needs.forEach((need) => {
    const option = document.createElement('option');
    option.value = need.slug;
    option.textContent = need.title;
    select.append(option);
  });
}

function renderJournalViews() {
  renderJournalSummary();
  renderJournalHistory();
  renderJournalOverlayHistory();
  updateJournalSummaryVisibility();
}

function normalizeJournalTags(value) {
  if (!value) {
    return [];
  }
  const segments = value.split(',');
  const seen = new Set();
  const tags = [];
  segments.forEach((segment) => {
    const trimmed = segment.replace(/^#/, '').trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    tags.push(trimmed);
  });
  return tags;
}

function joinJournalTags(tags, { trailing = false } = {}) {
  const list = Array.isArray(tags) ? tags.filter(Boolean) : [];
  if (!list.length) {
    return '';
  }
  const joined = list.join(', ');
  return trailing ? `${joined}, ` : joined;
}

function getJournalTagFragment(value) {
  if (!value) {
    return '';
  }
  const segments = value.split(',');
  const fragment = segments[segments.length - 1] || '';
  return fragment.replace(/^#/, '').trim();
}

function collectJournalFormData() {
  if (state.journalController && typeof state.journalController.collectData === 'function') {
    return state.journalController.collectData();
  }
  if (!state.journalForm) {
    return { emotion: '', intensity: undefined, needs: [], tags: [], notes: '' };
  }
  const formData = new FormData(state.journalForm);
  const emotion = (formData.get('emotion') || '').toString().trim();
  const intensityValue = Number(formData.get('intensity'));
  const intensity = Number.isFinite(intensityValue) ? Math.min(10, Math.max(0, Math.round(intensityValue))) : undefined;
  let needs = [];
  if (state.journalNeedsSelect instanceof HTMLSelectElement) {
    needs = Array.from(state.journalNeedsSelect.selectedOptions || [])
      .map((option) => option.value)
      .filter(Boolean);
  } else if (state.journalNeedsSelect) {
    needs = (state.journalNeedsSelect.value || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => resolveNeedLabel(value) || value);
  }
  const tags = normalizeJournalTags((formData.get('tags') || '').toString());
  const notes = (formData.get('notes') || '').toString().trim();
  return { emotion, intensity, needs, tags, notes };
}

function createJournalEntry(overrides = {}) {
  const factory = window.NVCJournal?.makeEntry;
  if (typeof factory === 'function') {
    return factory({ source: 'journal', ...overrides });
  }
  const fallback = {
    id: `journal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    dateISO: new Date().toISOString(),
    emotion: '',
    intensity: undefined,
    confidence: undefined,
    sensations: [],
    needs: [],
    strategies: [],
    tags: [],
    notes: '',
    energy: undefined,
    valence: undefined,
    zone: null,
    emotionCandidates: [],
    chosenEmotionConfidence: undefined,
    regulationUsed: [],
    source: 'journal',
  };
  return { ...fallback, ...overrides, source: 'journal' };
}

function fillJournalForm(values = {}) {
  if (state.journalController && typeof state.journalController.setValues === 'function') {
    state.journalController.setValues(values, { trailingTags: false });
    state.journalNeedsSelect = state.journalController.needsSelect;
    state.journalIntensityInput = state.journalController.intensityInput;
    state.journalIntensityDisplay = state.journalController.intensityDisplay;
    state.journalEmotionInput = state.journalController.emotionInput;
    state.journalNotesInput = state.journalController.notesInput;
    state.journalTagsInput = state.journalController.tagsInput;
    resetJournalSaveButton();
    return;
  }
  if (!state.journalForm) {
    return;
  }
  if (state.journalEmotionInput) {
    state.journalEmotionInput.value = values.emotion || '';
  }
  if (state.journalNotesInput) {
    state.journalNotesInput.value = values.notes || '';
  }
  const intensityValue = Number.isFinite(values.intensity)
    ? Math.min(10, Math.max(0, Math.round(values.intensity)))
    : 5;
  if (state.journalIntensityInput) {
    state.journalIntensityInput.value = String(intensityValue);
  }
  updateJournalIntensityDisplay(intensityValue);
  if (state.journalNeedsSelect instanceof HTMLSelectElement) {
    const selectedNeeds = Array.isArray(values.needs) ? values.needs.map((need) => need.toString()) : [];
    Array.from(state.journalNeedsSelect.options).forEach((option) => {
      option.selected = selectedNeeds.includes(option.value);
    });
  } else if (state.journalNeedsSelect) {
    const needsList = Array.isArray(values.needs)
      ? values.needs.map((value) => resolveNeedLabel(value) || value)
      : [];
    state.journalNeedsSelect.value = needsList.length ? `${needsList.join(', ')}` : '';
  }
  if (state.journalTagsInput) {
    const tagsValue = Array.isArray(values.tags)
      ? values.tags
      : typeof values.tags === 'string'
      ? normalizeJournalTags(values.tags)
      : [];
    state.journalTagsInput.value = joinJournalTags(tagsValue, { trailing: false });
  }
  hideJournalTagSuggestions();
  resetJournalSaveButton();
}

function resetJournalForm(options = {}) {
  if (state.journalController && typeof state.journalController.resetForm === 'function') {
    state.journalController.resetForm();
  } else if (state.journalForm) {
    state.journalForm.reset();
    fillJournalForm({});
    hideJournalTagSuggestions();
  }
  state.journalEditingId = '';
  state.journalEditingEntry = null;
  if (state.journalDraftTimer) {
    clearTimeout(state.journalDraftTimer);
    state.journalDraftTimer = null;
  }
  if (!options.keepStatus) {
    showJournalStatus('');
  }
  if (state.journalController && typeof state.journalController.clearDraft === 'function') {
    state.journalController.clearDraft();
  } else if (state.journalStore && state.journalDraftPath) {
    state.journalStore.clearDraft(state.journalDraftPath);
  }
  setJournalEditState('');
}

function escapeSelector(value) {
  if (typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
}

function focusJournalHistoryCard(id) {
  if (!state.journalHistoryEl || !id) {
    return;
  }
  const selector = `[data-journal-id="${escapeSelector(id)}"]`;
  const card = state.journalHistoryEl.querySelector(selector);
  if (!card) {
    return;
  }
  card.classList.add('journal-entry--highlight');
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => {
    card.classList.remove('journal-entry--highlight');
  }, 2000);
}

function saveJournalDraft() {
  const store = ensureJournalStore();
  if (!store || !state.journalDraftPath || !state.journalForm) {
    return;
  }
  const draft = { ...collectJournalFormData() };
  if (state.journalEditingId) {
    draft.editingId = state.journalEditingId;
  }
  const intensityProvided =
    Number.isFinite(draft.intensity) && (state.journalEditingId || draft.intensity !== 5);
  const hasContent =
    draft.emotion ||
    draft.notes ||
    (Array.isArray(draft.tags) && draft.tags.length) ||
    (Array.isArray(draft.needs) && draft.needs.length) ||
    intensityProvided;
  if (!hasContent) {
    store.clearDraft(state.journalDraftPath);
    return;
  }
  store.saveDraft(state.journalDraftPath, draft);
}

function scheduleJournalDraftSave() {
  if (state.journalDraftTimer) {
    clearTimeout(state.journalDraftTimer);
  }
  state.journalDraftTimer = setTimeout(() => {
    state.journalDraftTimer = null;
    saveJournalDraft();
  }, 1200);
}

function loadJournalDraft() {
  const store = ensureJournalStore();
  if (!store || !state.journalDraftPath) {
    return null;
  }
  return store.loadDraft(state.journalDraftPath);
}

function getJournalEditIdFromLocation() {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    const url = new URL(window.location.href);
    if (url.hash !== JOURNAL_EDIT_HASH) {
      return '';
    }
    const id = url.searchParams.get(JOURNAL_EDIT_QUERY_KEY);
    return id ? decodeURIComponent(id) : '';
  } catch (error) {
    console.warn('Unable to parse journal edit location', error);
    return '';
  }
}

function setJournalEditState(id) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set(JOURNAL_EDIT_QUERY_KEY, id);
      url.hash = JOURNAL_EDIT_HASH;
    } else {
      url.searchParams.delete(JOURNAL_EDIT_QUERY_KEY);
      url.hash = '';
    }
    if (window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', url);
    } else {
      window.location.replace(url.toString());
    }
  } catch (error) {
    console.warn('Unable to update journal edit state', error);
  }
}

function startJournalEdit(id, { focusHistory = false } = {}) {
  const store = ensureJournalStore();
  if (!store) {
    showJournalStatus('Unable to edit right now. Try reloading.');
    return;
  }
  const entry = store.get(id);
  if (!entry) {
    showJournalStatus('Entry not found.');
    return;
  }
  state.journalEditingId = entry.id;
  state.journalEditingEntry = entry;
  fillJournalForm(entry);
  setJournalEditState(entry.id);
  if (!state.journalOverlayLayer || !state.journalOverlayContent) {
    setupJournalOverlay();
  }
  openJournalOverlay();
  if (state.journalNotesInput) {
    state.journalNotesInput.focus();
  }
  const formattedDate = formatJournalDate(entry.dateISO);
  showJournalStatus(`Editing entry from ${formattedDate}. Save to update or clear to cancel.`);
  if (focusHistory) {
    focusJournalHistoryCard(entry.id);
  }
  saveJournalDraft();
}

function applyJournalDraft() {
  const draft = loadJournalDraft();
  if (!draft) {
    return;
  }
  if (draft.editingId) {
    const store = ensureJournalStore();
    const entry = store?.get(draft.editingId);
    if (entry) {
      state.journalEditingId = entry.id;
      state.journalEditingEntry = entry;
      setJournalEditState(entry.id);
    }
  }
  fillJournalForm(draft);
  if (draft.editingId) {
    showJournalStatus('Restored draft. Finish editing and save when ready.');
  }
}

function hideJournalTagSuggestions() {
  if (state.journalController && typeof state.journalController.hideTagSuggestions === 'function') {
    state.journalController.hideTagSuggestions();
    state.journalTagSuggestionsEl = state.journalController.tagSuggestionsEl;
    return;
  }
  if (!state.journalTagSuggestionsEl) {
    return;
  }
  state.journalTagSuggestionsEl.hidden = true;
  state.journalTagSuggestionsEl.innerHTML = '';
  state.journalTagActiveIndex = -1;
  state.journalTagsInput?.setAttribute('aria-expanded', 'false');
}

function renderJournalTagSuggestions(list) {
  if (!state.journalTagSuggestionsEl) {
    return;
  }
  state.journalTagSuggestionsEl.innerHTML = '';
  if (!list.length) {
    hideJournalTagSuggestions();
    return;
  }
  state.journalTagSuggestionsEl.hidden = false;
  state.journalTagsInput?.setAttribute('aria-expanded', 'true');
  list.forEach((tag, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'journal-tag-suggestion';
    button.dataset.journalTagSuggestion = tag;
    button.dataset.index = String(index);
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', 'false');
    button.textContent = `#${tag}`;
    state.journalTagSuggestionsEl.appendChild(button);
  });
}

function setJournalTagActive(index) {
  state.journalTagActiveIndex = index;
  if (!state.journalTagSuggestionsEl) {
    return;
  }
  const buttons = state.journalTagSuggestionsEl.querySelectorAll('[data-journal-tag-suggestion]');
  buttons.forEach((button, idx) => {
    const active = idx === index;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function refreshJournalTagSuggestions(fragment = '') {
  const normalized = fragment.trim().toLowerCase();
  const source = Array.isArray(state.journalTagSuggestions) ? state.journalTagSuggestions : [];
  let matches = [];
  if (normalized) {
    matches = source.filter((tag) => tag.toLowerCase().startsWith(normalized)).slice(0, 8);
  } else {
    matches = source.slice(0, 8);
  }
  if (!matches.length) {
    hideJournalTagSuggestions();
    return;
  }
  renderJournalTagSuggestions(matches);
  setJournalTagActive(0);
}

function applyTagSuggestion(tag) {
  if (!state.journalTagsInput) {
    return;
  }
  const value = state.journalTagsInput.value || '';
  const segments = value.split(',');
  const leading = segments
    .slice(0, -1)
    .map((segment) => segment.replace(/^#/, '').trim())
    .filter(Boolean);
  const normalized = (tag || '').trim();
  const lower = normalized.toLowerCase();
  const unique = leading.filter((existing) => existing.toLowerCase() !== lower);
  unique.push(normalized);
  state.journalTagsInput.value = joinJournalTags(unique, { trailing: true });
  hideJournalTagSuggestions();
  state.journalTagsInput.focus();
  resetJournalSaveButton();
  scheduleJournalDraftSave();
}

function handleJournalTagInput() {
  if (!state.journalTagsInput) {
    return;
  }
  resetJournalSaveButton();
  scheduleJournalDraftSave();
  const fragment = getJournalTagFragment(state.journalTagsInput.value || '');
  refreshJournalTagSuggestions(fragment);
}

function handleJournalTagFocus() {
  const fragment = state.journalTagsInput ? getJournalTagFragment(state.journalTagsInput.value || '') : '';
  refreshJournalTagSuggestions(fragment);
}

function handleJournalTagBlur() {
  setTimeout(() => {
    if (document.activeElement === state.journalTagsInput) {
      return;
    }
    hideJournalTagSuggestions();
  }, 120);
}

function handleJournalTagKeydown(event) {
  if (event.key === 'Escape') {
    hideJournalTagSuggestions();
    return;
  }
  if (!state.journalTagSuggestionsEl || state.journalTagSuggestionsEl.hidden) {
    return;
  }
  const buttons = state.journalTagSuggestionsEl.querySelectorAll('[data-journal-tag-suggestion]');
  if (!buttons.length) {
    return;
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (state.journalTagActiveIndex + direction + buttons.length) % buttons.length;
    setJournalTagActive(nextIndex);
  } else if ((event.key === 'Enter' || event.key === 'Tab') && state.journalTagActiveIndex >= 0) {
    event.preventDefault();
    const button = buttons[state.journalTagActiveIndex];
    if (button) {
      applyTagSuggestion(button.dataset.journalTagSuggestion || '');
    }
  }
}

function handleTagSuggestionClick(event) {
  const button = event.target.closest('[data-journal-tag-suggestion]');
  if (!button) {
    return;
  }
  event.preventDefault();
  applyTagSuggestion(button.dataset.journalTagSuggestion || '');
}

function handleTagSuggestionMouseOver(event) {
  const button = event.target.closest('[data-journal-tag-suggestion]');
  if (!button) {
    return;
  }
  const index = Number.parseInt(button.dataset.index, 10);
  if (Number.isFinite(index)) {
    setJournalTagActive(index);
  }
}

function handleJournalFormInput() {
  resetJournalSaveButton();
  scheduleJournalDraftSave();
}

function updateJournalSummaryVisibility() {
  if (!state.journalSummaryEl || !state.journalSummaryToggle) {
    return;
  }
  const collapsed = !!state.journalSummaryCollapsed;
  state.journalSummaryEl.hidden = collapsed;
  state.journalSummaryToggle.textContent = collapsed ? 'Show summary' : 'Hide summary';
  state.journalSummaryToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}

function updateJournalIntensityDisplay(value) {
  if (state.journalController && typeof state.journalController.updateIntensityDisplay === 'function') {
    state.journalController.updateIntensityDisplay(value);
    state.journalIntensityDisplay = state.journalController.intensityDisplay;
    return;
  }
  if (!state.journalIntensityDisplay) {
    return;
  }
  const numeric = Number(value);
  const displayValue = Number.isFinite(numeric) ? Math.min(10, Math.max(1, Math.round(numeric))) : 5;
  state.journalIntensityDisplay.textContent = `${displayValue}/10`;
}

function handleJournalIntensityInput(event) {
  const value = Number(event?.target?.value);
  updateJournalIntensityDisplay(value);
  resetJournalSaveButton();
  scheduleJournalDraftSave();
}

function renderJournalSummary() {
  if (!state.journalSummaryEl) {
    return;
  }
  const container = state.journalSummaryEl;
  container.innerHTML = '';
  const entries = Array.isArray(state.journalEntries) ? state.journalEntries : [];
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'journal-empty';
    empty.textContent = 'Save entries to see a snapshot of your progress.';
    container.appendChild(empty);
    return;
  }

  const totalStat = createJournalSummaryStat('Entries logged', String(entries.length));
  container.appendChild(totalStat);

  const intensityEntries = entries.filter((entry) => Number.isFinite(entry.intensity));
  const averageIntensity = intensityEntries.length
    ? (intensityEntries.reduce((sum, entry) => sum + entry.intensity, 0) / intensityEntries.length).toFixed(1)
    : '—';
  const intensityStat = createJournalSummaryStat('Average intensity', `${averageIntensity}`);
  container.appendChild(intensityStat);

  const emotionCounts = new Map();
  entries.forEach((entry) => {
    if (!entry.emotion) {
      return;
    }
    const key = entry.emotion.trim().toLowerCase();
    if (!key) {
      return;
    }
    emotionCounts.set(key, (emotionCounts.get(key) || 0) + 1);
  });
  const topEmotions = Array.from(emotionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([emotion, count]) => `${capitalizeWord(emotion)} · ${count}`);
  const emotionStat = createJournalSummaryStat(
    'Most frequent emotions',
    topEmotions.length ? topEmotions[0].split(' · ')[0] : '—',
    topEmotions
  );
  container.appendChild(emotionStat);

  const tagCounts = new Map();
  entries.forEach((entry) => {
    if (!Array.isArray(entry.tags)) {
      return;
    }
    entry.tags.forEach((tag) => {
      const key = tag.trim().toLowerCase();
      if (!key) {
        return;
      }
      tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
    });
  });
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag, count]) => `#${tag} · ${count}`);
  const tagStat = createJournalSummaryStat('Trending tags', topTags.length ? topTags[0].split(' · ')[0] : '—', topTags);
  container.appendChild(tagStat);

  const needCounts = new Map();
  entries.forEach((entry) => {
    if (!Array.isArray(entry.needs)) {
      return;
    }
    entry.needs.forEach((need) => {
      const key = need.trim().toLowerCase();
      if (!key) {
        return;
      }
      needCounts.set(key, (needCounts.get(key) || 0) + 1);
    });
  });
  const topNeeds = Array.from(needCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([need, count]) => `${resolveNeedLabel(need)} · ${count}`);
  const needsStat = createJournalSummaryStat(
    'Needs that appear often',
    topNeeds.length ? topNeeds[0].split(' · ')[0] : '—',
    topNeeds
  );
  container.appendChild(needsStat);
}

function createJournalSummaryStat(label, value, listItems = []) {
  const card = document.createElement('div');
  card.className = 'journal-summary__stat';
  const labelEl = document.createElement('span');
  labelEl.className = 'journal-summary__label';
  labelEl.textContent = label;
  card.appendChild(labelEl);
  const valueEl = document.createElement('p');
  valueEl.className = 'journal-summary__value';
  valueEl.textContent = value;
  card.appendChild(valueEl);
  if (Array.isArray(listItems) && listItems.length) {
    const list = document.createElement('ul');
    list.className = 'journal-summary__list';
    listItems.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    card.appendChild(list);
  }
  return card;
}

function resolveNeedLabel(value) {
  if (!value) {
    return '';
  }
  const normalized = value.toLowerCase();
  if (state.needsBySlug.has(normalized)) {
    return state.needsBySlug.get(normalized).title;
  }
  const match = state.needs.find((need) => need.title.toLowerCase() === normalized);
  return match ? match.title : value;
}

function buildNeedLink(value) {
  const normalized = value.toLowerCase();
  if (state.needsBySlug.has(normalized)) {
    const need = state.needsBySlug.get(normalized);
    return {
      href: `${state.basePath}needs/${need.slug}/`,
      label: need.title,
    };
  }
  return {
    href: `${state.basePath}needs/?focus=${encodeURIComponent(normalized)}`,
    label: resolveNeedLabel(value),
  };
}

function formatJournalDate(timestamp) {
  if (!timestamp) {
    return '';
  }
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch (error) {
    return timestamp;
  }
}

function renderJournalHistory() {
  if (!state.journalHistoryEl) {
    return;
  }
  const container = state.journalHistoryEl;
  container.innerHTML = '';
  const entries = getFilteredJournalEntries();
  if (state.journalEmptyEl) {
    state.journalEmptyEl.hidden = entries.length > 0;
  }
  if (!entries.length) {
    return;
  }
  entries.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'journal-entry';
    card.dataset.journalId = entry.id;

    const header = document.createElement('div');
    header.className = 'journal-entry__header';
    const emotion = document.createElement('h4');
    emotion.className = 'journal-entry__emotion';
    emotion.textContent = entry.emotion ? capitalizeWord(entry.emotion) : 'Reflection';
    header.appendChild(emotion);

    const meta = document.createElement('div');
    meta.className = 'journal-entry__meta';
    const date = document.createElement('span');
    date.textContent = formatJournalDate(entry.dateISO);
    meta.appendChild(date);
    if (Number.isFinite(entry.intensity)) {
      const intensity = document.createElement('span');
      intensity.textContent = `Intensity ${entry.intensity}/10`;
      meta.appendChild(intensity);
    }
    header.appendChild(meta);
    card.appendChild(header);

    if (Array.isArray(entry.tags) && entry.tags.length) {
      const tagsList = document.createElement('div');
      tagsList.className = 'journal-entry__tags';
      entry.tags.forEach((tag) => {
        const chip = document.createElement('span');
        chip.className = 'journal-tag';
        chip.textContent = `#${tag}`;
        tagsList.appendChild(chip);
      });
      card.appendChild(tagsList);
    }

    if (Array.isArray(entry.needs) && entry.needs.length) {
      const needsList = document.createElement('div');
      needsList.className = 'journal-entry__needs';
      entry.needs.forEach((needValue) => {
        const { href, label } = buildNeedLink(needValue);
        const link = document.createElement('a');
        link.className = 'journal-need-link';
        link.href = href;
        link.textContent = label;
        needsList.appendChild(link);
      });
      card.appendChild(needsList);
    }

    if (entry.notes) {
      const notes = document.createElement('p');
      notes.className = 'journal-entry__notes';
      notes.textContent = entry.notes;
      card.appendChild(notes);
    }

    const actions = document.createElement('div');
    actions.className = 'journal-entry__actions';
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'journal-entry__edit';
    editButton.dataset.journalAction = 'edit';
    editButton.dataset.journalId = entry.id;
    editButton.textContent = 'Edit';
    actions.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'journal-entry__delete';
    deleteButton.dataset.journalAction = 'delete';
    deleteButton.dataset.journalId = entry.id;
    deleteButton.textContent = 'Delete';
    actions.appendChild(deleteButton);
    card.appendChild(actions);

    container.appendChild(card);
  });
}

function renderJournalOverlayHistory() {
  const container = state.journalOverlayHistoryEl;
  if (!container) {
    return;
  }
  container.innerHTML = '';
  const entries = Array.isArray(state.journalEntries) ? [...state.journalEntries] : [];
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'support-note';
    empty.textContent = 'Your saved reflections will appear here and in the dashboard below.';
    container.appendChild(empty);
    return;
  }
  const title = document.createElement('p');
  title.className = 'journal-history__title';
  title.textContent = 'Recent reflections on this device';
  container.appendChild(title);
  const list = document.createElement('ul');
  list.className = 'journal-history';
  entries
    .slice()
    .sort((a, b) => new Date(b.dateISO || 0) - new Date(a.dateISO || 0))
    .slice(0, 5)
    .forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'journal-history__item';
      const segments = [];
      const dateLabel = formatJournalDate(entry.dateISO);
      if (dateLabel) {
        segments.push(dateLabel);
      }
      const emotionLabel = entry.emotion ? `${capitalizeWord(entry.emotion)} — ` : '';
      const detail = `${emotionLabel}${entry.notes || ''}`.trim();
      if (detail) {
        segments.push(detail);
      }
      item.textContent = segments.join(': ');
      list.appendChild(item);
    });
  container.appendChild(list);
  const link = document.createElement('a');
  link.className = 'support-button support-button--link support-button--ghost';
  const basePath = typeof state?.basePath === 'string' ? state.basePath : document.body?.dataset?.basePath || '';
  link.href = `${basePath}inventory/journal/#journal-history-heading`;
  link.textContent = 'Jump to journal history';
  container.appendChild(link);
}

function getFilteredJournalEntries() {
  const entries = Array.isArray(state.journalEntries) ? [...state.journalEntries] : [];
  const searchTerm = state.journalFilters.search?.trim().toLowerCase();
  const tagFilter = state.journalFilters.tag?.trim().toLowerCase();
  const sort = state.journalFilters.sort || 'newest';
  const range = state.journalFilters.range || 'all';

  let filtered = entries;
  if (searchTerm) {
    filtered = filtered.filter((entry) => {
      const haystack = [entry.notes || '', entry.emotion || '', ...(entry.tags || []), ...(entry.needs || [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }

  if (tagFilter) {
    filtered = filtered.filter((entry) =>
      Array.isArray(entry.tags) && entry.tags.some((tag) => tag.toLowerCase().includes(tagFilter))
    );
  }

  if (range !== 'all') {
    const days = Number(range);
    if (Number.isFinite(days) && days > 0) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((entry) => {
        const time = new Date(entry.dateISO || 0).getTime();
        if (!Number.isFinite(time)) {
          return false;
        }
        return time >= cutoff;
      });
    }
  }

  const sortByTimestamp = (a, b) => new Date(b.dateISO || 0) - new Date(a.dateISO || 0);
  if (sort === 'oldest') {
    filtered.sort((a, b) => new Date(a.dateISO || 0) - new Date(b.dateISO || 0));
  } else if (sort === 'intensity-high') {
    filtered.sort((a, b) => {
      const aVal = Number.isFinite(a.intensity) ? a.intensity : -Infinity;
      const bVal = Number.isFinite(b.intensity) ? b.intensity : -Infinity;
      if (bVal === aVal) {
        return sortByTimestamp(a, b);
      }
      return bVal - aVal;
    });
  } else if (sort === 'intensity-low') {
    filtered.sort((a, b) => {
      const aVal = Number.isFinite(a.intensity) ? a.intensity : Infinity;
      const bVal = Number.isFinite(b.intensity) ? b.intensity : Infinity;
      if (aVal === bVal) {
        return sortByTimestamp(a, b);
      }
      return aVal - bVal;
    });
  } else {
    filtered.sort(sortByTimestamp);
  }

  return filtered;
}

function showJournalStatus(message) {
  if (state.journalController && typeof state.journalController.showStatus === 'function') {
    state.journalController.showStatus(message || '');
    state.journalStatusEl = state.journalController.statusEl;
    return;
  }
  if (!state.journalStatusEl) {
    return;
  }
  state.journalStatusEl.textContent = message || '';
}

function showJournalMessage(message, type = 'success') {
  if (state.journalController && typeof state.journalController.showMessage === 'function') {
    state.journalController.showMessage(message, type);
    state.journalMessageEl = state.journalController.messageEl;
    return;
  }
  if (!state.journalMessageEl) {
    return;
  }
  if (!message) {
    state.journalMessageEl.textContent = '';
    state.journalMessageEl.hidden = true;
    state.journalMessageEl.classList.remove(
      'journal-message--success',
      'journal-message--warning',
      'journal-message--error'
    );
    return;
  }
  state.journalMessageEl.hidden = false;
  state.journalMessageEl.textContent = message;
  state.journalMessageEl.classList.remove(
    'journal-message--success',
    'journal-message--warning',
    'journal-message--error'
  );
  const className =
    type === 'error'
      ? 'journal-message--error'
      : type === 'warning'
      ? 'journal-message--warning'
      : 'journal-message--success';
  state.journalMessageEl.classList.add(className);
}

function resetJournalSaveButton() {
  if (state.journalController && typeof state.journalController.resetSaveButton === 'function') {
    if (state.journalSavedTimer) {
      clearTimeout(state.journalSavedTimer);
      state.journalSavedTimer = null;
    }
    state.journalController.resetSaveButton();
    state.journalSaveButton = state.journalController.saveButton;
    return;
  }
  if (!state.journalSaveButton) {
    return;
  }
  if (state.journalSavedTimer) {
    clearTimeout(state.journalSavedTimer);
    state.journalSavedTimer = null;
  }
  const label = state.journalSaveLabel || state.journalSaveButton.dataset.defaultLabel || state.journalSaveButton.textContent || 'Save entry';
  state.journalSaveButton.textContent = label;
  state.journalSaveButton.disabled = false;
  state.journalSaveButton.removeAttribute('aria-disabled');
}

function showJournalSavedFeedback() {
  if (state.journalController && typeof state.journalController.markSaved === 'function') {
    state.journalController.markSaved('Saved ✓', 1500);
    state.journalSaveButton = state.journalController.saveButton;
    return;
  }
  if (!state.journalSaveButton) {
    return;
  }
  resetJournalSaveButton();
  state.journalSaveButton.textContent = 'Saved ✓';
  state.journalSaveButton.disabled = true;
  state.journalSaveButton.setAttribute('aria-disabled', 'true');
  state.journalSavedTimer = setTimeout(() => {
    resetJournalSaveButton();
  }, 1500);
}

function handleJournalFormSubmit(event) {
  event.preventDefault();
  if (!state.journalForm) {
    return;
  }
  const store = ensureJournalStore();
  if (!store) {
    showJournalStatus('Unable to save right now. Try reloading the page.');
    return;
  }
  const formData = collectJournalFormData();
  const intensityProvided =
    Number.isFinite(formData.intensity) && (state.journalEditingId || formData.intensity !== 5);
  const hasContent =
    formData.notes ||
    formData.emotion ||
    (Array.isArray(formData.tags) && formData.tags.length) ||
    (Array.isArray(formData.needs) && formData.needs.length) ||
    intensityProvided;
  if (!hasContent) {
    showJournalStatus('Add a few words, an emotion, a tag, a need, or adjust the intensity before saving.');
    return;
  }

  let savedEntry;
  if (state.journalEditingId) {
    const base = state.journalEditingEntry || store.get(state.journalEditingId) || {};
    savedEntry = store.update(state.journalEditingId, {
      emotion: formData.emotion,
      intensity: formData.intensity,
      needs: formData.needs,
      tags: formData.tags,
      notes: formData.notes,
      dateISO: base.dateISO,
      source: base.source || 'journal',
    });
    if (!savedEntry) {
      showJournalStatus('This entry was not found. It may have been deleted.');
      return;
    }
    state.journalEditingEntry = savedEntry;
    fillJournalForm(savedEntry);
    showJournalStatus('Updated entry.');
    setJournalEditState(savedEntry.id);
  } else {
    const entry = createJournalEntry({
      emotion: formData.emotion,
      intensity: formData.intensity,
      needs: formData.needs,
      tags: formData.tags,
      notes: formData.notes,
    });
    savedEntry = store.create(entry);
    showJournalStatus('Saved entry. It stays on this device until you export it.');
    resetJournalForm({ keepStatus: true });
    setJournalEditState('');
  }

  state.journalStore = store;
  updateJournalEntriesFromStore();
  renderJournalViews();
  state.journalStore.clearDraft(state.journalDraftPath);
  showJournalMessage('');
  showJournalSavedFeedback();
  if (savedEntry) {
    focusJournalHistoryCard(savedEntry.id);
  }
}

function handleJournalFormClear() {
  resetJournalForm();
}

function handleJournalHistoryClick(event) {
  const editButton = event.target.closest('[data-journal-action="edit"]');
  if (editButton) {
    const journalId = editButton.dataset.journalId;
    if (journalId) {
      startJournalEdit(journalId, { focusHistory: false });
      saveJournalDraft();
    }
    return;
  }
  const deleteButton = event.target.closest('[data-journal-action="delete"]');
  if (!deleteButton) {
    return;
  }
  const journalId = deleteButton.dataset.journalId;
  if (!journalId) {
    return;
  }
  const confirmed = window.confirm('Delete this journal entry? This cannot be undone.');
  if (!confirmed) {
    return;
  }
  const store = ensureJournalStore();
  if (!store) {
    showJournalStatus('Unable to delete entry right now.');
    return;
  }
  store.remove(journalId);
  updateJournalEntriesFromStore();
  renderJournalViews();
  showJournalStatus('Entry deleted.');
  if (state.journalStore && state.journalDraftPath) {
    state.journalStore.clearDraft(state.journalDraftPath);
  }
}

function handleJournalFiltersChange() {
  if (!state.journalFiltersForm) {
    return;
  }
  const formData = new FormData(state.journalFiltersForm);
  state.journalFilters = {
    search: (formData.get('search') || '').toString().trim(),
    tag: (formData.get('tag') || '').toString().trim(),
    sort: (formData.get('sort') || 'newest').toString(),
    range: (formData.get('range') || 'all').toString(),
  };
  renderJournalHistory();
}

function handleJournalFiltersReset() {
  if (!state.journalFiltersForm) {
    return;
  }
  state.journalFiltersForm.reset();
  state.journalFilters = { search: '', tag: '', sort: 'newest', range: 'all' };
  renderJournalHistory();
}

function capitalizeWord(value) {
  if (!value) {
    return '';
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}


function setInventoryView(nextView, { focus = false } = {}) {
  const normalized = nextView === 'strategies' ? 'strategies' : 'needs';
  state.inventoryView = normalized;
  state.showStrategies = normalized === 'strategies';
  updateStrategiesVisibility();
  updateInventoryViewControls();
  if (normalized === 'strategies') renderInventoryList();
  if (focus) {
    const target = normalized === 'strategies' ? state.strategySearchInput : state.needsViewPanel;
    requestAnimationFrame(() => target?.focus?.());
  }
}

function updateInventoryViewControls() {
  state.inventoryViewButtons.forEach((button) => {
    const active = (button.dataset.inventoryView || 'needs') === state.inventoryView;
    button.setAttribute('aria-selected', active ? 'true' : 'false');
    button.classList.toggle('is-active', active);
    button.tabIndex = active ? 0 : -1;
  });
}

function openInventoryFormForNeed(needSlug = '') {
  const form = state.inventoryForm || document.getElementById('inventory-form');
  if (!form) return;
  setInventoryFormMode({ entry: null });
  if (state.inventoryFormShell instanceof HTMLDetailsElement) state.inventoryFormShell.open = true;
  const normalized = normalizeNeedSlugValue(needSlug);
  const select = form.querySelector('#inventory-need');
  if (select instanceof HTMLSelectElement) {
    Array.from(select.options).forEach((option) => {
      option.selected = Boolean(normalized) && normalizeNeedSlugValue(option.value) === normalized;
    });
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  requestAnimationFrame(() => {
    state.inventoryFormShell?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    form.querySelector('#inventory-title')?.focus?.({ preventScroll: true });
  });
}

function renderNeedInventoryDetail(need, entries) {
  const detail = document.createElement('div');
  detail.className = 'inventory-summary__detail';
  detail.id = `inventory-need-detail-${need.slug}`;

  const header = document.createElement('div');
  header.className = 'inventory-summary__detail-header';
  const title = document.createElement('span');
  title.className = 'inventory-summary__detail-title';
  title.textContent = entries.length ? 'Saved strategies' : 'No saved strategies yet';
  const about = document.createElement('a');
  about.className = 'inventory-summary__about-link';
  about.href = `${state.basePath}needs/${need.slug}/`;
  about.textContent = 'About this need →';
  header.append(title, about);
  detail.append(header);

  if (entries.length) {
    const list = document.createElement('div');
    list.className = 'inventory-summary__strategy-list';
    entries.forEach((entry) => list.append(renderInventoryItem(entry, { compact: true, showNeeds: false })));
    detail.append(list);
  } else {
    const empty = document.createElement('p');
    empty.className = 'inventory-empty';
    empty.textContent = 'Add something that helps you care for this need.';
    detail.append(empty);
  }

  const actions = document.createElement('div');
  actions.className = 'inventory-summary__detail-actions';
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'inventory-summary__add-button';
  add.dataset.addStrategyForNeed = need.slug;
  add.textContent = '+ Add strategy';
  actions.append(add);
  detail.append(actions);
  return detail;
}

function renderInventorySummary() {
  if (!state.inventorySummaryEl || !state.needs.length) return;

  const counts = new Map();
  const entriesByNeed = new Map();
  state.needs.forEach((need) => {
    counts.set(need.slug, 0);
    entriesByNeed.set(need.slug, []);
  });

  state.inventory.forEach((entry) => {
    const uniqueSlugs = new Set(resolveEntryNeedSlugs(entry));
    uniqueSlugs.forEach((slug) => {
      if (!counts.has(slug)) return;
      counts.set(slug, counts.get(slug) + 1);
      entriesByNeed.get(slug).push(entry);
    });
  });

  const supported = Array.from(counts.values()).filter((count) => count > 0).length;
  const missing = Math.max(state.needs.length - supported, 0);
  if (state.needsStatusEl) {
    state.needsStatusEl.textContent = `${supported} supported · ${missing} without strategies`;
  }

  state.inventorySummaryEl.innerHTML = '';
  state.needs.forEach((need) => {
    const count = counts.get(need.slug) || 0;
    const expanded = state.expandedNeedSlug === need.slug;
    const wrapper = document.createElement('div');
    wrapper.className = `inventory-summary__item ${count ? 'inventory-summary__item--ready' : 'inventory-summary__item--missing'}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inventory-summary__focus';
    button.dataset.needSlug = need.slug;
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.setAttribute('aria-controls', `inventory-need-detail-${need.slug}`);
    const savedLabel = count
      ? String(count) + ' saved ' + (count === 1 ? 'strategy' : 'strategies')
      : 'no saved strategies';
    button.setAttribute(
      'aria-label',
      need.title + ', ' + savedLabel + '. ' + (expanded ? 'Hide' : 'Show') + ' details.'
    );

    const status = document.createElement('span');
    status.className = 'inventory-summary__status';
    status.setAttribute('aria-hidden', 'true');

    const textWrap = document.createElement('span');
    textWrap.className = 'inventory-summary__text';
    const label = document.createElement('span');
    label.className = 'inventory-summary__label';
    const longestNeedWord = need.title
      .trim()
      .split(/\s+/)
      .reduce((longest, word) => Math.max(longest, word.length), 0);
    if (longestNeedWord >= 13) {
      label.classList.add('inventory-summary__label--compact');
    }
    label.textContent = need.title;
    const countText = document.createElement('span');
    countText.className = 'inventory-summary__count';
    countText.textContent = count ? `${count} ${count === 1 ? 'strategy' : 'strategies'}` : 'No strategies';
    textWrap.append(label, countText);

    const chevron = document.createElement('span');
    chevron.className = 'inventory-summary__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '›';
    button.append(status, textWrap, chevron);
    wrapper.append(button);

    const detail = renderNeedInventoryDetail(need, entriesByNeed.get(need.slug) || []);
    detail.hidden = !expanded;
    wrapper.append(detail);
    state.inventorySummaryEl.append(wrapper);
  });
}
function handleJumpToStrategies(event) {
  if (event) event.preventDefault();
  jumpToSavedStrategies();
}
function jumpToSavedStrategies() {
  setInventoryView('strategies');
  requestAnimationFrame(() => {
    const overview = document.querySelector('.inventory-overview');
    overview?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    state.strategySearchInput?.focus?.({ preventScroll: true });
  });
}
function setSummaryFilter(nextFilter) {
  const normalized = SUMMARY_FILTERS.has(nextFilter) ? nextFilter : 'all';
  if (state.summaryFilter === normalized) {
    applySummaryFilter();
    renderInventoryList();
    return;
  }
  state.summaryFilter = normalized;
  applySummaryFilter();
  renderInventoryList();
}

function updateSummaryFilterButtons() {
  state.summaryFilterButtons.forEach((button) => {
    const value = button.dataset.summaryFilter || 'all';
    const isActive = value === state.summaryFilter;
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.classList.toggle('inventory-summary__filter-button--active', isActive);
  });
}

function applySummaryFilter() {
  if (!state.inventorySummaryEl) {
    return;
  }

  const filter = state.summaryFilter;
  const hideAll = filter === 'none';

  if (hideAll) {
    state.inventorySummaryEl.hidden = true;
    state.inventorySummaryEl.setAttribute('aria-hidden', 'true');
    updateSummaryFilterButtons();
    return;
  }

  state.inventorySummaryEl.hidden = false;
  state.inventorySummaryEl.removeAttribute('aria-hidden');

  const items = state.inventorySummaryEl.querySelectorAll('.inventory-summary__item');
  items.forEach((item) => {
    let shouldHide = false;
    if (filter === 'missing') {
      shouldHide = !item.classList.contains('inventory-summary__item--missing');
    } else if (filter === 'ready') {
      shouldHide = !item.classList.contains('inventory-summary__item--ready');
    }
    item.hidden = shouldHide;
  });

  updateSummaryFilterButtons();
}

function renderInventoryList() {
  if (!state.inventoryListEl) return;
  state.inventoryListEl.innerHTML = '';

  const query = (state.strategySearch || '').trim().toLowerCase();
  const filtered = state.inventory.filter((entry) => {
    if (!query) return true;
    const needs = resolveEntryNeedSlugs(entry)
      .map((slug) => state.needsBySlug.get(slug)?.title || slug)
      .join(' ');
    const haystack = [entry.title, entry.description, entry.need, needs]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  if (state.strategyCountEl) {
    state.strategyCountEl.textContent = query
      ? `${filtered.length} of ${state.inventory.length}`
      : `${state.inventory.length} saved`;
  }
  if (state.strategyBadgeEl) {
    state.strategyBadgeEl.textContent = String(state.inventory.length);
    state.strategyBadgeEl.hidden = state.inventory.length === 0;
  }

  if (!state.inventory.length) {
    const emptyNotice = document.createElement('p');
    emptyNotice.className = 'inventory-empty';
    emptyNotice.textContent = 'No saved strategies yet. Add one from a need or create your own.';
    state.inventoryListEl.append(emptyNotice);
    return;
  }

  if (!filtered.length) {
    const emptyNotice = document.createElement('p');
    emptyNotice.className = 'inventory-empty';
    emptyNotice.textContent = 'No saved strategies match this search.';
    state.inventoryListEl.append(emptyNotice);
    return;
  }

  filtered.forEach((entry) => state.inventoryListEl.append(renderInventoryItem(entry)));
}
function setShowStrategies(visible) {
  setInventoryView(visible ? 'strategies' : 'needs');
}
function updateStrategiesVisibility() {
  const showingStrategies = state.inventoryView === 'strategies';
  state.showStrategies = showingStrategies;
  if (state.needsViewPanel) state.needsViewPanel.hidden = showingStrategies;
  if (state.strategiesViewPanel) state.strategiesViewPanel.hidden = !showingStrategies;
  if (state.strategiesContainerEl) {
    state.strategiesContainerEl.hidden = !showingStrategies;
    state.strategiesContainerEl.classList.toggle('inventory-list-panel--hidden', !showingStrategies);
    state.strategiesContainerEl.setAttribute('aria-hidden', showingStrategies ? 'false' : 'true');
  }
  updateInventoryViewControls();
}
function openInventoryPanel() {
  setInventoryView('strategies');
}
function closeInventoryPanel() {
  setInventoryView('needs');
}
function updateInventoryToggleLabel() {
  updateInventoryViewControls();
  if (state.jumpToStrategiesButton) {
    state.jumpToStrategiesButton.setAttribute('aria-expanded', state.inventoryView === 'strategies' ? 'true' : 'false');
  }
}
function renderInventoryItem(entry, options = {}) {
  const compact = options.compact === true;
  const showNeeds = options.showNeeds !== false;
  const card = document.createElement('article');
  card.className = compact ? 'inventory-item inventory-item--compact' : 'inventory-item';
  card.dataset.id = entry.id;

  const header = document.createElement('div');
  header.className = 'inventory-item__header';
  const title = document.createElement('h3');
  title.className = 'inventory-item__title';
  title.textContent = entry.title;
  header.append(title);

  if (entry.personal) {
    const badge = document.createElement('span');
    badge.className = 'inventory-item__tag';
    badge.textContent = 'Personal';
    header.append(badge);
  }
  if (entry.sourceNeedPage) {
    const badge = document.createElement('span');
    badge.className = 'inventory-item__tag inventory-item__tag--source';
    badge.textContent = 'Saved from site';
    header.append(badge);
  }
  card.append(header);

  if (entry.description) {
    const description = document.createElement('p');
    description.className = 'inventory-item__description';
    description.textContent = entry.description;
    card.append(description);
  }

  const contributorSource = entry.contributor && typeof entry.contributor === 'object' ? entry.contributor : {};
  const metaParts = [
    sanitizeContributorName(contributorSource.name || entry.firstName || ''),
    sanitizeLocation(contributorSource.location || entry.location || ''),
  ].filter(Boolean);
  if (metaParts.length) {
    const meta = document.createElement('p');
    meta.className = 'inventory-item__meta';
    meta.textContent = metaParts.join(' • ');
    card.append(meta);
  }

  if (showNeeds) {
    const needTitles = [];
    const seen = new Set();
    resolveEntryNeedSlugs(entry).forEach((slug) => {
      const normalized = normalizeNeedSlugValue(slug);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      needTitles.push(state.needsBySlug.get(normalized)?.title || normalized);
    });
    if (!needTitles.length && entry.need) needTitles.push(entry.need.toString().trim());
    if (needTitles.length) {
      const details = document.createElement('details');
      details.className = 'inventory-item__needs';
      const summary = document.createElement('summary');
      summary.className = 'inventory-item__needs-summary';
      summary.textContent = `Needs (${needTitles.length})`;
      const tags = document.createElement('ul');
      tags.className = 'inventory-item__tags';
      needTitles.forEach((needTitle) => {
        const li = document.createElement('li');
        li.className = 'inventory-item__tag-pill';
        li.textContent = needTitle;
        tags.append(li);
      });
      details.append(summary, tags);
      card.append(details);
    }
  }

  const actions = document.createElement('div');
  actions.className = 'inventory-item__actions';
  if (entry.personal) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'inventory-item__edit';
    edit.dataset.action = 'edit';
    edit.dataset.id = entry.id;
    edit.textContent = 'Edit';
    actions.append(edit);
  }
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'inventory-item__delete';
  remove.dataset.action = 'delete';
  remove.dataset.id = entry.id;
  remove.textContent = 'Delete';
  actions.append(remove);
  card.append(actions);
  return card;
}
function setInventoryFormMode({ entry }) {
  if (!state.inventoryForm || !state.inventorySubmitButton) {
    return;
  }

  if (!entry) {
    state.inventoryEditingId = null;
    state.inventorySubmitButton.textContent = '💾 Save to device';
    state.inventoryForm.removeAttribute('data-editing');
    return;
  }

  state.inventoryEditingId = entry.id;
  state.inventoryForm.setAttribute('data-editing', 'true');
  state.inventorySubmitButton.textContent = '💾 Save changes to device';

  const titleInput = state.inventoryForm.querySelector('#inventory-title');
  const descriptionInput = state.inventoryForm.querySelector('#inventory-description');
  const needSelect = state.inventoryForm.querySelector('#inventory-need');
  const nameInput = state.inventoryForm.querySelector('#inventory-name');
  const locationInput = state.inventoryForm.querySelector('#inventory-location');
  const visibilitySelect = state.inventoryForm.querySelector('#inventory-visibility');

  if (titleInput) titleInput.value = entry.title || '';
  if (descriptionInput) descriptionInput.value = entry.description || '';
  if (nameInput) {
    nameInput.value = entry.contributor?.name || entry.firstName || '';
  }
  if (locationInput) {
    locationInput.value = entry.contributor?.location || entry.location || '';
  }
  if (visibilitySelect) {
    visibilitySelect.value = normalizeVisibilityValue(entry.visibility) || 'private';
  }

  if (needSelect) {
    let resolvedNeeds = resolveEntryNeedSlugs(entry);
    if (!resolvedNeeds.length && entry.need) {
      const fallbackNeed = entry.need.toString().trim();
      if (fallbackNeed) {
        const match = Array.from(state.needsBySlug.entries()).find(
          ([, value]) => value?.title?.toLowerCase() === fallbackNeed.toLowerCase()
        );
        if (match) {
          resolvedNeeds = [match[0]];
        }
      }
    }
    const selectedNeeds = new Set(resolvedNeeds);
    Array.from(needSelect.options).forEach((option) => {
      option.selected = selectedNeeds.has(option.value);
    });
    needSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  state.inventoryForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (titleInput) {
    titleInput.focus();
  }
}

function pickNeedSlug(entry) {
  const slugs = resolveEntryNeedSlugs(entry);
  return slugs[0] || '';
}

function backfillInventoryNeedSlugs() {
  if (!state.inventory.length || !state.needsBySlug.size) {
    return false;
  }

  let updated = false;

  const nextInventory = state.inventory.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return entry;
    }

    const normalized = { ...entry };
    const cleanedTags = normalizeTagsList(normalized.tags);
    if (!Array.isArray(normalized.tags) || normalized.tags.length !== cleanedTags.length) {
      updated = true;
    } else {
      for (let i = 0; i < cleanedTags.length; i += 1) {
        if (normalized.tags[i] !== cleanedTags[i]) {
          updated = true;
          break;
        }
      }
    }
    normalized.tags = cleanedTags;

    const existingNeedSlugs = normalizeNeedSlugList(normalized.needSlugs);

    let slug = normalizeNeedSlugValue(normalized.needSlug || normalized.sourceNeedPage);
    if (slug && !state.needsBySlug.has(slug)) {
      slug = '';
    }

    const tagSlugs = normalized.tags.map((tag) => normalizeNeedSlugValue(tag)).filter(Boolean);
    const combinedSlugs = normalizeNeedSlugList([existingNeedSlugs, slug, tagSlugs]);

    let validSlugs = combinedSlugs.filter((candidate) => isValidNeedSlug(candidate));

    if (!validSlugs.length) {
      const fallbackFromTitle = findNeedSlugByTitle(normalized.need);
      if (fallbackFromTitle) {
        validSlugs = [fallbackFromTitle];
      } else {
        const normalizedFallback = normalizeNeedSlugValue(slug);
        if (normalizedFallback) {
          validSlugs = [normalizedFallback];
        }
      }
    }

    if (validSlugs.length) {
      if (normalized.needSlug !== validSlugs[0]) {
        normalized.needSlug = validSlugs[0];
        updated = true;
      }
      const needInfo = state.needsBySlug.get(validSlugs[0]);
      if (needInfo?.title && normalized.need !== needInfo.title) {
        normalized.need = needInfo.title;
        updated = true;
      }
      validSlugs.forEach((needSlug) => {
        const hasTag = normalized.tags.some((tag) => normalizeNeedSlugValue(tag) === needSlug);
        if (!hasTag) {
          normalized.tags = [...normalized.tags, needSlug];
          updated = true;
        }
      });
    }

    const normalizedNeedSlugs = validSlugs;
    const originalNeedSlugs = normalizeNeedSlugList(normalized.needSlugs);
    if (
      normalizedNeedSlugs.length !== originalNeedSlugs.length ||
      normalizedNeedSlugs.some((value, index) => value !== originalNeedSlugs[index])
    ) {
      normalized.needSlugs = normalizedNeedSlugs;
      updated = true;
    }

    return normalized;
  });

  if (updated) {
    state.inventory = nextInventory;
    saveInventory(nextInventory);
    refreshSavedStrategyIndex();
    updateStrategySaveButtonStates();
  }

  return updated;
}

function persistInventory(items, options = {}) {
  state.inventory = items;
  refreshSavedStrategyIndex();
  saveInventory(items);
  renderInventoryViews();
  updateStrategySaveButtonStates();
  if (options.openList) {
    openInventoryPanel();
  }
  if (options.inventoryMessage && state.inventoryMessageEl) {
    showInventoryMessage(options.inventoryMessage, options.inventoryMessageType || 'success');
  }
  if (options.feedbackElement && options.feedbackMessage) {
    showFeedback(
      options.feedbackElement,
      options.feedbackMessage,
      options.feedbackMessageType || 'success'
    );
  }
}

function updateInventoryCount() {
  const counter = document.querySelector('[data-inventory-count]');
  if (!counter) {
    return;
  }
  const total = state.inventory.length;
  if (!total) {
    counter.textContent = '';
    counter.hidden = true;
  } else {
    counter.textContent = String(total);
    counter.hidden = false;
  }
}

function showInventoryMessage(message, type) {
  if (!state.inventoryMessageEl) {
    return;
  }
  state.inventoryMessageEl.textContent = '';
  state.inventoryMessageEl.hidden = false;
  state.inventoryMessageEl.classList.remove(
    'inventory-message--error',
    'inventory-message--success',
    'inventory-message--warning'
  );
  const className =
    type === 'error'
      ? 'inventory-message--error'
      : type === 'warning'
      ? 'inventory-message--warning'
      : 'inventory-message--success';
  state.inventoryMessageEl.classList.add(className);
  if (typeof message === 'string') {
    state.inventoryMessageEl.textContent = message;
    return;
  }
  if (typeof Node !== 'undefined' && message instanceof Node) {
    state.inventoryMessageEl.appendChild(message);
    return;
  }
  state.inventoryMessageEl.textContent = String(message);
}

function showFeedback(element, message, type = 'success') {
  if (!element) {
    return;
  }
  element.textContent = message;
  element.hidden = false;
  element.classList.remove('inventory-feedback--error', 'inventory-feedback--warning', 'inventory-feedback--success');
  const className =
    type === 'error'
      ? 'inventory-feedback--error'
      : type === 'warning'
      ? 'inventory-feedback--warning'
      : 'inventory-feedback--success';
  element.classList.add(className);
}

function showFormMessage(element, message, type = 'success') {
  if (!element) {
    return;
  }
  element.textContent = message;
  element.hidden = false;
  element.classList.remove('success', 'error', 'warning');
  const className =
    type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success';
  element.classList.add(className);
}

function broadcastDataMessage(message, type = 'success') {
  if (typeof message !== 'string' || !message) {
    return;
  }
  showInventoryMessage(message, type);
  showJournalMessage(message, type);
}

function captureLocalStorageSnapshot() {
  const snapshot = {};
  if (typeof window === 'undefined') {
    return snapshot;
  }
  try {
    const storage = window.localStorage;
    if (!storage) {
      return snapshot;
    }
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) {
        continue;
      }
      const value = storage.getItem(key);
      if (typeof value === 'string') {
        snapshot[key] = value;
      }
    }
  } catch (error) {
    console.warn('Unable to capture localStorage snapshot', error);
  }
  return snapshot;
}

function deepClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return null;
  }
}

function parseJsonSafe(text) {
  if (typeof text !== 'string') {
    return null;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return null;
  }
}

function buildLocalDataBackup() {
  const snapshot = captureLocalStorageSnapshot();

  const inventorySource = Array.isArray(state.inventory) && state.inventory.length ? state.inventory : loadInventory();
  const inventory = deepClone(inventorySource) || [];

  let journalEntries = [];
  try {
    const store = ensureJournalStore();
    if (store && typeof store.list === 'function') {
      const list = store.list();
      const cloned = deepClone(list);
      if (Array.isArray(cloned)) {
        journalEntries = cloned;
      }
    }
  } catch (error) {
    console.warn('Unable to read journal entries for backup', error);
  }
  if (!Array.isArray(journalEntries) || !journalEntries.length) {
    const rawJournal = snapshot['journal:v2'];
    const parsedJournal = parseJsonSafe(rawJournal);
    if (Array.isArray(parsedJournal)) {
      journalEntries = parsedJournal;
    } else {
      journalEntries = [];
    }
  }

  const theme = parseJsonSafe(snapshot[THEME_STORAGE_KEY]);
  const navSettings = parseJsonSafe(snapshot[NAV_SETTINGS_STORAGE_KEY]);
  const magnetPositions = {};
  Object.keys(snapshot).forEach((key) => {
    if (key.startsWith('magnetPositions:')) {
      magnetPositions[key] = snapshot[key];
    }
  });

  const customizer = {};
  if (theme && typeof theme === 'object') {
    customizer.theme = theme;
  }
  if (navSettings && typeof navSettings === 'object') {
    customizer.navSettings = navSettings;
  }
  if (Object.keys(magnetPositions).length) {
    customizer.magnetPositions = magnetPositions;
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    inventory,
    journalEntries,
    customizer,
    localStorage: snapshot,
  };
}

function downloadLocalDataBackup(payload) {
  const serialized = JSON.stringify(payload, null, 2);
  const blob = new Blob([serialized], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:]/g, '-');
  link.href = url;
  link.download = `nvc-localstorage-backup-${timestamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildPersonalStrategiesExportPayload() {
  const inventorySource =
    Array.isArray(state.inventory) && state.inventory.length ? state.inventory : loadInventory();
  const list = Array.isArray(inventorySource)
    ? inventorySource.filter((item) => item && item.personal)
    : [];
  const strategies = deepClone(list) || [];
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    personalStrategies: strategies,
  };
}

function downloadPersonalStrategiesExport(payload) {
  const serialized = JSON.stringify(payload, null, 2);
  const blob = new Blob([serialized], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:]/g, '-');
  link.href = url;
  link.download = `allneeds-personal-strategies-${timestamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openPersonalStrategiesEmailDraft() {
  if (typeof window === 'undefined') {
    return;
  }
  const email = PERSONAL_STRATEGIES_EMAIL_ADDRESS;
  if (!email) {
    return;
  }
  const subject = encodeURIComponent(PERSONAL_STRATEGIES_EMAIL_SUBJECT);
  const body = encodeURIComponent(PERSONAL_STRATEGIES_EMAIL_BODY);
  const mailtoLink = `mailto:${email}?subject=${subject}&body=${body}`;
  try {
    const opened = window.open(mailtoLink, '_blank');
    if (!opened) {
      window.location.href = mailtoLink;
    }
  } catch (error) {
    window.location.href = mailtoLink;
  }
}

function getCurrentDid() {
  const session = typeof window !== 'undefined' ? window.allneedsSession : null;
  if (session && typeof session === 'object' && session.did) {
    return session.did;
  }
  return null;
}

function updateVisibilityControls() {
  if (typeof document === 'undefined') {
    return;
  }
  const signedIn = Boolean(getCurrentDid());
  const selects = Array.from(document.querySelectorAll('select[name="strategy-visibility"]'));
  if (!selects.length) {
    return;
  }
  const baseHint = 'Choose who can see this strategy when you export or share it.';
  const signedOutHint =
    'Sign in with Bluesky to enable Followers/Public. While signed out, strategies stay only on this browser.';
  const signedInHint =
    'You can keep Followers/Public strategies local, or choose to share them when you save.';

  selects.forEach((select) => {
    const field = select.closest('.strategy-form__field');
    const hint = field?.querySelector('.strategy-form__hint');
    const publicOption = select.querySelector('option[value="public"]');
    const followersOption = select.querySelector('option[value="followers"]');

    if (publicOption) {
      publicOption.disabled = !signedIn;
    }
    if (followersOption) {
      followersOption.disabled = !signedIn;
    }
    if (!signedIn && (select.value === 'public' || select.value === 'followers')) {
      select.value = 'private';
    }

    if (hint) {
      hint.textContent = `${baseHint} ${signedIn ? signedInHint : signedOutHint}`;
    }
  });
}

function buildExportSnapshot() {
  return buildLocalDataBackup();
}

function buildBackendStrategySyncPayload(snapshot) {
  const inventory = Array.isArray(snapshot?.inventory) ? snapshot.inventory : [];
  const sharedEntries = inventory
    .map((entry) => {
      const visibility = normalizeVisibilityValue(entry?.visibility);
      if (visibility !== 'public' && visibility !== 'followers') {
        return null;
      }
      const title = entry?.title ? String(entry.title).trim() : '';
      if (!title) {
        return null;
      }
      return {
        title,
        body: entry?.description ? String(entry.description) : '',
        needIds: resolveEntryNeedSlugs(entry),
        visibility,
      };
    })
    .filter(Boolean);
  return sharedEntries;
}

async function applyImportSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    broadcastDataMessage('Import failed. No snapshot found to apply.', 'error');
    return;
  }
  await importLocalStorageSnapshot(snapshot);
}

function getBackendSyncStatusEl() {
  return document.querySelector('[data-backend-sync-status]');
}

function setBackendStatusMessage(message) {
  const statusEl = getBackendSyncStatusEl();
  if (!statusEl) {
    return;
  }
  statusEl.textContent = message || '';
  if (message) {
    statusEl.classList.remove('inventory-backend-sync__status--highlight');
    void statusEl.offsetWidth;
    statusEl.classList.add('inventory-backend-sync__status--highlight');
  }
}

function formatBackendStatusTimestamp(date = new Date()) {
  try {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch (error) {
    return date.toLocaleTimeString();
  }
}

async function publishStrategyToBackend(entry) {
  const did = getCurrentDid();
  if (!did) {
    return;
  }

  const visibility = normalizeVisibilityValue(entry?.visibility);
  if (visibility !== 'public' && visibility !== 'followers') {
    return;
  }

  const title = entry?.title ? String(entry.title).trim() : '';
  if (!title) {
    return;
  }

  const needIds = resolveEntryNeedSlugs(entry);
  const payload = {
    title,
    body: entry?.description ? String(entry.description) : '',
    needIds,
    visibility,
  };

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/strategies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.status !== 'ok') {
      throw new Error(data && data.message ? data.message : 'Unable to publish strategy');
    }
  } catch (error) {
    console.warn('Unable to publish strategy to backend', error);
  }
}

async function saveSnapshotToBackend() {
  const did = getCurrentDid();

  if (!did) {
    setBackendStatusMessage('Link a Bluesky account before saving to the backend.');
    return;
  }

  let snapshot;
  try {
    snapshot = buildExportSnapshot();
  } catch (error) {
    console.error('Failed to build snapshot', error);
    setBackendStatusMessage('Could not build export snapshot.');
    return;
  }

  let value;
  try {
    value = JSON.stringify(snapshot);
  } catch (error) {
    console.error('Failed to stringify snapshot', error);
    setBackendStatusMessage('Could not serialize export snapshot.');
    return;
  }

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/user-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: BACKEND_SNAPSHOT_KEY, value }),
    });
    const data = await res.json();
    if (!res.ok || !data || data.status !== 'ok') {
      throw new Error(data && data.message ? data.message : 'Unknown error');
    }
    let syncMessage = '';
    try {
      const strategies = buildBackendStrategySyncPayload(snapshot);
      const syncRes = await fetch(`${BACKEND_BASE_URL}/strategies/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ strategies }),
      });
      const syncData = await syncRes.json().catch(() => null);
      if (!syncRes.ok || !syncData || syncData.status !== 'ok') {
        throw new Error(syncData && syncData.message ? syncData.message : 'Unknown error');
      }
      syncMessage = ' Shared strategies synced.';
    } catch (error) {
      console.error('Failed to sync shared strategies', error);
      syncMessage = ' Shared strategies could not be synced.';
    }
    const timestamp = formatBackendStatusTimestamp();
    setBackendStatusMessage(`Snapshot saved to backend at ${timestamp}.${syncMessage}`);
  } catch (error) {
    console.error('Failed to save snapshot to backend', error);
    setBackendStatusMessage('Error saving snapshot to backend.');
  }
}

async function loadSnapshotFromBackend() {
  const did = getCurrentDid();

  if (!did) {
    setBackendStatusMessage('Link a Bluesky account before loading from backend.');
    return;
  }

  setBackendStatusMessage('Loading journal history from backend...');

  try {
    const res = await fetch(`${BACKEND_BASE_URL}/user-settings`, {
      credentials: 'include',
    });
    const data = await res.json();

    if (!res.ok || !data || data.status !== 'ok') {
      throw new Error(data && data.message ? data.message : 'Unknown error');
    }

    const setting = Array.isArray(data.settings)
      ? data.settings.find((entry) => entry && entry.key === BACKEND_SNAPSHOT_KEY)
      : null;

    if (!setting || typeof setting.value !== 'string') {
      setBackendStatusMessage('No backend snapshot found for this DID.');
      return;
    }

    let snapshot;
    try {
      snapshot = JSON.parse(setting.value);
    } catch (error) {
      console.error('Failed to parse backend snapshot JSON', error);
      setBackendStatusMessage('Backend snapshot is not valid JSON.');
      return;
    }

    await applyImportSnapshot(snapshot);
    setBackendStatusMessage('Backend snapshot loaded into this browser.');
  } catch (error) {
    console.error('Failed to load snapshot from backend', error);
    setBackendStatusMessage('Error loading snapshot from backend.');
  }
}

function updateBackendSyncButtons() {
  const did = getCurrentDid();
  const saveBtn = document.querySelector('[data-backend-save-button]');
  const loadBtn = document.querySelector('[data-backend-load-button]');

  const disabled = !did;
  [saveBtn, loadBtn].forEach((btn) => {
    if (!btn) return;
    if (disabled) {
      btn.setAttribute('aria-disabled', 'true');
      btn.dataset.backendDisabled = 'true';
      btn.classList.add('inventory-button--disabled');
    } else {
      btn.removeAttribute('aria-disabled');
      delete btn.dataset.backendDisabled;
      btn.classList.remove('inventory-button--disabled');
    }
  });

  if (disabled) {
    setBackendStatusMessage('Link a Bluesky account to enable backend save/load.');
  } else {
    setBackendStatusMessage('');
  }
}

function exportLocalData() {
  try {
    const payload = buildLocalDataBackup();
    downloadLocalDataBackup(payload);
    const inventoryCount = Array.isArray(payload.inventory) ? payload.inventory.length : 0;
    const journalCount = Array.isArray(payload.journalEntries) ? payload.journalEntries.length : 0;
    broadcastDataMessage(
      `Exported localStorage backup (${inventoryCount} strategies, ${journalCount} journal entries, plus customizer settings).`,
      'success'
    );
  } catch (error) {
    console.warn('Unable to export localStorage backup', error);
    broadcastDataMessage('Export failed. Unable to serialize localStorage.', 'error');
  }
}

async function importLocalData(file) {
  if (!file) {
    return;
  }
  let text = '';
  try {
    text = await file.text();
  } catch (error) {
    console.warn('Unable to read import file', error);
    broadcastDataMessage('Import failed. Unable to read that file.', 'error');
    return;
  }

  const detection = detectBackupFormat(text);
  if (!detection || detection.type === 'unknown') {
    broadcastDataMessage('Import failed. Unsupported file format.', 'error');
    return;
  }
  if (detection.type === 'empty') {
    broadcastDataMessage('Import failed. The selected file was empty.', 'error');
    return;
  }
  if (detection.type === 'snapshot') {
    await importLocalStorageSnapshot(detection.payload);
    return;
  }
  if (detection.type === 'legacyInventoryCsv') {
    const imported = importInventoryCsvFromText(text);
    if (imported) {
      showJournalMessage(
        'Legacy inventory CSV imported. Export a new localStorage backup to include journal and customizer data.',
        'warning'
      );
    }
    return;
  }
  if (detection.type === 'legacyJournal') {
    const imported = await importLegacyJournalEntries(detection.entries);
    if (imported) {
      showInventoryMessage(
        'Legacy journal JSON imported. Export a new localStorage backup to include inventory and customizer data.',
        'warning'
      );
    }
  }
}

function detectBackupFormat(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return { type: 'empty' };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    parsed = null;
  }

  if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
    if (parsed.localStorage && typeof parsed.localStorage === 'object') {
      return { type: 'snapshot', payload: parsed };
    }
    if (Array.isArray(parsed.entries)) {
      return { type: 'legacyJournal', entries: parsed.entries };
    }
  }

  if (Array.isArray(parsed)) {
    return { type: 'legacyJournal', entries: parsed };
  }

  if (isLikelyInventoryCsv(trimmed)) {
    return { type: 'legacyInventoryCsv' };
  }

  return { type: 'unknown' };
}

function isLikelyInventoryCsv(text) {
  if (typeof text !== 'string') {
    return false;
  }
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  return /id\s*,\s*title\s*,\s*description/i.test(firstLine);
}

function normalizeBackupPayload(raw) {
  const payload = raw && typeof raw === 'object' ? { ...raw } : {};
  const storage = payload.localStorage && typeof payload.localStorage === 'object' ? payload.localStorage : {};
  const normalizedStorage = {};
  Object.keys(storage).forEach((key) => {
    if (typeof key !== 'string') {
      return;
    }
    const value = storage[key];
    if (typeof value === 'string') {
      normalizedStorage[key] = value;
    } else if (value == null) {
      normalizedStorage[key] = '';
    } else {
      normalizedStorage[key] = JSON.stringify(value);
    }
  });
  payload.localStorage = normalizedStorage;
  return payload;
}

function replaceLocalStorageWithSnapshot(nextSnapshot, previousSnapshot) {
  if (typeof window === 'undefined') {
    return { success: false, error: new Error('Window unavailable') };
  }
  const storage = window.localStorage;
  if (!storage) {
    return { success: false, error: new Error('localStorage unavailable') };
  }

  try {
    storage.clear();
  } catch (error) {
    return { success: false, error };
  }

  try {
    Object.entries(nextSnapshot).forEach(([key, value]) => {
      if (typeof key !== 'string') {
        return;
      }
      const normalizedValue = typeof value === 'string' ? value : value == null ? '' : String(value);
      storage.setItem(key, normalizedValue);
    });
  } catch (error) {
    if (previousSnapshot && typeof previousSnapshot === 'object') {
      try {
        storage.clear();
        Object.entries(previousSnapshot).forEach(([key, value]) => {
          if (typeof key !== 'string') {
            return;
          }
          const normalizedValue = typeof value === 'string' ? value : value == null ? '' : String(value);
          storage.setItem(key, normalizedValue);
        });
      } catch (restoreError) {
        console.warn('Unable to restore previous localStorage after failed import', restoreError);
      }
    }
    return { success: false, error };
  }

  return { success: true };
}

async function importLocalStorageSnapshot(payload) {
  const normalized = normalizeBackupPayload(payload);
  if (!normalized.localStorage || !Object.keys(normalized.localStorage).length) {
    broadcastDataMessage('Import failed. Backup did not contain localStorage data.', 'error');
    return;
  }

  const confirmed = window.confirm(
    'Replace all saved localStorage data for this app with the selected backup? This will overwrite your inventory, journal, customizer settings, and any other locally stored data.'
  );
  if (!confirmed) {
    broadcastDataMessage('Import canceled. No changes were made.', 'warning');
    return;
  }

  const previousSnapshot = captureLocalStorageSnapshot();
  const replaceResult = replaceLocalStorageWithSnapshot(normalized.localStorage, previousSnapshot);
  if (!replaceResult.success) {
    console.warn('Unable to apply localStorage backup', replaceResult.error);
    broadcastDataMessage('Import failed. Unable to write to localStorage.', 'error');
    return;
  }

  const counts = await refreshStateFromLocalStorageSnapshot(normalized.localStorage);
  const inventoryCount = counts?.inventoryCount ?? 0;
  const journalCount = counts?.journalCount ?? 0;
  const message = `Restored localStorage backup (${inventoryCount} strategies, ${journalCount} journal entries, customizer settings).`;
  broadcastDataMessage(message, 'success');
  showJournalStatus(`Restored ${journalCount} ${journalCount === 1 ? 'entry' : 'entries'} from backup.`);
}

async function refreshStateFromLocalStorageSnapshot(snapshot) {
  try {
    await initCustomizer();
  } catch (error) {
    console.warn('Unable to initialize customizer while applying backup', error);
  }

  const inventoryFromStorage = loadInventory();
  state.inventory = Array.isArray(inventoryFromStorage) ? inventoryFromStorage : [];
  refreshSavedStrategyIndex();
  renderInventoryViews();
  updateStrategySaveButtonStates();
  updateInventoryCount();

  let journalEntries = [];
  const rawJournal =
    typeof snapshot?.['journal:v2'] === 'string'
      ? snapshot['journal:v2']
      : typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem('journal:v2')
      : '';
  const parsedJournal = parseJsonSafe(rawJournal);
  if (Array.isArray(parsedJournal)) {
    journalEntries = parsedJournal;
  }

  try {
    await ensureJournalModuleReady();
  } catch (error) {
    console.warn('Unable to ensure journal module is ready during backup restore', error);
  }

  const store = ensureJournalStore();
  if (store && typeof store.list === 'function' && typeof store.remove === 'function') {
    const existingEntries = store.list();
    if (Array.isArray(existingEntries) && existingEntries.length) {
      existingEntries.forEach((entry) => {
        if (!entry || typeof entry !== 'object' || !entry.id) {
          return;
        }
        try {
          store.remove(entry.id);
        } catch (error) {
          console.warn('Unable to remove journal entry during backup restore', error);
        }
      });
    }
    if (Array.isArray(journalEntries) && journalEntries.length && typeof store.importEntries === 'function') {
      try {
        store.importEntries(journalEntries);
      } catch (error) {
        console.warn('Unable to import journal entries from backup', error);
      }
    }
    updateJournalEntriesFromStore();
  } else {
    state.journalEntries = Array.isArray(journalEntries) ? journalEntries : [];
  }

  renderJournalViews();
  const journalCount = Array.isArray(state.journalEntries) ? state.journalEntries.length : 0;

  const savedTheme = loadSavedTheme();
  if (savedTheme?.roundness !== undefined) {
    setCornerRoundness(savedTheme.roundness, { persist: false });
  } else {
    setCornerRoundness(DEFAULT_ROUNDNESS, { persist: false });
  }
  if (savedTheme?.values && Object.keys(savedTheme.values).length) {
    applyColors(savedTheme.values, { presetName: savedTheme.preset || '', persist: false, replace: true });
  } else if (paletteState?.defaultColors) {
    applyColors(paletteState.defaultColors, { persist: false, replace: true });
  } else {
    applyColors(DEFAULT_PALETTE, { persist: false, replace: true });
  }

  navState.settings = loadNavSettings();
  applyNavSettings();
  renderNavCustomizerControls();

  return {
    inventoryCount: state.inventory.length,
    journalCount,
  };
}

function importInventoryCsvFromText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    showInventoryMessage('Unable to read that file. Please try again.', 'error');
    return false;
  }

  const parsed = parseCsv(text);
  if (!parsed.length) {
    showInventoryMessage('No rows were found in that CSV file.', 'error');
    return false;
  }

  const replace = window.confirm(
    'Replace your current inventory with the imported file? Press “OK” to replace or “Cancel” to merge.'
  );
  const existing = replace ? [] : [...state.inventory];
  const map = new Map(existing.map((item) => [item.id, item]));

  parsed.forEach((item) => {
    const id = item.id || generateId();
    const importedNeedSlugs = normalizeNeedSlugList(item.needSlugs);
    const initialNeedSlug = normalizeNeedSlugValue(item.needSlug || item.sourceNeedPage);
    const resolvedNeedSlug =
      initialNeedSlug || findNeedSlugByTitle(item.need) || importedNeedSlugs[0] || '';
    const combinedNeedSlugs = normalizeNeedSlugList([importedNeedSlugs, resolvedNeedSlug]);
    const tags = normalizeTagsList(item.tags);
    combinedNeedSlugs.forEach((slug) => {
      if (!tags.some((tag) => normalizeNeedSlugValue(tag) === slug)) {
        tags.push(slug);
      }
    });

    const contributorName = sanitizeContributorName(
      (item.contributorName || item.firstName || '').toString()
    );
    const contributorLocation = sanitizeLocation(
      (item.contributorLocation || item.location || '').toString()
    );
    const entry = {
      id,
      title: item.title || 'Untitled strategy',
      description: item.description || '',
      need:
        item.need ||
        state.needsBySlug.get(combinedNeedSlugs[0] || resolvedNeedSlug)?.title ||
        combinedNeedSlugs[0] ||
        resolvedNeedSlug ||
        '',
      needSlug: combinedNeedSlugs[0] || resolvedNeedSlug || '',
      needSlugs: combinedNeedSlugs,
      tags,
      personal: item.personal === true,
      sourceNeedPage: item.sourceNeedPage || resolvedNeedSlug || '',
      strategySlug: item.strategySlug || '',
      firstName: contributorName,
      location: contributorLocation,
      createdAt: item.createdAt || new Date().toISOString(),
    };
    if (contributorName || contributorLocation) {
      entry.contributor = {};
      if (contributorName) {
        entry.contributor.name = contributorName;
      }
      if (contributorLocation) {
        entry.contributor.location = contributorLocation;
      }
    }
    map.set(id, entry);
  });

  const merged = Array.from(map.values());
  persistInventory(merged, {
    inventoryMessage: replace
      ? 'Inventory replaced from imported file.'
      : 'Inventory updated with imported strategies.',
    openList: true,
  });
  return true;
}

async function importLegacyJournalEntries(entries) {
  try {
    await ensureJournalModuleReady();
  } catch (error) {
    console.warn('Unable to load journal module for legacy import', error);
  }

  const store = ensureJournalStore();
  if (!store) {
    showJournalMessage('Import unavailable right now. Reload and try again.', 'error');
    return false;
  }

  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) {
    showJournalMessage('No entries found in the import file.', 'warning');
    return false;
  }

  try {
    const result = store.importEntries(list);
    if (!result.added && !result.updated) {
      showJournalMessage('No new entries found to import.', 'warning');
      return false;
    }
    updateJournalEntriesFromStore();
    renderJournalViews();
    const total = result.added + result.updated;
    showJournalStatus(`Imported ${total} ${total === 1 ? 'entry' : 'entries'}.`);
    showJournalMessage('Import complete. Entries stay on this device unless you export them.', 'success');
    return true;
  } catch (error) {
    console.warn('Unable to import journal entries', error);
    showJournalMessage('Import failed. Make sure you selected a JSON export from this app.', 'error');
    return false;
  }
}

function handleExportInventory() {
  exportLocalData();
}

function handleEmailPersonalStrategies() {
  const payload = buildPersonalStrategiesExportPayload();
  const strategies = Array.isArray(payload.personalStrategies) ? payload.personalStrategies : [];
  if (!strategies.length) {
    showInventoryMessage('No personal strategies found yet. Add one before exporting.', 'warning');
    return;
  }

  try {
    downloadPersonalStrategiesExport(payload);
  } catch (error) {
    console.warn('Unable to export personal strategies', error);
    showInventoryMessage('Export failed. Unable to prepare your personal strategies right now.', 'error');
    return;
  }

  const successMessage = `Personal strategies exported! Email the downloaded file to ${PERSONAL_STRATEGIES_EMAIL_ADDRESS} with the subject “${PERSONAL_STRATEGIES_EMAIL_SUBJECT}”.`;

  if (typeof document === 'undefined') {
    showInventoryMessage(successMessage, 'success');
    return;
  }

  const messageContent = document.createDocumentFragment();
  const instructions = document.createElement('span');
  instructions.textContent = successMessage;
  messageContent.appendChild(instructions);

  const spacer = document.createTextNode(' ');
  messageContent.appendChild(spacer);

  const startEmailButton = document.createElement('button');
  startEmailButton.type = 'button';
  startEmailButton.className = 'inventory-message__action';
  startEmailButton.textContent = 'Start an email for me';
  startEmailButton.setAttribute(
    'aria-label',
    `Start an email draft addressed to ${PERSONAL_STRATEGIES_EMAIL_ADDRESS} with the recommended subject line.`
  );
  startEmailButton.addEventListener('click', () => {
    openPersonalStrategiesEmailDraft();
  });
  messageContent.appendChild(startEmailButton);

  showInventoryMessage(messageContent, 'success');
}

function handleImportInventory(file) {
  importLocalData(file);
}

function handleJournalExport() {
  exportLocalData();
}

function handleJournalImport(file) {
  importLocalData(file);
}

function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
  if (!lines.length) {
    return [];
  }
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  const rows = [];
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }
    const values = splitCsvLine(line);
    const entry = {};
    headers.forEach((header, headerIndex) => {
      entry[header] = values[headerIndex] ?? '';
    });
    if (entry.tags) {
      entry.tags = entry.tags.split('|').filter(Boolean);
    }
    if (entry.needSlugs) {
      entry.needSlugs = entry.needSlugs.split('|').filter(Boolean);
    }
    if (entry.personal) {
      entry.personal = entry.personal === true || entry.personal.toString().toLowerCase() === 'true';
    }
    rows.push(entry);
  }
  return rows;
}

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function generateId() {
  return `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildStrategyTags(rawTags, needSlug) {
  const tags = (rawTags || '')
    .split('|')
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (needSlug && !tags.includes(needSlug)) {
    tags.push(needSlug);
  }
  return tags;
}

function findNeedSlugByTitle(title) {
  if (!title || !state.needsBySlug.size) {
    return '';
  }
  const normalized = title.trim().toLowerCase().replace(/^need for\s+/, '');
  for (const [slug, need] of state.needsBySlug.entries()) {
    const needTitle = need.title.trim().toLowerCase().replace(/^need for\s+/, '');
    if (needTitle === normalized) {
      return slug;
    }
  }
  return '';
}

function focusNeedSection(slug) {
  openInventoryPanel();
  const target = document.getElementById(`inventory-${slug}`);
  if (!target) {
    const needTitle = state.needsBySlug.get(slug)?.title || 'this need';
    showInventoryMessage(
      `No saved strategies for ${needTitle} yet. Use the Need Page button above to add one.`,
      'warning'
    );
    return;
  }
  if (target instanceof HTMLDetailsElement) {
    target.open = true;
  }
  target.classList.add('inventory-need--highlight');
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => {
    target.classList.remove('inventory-need--highlight');
  }, 1200);
}

(function () {
  const stack = document.querySelector('[data-strategy-stack]');
  const deck = document.querySelector('[data-strategy-deck]');
  const nextBtn = document.querySelector('[data-strategy-next]');
  const prevBtn = document.querySelector('[data-strategy-prev]');
  const shuffleBtn = document.querySelector('[data-strategy-shuffle]');
  const deckHeader = document.querySelector('.strategy-deck-header');
  const counter = document.querySelector('[data-strategy-count]');
  let toggleBtn = document.querySelector('[data-strategy-toggle]');

  if (!stack) {
    return;
  }

  let cards = Array.from(stack.querySelectorAll('.strategy-card'));
  if (!cards.length) {
    return;
  }

  if (!toggleBtn && deckHeader) {
    toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'strategy-deck__toggle';
    toggleBtn.setAttribute('data-strategy-toggle', '');
    toggleBtn.textContent = 'View all';
    deckHeader.appendChild(toggleBtn);
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  let viewAll = false;

  function updateToggleButton() {
    if (!toggleBtn) return;
    toggleBtn.textContent = viewAll ? 'View one at a time' : 'View all';
    toggleBtn.setAttribute('aria-pressed', viewAll ? 'true' : 'false');
  }

  function applyPositions(currentIndex) {
    if (viewAll) {
      cards.forEach((card) => {
        card.removeAttribute('data-active');
        card.removeAttribute('data-position');
      });
      return;
    }

    const prevIndex = (currentIndex - 1 + cards.length) % cards.length;
    const nextIndex = (currentIndex + 1) % cards.length;

    cards.forEach((card, index) => {
      card.removeAttribute('data-active');
      card.removeAttribute('data-position');

      if (index === currentIndex) {
        card.setAttribute('data-active', 'true');
      } else if (index === prevIndex) {
        card.setAttribute('data-position', 'prev');
      } else if (index === nextIndex) {
        card.setAttribute('data-position', 'next');
      }
    });
  }

  if (counter) {
    counter.setAttribute('aria-live', 'polite');
  }

  function updateCounter(currentIndex) {
    if (!counter) return;
    if (viewAll) {
      counter.textContent = `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`;
    } else {
      counter.textContent = `${currentIndex + 1} of ${cards.length}`;
    }
  }

  function enableListView() {
    viewAll = true;
    if (deck) {
      deck.classList.add('strategy-deck--list');
    }
    applyPositions(currentIndex);
    updateCounter(currentIndex);
    updateToggleButton();
    window.requestAnimationFrame(refreshBodyShadows);
  }

  function disableListView() {
    viewAll = false;
    if (deck) {
      deck.classList.remove('strategy-deck--list');
    }
    applyPositions(currentIndex);
    updateCounter(currentIndex);
    updateToggleButton();
    window.requestAnimationFrame(refreshBodyShadows);
  }

  function toggleViewMode() {
    if (viewAll) {
      disableListView();
    } else {
      enableListView();
    }
  }

  function toggleBodyShadow(body) {
    if (!body) return;

    const hasOverflow = body.scrollHeight > body.clientHeight + 1;
    const dismissed = body.dataset.scrollHintDismissed === 'true';

    body.classList.toggle('strategy-card__body--shadow', hasOverflow && !dismissed);
  }

  function refreshBodyShadows() {
    cards.forEach((card) => {
      const body = card.querySelector('.strategy-card__body');
      toggleBodyShadow(body);
    });
  }

  cards.forEach((card) => {
    const body = card.querySelector('.strategy-card__body');
    if (body) {
      body.addEventListener('scroll', function () {
        if (body.scrollTop > 0) {
          body.dataset.scrollHintDismissed = 'true';
        }
        toggleBodyShadow(body);
      });
    }
  });

  let currentIndex = 0;

  function go(offset) {
    if (!cards.length || viewAll) return;
    currentIndex = (currentIndex + offset + cards.length) % cards.length;
    applyPositions(currentIndex);
    updateCounter(currentIndex);
    window.requestAnimationFrame(refreshBodyShadows);
  }

  function performShuffle() {
    const children = Array.from(stack.children).filter(function (node) {
      return node.classList && node.classList.contains('strategy-card');
    });

    const shuffled = shuffleArray(children);
    shuffled.forEach(function (card) {
      stack.appendChild(card);
    });

    cards = Array.from(stack.querySelectorAll('.strategy-card'));
    currentIndex = 0;
    applyPositions(currentIndex);
    updateCounter(currentIndex);
    window.requestAnimationFrame(refreshBodyShadows);
  }

  performShuffle();
  updateCounter(currentIndex);
  updateToggleButton();
  window.requestAnimationFrame(refreshBodyShadows);

  window.addEventListener('resize', function () {
    window.requestAnimationFrame(refreshBodyShadows);
  });

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      go(1);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      go(-1);
    });
  }

  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', function () {
      performShuffle();
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      toggleViewMode();
    });
  }

  if (deck && deck.addEventListener) {
    let startX = null;
    let startY = null;
    let isDragging = false;
    let swipeLocked = false;
    let startedOnActiveCard = false;

    deck.addEventListener('pointerdown', function (event) {
      const target = event.target;
      const targetIsElement = target instanceof Element;
      const targetInsideStack = targetIsElement && (target === stack || stack.contains(target));
      const interactiveTarget = targetIsElement
        ? target.closest('button, a, input, textarea, select, label')
        : null;

      if (!targetInsideStack || (interactiveTarget && deck.contains(interactiveTarget))) {
        isDragging = false;
        swipeLocked = false;
        startedOnActiveCard = false;
        startX = null;
        startY = null;
        deck.style.touchAction = '';
        return;
      }

      isDragging = true;
      swipeLocked = false;
      startedOnActiveCard = false;
      startX = event.clientX;
      startY = event.clientY;

      const activeCard = stack.querySelector('.strategy-card[data-active="true"]');
      if (activeCard && activeCard.contains(event.target)) {
        startedOnActiveCard = true;
        swipeLocked = true;
        deck.style.touchAction = 'pan-x';
      } else {
        deck.style.touchAction = '';
      }

      if (deck.setPointerCapture) {
        try {
          deck.setPointerCapture(event.pointerId);
        } catch (err) {
          /* noop */
        }
      }
    });

    deck.addEventListener('pointermove', function (event) {
      if (!isDragging || startX == null || startY == null) {
        return;
      }

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (startedOnActiveCard) {
        event.preventDefault();
        return;
      }

      if (!swipeLocked) {
        const horizontalDominant = Math.abs(dx) > Math.abs(dy) + 6;
        if (horizontalDominant && Math.abs(dx) > 12) {
          swipeLocked = true;
          event.preventDefault();
        } else if (Math.abs(dy) > Math.abs(dx)) {
          return;
        }
      } else {
        event.preventDefault();
      }
    });

    deck.addEventListener('pointerup', function (event) {
      if (!isDragging || startX == null) {
        return;
      }

      const dx = event.clientX - startX;
      const threshold = 40;

      if (swipeLocked && Math.abs(dx) > threshold) {
        if (dx > 0) {
          go(-1);
        } else {
          go(1);
        }
      }

      isDragging = false;
      swipeLocked = false;
      startedOnActiveCard = false;
      startX = null;
      startY = null;
      deck.style.touchAction = '';
    });

    deck.addEventListener('pointerleave', function () {
      isDragging = false;
      swipeLocked = false;
      startedOnActiveCard = false;
      startX = null;
      startY = null;
      deck.style.touchAction = '';
    });

    deck.addEventListener('pointercancel', function () {
      isDragging = false;
      swipeLocked = false;
      startedOnActiveCard = false;
      startX = null;
      startY = null;
      deck.style.touchAction = '';
    });
  }
})();
