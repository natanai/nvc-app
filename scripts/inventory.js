const STORAGE_KEY = 'nvcApp.inventory';
const THEME_STORAGE_KEY = 'nvcApp.theme';
const JOURNAL_STORAGE_KEY = 'nvcApp.journal';
const CONTRAST_STORAGE_KEY = 'nvcApp.highContrast';
const LEGACY_JOURNAL_KEY = 'alexithymiaSupportJournal';

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
};

const SECTION_ALIASES = new Map([
  ['/alexithymia-support/', '/feelings/'],
]);

const contrastState = {
  enabled: false,
  button: null,
};

const scrollButtonState = {
  button: null,
  threshold: 800,
};

const state = {
  inventory: [],
  needs: [],
  needsBySlug: new Map(),
  basePath: '',
  inventoryListEl: null,
  inventorySummaryEl: null,
  inventoryMessageEl: null,
  strategiesContainerEl: null,
  inventoryToggleButton: null,
  showStrategies: false,
  journalEntries: [],
  journalForm: null,
  journalStatusEl: null,
  journalMessageEl: null,
  journalHistoryEl: null,
  journalEmptyEl: null,
  journalSummaryEl: null,
  journalSummaryToggle: null,
  journalFiltersForm: null,
  journalIntensityDisplay: null,
  journalNeedsSelect: null,
  journalFilters: { search: '', tag: '', sort: 'newest' },
  journalSummaryCollapsed: false,
};

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

function initHighContrast() {
  applyHighContrast(loadStoredContrastPreference() ?? false, { persist: false });
}

function loadStoredContrastPreference() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(CONTRAST_STORAGE_KEY);
    if (stored === '1') {
      return true;
    }
    if (stored === '0') {
      return false;
    }
  } catch (error) {
    console.warn('Unable to read contrast preference', error);
  }
  return null;
}

function applyHighContrast(enabled, options = {}) {
  const { persist = true } = options;
  contrastState.enabled = Boolean(enabled);
  if (document?.documentElement) {
    document.documentElement.dataset.contrast = contrastState.enabled ? 'high' : 'normal';
  }
  if (persist && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CONTRAST_STORAGE_KEY, contrastState.enabled ? '1' : '0');
    } catch (error) {
      console.warn('Unable to persist contrast preference', error);
    }
  }
  updateContrastToggleLabel();
  scheduleAutoContrast();
}

function updateContrastToggleLabel() {
  if (!contrastState.button) {
    return;
  }
  contrastState.button.setAttribute('aria-pressed', contrastState.enabled ? 'true' : 'false');
  const status = contrastState.button.querySelector('[data-contrast-status]');
  if (status) {
    const label = contrastState.enabled ? 'On' : 'Off';
    status.textContent = label;
    status.setAttribute('data-state-label', label);
  }
}

const autoContrastState = {
  scheduled: false,
};

function createContrastToggleField() {
  if (typeof document === 'undefined') {
    return null;
  }

  const field = document.createElement('div');
  field.className = 'palette-form__field palette-form__field--toggle';

  const label = document.createElement('span');
  label.className = 'palette-form__label';
  label.textContent = 'High contrast mode';
  field.appendChild(label);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'palette-form__contrast-toggle high-contrast-toggle';
  button.setAttribute('data-contrast-toggle', '');
  button.setAttribute('aria-pressed', contrastState.enabled ? 'true' : 'false');
  button.innerHTML = `
    <span class="palette-form__contrast-toggle-indicator" aria-hidden="true"></span>
    <span class="high-contrast-toggle__status" data-contrast-status></span>
    <span class="visually-hidden">Toggle high contrast mode</span>
  `;
  button.addEventListener('click', () => {
    applyHighContrast(!contrastState.enabled);
  });

  const note = document.createElement('p');
  note.className = 'palette-form__toggle-note';
  note.id = 'contrastModeNote';
  note.textContent = 'Boosts text contrast for easier reading across the site.';

  button.setAttribute('aria-describedby', note.id);

  field.append(button, note);

  contrastState.button = button;
  updateContrastToggleLabel();

  return field;
}

function scheduleAutoContrast() {
  if (autoContrastState.scheduled) {
    return;
  }
  autoContrastState.scheduled = true;
  const schedule = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame
    : (fn) => setTimeout(fn, 16);
  schedule(() => {
    autoContrastState.scheduled = false;
    applyAutoContrast();
  });
}

function applyAutoContrast() {
  if (typeof window === 'undefined' || !document?.documentElement) {
    return;
  }
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const buttonColor = parseColorValue(styles.getPropertyValue('--btn-bg'));
  if (buttonColor) {
    root.style.setProperty('--btn-fg', pickForegroundColor(buttonColor));
  }
  const chipColor = parseColorValue(styles.getPropertyValue('--chip-bg'));
  if (chipColor) {
    root.style.setProperty('--chip-fg', pickForegroundColor(chipColor));
  }
}

function parseColorValue(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('#')) {
    const hex = trimmed.length === 4
      ? `#${[1, 2, 3].map((index) => trimmed[index] + trimmed[index]).join('')}`
      : trimmed;
    const int = parseInt(hex.slice(1), 16);
    if (Number.isNaN(int)) {
      return null;
    }
    return {
      r: (int >> 16) & 255,
      g: (int >> 8) & 255,
      b: int & 255,
    };
  }
  const rgbMatch = trimmed.match(/rgba?\(([^)]+)\)/i);
  if (!rgbMatch) {
    return null;
  }
  const parts = rgbMatch[1]
    .split(/[\s,\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  return {
    r: normalizeChannel(parts[0]),
    g: normalizeChannel(parts[1]),
    b: normalizeChannel(parts[2]),
  };
}

function normalizeChannel(value) {
  if (!value) {
    return 0;
  }
  if (value.endsWith('%')) {
    const percent = Number.parseFloat(value.slice(0, -1));
    return Number.isFinite(percent) ? Math.round(Math.min(Math.max(percent, 0), 100) * 2.55) : 0;
  }
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.round(Math.min(Math.max(number, 0), 255));
}

function pickForegroundColor(background) {
  const backgroundLum = relativeLuminance(background);
  const contrastWithBlack = contrastRatio(backgroundLum, 0);
  const contrastWithWhite = contrastRatio(backgroundLum, 1);
  if (contrastWithBlack >= 4.5 && contrastWithBlack >= contrastWithWhite) {
    return '#000000';
  }
  if (contrastWithWhite >= 4.5 && contrastWithWhite >= contrastWithBlack) {
    return '#FFFFFF';
  }
  return contrastWithBlack > contrastWithWhite ? '#000000' : '#FFFFFF';
}

function relativeLuminance(color) {
  const channels = ['r', 'g', 'b'].map((key) => {
    const value = color[key] / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function initBackToTopButton() {
  if (scrollButtonState.button || typeof document === 'undefined') {
    return;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'floating-scroll-button';
  button.setAttribute('data-back-to-top', '');
  button.innerHTML = '<span aria-hidden="true">Top</span><span class="visually-hidden">Scroll to top</span>';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.body?.appendChild(button);
  scrollButtonState.button = button;
  window.addEventListener('scroll', handleScrollButtonVisibility, { passive: true });
  handleScrollButtonVisibility();
}

function handleScrollButtonVisibility() {
  if (!scrollButtonState.button) {
    return;
  }
  if (typeof window === 'undefined') {
    return;
  }
  if (window.scrollY > scrollButtonState.threshold) {
    scrollButtonState.button.classList.add('is-visible');
  } else {
    scrollButtonState.button.classList.remove('is-visible');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  state.basePath = document.body?.dataset?.basePath || '';
  initHighContrast();
  initBackToTopButton();
  state.inventory = loadInventory();
  state.journalEntries = loadJournalEntries();
  highlightNavigation();
  initColorCustomizer().catch((error) => {
    console.warn('Unable to set up the color customizer', error);
  });
  scheduleAutoContrast();
  updateInventoryCount();
  setupNeedPage();
  setupInventoryPage();
  setupJournalSection();
  migrateJournalEntries();
  renderJournalViews();
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

function normalizeJournalEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const normalized = { ...entry };
  normalized.id = typeof entry.id === 'string' && entry.id ? entry.id : generateJournalId();
  normalized.emotion = typeof entry.emotion === 'string' ? entry.emotion.trim() : '';
  const intensityValue = Number(entry.intensity);
  normalized.intensity = Number.isFinite(intensityValue)
    ? Math.min(10, Math.max(1, Math.round(intensityValue)))
    : null;
  if (Array.isArray(entry.needs)) {
    normalized.needs = entry.needs.map((value) => (typeof value === 'string' ? value.trim() : String(value))).filter(Boolean);
  } else if (entry.need) {
    normalized.needs = [String(entry.need).trim()];
  } else {
    normalized.needs = [];
  }
  if (Array.isArray(entry.tags)) {
    normalized.tags = entry.tags
      .map((tag) => (typeof tag === 'string' ? tag.replace(/^#/, '').trim() : String(tag).trim()))
      .filter(Boolean);
  } else if (typeof entry.tags === 'string') {
    normalized.tags = entry.tags
      .split(/[,|]/)
      .map((tag) => tag.replace(/^#/, '').trim())
      .filter(Boolean);
  } else {
    normalized.tags = [];
  }
  normalized.notes = typeof entry.notes === 'string' && entry.notes.trim()
    ? entry.notes.trim()
    : typeof entry.text === 'string'
    ? entry.text.trim()
    : '';
  normalized.timestamp =
    typeof entry.timestamp === 'string' && entry.timestamp
      ? entry.timestamp
      : typeof entry.createdAt === 'string' && entry.createdAt
      ? entry.createdAt
      : typeof entry.date === 'string' && entry.date
      ? entry.date
      : new Date().toISOString();
  return normalized;
}

function loadJournalEntriesFromKey(storageKey) {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => normalizeJournalEntry(item))
      .filter((item) => item && typeof item === 'object')
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  } catch (error) {
    console.warn('Unable to load journal entries from storage', error);
    return [];
  }
}

function loadJournalEntries() {
  return loadJournalEntriesFromKey(JOURNAL_STORAGE_KEY);
}

function saveJournalEntries(entries) {
  try {
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('Unable to save journal entries', error);
  }
}

function migrateJournalEntries() {
  try {
    const legacyEntries = loadJournalEntriesFromKey(LEGACY_JOURNAL_KEY);
    if (!legacyEntries.length) {
      localStorage.removeItem(LEGACY_JOURNAL_KEY);
      return;
    }
    const existing = Array.isArray(state.journalEntries) ? [...state.journalEntries] : [];
    const signatures = new Set(
      existing.map((entry) => `${entry.timestamp ?? ''}|${(entry.notes ?? '').trim()}`)
    );
    let changed = false;
    legacyEntries.forEach((legacy) => {
      const normalized = normalizeJournalEntry(legacy);
      if (!normalized) {
        return;
      }
      const signature = `${normalized.timestamp ?? ''}|${normalized.notes.trim()}`;
      if (signatures.has(signature)) {
        return;
      }
      existing.push(normalized);
      signatures.add(signature);
      changed = true;
    });
    if (changed) {
      existing.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      state.journalEntries = existing;
      saveJournalEntries(existing);
    }
    localStorage.removeItem(LEGACY_JOURNAL_KEY);
  } catch (error) {
    console.warn('Unable to migrate journal entries', error);
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
      showFormMessage(message, `Saved “${title}” to your inventory. Visit the inventory page to review it anytime.`, 'success');
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

  if (state.inventoryToggleButton) {
    state.inventoryToggleButton.addEventListener('click', () => {
      setShowStrategies(!state.showStrategies);
    });
  }

  updateStrategiesVisibility();
  updateInventoryToggleLabel();

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
        inventoryMessage: `Added “${title}” to your inventory.`,
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

async function initColorCustomizer() {
  if (!document.body || paletteState.container) {
    return;
  }

  buildPaletteUi();

  const themePreapplied = document.documentElement.getAttribute('data-theme-preapplied') === 'true';
  const computedDefaults = themePreapplied ? {} : sanitizeColorsMap(readComputedColors());
  paletteState.defaultColors = { ...DEFAULT_PALETTE, ...computedDefaults };
  paletteState.currentColors = { ...paletteState.defaultColors };

  const savedTheme = loadSavedTheme();
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
  srLabel.textContent = 'Open color palette customizer';
  toggle.appendChild(srLabel);

  const nav = document.querySelector('.site-nav');
  let mobileToggle = null;
  if (nav) {
    mobileToggle = document.createElement('button');
    mobileToggle.type = 'button';
    mobileToggle.className = 'site-nav__link palette-mobile-toggle';
    mobileToggle.setAttribute('aria-haspopup', 'dialog');
    const mobileGlyph = document.createElement('span');
    mobileGlyph.className = 'palette-mobile-toggle__glyph';
    mobileGlyph.setAttribute('aria-hidden', 'true');
    mobileGlyph.textContent = '+';

    const mobileSrLabel = document.createElement('span');
    mobileSrLabel.className = 'visually-hidden';
    mobileSrLabel.textContent = 'Open color palette customizer';

    mobileToggle.append(mobileGlyph, mobileSrLabel);
    nav.appendChild(mobileToggle);
  }

  toggle.setAttribute('aria-expanded', 'false');
  if (mobileToggle) {
    mobileToggle.setAttribute('aria-expanded', 'false');
  }

  const panel = document.createElement('div');
  panel.className = 'palette-corner__panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Color palette customizer');
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
  title.textContent = 'Color tuner';

  const subtitle = document.createElement('p');
  subtitle.className = 'palette-form__subtitle';
  subtitle.textContent = 'Pick a preset or enter your own hex codes.';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'palette-form__close';
  closeButton.innerHTML = '<span aria-hidden="true">×</span><span class="visually-hidden">Close color palette customizer</span>';
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

  const contrastField = createContrastToggleField();
  if (contrastField) {
    form.appendChild(contrastField);
  }

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

  const actions = document.createElement('div');
  actions.className = 'palette-form__actions';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'palette-form__reset';
  resetButton.setAttribute('data-palette-reset', '');
  resetButton.textContent = 'Reset to default';
  resetButton.addEventListener('click', () => {
    applyColors(paletteState.defaultColors, { presetName: '', replace: true });
  });

  actions.appendChild(resetButton);
  form.appendChild(actions);

  panel.appendChild(form);
  container.append(toggle, panel);
  document.body.appendChild(container);
  document.body.classList.add('has-palette-corner');

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
}

function openPalettePanel() {
  if (!paletteState.panel || !paletteState.toggle) {
    return;
  }

  setPaletteExpanded(true);
  paletteState.container?.classList.add('is-open');
  paletteState.panel.hidden = false;

  const firstInput = paletteState.inputs.values().next().value;
  const shouldAutoFocusInput = !isMobilePaletteLayout();
  window.requestAnimationFrame(() => {
    if (firstInput instanceof HTMLElement && shouldAutoFocusInput) {
      firstInput.focus();
      if (firstInput instanceof HTMLInputElement) {
        firstInput.select();
      }
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
      document.documentElement.style.setProperty(varName, value);
    }
  });

  updatePaletteStyleElement();

  paletteState.currentPreset = presetName || '';
  updateInputsFromState();

  if (paletteState.presetSelect && paletteState.presetSelect.value !== paletteState.currentPreset) {
    paletteState.presetSelect.value = paletteState.currentPreset;
  }

  if (persist) {
    saveTheme({ values: paletteState.currentColors, preset: paletteState.currentPreset });
  }

  scheduleAutoContrast();
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

function saveTheme(theme) {
  if (!theme || typeof theme !== 'object') {
    return;
  }

  const payload = {
    values: sanitizeColorsMap(theme.values || paletteState.currentColors),
    preset: typeof theme.preset === 'string' ? theme.preset : '',
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

function captureNeedsFromForm() {
  const select = document.getElementById('inventory-need');
  if (!select) {
    return;
  }

  const needs = [];
  select.querySelectorAll('option').forEach((option) => {
    const value = option.value;
    if (!value) {
      return;
    }
    const title = option.textContent?.trim() || value;
    needs.push({ slug: value, title });
  });

  state.needs = needs;
  state.needsBySlug = new Map(needs.map((need) => [need.slug, need]));
  populateJournalNeedsOptions();
}

function renderInventoryViews() {
  renderInventorySummary();
  renderInventoryList();
  updateInventoryCount();
  updateStrategiesVisibility();
  updateInventoryToggleLabel();
  renderJournalViews();
}

function setupJournalSection() {
  const panel = document.querySelector('[data-inventory-section="journal"]');
  if (!panel) {
    return;
  }
  state.journalForm = panel.querySelector('[data-journal-form]');
  state.journalStatusEl = panel.querySelector('[data-journal-status]');
  state.journalMessageEl = panel.querySelector('[data-journal-message]');
  state.journalHistoryEl = panel.querySelector('[data-journal-history]');
  state.journalEmptyEl = panel.querySelector('[data-journal-empty]');
  state.journalSummaryEl = panel.querySelector('[data-journal-summary]');
  state.journalSummaryToggle = panel.querySelector('[data-journal-summary-toggle]');
  state.journalFiltersForm = panel.querySelector('[data-journal-filters]');
  state.journalIntensityDisplay = panel.querySelector('[data-journal-intensity-display]');
  state.journalNeedsSelect = panel.querySelector('#journal-needs');

  const intensityInput = panel.querySelector('#journal-intensity');
  if (intensityInput) {
    intensityInput.addEventListener('input', (event) => {
      updateJournalIntensityDisplay(event.target.value);
    });
  }

  if (state.journalForm) {
    state.journalForm.addEventListener('submit', handleJournalFormSubmit);
  }
  const journalClear = panel.querySelector('[data-journal-clear]');
  journalClear?.addEventListener('click', handleJournalFormClear);

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
  updateJournalIntensityDisplay(intensityInput?.value || '5');
  updateJournalSummaryVisibility();
}

function populateJournalNeedsOptions() {
  const select = state.journalNeedsSelect;
  if (!select) {
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
  updateJournalSummaryVisibility();
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
  if (!state.journalIntensityDisplay) {
    return;
  }
  const numeric = Number(value);
  const displayValue = Number.isFinite(numeric) ? Math.min(10, Math.max(1, Math.round(numeric))) : 5;
  state.journalIntensityDisplay.textContent = `${displayValue}/10`;
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
    date.textContent = formatJournalDate(entry.timestamp);
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

function getFilteredJournalEntries() {
  const entries = Array.isArray(state.journalEntries) ? [...state.journalEntries] : [];
  const searchTerm = state.journalFilters.search?.trim().toLowerCase();
  const tagFilter = state.journalFilters.tag?.trim().toLowerCase();
  const sort = state.journalFilters.sort || 'newest';

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

  const sortByTimestamp = (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  if (sort === 'oldest') {
    filtered.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
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
  if (!state.journalStatusEl) {
    return;
  }
  state.journalStatusEl.textContent = message || '';
}

function showJournalMessage(message, type = 'success') {
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

function handleJournalFormSubmit(event) {
  event.preventDefault();
  if (!state.journalForm) {
    return;
  }
  const formData = new FormData(state.journalForm);
  const emotion = (formData.get('emotion') || '').toString().trim();
  const intensityValue = Number(formData.get('intensity'));
  const needs = state.journalNeedsSelect
    ? Array.from(state.journalNeedsSelect.selectedOptions || []).map((option) => option.value).filter(Boolean)
    : [];
  const tagsInput = (formData.get('tags') || '').toString();
  const tags = tagsInput
    .split(',')
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter(Boolean);
  const notes = (formData.get('notes') || '').toString().trim();

  if (!notes && !emotion) {
    showJournalStatus('Add a few words or an emotion before saving.');
    return;
  }

  const entry = normalizeJournalEntry({
    id: generateJournalId(),
    emotion,
    intensity: Number.isFinite(intensityValue) ? intensityValue : null,
    needs,
    tags,
    notes,
    timestamp: new Date().toISOString(),
  });

  const nextEntries = [entry, ...state.journalEntries];
  persistJournalEntries(nextEntries, {
    status: 'Saved entry. It stays on this device until you export it.',
  });
  showJournalMessage('');
  state.journalForm.reset();
  const intensityInput = state.journalForm.querySelector('#journal-intensity');
  if (intensityInput) {
    intensityInput.value = '5';
  }
  updateJournalIntensityDisplay('5');
}

function handleJournalFormClear() {
  if (!state.journalForm) {
    return;
  }
  state.journalForm.reset();
  updateJournalIntensityDisplay('5');
  showJournalStatus('');
}

function handleJournalHistoryClick(event) {
  const deleteButton = event.target.closest('[data-journal-action="delete"]');
  if (!deleteButton) {
    return;
  }
  const journalId = deleteButton.dataset.journalId;
  if (!journalId) {
    return;
  }
  const entry = state.journalEntries.find((item) => item.id === journalId);
  if (!entry) {
    return;
  }
  const confirmed = window.confirm('Delete this journal entry? This cannot be undone.');
  if (!confirmed) {
    return;
  }
  const nextEntries = state.journalEntries.filter((item) => item.id !== journalId);
  persistJournalEntries(nextEntries, { status: 'Entry deleted.' });
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
  };
  renderJournalHistory();
}

function handleJournalFiltersReset() {
  if (!state.journalFiltersForm) {
    return;
  }
  state.journalFiltersForm.reset();
  state.journalFilters = { search: '', tag: '', sort: 'newest' };
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
    const normalized = list.map((item) => normalizeJournalEntry(item)).filter(Boolean);
    if (!normalized.length) {
      showJournalMessage('No valid entries found in the import file.', 'warning');
      return;
    }
    const merged = mergeJournalEntriesList(state.journalEntries, normalized);
    persistJournalEntries(merged, {
      status: `Imported ${normalized.length} ${normalized.length === 1 ? 'entry' : 'entries'}.`,
      message: 'Import complete. Entries stay on this device unless you export them.',
    });
  } catch (error) {
    console.warn('Unable to import journal entries', error);
    showJournalMessage('Import failed. Make sure you selected a JSON export from this app.', 'error');
  }
}

function mergeJournalEntriesList(existing, additions) {
  const merged = new Map();
  const signatureSet = new Set();
  const addEntry = (entry) => {
    const normalized = normalizeJournalEntry(entry);
    if (!normalized) {
      return;
    }
    const signature = `${normalized.timestamp ?? ''}|${(normalized.notes ?? '').trim()}`;
    if (signature && signatureSet.has(signature)) {
      return;
    }
    if (merged.has(normalized.id)) {
      return;
    }
    merged.set(normalized.id, normalized);
    signatureSet.add(signature);
  };
  (existing || []).forEach(addEntry);
  (additions || []).forEach(addEntry);
  return Array.from(merged.values()).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
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
  if (entry.needSlug) {
    return entry.needSlug;
  }
  if (Array.isArray(entry.tags)) {
    const match = entry.tags.find((tag) => state.needsBySlug.has(tag));
    if (match) {
      return match;
    }
  }
  return null;
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

function persistJournalEntries(entries, options = {}) {
  const normalized = Array.isArray(entries)
    ? entries.map((entry) => normalizeJournalEntry(entry)).filter(Boolean)
    : [];
  normalized.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  state.journalEntries = normalized;
  saveJournalEntries(normalized);
  renderJournalViews();
  if (options.status) {
    showJournalStatus(options.status);
  }
  if (options.message) {
    showJournalMessage(options.message, options.messageType || 'success');
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

function generateJournalId() {
  return `journal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
