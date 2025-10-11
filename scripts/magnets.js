const LAYOUT_STORAGE_PREFIX = 'nvcApp.magnetLayout:';
const LAYOUT_VERSION = 1;

const tiltOptions = [-2, -1, 0, 1, 2];
const offsetOptions = [-3, -2, -1, 0, 1, 2, 3];

const randomFrom = (options) => options[Math.floor(Math.random() * options.length)];

const clamp = (value, min, max) => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

const PHYSICS_CONFIG = {
  brownianAcceleration: 18,
  dampingPerFrame: 0.92,
  separationDistanceFactor: 0.45,
  separationStrength: 900,
  dragRepelMultiplier: 2.4,
  cursorRadius: 150,
  cursorStrength: 16,
  boundaryRestitution: 0.18,
  maxSpeed: 160,
  maxStep: 1 / 30,
};

const applyMagnetStyles = (magnet, index) => {
  magnet.classList.add('magnet');
  magnet.style.order = String(index);
  const tilt = randomFrom(tiltOptions);
  const offset = randomFrom(offsetOptions);
  magnet.style.setProperty('--magnet-tilt', `${tilt}deg`);
  magnet.style.setProperty('--magnet-offset', `${offset}px`);
};

const getOrCreateMagnetState = (state, magnet) => {
  let magnetState = state.magnetStates.get(magnet);
  if (!magnetState) {
    magnetState = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      size: { width: 0, height: 0 },
    };
    state.magnetStates.set(magnet, magnetState);
  }
  return magnetState;
};

const toPercentages = (position, size, containerWidth, containerHeight) => {
  const maxX = Math.max(containerWidth - size.width, 0);
  const maxY = Math.max(containerHeight - size.height, 0);
  const xPct = maxX > 0 ? clamp(position.x / maxX, 0, 1) : 0;
  const yPct = maxY > 0 ? clamp(position.y / maxY, 0, 1) : 0;
  return { xPct, yPct };
};

const fromPercentages = (percentages, size, containerWidth, containerHeight) => {
  const maxX = Math.max(containerWidth - size.width, 0);
  const maxY = Math.max(containerHeight - size.height, 0);
  const x = clamp(percentages.xPct ?? 0, 0, 1) * maxX;
  const y = clamp(percentages.yPct ?? 0, 0, 1) * maxY;
  return { x, y };
};

const getPageKey = () => {
  const { pathname } = window.location;
  return pathname.replace(/index\.html$/i, '').replace(/\/+/g, '/');
};

const loadStoredLayout = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return new Map();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return new Map();
    }
    if (parsed.version !== LAYOUT_VERSION || typeof parsed.magnets !== 'object') {
      return new Map();
    }
    const map = new Map();
    Object.entries(parsed.magnets).forEach(([magnetKey, value]) => {
      if (!value || typeof value !== 'object') {
        return;
      }
      const xPct = typeof value.xPct === 'number' ? clamp(value.xPct, 0, 1) : 0;
      const yPct = typeof value.yPct === 'number' ? clamp(value.yPct, 0, 1) : 0;
      map.set(magnetKey, { xPct, yPct });
    });
    return map;
  } catch (error) {
    console.warn('Unable to load magnet layout', error);
    return new Map();
  }
};

const persistLayout = (state) => {
  const payload = { version: LAYOUT_VERSION, magnets: {} };
  state.magnets.forEach((magnet, index) => {
    const key = magnet.dataset.magnetKey || `magnet-${index}`;
    const percentages = state.layout.get(magnet);
    if (!percentages) {
      return;
    }
    payload.magnets[key] = {
      xPct: Number(percentages.xPct.toFixed(4)),
      yPct: Number(percentages.yPct.toFixed(4)),
    };
  });
  try {
    localStorage.setItem(state.storageKey, JSON.stringify(payload));
  } catch (error) {
    console.warn('Unable to persist magnet layout', error);
  }
};

const applyPosition = (state, magnet, x, y) => {
  const magnetState = state.magnetStates.get(magnet);
  if (magnetState) {
    magnetState.position.x = x;
    magnetState.position.y = y;
  }
  state.positions.set(magnet, { x, y });
  magnet.style.setProperty('--magnet-position-x', `${x}px`);
  magnet.style.setProperty('--magnet-position-y', `${y}px`);
};

const updatePercentagesForMagnet = (state, magnet, containerWidth, containerHeight) => {
  const position = state.positions.get(magnet);
  const size = state.sizes.get(magnet);
  if (!position || !size) {
    return;
  }
  const percentages = toPercentages(position, size, containerWidth, containerHeight);
  state.layout.set(magnet, percentages);
};

const applyLayout = (state, options = {}) => {
  const { suppressTransitions = false } = options;
  const { grid } = state;
  const rect = grid.getBoundingClientRect();
  const currentWidth = rect.width || state.baseWidth || grid.clientWidth || 1;
  const currentHeight = parseFloat(grid.style.height) || rect.height || state.baseHeight || 1;
  state.containerWidth = currentWidth;
  state.containerHeight = currentHeight;
  let maxBottom = 0;

  state.magnets.forEach((magnet) => {
    const measuredWidth = magnet.offsetWidth || magnet.getBoundingClientRect().width || state.baseSizes.get(magnet)?.width || 0;
    const measuredHeight = magnet.offsetHeight || magnet.getBoundingClientRect().height || state.baseSizes.get(magnet)?.height || 0;
    const size = { width: measuredWidth, height: measuredHeight };
    state.sizes.set(magnet, size);
    const magnetState = getOrCreateMagnetState(state, magnet);
    magnetState.size.width = size.width;
    magnetState.size.height = size.height;
    magnetState.velocity.x = 0;
    magnetState.velocity.y = 0;

    const percentages = state.layout.get(magnet) || { xPct: 0, yPct: 0 };
    const { x, y } = fromPercentages(percentages, size, currentWidth, currentHeight);
    applyPosition(state, magnet, x, y);
    maxBottom = Math.max(maxBottom, y + measuredHeight);
  });

  grid.style.height = `${Math.max(maxBottom, state.baseHeight)}px`;

  if (suppressTransitions) {
    grid.classList.add('magnet-grid--no-transitions');
    requestAnimationFrame(() => {
      grid.classList.remove('magnet-grid--no-transitions');
    });
  }
};

const shuffleLayout = (state) => {
  const rect = state.grid.getBoundingClientRect();
  const containerWidth = rect.width || state.grid.clientWidth || 1;
  const containerHeight = parseFloat(state.grid.style.height) || rect.height || state.grid.clientHeight || 1;
  state.containerWidth = containerWidth;
  state.containerHeight = containerHeight;
  state.grid.classList.add('magnet-grid--no-transitions');
  state.magnets.forEach((magnet) => {
    const size = state.sizes.get(magnet);
    if (!size) {
      return;
    }
    const magnetState = getOrCreateMagnetState(state, magnet);
    const maxX = Math.max(containerWidth - size.width, 0);
    const maxY = Math.max(containerHeight - size.height, 0);
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
    magnetState.velocity.x = 0;
    magnetState.velocity.y = 0;
    applyPosition(state, magnet, x, y);
    const percentages = toPercentages({ x, y }, size, containerWidth, containerHeight);
    state.layout.set(magnet, percentages);
  });
  persistLayout(state);
  requestAnimationFrame(() => {
    state.grid.classList.remove('magnet-grid--no-transitions');
  });
};

const updateToggleLabel = (state) => {
  if (state.active) {
    state.playButton.textContent = 'Done';
    state.playButton.setAttribute('aria-pressed', 'true');
  } else {
    state.playButton.textContent = '+ play with';
    state.playButton.setAttribute('aria-pressed', 'false');
  }
};

const updatePercentagesForState = (state, magnet, containerWidth, containerHeight) => {
  updatePercentagesForMagnet(state, magnet, containerWidth, containerHeight);
};

const updatePhysics = (state, dt) => {
  if (dt <= 0) {
    return;
  }
  const {
    brownianAcceleration,
    dampingPerFrame,
    separationDistanceFactor,
    separationStrength,
    dragRepelMultiplier,
    cursorRadius,
    cursorStrength,
    boundaryRestitution,
    maxSpeed,
  } = PHYSICS_CONFIG;

  const draggedMagnet = state.dragState?.magnet || null;
  const containerWidth = state.containerWidth || state.grid.clientWidth || state.baseWidth || 1;
  const containerHeight =
    state.containerHeight || parseFloat(state.grid.style.height) || state.grid.clientHeight || state.baseHeight || 1;

  const forces = new Map();
  state.magnets.forEach((magnet) => {
    const magnetState = state.magnetStates.get(magnet);
    if (!magnetState) {
      return;
    }
    forces.set(magnet, { x: 0, y: 0 });
  });

  state.magnets.forEach((magnet) => {
    if (magnet === draggedMagnet) {
      return;
    }
    const magnetState = state.magnetStates.get(magnet);
    if (!magnetState) {
      return;
    }
    const force = forces.get(magnet);
    force.x += (Math.random() * 2 - 1) * brownianAcceleration;
    force.y += (Math.random() * 2 - 1) * brownianAcceleration;
  });

  for (let i = 0; i < state.magnets.length; i += 1) {
    const magnetA = state.magnets[i];
    const stateA = state.magnetStates.get(magnetA);
    if (!stateA) {
      continue;
    }
    for (let j = i + 1; j < state.magnets.length; j += 1) {
      const magnetB = state.magnets[j];
      const stateB = state.magnetStates.get(magnetB);
      if (!stateB) {
        continue;
      }

      const centerAX = stateA.position.x + stateA.size.width / 2;
      const centerAY = stateA.position.y + stateA.size.height / 2;
      const centerBX = stateB.position.x + stateB.size.width / 2;
      const centerBY = stateB.position.y + stateB.size.height / 2;
      const diffX = centerBX - centerAX;
      const diffY = centerBY - centerAY;
      const distance = Math.hypot(diffX, diffY) || 0.0001;
      const radiusA = Math.hypot(stateA.size.width, stateA.size.height) * separationDistanceFactor;
      const radiusB = Math.hypot(stateB.size.width, stateB.size.height) * separationDistanceFactor;
      const minDistance = radiusA + radiusB;
      if (distance >= minDistance || minDistance === 0) {
        continue;
      }

      const penetration = minDistance - distance;
      const directionX = diffX / distance;
      const directionY = diffY / distance;
      const baseStrength = separationStrength * (penetration / minDistance);
      const appliesToA = magnetA !== draggedMagnet;
      const appliesToB = magnetB !== draggedMagnet;
      const multiplier = magnetA === draggedMagnet || magnetB === draggedMagnet ? dragRepelMultiplier : 1;

      if (appliesToA) {
        const forceA = forces.get(magnetA);
        forceA.x -= directionX * baseStrength * multiplier;
        forceA.y -= directionY * baseStrength * multiplier;
      }

      if (appliesToB) {
        const forceB = forces.get(magnetB);
        forceB.x += directionX * baseStrength * multiplier;
        forceB.y += directionY * baseStrength * multiplier;
      }
    }
  }

  if (state.pointerField.active && !draggedMagnet) {
    const { x: cursorX, y: cursorY } = state.pointerField;
    state.magnets.forEach((magnet) => {
      const magnetState = state.magnetStates.get(magnet);
      if (!magnetState) {
        return;
      }
      const centerX = magnetState.position.x + magnetState.size.width / 2;
      const centerY = magnetState.position.y + magnetState.size.height / 2;
      const diffX = centerX - cursorX;
      const diffY = centerY - cursorY;
      const distance = Math.hypot(diffX, diffY);
      if (distance === 0 || distance > cursorRadius) {
        return;
      }
      const strength = cursorStrength * (1 - distance / cursorRadius);
      const force = forces.get(magnet);
      if (!force) {
        return;
      }
      force.x += (diffX / distance) * strength;
      force.y += (diffY / distance) * strength;
    });
  }

  const damping = Math.pow(dampingPerFrame, dt * 60);
  state.magnets.forEach((magnet) => {
    if (magnet === draggedMagnet) {
      return;
    }
    const magnetState = state.magnetStates.get(magnet);
    if (!magnetState) {
      return;
    }
    const force = forces.get(magnet);
    if (!force) {
      return;
    }
    magnetState.velocity.x += force.x * dt;
    magnetState.velocity.y += force.y * dt;

    magnetState.velocity.x *= damping;
    magnetState.velocity.y *= damping;

    const speed = Math.hypot(magnetState.velocity.x, magnetState.velocity.y);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      magnetState.velocity.x *= scale;
      magnetState.velocity.y *= scale;
    }

    magnetState.position.x += magnetState.velocity.x * dt;
    magnetState.position.y += magnetState.velocity.y * dt;

    const maxX = Math.max(containerWidth - magnetState.size.width, 0);
    const maxY = Math.max(containerHeight - magnetState.size.height, 0);

    if (magnetState.position.x < 0) {
      magnetState.position.x = 0;
      magnetState.velocity.x = Math.abs(magnetState.velocity.x) * boundaryRestitution;
    } else if (magnetState.position.x > maxX) {
      magnetState.position.x = maxX;
      magnetState.velocity.x = -Math.abs(magnetState.velocity.x) * boundaryRestitution;
    }

    if (magnetState.position.y < 0) {
      magnetState.position.y = 0;
      magnetState.velocity.y = Math.abs(magnetState.velocity.y) * boundaryRestitution;
    } else if (magnetState.position.y > maxY) {
      magnetState.position.y = maxY;
      magnetState.velocity.y = -Math.abs(magnetState.velocity.y) * boundaryRestitution;
    }

    applyPosition(state, magnet, magnetState.position.x, magnetState.position.y);
    updatePercentagesForState(state, magnet, containerWidth, containerHeight);
  });
};

const runAnimationFrame = (state, timestamp) => {
  if (!state.active) {
    state.animationFrame = null;
    state.lastFrameTime = null;
    return;
  }
  if (state.lastFrameTime == null) {
    state.lastFrameTime = timestamp;
  }
  let delta = (timestamp - state.lastFrameTime) / 1000;
  if (!Number.isFinite(delta) || delta < 0) {
    delta = 0;
  }
  const cappedDelta = Math.min(delta, 0.12);
  let remaining = cappedDelta;
  while (remaining > 0) {
    const step = Math.min(remaining, PHYSICS_CONFIG.maxStep);
    updatePhysics(state, step);
    remaining -= step;
  }
  state.lastFrameTime = timestamp;
  state.animationFrame = requestAnimationFrame((nextTimestamp) => runAnimationFrame(state, nextTimestamp));
};

const startAnimationLoop = (state) => {
  if (state.animationFrame != null) {
    return;
  }
  state.lastFrameTime = performance.now();
  state.animationFrame = requestAnimationFrame((timestamp) => runAnimationFrame(state, timestamp));
};

const stopAnimationLoop = (state) => {
  if (state.animationFrame != null) {
    cancelAnimationFrame(state.animationFrame);
  }
  state.animationFrame = null;
  state.lastFrameTime = null;
  state.pointerField.active = false;
  state.magnets.forEach((magnet) => {
    const magnetState = state.magnetStates.get(magnet);
    if (magnetState) {
      magnetState.velocity.x = 0;
      magnetState.velocity.y = 0;
    }
  });
};

const stopDragging = (state) => {
  if (!state.dragState) {
    return;
  }
  const { magnet, pointerId } = state.dragState;
  const containerWidth = state.containerWidth || state.grid.clientWidth || state.baseWidth || 1;
  const containerHeight =
    state.containerHeight || parseFloat(state.grid.style.height) || state.grid.clientHeight || state.baseHeight || 1;
  updatePercentagesForState(state, magnet, containerWidth, containerHeight);
  const magnetState = state.magnetStates.get(magnet);
  if (magnetState) {
    magnetState.velocity.x = 0;
    magnetState.velocity.y = 0;
  }
  magnet.classList.remove('magnet--dragging');
  if (typeof magnet.hasPointerCapture === 'function' && magnet.hasPointerCapture(pointerId)) {
    magnet.releasePointerCapture(pointerId);
  } else if (typeof magnet.releasePointerCapture === 'function') {
    try {
      magnet.releasePointerCapture(pointerId);
    } catch (error) {
      // Ignore if the pointer was already released.
    }
  }
  state.grid.removeAttribute('data-dragging');
  state.pointerField.active = false;
  state.dragState = null;
};

const handlePointerDown = (state, event) => {
  if (!state.active) {
    return;
  }
  const magnet = event.currentTarget;
  const position = state.positions.get(magnet);
  const size = state.sizes.get(magnet);
  if (!position || !size) {
    return;
  }
  const magnetState = getOrCreateMagnetState(state, magnet);
  const gridRect = state.grid.getBoundingClientRect();
  const offsetX = event.clientX - (gridRect.left + position.x);
  const offsetY = event.clientY - (gridRect.top + position.y);

  state.dragState = {
    magnet,
    pointerId: event.pointerId,
    offsetX,
    offsetY,
    lastTimestamp: event.timeStamp,
  };

  magnetState.velocity.x = 0;
  magnetState.velocity.y = 0;
  magnet.classList.add('magnet--dragging');
  magnet.setPointerCapture(event.pointerId);
  state.grid.setAttribute('data-dragging', 'true');
  state.pointerField.active = false;
};

const handlePointerMove = (state, event) => {
  if (!state.active) {
    return;
  }
  if (!state.dragState || state.dragState.pointerId !== event.pointerId) {
    return;
  }
  const { magnet, offsetX, offsetY } = state.dragState;
  const size = state.sizes.get(magnet);
  if (!size) {
    return;
  }
  const gridRect = state.grid.getBoundingClientRect();
  const containerWidth = gridRect.width || state.grid.clientWidth || 1;
  const containerHeight = parseFloat(state.grid.style.height) || gridRect.height || state.grid.clientHeight || 1;
  let x = event.clientX - gridRect.left - offsetX;
  let y = event.clientY - gridRect.top - offsetY;
  const maxX = Math.max(containerWidth - size.width, 0);
  const maxY = Math.max(containerHeight - size.height, 0);
  x = clamp(x, 0, maxX);
  y = clamp(y, 0, maxY);
  const magnetState = state.magnetStates.get(magnet);
  if (magnetState) {
    const previousX = magnetState.position.x;
    const previousY = magnetState.position.y;
    const elapsed = Math.max((event.timeStamp - (state.dragState.lastTimestamp ?? event.timeStamp)) / 1000, 0.001);
    magnetState.velocity.x = (x - previousX) / elapsed;
    magnetState.velocity.y = (y - previousY) / elapsed;
  }
  applyPosition(state, magnet, x, y);
  updatePercentagesForState(state, magnet, containerWidth, containerHeight);
  state.dragState.lastTimestamp = event.timeStamp;
  state.containerWidth = containerWidth;
  state.containerHeight = containerHeight;
  if (event.pointerType !== 'mouse') {
    event.preventDefault();
  }
};

const handlePointerUp = (state, event) => {
  if (!state.dragState || state.dragState.pointerId !== event.pointerId) {
    return;
  }
  stopDragging(state);
  persistLayout(state);
};

const handlePointerFieldMove = (state, event) => {
  if (!state.active || state.dragState || event.pointerType !== 'mouse' || event.buttons !== 0) {
    return;
  }
  const rect = state.grid.getBoundingClientRect();
  const x = clamp(event.clientX - rect.left, 0, rect.width || state.containerWidth || 1);
  const y = clamp(event.clientY - rect.top, 0, rect.height || state.containerHeight || 1);
  state.pointerField.active = true;
  state.pointerField.x = x;
  state.pointerField.y = y;
  if (rect.width) {
    state.containerWidth = rect.width;
  }
  const height = parseFloat(state.grid.style.height) || rect.height;
  if (height) {
    state.containerHeight = height;
  }
};

const handlePointerFieldLeave = (state) => {
  state.pointerField.active = false;
};

const initializeGrid = (grid, magnets, storageKey) => {
  const parent = grid.parentElement;
  if (!parent) {
    return;
  }

  grid.classList.add('magnet-grid');

  const shuffleButton = document.createElement('button');
  shuffleButton.type = 'button';
  shuffleButton.className = 'shuffle-button';
  shuffleButton.textContent = 'Shuffle magnets';

  const wrapper = document.createElement('div');
  wrapper.className = 'magnet-grid-wrapper';

  parent.insertBefore(wrapper, grid);
  wrapper.appendChild(grid);
  parent.insertBefore(shuffleButton, wrapper);

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'magnet-play-toggle';
  playButton.textContent = '+ play with';
  playButton.setAttribute('aria-pressed', 'false');
  wrapper.appendChild(playButton);

  const savedLayout = loadStoredLayout(storageKey);
  const gridRect = grid.getBoundingClientRect();
  const baseWidth = gridRect.width || grid.clientWidth || 1;
  const baseHeight = gridRect.height || grid.clientHeight || 1;

  const state = {
    grid,
    magnets,
    storageKey,
    playButton,
    shuffleButton,
    active: false,
    dragState: null,
    layout: new Map(),
    positions: new Map(),
    sizes: new Map(),
    baseSizes: new Map(),
    baseWidth,
    baseHeight,
    resizeObserver: null,
    magnetStates: new Map(),
    animationFrame: null,
    lastFrameTime: null,
    pointerField: { active: false, x: 0, y: 0 },
    containerWidth: baseWidth,
    containerHeight: baseHeight,
  };

  magnets.forEach((magnet, index) => {
    applyMagnetStyles(magnet, index);
    const magnetRect = magnet.getBoundingClientRect();
    const magnetKey = magnet.dataset.magnetKey || magnet.getAttribute('href') || `magnet-${index}`;
    magnet.dataset.magnetKey = magnetKey;
    const baseSize = { width: magnetRect.width, height: magnetRect.height };
    state.baseSizes.set(magnet, baseSize);
    state.sizes.set(magnet, { ...baseSize });
    const defaultPosition = {
      x: magnetRect.left - gridRect.left,
      y: magnetRect.top - gridRect.top,
    };
    const savedPercentages = savedLayout.get(magnetKey);
    const percentages = savedPercentages || toPercentages(defaultPosition, baseSize, baseWidth, baseHeight);
    state.layout.set(magnet, percentages);
    magnet.style.position = 'absolute';
    magnet.style.margin = '0';
    magnet.style.left = '0';
    magnet.style.top = '0';
    magnet.style.setProperty('--magnet-position-x', '0px');
    magnet.style.setProperty('--magnet-position-y', '0px');
  });

  grid.style.height = `${baseHeight}px`;

  applyLayout(state, { suppressTransitions: true });

  if (typeof ResizeObserver === 'function') {
    state.resizeObserver = new ResizeObserver(() => {
      applyLayout(state, { suppressTransitions: true });
    });
    state.resizeObserver.observe(grid);
  } else {
    window.addEventListener('resize', () => {
      applyLayout(state, { suppressTransitions: true });
    });
  }

  shuffleButton.addEventListener('click', () => {
    shuffleLayout(state);
  });

  playButton.addEventListener('click', () => {
    state.active = !state.active;
    grid.classList.toggle('magnet-grid--interactive', state.active);
    updateToggleLabel(state);
    state.pointerField.active = false;
    if (!state.active) {
      stopDragging(state);
      stopAnimationLoop(state);
      persistLayout(state);
    } else {
      applyLayout(state, { suppressTransitions: true });
      startAnimationLoop(state);
    }
  });

  updateToggleLabel(state);

  magnets.forEach((magnet) => {
    magnet.addEventListener('pointerdown', (event) => handlePointerDown(state, event));
    magnet.addEventListener('pointermove', (event) => handlePointerMove(state, event));
    magnet.addEventListener('pointerup', (event) => handlePointerUp(state, event));
    magnet.addEventListener('pointercancel', (event) => handlePointerUp(state, event));
  });

  grid.addEventListener('pointermove', (event) => handlePointerFieldMove(state, event));
  grid.addEventListener('pointerleave', () => handlePointerFieldLeave(state));
  grid.addEventListener('pointercancel', () => handlePointerFieldLeave(state));

  return state;
};

const prepareMagnets = () => {
  const grids = document.querySelectorAll('.pill-grid');
  if (!grids.length) {
    return;
  }
  const pageKey = getPageKey();
  grids.forEach((grid, index) => {
    const magnets = Array.from(grid.querySelectorAll('.pill'));
    if (!magnets.length) {
      return;
    }
    initializeGrid(grid, magnets, `${LAYOUT_STORAGE_PREFIX}${pageKey}:${index}`);
  });
};

document.addEventListener('DOMContentLoaded', prepareMagnets);
