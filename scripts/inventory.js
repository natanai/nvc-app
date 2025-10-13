const STORAGE_KEY = 'nvcApp.inventory';
const THEME_STORAGE_KEY = 'nvcApp.theme';
const THEME_HIGH_CONTRAST_KEY = 'themeHighContrast';
const JOURNAL_EDIT_QUERY_KEY = 'e';
const JOURNAL_EDIT_HASH = '#edit';

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

const paletteState = {
  container: null,
  toggle: null,
  mobileToggle: null,
  panel: null,
  presetSelect: null,
  inputs: new Map(),
  swatches: new Map(),
  presets: [],
  currentColors: {},
  defaultColors: {},
  currentPreset: '',
  lastTrigger: null,
  styleElement: null,
  highContrastToggle: null,
  highContrastEnabled: false,
  cornerSlider: null,
  cornerValue: null,
  cornerRoundness: DEFAULT_ROUNDNESS,
  tiltField: null,
  tiltToggle: null,
  tiltStatus: null,
  tiltSnapshot: null,
};

const SECTION_ALIASES = new Map([
  ['/alexithymia-support/', '/feelings/'],
]);

const state = {
  inventory: [],
  needs: [],
  feelings: [],
  needsBySlug: new Map(),
  basePath: '',
  inventoryListEl: null,
  inventorySummaryEl: null,
  inventoryMessageEl: null,
  strategiesContainerEl: null,
  inventoryToggleButton: null,
  jumpToStrategiesButton: null,
  inventoryListHeading: null,
  showStrategies: false,
  summaryFilter: 'all',
  summaryFilterButtons: [],
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

function normalizeInventoryEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const normalized = { ...entry };
  normalized.firstName = sanitizeContributorName(entry.firstName || '');
  normalized.location = sanitizeLocation(entry.location || '');
  normalized.need = typeof entry.need === 'string' ? entry.need.trim() : normalized.need || '';
  const normalizedSlug = normalizeNeedSlugValue(entry.needSlug || entry.sourceNeedPage);
  normalized.needSlug = normalizedSlug;
  if (typeof normalized.sourceNeedPage === 'string') {
    normalized.sourceNeedPage = normalized.sourceNeedPage.trim();
  }
  const tags = normalizeTagsList(entry.tags);
  if (normalizedSlug && !tags.some((tag) => normalizeNeedSlugValue(tag) === normalizedSlug)) {
    tags.push(normalizedSlug);
  }
  normalized.tags = tags;
  return normalized;
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

document.addEventListener('DOMContentLoaded', () => {
  state.basePath = document.body?.dataset?.basePath || '';
  state.journalDraftPath = typeof window !== 'undefined' ? window.location.pathname : '';
  setupViewportHeightProperty();
  state.inventory = loadInventory();
  state.journalStore = resolveJournalStore();
  updateJournalEntriesFromStore();
  highlightNavigation();
  initCustomizer().catch((error) => {
    console.warn('Unable to set up the customizer', error);
  });
  updateInventoryCount();
  setupNeedPage();
  setupInventoryPage();
  setupJournalSection();
  renderJournalViews();
  loadJournalReferenceData();
  setupScrollTopButton();
});

function loadInventory() {
  try {
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('Unable to save inventory to storage', error);
  }
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
    const saveButton = card.querySelector('.strategy-card__save');
    if (!saveButton) {
      return;
    }

    saveButton.addEventListener('click', () => {
      const title = card.querySelector('.strategy-card__title')?.textContent?.trim() || 'Untitled strategy';
      const description = card.querySelector('.strategy-card__description')?.textContent?.trim() || '';
      const strategySlug = card.dataset.strategySlug || '';
      const tags = buildStrategyTags(card.dataset.strategyTags, needSlug);
      const firstName = sanitizeContributorName(card.dataset.firstName || '');
      const location = sanitizeLocation(card.dataset.location || '');

      const entry = {
        id: generateId(),
        title,
        description,
        need: needTitle,
        needSlug,
        tags,
        personal: false,
        sourceNeedPage: strategySlug ? needSlug : '',
        strategySlug,
        firstName,
        location,
        createdAt: new Date().toISOString(),
      };

      const duplicate = state.inventory.find(
        (item) =>
          item.needSlug === entry.needSlug && item.title.trim().toLowerCase() === entry.title.trim().toLowerCase()
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
        feedbackMessage: `Saved “${title}” to your inventory for ${needName}.`,
      });
    });
  });

  const suggestionForm = main.querySelector('#suggestion-form');
  if (suggestionForm) {
    const message = suggestionForm
      .closest('[data-strategy-form-container]')
      ?.querySelector('[data-form-message]');

    suggestionForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(suggestionForm);
      const title = (formData.get('title') || '').toString().trim();
      const description = (formData.get('description') || '').toString().trim();
      let selectedNeedSlug = (formData.get('need') || '').toString();
      const firstName = sanitizeContributorName(formData.get('name'));
      const location = sanitizeLocation(formData.get('location'));

      if (!title || !description) {
        showFormMessage(message, 'Please share a strategy name and description before saving.', 'error');
        return;
      }

      if (!selectedNeedSlug) {
        selectedNeedSlug = needSlug || '';
      }

      const needSelect = suggestionForm.querySelector('select[name="need"]');
      let selectedNeedTitle = '';
      if (needSelect instanceof HTMLSelectElement) {
        selectedNeedTitle = needSelect.options[needSelect.selectedIndex]?.textContent?.trim() || '';
      }

      const entry = {
        id: generateId(),
        title,
        description,
        need: selectedNeedTitle || needTitle,
        needSlug: selectedNeedSlug,
        tags: selectedNeedSlug ? [selectedNeedSlug] : [],
        personal: true,
        sourceNeedPage: '',
        strategySlug: '',
        firstName,
        location,
        createdAt: new Date().toISOString(),
      };

      const nextInventory = [...state.inventory, entry];
      persistInventory(nextInventory);

      suggestionForm.reset();
      showFormMessage(
        message,
        `Saved “${title}” to your inventory. Personal strategies stay on this browser. Visit the inventory page anytime to export a backup.`,
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

  updateStrategiesVisibility();
  updateInventoryToggleLabel();
  updateSummaryFilterButtons();

  captureNeedsFromForm();
  renderInventoryViews();

  const form = document.getElementById('inventory-form');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const title = (formData.get('title') || '').toString().trim();
      const description = (formData.get('description') || '').toString().trim();
      const needSlug = (formData.get('need') || '').toString();
      const firstName = sanitizeContributorName(formData.get('name'));
      const location = sanitizeLocation(formData.get('location'));

      if (!title || !description || !needSlug) {
        showInventoryMessage('Please fill in the title, description, and primary need before adding.', 'error');
        return;
      }

      const tags = needSlug ? [needSlug] : [];

      const needTitle = state.needsBySlug.get(needSlug)?.title || needSlug;

      const entry = {
        id: generateId(),
        title,
        description,
        need: needTitle,
        needSlug,
        tags,
        personal: true,
        sourceNeedPage: '',
        strategySlug: '',
        firstName,
        location,
        createdAt: new Date().toISOString(),
      };

      const nextInventory = [...state.inventory, entry];
      persistInventory(nextInventory, {
        inventoryMessage:
          `Added “${title}” to your inventory. Strategies you add stay on this browser, so export a CSV whenever you would like a backup.`,
        openList: true,
      });
      form.reset();
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

  if (state.inventoryListEl) {
    state.inventoryListEl.addEventListener('click', (event) => {
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
      const focusButton = event.target.closest('.inventory-summary__focus');
      if (!focusButton) {
        return;
      }
      const slug = focusButton.dataset.needSlug;
      if (slug) {
        focusNeedSection(slug);
      }
    });
  }
}

function highlightNavigation() {
  const navLinks = Array.from(document.querySelectorAll('.site-nav__link'));
  if (!navLinks.length) {
    return;
  }

  const currentPath = normalizePath(window.location.pathname);
  const aliasPath = resolveSectionAlias(currentPath);
  const candidatePaths = aliasPath ? [currentPath, aliasPath] : [currentPath];
  let activeLink = null;
  let longestMatch = 0;

  const entries = navLinks.map((link) => {
    link.removeAttribute('aria-current');
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
    activeLink.setAttribute('aria-current', 'page');
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

  paletteState.highContrastEnabled = loadHighContrastPreference();
  buildPaletteUi();

  const themePreapplied = document.documentElement.getAttribute('data-theme-preapplied') === 'true';
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
  let mobileToggle = null;
  if (nav) {
    const existingNavToggle = nav.querySelector('[data-palette-toggle]');
    if (existingNavToggle instanceof HTMLElement) {
      mobileToggle = existingNavToggle;
      if (!mobileToggle.hasAttribute('type')) {
        mobileToggle.setAttribute('type', 'button');
      }
      mobileToggle.setAttribute('aria-haspopup', 'dialog');
      if (!mobileToggle.hasAttribute('data-palette-toggle')) {
        mobileToggle.setAttribute('data-palette-toggle', '');
      }
    } else {
      mobileToggle = document.createElement('button');
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
    }
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

  const contrastField = document.createElement('div');
  contrastField.className = 'palette-form__field palette-form__field--toggle';

  const contrastLabel = document.createElement('span');
  contrastLabel.className = 'palette-form__label';
  contrastLabel.id = 'paletteHighContrastLabel';
  contrastLabel.textContent = 'High contrast';

  const contrastToggle = document.createElement('button');
  contrastToggle.type = 'button';
  contrastToggle.className = 'palette-form__switch';
  contrastToggle.setAttribute('role', 'switch');
  contrastToggle.setAttribute('aria-labelledby', 'paletteHighContrastLabel');
  contrastToggle.addEventListener('click', () => {
    setHighContrastEnabled(!paletteState.highContrastEnabled);
  });

  contrastField.append(contrastLabel, contrastToggle);
  form.appendChild(contrastField);

  paletteState.highContrastToggle = contrastToggle;
  updateHighContrastToggle();

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
    });
    input.addEventListener('change', handleColorInputChange);

    fieldInner.append(swatch, input);
    field.append(fieldLabel, fieldInner);
    grid.appendChild(field);

    paletteState.inputs.set(color.key, input);
    paletteState.swatches.set(color.key, swatch);
  });

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

  const actions = document.createElement('div');
  actions.className = 'palette-form__actions';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'palette-form__reset';
  resetButton.setAttribute('data-palette-reset', '');
  resetButton.textContent = 'Reset to default';
  resetButton.addEventListener('click', () => {
    applyColors(paletteState.defaultColors, { presetName: '', replace: true });
    setCornerRoundness(DEFAULT_ROUNDNESS);
  });

  actions.appendChild(resetButton);
  form.appendChild(actions);

  panel.appendChild(form);
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
    if (paletteState.toggle?.getAttribute('aria-expanded') !== 'true' && paletteState.mobileToggle?.getAttribute('aria-expanded') !== 'true') {
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

  paletteState.panel.scrollTop = 0;

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
    const buttonBase = paletteState.currentColors.rose || paletteState.defaultColors.rose || DEFAULT_PALETTE.rose;
    if (buttonBase) {
      root.style.setProperty('--btn-bg', buttonBase);
    }
    root.style.setProperty('--btn-fg', '#111111');
    root.style.setProperty('--chip-fg', '#111111');
    applyHighContrastOverlay({ skipAutoContrast: true });
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

function applyHighContrastOverlay(options = {}) {
  const { skipAutoContrast = false, skipDomUpdate = false } = options;
  if (skipDomUpdate) {
    return;
  }

  const root = document.documentElement;
  if (!root) {
    return;
  }

  const baseInk = paletteState.currentColors.ink || paletteState.defaultColors.ink || DEFAULT_PALETTE.ink;
  let nextInk = baseInk;

  if (paletteState.highContrastEnabled) {
    try {
      const adjust = window.NVCContrast?.adjustLightness;
      if (typeof adjust === 'function' && baseInk) {
        const darker = adjust(baseInk, -20);
        if (darker) {
          nextInk = darker;
        }
      }
    } catch (error) {
      console.warn('Unable to adjust ink for high contrast', error);
    }
    root.style.setProperty('--shadow', 'color-mix(in srgb, var(--outline) 70%, transparent)');
  } else {
    root.style.setProperty('--shadow', 'color-mix(in srgb, var(--outline) 55%, transparent)');
  }

  if (nextInk) {
    root.style.setProperty('--ink', nextInk);
  }

  if (!skipAutoContrast) {
    runAutoContrast();
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

function loadHighContrastPreference() {
  try {
    return window.localStorage ? localStorage.getItem(THEME_HIGH_CONTRAST_KEY) === '1' : false;
  } catch (error) {
    console.warn('Unable to read high contrast preference', error);
    return false;
  }
}

function saveHighContrastPreference(enabled) {
  try {
    if (window.localStorage) {
      localStorage.setItem(THEME_HIGH_CONTRAST_KEY, enabled ? '1' : '0');
    }
  } catch (error) {
    console.warn('Unable to persist high contrast preference', error);
  }
}

function updateHighContrastToggle() {
  const toggle = paletteState.highContrastToggle;
  if (!toggle) {
    return;
  }
  const enabled = !!paletteState.highContrastEnabled;
  toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
  toggle.classList.toggle('is-on', enabled);
  toggle.textContent = enabled ? 'On' : 'Off';
}

function reapplyPaletteColors() {
  applyColors({}, { persist: false, presetName: paletteState.currentPreset });
}

function setHighContrastEnabled(enabled, options = {}) {
  const { persistPreference = true, reapply = true, force = false } = options;
  const next = !!enabled;
  if (!force && paletteState.highContrastEnabled === next) {
    updateHighContrastToggle();
    return;
  }

  paletteState.highContrastEnabled = next;
  updateHighContrastToggle();

  if (persistPreference) {
    saveHighContrastPreference(next);
  }

  if (reapply) {
    reapplyPaletteColors();
  } else {
    applyHighContrastOverlay();
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
  };

  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to persist color theme', error);
  }
}

function loadSavedTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      values: sanitizeColorsMap(parsed.values),
      preset: typeof parsed.preset === 'string' ? parsed.preset : '',
      roundness: clampRoundness(parsed.roundness),
    };
  } catch (error) {
    console.warn('Unable to read saved color theme', error);
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
  const renderJournalForm = window.NVCJournal?.renderForm;
  if (typeof renderJournalForm === 'function') {
    const mount = panel.querySelector('[data-journal-module]');
    if (mount) {
      try {
        renderJournalForm(mount, {
          variant: mount.dataset.journalVariant || 'inventory',
          idPrefix: mount.dataset.journalIdPrefix || 'journal',
        });
      } catch (error) {
        console.warn('Unable to render shared journal form', error);
      }
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
  state.journalIntensityDisplay = state.journalController?.intensityDisplay || panel.querySelector('[data-journal-intensity-display]');
  state.journalNeedsSelect = state.journalController?.needsSelect || panel.querySelector('[data-journal-needs]');
  state.journalEmotionInput = state.journalController?.emotionInput || panel.querySelector('#journal-emotion');
  state.journalNotesInput = state.journalController?.notesInput || panel.querySelector('#journal-notes');
  state.journalIntensityInput = state.journalController?.intensityInput || panel.querySelector('#journal-intensity');
  state.journalTagsInput = state.journalController?.tagsInput || panel.querySelector('#journal-tags');
  state.journalTagSuggestionsEl = state.journalController?.tagSuggestionsEl || panel.querySelector('[data-journal-tag-suggestions]');
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
  setupJournalOverlay();

  registerJournalStoreListeners();
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
  state.journalOverlayOpenTriggers = openButtons;
  state.journalOverlayOpenButton = container?.querySelector('[data-support-journal-open]') || openButtons[0] || null;

  if (!container) {
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

  const overlayId = state.journalOverlayLayer?.id || 'global-support-journal-layer';

  openButtons.forEach((button) => {
    if (!(button instanceof HTMLElement)) {
      return;
    }
    if (button.dataset.journalOverlayBound === 'true') {
      return;
    }
    button.dataset.journalOverlayBound = 'true';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', overlayId);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      state.journalOverlayActiveTrigger = button;
      openJournalOverlay();
    });
  });

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
  } else if (!mount.querySelector('[data-journal-status]')) {
    const status = document.createElement('p');
    status.className = 'journal-status';
    status.textContent = 'Enable JavaScript to use the journal form.';
    status.setAttribute('data-journal-status', '');
    mount.append(status);
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
  if (state.journalNotesInput) {
    state.journalNotesInput.focus();
  }
  setJournalEditState(entry.id);
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
  link.href = '#journal-history-heading';
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

function handleJournalExport() {
  const entries = Array.isArray(state.journalEntries) ? state.journalEntries : [];
  if (!entries.length) {
    showJournalMessage('No journal entries to export yet.', 'warning');
    return;
  }
  try {
    const payload = JSON.stringify(entries, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `nvc-journal-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showJournalMessage('Exported journal entries as JSON.', 'success');
  } catch (error) {
    console.warn('Unable to export journal entries', error);
    showJournalMessage('Export failed. Try again.', 'error');
  }
}

async function handleJournalImport(file) {
  try {
    const store = ensureJournalStore();
    if (!store) {
      showJournalMessage('Import unavailable right now. Reload and try again.', 'error');
      return;
    }
    const text = await file.text();
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.entries)
      ? parsed.entries
      : [];
    if (!list.length) {
      showJournalMessage('No entries found in the import file.', 'warning');
      return;
    }
    const result = store.importEntries(list);
    if (!result.added && !result.updated) {
      showJournalMessage('No new entries found to import.', 'warning');
      return;
    }
    updateJournalEntriesFromStore();
    renderJournalViews();
    const total = result.added + result.updated;
    showJournalStatus(`Imported ${total} ${total === 1 ? 'entry' : 'entries'}.`);
    showJournalMessage('Import complete. Entries stay on this device unless you export them.', 'success');
  } catch (error) {
    console.warn('Unable to import journal entries', error);
    showJournalMessage('Import failed. Make sure you selected a JSON export from this app.', 'error');
  }
}

function capitalizeWord(value) {
  if (!value) {
    return '';
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderInventorySummary() {
  if (!state.inventorySummaryEl || !state.needs.length) {
    return;
  }

  const counts = new Map();
  state.needs.forEach((need) => counts.set(need.slug, 0));
  state.inventory.forEach((entry) => {
    const slug = pickNeedSlug(entry);
    if (slug && counts.has(slug)) {
      counts.set(slug, counts.get(slug) + 1);
    }
  });

  state.inventorySummaryEl.innerHTML = '';

  state.needs.forEach((need) => {
    const count = counts.get(need.slug) || 0;
    const wrapper = document.createElement('div');
    wrapper.className = `inventory-summary__item ${count ? 'inventory-summary__item--ready' : 'inventory-summary__item--missing'}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inventory-summary__focus';
    button.dataset.needSlug = need.slug;

    const status = document.createElement('span');
    status.className = 'inventory-summary__status';
    status.setAttribute('aria-hidden', 'true');
    button.append(status);

    const textWrap = document.createElement('span');
    textWrap.className = 'inventory-summary__text';

    const label = document.createElement('span');
    label.className = 'inventory-summary__label';
    label.textContent = need.title;
    textWrap.append(label);

    const countText = document.createElement('span');
    countText.className = 'inventory-summary__count';
    countText.textContent = count
      ? `${count} ${count === 1 ? 'strategy' : 'strategies'}`
      : 'Add one';
    textWrap.append(countText);

    button.append(textWrap);
    wrapper.append(button);

    const link = document.createElement('a');
    link.className = 'inventory-summary__link';
    link.href = `${state.basePath}needs/${need.slug}/`;
    link.textContent = 'Need page';
    link.setAttribute('aria-label', `Open need page for ${need.title}`);
    wrapper.append(link);

    state.inventorySummaryEl.append(wrapper);
  });
}

function handleJumpToStrategies(event) {
  if (event) {
    event.preventDefault();
  }
  jumpToSavedStrategies();
}

function jumpToSavedStrategies() {
  setShowStrategies(true);
  if (!state.strategiesContainerEl) {
    return;
  }

  requestAnimationFrame(() => {
    const heading = state.inventoryListHeading;
    const target = heading || state.strategiesContainerEl;
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (heading && typeof heading.focus === 'function') {
      try {
        heading.focus({ preventScroll: true });
      } catch (error) {
        heading.focus();
      }
    }
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
  if (!state.inventoryListEl) {
    return;
  }

  state.inventoryListEl.innerHTML = '';

  const grouped = new Map();
  const extras = [];

  state.inventory.forEach((entry) => {
    const slug = pickNeedSlug(entry);
    if (slug && state.needsBySlug.has(slug)) {
      if (!grouped.has(slug)) {
        grouped.set(slug, []);
      }
      grouped.get(slug).push(entry);
      return;
    }
    extras.push(entry);
  });

  let openedNeed = false;

  const needsWithEntries = state.needs.filter((need) => grouped.has(need.slug));

  needsWithEntries.forEach((need) => {
    const entries = grouped.get(need.slug) || [];
    if (!entries.length) {
      return;
    }

    const details = document.createElement('details');
    details.className = 'inventory-need';
    details.id = `inventory-${need.slug}`;
    if (!openedNeed) {
      details.open = true;
      openedNeed = true;
    }

    const summary = document.createElement('summary');
    summary.className = 'inventory-need__summary';

    const name = document.createElement('span');
    name.className = 'inventory-need__name';
    name.textContent = need.title;
    summary.append(name);

    const badge = document.createElement('span');
    badge.className = 'inventory-need__badge';
    badge.textContent = `${entries.length} ${entries.length === 1 ? 'strategy' : 'strategies'}`;
    summary.append(badge);

    details.append(summary);

    const body = document.createElement('div');
    body.className = 'inventory-need__body';

    entries.forEach((entry) => {
      body.append(renderInventoryItem(entry));
    });

    details.append(body);
    state.inventoryListEl.append(details);
  });

  if (extras.length) {
    const details = document.createElement('details');
    details.className = 'inventory-need inventory-need--extra';
    details.id = 'inventory-uncategorized';
    if (!openedNeed) {
      details.open = true;
      openedNeed = true;
    }

    const summary = document.createElement('summary');
    summary.className = 'inventory-need__summary';

    const name = document.createElement('span');
    name.className = 'inventory-need__name';
    name.textContent = 'Other strategies';
    summary.append(name);

    const badge = document.createElement('span');
    badge.className = 'inventory-need__badge';
    badge.textContent = `${extras.length} ${extras.length === 1 ? 'strategy' : 'strategies'}`;
    summary.append(badge);

    details.append(summary);

    const body = document.createElement('div');
    body.className = 'inventory-need__body';
    extras.forEach((entry) => {
      body.append(renderInventoryItem(entry));
    });
    details.append(body);
    state.inventoryListEl.append(details);
  }

  if (!needsWithEntries.length && !extras.length) {
    const emptyNotice = document.createElement('p');
    emptyNotice.className = 'inventory-empty';
    emptyNotice.textContent = 'No saved strategies yet – use the Need Page button above to add one.';
    state.inventoryListEl.append(emptyNotice);
  }
}

function setShowStrategies(visible) {
  const nextValue = Boolean(visible);
  if (state.showStrategies === nextValue) {
    updateStrategiesVisibility();
    updateInventoryToggleLabel();
    return;
  }
  state.showStrategies = nextValue;
  updateStrategiesVisibility();
  updateInventoryToggleLabel();
}

function updateStrategiesVisibility() {
  if (!state.strategiesContainerEl) {
    return;
  }
  const isVisible = Boolean(state.showStrategies);
  state.strategiesContainerEl.hidden = !isVisible;
  state.strategiesContainerEl.classList.toggle('inventory-list-panel--hidden', !isVisible);
  state.strategiesContainerEl.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
}

function openInventoryPanel() {
  setShowStrategies(true);
}

function closeInventoryPanel() {
  setShowStrategies(false);
}

function updateInventoryToggleLabel() {
  if (!state.inventoryToggleButton) {
    return;
  }
  const isOpen = state.showStrategies;
  const total = state.inventory.length;
  const baseLabel = isOpen ? 'Hide your saved strategies' : 'Show your saved strategies';
  const suffix = !isOpen && total ? ` (${total})` : '';
  state.inventoryToggleButton.textContent = `${baseLabel}${suffix}`;
  state.inventoryToggleButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  if (state.jumpToStrategiesButton) {
    state.jumpToStrategiesButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
  if (state.strategiesContainerEl) {
    const panelId = state.strategiesContainerEl.id || 'strategies-list';
    state.strategiesContainerEl.id = panelId;
    state.inventoryToggleButton.setAttribute('aria-controls', panelId);
  }
}

function renderInventoryItem(entry) {
  const card = document.createElement('article');
  card.className = 'inventory-item';
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

  const metaParts = [];
  const firstName = sanitizeContributorName(entry.firstName || '');
  const location = sanitizeLocation(entry.location || '');
  if (firstName) {
    metaParts.push(firstName);
  }
  if (location) {
    metaParts.push(location);
  }
  if (metaParts.length) {
    const meta = document.createElement('p');
    meta.className = 'inventory-item__meta';
    meta.textContent = metaParts.join(' • ');
    card.append(meta);
  }

  if (entry.tags?.length) {
    const tagList = document.createElement('ul');
    tagList.className = 'inventory-item__tags';
    entry.tags.forEach((tag) => {
      const item = document.createElement('li');
      item.className = 'inventory-item__tag-pill';
      item.textContent = state.needsBySlug.get(tag)?.title || tag;
      tagList.append(item);
    });
    card.append(tagList);
  }

  const actions = document.createElement('div');
  actions.className = 'inventory-item__actions';

  if (entry.needSlug) {
    const visitLink = document.createElement('a');
    visitLink.className = 'inventory-item__link';
    visitLink.href = `${state.basePath}needs/${entry.needSlug}/`;
    visitLink.textContent = 'Need page';
    actions.append(visitLink);
  }

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'inventory-item__delete';
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.id = entry.id;
  deleteButton.textContent = 'Delete';
  actions.append(deleteButton);

  card.append(actions);

  return card;
}

function pickNeedSlug(entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  const storedSlug = normalizeNeedSlugValue(entry.needSlug || entry.sourceNeedPage);
  if (storedSlug && state.needsBySlug.has(storedSlug)) {
    return storedSlug;
  }
  if (Array.isArray(entry.tags)) {
    const match = entry.tags
      .map((tag) => normalizeNeedSlugValue(tag))
      .find((tag) => tag && state.needsBySlug.has(tag));
    if (match) {
      return match;
    }
  }
  return findNeedSlugByTitle(entry.need);
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

    let slug = normalizeNeedSlugValue(normalized.needSlug || normalized.sourceNeedPage);
    if (slug && !state.needsBySlug.has(slug)) {
      slug = '';
    }

    if (!slug && normalized.tags.length) {
      const tagMatch = normalized.tags
        .map((tag) => normalizeNeedSlugValue(tag))
        .find((tag) => tag && state.needsBySlug.has(tag));
      if (tagMatch) {
        slug = tagMatch;
      }
    }

    if (!slug) {
      slug = findNeedSlugByTitle(normalized.need);
    }

    if (slug) {
      if (normalized.needSlug !== slug) {
        normalized.needSlug = slug;
        updated = true;
      }
      const needInfo = state.needsBySlug.get(slug);
      if (needInfo?.title && normalized.need !== needInfo.title) {
        normalized.need = needInfo.title;
        updated = true;
      }
      const hasSlugTag = normalized.tags.some((tag) => normalizeNeedSlugValue(tag) === slug);
      if (!hasSlugTag) {
        normalized.tags = [...normalized.tags, slug];
        updated = true;
      }
    }

    return normalized;
  });

  if (updated) {
    state.inventory = nextInventory;
    saveInventory(nextInventory);
  }

  return updated;
}

function persistInventory(items, options = {}) {
  state.inventory = items;
  saveInventory(items);
  renderInventoryViews();
  if (options.openList) {
    openInventoryPanel();
  }
  if (options.inventoryMessage && state.inventoryMessageEl) {
    showInventoryMessage(options.inventoryMessage, options.inventoryMessageType || 'success');
  }
  if (options.feedbackElement && options.feedbackMessage) {
    showFeedback(options.feedbackElement, options.feedbackMessage, 'success');
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
  state.inventoryMessageEl.textContent = message;
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

function handleExportInventory() {
  if (!state.inventory.length) {
    showInventoryMessage('No strategies to export yet. Add some to your inventory first.', 'warning');
    return;
  }

  const csv = inventoryToCsv(state.inventory);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nvc-strategy-inventory.csv';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showInventoryMessage('Inventory exported as nvc-strategy-inventory.csv.', 'success');
}

function inventoryToCsv(items) {
  const headers = [
    'id',
    'title',
    'description',
    'need',
    'needSlug',
    'tags',
    'personal',
    'sourceNeedPage',
    'strategySlug',
    'firstName',
    'location',
    'createdAt',
  ];
  const rows = [headers.join(',')];

  items.forEach((item) => {
    const values = headers.map((header) => {
      let value = item[header];
      if (Array.isArray(value)) {
        value = value.join('|');
      }
      if (typeof value === 'boolean') {
        value = value ? 'true' : 'false';
      }
      if (value === undefined || value === null) {
        value = '';
      }
      const stringValue = value.toString();
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    rows.push(values.join(','));
  });

  return rows.join('\n');
}

function handleImportInventory(file) {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const text = reader.result?.toString();
    if (!text) {
      showInventoryMessage('Unable to read that file. Please try again.', 'error');
      return;
    }

    const parsed = parseCsv(text);
    if (!parsed.length) {
      showInventoryMessage('No rows were found in that CSV file.', 'error');
      return;
    }

    const replace = window.confirm('Replace your current inventory with the imported file? Press “OK” to replace or “Cancel” to merge.');
    const existing = replace ? [] : [...state.inventory];
    const map = new Map(existing.map((item) => [item.id, item]));

    parsed.forEach((item) => {
      const id = item.id || generateId();
      const resolvedNeedSlug = item.needSlug || item.sourceNeedPage || findNeedSlugByTitle(item.need);
      const tags = Array.isArray(item.tags) ? [...item.tags] : [];
      if (resolvedNeedSlug && !tags.includes(resolvedNeedSlug)) {
        tags.push(resolvedNeedSlug);
      }
      map.set(id, {
        id,
        title: item.title || 'Untitled strategy',
        description: item.description || '',
        need: item.need || state.needsBySlug.get(resolvedNeedSlug)?.title || resolvedNeedSlug || '',
        needSlug: resolvedNeedSlug || '',
        tags,
        personal: item.personal === true,
        sourceNeedPage: item.sourceNeedPage || resolvedNeedSlug || '',
        strategySlug: item.strategySlug || '',
        firstName: sanitizeContributorName(item.firstName || ''),
        location: sanitizeLocation(item.location || ''),
        createdAt: item.createdAt || new Date().toISOString(),
      });
    });

    const merged = Array.from(map.values());
    persistInventory(merged, {
      inventoryMessage: replace ? 'Inventory replaced from imported file.' : 'Inventory updated with imported strategies.',
      openList: true,
    });
  });
  reader.readAsText(file);
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
