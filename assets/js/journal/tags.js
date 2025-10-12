import { allTagsRecent } from './store.js';

const DEFAULT_LIMIT = 8;

export function getSuggestions(inputValue = '', options = {}) {
  const { limit = DEFAULT_LIMIT } = options || {};
  const normalizedInput = typeof inputValue === 'string' ? inputValue.trim().toLowerCase() : '';
  const budget = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT;
  const recent = allTagsRecent(Math.max(budget * 3, budget));
  if (!normalizedInput) {
    return recent.slice(0, budget);
  }
  const seen = new Set();
  const matches = [];
  recent.forEach((tag) => {
    if (typeof tag !== 'string') {
      return;
    }
    const trimmed = tag.trim();
    if (!trimmed) {
      return;
    }
    const lower = trimmed.toLowerCase();
    if (!lower.startsWith(normalizedInput)) {
      return;
    }
    if (seen.has(lower)) {
      return;
    }
    seen.add(lower);
    matches.push(trimmed);
  });
  return matches.slice(0, budget);
}

const attachToGlobal = () => {
  if (typeof window === 'undefined') {
    return;
  }
  if (!window.NVCJournalTags) {
    window.NVCJournalTags = {};
  }
  window.NVCJournalTags.getSuggestions = getSuggestions;
};

attachToGlobal();

export default { getSuggestions };
