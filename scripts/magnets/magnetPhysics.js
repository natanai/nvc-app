const DEFAULT_CONFIG = {
  drift: 3,
  damping: 0.975,
  sepRadiusScale: 0.7,
  sepStrength: 18,
  dragSepMultiplier: 2,
  edgeBounce: 0.18,
  mouseRadius: 140,
  mouseStrength: 0.6,
};

const DRAG_DISTANCE_THRESHOLD = 6;
const DRAG_TIME_THRESHOLD = 150;

const getNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now());

const clamp = (value, min, max) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const getBoardSize = (state) => {
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

const applyTransform = (magnet) => {
  magnet.element.style.transform =
    `translate3d(${magnet.x}px, ${magnet.y}px, 0) translateY(calc(var(--magnet-offset, 0px) + var(--magnet-hover-offset, 0px))) rotate(var(--magnet-tilt, 0))`;
};

const notifyPositions = (state) => {
  if (!state.onPositions) {
    return;
  }
  const payload = state.magnets.map(({ id, x, y }) => ({ id, x, y }));
  state.onPositions(payload);
};

const measureMagnet = (boardRect, element) => {
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

const addPointerListeners = (state) => {
  const handlePointerDown = (event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const magnetState = state.magnets.find((magnet) => magnet.element === target);
    if (!magnetState) return;

    if (event.pointerType === 'mouse') {
      state.dragIntent.pointerId = event.pointerId;
      state.dragIntent.pointerType = 'mouse';
      state.dragIntent.downX = event.clientX;
      state.dragIntent.downY = event.clientY;
      state.dragIntent.downT = getNow();
      state.dragIntent.moved = false;
    } else {
      state.dragIntent.pointerId = null;
      state.dragIntent.pointerType = '';
      state.dragIntent.moved = false;
      state.dragIntent.downT = 0;
    }

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

  const handlePointerMove = (event) => {
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
      if (
        event.pointerType === 'mouse' &&
        state.dragIntent.pointerId === event.pointerId &&
        !state.dragIntent.moved
      ) {
        const dx = event.clientX - state.dragIntent.downX;
        const dy = event.clientY - state.dragIntent.downY;
        const elapsed = getNow() - state.dragIntent.downT;
        if (
          Math.abs(dx) > DRAG_DISTANCE_THRESHOLD ||
          Math.abs(dy) > DRAG_DISTANCE_THRESHOLD ||
          elapsed > DRAG_TIME_THRESHOLD
        ) {
          state.dragIntent.moved = true;
        }
      }
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

  const handlePointerUp = (event) => {
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
    if (
      state.dragIntent.pointerId === event.pointerId &&
      state.dragIntent.pointerType === 'mouse' &&
      !state.dragIntent.moved &&
      state.dragIntent.downT > 0
    ) {
      const elapsed = getNow() - state.dragIntent.downT;
      if (elapsed > DRAG_TIME_THRESHOLD) {
        state.dragIntent.moved = true;
      }
    }
    const shouldSuppress =
      state.dragIntent.pointerId === event.pointerId &&
      state.dragIntent.pointerType === 'mouse' &&
      state.dragIntent.moved;
    state.dragIntent.pointerId = null;
    state.dragIntent.pointerType = '';
    state.dragIntent.moved = false;
    state.dragIntent.downT = 0;
    if (shouldSuppress && state.onDragRelease) {
      state.onDragRelease();
    }
  };

  const handlePointerCancel = (event) => {
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
    if (state.dragIntent.pointerId === event.pointerId) {
      state.dragIntent.pointerId = null;
      state.dragIntent.pointerType = '';
      state.dragIntent.moved = false;
      state.dragIntent.downT = 0;
    }
  };

  const handlePointerLeave = () => {
    state.pointerField.active = false;
  };

  const handlePointerCancelField = () => {
    state.pointerField.active = false;
  };

  state.magnets.forEach((magnet) => {
    magnet.element.addEventListener('pointerdown', handlePointerDown);
    magnet.element.addEventListener('pointermove', handlePointerMove);
    magnet.element.addEventListener('pointerup', handlePointerUp);
    magnet.element.addEventListener('pointercancel', handlePointerCancel);
  });

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

const applySeparationForces = (state, dt) => {
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

const applyPointerField = (state, dt) => {
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

const integrateMotion = (state, dt) => {
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

const frameStep = (state, timestamp) => {
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

const stopAnimation = (state) => {
  if (state.animationFrame != null) {
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
  }
  state.lastTimestamp = null;
};

const shuffleMagnets = (state) => {
  const { width, height } = getBoardSize(state);
  if (!width || !height) {
    return;
  }
  const count = state.magnets.length;
  if (!count) {
    return;
  }
  const columns = Math.max(1, Math.round(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const order = state.magnets.slice();
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.forEach((magnet, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const jitterX = (Math.random() - 0.5) * Math.min(cellWidth * 0.3, 24);
    const jitterY = (Math.random() - 0.5) * Math.min(cellHeight * 0.3, 24);
    const baseX = column * cellWidth + (cellWidth - magnet.w) / 2 + jitterX;
    const baseY = row * cellHeight + (cellHeight - magnet.h) / 2 + jitterY;
    const maxX = Math.max(width - magnet.w, 0);
    const maxY = Math.max(height - magnet.h, 0);
    magnet.x = clamp(baseX, 0, maxX);
    magnet.y = clamp(baseY, 0, maxY);
    magnet.vx = 0;
    magnet.vy = 0;
    applyTransform(magnet);
  });
  notifyPositions(state);
};

export function startPhysics(options) {
  const boardRect = options.board.getBoundingClientRect();
  const magnetStates = options.magnets.map((element) => measureMagnet(boardRect, element));
  const config = { ...DEFAULT_CONFIG, ...options.config };
  const state = {
    board: options.board,
    magnets: magnetStates,
    config,
    animationFrame: null,
    lastTimestamp: null,
    pointerField: { active: false, x: 0, y: 0 },
    dragging: null,
    onPositions: options.onPositions,
    getBoardSize: options.getBoardSize,
    onDragRelease: options.onDragRelease,
    dragIntent: {
      pointerId: null,
      pointerType: '',
      downX: 0,
      downY: 0,
      downT: 0,
      moved: false,
    },
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
      state.dragIntent.pointerId = null;
      state.dragIntent.pointerType = '';
      state.dragIntent.moved = false;
      state.dragIntent.downT = 0;
      state.pointerField.active = false;
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

const normalizeKey = (key) => {
  if (key.startsWith(STORAGE_PREFIX)) {
    return key;
  }
  return `${STORAGE_PREFIX}${key}`;
};

export function loadPositions(storageKey, boardSize, magnetSizes) {
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
    const snapshots = [];
    for (const [id, value] of Object.entries(parsed.magnets)) {
      if (!value || typeof value !== 'object') {
        continue;
      }
      const entry = value;
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

export function savePositions(storageKey, boardSize, magnets) {
  if (!isStorageAvailable()) {
    return;
  }
  const payload = { magnets: {} };
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
