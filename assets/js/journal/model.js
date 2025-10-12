export const emptyEntry = () => ({
  id: (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `journal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`),
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
  source: 'lane',
});

const attachToGlobal = () => {
  if (typeof window === 'undefined') {
    return;
  }
  if (!window.NVCJournal) {
    window.NVCJournal = {};
  }
  window.NVCJournal.emptyEntry = emptyEntry;
};

attachToGlobal();

export default emptyEntry;
