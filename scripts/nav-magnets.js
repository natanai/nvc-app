const TILT_OPTIONS = [-2, -1, 0, 1, 2];
const OFFSET_OPTIONS = [-4, -2, 0, 2, 4];
const NAV_PHYSICS_CONFIG = {
  drift: 1.4,
  damping: 0.982,
  sepRadiusScale: 0.75,
  sepStrength: 16,
  edgeBounce: 0.16,
  mouseRadius: 150,
  mouseStrength: 0.5,
};

const globalState = {
  decorated: new WeakSet(),
};

const boardStates = new WeakMap();
let physicsModulePromise = null;

function hashString(value) {
  let hash = 0;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(31, hash) + text.charCodeAt(index);
    hash |= 0; // eslint-disable-line no-bitwise
  }
  return hash;
}

function pickOption(options, key, salt = '') {
  if (!Array.isArray(options) || options.length === 0) {
    return null;
  }
  const input = `${key}::${salt}`;
  const hash = hashString(input);
  const index = ((hash % options.length) + options.length) % options.length;
  return options[index];
}

function getMagnetKey(element, fallbackIndex) {
  if (!(element instanceof HTMLElement)) {
    return `fallback:${fallbackIndex}`;
  }
  const id = element.dataset?.magnetId
    || element.dataset?.navItemId
    || element.id
    || element.getAttribute('href')
    || element.textContent
    || '';
  const normalized = String(id).trim().toLowerCase();
  if (normalized) {
    return normalized;
  }
  return `nav-magnet-${fallbackIndex}`;
}

const clamp = (value, min, max) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function decorateMagnet(element, index = 0) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  const key = getMagnetKey(element, index);
  const tilt = pickOption(TILT_OPTIONS, key, 'tilt') ?? 0;
  const offset = pickOption(OFFSET_OPTIONS, key, 'offset') ?? 0;
  element.style.setProperty('--nav-magnet-tilt', `${tilt}deg`);
  element.style.setProperty('--nav-magnet-offset', `${offset}px`);
  element.style.setProperty('--magnet-tilt', `${tilt}deg`);
  element.style.setProperty('--magnet-offset', `${offset}px`);
  element.dataset.navMagnetOffset = String(offset);
  globalState.decorated.add(element);
}

function getNavBoard(nav) {
  if (!(nav instanceof HTMLElement)) {
    return null;
  }
  return nav.querySelector('[data-nav-board]') || nav.querySelector('.site-nav__board');
}

function loadPhysicsModules() {
  if (!physicsModulePromise) {
    physicsModulePromise = import('./magnets/magnetPhysics.js')
      .then((module) => ({ startPhysics: module.startPhysics }))
      .catch((error) => {
        physicsModulePromise = null;
        throw error;
      });
  }
  return physicsModulePromise;
}

function setToggleState(state, active) {
  if (!state || !state.toggle) {
    if (state?.toggleInput instanceof HTMLInputElement) {
      state.toggleInput.checked = active;
      state.toggleInput.setAttribute(
        'aria-label',
        active ? 'Disable magnet physics' : 'Enable magnet physics',
      );
    }
    return;
  }

  state.toggle.dataset.state = active ? 'on' : 'off';
  const srState = state.toggle.querySelector('.magnet-play-toggle__sr-state');
  if (srState) {
    srState.textContent = active ? 'Physics is on' : 'Physics is off';
  }
  if (state.toggleInput instanceof HTMLInputElement) {
    state.toggleInput.checked = active;
    state.toggleInput.setAttribute(
      'aria-label',
      active ? 'Disable magnet physics' : 'Enable magnet physics',
    );
  }
}

function handlePhysicsPositions(state, list) {
  if (!state || !state.board || !Array.isArray(list)) {
    return;
  }

  let maxBottom = 0;
  list.forEach((item) => {
    if (!item || typeof item.id !== 'string') {
      return;
    }
    const magnet = state.magnetMap.get(item.id);
    if (!(magnet instanceof HTMLElement)) {
      return;
    }
    magnet.style.setProperty('--nav-magnet-x', `${item.x}px`);
    magnet.style.setProperty('--nav-magnet-y', `${item.y}px`);
    const offset = toNumber(magnet.dataset.navMagnetOffset, 0);
    state.positions.set(item.id, { x: item.x, y: item.y, offset });
    const height = magnet.offsetHeight || toNumber(getComputedStyle(magnet).height, 0);
    maxBottom = Math.max(maxBottom, item.y + offset + height);
  });

  const buffer = Math.max(state.bottomPadding || 0, 16);
  const nextHeight = Math.max(Math.ceil(maxBottom + buffer), state.minHeight || 0);
  state.customHeight = nextHeight;
  applyBoardHeight(state, nextHeight);
}

function applyBoardHeight(state, desiredHeight) {
  if (!state || !state.board) {
    return;
  }
  const minHeight = state.minHeight || 0;
  const maxHeight = Math.max(state.maxHeight || desiredHeight || minHeight, minHeight);
  const resolved = clamp(desiredHeight, minHeight, maxHeight);
  state.board.style.setProperty('--nav-board-height', `${resolved}px`);
  state.board.style.height = `${resolved}px`;
  state.height = resolved;
}

function measureLayout(state) {
  if (!state || !state.board || !state.magnets.length) {
    return;
  }
  if (state.playing) {
    return;
  }

  const { board } = state;
  delete board.dataset.navLayout;
  board.style.removeProperty('--nav-board-height');
  board.style.removeProperty('--nav-board-min-height');
  board.style.height = '';

  const boardRect = board.getBoundingClientRect();
  const style = window.getComputedStyle(board);
  const paddingBottom = toNumber(style.paddingBottom, 0);
  const paddingTop = toNumber(style.paddingTop, 0);

  let maxBottom = 0;
  state.positions.clear();

  state.magnets.forEach((magnet, index) => {
    if (!(magnet instanceof HTMLElement)) {
      return;
    }
    magnet.style.removeProperty('transform');
    const rect = magnet.getBoundingClientRect();
    const offset = toNumber(magnet.dataset.navMagnetOffset, 0);
    const x = rect.left - boardRect.left;
    const y = rect.top - boardRect.top;
    const baseY = y - offset;
    magnet.style.setProperty('--nav-magnet-x', `${x}px`);
    magnet.style.setProperty('--nav-magnet-y', `${baseY}px`);
    const magnetId = magnet.dataset.magnetId || getMagnetKey(magnet, index);
    state.positions.set(magnetId, { x, y: baseY, offset });
    maxBottom = Math.max(maxBottom, baseY + offset + rect.height);
  });

  const buffer = Math.max(paddingBottom, 16);
  const measuredHeight = Math.ceil(maxBottom + buffer);
  const fallbackMin = toNumber(style.minHeight, measuredHeight);
  state.bottomPadding = paddingBottom;
  state.topPadding = paddingTop;
  state.measuredHeight = measuredHeight;
  state.minHeight = Math.max(measuredHeight, fallbackMin);
  state.maxHeight = Math.max(state.minHeight + 320, state.minHeight + buffer + 120);
  const desiredHeight = state.customHeight != null
    ? Math.max(state.customHeight, state.minHeight)
    : Math.max(state.height || 0, state.minHeight);
  state.lastWidth = boardRect.width;
  board.dataset.navLayout = 'absolute';
  board.style.setProperty('--nav-board-min-height', `${state.minHeight}px`);
  applyBoardHeight(state, desiredHeight);
}

function scheduleLayout(state) {
  if (!state || state.layoutScheduled) {
    return;
  }
  state.layoutScheduled = true;
  const run = () => {
    state.layoutScheduled = false;
    measureLayout(state);
  };
  const ready = state.fontsReadyPromise;
  if (ready && typeof ready.then === 'function') {
    ready
      .then(() => {
        if (typeof window !== 'undefined' && window.requestAnimationFrame) {
          window.requestAnimationFrame(run);
        } else {
          run();
        }
      })
      .catch(() => {
        if (typeof window !== 'undefined' && window.requestAnimationFrame) {
          window.requestAnimationFrame(run);
        } else {
          run();
        }
      });
  } else if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    window.requestAnimationFrame(run);
  } else {
    run();
  }
}

function disablePhysics(state) {
  if (!state) {
    return;
  }
  if (state.physics) {
    try {
      state.physics.stop();
    } catch (error) {
      // Ignore stop errors so the UI can continue gracefully.
      void error;
    }
    state.physics = null;
  }
  state.playing = false;
  setToggleState(state, false);
  state.magnets.forEach((magnet) => {
    if (magnet instanceof HTMLElement) {
      magnet.style.removeProperty('transform');
    }
  });
  if (state.customHeight != null) {
    applyBoardHeight(state, state.customHeight);
  } else if (state.height) {
    applyBoardHeight(state, state.height);
  }
}

async function enablePhysics(state) {
  if (!state || state.physics || !state.board) {
    setToggleState(state, !!state?.physics);
    return;
  }
  const activeMagnets = state.magnets.filter((magnet) => magnet instanceof HTMLElement);
  if (!activeMagnets.length) {
    setToggleState(state, false);
    return;
  }
  state.playing = true;
  const { startPhysics } = await loadPhysicsModules();
  state.physics = startPhysics({
    board: state.board,
    magnets: activeMagnets,
    config: NAV_PHYSICS_CONFIG,
    onPositions: (list) => handlePhysicsPositions(state, list),
    getBoardSize: () => ({
      width: state.board.clientWidth,
      height: state.height || state.minHeight || state.measuredHeight || 0,
    }),
    onDragRelease: () => {},
    onTiltPermissionDenied: () => {},
  });
  setToggleState(state, true);
}

function handleToggleRequest(state, active) {
  if (!state) {
    return;
  }
  if (active) {
    enablePhysics(state).catch(() => {
      disablePhysics(state);
    });
  } else {
    disablePhysics(state);
  }
}

function attachToggle(state) {
  if (!state || !state.toggle || state.toggle.dataset.navToggleBound === 'true') {
    if (state?.toggleInput instanceof HTMLInputElement) {
      state.toggleInput.checked = false;
      state.toggleInput.setAttribute('aria-label', 'Enable magnet physics');
    }
    return;
  }

  state.toggle.dataset.navToggleBound = 'true';
  if (state.toggleInput instanceof HTMLInputElement) {
    state.toggleInput.checked = false;
    state.toggleInput.setAttribute('aria-label', 'Enable magnet physics');
    state.toggleInput.addEventListener('change', () => {
      handleToggleRequest(state, state.toggleInput.checked);
    });
  } else {
    state.toggle.addEventListener('click', (event) => {
      event.preventDefault();
      handleToggleRequest(state, !state.playing);
    });
  }
}

function finishResize(state, event) {
  if (!state || !state.resizing || event.pointerId !== state.resizePointerId) {
    return;
  }
  const handle = state.handle;
  if (handle instanceof HTMLElement) {
    try {
      handle.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Ignore capture release errors.
    }
    handle.removeAttribute('data-nav-resizing');
  }
  state.resizing = false;
  state.resizePointerId = null;
  if (state.customHeight != null) {
    applyBoardHeight(state, state.customHeight);
  }
}

function attachResizeHandle(state) {
  if (!state || !(state.handle instanceof HTMLElement) || state.handle.dataset.navResizeBound === 'true') {
    return;
  }
  const handle = state.handle;
  state.handle.dataset.navResizeBound = 'true';

  handle.addEventListener('pointerdown', (event) => {
    if (!(event instanceof PointerEvent)) {
      return;
    }
    if (state.playing) {
      event.preventDefault();
      return;
    }
    state.resizing = true;
    state.resizePointerId = event.pointerId;
    state.resizeStartY = event.clientY;
    state.resizeStartHeight = state.height || state.minHeight || state.measuredHeight || 0;
    state.customHeight = state.resizeStartHeight;
    handle.setPointerCapture(event.pointerId);
    handle.setAttribute('data-nav-resizing', 'true');
    event.preventDefault();
  });

  handle.addEventListener('pointermove', (event) => {
    if (!state.resizing || event.pointerId !== state.resizePointerId) {
      return;
    }
    const deltaY = event.clientY - state.resizeStartY;
    const maxHeight = Math.max(state.maxHeight || state.resizeStartHeight + 320, state.minHeight + 80);
    const nextHeight = clamp(state.resizeStartHeight + deltaY, state.minHeight, maxHeight);
    state.customHeight = nextHeight;
    applyBoardHeight(state, nextHeight);
    event.preventDefault();
  });

  const endHandler = (event) => {
    finishResize(state, event);
  };

  handle.addEventListener('pointerup', endHandler);
  handle.addEventListener('pointercancel', endHandler);
}

function attachResizeObserver(state) {
  if (!state || state.resizeObserver || typeof ResizeObserver !== 'function' || !state.board) {
    return;
  }
  const observer = new ResizeObserver((entries) => {
    if (!entries || !entries.length) {
      return;
    }
    const entry = entries[0];
    const width = entry.contentRect?.width;
    if (!Number.isFinite(width)) {
      return;
    }
    if (state.resizing || state.playing) {
      return;
    }
    if (Math.abs(width - (state.lastWidth || 0)) < 0.5) {
      return;
    }
    state.lastWidth = width;
    scheduleLayout(state);
  });
  observer.observe(state.board);
  state.resizeObserver = observer;
}

function ensureBoardState(board) {
  if (boardStates.has(board)) {
    return boardStates.get(board);
  }

  const wrapper = board.closest('[data-nav-board-wrapper]') || null;
  const nav = board.closest('.site-nav') || null;
  const toggle = wrapper?.querySelector('[data-nav-play-toggle]') || null;
  const toggleInput = toggle?.querySelector('.magnet-play-toggle__input') || null;
  const handle = wrapper?.querySelector('[data-nav-resize-handle]') || null;
  const fontsReady = typeof document !== 'undefined'
    && document.fonts
    && typeof document.fonts.ready?.then === 'function'
      ? document.fonts.ready.catch(() => undefined)
      : Promise.resolve();

  const state = {
    board,
    wrapper,
    nav,
    toggle,
    toggleInput,
    handle,
    magnets: [],
    magnetMap: new Map(),
    positions: new Map(),
    fontsReadyPromise: fontsReady,
    layoutScheduled: false,
    resizing: false,
    resizePointerId: null,
    resizeStartY: 0,
    resizeStartHeight: 0,
    measuredHeight: 0,
    minHeight: 0,
    maxHeight: 0,
    height: 0,
    customHeight: null,
    bottomPadding: 0,
    topPadding: 0,
    lastWidth: 0,
    physics: null,
    playing: false,
    resizeObserver: null,
  };

  attachToggle(state);
  attachResizeHandle(state);
  attachResizeObserver(state);

  boardStates.set(board, state);
  return state;
}

function refresh(nav) {
  const navElement = nav instanceof HTMLElement ? nav : document.querySelector('.site-nav');
  if (!navElement) {
    return;
  }
  const board = getNavBoard(navElement);
  const magnets = board ? Array.from(board.querySelectorAll('.site-nav__magnet')) : [];
  magnets.forEach((magnet, index) => decorateMagnet(magnet, index));

  if (board) {
    const boardState = ensureBoardState(board);
    boardState.magnets = magnets;
    boardState.magnetMap.clear();
    magnets.forEach((magnet, index) => {
      const id = magnet.dataset.magnetId || getMagnetKey(magnet, index);
      boardState.magnetMap.set(id, magnet);
    });
    if (boardState.physics) {
      disablePhysics(boardState);
    }
    scheduleLayout(boardState);
  }

  navElement.setAttribute('data-nav-ready', 'true');
}

const api = {
  refresh,
  decorate: (element, index = 0) => decorateMagnet(element, index),
};

if (typeof window !== 'undefined') {
  window.NVCNavMagnets = api;
}

function initialize() {
  refresh();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
}

export { refresh };
