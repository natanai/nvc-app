export interface PhysicsConfig {
  drift: number; // px/s
  tiltStrength: number;
  tiltDriftScale: number;
  tiltDeadzone: number;
  tiltGammaNormalizer: number;
  tiltBetaNormalizer: number;
  tiltBetaUprightOffset: number;
  damping: number; // per frame coefficient ~0.96-0.985
  sepRadiusScale: number;
  sepStrength: number;
  dragSepMultiplier: number;
  edgeBounce: number;
  mouseRadius: number;
  mouseStrength: number;
}

export interface MagnetSnapshot {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
}

export interface StoredMagnetPercentages {
  id: string;
  xPct: number;
  yPct: number;
}

export interface StoredMagnetLayout {
  magnets: MagnetSnapshot[];
  boardHeight: number | null;
}

export interface StartPhysicsOptions {
  board: HTMLElement;
  magnets: HTMLElement[];
  config?: Partial<PhysicsConfig>;
  onPositions?: (list: { id: string; x: number; y: number }[]) => void;
  getBoardSize?: () => { width: number; height: number };
  onDragRelease?: () => void;
  onTiltPermissionDenied?: (reason: unknown) => void;
}

interface InternalMagnetState extends MagnetSnapshot {
  element: HTMLElement;
  dragging: boolean;
  pointerId: number | null;
  offsetX: number;
  offsetY: number;
}

interface InternalState {
  board: HTMLElement;
  magnets: InternalMagnetState[];
  config: PhysicsConfig;
  animationFrame: number | null;
  lastTimestamp: number | null;
  pointerField: { active: boolean; x: number; y: number };
  dragging: InternalMagnetState | null;
  onPositions?: (list: { id: string; x: number; y: number }[]) => void;
  getBoardSize?: () => { width: number; height: number };
  isShuffling: boolean;
  shufflePromise: Promise<void> | null;
  lastShuffleTime: number;
  baseHeight: number;
  tilt: {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    baselineGamma: number | null;
    baselineBeta: number | null;
  };
}

const DEFAULT_CONFIG: PhysicsConfig = {
  drift: 3,
  tiltStrength: 40,
  tiltDriftScale: 0.35,
  tiltDeadzone: 0.02,
  tiltGammaNormalizer: 30,
  tiltBetaNormalizer: 30,
  tiltBetaUprightOffset: 90,
  damping: 0.975,
  sepRadiusScale: 0.7,
  sepStrength: 18,
  dragSepMultiplier: 2,
  edgeBounce: 0.18,
  mouseRadius: 140,
  mouseStrength: 0.6,
};

const LAYOUT_GAP_X = 12;
const LAYOUT_GAP_Y = 14;
const BOARD_PADDING = 24;
const SHUFFLE_DEBOUNCE_MS = 500;
const TILT_RESPONSE_RATE = 10;
const TILT_SETTLE_THRESHOLD = 0.01;
const NAV_BOARD_MAX_HEIGHT = 720;

const clampBoardHeight = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), NAV_BOARD_MAX_HEIGHT);
};

const syncBoardHeightVariables = (height: number | null | undefined): void => {
  if (typeof document === 'undefined') {
    return;
  }
  const docEl = document.documentElement;
  if (!docEl || !docEl.style) {
    return;
  }
  docEl.style.setProperty('--nav-magnet-max-height', `${NAV_BOARD_MAX_HEIGHT}px`);
  if (typeof height === 'number' && Number.isFinite(height) && height > 0) {
    const clamped = clampBoardHeight(height);
    docEl.style.setProperty('--nav-magnet-board-height', `${clamped}px`);
    docEl.style.setProperty('--nav-magnet-safe-height', `${clamped}px`);
  }
};

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const getNow = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const parsePx = (value: string | null | undefined) => {
  const parsed = Number.parseFloat(value || '0');
  return Number.isFinite(parsed) ? parsed : 0;
};

const waitForAnimationFrames = async (count = 1): Promise<void> => {
  if (count <= 0) {
    return;
  }
  await new Promise<void>((resolve) => {
    const step = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(() => step(remaining - 1));
    };
    window.requestAnimationFrame(() => step(count - 1));
  });
};

const delay = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms);
});

const supportsDeviceOrientation = () => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

const hasDeviceOrientationPermissionAPI = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  const DeviceOrientation = window.DeviceOrientationEvent as
    | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<unknown> })
    | undefined;
  return Boolean(DeviceOrientation && typeof DeviceOrientation.requestPermission === 'function');
};

const isTiltPermissionGranted = (value: unknown): boolean => value === 'granted' || value === true;

const applyTiltDeadzone = (value: number, deadzone: number) => {
  if (Math.abs(value) < deadzone) {
    return 0;
  }
  return clamp(value, -1, 1);
};

const addTiltListener = (
  state: InternalState,
  options: { permissionPromise?: Promise<unknown>; onPermissionDenied?: (reason: unknown) => void } = {},
): (() => void) | null => {
  if (!supportsDeviceOrientation()) {
    return null;
  }

  const handleOrientation = (event: DeviceOrientationEvent) => {
    const tilt = state.tilt;
    if (!tilt) {
      return;
    }

    const {
      tiltDeadzone = DEFAULT_CONFIG.tiltDeadzone,
      tiltGammaNormalizer = DEFAULT_CONFIG.tiltGammaNormalizer,
      tiltBetaNormalizer = DEFAULT_CONFIG.tiltBetaNormalizer,
      tiltBetaUprightOffset = DEFAULT_CONFIG.tiltBetaUprightOffset,
    } = state.config ?? {};

    if (typeof event.gamma === 'number' && Number.isFinite(event.gamma) && tiltGammaNormalizer) {
      if (tilt.baselineGamma == null) {
        tilt.baselineGamma = event.gamma;
      }
      const deltaGamma = event.gamma - (tilt.baselineGamma ?? 0);
      const normalizedX = applyTiltDeadzone(deltaGamma / tiltGammaNormalizer, tiltDeadzone);
      tilt.targetX = normalizedX;
    }

    if (typeof event.beta === 'number' && Number.isFinite(event.beta) && tiltBetaNormalizer) {
      const adjustedBeta = event.beta - tiltBetaUprightOffset;
      if (tilt.baselineBeta == null) {
        tilt.baselineBeta = adjustedBeta;
      }
      const deltaBeta = adjustedBeta - (tilt.baselineBeta ?? 0);
      const normalizedY = applyTiltDeadzone(deltaBeta / tiltBetaNormalizer, tiltDeadzone);
      tilt.targetY = normalizedY;
    }
  };

  let attached = false;
  let active = true;

  const attachListener = () => {
    if (!active || attached) {
      return;
    }
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    attached = true;
  };

  const detachListener = () => {
    if (!attached) {
      return;
    }
    window.removeEventListener('deviceorientation', handleOrientation);
    attached = false;
  };

  const handlePermissionDenied = (reason: unknown) => {
    const tilt = state.tilt;
    if (tilt) {
      tilt.x = 0;
      tilt.y = 0;
      tilt.targetX = 0;
      tilt.targetY = 0;
      tilt.baselineGamma = null;
      tilt.baselineBeta = null;
    }
    options.onPermissionDenied?.(reason);
  };

  if (hasDeviceOrientationPermissionAPI()) {
    const { permissionPromise } = options;
    if (permissionPromise && typeof permissionPromise.then === 'function') {
      permissionPromise
        .then((result) => {
          if (!active) {
            return;
          }
          if (isTiltPermissionGranted(result)) {
            attachListener();
          } else {
            handlePermissionDenied(result);
          }
        })
        .catch((error) => {
          if (!active) {
            return;
          }
          handlePermissionDenied(error);
        });
    } else {
      attachListener();
    }

    return () => {
      active = false;
      detachListener();
    };
  }

  attachListener();
  return () => {
    active = false;
    detachListener();
  };
};

const updateTilt = (state: InternalState, dt: number) => {
  const tilt = state.tilt;
  if (!tilt) {
    return;
  }

  const rate = Math.min(dt * TILT_RESPONSE_RATE, 1);
  tilt.x += (tilt.targetX - tilt.x) * rate;
  tilt.y += (tilt.targetY - tilt.y) * rate;

  if (Math.abs(tilt.x) < TILT_SETTLE_THRESHOLD) {
    tilt.x = 0;
  }
  if (Math.abs(tilt.y) < TILT_SETTLE_THRESHOLD) {
    tilt.y = 0;
  }
};

const getBoardSize = (
  state: InternalState,
): { width: number; height: number } => {
  if (state.getBoardSize) {
    const size = state.getBoardSize();
    if (size && Number.isFinite(size.width) && Number.isFinite(size.height)) {
      return { width: Math.max(size.width, 0), height: Math.max(size.height, 0) };
    }
  }
  const rect = state.board.getBoundingClientRect();
  const width = rect.width || state.board.clientWidth || parseFloat(getComputedStyle(state.board).width || '0');
  const height =
    rect.height ||
    state.board.clientHeight ||
    parseFloat((state.board instanceof HTMLElement ? getComputedStyle(state.board).height : '') || '0');
  return { width: Math.max(width, 0), height: Math.max(height, 0) };
};

const applyTransform = (magnet: InternalMagnetState) => {
  magnet.element.style.transform =
    `translate3d(${magnet.x}px, ${magnet.y}px, 0) translateY(calc(var(--magnet-offset, 0px) + var(--magnet-hover-offset, 0px))) rotate(var(--magnet-tilt, 0))`;
};

const notifyPositions = (state: InternalState) => {
  if (!state.onPositions) {
    return;
  }
  const payload = state.magnets.map(({ id, x, y }) => ({ id, x, y }));
  state.onPositions(payload);
};

const measureMagnet = (boardRect: DOMRect, element: HTMLElement): InternalMagnetState => {
  const rect = element.getBoundingClientRect();
  const id = element.dataset.magnetId || element.id || element.textContent || '';
  const width = rect.width || element.offsetWidth || 0;
  const height = rect.height || element.offsetHeight || 0;
  return {
    id: String(id),
    element,
    x: rect.left - boardRect.left,
    y: rect.top - boardRect.top,
    vx: 0,
    vy: 0,
    w: width,
    h: height,
    dragging: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
  };
};

const addPointerListeners = (state: InternalState) => {
  const handlePointerDown = (event: PointerEvent) => {
    if (state.isShuffling) {
      return;
    }
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;
    const magnetState = state.magnets.find((magnet) => magnet.element === target);
    if (!magnetState) return;

    state.dragging = magnetState;
    magnetState.dragging = true;
    magnetState.pointerId = event.pointerId;
    const boardRect = state.board.getBoundingClientRect();
    magnetState.offsetX = event.clientX - (boardRect.left + magnetState.x);
    magnetState.offsetY = event.clientY - (boardRect.top + magnetState.y);
    magnetState.vx = 0;
    magnetState.vy = 0;
    target.classList.add('dragging');
    state.board.dataset.dragging = '1';
    if (typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Ignore errors when capture isn't available.
      }
    }
    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (state.isShuffling) {
      return;
    }
    if (state.dragging && state.dragging.pointerId === event.pointerId) {
      const magnetState = state.dragging;
      const boardRect = state.board.getBoundingClientRect();
      const { width, height } = getBoardSize(state);
      const maxX = Math.max(width - magnetState.w, 0);
      const maxY = Math.max(height - magnetState.h, 0);
      const nextX = clamp(event.clientX - boardRect.left - magnetState.offsetX, 0, maxX);
      const nextY = clamp(event.clientY - boardRect.top - magnetState.offsetY, 0, maxY);
      magnetState.x = nextX;
      magnetState.y = nextY;
      magnetState.vx = 0;
      magnetState.vy = 0;
      applyTransform(magnetState);
      notifyPositions(state);
      if (event.pointerType !== 'mouse') {
        event.preventDefault();
      }
      return;
    }

    if (event.pointerType === 'mouse' && event.buttons === 0) {
      const rect = state.board.getBoundingClientRect();
      state.pointerField.active = true;
      state.pointerField.x = event.clientX - rect.left;
      state.pointerField.y = event.clientY - rect.top;
    }
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (state.isShuffling) {
      return;
    }
    if (!state.dragging || state.dragging.pointerId !== event.pointerId) {
      return;
    }
    const magnetState = state.dragging;
    if (typeof magnetState.element.releasePointerCapture === 'function') {
      try {
        magnetState.element.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore if pointer already released.
      }
    }
    magnetState.element.classList.remove('dragging');
    magnetState.dragging = false;
    magnetState.pointerId = null;
    state.dragging = null;
    delete state.board.dataset.dragging;
    notifyPositions(state);
  };

  const handlePointerCancel = (event: PointerEvent) => {
    if (state.isShuffling) {
      return;
    }
    if (!state.dragging || state.dragging.pointerId !== event.pointerId) {
      return;
    }
    const magnetState = state.dragging;
    if (typeof magnetState.element.releasePointerCapture === 'function') {
      try {
        magnetState.element.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore.
      }
    }
    magnetState.element.classList.remove('dragging');
    magnetState.dragging = false;
    magnetState.pointerId = null;
    state.dragging = null;
    delete state.board.dataset.dragging;
    notifyPositions(state);
  };

  state.magnets.forEach((magnet) => {
    magnet.element.addEventListener('pointerdown', handlePointerDown);
    magnet.element.addEventListener('pointermove', handlePointerMove);
    magnet.element.addEventListener('pointerup', handlePointerUp);
    magnet.element.addEventListener('pointercancel', handlePointerCancel);
  });

  const handlePointerLeave = () => {
    if (state.isShuffling) {
      return;
    }
    state.pointerField.active = false;
  };

  const handlePointerCancelField = () => {
    if (state.isShuffling) {
      return;
    }
    state.pointerField.active = false;
  };

  state.board.addEventListener('pointermove', handlePointerMove);
  state.board.addEventListener('pointerleave', handlePointerLeave);
  state.board.addEventListener('pointercancel', handlePointerCancelField);

  return () => {
    state.magnets.forEach((magnet) => {
      magnet.element.removeEventListener('pointerdown', handlePointerDown);
      magnet.element.removeEventListener('pointermove', handlePointerMove);
      magnet.element.removeEventListener('pointerup', handlePointerUp);
      magnet.element.removeEventListener('pointercancel', handlePointerCancel);
    });
    state.board.removeEventListener('pointermove', handlePointerMove);
    state.board.removeEventListener('pointerleave', handlePointerLeave);
    state.board.removeEventListener('pointercancel', handlePointerCancelField);
  };
};

const applySeparationForces = (state: InternalState, dt: number) => {
  const { sepRadiusScale, sepStrength, dragSepMultiplier } = state.config;
  for (let i = 0; i < state.magnets.length; i += 1) {
    const magnetA = state.magnets[i];
    for (let j = i + 1; j < state.magnets.length; j += 1) {
      const magnetB = state.magnets[j];
      const centerAX = magnetA.x + magnetA.w / 2;
      const centerAY = magnetA.y + magnetA.h / 2;
      const centerBX = magnetB.x + magnetB.w / 2;
      const centerBY = magnetB.y + magnetB.h / 2;
      const diffX = centerBX - centerAX;
      const diffY = centerBY - centerAY;
      const distance = Math.hypot(diffX, diffY) || 0.0001;
      const radiusA = Math.hypot(magnetA.w, magnetA.h) * sepRadiusScale;
      const radiusB = Math.hypot(magnetB.w, magnetB.h) * sepRadiusScale;
      const minDistance = radiusA + radiusB;
      if (distance >= minDistance) {
        continue;
      }
      const overlap = minDistance - distance;
      const strength = (sepStrength * (overlap / minDistance)) * dt;
      const dirX = diffX / distance;
      const dirY = diffY / distance;
      const multiplier = magnetA.dragging || magnetB.dragging ? dragSepMultiplier : 1;
      if (!magnetA.dragging) {
        magnetA.vx -= dirX * strength * multiplier;
        magnetA.vy -= dirY * strength * multiplier;
      }
      if (!magnetB.dragging) {
        magnetB.vx += dirX * strength * multiplier;
        magnetB.vy += dirY * strength * multiplier;
      }
    }
  }
};

const applyPointerField = (state: InternalState, dt: number) => {
  if (!state.pointerField.active) {
    return;
  }
  const { mouseRadius, mouseStrength } = state.config;
  const { x: cursorX, y: cursorY } = state.pointerField;
  state.magnets.forEach((magnet) => {
    if (magnet.dragging) {
      return;
    }
    const centerX = magnet.x + magnet.w / 2;
    const centerY = magnet.y + magnet.h / 2;
    const diffX = centerX - cursorX;
    const diffY = centerY - cursorY;
    const distance = Math.hypot(diffX, diffY);
    if (!distance || distance > mouseRadius) {
      return;
    }
    const influence = (1 - distance / mouseRadius) * mouseStrength * dt;
    magnet.vx += (diffX / distance) * influence;
    magnet.vy += (diffY / distance) * influence;
  });
};

const integrateMotion = (state: InternalState, dt: number) => {
  const {
    drift,
    damping,
    edgeBounce,
    tiltStrength = DEFAULT_CONFIG.tiltStrength,
    tiltDriftScale = DEFAULT_CONFIG.tiltDriftScale,
  } = state.config;
  const { width, height } = getBoardSize(state);
  const jitterFloor = clamp(
    Number.isFinite(tiltDriftScale) ? tiltDriftScale : DEFAULT_CONFIG.tiltDriftScale,
    0,
    1,
  );
  const tiltX = state.tilt?.x ?? 0;
  const tiltY = state.tilt?.y ?? 0;
  const tiltAbsX = Math.min(Math.abs(tiltX), 1);
  const tiltAbsY = Math.min(Math.abs(tiltY), 1);
  const jitterScaleX = clamp(1 - tiltAbsX * (1 - jitterFloor), 0, 1);
  const jitterScaleY = clamp(1 - tiltAbsY * (1 - jitterFloor), 0, 1);
  state.magnets.forEach((magnet) => {
    if (!magnet.dragging) {
      magnet.vx += (Math.random() * 2 - 1) * drift * jitterScaleX * dt;
      magnet.vy += (Math.random() * 2 - 1) * drift * jitterScaleY * dt;
      magnet.vx += tiltStrength * tiltX * dt;
      magnet.vy += tiltStrength * tiltY * dt;
    }
    magnet.vx *= damping;
    magnet.vy *= damping;
    if (!magnet.dragging) {
      magnet.x += magnet.vx * dt;
      magnet.y += magnet.vy * dt;
    }
    const maxX = Math.max(width - magnet.w, 0);
    const maxY = Math.max(height - magnet.h, 0);
    if (magnet.x < 0) {
      magnet.x = 0;
      magnet.vx = Math.abs(magnet.vx) * edgeBounce;
    } else if (magnet.x > maxX) {
      magnet.x = maxX;
      magnet.vx = -Math.abs(magnet.vx) * edgeBounce;
    }
    if (magnet.y < 0) {
      magnet.y = 0;
      magnet.vy = Math.abs(magnet.vy) * edgeBounce;
    } else if (magnet.y > maxY) {
      magnet.y = maxY;
      magnet.vy = -Math.abs(magnet.vy) * edgeBounce;
    }
    applyTransform(magnet);
  });
};

const frameStep = (state: InternalState, timestamp: number) => {
  if (state.isShuffling) {
    state.lastTimestamp = timestamp;
    state.animationFrame = window.requestAnimationFrame((next) => frameStep(state, next));
    return;
  }
  if (state.lastTimestamp == null) {
    state.lastTimestamp = timestamp;
  }
  const delta = Math.max((timestamp - state.lastTimestamp) / 1000, 0);
  const clamped = Math.min(delta, 0.06);
  const step = Math.max(clamped, 0);
  const iterations = Math.ceil(step / 0.016);
  const dt = step / Math.max(iterations, 1);
  for (let i = 0; i < iterations; i += 1) {
    applySeparationForces(state, dt);
    applyPointerField(state, dt);
    updateTilt(state, dt);
    integrateMotion(state, dt);
  }
  state.lastTimestamp = timestamp;
  notifyPositions(state);
  state.animationFrame = window.requestAnimationFrame((next) => frameStep(state, next));
};

const stopAnimation = (state: InternalState) => {
  if (state.animationFrame != null) {
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
  }
  state.lastTimestamp = null;
};

const shuffleMagnets = async (state: InternalState): Promise<void> => {
  if (state.isShuffling) {
    return state.shufflePromise ?? Promise.resolve();
  }
  const now = getNow();
  if (state.lastShuffleTime && now - state.lastShuffleTime < SHUFFLE_DEBOUNCE_MS) {
    return Promise.resolve();
  }
  const runShuffle = async () => {
    state.isShuffling = true;
    state.lastShuffleTime = now;
    stopAnimation(state);
    if (state.dragging && typeof state.dragging.element.releasePointerCapture === 'function' && state.dragging.pointerId != null) {
      try {
        state.dragging.element.releasePointerCapture(state.dragging.pointerId);
      } catch {
        // ignore
      }
    }
    state.magnets.forEach((magnet) => {
      if (magnet.pointerId != null && typeof magnet.element.releasePointerCapture === 'function') {
        try {
          magnet.element.releasePointerCapture(magnet.pointerId);
        } catch {
          // ignore
        }
      }
      magnet.dragging = false;
      magnet.pointerId = null;
      magnet.element.classList.remove('dragging');
    });
    state.dragging = null;
    delete state.board.dataset.dragging;
    state.pointerField.active = false;

    state.board.classList.add('no-transitions');

    try {
      let width = 0;
      let height = 0;
      let attempts = 0;
      while (attempts < 5) {
        await waitForAnimationFrames(2);
        const size = getBoardSize(state);
        width = size.width;
        height = size.height;
        if (width > 0) {
          break;
        }
        attempts += 1;
        await delay(Math.min(50 * attempts, 250));
      }

      if (!width) {
        width = state.board.clientWidth || parsePx(getComputedStyle(state.board).width) || 1;
      }
      if (!height) {
        const computedHeight = parsePx(
          (state.board instanceof HTMLElement ? getComputedStyle(state.board).height : '') || '0',
        );
        height = state.board.clientHeight || computedHeight || state.baseHeight || 1;
      }

      const order = state.magnets.slice();
      for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }

      const startX = LAYOUT_GAP_X;
      const startY = LAYOUT_GAP_Y;
      let cursorX = startX;
      let cursorY = startY;
      let rowHeight = 0;
      let maxBottom = startY;

      const placements = order.map((magnet) => {
        const styles = window.getComputedStyle(magnet.element);
        const marginLeft = parsePx(styles.marginLeft);
        const marginRight = parsePx(styles.marginRight);
        const marginTop = parsePx(styles.marginTop);
        const marginBottom = parsePx(styles.marginBottom);
        const footprintWidth = magnet.w + marginLeft + marginRight;
        const footprintHeight = magnet.h + marginTop + marginBottom;
        if (cursorX > startX && cursorX + footprintWidth + LAYOUT_GAP_X > width) {
          cursorX = startX;
          cursorY += rowHeight + LAYOUT_GAP_Y;
          rowHeight = 0;
        }
        const maxX = Math.max(width - magnet.w, 0);
        const x = clamp(cursorX + marginLeft, 0, maxX);
        const y = cursorY + marginTop;
        cursorX += footprintWidth + LAYOUT_GAP_X;
        rowHeight = Math.max(rowHeight, footprintHeight);
        maxBottom = Math.max(maxBottom, y + magnet.h + marginBottom);
        return { magnet, x, y };
      });

      const baseHeight = state.baseHeight || height || 0;
      const targetHeightRaw = Math.max(baseHeight, maxBottom + BOARD_PADDING);
      const targetHeight = clampBoardHeight(targetHeightRaw);

      placements.forEach(({ magnet, x, y }) => {
        magnet.x = x;
        magnet.y = y;
        magnet.vx = 0;
        magnet.vy = 0;
        applyTransform(magnet);
      });

      const nextBaseHeight = Math.max(state.baseHeight || 0, targetHeight);
      state.baseHeight = Math.min(nextBaseHeight, NAV_BOARD_MAX_HEIGHT);
      state.board.style.height = `${targetHeight}px`;
      state.board.style.maxHeight = `${NAV_BOARD_MAX_HEIGHT}px`;
      syncBoardHeightVariables(targetHeight);
      notifyPositions(state);

      await waitForAnimationFrames(1);
      window.requestAnimationFrame(() => {
        state.board.classList.remove('no-transitions');
      });
    } finally {
      state.isShuffling = false;
      state.shufflePromise = null;
      state.dragging = null;
      state.pointerField.active = false;
      if (state.tilt) {
        state.tilt.x = 0;
        state.tilt.y = 0;
        state.tilt.targetX = 0;
        state.tilt.targetY = 0;
      }
      state.magnets.forEach((magnet) => {
        magnet.dragging = false;
        magnet.pointerId = null;
        magnet.vx = 0;
        magnet.vy = 0;
        magnet.element.classList.remove('dragging');
      });
      delete state.board.dataset.dragging;
      state.animationFrame = window.requestAnimationFrame((timestamp) => {
        state.lastTimestamp = timestamp;
        frameStep(state, timestamp);
      });
    }
};
  state.shufflePromise = runShuffle().catch(() => {
    window.requestAnimationFrame(() => {
      state.board.classList.remove('no-transitions');
    });
  });
  return state.shufflePromise;
};

export function startPhysics(options: StartPhysicsOptions): {
  stop: () => void;
  shuffle: () => Promise<void>;
  enableTilt: (permissionPromise?: Promise<unknown>) => void;
} {
  const boardRect = options.board.getBoundingClientRect();
  const magnetStates = options.magnets.map((element) => measureMagnet(boardRect, element));
  const config: PhysicsConfig = { ...DEFAULT_CONFIG, ...options.config };
  const state: InternalState = {
    board: options.board,
    magnets: magnetStates,
    config,
    animationFrame: null,
    lastTimestamp: null,
    pointerField: { active: false, x: 0, y: 0 },
    dragging: null,
    onPositions: options.onPositions,
    getBoardSize: options.getBoardSize,
    isShuffling: false,
    shufflePromise: null,
    lastShuffleTime: 0,
    baseHeight: clampBoardHeight(
      Math.max(
        boardRect.height ||
          options.board.clientHeight ||
          parsePx((options.board instanceof HTMLElement ? getComputedStyle(options.board).height : '') || '0'),
        0,
      ) || 0,
    ),
    tilt: {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      baselineGamma: null,
      baselineBeta: null,
    },
  };

  syncBoardHeightVariables(state.baseHeight);
  options.board.style.maxHeight = `${NAV_BOARD_MAX_HEIGHT}px`;

  const removePointerListeners = addPointerListeners(state);
  let removeTiltListener: (() => void) | null = null;

  const enableTilt = (permissionPromise?: Promise<unknown>) => {
    removeTiltListener?.();
    if (state.tilt) {
      state.tilt.x = 0;
      state.tilt.y = 0;
      state.tilt.targetX = 0;
      state.tilt.targetY = 0;
      state.tilt.baselineGamma = null;
      state.tilt.baselineBeta = null;
    }
    const teardown = addTiltListener(state, {
      permissionPromise,
      onPermissionDenied: options.onTiltPermissionDenied,
    });
    removeTiltListener = typeof teardown === 'function' ? teardown : null;
  };
  state.animationFrame = window.requestAnimationFrame((timestamp) => frameStep(state, timestamp));

  return {
    stop: () => {
      removePointerListeners?.();
      removeTiltListener?.();
      removeTiltListener = null;
      stopAnimation(state);
      state.magnets.forEach((magnet) => {
        magnet.dragging = false;
        magnet.pointerId = null;
        magnet.element.classList.remove('dragging');
      });
      delete state.board.dataset.dragging;
      state.dragging = null;
      state.pointerField.active = false;
      state.isShuffling = false;
      state.shufflePromise = null;
      state.board.classList.remove('no-transitions');
      if (state.tilt) {
        state.tilt.x = 0;
        state.tilt.y = 0;
        state.tilt.targetX = 0;
        state.tilt.targetY = 0;
        state.tilt.baselineGamma = null;
        state.tilt.baselineBeta = null;
      }
    },
    shuffle: () => {
      return shuffleMagnets(state);
    },
    enableTilt: (permissionPromise?: Promise<unknown>) => {
      enableTilt(permissionPromise);
    },
  };
}

const STORAGE_PREFIX = 'magnetPositions:';

const isStorageAvailable = () => {
  try {
    const testKey = '__magnet-test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

const normalizeKey = (key: string) => {
  if (key.startsWith(STORAGE_PREFIX)) {
    return key;
  }
  return `${STORAGE_PREFIX}${key}`;
};

export function loadPositions(
  storageKey: string,
  boardSize: { width: number; height: number },
  magnetSizes: Map<string, { width: number; height: number }>,
): StoredMagnetLayout | null {
  if (!isStorageAvailable()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(normalizeKey(storageKey));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.magnets !== 'object') {
      return null;
    }
    const parsedLayout = parsed as { boardHeight?: unknown };
    const storedHeightRaw = parsedLayout.boardHeight;
    const storedHeight =
      typeof storedHeightRaw === 'number' && Number.isFinite(storedHeightRaw) && storedHeightRaw > 0
        ? clampBoardHeight(storedHeightRaw)
        : null;

    const effectiveWidth = Math.max(boardSize.width, 0);
    const requestedHeight = clampBoardHeight(Math.max(boardSize.height, 0));
    const effectiveHeight = storedHeight != null ? storedHeight : requestedHeight;

    const snapshots: MagnetSnapshot[] = [];
    for (const [id, value] of Object.entries(parsed.magnets as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') {
        continue;
      }
      const entry = value as { xPct?: unknown; yPct?: unknown };
      const width = magnetSizes.get(id)?.width ?? 0;
      const height = magnetSizes.get(id)?.height ?? 0;
      const maxX = Math.max(effectiveWidth - width, 0);
      const maxY = Math.max(effectiveHeight - height, 0);
      const xPct = typeof entry.xPct === 'number' ? entry.xPct : 0;
      const yPct = typeof entry.yPct === 'number' ? entry.yPct : 0;
      const x = clamp(xPct * effectiveWidth, 0, maxX);
      const y = clamp(yPct * effectiveHeight, 0, maxY);
      snapshots.push({ id, x, y, vx: 0, vy: 0, w: width, h: height });
    }
    if (!snapshots.length) {
      return null;
    }

    return {
      magnets: snapshots,
      boardHeight: storedHeight != null ? storedHeight : null,
    };
  } catch {
    return null;
  }
}

export function savePositions(
  storageKey: string,
  boardSize: { width: number; height: number },
  magnets: Iterable<MagnetSnapshot>,
): void {
  if (!isStorageAvailable()) {
    return;
  }
  const payload: {
    magnets: Record<string, { xPct: number; yPct: number }>;
    boardHeight?: number;
  } = { magnets: {} };
  const width = boardSize.width || 1;
  const height = boardSize.height || 1;
  for (const magnet of magnets) {
    const xPct = width ? clamp(magnet.x / width, 0, 1) : 0;
    const yPct = height ? clamp(magnet.y / height, 0, 1) : 0;
    payload.magnets[magnet.id] = {
      xPct: Number(xPct.toFixed(4)),
      yPct: Number(yPct.toFixed(4)),
    };
  }
  const clampedBoardHeight = clampBoardHeight(height);
  if (clampedBoardHeight > 0) {
    payload.boardHeight = Number(clampedBoardHeight.toFixed(2));
  }
  try {
    window.localStorage.setItem(normalizeKey(storageKey), JSON.stringify(payload));
  } catch {
    // Swallow write errors (quota, private mode, etc.).
  }
}

