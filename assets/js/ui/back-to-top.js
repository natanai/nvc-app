(function () {
  const SCROLL_OFFSET = 800;
  const BOTTOM_BUFFER = 200;

  function init() {
    const button = document.querySelector('[data-back-to-top]');
    if (!button) {
      return;
    }

    const main = document.getElementById('main');
    const heading = main ? main.querySelector('.page-title') : null;
    if (!heading) {
      return;
    }

    const prefersReducedMotion = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

    const toggleVisibility = () => {
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const docHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
      const distanceFromBottom = docHeight - (scrollY + viewportHeight);
      const shouldShow = scrollY > SCROLL_OFFSET && distanceFromBottom > BOTTOM_BUFFER;

      if (shouldShow) {
        button.removeAttribute('hidden');
      } else if (!button.hasAttribute('hidden')) {
        button.setAttribute('hidden', '');
      }
    };

    button.addEventListener('click', () => {
      if (typeof heading.scrollIntoView === 'function') {
        heading.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      }
    });

    const handleScroll = () => {
      window.requestAnimationFrame(toggleVisibility);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    toggleVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
