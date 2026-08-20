(function () {
  const STRATEGY_NOTICE = 'Backup, restore, and account sync are in Menu → Account & data.';

  function normalizeStrategyNotices(root = document) {
    root.querySelectorAll?.('.strategy-form__notice').forEach((notice) => {
      notice.textContent = STRATEGY_NOTICE;
    });
  }

  function normalizeStrategyActionLabels(root = document) {
    root.querySelectorAll?.('button').forEach((button) => {
      const label = (button.textContent || '').trim();
      if (/^💾\s*save to device$/iu.test(label)) {
        button.textContent = 'Save to device';
      } else if (/^☁️?\s*save to profile$/iu.test(label)) {
        button.textContent = 'Save to profile';
      }
    });
  }

  function polish(root = document) {
    normalizeStrategyNotices(root);
    normalizeStrategyActionLabels(root);
  }

  function start() {
    polish(document);
    if (!document.body || typeof MutationObserver !== 'function') return;

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes || []) {
          if (!(node instanceof Element)) continue;
          polish(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
