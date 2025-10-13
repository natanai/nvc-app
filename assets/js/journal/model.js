const hasSecureUUID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';

const fallbackUUID = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 || 0;
    const value = char === 'x' ? Math.floor(random) : (Math.floor(random) & 0x3) | 0x8;
    return value.toString(16);
  });

const createId = () => {
  try {
    if (hasSecureUUID) {
      return crypto.randomUUID();
    }
  } catch (error) {
    // Ignore crypto errors and fall back to a deterministic helper.
  }
  return fallbackUUID();
};

export const makeEntry = (overrides = {}) => ({
  id: createId(),
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
  ...overrides,
});

const attachToGlobal = () => {
  if (typeof window === 'undefined') {
    return;
  }
  if (!window.NVCJournal) {
    window.NVCJournal = {};
  }
  window.NVCJournal.makeEntry = makeEntry;
};

attachToGlobal();

export default makeEntry;
