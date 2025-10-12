export interface PhysicsConfig {
  drift: number; // px/s
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

export interface StartPhysicsOptions {
  board: HTMLElement;
  magnets: HTMLElement[];
  config?: Partial<PhysicsConfig>;
  onPositions?: (list: { id: string; x: number; y: number }[]) => void;
  getBoardSize?: () => { width: number; height: number };
  onDragRelease?: () => void;
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
}

const DEFAULT_CONFIG: PhysicsConfig = {
  drift: 3,
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
  const { drift, damping, edgeBounce } = state.config;
  const { width, height } = getBoardSize(state);
  state.magnets.forEach((magnet) => {
    if (!magnet.dragging) {
      magnet.vx += (Math.random() * 2 - 1) * drift * dt;
      magnet.vy += (Math.random() * 2 - 1) * drift * dt;
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
    const targetHeight = Math.max(baseHeight, maxBottom + BOARD_PADDING);

    placements.forEach(({ magnet, x, y }) => {
      magnet.x = x;
      magnet.y = y;
      magnet.vx = 0;
      magnet.vy = 0;
      applyTransform(magnet);
    });

    state.baseHeight = Math.max(state.baseHeight || 0, targetHeight);
    state.board.style.height = `${targetHeight}px`;
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

export function startPhysics(options: StartPhysicsOptions): { stop: () => void; shuffle: () => Promise<void> } {
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
    baseHeight:
      Math.max(
        boardRect.height ||
          options.board.clientHeight ||
          parsePx((options.board instanceof HTMLElement ? getComputedStyle(options.board).height : '') || '0'),
        0,
      ) || 0,
  };

  const removePointerListeners = addPointerListeners(state);
  state.animationFrame = window.requestAnimationFrame((timestamp) => frameStep(state, timestamp));

  return {
    stop: () => {
      removePointerListeners?.();
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
    },
    shuffle: () => {
      return shuffleMagnets(state);
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
): MagnetSnapshot[] | null {
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
    const snapshots: MagnetSnapshot[] = [];
    for (const [id, value] of Object.entries(parsed.magnets as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') {
        continue;
      }
      const entry = value as { xPct?: unknown; yPct?: unknown };
      const width = magnetSizes.get(id)?.width ?? 0;
      const height = magnetSizes.get(id)?.height ?? 0;
      const maxX = Math.max(boardSize.width - width, 0);
      const maxY = Math.max(boardSize.height - height, 0);
      const xPct = typeof entry.xPct === 'number' ? entry.xPct : 0;
      const yPct = typeof entry.yPct === 'number' ? entry.yPct : 0;
      const x = clamp(xPct * boardSize.width, 0, maxX);
      const y = clamp(yPct * boardSize.height, 0, maxY);
      snapshots.push({ id, x, y, vx: 0, vy: 0, w: width, h: height });
    }
    return snapshots.length ? snapshots : null;
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
  const payload: { magnets: Record<string, { xPct: number; yPct: number }> } = { magnets: {} };
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
  try {
    window.localStorage.setItem(normalizeKey(storageKey), JSON.stringify(payload));
  } catch {
    // Swallow write errors (quota, private mode, etc.).
  }
}

