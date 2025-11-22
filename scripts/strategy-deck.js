const DECK_SELECTORS = {
  deck: '[data-strategy-deck]',
  list: '[data-strategy-deck-list]',
  viewport: '[data-strategy-deck-viewport]',
  status: '[data-strategy-deck-status]',
  prev: '[data-strategy-deck-prev]',
  next: '[data-strategy-deck-next]',
  shuffle: '[data-strategy-deck-shuffle]',
};

const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const SHUFFLE_LABEL = 'Shuffle strategies';
const STATUS_TEMPLATE = (current, total) => `Strategy ${current} of ${total}`;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function shuffleIndices(length) {
  const array = Array.from({ length }, (_, index) => index);
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
  return array;
}

function initStrategyDeck(deck) {
  if (!deck || deck.dataset.deckInitialized === 'true') {
    return;
  }

  const list = deck.querySelector(DECK_SELECTORS.list);
  const viewport = deck.querySelector(DECK_SELECTORS.viewport);
  const status = deck.querySelector(DECK_SELECTORS.status);
  const prevButton = deck.querySelector(DECK_SELECTORS.prev);
  const nextButton = deck.querySelector(DECK_SELECTORS.next);
  const shuffleButton = deck.querySelector(DECK_SELECTORS.shuffle);

  if (!list || !viewport || !status || !prevButton || !nextButton || !shuffleButton) {
    return;
  }

  const cards = Array.from(list.querySelectorAll('.strategy-card'));
  if (!cards.length) {
    return;
  }

  deck.dataset.deckInitialized = 'true';
  deck.classList.add('strategy-deck--active');

  const reduceMotion = window.matchMedia && window.matchMedia(MOTION_QUERY).matches;
  if (reduceMotion) {
    deck.classList.add('strategy-deck--reduced-motion');
  }

  list.setAttribute('role', 'presentation');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  let order = Array.from({ length: cards.length }, (_, index) => index);
  let currentIndex = 0;

  function focusCard(card) {
    if (!card) {
      return;
    }
    card.focus({ preventScroll: true });
  }

  function updateStatus(cardIndex) {
    if (!status) {
      return;
    }
    status.textContent = STATUS_TEMPLATE(cardIndex + 1, cards.length);
  }

  function updateHeight(card) {
    if (!card) {
      return;
    }
    requestAnimationFrame(() => {
      const height = card.offsetHeight;
      if (height > 0) {
        list.style.setProperty('--strategy-deck-height', `${height}px`);
      }
    });
  }

  function setCardState(card, { isActive, relativePosition }) {
    if (!card) {
      return;
    }
    const relative = clamp(relativePosition, -3, 3);
    card.style.setProperty('--deck-relative-position', relative);
    card.classList.toggle('strategy-card--active', isActive);
    card.classList.toggle('strategy-card--before', relative < 0);
    card.classList.toggle('strategy-card--after', relative > 0);
    card.classList.toggle('strategy-card--queue-first', relative === 1);
    card.classList.toggle('strategy-card--queue-second', relative === 2);
    card.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    if (isActive) {
      card.setAttribute('tabindex', '0');
    } else {
      card.setAttribute('tabindex', '-1');
    }
  }

  function applyState({ focus = false } = {}) {
    const activeCardIndex = order[currentIndex];
    const activeCard = cards[activeCardIndex];
    const queueLookup = new Map();
    order.forEach((cardIndex, position) => {
      queueLookup.set(cardIndex, position - currentIndex);
    });

    cards.forEach((card, originalIndex) => {
      const relativePosition = queueLookup.get(originalIndex) ?? 0;
      setCardState(card, {
        isActive: relativePosition === 0,
        relativePosition,
      });
      card.style.zIndex = String(cards.length - Math.abs(relativePosition));
    });

    updateStatus(currentIndex);
    updateHeight(activeCard);

    if (focus) {
      focusCard(activeCard);
    }
  }

  function goNext({ focus = false } = {}) {
    if (cards.length <= 1) {
      return;
    }
    currentIndex = (currentIndex + 1) % cards.length;
    applyState({ focus });
  }

  function goPrevious({ focus = false } = {}) {
    if (cards.length <= 1) {
      return;
    }
    currentIndex = (currentIndex - 1 + cards.length) % cards.length;
    applyState({ focus });
  }

  function shuffleDeck() {
    if (cards.length <= 1) {
      return;
    }
    const activeCardIndex = order[currentIndex];
    order = shuffleIndices(cards.length);
    currentIndex = order.indexOf(activeCardIndex);
    if (currentIndex === -1) {
      currentIndex = 0;
    }
    applyState({ focus: true });
  }

  prevButton.addEventListener('click', () => goPrevious({ focus: true }));
  nextButton.addEventListener('click', () => goNext({ focus: true }));
  shuffleButton.addEventListener('click', shuffleDeck);

  deck.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goNext({ focus: true });
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goPrevious({ focus: true });
    }
  });

  let pointerId = null;
  let pointerStartX = 0;
  let pointerActive = false;

  function resetPointer() {
    pointerId = null;
    pointerStartX = 0;
    pointerActive = false;
  }

  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
      return;
    }
    pointerId = event.pointerId;
    pointerStartX = event.clientX;
    pointerActive = true;
    viewport.setPointerCapture(pointerId);
  });

  viewport.addEventListener('pointerup', (event) => {
    if (!pointerActive || event.pointerId !== pointerId) {
      return;
    }
    const deltaX = event.clientX - pointerStartX;
    const threshold = Math.min(120, viewport.clientWidth * 0.25);
    if (Math.abs(deltaX) > Math.max(40, threshold)) {
      if (deltaX < 0) {
        goNext();
      } else {
        goPrevious();
      }
    }
    viewport.releasePointerCapture(pointerId);
    resetPointer();
  });

  viewport.addEventListener('pointercancel', () => {
    if (pointerId !== null) {
      viewport.releasePointerCapture(pointerId);
    }
    resetPointer();
  });

  shuffleButton.setAttribute('aria-label', SHUFFLE_LABEL);

  cards.forEach((card) => {
    card.setAttribute('tabindex', '-1');
  });

  applyState();
}

function initAllStrategyDecks() {
  const decks = document.querySelectorAll(DECK_SELECTORS.deck);
  if (!decks.length) {
    return;
  }
  decks.forEach((deck) => initStrategyDeck(deck));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllStrategyDecks);
} else {
  initAllStrategyDecks();
}

export {};
