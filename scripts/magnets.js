import { startPhysics, loadPositions, savePositions } from './magnets/magnetPhysics.js';

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

const TILT_OPTIONS = [-2, -1, 0, 1, 2];
const OFFSET_OPTIONS = [-3, -2, -1, 0, 1, 2, 3];

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
  toggle.textContent = active ? 'Done' : '+ Play with';
  toggle.setAttribute('aria-pressed', active ? 'true' : 'false');
};

const createStorageKey = (index) => {
  const path = window.location.pathname.replace(/index\.html$/i, '');
  return `${path}:${index}`;
};

const measureMagnets = (board, elements) => {
  const boardRect = board.getBoundingClientRect();
  return elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      id: element.dataset.magnetId || element.id || element.textContent || '',
      element,
      width: rect.width || element.offsetWidth || 0,
      height: rect.height || element.offsetHeight || 0,
      x: rect.left - boardRect.left,
      y: rect.top - boardRect.top,
      vx: 0,
      vy: 0,
    };
  });
};

const updateBoardHeight = (state) => {
  let maxBottom = 0;
  state.magnets.forEach((magnet) => {
    maxBottom = Math.max(maxBottom, magnet.y + magnet.height);
  });
  const height = Math.max(state.minHeight, maxBottom);
  state.boardHeight = height;
  state.board.style.height = `${height}px`;
};

const updateLayout = (state) => {
  const width = state.boardWidth || 1;
  const height = state.boardHeight || 1;
  state.layout.clear();
  state.magnets.forEach((magnet) => {
    const xPct = width ? clamp(magnet.x / width, 0, 1) : 0;
    const yPct = height ? clamp(magnet.y / height, 0, 1) : 0;
    state.layout.set(magnet.id, { xPct, yPct });
  });
};

const persistLayout = (state, immediate = false) => {
  if (!state.storageKey) {
    return;
  }
  const flush = () => {
    state.saveTimer = null;
    state.lastSaveTime = performance.now();
    savePositions(state.storageKey, { width: state.boardWidth, height: state.boardHeight }, state.magnets);
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

const applyPercentLayout = (state) => {
  const rect = state.board.getBoundingClientRect();
  const width = rect.width || state.board.clientWidth || state.boardWidth || 1;
  state.boardWidth = width;
  const baseHeight = state.boardHeight || state.minHeight || rect.height || 1;
  const layoutHeight = Math.max(baseHeight, 1);
  state.magnets.forEach((magnet) => {
    const percentages = state.layout.get(magnet.id);
    if (percentages) {
      const maxX = Math.max(width - magnet.width, 0);
      const maxY = Math.max(layoutHeight - magnet.height, 0);
      magnet.x = clamp(percentages.xPct * width, 0, maxX);
      magnet.y = clamp(percentages.yPct * layoutHeight, 0, maxY);
    }
    setMagnetTransform(magnet);
  });
  updateBoardHeight(state);
  updateLayout(state);
  persistLayout(state);
};

const seedLayout = (state) => {
  const width = Math.max(state.boardWidth, 1);
  const baseHeight = Math.max(state.boardHeight, state.minHeight, 1);
  const count = state.magnets.length;
  if (!count) {
    return;
  }
  const columns = Math.max(1, Math.round(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const cellWidth = width / columns;
  const cellHeight = baseHeight / rows;
  state.magnets.forEach((magnet, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const jitterX = (Math.random() - 0.5) * Math.min(cellWidth * 0.2, 20);
    const jitterY = (Math.random() - 0.5) * Math.min(cellHeight * 0.2, 20);
    const baseX = column * cellWidth + (cellWidth - magnet.width) / 2 + jitterX;
    const baseY = row * cellHeight + (cellHeight - magnet.height) / 2 + jitterY;
    const maxX = Math.max(width - magnet.width, 0);
    const maxY = Math.max(baseHeight - magnet.height, 0);
    magnet.x = clamp(baseX, 0, maxX);
    magnet.y = clamp(baseY, 0, maxY);
    setMagnetTransform(magnet);
  });
  state.boardHeight = baseHeight;
  updateBoardHeight(state);
};

const shuffleWithoutPhysics = (state) => {
  const width = Math.max(state.boardWidth, 1);
  const height = Math.max(state.boardHeight, state.minHeight, 1);
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
    const jitterX = (Math.random() - 0.5) * Math.min(cellWidth * 0.25, 22);
    const jitterY = (Math.random() - 0.5) * Math.min(cellHeight * 0.25, 22);
    const baseX = column * cellWidth + (cellWidth - magnet.width) / 2 + jitterX;
    const baseY = row * cellHeight + (cellHeight - magnet.height) / 2 + jitterY;
    const maxX = Math.max(width - magnet.width, 0);
    const maxY = Math.max(height - magnet.height, 0);
    magnet.x = clamp(baseX, 0, maxX);
    magnet.y = clamp(baseY, 0, maxY);
    setMagnetTransform(magnet);
  });
  updateBoardHeight(state);
  updateLayout(state);
  persistLayout(state, true);
};

const handlePositionsUpdate = (state, list) => {
  let maxBottom = 0;
  list.forEach((item) => {
    const magnet = state.magnetMap.get(item.id);
    if (!magnet) {
      return;
    }
    magnet.x = item.x;
    magnet.y = item.y;
    maxBottom = Math.max(maxBottom, magnet.y + magnet.height);
  });
  if (maxBottom > 0) {
    state.boardHeight = Math.max(state.minHeight, maxBottom);
    state.board.style.height = `${state.boardHeight}px`;
  }
  updateLayout(state);
  persistLayout(state);
};

const setPlayState = (state, active) => {
  if (active) {
    if (state.physics) {
      return;
    }
    state.board.dataset.active = '1';
    state.root?.setAttribute('data-magnet-active', '1');
    const magnetElements = state.magnets.map((magnet) => magnet.element);
    state.physics = startPhysics({
      board: state.board,
      magnets: magnetElements,
      config: DEFAULT_CONFIG,
      onPositions: (list) => handlePositionsUpdate(state, list),
      getBoardSize: () => ({ width: state.boardWidth, height: state.boardHeight }),
    });
  } else {
    if (!state.physics) {
      return;
    }
    state.physics.stop();
    state.physics = null;
    delete state.board.dataset.active;
    state.root?.removeAttribute('data-magnet-active');
    updateLayout(state);
    persistLayout(state, true);
  }
  updateToggleLabel(state.toggle, active);
};

const initializeBoard = async (root, index) => {
  const board = root.querySelector('[data-magnet-board]');
  if (!board) {
    return;
  }
  const toggle = root.querySelector('[data-magnet-toggle]');
  const shuffleButton = root.querySelector('[data-magnet-shuffle]');
  const magnetElements = Array.from(board.querySelectorAll('.magnet'));
  if (!magnetElements.length) {
    return;
  }

  magnetElements.forEach((element, magnetIndex) => {
    const id = element.dataset.magnetId || `${index}-${magnetIndex}`;
    element.dataset.magnetId = id;
    applyMagnetDecorations(element, magnetIndex);
  });

  await fontsReady;

  const measured = measureMagnets(board, magnetElements);
  const boardRect = board.getBoundingClientRect();
  const state = {
    root,
    board,
    toggle,
    shuffleButton,
    storageKey: createStorageKey(index),
    magnets: measured,
    magnetMap: new Map(),
    layout: new Map(),
    physics: null,
    boardWidth: boardRect.width || board.clientWidth || 1,
    boardHeight: boardRect.height || board.clientHeight || 1,
    minHeight: Math.max(boardRect.height || board.clientHeight || 1, 1),
    saveTimer: null,
    lastSaveTime: 0,
    resizeObserver: null,
    cleanupResize: null,
  };

  measured.forEach((magnet) => {
    magnet.id = magnet.id || `${index}-${state.magnetMap.size}`;
    state.magnetMap.set(magnet.id, magnet);
  });

  board.style.height = `${state.boardHeight}px`;
  board.classList.add('no-transitions');
  board.dataset.ready = '1';

  const sizeMap = new Map(state.magnets.map((magnet) => [magnet.id, { width: magnet.width, height: magnet.height }]));
  const stored = loadPositions(state.storageKey, { width: state.boardWidth, height: state.boardHeight }, sizeMap);

  if (stored && stored.length) {
    const storedById = new Map(stored.map((item) => [item.id, item]));
    state.magnets.forEach((magnet) => {
      const saved = storedById.get(magnet.id);
      if (saved) {
        magnet.x = saved.x;
        magnet.y = saved.y;
      }
      setMagnetTransform(magnet);
    });
    updateBoardHeight(state);
  } else {
    seedLayout(state);
  }

  updateLayout(state);
  persistLayout(state, true);

  requestAnimationFrame(() => {
    board.classList.remove('no-transitions');
  });

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => {
      applyPercentLayout(state);
    });
    observer.observe(board);
    state.resizeObserver = observer;
  } else {
    const handleResize = () => {
      applyPercentLayout(state);
    };
    window.addEventListener('resize', handleResize);
    state.cleanupResize = () => window.removeEventListener('resize', handleResize);
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      const shouldActivate = !state.physics;
      setPlayState(state, shouldActivate);
    });
    updateToggleLabel(toggle, false);
  }

  if (shuffleButton) {
    shuffleButton.addEventListener('click', () => {
      if (state.physics && state.physics.shuffle) {
        state.physics.shuffle();
      } else {
        shuffleWithoutPhysics(state);
      }
    });
  }
};

const setup = async () => {
  const roots = Array.from(document.querySelectorAll('[data-magnet-root]'));
  if (!roots.length) {
    return;
  }
  await fontsReady;
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

