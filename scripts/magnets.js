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

const applyMagnetStyles = (magnet, index) => {
  magnet.classList.add('magnet');
  magnet.style.order = String(index);
  const tilt = randomFrom(tiltOptions);
  const offset = randomFrom(offsetOptions);
  magnet.style.setProperty('--magnet-tilt', `${tilt}deg`);
  magnet.style.setProperty('--magnet-offset', `${offset}px`);
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
  let maxBottom = 0;

  state.magnets.forEach((magnet) => {
    const measuredWidth = magnet.offsetWidth || magnet.getBoundingClientRect().width || state.baseSizes.get(magnet)?.width || 0;
    const measuredHeight = magnet.offsetHeight || magnet.getBoundingClientRect().height || state.baseSizes.get(magnet)?.height || 0;
    const size = { width: measuredWidth, height: measuredHeight };
    state.sizes.set(magnet, size);

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
  state.grid.classList.add('magnet-grid--no-transitions');
  state.magnets.forEach((magnet) => {
    const size = state.sizes.get(magnet);
    if (!size) {
      return;
    }
    const maxX = Math.max(containerWidth - size.width, 0);
    const maxY = Math.max(containerHeight - size.height, 0);
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
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

const stopDragging = (state) => {
  if (!state.dragState) {
    return;
  }
  const { magnet, pointerId } = state.dragState;
  magnet.classList.remove('magnet--dragging');
  magnet.releasePointerCapture(pointerId);
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
  const gridRect = state.grid.getBoundingClientRect();
  const offsetX = event.clientX - (gridRect.left + position.x);
  const offsetY = event.clientY - (gridRect.top + position.y);

  state.dragState = {
    magnet,
    pointerId: event.pointerId,
    offsetX,
    offsetY,
    hasDragged: false,
  };

  magnet.classList.add('magnet--dragging');
  magnet.setPointerCapture(event.pointerId);
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
  applyPosition(state, magnet, x, y);
  updatePercentagesForMagnet(state, magnet, containerWidth, containerHeight);
  state.dragState.hasDragged = true;
};

const handlePointerUp = (state, event) => {
  if (!state.dragState || state.dragState.pointerId !== event.pointerId) {
    return;
  }
  const { magnet } = state.dragState;
  const gridRect = state.grid.getBoundingClientRect();
  const containerWidth = gridRect.width || state.grid.clientWidth || 1;
  const containerHeight = parseFloat(state.grid.style.height) || gridRect.height || state.grid.clientHeight || 1;
  updatePercentagesForMagnet(state, magnet, containerWidth, containerHeight);
  stopDragging(state);
  persistLayout(state);
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
    if (!state.active) {
      stopDragging(state);
      persistLayout(state);
    } else {
      applyLayout(state, { suppressTransitions: true });
    }
  });

  updateToggleLabel(state);

  magnets.forEach((magnet) => {
    magnet.addEventListener('pointerdown', (event) => handlePointerDown(state, event));
    magnet.addEventListener('pointermove', (event) => handlePointerMove(state, event));
    magnet.addEventListener('pointerup', (event) => handlePointerUp(state, event));
    magnet.addEventListener('pointercancel', (event) => handlePointerUp(state, event));
  });

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
