(function () {
  const CAROUSEL_SELECTOR = '[data-strategy-carousel]';
  const VIEWPORT_SELECTOR = '[data-strategy-carousel-viewport]';
  const TRACK_SELECTOR = '[data-strategy-carousel-track]';
  const SHUFFLE_SELECTOR = '[data-strategy-shuffle]';
  const PREV_SELECTOR = '[data-strategy-prev]';
  const NEXT_SELECTOR = '[data-strategy-next]';
  const MIN_CARD_WIDTH = 320;

  function shuffleArray(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function getGapPx(element) {
    if (!element) return 0;
    const style = window.getComputedStyle(element);
    const gapValue = style.columnGap || style.gap || '0';
    const parsed = Number.parseFloat(gapValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function updatePerView(carousel, viewport, track) {
    if (!viewport || !track) return 1;
    const viewportWidth = viewport.clientWidth || viewport.offsetWidth || 1;
    const perView = Math.max(1, Math.floor(viewportWidth / MIN_CARD_WIDTH));
    track.style.setProperty('--strategy-cards-per-view', String(perView));
    return perView;
  }

  function scrollByStep(direction, viewport, track) {
    if (!viewport || !track) return;
    const perView = Math.max(
      1,
      Number.parseInt(track.style.getPropertyValue('--strategy-cards-per-view'), 10) || 1,
    );
    const firstCard = track.querySelector('.strategy-card');
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : viewport.clientWidth;
    const gap = getGapPx(track);
    const step = cardWidth * perView + gap * Math.max(0, perView - 1);
    viewport.scrollBy({ left: step * direction, behavior: 'smooth' });
  }

  function updateNavState(viewport, prevButton, nextButton) {
    if (!viewport || (!prevButton && !nextButton)) {
      return;
    }

    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    const atStart = viewport.scrollLeft <= 1;
    const atEnd = viewport.scrollLeft >= maxScroll - 1;

    if (prevButton) {
      prevButton.disabled = atStart;
    }
    if (nextButton) {
      nextButton.disabled = atEnd;
    }
  }

  function initializeCarousel(carousel) {
    const viewport = carousel.querySelector(VIEWPORT_SELECTOR);
    const track = carousel.querySelector(TRACK_SELECTOR);
    if (!viewport || !track) {
      return;
    }

    const shuffleButton = carousel.querySelector(SHUFFLE_SELECTOR);
    const prevButton = carousel.querySelector(PREV_SELECTOR);
    const nextButton = carousel.querySelector(NEXT_SELECTOR);
    const cards = Array.from(track.querySelectorAll('.strategy-card'));

    function applyShuffle() {
      const shuffled = shuffleArray(cards);
      shuffled.forEach((card) => track.appendChild(card));
      viewport.scrollTo({ left: 0, behavior: 'auto' });
      updateNavState(viewport, prevButton, nextButton);
    }

    applyShuffle();
    updatePerView(carousel, viewport, track);

    const resizeObserver = new ResizeObserver(() => {
      updatePerView(carousel, viewport, track);
      updateNavState(viewport, prevButton, nextButton);
    });
    resizeObserver.observe(viewport);

    if (shuffleButton) {
      shuffleButton.addEventListener('click', () => {
        applyShuffle();
        updatePerView(carousel, viewport, track);
      });
    }

    if (prevButton) {
      prevButton.addEventListener('click', () => scrollByStep(-1, viewport, track));
    }
    if (nextButton) {
      nextButton.addEventListener('click', () => scrollByStep(1, viewport, track));
    }

    viewport.addEventListener('scroll', () => updateNavState(viewport, prevButton, nextButton));
    updateNavState(viewport, prevButton, nextButton);
  }

  function init() {
    if (typeof document === 'undefined') {
      return;
    }

    const carousels = Array.from(document.querySelectorAll(CAROUSEL_SELECTOR));
    carousels.forEach(initializeCarousel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
