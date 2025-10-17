import { initMagnetBoard, updateBoardHeight as syncBoardHeightFromDOM } from './magnets/init.js';
import { startPhysics, loadPositions, savePositions } from './magnets/magnetPhysics.js';

const NAV_STORAGE_KEY = 'site-nav';
const ALLOWED_OVERLAP = 6;
const DEFAULT_CONFIG = {
  drift: 1.5,
  damping: 0.975,
  sepRadiusScale: 0.7,
  sepStrength: 18,
  dragSepMultiplier: 2,
  edgeBounce: 0.18,
  mouseRadius: 140,
  mouseStrength: 0.6,
};

const NAV_PHYSICS_CONFIG = {
  drift: 0.06,
  tiltStrength: 52,
  tiltDriftScale: 0.2,
};

const TILT_OPTIONS = [-2, -1, 0, 1, 2];
const OFFSET_OPTIONS = [-3, -2, -1, 0, 1, 2, 3];

const LAYOUT_GAP_X = 12;
const LAYOUT_GAP_Y = 14;
const BOARD_PADDING = 16;
const RESIZE_HANDLE_MARGIN = 64;
const CLICK_SUPPRESS_WINDOW = 150;
const SHUFFLE_LABEL_DEFAULT = 'Shuffle';
const SHUFFLE_LABEL_BUSY = 'Shuffling…';
const TOGGLE_GUARD_MS = 120;

const isNavBoardState = (state) => state?.storageKey === NAV_STORAGE_KEY;

let isToggling = false;
let toggleGuardTimer = null;

const clearToggleGuard = () => {
  if (toggleGuardTimer != null) {
    window.clearTimeout(toggleGuardTimer);
    toggleGuardTimer = null;
  }
  isToggling = false;
};

const beginToggleGuard = () => {
  clearToggleGuard();
  isToggling = true;
  toggleGuardTimer = window.setTimeout(() => {
    isToggling = false;
    toggleGuardTimer = null;
    console.info('[magnets] exitPlay: done');
  }, TOGGLE_GUARD_MS);
};

const getNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now());

const randomFrom = (values) => values[Math.floor(Math.random() * values.length)];

const clamp = (value, min, max) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const fontsReady = typeof document !== 'undefined' && document.fonts && document.fonts.ready
  ? document.fonts.ready.catch(() => undefined)
  : Promise.resolve();

const applyMagnetDecorations = (element, index) => {
  element.classList.add('magnet');
  element.style.order = String(index);
  const tilt = randomFrom(TILT_OPTIONS);
  const offset = randomFrom(OFFSET_OPTIONS);
  element.style.setProperty('--magnet-tilt', `${tilt}deg`);
  element.style.setProperty('--magnet-offset', `${offset}px`);
};

const setMagnetTransform = (magnet) => {
  magnet.element.style.transform =
    `translate3d(${magnet.x}px, ${magnet.y}px, 0) translateY(calc(var(--magnet-offset, 0px) + var(--magnet-hover-offset, 0px))) rotate(var(--magnet-tilt, 0))`;
};

const updateToggleLabel = (toggle, active) => {
  if (!toggle) return;

  const srState = toggle.querySelector('.magnet-play-toggle__sr-state');
  const input = toggle.querySelector('.magnet-play-toggle__input');

  if (!toggle.querySelector('.magnet-play-toggle__track')) {
    toggle.textContent = active ? 'Physics on' : 'Physics off';
  }

  if (srState) {
    srState.textContent = active ? 'Physics is on' : 'Physics is off';
  }

  if (input) {
    input.checked = active;
    input.setAttribute('aria-label', active ? 'Disable magnet physics' : 'Enable magnet physics');
  }

  toggle.dataset.state = active ? 'on' : 'off';
};

const createStorageKey = (index) => {
  const path = window.location.pathname.replace(/index\.html$/i, '');
  return `${path}:${index}`;
};

const parsePx = (value) => {
  const parsed = Number.parseFloat(value || '0');
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseStoredPlayPreference = (meta) => {
  if (!meta || typeof meta !== 'object') {
    return null;
  }
  if (typeof meta.playActive === 'boolean') {
    return meta.playActive;
  }
  if (typeof meta.playState === 'string') {
    if (meta.playState === 'on') {
      return true;
    }
    if (meta.playState === 'off') {
      return false;
    }
  }
  return null;
};

const measureBoardHeight = (board) => {
  if (!board) {
    return 0;
  }
  const rect = board.getBoundingClientRect();
  if (rect && rect.height) {
    return rect.height;
  }
  let computedHeight = 0;
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    computedHeight = parsePx((window.getComputedStyle(board).height) || '0');
  }
  return Math.max(board.clientHeight || 0, computedHeight || 0, 0);
};

const waitForAnimationFrames = async (count = 2) => {
  if (count <= 0) {
    return;
  }
  await new Promise((resolve) => {
    const step = (remaining) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(() => step(remaining - 1));
    };
    window.requestAnimationFrame(() => step(count - 1));
  });
};

const delay = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

const supportsTiltPermissionRequests = () => typeof window !== 'undefined'
  && typeof window.DeviceOrientationEvent !== 'undefined'
  && typeof window.DeviceOrientationEvent.requestPermission === 'function';

const tiltSensorsAvailable = typeof window !== 'undefined'
  && typeof window.DeviceOrientationEvent !== 'undefined';
const tiltPermissionSupported = supportsTiltPermissionRequests();

const tiltSources = new Set();
const tiltPermissionStatus = {
  supported: tiltPermissionSupported,
  available: tiltSensorsAvailable,
  state: tiltPermissionSupported ? 'unknown' : 'granted',
  pending: false,
};

const publishTiltStatus = () => {
  const detail = { ...tiltPermissionStatus };
  if (typeof window !== 'undefined') {
    window.NVCMagnetTiltState = detail;
    window.dispatchEvent(new CustomEvent('magnettiltstatuschange', { detail }));
  }
};

const recomputeTiltStatus = () => {
  let hasGranted = !tiltPermissionStatus.supported;
  let hasDenied = false;
  let hasUnknown = tiltPermissionStatus.supported;
  let pending = false;
  tiltSources.forEach((source) => {
    if (!source) {
      return;
    }
    const permission = source.tiltPermissionState || 'unknown';
    if (source.tiltPermissionRequest) {
      pending = true;
    }
    if (permission === 'granted') {
      hasGranted = true;
    } else if (permission === 'denied') {
      hasDenied = true;
    } else if (permission === 'unknown') {
      hasUnknown = true;
    }
  });

  let nextState;
  if (hasGranted) {
    nextState = 'granted';
  } else if (hasDenied) {
    nextState = 'denied';
  } else if (hasUnknown) {
    nextState = 'unknown';
  } else {
    nextState = tiltPermissionStatus.supported ? 'unknown' : 'granted';
  }

  if (nextState !== tiltPermissionStatus.state || pending !== tiltPermissionStatus.pending) {
    tiltPermissionStatus.state = nextState;
    tiltPermissionStatus.pending = pending;
    globalTiltSource.tiltPermissionState = nextState;
    if (!pending) {
      globalTiltSource.tiltPermissionRequest = null;
    }
    publishTiltStatus();
  }
};

const registerTiltSource = (source) => {
  if (!source) {
    return () => {};
  }
  tiltSources.add(source);
  recomputeTiltStatus();
  return () => {
    tiltSources.delete(source);
    recomputeTiltStatus();
  };
};

const globalTiltSource = {
  tiltPermissionState: tiltPermissionSupported ? 'unknown' : 'granted',
  tiltPermissionRequest: null,
  tiltPermissionLoggedDenied: false,
  root: null,
  cleanupTiltToggleRequest: null,
};

registerTiltSource(globalTiltSource);
publishTiltStatus();

const normalizeTiltPermissionResult = (value) => (value === 'granted' || value === true ? 'granted' : 'denied');

function updateTiltRequestUI(state) {
  if (!state) {
    return;
  }

  const permissionState = state.tiltPermissionState || 'unknown';

  if (
    (permissionState === 'granted' || permissionState === 'denied')
    && typeof state.cleanupTiltToggleRequest === 'function'
  ) {
    state.cleanupTiltToggleRequest();
    state.cleanupTiltToggleRequest = null;
  }

  recomputeTiltStatus();
}

const setTiltPermissionIndicator = (state, status) => {
  if (state?.root) {
    if (status === 'denied') {
      state.root.setAttribute('data-magnet-tilt-permission', 'denied');
    } else {
      state.root.removeAttribute('data-magnet-tilt-permission');
    }
  }
  updateTiltRequestUI(state);
};

const requestTiltPermission = (state) => {
  if (!state) {
    return undefined;
  }

  if (!supportsTiltPermissionRequests()) {
    state.tiltPermissionState = 'granted';
    state.tiltPermissionRequest = null;
    state.tiltPermissionLoggedDenied = false;
    setTiltPermissionIndicator(state, 'granted');
    return undefined;
  }

  if (state.tiltPermissionState === 'granted') {
    state.tiltPermissionLoggedDenied = false;
    setTiltPermissionIndicator(state, 'granted');
    return Promise.resolve('granted');
  }

  if (state.tiltPermissionState === 'denied') {
    setTiltPermissionIndicator(state, 'denied');
    return Promise.resolve('denied');
  }

  if (state.tiltPermissionRequest) {
    return state.tiltPermissionRequest;
  }

  try {
    const request = window.DeviceOrientationEvent.requestPermission();
    if (request && typeof request.then === 'function') {
      state.tiltPermissionRequest = request
        .then((result) => {
          const normalized = normalizeTiltPermissionResult(result);
          state.tiltPermissionState = normalized;
          if (normalized === 'granted') {
            state.tiltPermissionLoggedDenied = false;
          }
          setTiltPermissionIndicator(state, normalized);
          return normalized;
        })
        .catch((error) => {
          state.tiltPermissionState = 'denied';
          setTiltPermissionIndicator(state, 'denied');
          throw error;
        })
        .finally(() => {
          state.tiltPermissionRequest = null;
          updateTiltRequestUI(state);
        });
      updateTiltRequestUI(state);
      return state.tiltPermissionRequest;
    }

    const normalized = normalizeTiltPermissionResult(request);
    state.tiltPermissionState = normalized;
    if (normalized === 'granted') {
      state.tiltPermissionLoggedDenied = false;
    }
    setTiltPermissionIndicator(state, normalized);
    return Promise.resolve(normalized);
  } catch (error) {
    state.tiltPermissionState = 'denied';
    setTiltPermissionIndicator(state, 'denied');
    return Promise.reject(error);
  }
};

const enableTiltForState = (state, permissionPromise) => {
  if (!state?.physics || typeof state.physics.enableTilt !== 'function') {
    return;
  }

  if (!permissionPromise && state.tiltPermissionState === 'granted') {
    state.physics.enableTilt(Promise.resolve('granted'));
    return;
  }

  state.physics.enableTilt(permissionPromise);
};

const requestTiltFromUser = (state) => {
  if (!state) {
    return undefined;
  }

  if (state.tiltPermissionState === 'granted') {
    enableTiltForState(state);
    return undefined;
  }

  if (state.tiltPermissionState === 'denied') {
    updateTiltRequestUI(state);
    return Promise.resolve('denied');
  }

  if (state.tiltPermissionRequest) {
    enableTiltForState(state, state.tiltPermissionRequest);
    return state.tiltPermissionRequest;
  }

  const permissionPromise = requestTiltPermission(state);
  if (permissionPromise && typeof permissionPromise.then === 'function') {
    enableTiltForState(state, permissionPromise);
    return permissionPromise;
  }

  enableTiltForState(state);
  return undefined;
};

const attachTiltPermissionOnToggle = (state) => {
  if (!state) {
    return;
  }
  if (state.tiltPermissionState === 'granted' || state.tiltPermissionState === 'denied') {
    return;
  }
  if (state.cleanupTiltToggleRequest) {
    return;
  }

  if (state.toggleInput) {
    const handler = (event) => {
      if (!event?.target?.checked) {
        return;
      }
      Promise.resolve().then(() => {
        requestTiltFromUser(state);
      });
      if (state.cleanupTiltToggleRequest) {
        state.cleanupTiltToggleRequest();
      }
    };
    state.toggleInput.addEventListener('change', handler);
    state.cleanupTiltToggleRequest = () => {
      if (!state.toggleInput) {
        return;
      }
      state.toggleInput.removeEventListener('change', handler);
      state.cleanupTiltToggleRequest = null;
    };
    return;
  }

  if (state.toggle) {
    const useCapture = true;
    const handler = () => {
      const willActivate = !state.physics;
      if (!willActivate) {
        return;
      }
      Promise.resolve().then(() => {
        requestTiltFromUser(state);
      });
      if (state.cleanupTiltToggleRequest) {
        state.cleanupTiltToggleRequest();
      }
    };
    state.toggle.addEventListener('click', handler, useCapture);
    state.cleanupTiltToggleRequest = () => {
      if (!state.toggle) {
        return;
      }
      state.toggle.removeEventListener('click', handler, useCapture);
      state.cleanupTiltToggleRequest = null;
    };
  }
};

const handleTiltPermissionDenied = (state, reason) => {
  if (!state) {
    return;
  }
  state.tiltPermissionState = 'denied';
  setTiltPermissionIndicator(state, 'denied');
  if (state.tiltPermissionLoggedDenied) {
    return;
  }
  let detail = '';
  if (reason instanceof Error && typeof reason.message === 'string' && reason.message) {
    detail = reason.message;
  } else if (typeof reason === 'string' && reason) {
    detail = reason;
  }
  if (detail) {
    console.info(`[magnets] tilt permission denied; continuing without tilt input (${detail})`);
  } else {
    console.info('[magnets] tilt permission denied; continuing without tilt input');
  }
  state.tiltPermissionLoggedDenied = true;
  updateTiltRequestUI(state);
};

if (typeof window !== 'undefined') {
  window.addEventListener('magnettiltrequest', () => {
    if (!tiltSensorsAvailable) {
      return;
    }
    const boardState = Array.from(tiltSources).find((source) => source && source.board);
    if (boardState) {
      requestTiltFromUser(boardState);
      return;
    }
    requestTiltPermission(globalTiltSource);
  });
}

const waitForStableBoard = async (board, { fontsBarrier = true } = {}) => {
  if (fontsBarrier) {
    await fontsReady;
  }
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await waitForAnimationFrames(2);
    const rect = board.getBoundingClientRect();
    const width = rect.width || board.clientWidth || 0;
    if (width > 0) {
      return rect;
    }
    attempt += 1;
    const backoff = Math.min(50 * attempt, 250);
    await delay(backoff);
  }
};

const createMagnetStates = (board, elements) => {
  const boardRect = board.getBoundingClientRect();
  return elements.map((element) => {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    const width = rect.width || element.offsetWidth || 0;
    const height = rect.height || element.offsetHeight || 0;
    const marginLeft = parsePx(styles.marginLeft);
    const marginRight = parsePx(styles.marginRight);
    const marginTop = parsePx(styles.marginTop);
    const marginBottom = parsePx(styles.marginBottom);
    return {
      id: element.dataset.magnetId || element.id || element.textContent || '',
      element,
      width,
      height,
      marginLeft,
      marginRight,
      marginTop,
      marginBottom,
      outerWidth: width + marginLeft + marginRight,
      outerHeight: height + marginTop + marginBottom,
      x: rect.left - boardRect.left,
      y: rect.top - boardRect.top,
      vx: 0,
      vy: 0,
    };
  });
};

const readBoardMinHeight = (board) => {
  if (!board || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return 0;
  }
  const styles = window.getComputedStyle(board);
  const minHeight = parsePx(styles?.minHeight || '0');
  return Number.isFinite(minHeight) && minHeight > 0 ? minHeight : 0;
};

const remeasureMagnets = (state) => {
  const boardRect = state.board.getBoundingClientRect();
  const updates = state.magnets.map((magnet) => {
    const rect = magnet.element.getBoundingClientRect();
    const styles = window.getComputedStyle(magnet.element);
    return {
      magnet,
      width: rect.width || magnet.element.offsetWidth || magnet.width || 0,
      height: rect.height || magnet.element.offsetHeight || magnet.height || 0,
      marginLeft: parsePx(styles.marginLeft),
      marginRight: parsePx(styles.marginRight),
      marginTop: parsePx(styles.marginTop),
      marginBottom: parsePx(styles.marginBottom),
    };
  });

  updates.forEach((entry) => {
    const { magnet, width, height, marginLeft, marginRight, marginTop, marginBottom } = entry;
    magnet.width = width;
    magnet.height = height;
    magnet.marginLeft = marginLeft;
    magnet.marginRight = marginRight;
    magnet.marginTop = marginTop;
    magnet.marginBottom = marginBottom;
    magnet.outerWidth = width + marginLeft + marginRight;
    magnet.outerHeight = height + marginTop + marginBottom;
  });

  const width = Math.max(boardRect.width || state.board.clientWidth || state.boardWidth || 1, 1);
  const cssMinHeight = readBoardMinHeight(state.board);
  const measuredHeight = Math.max(boardRect.height || state.board.clientHeight || 0, cssMinHeight || 0, 1);
  state.boardWidth = width;
  state.cssMinHeight = cssMinHeight || state.cssMinHeight || 0;
  if (isNavBoardState(state)) {
    if (!Number.isFinite(state.boardHeight) || state.boardHeight <= 0) {
      state.boardHeight = Math.max(measuredHeight, state.cssMinHeight || 0, 1);
    } else if (state.playActive) {
      state.boardHeight = Math.max(state.boardHeight, measuredHeight, state.cssMinHeight || 0, 1);
    }
    state.minHeight = Math.max(state.cssMinHeight || 0, 1);
    if (!state.playActive) {
      state.inactiveHeight = state.boardHeight;
    }
    return;
  }
  const height = Math.max(measuredHeight, state.boardHeight || 0, 1);
  state.boardHeight = Math.max(state.boardHeight || 0, height);
  state.minHeight = cssMinHeight || state.minHeight || height;
  if (!state.playActive) {
    state.inactiveHeight = Math.max(state.inactiveHeight || 0, state.boardHeight);
  }
};

const getMagnetBounds = (magnet) => {
  const left = magnet.x - (magnet.marginLeft || 0);
  const top = magnet.y - (magnet.marginTop || 0);
  const right = left + magnet.width + (magnet.marginLeft || 0) + (magnet.marginRight || 0);
  const bottom = top + magnet.height + (magnet.marginTop || 0) + (magnet.marginBottom || 0);
  return { left, top, right, bottom };
};

const isMagnetOffBoard = (state, magnet) => {
  if (!magnet) {
    return false;
  }
  const bounds = getMagnetBounds(magnet);
  const width = Math.max(state.boardWidth || 0, 0);
  const height = Math.max(state.boardHeight || 0, 0);
  const tolerance = ALLOWED_OVERLAP;
  return bounds.left < -tolerance
    || bounds.top < -tolerance
    || bounds.right > width + tolerance
    || bounds.bottom > height + tolerance;
};

const updateLayoutValidity = (state) => {
  if (!isNavBoardState(state)) {
    return;
  }
  const hasOverlap = layoutHasOverlap(state);
  const hasOffBoard = state.magnets.some((magnet) => isMagnetOffBoard(state, magnet));
  const invalid = hasOverlap || hasOffBoard;
  if (state.root) {
    if (invalid) {
      state.root.dataset.layoutInvalid = '1';
    } else {
      delete state.root.dataset.layoutInvalid;
    }
  }
  if (!invalid) {
    if (state.toggleInput) {
      if (state.toggleInput.disabled) {
        state.toggleInput.disabled = false;
      }
      state.toggleInput.removeAttribute('aria-disabled');
      state.toggleInput.removeAttribute('title');
    }
    if (state.toggle) {
      state.toggle.removeAttribute('aria-disabled');
      state.toggle.removeAttribute('title');
      delete state.toggle.dataset.layoutToggleDisabled;
    }
  }
  state.layoutInvalid = invalid;
};

const layoutHasOverlap = (state) => {
  if (!state || !Array.isArray(state.magnets)) {
    return false;
  }
  const magnets = state.magnets;
  if (isNavBoardState(state)) {
    for (let i = 0; i < magnets.length; i += 1) {
      const a = magnets[i];
      const boundsA = getMagnetBounds(a);
      for (let j = i + 1; j < magnets.length; j += 1) {
        const b = magnets[j];
        const boundsB = getMagnetBounds(b);
        if (
          boundsA.left + ALLOWED_OVERLAP < boundsB.right
          && boundsA.right - ALLOWED_OVERLAP > boundsB.left
          && boundsA.top + ALLOWED_OVERLAP < boundsB.bottom
          && boundsA.bottom - ALLOWED_OVERLAP > boundsB.top
        ) {
          return true;
        }
      }
    }
    return false;
  }
  for (let i = 0; i < magnets.length; i += 1) {
    const a = magnets[i];
    const boundsA = getMagnetBounds(a);
    for (let j = i + 1; j < magnets.length; j += 1) {
      const b = magnets[j];
      const boundsB = getMagnetBounds(b);
      if (
        boundsA.left < boundsB.right
        && boundsA.right > boundsB.left
        && boundsA.top < boundsB.bottom
        && boundsA.bottom > boundsB.top
      ) {
        return true;
      }
    }
  }
  return false;
};

const maybeStartBoardResize = (state, event) => {
  if (!state || !state.board || state.resizeDrag) {
    return false;
  }
  if (event.button != null && event.button !== 0) {
    return false;
  }
  const targetElement = event.target && typeof event.target.closest === 'function'
    ? event.target
    : null;
  const handleElement = targetElement.closest('[data-nav-resize-handle]');
  if (!targetElement || (!state.board.contains(targetElement) && !handleElement)) {
    return false;
  }
  const rect = state.board.getBoundingClientRect();
  const offsetFromBottom = rect.bottom - event.clientY;
  if (!handleElement && (offsetFromBottom < 0 || offsetFromBottom > RESIZE_HANDLE_MARGIN)) {
    return false;
  }
  const minHeight = Math.max(state.minHeight || 0, 1);
  const measuredHeight = Math.max(
    rect.height || state.board.clientHeight || state.boardHeight || minHeight || 0,
    minHeight,
  );
  const startHeight = Math.max(measuredHeight, minHeight);
  state.boardHeight = startHeight;
  if (!state.playActive) {
    state.inactiveHeight = Math.max(state.inactiveHeight || 0, startHeight);
  }
  state.board.style.height = `${startHeight}px`;
  const captureTarget = handleElement || state.board;
  state.resizeDrag = {
    pointerId: event.pointerId,
    startY: event.clientY,
    startHeight,
    minHeight,
    captureTarget,
    handleElement,
    hasHeightChanged: false,
    lastHeight: startHeight,
  };
  state.board.dataset.resizing = '1';
  if (handleElement) {
    handleElement.dataset.active = '1';
  }
  if (captureTarget && typeof captureTarget.setPointerCapture === 'function') {
    try {
      captureTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore capture errors
    }
  }
  return true;
};

const updateBoardResizeDrag = (state, event) => {
  if (!state || !state.board || !state.resizeDrag) {
    return;
  }
  const drag = state.resizeDrag;
  if (drag.pointerId !== event.pointerId) {
    return;
  }
  const deltaY = event.clientY - drag.startY;
  const proposed = Math.round(drag.startHeight + deltaY);
  const nextHeight = Math.max(drag.minHeight, proposed || 0);
  if (!Number.isFinite(nextHeight)) {
    return;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  if (Math.abs(nextHeight - (drag.lastHeight || drag.startHeight || 0)) < 0.75) {
    return;
  }
  drag.lastHeight = nextHeight;
  if (Math.abs(nextHeight - drag.startHeight) >= 1) {
    drag.hasHeightChanged = true;
  }
  state.boardHeight = nextHeight;
  if (!state.playActive) {
    state.inactiveHeight = nextHeight;
  }
  state.board.style.height = `${nextHeight}px`;
};

const finishBoardResize = (state, { pointerId, cancel = false } = {}) => {
  if (!state || !state.board || !state.resizeDrag) {
    return;
  }
  const drag = state.resizeDrag;
  if (pointerId != null && drag.pointerId !== pointerId) {
    return;
  }
  const captureTarget = drag.captureTarget && typeof drag.captureTarget.releasePointerCapture === 'function'
    ? drag.captureTarget
    : state.board;
  if (captureTarget && typeof captureTarget.releasePointerCapture === 'function' && drag.pointerId != null) {
    try {
      captureTarget.releasePointerCapture(drag.pointerId);
    } catch {
      // ignore
    }
  }
  delete state.board.dataset.resizing;
  if (drag.handleElement) {
    delete drag.handleElement.dataset.active;
  }
  state.resizeDrag = null;

  const minimumHeight = Math.max(drag.minHeight || 0, 1);
  const currentHeight = Math.max(state.boardHeight || 0, minimumHeight);

  if (cancel) {
    const revertHeight = Math.max(drag.startHeight, minimumHeight);
    state.boardHeight = revertHeight;
    state.board.style.height = `${revertHeight}px`;
    if (!state.playActive) {
      state.inactiveHeight = revertHeight;
    }
  } else {
    state.boardHeight = currentHeight;
    state.board.style.height = `${currentHeight}px`;
    if (!state.playActive) {
      state.inactiveHeight = currentHeight;
    }

    const changedEnough = drag.hasHeightChanged || Math.abs(currentHeight - drag.startHeight) >= 1;
    if (changedEnough) {
      updateLayout(state);
      persistLayout(state, true);
      state.lastLayoutType = 'manual';
    }
  }

  if (state.pendingResponsiveResize && typeof state.scheduleResponsiveResize === 'function') {
    state.pendingResponsiveResize = false;
    state.scheduleResponsiveResize();
  }
};

const cancelBoardResize = (state) => {
  if (!state || !state.resizeDrag) {
    return;
  }
  finishBoardResize(state, { cancel: true });
};

const updateBoardHeight = (state) => {
  if (isNavBoardState(state)) {
    const minHeight = Math.max(state.cssMinHeight || state.minHeight || 0, 0);
    const height = Math.max(state.boardHeight || 0, minHeight);
    state.boardHeight = height;
    if (!state.playActive) {
      state.inactiveHeight = height;
    }
    state.board.style.height = `${height}px`;
    return;
  }
  let maxBottom = 0;
  state.magnets.forEach((magnet) => {
    const bottom = magnet.y + magnet.height + (magnet.marginBottom || 0);
    maxBottom = Math.max(maxBottom, bottom);
  });
  const baseHeight = state.playActive
    ? (state.minHeight || 0)
    : Math.max(state.minHeight || 0, state.inactiveHeight || 0);
  const height = Math.max(baseHeight, maxBottom + BOARD_PADDING);
  state.boardHeight = height;
  if (!state.playActive) {
    state.inactiveHeight = height;
  }
  state.board.style.height = `${height}px`;
};

const updateLayout = (state) => {
  const width = Math.max(state.boardWidth || 0, 1);
  const height = Math.max(state.boardHeight || 0, 1);
  state.layout.clear();
  state.magnets.forEach((magnet) => {
    const rawXPct = width ? magnet.x / width : 0;
    const rawYPct = height ? magnet.y / height : 0;
    const xPct = isNavBoardState(state) ? rawXPct : clamp(rawXPct, 0, 1);
    const yPct = isNavBoardState(state) ? rawYPct : clamp(rawYPct, 0, 1);
    magnet.xPct = xPct;
    magnet.yPct = yPct;
    state.layout.set(magnet.id, { xPct, yPct });
  });
  updateLayoutValidity(state);
};

const persistLayout = (state, immediate = false) => {
  if (!state.storageKey) {
    return;
  }
  const flush = () => {
    state.saveTimer = null;
    state.lastSaveTime = performance.now();
    if (isNavBoardState(state)) {
      const width = Math.max(state.boardWidth || 0, 1);
      const height = Math.max(state.boardHeight || 0, 1);
      const baseHeight = Math.max(state.minHeight || height || 1, 1);
      const magnetsForSave = state.magnets.map((magnet) => ({
        id: magnet.id,
        x: typeof magnet.xPct === 'number' ? magnet.xPct : (width ? magnet.x / width : 0),
        y: typeof magnet.yPct === 'number' ? magnet.yPct : (height ? magnet.y / height : 0),
      }));
      const heightRatio = baseHeight ? state.boardHeight / baseHeight : 1;
      savePositions(
        state.storageKey,
        { width: 1, height: 1 },
        magnetsForSave,
        heightRatio,
        { normalized: true, meta: { playActive: Boolean(state.playActive) } },
      );
      return;
    }
    savePositions(
      state.storageKey,
      { width: Math.max(state.boardWidth || 0, 1), height: Math.max(state.boardHeight || 0, 1) },
      state.magnets,
    );
  };

  if (immediate) {
    flush();
    return;
  }

  const now = performance.now();
  if (now - state.lastSaveTime > 500) {
    flush();
    return;
  }

  if (state.saveTimer != null) {
    return;
  }
  const delay = Math.max(100, 500 - (now - state.lastSaveTime));
  state.saveTimer = window.setTimeout(() => {
    flush();
  }, delay);
};

const restoreLayoutFromPercentages = (state, { persist = false } = {}) => {
  console.info('[magnets] reseed CALLED', 'restoreLayoutFromPercentages');
  const width = Math.max(state.boardWidth || 0, 1);
  const height = isNavBoardState(state)
    ? Math.max(state.boardHeight || 0, 1)
    : Math.max(Math.max(state.boardHeight || 0, state.minHeight || 0), 1);
  const placements = state.magnets.map((magnet) => {
    const percentages = state.layout.get(magnet.id);
    if (!percentages) {
      return { magnet, x: magnet.x, y: magnet.y };
    }
    if (isNavBoardState(state)) {
      const x = (percentages.xPct || 0) * width;
      const y = (percentages.yPct || 0) * height;
      return { magnet, x, y };
    }
    const maxX = Math.max(width - magnet.width, 0);
    const maxY = Math.max(height - magnet.height, 0);
    const x = clamp((percentages.xPct || 0) * width, 0, maxX);
    const y = clamp((percentages.yPct || 0) * height, 0, maxY);
    return { magnet, x, y };
  });

  placements.forEach(({ magnet, x, y }) => {
    magnet.x = x;
    magnet.y = y;
    setMagnetTransform(magnet);
  });

  updateBoardHeight(state);
  if (persist) {
    updateLayout(state);
    persistLayout(state);
  }
};

const applyRowPackedLayout = (state, order, { persist = false } = {}) => {
  console.info('[magnets] reseed CALLED', 'applyRowPackedLayout');
  const width = Math.max(state.boardWidth || 0, 1);
  const startX = LAYOUT_GAP_X;
  const startY = LAYOUT_GAP_Y;
  let cursorX = startX;
  let cursorY = startY;
  let rowHeight = 0;
  let maxBottom = startY;

  const placements = order.map((magnet) => {
    const marginLeft = magnet.marginLeft || 0;
    const marginRight = magnet.marginRight || 0;
    const marginTop = magnet.marginTop || 0;
    const marginBottom = magnet.marginBottom || 0;
    const footprintWidth = magnet.width + marginLeft + marginRight;
    const footprintHeight = magnet.height + marginTop + marginBottom;
    if (cursorX > startX && cursorX + footprintWidth + LAYOUT_GAP_X > width) {
      cursorX = startX;
      cursorY += rowHeight + LAYOUT_GAP_Y;
      rowHeight = 0;
    }
    const maxX = Math.max(width - magnet.width, 0);
    const x = clamp(cursorX + marginLeft, 0, maxX);
    const y = cursorY + marginTop;
    cursorX += footprintWidth + LAYOUT_GAP_X;
    rowHeight = Math.max(rowHeight, footprintHeight);
    maxBottom = Math.max(maxBottom, y + magnet.height + marginBottom);
    return { magnet, x, y };
  });

  placements.forEach(({ magnet, x, y }) => {
    magnet.x = x;
    magnet.y = y;
    setMagnetTransform(magnet);
  });

  const height = Math.max(state.minHeight, maxBottom + BOARD_PADDING);
  state.boardHeight = height;
  state.board.style.height = `${height}px`;
  updateLayout(state);
  if (persist) {
    persistLayout(state, true);
  }
  state.lastSeedWidth = state.boardWidth;
  state.lastLayoutType = 'seed';
};

const clampMagnetToBoard = (state, magnet) => {
  if (!magnet) {
    return false;
  }
  const width = Math.max(state.boardWidth || 0, 0);
  const height = Math.max(state.boardHeight || 0, 0);
  if (width <= 0 || height <= 0) {
    return false;
  }
  const bounds = getMagnetBounds(magnet);
  let nextX = magnet.x;
  let nextY = magnet.y;
  if (bounds.left < 0) {
    nextX += -bounds.left;
  } else if (bounds.right > width) {
    nextX -= (bounds.right - width);
  }
  if (bounds.top < 0) {
    nextY += -bounds.top;
  } else if (bounds.bottom > height) {
    nextY -= (bounds.bottom - height);
  }
  if (nextX !== magnet.x || nextY !== magnet.y) {
    magnet.x = nextX;
    magnet.y = nextY;
    return true;
  }
  return false;
};

const separateNavMagnets = (state, magnetA, magnetB) => {
  if (!magnetA || !magnetB) {
    return false;
  }
  const boundsA = getMagnetBounds(magnetA);
  const boundsB = getMagnetBounds(magnetB);
  const overlapLeft = Math.max(boundsA.left + ALLOWED_OVERLAP, boundsB.left + ALLOWED_OVERLAP);
  const overlapRight = Math.min(boundsA.right - ALLOWED_OVERLAP, boundsB.right - ALLOWED_OVERLAP);
  const overlapTop = Math.max(boundsA.top + ALLOWED_OVERLAP, boundsB.top + ALLOWED_OVERLAP);
  const overlapBottom = Math.min(boundsA.bottom - ALLOWED_OVERLAP, boundsB.bottom - ALLOWED_OVERLAP);
  const overlapX = overlapRight - overlapLeft;
  const overlapY = overlapBottom - overlapTop;
  if (overlapX <= 0 || overlapY <= 0) {
    return false;
  }

  const moveHorizontal = overlapX <= overlapY;
  if (moveHorizontal) {
    const shift = overlapX / 2;
    const centerA = (boundsA.left + boundsA.right) / 2;
    const centerB = (boundsB.left + boundsB.right) / 2;
    if (centerA <= centerB) {
      magnetA.x -= shift;
      magnetB.x += shift;
    } else {
      magnetA.x += shift;
      magnetB.x -= shift;
    }
  } else {
    const shift = overlapY / 2;
    const centerA = (boundsA.top + boundsA.bottom) / 2;
    const centerB = (boundsB.top + boundsB.bottom) / 2;
    if (centerA <= centerB) {
      magnetA.y -= shift;
      magnetB.y += shift;
    } else {
      magnetA.y += shift;
      magnetB.y -= shift;
    }
  }
  return true;
};

const resolveNavLayoutToNearestValid = (state) => {
  if (!isNavBoardState(state) || !state || !Array.isArray(state.magnets) || !state.magnets.length) {
    return false;
  }
  const visibleMagnets = state.magnets.filter((magnet) => {
    if (!magnet?.element) {
      return false;
    }
    if (magnet.element.hidden) {
      return false;
    }
    return magnet.element.offsetParent !== null;
  });
  const magnets = visibleMagnets.length ? visibleMagnets : state.magnets;
  if (!magnets.length) {
    return false;
  }

  let changed = false;
  const clampAll = () => {
    let clamped = false;
    magnets.forEach((magnet) => {
      if (clampMagnetToBoard(state, magnet)) {
        clamped = true;
        changed = true;
      }
    });
    return clamped;
  };

  clampAll();
  const maxIterations = 80;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let resolvedAny = false;
    for (let i = 0; i < magnets.length; i += 1) {
      const magnetA = magnets[i];
      for (let j = i + 1; j < magnets.length; j += 1) {
        const magnetB = magnets[j];
        if (separateNavMagnets(state, magnetA, magnetB)) {
          resolvedAny = true;
          changed = true;
        }
      }
    }
    if (!resolvedAny) {
      break;
    }
    clampAll();
  }

  const stillInvalid = layoutHasOverlap(state) || magnets.some((magnet) => isMagnetOffBoard(state, magnet));
  if (stillInvalid) {
    applyRowPackedLayout(state, state.magnets, { persist: false });
    state.inactiveHeight = state.boardHeight;
    return true;
  }

  if (changed) {
    magnets.forEach((magnet) => {
      setMagnetTransform(magnet);
    });
  }
  return changed;
};

const shuffleWithoutPhysics = (state) => {
  const order = state.magnets.slice();
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  applyRowPackedLayout(state, order, { persist: true });
};

const handlePositionsUpdate = (state, list) => {
  list.forEach((item) => {
    const magnet = state.magnetMap.get(item.id);
    if (!magnet) {
      return;
    }
    magnet.x = item.x;
    magnet.y = item.y;
  });
  updateBoardHeight(state);
  updateLayout(state);
  persistLayout(state);
};

const stopPhysicsLoop = (state) => {
  if (state.physics) {
    state.physics.stop();
    state.physics = null;
  }
};

const setPlayState = (state, active) => {
  cancelBoardResize(state);
  let persistedToggle = false;
  if (!active && state.isShuffling) {
    state.isShuffling = false;
    if (state.shuffleButton) {
      state.shuffleButton.disabled = false;
      state.shuffleButton.textContent = state.shuffleButton.dataset.originalLabel || SHUFFLE_LABEL_DEFAULT;
      state.shuffleButton.removeAttribute('aria-busy');
      state.shuffleButton.removeAttribute('aria-disabled');
    }
  }
  if (active) {
    if (state.physics) {
      return;
    }
    clearToggleGuard();
    console.info('[magnets] enterPlay: begin');
    isToggling = true;
    state.playActive = true;
    if (state.shuffleButton) {
      state.shuffleButton.disabled = false;
      state.shuffleButton.textContent = state.shuffleButton.dataset.originalLabel || state.shuffleButton.textContent;
      state.shuffleButton.removeAttribute('aria-busy');
      state.shuffleButton.removeAttribute('aria-disabled');
    }
    state.board.dataset.active = '1';
    state.root?.setAttribute('data-magnet-active', '1');
    state.magnets.forEach((magnet) => {
      magnet.element.setAttribute('draggable', 'false');
    });
    const magnetElements = state.magnets.map((magnet) => magnet.element);
    const physicsConfig = isNavBoardState(state)
      ? { ...DEFAULT_CONFIG, ...NAV_PHYSICS_CONFIG }
      : { ...DEFAULT_CONFIG };

    state.physics = startPhysics({
      board: state.board,
      magnets: magnetElements,
      config: physicsConfig,
      onPositions: (list) => handlePositionsUpdate(state, list),
      getBoardSize: () => ({ width: state.boardWidth, height: state.boardHeight }),
      onDragRelease: () => state.setClickSuppress(),
      onTiltPermissionDenied: (reason) => handleTiltPermissionDenied(state, reason),
    });
    if (state.tiltPermissionState === 'granted') {
      enableTiltForState(state);
    } else if (state.tiltPermissionRequest) {
      enableTiltForState(state, state.tiltPermissionRequest);
    }
    if (isNavBoardState(state)) {
      updateLayout(state);
      persistLayout(state, true);
      persistedToggle = true;
    }
    isToggling = false;
    console.info('[magnets] enterPlay: done');
  } else {
    if (state.physics) {
      console.info('[magnets] exitPlay: begin');
      clearToggleGuard();
      isToggling = true;
      stopPhysicsLoop(state);
      delete state.board.dataset.active;
      state.root?.removeAttribute('data-magnet-active');
      state.magnets.forEach((magnet) => {
        magnet.element.removeAttribute('draggable');
      });
      state.suppressUntil = 0;
      state.playActive = false;
      const measuredHeight = measureBoardHeight(state.board);
      if (measuredHeight > 0) {
        if (isNavBoardState(state)) {
          const minHeight = Math.max(state.cssMinHeight || state.minHeight || 0, 0);
          const resolvedHeight = Math.max(measuredHeight, minHeight);
          state.boardHeight = resolvedHeight;
          state.inactiveHeight = resolvedHeight;
        } else {
          state.boardHeight = Math.max(measuredHeight, state.boardHeight || 0, state.minHeight || 0);
          state.inactiveHeight = state.boardHeight;
        }
      }
      updateBoardHeight(state);
      const magnetElements = state.magnets.map((magnet) => magnet.element);
      const syncedHeight = syncBoardHeightFromDOM(state.board, magnetElements);
      if (typeof syncedHeight === 'number' && syncedHeight > 0) {
        if (isNavBoardState(state)) {
          const minHeight = Math.max(state.cssMinHeight || state.minHeight || 0, 0);
          const resolvedHeight = Math.max(syncedHeight, minHeight);
          state.boardHeight = resolvedHeight;
          state.inactiveHeight = resolvedHeight;
        } else {
          const resolvedHeight = Math.max(syncedHeight, state.minHeight || 0, state.boardHeight || 0);
          state.boardHeight = resolvedHeight;
          state.inactiveHeight = resolvedHeight;
        }
      }
      if (isNavBoardState(state)) {
        resolveNavLayoutToNearestValid(state);
      }
      updateLayout(state);
      persistLayout(state, true);
      persistedToggle = true;
      state.lastLayoutType = 'manual';
      beginToggleGuard();
    }
  }
  state.playActive = active;
  updateToggleLabel(state.toggle, active);
  if (isNavBoardState(state) && !persistedToggle) {
    updateLayout(state);
    persistLayout(state, true);
  }
};

const enterSearchMode = (state) => {
  if (!state || state.searchActive) {
    return;
  }
  cancelBoardResize(state);
  state.searchActive = true;
  state.searchWasPlaying = state.playActive;
  if (state.playActive) {
    setPlayState(state, false);
  }
  if (state.boardWrapper) {
    state.boardWrapper.dataset.magnetSearchPrevHidden = state.boardWrapper.hidden ? '1' : '0';
    state.boardWrapper.hidden = true;
  } else if (state.board) {
    state.board.dataset.magnetSearchPrevHidden = state.board.hidden ? '1' : '0';
    state.board.hidden = true;
  }
  if (state.shuffleButton) {
    state.shuffleButton.dataset.magnetSearchPrevDisabled = state.shuffleButton.disabled ? '1' : '0';
    state.shuffleButton.disabled = true;
    state.shuffleButton.setAttribute('aria-disabled', 'true');
  }
  if (state.root) {
    state.root.setAttribute('data-magnet-search-active', '1');
  }
};

const exitSearchMode = (state) => {
  if (!state || !state.searchActive) {
    if (state?.searchResults) {
      state.searchResults.hidden = true;
    }
    if (state?.searchCount) {
      state.searchCount.hidden = true;
      state.searchCount.textContent = '';
    }
    if (state?.searchList) {
      state.searchList.innerHTML = '';
    }
    return;
  }
  state.searchActive = false;
  if (state.root) {
    state.root.removeAttribute('data-magnet-search-active');
  }
  if (state.boardWrapper) {
    const prevHidden = state.boardWrapper.dataset.magnetSearchPrevHidden === '1';
    delete state.boardWrapper.dataset.magnetSearchPrevHidden;
    state.boardWrapper.hidden = prevHidden;
  } else if (state.board) {
    const prevHidden = state.board.dataset.magnetSearchPrevHidden === '1';
    delete state.board.dataset.magnetSearchPrevHidden;
    state.board.hidden = prevHidden;
  }
  if (state.shuffleButton) {
    const wasDisabled = state.shuffleButton.dataset.magnetSearchPrevDisabled === '1';
    delete state.shuffleButton.dataset.magnetSearchPrevDisabled;
    if (wasDisabled) {
      state.shuffleButton.disabled = true;
      state.shuffleButton.setAttribute('aria-disabled', 'true');
    } else if (!state.isShuffling) {
      state.shuffleButton.disabled = false;
      state.shuffleButton.removeAttribute('aria-disabled');
    }
  }
  if (state.searchResults) {
    state.searchResults.hidden = true;
  }
  if (state.searchCount) {
    state.searchCount.hidden = true;
    state.searchCount.textContent = '';
  }
  if (state.searchList) {
    state.searchList.innerHTML = '';
  }
  if (state.searchWasPlaying) {
    setPlayState(state, true);
  }
  state.searchWasPlaying = false;
};

const renderSearchResults = (state, matches, query) => {
  if (!state || !state.searchResults || !state.searchList || !state.searchCount) {
    return;
  }
  const trimmedQuery = (query || '').trim();
  state.searchList.innerHTML = '';
  if (matches.length) {
    const fragment = document.createDocumentFragment();
    matches.forEach((magnet) => {
      if (!magnet || !magnet.element) {
        return;
      }
      const item = document.createElement('li');
      item.className = 'magnet-search__item';
      const link = document.createElement('a');
      link.className = 'pill magnet-search__link';
      link.textContent = magnet.searchLabel || magnet.element.textContent || '';
      link.setAttribute('data-magnet-search-result', magnet.id);
      if (magnet.href) {
        link.setAttribute('href', magnet.href);
      } else if (magnet.element instanceof HTMLAnchorElement && magnet.element.href) {
        link.href = magnet.element.href;
      } else {
        link.setAttribute('href', '#');
      }
      const target = magnet.element.getAttribute ? magnet.element.getAttribute('target') : null;
      if (target) {
        link.setAttribute('target', target);
      }
      const rel = magnet.element.getAttribute ? magnet.element.getAttribute('rel') : null;
      if (rel) {
        link.setAttribute('rel', rel);
      }
      item.appendChild(link);
      fragment.appendChild(item);
    });
    state.searchList.appendChild(fragment);
  }
  state.searchResults.hidden = false;
  if (matches.length) {
    const label = matches.length === 1 ? 'Found 1 match' : `Found ${matches.length} matches`;
    state.searchCount.textContent = `${label} for “${trimmedQuery}”`;
  } else {
    state.searchCount.textContent = trimmedQuery ? `No matches for “${trimmedQuery}”` : '';
  }
  state.searchCount.hidden = !state.searchCount.textContent;
};

const applySearchQuery = (state, queryRaw) => {
  if (!state || !state.searchInput || !state.searchResults || !state.searchList || !state.searchCount) {
    return;
  }
  const query = typeof queryRaw === 'string' ? queryRaw.trim() : '';
  if (!query) {
    exitSearchMode(state);
    return;
  }
  const normalized = query.toLocaleLowerCase();
  const matches = state.magnets.filter((magnet) => {
    if (!magnet || typeof magnet.searchValue !== 'string') {
      return false;
    }
    return magnet.searchValue.includes(normalized);
  });
  enterSearchMode(state);
  renderSearchResults(state, matches, query);
};

const attachSearch = (state) => {
  if (!state || !state.searchInput || !state.searchResults || !state.searchList || !state.searchCount) {
    return;
  }
  const handleSearchInput = (event) => {
    applySearchQuery(state, event?.target?.value || '');
  };
  state.searchInput.addEventListener('input', handleSearchInput);
  state.searchInput.addEventListener('search', handleSearchInput);
  state.cleanupSearch = () => {
    state.searchInput.removeEventListener('input', handleSearchInput);
    state.searchInput.removeEventListener('search', handleSearchInput);
  };
  if (state.searchInput.value) {
    applySearchQuery(state, state.searchInput.value);
  }
};

const initializeBoard = async (root, index) => {
  const board = root.querySelector('[data-magnet-board]');
  if (!board) {
    return;
  }
  const toggle = root.querySelector('[data-magnet-toggle]');
  const toggleInput = toggle?.querySelector('.magnet-play-toggle__input');
  const shuffleButton = root.querySelector('[data-magnet-shuffle]');
  const magnetElements = Array.from(board.querySelectorAll('.magnet'));
  if (!magnetElements.length) {
    return;
  }

  const fastInit = Boolean(root.dataset.magnetFastInit) || Boolean(root.dataset.magnetKey);

  await initMagnetBoard(board, magnetElements, { fontsBarrier: !fastInit });

  magnetElements.forEach((element, magnetIndex) => {
    const id = element.dataset.magnetId || `${index}-${magnetIndex}`;
    element.dataset.magnetId = id;
    applyMagnetDecorations(element, magnetIndex);
  });

  const boardRect = await waitForStableBoard(board, { fontsBarrier: !fastInit });
  const measured = createMagnetStates(board, magnetElements);
  const boardWrapper = root.querySelector('.magnet-board-wrapper');
  const searchContainer = root.querySelector('[data-magnet-search]');
  const searchInput = searchContainer?.querySelector('[data-magnet-search-input]');
  const searchResults = searchContainer?.querySelector('[data-magnet-search-results]');
  const searchCount = searchContainer?.querySelector('[data-magnet-search-count]');
  const searchList = searchContainer?.querySelector('[data-magnet-search-list]');

  measured.forEach((magnet) => {
    const label = (magnet.element.textContent || '').trim();
    magnet.searchLabel = label;
    magnet.searchValue = label.toLocaleLowerCase();
    const hrefAttr = magnet.element.getAttribute ? magnet.element.getAttribute('href') : null;
    if (hrefAttr) {
      magnet.href = hrefAttr;
    } else if (magnet.element instanceof HTMLAnchorElement && magnet.element.href) {
      magnet.href = magnet.element.href;
    } else {
      magnet.href = '';
    }
  });
  const customStorageKey = root.dataset.magnetKey;
  const resolvedStorageKey = customStorageKey || createStorageKey(index);

  const cssMinHeight = readBoardMinHeight(board) || Math.max(boardRect.height || board.clientHeight || 1, 1);
  const initialHeight = Math.max(
    boardRect.height || board.clientHeight || cssMinHeight || 1,
    cssMinHeight || 1,
  );

  let storedPlayPreference = null;

  const state = {
    root,
    board,
    boardWrapper,
    toggle,
    toggleInput,
    shuffleButton,
    searchContainer,
    searchInput,
    searchResults,
    searchCount,
    searchList,
    storageKey: resolvedStorageKey,
    magnets: measured,
    magnetMap: new Map(),
    layout: new Map(),
    physics: null,
    boardWidth: Math.max(boardRect.width || board.clientWidth || 1, 1),
    boardHeight: initialHeight,
    minHeight: cssMinHeight || initialHeight,
    cssMinHeight: cssMinHeight || 0,
    inactiveHeight: initialHeight,
    saveTimer: null,
    lastSaveTime: 0,
    resizeObserver: null,
    cleanupResize: null,
    resizeDrag: null,
    playActive: false,
    suppressUntil: 0,
    lastSeedWidth: Math.max(boardRect.width || board.clientWidth || 1, 1),
    lastLayoutType: 'seed',
    resizeScheduled: false,
    pendingResponsiveResize: false,
    scheduleResponsiveResize: null,
    isShuffling: false,
    tiltPermissionState: globalTiltSource.tiltPermissionState,
    tiltPermissionRequest: globalTiltSource.tiltPermissionRequest,
    tiltPermissionLoggedDenied: globalTiltSource.tiltPermissionState === 'denied',
    cleanupTiltToggleRequest: null,
    searchActive: false,
    searchWasPlaying: false,
    cleanupSearch: null,
  };

  state.setClickSuppress = () => {
    state.suppressUntil = getNow() + CLICK_SUPPRESS_WINDOW;
  };

  registerTiltSource(state);
  updateTiltRequestUI(state);

  board.addEventListener('click', (event) => {
    if (!state.playActive) {
      return;
    }
    if (getNow() < state.suppressUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  measured.forEach((magnet) => {
    magnet.id = magnet.id || `${index}-${state.magnetMap.size}`;
    state.magnetMap.set(magnet.id, magnet);
  });

  board.style.height = `${state.boardHeight}px`;
  board.classList.add('no-transitions');

  if (root?.dataset?.magnetKey === NAV_STORAGE_KEY) {
    board.dataset.navResizable = '1';
    let resizeHandle = board.querySelector('[data-nav-resize-handle]');
    if (!resizeHandle) {
      resizeHandle = document.createElement('div');
      resizeHandle.className = 'site-nav__board-resize-handle';
      resizeHandle.dataset.navResizeHandle = '1';
      resizeHandle.setAttribute('aria-hidden', 'true');
      resizeHandle.setAttribute('role', 'presentation');
      resizeHandle.tabIndex = -1;
      resizeHandle.style.height = `${RESIZE_HANDLE_MARGIN}px`;
      board.appendChild(resizeHandle);
    }
    const handleBoardPointerDown = (event) => {
      if (maybeStartBoardResize(state, event)) {
        event.preventDefault();
      }
    };
    const handleBoardPointerMove = (event) => {
      updateBoardResizeDrag(state, event);
    };
    const handleBoardPointerUp = (event) => {
      finishBoardResize(state, { pointerId: event.pointerId });
    };
    const handleBoardPointerCancel = (event) => {
      finishBoardResize(state, { pointerId: event.pointerId, cancel: true });
    };
    const handleLostPointerCapture = (event) => {
      finishBoardResize(state, { pointerId: event.pointerId });
    };
    board.addEventListener('pointerdown', handleBoardPointerDown);
    board.addEventListener('pointermove', handleBoardPointerMove);
    board.addEventListener('pointerup', handleBoardPointerUp);
    board.addEventListener('pointercancel', handleBoardPointerCancel);
    board.addEventListener('lostpointercapture', handleLostPointerCapture);
    if (resizeHandle) {
      resizeHandle.addEventListener('pointerdown', handleBoardPointerDown);
      resizeHandle.addEventListener('pointermove', handleBoardPointerMove);
      resizeHandle.addEventListener('pointerup', handleBoardPointerUp);
      resizeHandle.addEventListener('pointercancel', handleBoardPointerCancel);
      resizeHandle.addEventListener('lostpointercapture', handleLostPointerCapture);
    }
  }

  const sizeMap = new Map(state.magnets.map((magnet) => [magnet.id, { width: magnet.width, height: magnet.height }]));
  const loadSize = isNavBoardState(state)
    ? { width: 1, height: 1 }
    : { width: state.boardWidth, height: state.boardHeight };
  const loadOptions = isNavBoardState(state) ? { normalized: true } : undefined;
  const storedResult = loadPositions(
    state.storageKey,
    loadSize,
    sizeMap,
    loadOptions,
  );
  if (isNavBoardState(state)) {
    const preferredPlay = parseStoredPlayPreference(storedResult?.meta);
    if (preferredPlay != null) {
      storedPlayPreference = preferredPlay;
    }
  }
  const stored = storedResult?.magnets || null;
  const storedBoardHeightRaw = storedResult?.boardHeight;
  if (typeof storedBoardHeightRaw === 'number' && storedBoardHeightRaw > 0) {
    if (isNavBoardState(state)) {
      const baseHeight = Math.max(state.minHeight || state.boardHeight || 1, 1);
      const resolvedHeight = Math.max(storedBoardHeightRaw * baseHeight, state.cssMinHeight || 0);
      state.boardHeight = resolvedHeight;
      state.inactiveHeight = resolvedHeight;
      state.board.style.height = `${resolvedHeight}px`;
    } else {
      const storedBoardHeight = Math.max(storedBoardHeightRaw, state.minHeight || 0);
      state.boardHeight = storedBoardHeight;
      state.inactiveHeight = storedBoardHeight;
      state.board.style.height = `${storedBoardHeight}px`;
    }
  }

  let shouldSeed = true;
  if (stored && stored.length) {
    shouldSeed = false;
    const storedById = new Map(stored.map((item) => [item.id, item]));
    const newMagnets = [];
    let hasStoredPlacement = false;
    let maxBottom = 0;
    state.magnets.forEach((magnet) => {
      const saved = storedById.get(magnet.id);
      if (saved) {
        hasStoredPlacement = true;
        if (isNavBoardState(state)) {
          magnet.x = saved.x * state.boardWidth;
          magnet.y = saved.y * state.boardHeight;
        } else {
          magnet.x = saved.x;
          magnet.y = saved.y;
        }
        setMagnetTransform(magnet);
        const bottom = magnet.y + magnet.height + (magnet.marginBottom || 0);
        maxBottom = Math.max(maxBottom, bottom);
      } else {
        newMagnets.push(magnet);
      }
    });

    if (!hasStoredPlacement) {
      shouldSeed = true;
    } else if (newMagnets.length) {
      const width = Math.max(state.boardWidth || 0, 1);
      const startX = LAYOUT_GAP_X;
      const startY = maxBottom ? maxBottom + LAYOUT_GAP_Y : LAYOUT_GAP_Y;
      let cursorX = startX;
      let cursorY = startY;
      let rowHeight = 0;
      newMagnets.forEach((magnet) => {
        const marginLeft = magnet.marginLeft || 0;
        const marginRight = magnet.marginRight || 0;
        const marginTop = magnet.marginTop || 0;
        const marginBottom = magnet.marginBottom || 0;
        const footprintWidth = magnet.width + marginLeft + marginRight;
        const footprintHeight = magnet.height + marginTop + marginBottom;
        if (cursorX > startX && cursorX + footprintWidth + LAYOUT_GAP_X > width) {
          cursorX = startX;
          cursorY += rowHeight + LAYOUT_GAP_Y;
          rowHeight = 0;
        }
        const maxX = Math.max(width - magnet.width, 0);
        const x = clamp(cursorX + marginLeft, 0, maxX);
        const y = cursorY + marginTop;
        magnet.x = x;
        magnet.y = y;
        setMagnetTransform(magnet);
        cursorX += footprintWidth + LAYOUT_GAP_X;
        rowHeight = Math.max(rowHeight, footprintHeight);
        const bottom = magnet.y + magnet.height + marginBottom;
        maxBottom = Math.max(maxBottom, bottom);
      });
    } else {
      state.magnets.forEach((magnet) => {
        setMagnetTransform(magnet);
      });
    }

    updateBoardHeight(state);
    updateLayout(state);
    state.lastLayoutType = 'restored';
    if (!isNavBoardState(state) && layoutHasOverlap(state)) {
      shouldSeed = true;
    }
  }

  if (shouldSeed) {
    applyRowPackedLayout(state, state.magnets, { persist: true });
  } else {
    state.board.style.height = `${state.boardHeight}px`;
  }

  board.dataset.ready = '1';

  requestAnimationFrame(() => {
    board.classList.remove('no-transitions');
  });

  const scheduleResponsiveResize = () => {
    if (state.resizeDrag) {
      state.pendingResponsiveResize = true;
      return;
    }
    if (state.resizeScheduled) {
      return;
    }
    if (state.isShuffling) {
      return;
    }
    if (isToggling) {
      console.info('[magnets] resize ignored (toggling)');
      return;
    }
    state.pendingResponsiveResize = false;
    state.resizeScheduled = true;
    Promise.resolve().then(async () => {
      if (state.isShuffling) {
        state.resizeScheduled = false;
        return;
      }
      if (isToggling) {
        state.resizeScheduled = false;
        console.info('[magnets] resize ignored (toggling)');
        return;
      }
      if (state.resizeDrag) {
        state.resizeScheduled = false;
        state.pendingResponsiveResize = true;
        return;
      }
      state.resizeScheduled = false;
      const previousWidth = state.boardWidth;
      await waitForAnimationFrames(2);
      if (state.resizeDrag) {
        state.pendingResponsiveResize = true;
        return;
      }
      remeasureMagnets(state);
      const width = state.boardWidth;
      const widthChanged = Math.abs(width - previousWidth) > 0.5;

      if (state.playActive) {
        updateBoardHeight(state);
        updateLayout(state);
        return;
      }

      if (!widthChanged && state.lastLayoutType !== 'manual') {
        updateBoardHeight(state);
        return;
      }

      if (state.lastLayoutType === 'manual') {
        if (widthChanged) {
          restoreLayoutFromPercentages(state, { persist: false });
        } else {
          updateBoardHeight(state);
        }
        updateLayout(state);
        persistLayout(state, true);
        state.lastLayoutType = 'manual';
        return;
      }

      if (isNavBoardState(state)) {
        updateBoardHeight(state);
        updateLayout(state);
        persistLayout(state, true);
        state.lastLayoutType = 'manual';
        return;
      }

      applyRowPackedLayout(state, state.magnets, { persist: true });
    }).catch(() => {});
  };

  state.scheduleResponsiveResize = scheduleResponsiveResize;

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => {
      scheduleResponsiveResize();
    });
    observer.observe(board);
    state.resizeObserver = observer;
  } else {
    const handleResize = () => {
      scheduleResponsiveResize();
    };
    window.addEventListener('resize', handleResize);
    state.cleanupResize = () => window.removeEventListener('resize', handleResize);
  }

  const initialActive = storedPlayPreference != null
    ? storedPlayPreference
    : (state.toggleInput
      ? state.toggleInput.checked
      : toggle?.dataset.state !== 'off');

  if (state.toggleInput) {
    state.toggleInput.addEventListener('change', () => {
      setPlayState(state, state.toggleInput.checked);
    });
  } else if (toggle) {
    toggle.addEventListener('click', () => {
      const shouldActivate = !state.physics;
      setPlayState(state, shouldActivate);
    });
  }

  attachTiltPermissionOnToggle(state);

  if (shuffleButton) {
    shuffleButton.addEventListener('click', () => {
      if (state.isShuffling) {
        return;
      }
      if (state.physics && state.physics.shuffle) {
        state.isShuffling = true;
        const originalLabel = shuffleButton.dataset.originalLabel || shuffleButton.textContent || SHUFFLE_LABEL_DEFAULT;
        shuffleButton.dataset.originalLabel = originalLabel;
        shuffleButton.textContent = SHUFFLE_LABEL_BUSY;
        shuffleButton.setAttribute('aria-busy', 'true');
        shuffleButton.disabled = true;
        shuffleButton.setAttribute('aria-disabled', 'true');
        Promise.resolve(state.physics.shuffle())
          .catch(() => {})
          .finally(() => {
            state.isShuffling = false;
            shuffleButton.disabled = false;
            shuffleButton.textContent = shuffleButton.dataset.originalLabel || SHUFFLE_LABEL_DEFAULT;
            shuffleButton.removeAttribute('aria-busy');
            shuffleButton.removeAttribute('aria-disabled');
          });
      } else {
        shuffleWithoutPhysics(state);
      }
    });
  }

  setPlayState(state, initialActive);
  attachSearch(state);
};

const setup = async () => {
  const roots = Array.from(document.querySelectorAll('[data-magnet-root]'));
  if (!roots.length) {
    return;
  }
  for (let index = 0; index < roots.length; index += 1) {
    await initializeBoard(roots[index], index);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setup();
  });
} else {
  setup();
}

