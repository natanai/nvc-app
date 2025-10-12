import store, { loadDraft, saveDraft, clearDraft } from './store.js';
import { getSuggestions as getTagSuggestions } from './tags.js';

const DEFAULT_INTENSITY = 5;
const DEFAULT_TAG_LIMIT = 8;
const MESSAGE_CLASSES = ['journal-message--success', 'journal-message--warning', 'journal-message--error'];
const DRAFT_DELAY_MS = 900;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeNumber = (value, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return undefined;
  }
  return clamp(Math.round(number), min, max);
};

const normalizeList = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item.trim() : String(item))).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeTags = (value) => {
  const base = normalizeList(value);
  const seen = new Set();
  const result = [];
  base.forEach((tag) => {
    const trimmed = tag.replace(/^#/, '').trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(trimmed);
  });
  return result;
};

const joinTags = (tags, { trailing = false } = {}) => {
  const list = Array.isArray(tags) ? tags.filter(Boolean) : [];
  if (!list.length) {
    return '';
  }
  const joined = list.join(', ');
  return trailing ? `${joined}, ` : joined;
};

const getTagFragment = (value) => {
  if (!value) {
    return '';
  }
  const segments = value.split(',');
  const fragment = segments[segments.length - 1] || '';
  return fragment.replace(/^#/, '').trim();
};

function resolveStore() {
  if (store) {
    return store;
  }
  if (typeof window !== 'undefined') {
    return window.NVCJournalStore || window.NVCJournal?.store || null;
  }
  return null;
}

function parseJsonScript(selector) {
  const script = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!script) {
    return null;
  }
  try {
    const text = script.textContent || script.innerText || '';
    if (!text) {
      return null;
    }
    return JSON.parse(text);
  } catch (error) {
    console.warn('Journal module: unable to parse JSON script', error);
    return null;
  }
}

class JournalFormController {
  constructor(root, options = {}) {
    this.root = root instanceof HTMLElement ? root : document.querySelector(root);
    if (!this.root) {
      throw new Error('JournalFormController requires a valid root element');
    }
    this.options = {
      needs: [],
      draftPath: typeof window !== 'undefined' ? window.location.pathname : '',
      draftDelay: DRAFT_DELAY_MS,
      tagLimit: DEFAULT_TAG_LIMIT,
      autoDraft: true,
      intensityRange: { min: 0, max: 10 },
      ...options,
    };

    this.store = this.options.store || resolveStore();

    this.formEl = this.root.querySelector('[data-journal-form]');
    this.statusEl = this.root.querySelector('[data-journal-status]');
    this.messageEl = this.root.querySelector('[data-journal-message]');
    this.needsSelect = this.root.querySelector('[data-journal-needs]');
    this.emotionInput = this.root.querySelector('[data-journal-emotion]');
    this.intensityInput = this.root.querySelector('[data-journal-intensity]');
    this.intensityDisplay = this.root.querySelector('[data-journal-intensity-display]');
    this.tagsInput = this.root.querySelector('[data-journal-tags]');
    this.tagSuggestionsEl = this.root.querySelector('[data-journal-tag-suggestions]');
    this.notesInput = this.root.querySelector('[data-journal-notes]');
    this.clearButton = this.root.querySelector('[data-journal-clear]');
    this.saveButton = this.root.querySelector('[data-journal-submit]');

    this.draftPath = this.options.draftPath;
    this.draftTimer = null;
    this.tagSuggestions = [];
    this.tagActiveIndex = -1;
    this.defaultIntensity = normalizeNumber(
      this.intensityInput?.value,
      this.options.intensityRange.min,
      this.options.intensityRange.max,
    );
    if (this.defaultIntensity === undefined) {
      this.defaultIntensity = DEFAULT_INTENSITY;
    }

    this.defaultSaveLabel = this.saveButton?.textContent?.trim() || 'Save entry';
    if (this.saveButton) {
      this.saveButton.dataset.defaultLabel = this.defaultSaveLabel;
    }

    this.attachEvents();
    this.setNeedsOptions(this.options.needs);
    this.refreshTagSource();
    this.updateIntensityDisplay(
      normalizeNumber(this.intensityInput?.value, this.options.intensityRange.min, this.options.intensityRange.max) ??
        this.defaultIntensity,
    );
    if (this.options.autoDraft) {
      this.applyDraft();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener(
        'nvc-journal-store-ready',
        (event) => {
          if (event?.detail) {
            this.store = event.detail;
            this.refreshTagSource();
            if (this.options.autoDraft) {
              this.applyDraft();
            }
          }
        },
        { once: true },
      );
    }
  }

  get form() {
    return this.formEl;
  }

  attachEvents() {
    if (this.intensityInput) {
      this.intensityInput.addEventListener('input', (event) => {
        const value = normalizeNumber(
          event.target.value,
          this.options.intensityRange.min,
          this.options.intensityRange.max,
        );
        if (value !== undefined) {
          this.updateIntensityDisplay(value);
        }
        this.scheduleDraftSave();
      });
    }

    if (this.tagsInput) {
      this.tagsInput.setAttribute('role', 'combobox');
      this.tagsInput.setAttribute('aria-autocomplete', 'list');
      this.tagsInput.setAttribute('aria-expanded', 'false');
      this.tagsInput.addEventListener('input', () => {
        this.resetSaveButton();
        this.scheduleDraftSave();
        this.updateTagSuggestions();
      });
      this.tagsInput.addEventListener('focus', () => {
        this.updateTagSuggestions();
      });
      this.tagsInput.addEventListener('blur', () => {
        this.hideTagSuggestions();
      });
      this.tagsInput.addEventListener('keydown', (event) => {
        this.handleTagKeydown(event);
      });
    }

    if (this.tagSuggestionsEl) {
      this.tagSuggestionsEl.addEventListener('mousedown', (event) => event.preventDefault());
      this.tagSuggestionsEl.addEventListener('mousemove', (event) => this.handleTagSuggestionMouseOver(event));
      this.tagSuggestionsEl.addEventListener('click', (event) => this.handleTagSuggestionClick(event));
    }

    if (this.notesInput) {
      this.notesInput.addEventListener('input', () => {
        this.resetSaveButton();
        this.scheduleDraftSave();
      });
    }

    if (this.emotionInput) {
      this.emotionInput.addEventListener('input', () => {
        this.resetSaveButton();
        this.scheduleDraftSave();
      });
    }

    if (this.needsSelect) {
      this.needsSelect.addEventListener('change', () => {
        this.resetSaveButton();
        this.scheduleDraftSave();
      });
    }

    if (this.clearButton) {
      this.clearButton.addEventListener('click', (event) => {
        event.preventDefault();
        this.resetForm();
      });
    }
  }

  refreshTagSource() {
    const storeInstance = this.store || resolveStore();
    if (!storeInstance) {
      this.tagSuggestions = [];
      return;
    }
    if (typeof storeInstance.allTagsRecent === 'function') {
      this.tagSuggestions = storeInstance.allTagsRecent(Math.max(this.options.tagLimit * 3, this.options.tagLimit));
    } else {
      this.tagSuggestions = [];
    }
  }

  updateIntensityDisplay(value) {
    if (!this.intensityDisplay) {
      return;
    }
    const clamped = clamp(value ?? this.defaultIntensity, this.options.intensityRange.min, this.options.intensityRange.max);
    this.intensityDisplay.textContent = `${clamped}/10`;
  }

  collectData() {
    const emotion = this.emotionInput?.value?.trim() || '';
    const intensityValue = normalizeNumber(
      this.intensityInput?.value,
      this.options.intensityRange.min,
      this.options.intensityRange.max,
    );
    const needs = this.needsSelect
      ? Array.from(this.needsSelect.selectedOptions || [])
          .map((option) => option.value)
          .filter(Boolean)
      : [];
    const tags = this.tagsInput ? normalizeTags(this.tagsInput.value) : [];
    const notes = this.notesInput?.value?.trim() || '';
    return { emotion, intensity: intensityValue, needs, tags, notes };
  }

  setValues(values = {}, { trailingTags = false } = {}) {
    const data = values && typeof values === 'object' ? values : {};
    if (this.emotionInput) {
      this.emotionInput.value = data.emotion || '';
    }
    if (this.notesInput) {
      this.notesInput.value = data.notes || '';
    }
    if (this.intensityInput) {
      const intensityValue = normalizeNumber(
        data.intensity,
        this.options.intensityRange.min,
        this.options.intensityRange.max,
      );
      this.intensityInput.value = intensityValue !== undefined ? String(intensityValue) : String(this.defaultIntensity);
      this.updateIntensityDisplay(intensityValue ?? this.defaultIntensity);
    }
    if (this.needsSelect) {
      const needs = normalizeList(data.needs);
      Array.from(this.needsSelect.options).forEach((option) => {
        option.selected = needs.includes(option.value);
      });
    }
    if (this.tagsInput) {
      const tags = normalizeTags(data.tags);
      this.tagsInput.value = joinTags(tags, { trailing: trailingTags });
      this.updateTagSuggestions();
    }
  }

  resetForm() {
    if (this.formEl) {
      this.formEl.reset();
    }
    if (this.intensityInput) {
      this.intensityInput.value = String(this.defaultIntensity);
    }
    this.updateIntensityDisplay(this.defaultIntensity);
    if (this.tagsInput) {
      this.tagsInput.value = '';
    }
    if (this.needsSelect) {
      Array.from(this.needsSelect.options).forEach((option) => {
        option.selected = false;
      });
    }
    this.resetSaveButton();
    this.hideTagSuggestions();
    if (this.statusEl) {
      this.statusEl.textContent = '';
    }
    this.showMessage('');
    if (this.options.autoDraft) {
      this.clearDraft();
    }
    if (this.notesInput) {
      this.notesInput.focus();
    }
  }

  setNeedsOptions(needs = []) {
    if (!this.needsSelect) {
      return;
    }
    const list = Array.isArray(needs) ? needs : [];
    const currentValues = new Set(Array.from(this.needsSelect.selectedOptions || []).map((option) => option.value));
    this.needsSelect.innerHTML = '';
    list.forEach((need) => {
      if (!need || typeof need !== 'object') {
        return;
      }
      const value = need.slug || need.value || '';
      if (!value) {
        return;
      }
      const label = need.title || need.label || value;
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      if (currentValues.has(value)) {
        option.selected = true;
      }
      this.needsSelect.append(option);
    });
  }

  showStatus(message = '') {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.textContent = message;
  }

  showMessage(message = '', type = '') {
    if (!this.messageEl) {
      return;
    }
    this.messageEl.textContent = message;
    if (!message) {
      this.messageEl.hidden = true;
      MESSAGE_CLASSES.forEach((className) => this.messageEl.classList.remove(className));
      return;
    }
    this.messageEl.hidden = false;
    MESSAGE_CLASSES.forEach((className) => this.messageEl.classList.remove(className));
    if (type && MESSAGE_CLASSES.includes(`journal-message--${type}`)) {
      this.messageEl.classList.add(`journal-message--${type}`);
    } else if (type === 'success' || type === 'warning' || type === 'error') {
      this.messageEl.classList.add(`journal-message--${type}`);
    }
  }

  resetSaveButton() {
    if (!this.saveButton) {
      return;
    }
    const label = this.defaultSaveLabel || this.saveButton.dataset.defaultLabel || this.saveButton.textContent || 'Save entry';
    this.saveButton.textContent = label;
    this.saveButton.disabled = false;
    this.saveButton.removeAttribute('aria-disabled');
  }

  markSaving(label = 'Saving…') {
    if (!this.saveButton) {
      return;
    }
    this.saveButton.textContent = label;
    this.saveButton.disabled = true;
    this.saveButton.setAttribute('aria-disabled', 'true');
  }

  markSaved(label = 'Saved ✓', resetDelay = 2000) {
    if (!this.saveButton) {
      return;
    }
    this.saveButton.textContent = label;
    this.saveButton.disabled = true;
    this.saveButton.setAttribute('aria-disabled', 'true');
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.resetSaveButton();
    }, resetDelay);
  }

  scheduleDraftSave() {
    if (!this.options.autoDraft) {
      return;
    }
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
    }
    this.draftTimer = setTimeout(() => {
      this.persistDraft();
    }, this.options.draftDelay);
  }

  persistDraft() {
    if (!this.options.autoDraft || !this.draftPath) {
      return;
    }
    const storeInstance = this.store || resolveStore();
    if (!storeInstance) {
      return;
    }
    try {
      const data = this.collectData();
      const meaningful = data.emotion || data.notes || data.tags.length || data.needs.length;
      if (!meaningful) {
        clearDraft(this.draftPath);
        return;
      }
      saveDraft(this.draftPath, data);
    } catch (error) {
      console.warn('Journal module: unable to persist draft', error);
    }
  }

  applyDraft() {
    if (!this.options.autoDraft || !this.draftPath) {
      return;
    }
    try {
      const data = loadDraft(this.draftPath);
      if (data && typeof data === 'object') {
        this.setValues(data, { trailingTags: true });
      }
    } catch (error) {
      console.warn('Journal module: unable to apply draft', error);
    }
  }

  clearDraft() {
    if (!this.draftPath) {
      return;
    }
    try {
      clearDraft(this.draftPath);
    } catch (error) {
      console.warn('Journal module: unable to clear draft', error);
    }
  }

  focusNotes() {
    if (this.notesInput) {
      this.notesInput.focus();
    }
  }

  updateTagSuggestions() {
    if (!this.tagSuggestionsEl || !this.tagsInput) {
      return;
    }
    const fragment = getTagFragment(this.tagsInput.value || '');
    let suggestions = [];
    if (fragment) {
      suggestions = getTagSuggestions(fragment, { limit: this.options.tagLimit });
    } else {
      suggestions = (this.tagSuggestions || []).slice(0, this.options.tagLimit);
    }
    const unique = [];
    const seen = new Set();
    suggestions.forEach((tag) => {
      const normalized = typeof tag === 'string' ? tag.trim() : '';
      if (!normalized) {
        return;
      }
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      unique.push(normalized);
    });
    if (!unique.length) {
      this.hideTagSuggestions();
      return;
    }
    this.tagSuggestionsEl.innerHTML = '';
    unique.forEach((tag, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'journal-tag-suggestions__option';
      button.textContent = tag;
      button.dataset.journalTagSuggestion = tag;
      button.setAttribute('role', 'option');
      button.setAttribute('data-index', String(index));
      this.tagSuggestionsEl.append(button);
    });
    this.tagSuggestionsEl.hidden = false;
    this.tagsInput.setAttribute('aria-expanded', 'true');
    this.tagActiveIndex = -1;
  }

  hideTagSuggestions() {
    if (!this.tagSuggestionsEl || !this.tagsInput) {
      return;
    }
    this.tagSuggestionsEl.hidden = true;
    this.tagSuggestionsEl.innerHTML = '';
    this.tagsInput.setAttribute('aria-expanded', 'false');
    this.tagActiveIndex = -1;
  }

  handleTagSuggestionMouseOver(event) {
    const button = event.target.closest('[data-journal-tag-suggestion]');
    if (!button) {
      return;
    }
    const index = Number(button.dataset.index);
    if (Number.isFinite(index)) {
      this.tagActiveIndex = index;
      this.highlightActiveTag();
    }
  }

  highlightActiveTag() {
    if (!this.tagSuggestionsEl) {
      return;
    }
    const buttons = this.tagSuggestionsEl.querySelectorAll('[data-journal-tag-suggestion]');
    buttons.forEach((button, index) => {
      if (index === this.tagActiveIndex) {
        button.classList.add('is-active');
      } else {
        button.classList.remove('is-active');
      }
    });
  }

  handleTagSuggestionClick(event) {
    const button = event.target.closest('[data-journal-tag-suggestion]');
    if (!button) {
      return;
    }
    const value = button.dataset.journalTagSuggestion;
    if (value) {
      this.applyTagSuggestion(value);
    }
  }

  handleTagKeydown(event) {
    if (!this.tagSuggestionsEl || this.tagSuggestionsEl.hidden) {
      return;
    }
    const buttons = this.tagSuggestionsEl.querySelectorAll('[data-journal-tag-suggestion]');
    if (!buttons.length) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      this.tagActiveIndex = (this.tagActiveIndex + direction + buttons.length) % buttons.length;
      this.highlightActiveTag();
    } else if ((event.key === 'Enter' || event.key === 'Tab') && this.tagActiveIndex >= 0) {
      event.preventDefault();
      const button = buttons[this.tagActiveIndex];
      if (button) {
        this.applyTagSuggestion(button.dataset.journalTagSuggestion || '');
      }
    } else if (event.key === 'Escape') {
      this.hideTagSuggestions();
    }
  }

  applyTagSuggestion(value) {
    if (!this.tagsInput) {
      return;
    }
    const current = this.tagsInput.value || '';
    const segments = current.split(',');
    segments[segments.length - 1] = ` ${value}`;
    const normalized = segments.join(',').replace(/^\s+/, '');
    this.tagsInput.value = `${normalized.trim()}, `;
    this.hideTagSuggestions();
    this.tagsInput.focus();
    this.scheduleDraftSave();
  }
}

export function createJournalForm(root, options = {}) {
  return new JournalFormController(root, options);
}

export function loadNeedsFromScript(selector = '#journal-needs-data') {
  return parseJsonScript(selector) || [];
}

const attachToGlobal = () => {
  if (typeof window === 'undefined') {
    return;
  }
  if (!window.NVCJournal) {
    window.NVCJournal = {};
  }
  window.NVCJournal.createForm = createJournalForm;
  window.NVCJournal.loadNeedsFromScript = loadNeedsFromScript;
  window.NVCJournal.normalizeJournalTags = normalizeTags;
  window.NVCJournal.joinJournalTags = joinTags;
};

attachToGlobal();

export default {
  createForm: createJournalForm,
  loadNeedsFromScript,
  normalizeJournalTags: normalizeTags,
  joinJournalTags: joinTags,
};
