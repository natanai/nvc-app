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

const SHUFFLE_GAP_X = 12;
const SHUFFLE_GAP_Y = 14;
const SHUFFLE_JITTER_X = 18;
const SHUFFLE_JITTER_Y = 12;

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
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
    state.pointerField.active = false;
  };

  const handlePointerCancelField = () => {
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

const shuffleMagnets = (state: InternalState) => {
  const { width } = getBoardSize(state);
  if (!width) {
    return;
  }
  const count = state.magnets.length;
  if (!count) {
    return;
  }
  const order = state.magnets.slice();
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  let x = SHUFFLE_GAP_X;
  let y = SHUFFLE_GAP_Y;
  let lineHeight = 0;

  order.forEach((magnet) => {
    const magnetWidth = magnet.w;
    const magnetHeight = magnet.h;
    if (x > SHUFFLE_GAP_X && x + magnetWidth + SHUFFLE_GAP_X > width) {
      x = SHUFFLE_GAP_X;
      y += lineHeight + SHUFFLE_GAP_Y;
      lineHeight = 0;
    }

    const maxX = Math.max(width - magnetWidth, 0);
    const jitterX = (Math.random() - 0.5) * Math.min(magnetWidth * 0.25, SHUFFLE_JITTER_X);
    const jitterY = (Math.random() - 0.5) * Math.min(magnetHeight * 0.25, SHUFFLE_JITTER_Y);
    const placeX = clamp(x + jitterX, 0, maxX);
    const placeY = Math.max(y + jitterY, 0);

    magnet.x = placeX;
    magnet.y = placeY;
    magnet.vx = 0;
    magnet.vy = 0;
    applyTransform(magnet);

    x = placeX + magnetWidth + SHUFFLE_GAP_X;
    lineHeight = Math.max(lineHeight, magnetHeight);
  });

  notifyPositions(state);
};

export function startPhysics(options: StartPhysicsOptions): { stop: () => void; shuffle: () => void } {
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
    },
    shuffle: () => {
      shuffleMagnets(state);
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

