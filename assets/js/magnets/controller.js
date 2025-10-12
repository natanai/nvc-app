import { startPhysics } from './physics.js';
import { readTransform, setTransform, updateBoardHeight, boardRect } from './layout.js';
import { savePositions } from './store.js';
import { DEBUG_MAGNETS } from './debug.js';

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

const clamp = (value, min, max) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const boardState = new WeakMap();
let toggling = false;

function ensureState(board) {
  const state = boardState.get(board);
  if (!state) {
    throw new Error('Magnet board not registered');
  }
  return state;
}

export function registerBoard(board, magnets, { onDragRelease } = {}) {
  const magnetList = Array.from(magnets);
  const state = {
    board,
    magnets: magnetList,
    magnetMap: new Map(),
    physics: null,
    isPlaying: false,
    onDragRelease,
  };
  magnetList.forEach((magnet) => {
    const id = magnet.dataset.magnetId;
    if (id) {
      state.magnetMap.set(id, magnet);
    }
  });
  boardState.set(board, state);
}

export function syncMagnets(board, magnets) {
  const state = ensureState(board);
  state.magnets = Array.from(magnets);
  state.magnetMap.clear();
  state.magnets.forEach((magnet) => {
    const id = magnet.dataset.magnetId;
    if (id) {
      state.magnetMap.set(id, magnet);
    }
  });
}

export function setOnDragRelease(board, callback) {
  const state = ensureState(board);
  state.onDragRelease = callback;
}

function startBoardPhysics(state) {
  if (state.physics) {
    return state.physics;
  }
  const instance = startPhysics({
    board: state.board,
    magnets: state.magnets,
    config: DEFAULT_CONFIG,
    onPositions: (list) => {
      list.forEach(({ id, x, y }) => {
        const element = state.magnetMap.get(id);
        if (!element) {
          return;
        }
        setTransform(element, x, y);
      });
      updateBoardHeight(state.board, state.magnets);
    },
    getBoardSize: () => boardRect(state.board),
    onDragRelease: () => {
      state.onDragRelease?.();
    },
  });
  state.physics = instance;
  return instance;
}

function stopBoardPhysics(state) {
  if (!state.physics) {
    return;
  }
  state.physics.stop();
  state.physics = null;
}

export function isToggling() {
  return toggling;
}

export function isPlaying(board) {
  const state = boardState.get(board);
  return Boolean(state?.isPlaying);
}

export function enterPlay(board) {
  const state = ensureState(board);
  if (state.isPlaying) {
    return;
  }
  toggling = true;
  state.isPlaying = true;
  board.dataset.active = '1';
  state.magnets.forEach((magnet) => {
    magnet.setAttribute('draggable', 'false');
  });
  startBoardPhysics(state);
  if (DEBUG_MAGNETS) {
    console.info('[magnets] play->', true);
  }
  toggling = false;
}

export function currentPositionsPct(board) {
  const state = ensureState(board);
  const { width: bw, height: bh } = boardRect(board);
  const byId = {};
  state.magnets.forEach((magnet) => {
    const id = magnet.dataset.magnetId;
    if (!id) {
      return;
    }
    const { x, y } = readTransform(magnet);
    const xPct = bw ? clamp(x / bw, 0, 1) : 0;
    const yPct = bh ? clamp(y / bh, 0, 1) : 0;
    byId[id] = { xPct, yPct };
  });
  return byId;
}

export function applyPositionsPct(board, byId) {
  const state = ensureState(board);
  const { width: bw, height: bh } = boardRect(board);
  const applied = new Set();
  state.magnets.forEach((magnet) => {
    const id = magnet.dataset.magnetId;
    if (!id) {
      return;
    }
    const pos = byId[id];
    if (!pos) {
      return;
    }
    const x = bw ? pos.xPct * bw : 0;
    const y = bh ? pos.yPct * bh : 0;
    setTransform(magnet, x, y);
    applied.add(id);
  });
  updateBoardHeight(board, state.magnets);
  return applied;
}

export function exitPlay(board) {
  const state = ensureState(board);
  if (!state.isPlaying) {
    return;
  }
  toggling = true;
  stopBoardPhysics(state);
  const byId = currentPositionsPct(board);
  savePositions(byId);
  updateBoardHeight(board, state.magnets);
  state.isPlaying = false;
  delete board.dataset.active;
  state.magnets.forEach((magnet) => {
    magnet.removeAttribute('draggable');
  });
  if (DEBUG_MAGNETS) {
    console.info('[magnets] play->', false);
  }
  window.setTimeout(() => {
    toggling = false;
  }, 120);
}

export function requestShuffle(board) {
  const state = boardState.get(board);
  if (!state?.physics?.shuffle) {
    return Promise.resolve();
  }
  return Promise.resolve(state.physics.shuffle());
}

export function persist(board) {
  const byId = currentPositionsPct(board);
  savePositions(byId);
}
