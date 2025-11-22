const MAX_VISIBLE_CARDS = 4;
const OFFSET_STEP_PX = 18;
const MIN_SWIPE_THRESHOLD = 120;
const MAX_SWIPE_THRESHOLD = 320;

function ready(callback) {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function initStrategyDeck(deck) {
  if (!deck || deck.dataset.deckReady === 'true') {
    return;
  }

  const stack = deck.querySelector('[data-strategy-stack]');
  if (!stack) {
    return;
  }

  const cards = Array.from(stack.querySelectorAll('.strategy-card'));
  if (!cards.length) {
    return;
  }

  deck.dataset.deckReady = 'true';

  const shuffleButton = deck.querySelector('[data-strategy-shuffle]');
  const showAllButton = deck.querySelector('[data-strategy-show-all]');
  const listId = showAllButton?.getAttribute('aria-controls') || '';
  const list = listId ? document.getElementById(listId) : null;

  let currentCards = cards.slice();
  let topCard = null;
  let activeCard = null;
  let activePointerId = null;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let deckHeight = 0;

  function getVisibleCount() {
    const total = currentCards.length;
    if (!Number.isFinite(total) || total <= 0) {
      return 0;
    }
    return Math.min(MAX_VISIBLE_CARDS, total);
  }

  const observer = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => {
        window.requestAnimationFrame(updateDeckHeight);
      })
    : null;

  if (observer) {
    currentCards.forEach((card) => observer.observe(card));
  } else {
    window.addEventListener('resize', () => {
      window.requestAnimationFrame(updateDeckHeight);
    });
  }

  function updateDeckHeight() {
    const visibleCount = getVisibleCount();
    if (!visibleCount) {
      if (deckHeight !== 0) {
        deckHeight = 0;
        stack.style.height = '';
        stack.style.setProperty('--strategy-deck-height', '');
      }
      return;
    }

    const heights = currentCards.map((card) => {
      if (!card) {
        return 0;
      }
      const rect = card.getBoundingClientRect();
      const rectHeight = Number.isFinite(rect?.height) ? rect.height : 0;
      const offsetHeight = Number.isFinite(card.offsetHeight) ? card.offsetHeight : 0;
      const scrollHeight = Number.isFinite(card.scrollHeight) ? card.scrollHeight : 0;
      return Math.max(rectHeight, offsetHeight, scrollHeight, 0);
    });
    const nextHeight = Math.max(0, ...heights);
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) {
      return;
    }

    const offsetPadding = Math.max(0, visibleCount - 1) * OFFSET_STEP_PX;
    const totalHeight = nextHeight + offsetPadding;
    if (!Number.isFinite(totalHeight) || totalHeight <= 0) {
      return;
    }

    if (Math.abs(totalHeight - deckHeight) < 0.5) {
      return;
    }
    deckHeight = totalHeight;
    stack.style.height = `${totalHeight}px`;
    stack.style.setProperty('--strategy-deck-height', `${totalHeight}px`);
  }

  function attachPointer(card) {
    if (!card || card.dataset.pointerAttached === 'true') {
      return;
    }
    card.addEventListener('pointerdown', handlePointerDown);
    card.dataset.pointerAttached = 'true';
  }

  function detachPointer(card) {
    if (!card || card.dataset.pointerAttached !== 'true') {
      return;
    }
    card.removeEventListener('pointerdown', handlePointerDown);
    card.dataset.pointerAttached = 'false';
  }

  function layout(options = {}) {
    const immediate = Boolean(options.immediate);
    const visibleCount = getVisibleCount();

    currentCards.forEach((card, index) => {
      if (!card) {
        return;
      }
      const depth = Math.min(index, visibleCount - 1);
      const offset = depth * OFFSET_STEP_PX;
      const layer = currentCards.length - index;
      const hidden = index >= visibleCount;

      card.dataset.deckOffset = String(offset);
      card.style.setProperty('--strategy-deck-offset', `${offset}px`);
      card.style.setProperty('--strategy-deck-layer', String(layer));
      card.style.setProperty('--strategy-deck-opacity', hidden ? '0' : '1');

      if (card !== activeCard || !isDragging) {
        if (immediate) {
          card.style.transition = 'none';
        }
        card.style.transform = '';
        if (immediate) {
          window.requestAnimationFrame(() => {
            card.style.transition = '';
          });
        }
      }

      card.classList.toggle('is-active', index === 0 && !isDragging);
      card.classList.toggle('is-hidden', hidden);
      card.classList.toggle('is-dragging', card === activeCard && isDragging);
      card.style.pointerEvents = index === 0 ? 'auto' : 'none';
    });

    if (!isDragging) {
      updateTopCardPointer();
    }
  }

  function updateTopCardPointer(force = false) {
    const desired = currentCards[0] || null;
    if (topCard && topCard !== desired) {
      detachPointer(topCard);
    }
    if (desired && (force || topCard !== desired) && !isDragging) {
      attachPointer(desired);
    }
    topCard = desired;
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    if (event.target && event.target.closest('button, a, input, textarea, select')) {
      return;
    }
    const card = event.currentTarget;
    activePointerId = event.pointerId;
    activeCard = card;
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    lastX = startX;
    lastY = startY;
    deck.classList.add('strategy-deck--dragging');
    card.classList.add('is-dragging');
    try {
      card.setPointerCapture(activePointerId);
    } catch (error) {
      // Ignore capture failures
    }
    card.addEventListener('pointermove', handlePointerMove);
    card.addEventListener('pointerup', handlePointerUpOrCancel);
    card.addEventListener('pointercancel', handlePointerUpOrCancel);
  }

  function handlePointerMove(event) {
    if (!isDragging || event.pointerId !== activePointerId || !activeCard) {
      return;
    }
    lastX = event.clientX;
    lastY = event.clientY;
    const dx = lastX - startX;
    const dy = lastY - startY;
    const baseOffset = Number(activeCard.dataset.deckOffset || '0');
    const translateY = baseOffset + dy * 0.1;
    const rotate = Math.max(Math.min(dx / 15, 18), -18);
    activeCard.style.transform = `translate3d(${dx}px, ${translateY}px, 0) rotate(${rotate}deg)`;
  }

  function handlePointerUpOrCancel(event) {
    if (!activeCard || event.pointerId !== activePointerId) {
      return;
    }
    const card = activeCard;
    try {
      card.releasePointerCapture(activePointerId);
    } catch (error) {
      // Ignore release failures
    }
    card.removeEventListener('pointermove', handlePointerMove);
    card.removeEventListener('pointerup', handlePointerUpOrCancel);
    card.removeEventListener('pointercancel', handlePointerUpOrCancel);

    const dx = (lastX || event.clientX) - startX;
    const width = stack.clientWidth || card.clientWidth || 1;
    const dynamicThreshold = Math.min(
      Math.max(width * 0.35, MIN_SWIPE_THRESHOLD),
      MAX_SWIPE_THRESHOLD,
    );
    const shouldSwipe = Math.abs(dx) > dynamicThreshold;

    activePointerId = null;

    if (shouldSwipe) {
      swipeCard(card, dx);
    } else {
      resetCard(card);
    }
  }

  function resetCard(card) {
    const baseOffset = Number(card.dataset.deckOffset || '0');
    card.style.transition = 'transform 0.3s ease, opacity 0.3s ease, box-shadow 0.3s ease';
    card.style.transform = `translate3d(0, ${baseOffset}px, 0)`;
    card.addEventListener(
      'transitionend',
      function handleReset(event) {
        if (event.propertyName !== 'transform') {
          return;
        }
        card.removeEventListener('transitionend', handleReset);
        card.style.transition = '';
        card.style.transform = '';
        card.classList.remove('is-dragging');
        isDragging = false;
        activeCard = null;
        deck.classList.remove('strategy-deck--dragging');
        layout();
      },
      { once: true },
    );
  }

  function swipeCard(card, deltaX) {
    const baseOffset = Number(card.dataset.deckOffset || '0');
    const direction = deltaX >= 0 ? 1 : -1;
    const width = stack.clientWidth || card.clientWidth || 1;
    const travel = Math.max(width, 0) + 200;

    card.style.transition = 'transform 0.4s ease, opacity 0.4s ease, box-shadow 0.4s ease';
    card.style.transform = `translate3d(${direction * travel}px, ${baseOffset}px, 0) rotate(${direction * 18}deg)`;
    card.style.opacity = '0';

    card.addEventListener(
      'transitionend',
      function handleSwipe(event) {
        if (event.propertyName !== 'transform') {
          return;
        }
        card.removeEventListener('transitionend', handleSwipe);
        card.style.transition = '';
        card.style.transform = '';
        card.style.opacity = '';
        card.classList.remove('is-dragging');
        deck.classList.remove('strategy-deck--dragging');

        const first = currentCards[0];
        if (first === card) {
          currentCards.shift();
        } else {
          const index = currentCards.indexOf(card);
          if (index >= 0) {
            currentCards.splice(index, 1);
          }
        }
        currentCards.push(card);
        stack.append(card);

        activeCard = null;
        isDragging = false;
        updateTopCardPointer(true);
        layout();
        updateDeckHeight();
      },
      { once: true },
    );
  }

  function shuffleDeck(options = {}) {
    if (currentCards.length <= 1) {
      return;
    }
    for (let i = currentCards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = currentCards[i];
      currentCards[i] = currentCards[j];
      currentCards[j] = temp;
    }
    currentCards.forEach((card) => stack.append(card));
    layout({ immediate: Boolean(options.immediate) });
    updateDeckHeight();
  }

  if (showAllButton && list) {
    showAllButton.addEventListener('click', () => {
      if (showAllButton.disabled) {
        return;
      }
      list.dataset.hidden = 'false';
      list.removeAttribute('hidden');
      showAllButton.disabled = true;
      showAllButton.setAttribute('aria-expanded', 'true');
      showAllButton.textContent = 'Showing all';
    });
  }

  if (shuffleButton) {
    shuffleButton.addEventListener('click', () => {
      shuffleDeck({ immediate: false });
    });
  }

  updateDeckHeight();
  deck.setAttribute('data-enhanced', 'true');
  shuffleDeck({ immediate: true });
  layout({ immediate: true });
  updateDeckHeight();
  window.setTimeout(updateDeckHeight, 250);
}

ready(() => {
  const decks = document.querySelectorAll('[data-strategy-deck]');
  decks.forEach((deck) => initStrategyDeck(deck));
});
