(function () {
  const COMPASS_SELECTOR = '[data-compass]';
  const KEYBOARD_STEP = 0.12;
  const ENERGY_THRESHOLD = 0.33;
  const VALENCE_THRESHOLD = 0.33;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalize(energy, valence) {
    let nextEnergy = clamp(energy, -1, 1);
    let nextValence = clamp(valence, -1, 1);
    const magnitude = Math.hypot(nextEnergy, nextValence);
    if (magnitude > 1) {
      nextEnergy /= magnitude;
      nextValence /= magnitude;
    }
    return { energy: nextEnergy, valence: nextValence };
  }

  function categorizeEnergy(value) {
    if (value <= -ENERGY_THRESHOLD) {
      return { key: 'low', label: 'Low' };
    }
    if (value >= ENERGY_THRESHOLD) {
      return { key: 'high', label: 'High' };
    }
    return { key: 'medium', label: 'Steady' };
  }

  function categorizeValence(value) {
    if (value <= -VALENCE_THRESHOLD) {
      return { key: 'unpleasant', label: 'Unpleasant' };
    }
    if (value >= VALENCE_THRESHOLD) {
      return { key: 'pleasant', label: 'Pleasant' };
    }
    return { key: 'neutral', label: 'Neutral' };
  }

  function positionFromPointer(event, board) {
    const rect = board.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) / 2;
    if (radius <= 0) {
      return null;
    }
    const relativeX = (event.clientX - (rect.left + rect.width / 2)) / radius;
    const relativeY = ((rect.top + rect.height / 2) - event.clientY) / radius;
    return normalize(relativeY, relativeX);
  }

  function initCompass(root) {
    if (!(root instanceof HTMLElement)) return;
    if (root.dataset.compassReady === '1') return;
    root.dataset.compassReady = '1';

    const board = document.createElement('div');
    board.className = 'emotion-compass__board';
    board.tabIndex = 0;
    board.setAttribute('role', 'application');
    board.setAttribute('aria-roledescription', 'Emotion compass');
    const ariaLabel = root.getAttribute('aria-label');
    if (ariaLabel) {
      board.setAttribute('aria-label', ariaLabel);
    }
    const hint = root.querySelector('[data-compass-hint]');
    if (hint instanceof HTMLElement) {
      if (!hint.id) {
        hint.id = `compass-hint-${Math.random().toString(36).slice(2, 9)}`;
      }
      board.setAttribute('aria-describedby', hint.id);
    }

    const handle = document.createElement('div');
    handle.className = 'emotion-compass__handle';
    board.appendChild(handle);
    root.appendChild(board);

    const readout = root.parentElement?.querySelector('[data-compass-readout]');

    let energy = 0;
    let valence = 0;
    let isDragging = false;

    function updateVisuals() {
      const energyInfo = categorizeEnergy(energy);
      const valenceInfo = categorizeValence(valence);
      const xPercent = ((valence + 1) / 2) * 100;
      const yPercent = ((1 - ((energy + 1) / 2)) * 100);
      handle.style.left = `${xPercent}%`;
      handle.style.top = `${yPercent}%`;
      board.style.setProperty('--compass-energy', energy.toFixed(2));
      board.style.setProperty('--compass-valence', valence.toFixed(2));
      board.setAttribute('aria-valuetext', `Energy: ${energyInfo.label} · Pleasantness: ${valenceInfo.label}`);
      root.dataset.energyKey = energyInfo.key;
      root.dataset.valenceKey = valenceInfo.key;
      if (readout instanceof HTMLElement) {
        readout.textContent = `Energy: ${energyInfo.label} · Pleasantness: ${valenceInfo.label}`;
      }
    }

    function emitChange(options = {}) {
      const energyInfo = categorizeEnergy(energy);
      const valenceInfo = categorizeValence(valence);
      root.dispatchEvent(
        new CustomEvent('nvc-compass-change', {
          detail: {
            energy,
            valence,
            energyKey: energyInfo.key,
            energyLabel: energyInfo.label,
            valenceKey: valenceInfo.key,
            valenceLabel: valenceInfo.label,
            userTriggered: !!options.userTriggered,
          },
        })
      );
    }

    function applyValue(nextEnergy, nextValence, options = {}) {
      const normalized = normalize(nextEnergy, nextValence);
      const same =
        Math.abs(normalized.energy - energy) < 0.001 &&
        Math.abs(normalized.valence - valence) < 0.001;
      energy = normalized.energy;
      valence = normalized.valence;
      updateVisuals();
      if (options.silent || (same && !options.force)) {
        return;
      }
      emitChange({ userTriggered: options.userTriggered });
    }

    function handlePointerDown(event) {
      if (!(event instanceof PointerEvent)) return;
      event.preventDefault();
      board.focus({ preventScroll: true });
      isDragging = true;
      board.dataset.dragging = '1';
      try {
        board.setPointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer capture errors in unsupported browsers.
      }
      const position = positionFromPointer(event, board);
      if (position) {
        applyValue(position.energy, position.valence, { userTriggered: true, force: true });
      }
    }

    function handlePointerMove(event) {
      if (!isDragging || !(event instanceof PointerEvent)) return;
      event.preventDefault();
      const position = positionFromPointer(event, board);
      if (position) {
        applyValue(position.energy, position.valence, { userTriggered: true });
      }
    }

    function stopDragging(event) {
      if (!(event instanceof PointerEvent)) return;
      if (!isDragging) return;
      isDragging = false;
      delete board.dataset.dragging;
      try {
        board.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Ignore release errors.
      }
    }

    function handleKeyDown(event) {
      const { key } = event;
      let handled = false;
      if (key === 'ArrowUp') {
        applyValue(energy + KEYBOARD_STEP, valence, { userTriggered: true });
        handled = true;
      } else if (key === 'ArrowDown') {
        applyValue(energy - KEYBOARD_STEP, valence, { userTriggered: true });
        handled = true;
      } else if (key === 'ArrowRight') {
        applyValue(energy, valence + KEYBOARD_STEP, { userTriggered: true });
        handled = true;
      } else if (key === 'ArrowLeft') {
        applyValue(energy, valence - KEYBOARD_STEP, { userTriggered: true });
        handled = true;
      } else if (key === 'Home') {
        applyValue(0, -1, { userTriggered: true });
        handled = true;
      } else if (key === 'End') {
        applyValue(0, 1, { userTriggered: true });
        handled = true;
      } else if (key === 'PageUp') {
        applyValue(1, 0, { userTriggered: true });
        handled = true;
      } else if (key === 'PageDown') {
        applyValue(-1, 0, { userTriggered: true });
        handled = true;
      }
      if (handled) {
        event.preventDefault();
      }
    }

    board.addEventListener('pointerdown', handlePointerDown);
    board.addEventListener('pointermove', handlePointerMove);
    board.addEventListener('pointerup', stopDragging);
    board.addEventListener('pointercancel', stopDragging);
    board.addEventListener('lostpointercapture', () => {
      isDragging = false;
      delete board.dataset.dragging;
    });
    board.addEventListener('keydown', handleKeyDown);

    updateVisuals();
  }

  function initAll() {
    document.querySelectorAll(COMPASS_SELECTOR).forEach((root) => initCompass(root));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  window.NVCCompass = {
    init: initCompass,
    categorizeEnergy,
    categorizeValence,
  };
})();
