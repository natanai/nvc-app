const MOBILE_QUERY = '(max-width: 640px)';
const MATCH_UPDATE_SETTLE_MS = 180;

function ready(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initMobileBodyCues() {
  const root = document.querySelector('[data-body-cues-root]');
  if (!root) {
    return;
  }

  const summaryPanel = root.querySelector('.body-cues-tool__summary-panel');
  const magnetContainer = root.querySelector('[data-body-cues-magnets]');
  if (!summaryPanel || !magnetContainer) {
    return;
  }

  const media = window.matchMedia(MOBILE_QUERY);
  let resetFrame = null;
  let settleTimer = null;
  let toggleObserver = null;
  let toggleSearchObserver = null;

  function isMobile() {
    return media.matches;
  }

  function resetShelfScroll() {
    if (!isMobile() || summaryPanel.dataset.pinned !== 'true') {
      return;
    }
    if (resetFrame !== null) {
      window.cancelAnimationFrame(resetFrame);
    }
    resetFrame = window.requestAnimationFrame(() => {
      resetFrame = null;
      magnetContainer.scrollLeft = 0;
    });
  }

  function scheduleSettledReset() {
    resetShelfScroll();
    if (settleTimer !== null) {
      window.clearTimeout(settleTimer);
    }
    settleTimer = window.setTimeout(() => {
      settleTimer = null;
      resetShelfScroll();
    }, MATCH_UPDATE_SETTLE_MS);
  }

  function ensureAllMobileResults(toggle) {
    if (!isMobile() || !toggle || magnetContainer.dataset.empty === 'true') {
      return;
    }
    if (toggle.getAttribute('aria-expanded') !== 'true' && !toggle.hidden) {
      toggle.click();
    }
  }

  function connectResultToggle(toggle) {
    if (!toggle || toggle.dataset.mobileBodyCuesConnected === 'true') {
      return Boolean(toggle);
    }

    toggle.dataset.mobileBodyCuesConnected = 'true';
    ensureAllMobileResults(toggle);

    toggleObserver = new MutationObserver(() => {
      ensureAllMobileResults(toggle);
    });
    toggleObserver.observe(toggle, {
      attributes: true,
      attributeFilter: ['hidden', 'aria-expanded'],
    });
    return true;
  }

  const existingToggle = root.querySelector('.body-cues-tool__result-toggle');
  if (!connectResultToggle(existingToggle)) {
    toggleSearchObserver = new MutationObserver(() => {
      const toggle = root.querySelector('.body-cues-tool__result-toggle');
      if (!toggle) {
        return;
      }
      connectResultToggle(toggle);
      toggleSearchObserver.disconnect();
      toggleSearchObserver = null;
    });
    toggleSearchObserver.observe(root, { childList: true, subtree: true });
  }

  const resultsObserver = new MutationObserver(() => {
    const toggle = root.querySelector('.body-cues-tool__result-toggle');
    ensureAllMobileResults(toggle);
    resetShelfScroll();
  });
  resultsObserver.observe(magnetContainer, {
    childList: true,
    attributes: true,
    attributeFilter: ['data-empty'],
  });

  root.addEventListener('input', (event) => {
    if (event.target instanceof Element && event.target.matches('.body-cues-tool__slider')) {
      scheduleSettledReset();
    }
  });

  root.addEventListener('change', (event) => {
    if (event.target instanceof Element && event.target.matches('.body-cues-tool__slider')) {
      scheduleSettledReset();
    }
  });

  const handleViewportChange = () => {
    const toggle = root.querySelector('.body-cues-tool__result-toggle');
    ensureAllMobileResults(toggle);
    resetShelfScroll();
  };

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handleViewportChange);
  } else if (typeof media.addListener === 'function') {
    media.addListener(handleViewportChange);
  }
}

ready(initMobileBodyCues);
