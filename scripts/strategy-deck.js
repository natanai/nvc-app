(function () {
  const stack = document.querySelector('[data-strategy-stack]');
  const deck = document.querySelector('[data-strategy-deck]');
  const nextBtn = document.querySelector('[data-strategy-next]');
  const prevBtn = document.querySelector('[data-strategy-prev]');
  const shuffleBtn = document.querySelector('[data-strategy-shuffle]');
  const deckHeader = document.querySelector('.strategy-deck-header');
  const counter = document.querySelector('[data-strategy-count]');
  let toggleBtn = document.querySelector('[data-strategy-toggle]');

  if (!stack) {
    return;
  }

  let cards = Array.from(stack.querySelectorAll('.strategy-card'));
  if (!cards.length) {
    return;
  }

  if (!toggleBtn && deckHeader) {
    toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'strategy-deck__toggle';
    toggleBtn.setAttribute('data-strategy-toggle', '');
    toggleBtn.textContent = 'View all';
    deckHeader.appendChild(toggleBtn);
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  let viewAll = false;

  function updateToggleButton() {
    if (!toggleBtn) return;
    toggleBtn.textContent = viewAll ? 'View one at a time' : 'View all';
    toggleBtn.setAttribute('aria-pressed', viewAll ? 'true' : 'false');
  }

  function applyPositions(currentIndex) {
    if (viewAll) {
      cards.forEach((card) => {
        card.removeAttribute('data-active');
        card.removeAttribute('data-position');
      });
      return;
    }

    const prevIndex = (currentIndex - 1 + cards.length) % cards.length;
    const nextIndex = (currentIndex + 1) % cards.length;

    cards.forEach((card, index) => {
      card.removeAttribute('data-active');
      card.removeAttribute('data-position');

      if (index === currentIndex) {
        card.setAttribute('data-active', 'true');
      } else if (index === prevIndex) {
        card.setAttribute('data-position', 'prev');
      } else if (index === nextIndex) {
        card.setAttribute('data-position', 'next');
      }
    });
  }

  if (counter) {
    counter.setAttribute('aria-live', 'polite');
  }

  function updateCounter(currentIndex) {
    if (!counter) return;
    if (viewAll) {
      counter.textContent = `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`;
    } else {
      counter.textContent = `${currentIndex + 1} of ${cards.length}`;
    }
  }

  function enableListView() {
    viewAll = true;
    if (deck) {
      deck.classList.add('strategy-deck--list');
    }
    applyPositions(currentIndex);
    updateCounter(currentIndex);
    updateToggleButton();
    window.requestAnimationFrame(refreshBodyShadows);
  }

  function disableListView() {
    viewAll = false;
    if (deck) {
      deck.classList.remove('strategy-deck--list');
    }
    applyPositions(currentIndex);
    updateCounter(currentIndex);
    updateToggleButton();
    window.requestAnimationFrame(refreshBodyShadows);
  }

  function toggleViewMode() {
    if (viewAll) {
      disableListView();
    } else {
      enableListView();
    }
  }

  function toggleBodyShadow(body) {
    if (!body) return;

    const hasOverflow = body.scrollHeight > body.clientHeight + 1;
    const dismissed = body.dataset.scrollHintDismissed === 'true';

    body.classList.toggle('strategy-card__body--shadow', hasOverflow && !dismissed);
  }

  function refreshBodyShadows() {
    cards.forEach((card) => {
      const body = card.querySelector('.strategy-card__body');
      toggleBodyShadow(body);
    });
  }

  cards.forEach((card) => {
    const body = card.querySelector('.strategy-card__body');
    if (body) {
      body.addEventListener('scroll', function () {
        if (body.scrollTop > 0) {
          body.dataset.scrollHintDismissed = 'true';
        }
        toggleBodyShadow(body);
      });
    }
  });

  let currentIndex = 0;

  function go(offset) {
    if (!cards.length || viewAll) return;
    currentIndex = (currentIndex + offset + cards.length) % cards.length;
    applyPositions(currentIndex);
    updateCounter(currentIndex);
    window.requestAnimationFrame(refreshBodyShadows);
  }

  function performShuffle() {
    const children = Array.from(stack.children).filter(function (node) {
      return node.classList && node.classList.contains('strategy-card');
    });

    const shuffled = shuffleArray(children);
    shuffled.forEach(function (card) {
      stack.appendChild(card);
    });

    cards = Array.from(stack.querySelectorAll('.strategy-card'));
    currentIndex = 0;
    applyPositions(currentIndex);
    updateCounter(currentIndex);
    window.requestAnimationFrame(refreshBodyShadows);
  }

  performShuffle();
  updateCounter(currentIndex);
  updateToggleButton();
  window.requestAnimationFrame(refreshBodyShadows);

  window.addEventListener('resize', function () {
    window.requestAnimationFrame(refreshBodyShadows);
  });

  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      go(1);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      go(-1);
    });
  }

  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', function () {
      performShuffle();
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      toggleViewMode();
    });
  }

  if (deck && deck.addEventListener) {
    let startX = null;
    let startY = null;
    let isDragging = false;
    let swipeLocked = false;
    let startedOnActiveCard = false;

    deck.addEventListener('pointerdown', function (event) {
      const target = event.target;
      const targetIsElement = target instanceof Element;
      const targetInsideStack = targetIsElement && (target === stack || stack.contains(target));
      const interactiveTarget = targetIsElement
        ? target.closest('button, a, input, textarea, select, label')
        : null;

      if (!targetInsideStack || (interactiveTarget && deck.contains(interactiveTarget))) {
        isDragging = false;
        swipeLocked = false;
        startedOnActiveCard = false;
        startX = null;
        startY = null;
        deck.style.touchAction = '';
        return;
      }

      isDragging = true;
      swipeLocked = false;
      startedOnActiveCard = false;
      startX = event.clientX;
      startY = event.clientY;

      const activeCard = stack.querySelector('.strategy-card[data-active="true"]');
      if (activeCard && activeCard.contains(event.target)) {
        startedOnActiveCard = true;
        swipeLocked = true;
        deck.style.touchAction = 'pan-x';
      } else {
        deck.style.touchAction = '';
      }

      if (deck.setPointerCapture) {
        try {
          deck.setPointerCapture(event.pointerId);
        } catch (err) {
          /* noop */
        }
      }
    });

    deck.addEventListener('pointermove', function (event) {
      if (!isDragging || startX == null || startY == null) {
        return;
      }

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (startedOnActiveCard) {
        event.preventDefault();
        return;
      }

      if (!swipeLocked) {
        const horizontalDominant = Math.abs(dx) > Math.abs(dy) + 6;
        if (horizontalDominant && Math.abs(dx) > 12) {
          swipeLocked = true;
          event.preventDefault();
        } else if (Math.abs(dy) > Math.abs(dx)) {
          return;
        }
      } else {
        event.preventDefault();
      }
    });

    deck.addEventListener('pointerup', function (event) {
      if (!isDragging || startX == null) {
        return;
      }

      const dx = event.clientX - startX;
      const threshold = 40;

      if (swipeLocked && Math.abs(dx) > threshold) {
        if (dx > 0) {
          go(-1);
        } else {
          go(1);
        }
      }

      isDragging = false;
      swipeLocked = false;
      startedOnActiveCard = false;
      startX = null;
      startY = null;
      deck.style.touchAction = '';
    });

    deck.addEventListener('pointerleave', function () {
      isDragging = false;
      swipeLocked = false;
      startedOnActiveCard = false;
      startX = null;
      startY = null;
      deck.style.touchAction = '';
    });

    deck.addEventListener('pointercancel', function () {
      isDragging = false;
      swipeLocked = false;
      startedOnActiveCard = false;
      startX = null;
      startY = null;
      deck.style.touchAction = '';
    });
  }
})();
