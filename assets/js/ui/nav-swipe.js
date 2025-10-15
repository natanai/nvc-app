(function () {
  const STATE_ATTR = 'data-blade-state';
  const OPEN_STATE = 'open';
  const CLOSED_STATE = 'closed';
  const POINTER_TYPES = new Set(['touch', 'pen']);
  const SWIPE_THRESHOLD = 40;
  const VERTICAL_SLOP = 35;
  const MOVE_THRESHOLD = 8;

  function setup(container) {
    const front = container.querySelector('[data-nav-blade-front]');
    const reveal = container.querySelector('[data-nav-blade-reveal]');
    if (!front || !reveal) {
      return;
    }

    if (!container.getAttribute(STATE_ATTR)) {
      container.setAttribute(STATE_ATTR, CLOSED_STATE);
    }

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let moved = false;
    let suppressClick = false;

    function isPointerValid(event) {
      if (!event || typeof event.pointerType !== 'string') {
        return false;
      }
      return POINTER_TYPES.has(event.pointerType.toLowerCase());
    }

    function isOpen() {
      return container.getAttribute(STATE_ATTR) === OPEN_STATE;
    }

    function openBlade() {
      if (!isOpen()) {
        container.setAttribute(STATE_ATTR, OPEN_STATE);
      }
    }

    function closeBlade() {
      if (isOpen()) {
        container.setAttribute(STATE_ATTR, CLOSED_STATE);
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
      suppressClick = false;
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
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (Math.abs(deltaY) > VERTICAL_SLOP) {
        return;
      }
      if (!moved && Math.abs(deltaX) > MOVE_THRESHOLD) {
        moved = true;
      }
      if (deltaX <= -SWIPE_THRESHOLD) {
        openBlade();
      } else if (deltaX >= SWIPE_THRESHOLD) {
        closeBlade();
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
