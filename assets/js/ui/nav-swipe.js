(function () {
  const STATE_ATTR = 'data-blade-state';
  const DIRECTION_ATTR = 'data-swipe-direction';
  const OPEN_STATE = 'open';
  const CLOSED_STATE = 'closed';
  const POINTER_TYPES = new Set(['touch', 'pen', 'mouse']);
  const SWIPE_THRESHOLD = 40;
  const VERTICAL_SLOP = 35;
  const MOVE_THRESHOLD = 6;
  const DEFAULT_DIRECTION = 'right';

  function setup(container) {
    const front = container.querySelector('[data-nav-blade-front]');
    const reveal = container.querySelector('[data-nav-blade-reveal]');
    if (!front || !reveal) {
      return;
    }

    if (!container.getAttribute(STATE_ATTR)) {
      container.setAttribute(STATE_ATTR, CLOSED_STATE);
    }
    if (!container.getAttribute(DIRECTION_ATTR)) {
      container.setAttribute(DIRECTION_ATTR, DEFAULT_DIRECTION);
    }

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let moved = false;
    let toggled = false;
    let direction = DEFAULT_DIRECTION;
    let suppressClick = false;

    function isPointerValid(event) {
      if (!event || typeof event.pointerType !== 'string') {
        return false;
      }
      const pointerType = event.pointerType.toLowerCase();
      if (!POINTER_TYPES.has(pointerType)) {
        return false;
      }
      if (pointerType === 'mouse' && typeof event.button === 'number' && event.type === 'pointerdown') {
        return event.button === 0;
      }
      return true;
    }

    function isOpen() {
      return container.getAttribute(STATE_ATTR) === OPEN_STATE;
    }

    function toggleBlade() {
      if (isOpen()) {
        container.setAttribute(STATE_ATTR, CLOSED_STATE);
      } else {
        container.setAttribute(STATE_ATTR, OPEN_STATE);
      }
    }

    function handlePointerDown(event) {
      if (!isPointerValid(event)) {
        pointerId = null;
        return;
      }
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      moved = false;
      toggled = false;
      suppressClick = false;
      direction = DEFAULT_DIRECTION;
      if (typeof event.currentTarget?.setPointerCapture === 'function') {
        try {
          event.currentTarget.setPointerCapture(pointerId);
        } catch (error) {
          // Ignore pointer capture errors (e.g., element not in the tree).
        }
      }
    }

    function handlePointerMove(event) {
      if (pointerId === null || event.pointerId !== pointerId) {
        return;
      }
      const pointerType =
        typeof event.pointerType === 'string' ? event.pointerType.toLowerCase() : '';
      if (
        pointerType === 'mouse' &&
        typeof event.buttons === 'number' &&
        (event.buttons & 1) !== 1
      ) {
        return;
      }
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (Math.abs(deltaY) > VERTICAL_SLOP) {
        return;
      }
      if (!moved && Math.abs(deltaX) > MOVE_THRESHOLD) {
        moved = true;
      }
      if (deltaX < 0) {
        direction = 'left';
      } else if (deltaX > 0) {
        direction = 'right';
      }
      if (!toggled && Math.abs(deltaX) >= SWIPE_THRESHOLD) {
        container.setAttribute(DIRECTION_ATTR, direction);
        toggleBlade();
        toggled = true;
      }
    }

    function resetPointer(target) {
      if (pointerId === null) {
        return;
      }
      if (typeof target?.releasePointerCapture === 'function') {
        try {
          target.releasePointerCapture(pointerId);
        } catch (error) {
          // Ignore release errors.
        }
      }
      pointerId = null;
    }

    function handlePointerEnd(event) {
      if (pointerId === null || event.pointerId !== pointerId) {
        return;
      }
      resetPointer(event.currentTarget);
      if (moved) {
        suppressClick = true;
        window.setTimeout(() => {
          suppressClick = false;
        }, 220);
      }
    }

    function handleClick(event) {
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
      }
    }

    const listeners = [front, reveal];
    listeners.forEach((element) => {
      element.addEventListener('pointerdown', handlePointerDown, { passive: true });
      element.addEventListener('pointermove', handlePointerMove, { passive: true });
      element.addEventListener('pointerup', handlePointerEnd, { passive: true });
      element.addEventListener('pointercancel', handlePointerEnd, { passive: true });
      element.addEventListener('click', handleClick, true);
    });
  }

  function init() {
    const containers = document.querySelectorAll('[data-nav-blade]');
    if (!containers.length) {
      return;
    }
    containers.forEach((container) => {
      setup(container);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
