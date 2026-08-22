(() => {
  const LEGACY_JOURNAL_HASHES = new Set(['#journal-dashboard']);

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
})();
