(function () {
  const footer = document.querySelector('[data-footer]');
  if (!footer) return;

  const btnBack = footer.querySelector('[data-footer-back]');
  const btnSkip = footer.querySelector('[data-footer-skip]');
  const btnNext = footer.querySelector('[data-footer-next]');

  const page = document.querySelector('main') || document.body;
  const VIS_ROOT_MARGIN = '0px 0px -30% 0px';
  let keyboardOpen = false;

  function clickInline(sel) {
    const el =
      document.querySelector('.step-current ' + sel) ||
      document.querySelector(sel);
    if (el) {
      el.click();
    }
  }

  btnBack?.addEventListener('click', () => clickInline('[data-step-back]'));
  btnSkip?.addEventListener('click', () => clickInline('[data-step-skip]'));
  btnNext?.addEventListener('click', () => clickInline('[data-step-next]'));

  const io = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (entry.isIntersecting) {
        footer.removeAttribute('data-visible');
        footer.setAttribute('aria-hidden', 'true');
        page.classList.remove('has-footer-padding');
      } else {
        footer.setAttribute('data-visible', '1');
        footer.setAttribute('aria-hidden', 'false');
        page.classList.add('has-footer-padding');
        if (keyboardOpen) {
          page.setAttribute('data-peek', '1');
        } else {
          page.removeAttribute('data-peek');
        }
      }
    },
    { rootMargin: VIS_ROOT_MARGIN, threshold: 0.01 }
  );

  function observeCurrentCTA() {
    io.disconnect();
    const cta =
      document.querySelector('.step-current [data-step-cta]') ||
      document.querySelector('[data-step-cta]');
    if (cta) {
      io.observe(cta);
    }
  }

  window.addEventListener('lane:stepchange', observeCurrentCTA);

  const mo = new MutationObserver(observeCurrentCTA);
  mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });

  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (target && (target.matches('input, textarea, [contenteditable]'))) {
      keyboardOpen = true;
      footer.setAttribute('data-peek', '1');
      page.setAttribute('data-peek', '1');
      positionAboveKeyboard();
    }
  });

  document.addEventListener('focusout', () => {
    keyboardOpen = false;
    footer.removeAttribute('data-peek');
    page.removeAttribute('data-peek');
    setTimeout(observeCurrentCTA, 200);
  });

  function positionAboveKeyboard() {
    if (!window.visualViewport) return;
    const vv = window.visualViewport;
    const bump = Math.max(0, window.innerHeight - vv.height - 8);
    footer.style.bottom = `calc(${12 + bump}px + env(safe-area-inset-bottom))`;
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (keyboardOpen) {
        positionAboveKeyboard();
      } else {
        footer.style.removeProperty('bottom');
      }
    });
  }

  let scrollTimer = null;
  window.addEventListener(
    'scroll',
    () => {
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }
      scrollTimer = setTimeout(observeCurrentCTA, 120);
    },
    { passive: true }
  );

  observeCurrentCTA();
})();
