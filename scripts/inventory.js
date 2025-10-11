const STORAGE_KEY = 'nvcApp.inventory';
const THEME_STORAGE_KEY = 'nvcApp.theme';

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
};

const SECTION_ALIASES = new Map([
  ['/alexithymia-support/', '/feelings/'],
]);

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

document.addEventListener('DOMContentLoaded', () => {
  state.basePath = document.body?.dataset?.basePath || '';
  state.inventory = loadInventory();
  highlightNavigation();
  initColorCustomizer().catch((error) => {
    console.warn('Unable to set up the color customizer', error);
  });
  updateInventoryCount();
  setupNeedPage();
  setupInventoryPage();
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

  paletteState.defaultColors = sanitizeColorsMap(readComputedColors());
  paletteState.currentColors = { ...paletteState.defaultColors };

  const savedTheme = loadSavedTheme();
  if (savedTheme?.values && Object.keys(savedTheme.values).length) {
    applyColors(savedTheme.values, { presetName: savedTheme.preset || '', persist: false, replace: true });
  } else {
    applyColors(paletteState.currentColors, { persist: false, replace: true });
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

function applyColors(colors, options = {}) {
  const { presetName = '', persist = true, replace = false } = options;

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
    if (value) {
      document.documentElement.style.setProperty(varName, value);
    }
  });

  paletteState.currentPreset = presetName || '';
  updateInputsFromState();

  if (paletteState.presetSelect && paletteState.presetSelect.value !== paletteState.currentPreset) {
    paletteState.presetSelect.value = paletteState.currentPreset;
  }

  if (persist) {
    saveTheme({ values: paletteState.currentColors, preset: paletteState.currentPreset });
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
}

function renderInventoryViews() {
  renderInventorySummary();
  renderInventoryList();
  updateInventoryCount();
  updateStrategiesVisibility();
  updateInventoryToggleLabel();
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
