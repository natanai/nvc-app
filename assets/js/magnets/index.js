import { loadPositions } from './store.js';
import {
  registerBoard,
  syncMagnets,
  enterPlay,
  exitPlay,
  isPlaying,
  applyPositionsPct,
  persist,
  isToggling,
} from './controller.js';
import { readTransform, setTransform, boardRect, updateBoardHeight } from './layout.js';
import { setupResize } from './resize.js';
import { shuffle } from './shuffle.js';
import { setupClickGuard } from './drag.js';
import { DEBUG_MAGNETS } from './debug.js';

const TILT_OPTIONS = [-2, -1, 0, 1, 2];
const OFFSET_OPTIONS = [-3, -2, -1, 0, 1, 2, 3];
const LAYOUT_GAP_X = 12;
const LAYOUT_GAP_Y = 14;
const BOARD_PADDING = 24;
const SHUFFLE_LABEL_DEFAULT = 'Shuffle';
const SHUFFLE_LABEL_BUSY = 'Shuffling…';

const fontsReady =
  typeof document !== 'undefined' && document.fonts && document.fonts.ready
    ? document.fonts.ready.catch(() => undefined)
    : Promise.resolve();

const waitForAnimationFrames = async (count = 1) => {
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

const randomFrom = (values) => values[Math.floor(Math.random() * values.length)];

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value, min, max) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const applyMagnetDecorations = (element, index) => {
  element.classList.add('magnet');
  element.style.order = String(index);
  const tilt = randomFrom(TILT_OPTIONS);
  const offset = randomFrom(OFFSET_OPTIONS);
  element.style.setProperty('--magnet-tilt', `${tilt}deg`);
  element.style.setProperty('--magnet-offset', `${offset}px`);
};

const measureMagnet = (magnet) => {
  const styles = window.getComputedStyle(magnet);
  const width = magnet.offsetWidth || toNumber(styles.width);
  const height = magnet.offsetHeight || toNumber(styles.height);
  const marginLeft = toNumber(styles.marginLeft);
  const marginRight = toNumber(styles.marginRight);
  const marginTop = toNumber(styles.marginTop);
  const marginBottom = toNumber(styles.marginBottom);
  return { width, height, marginLeft, marginRight, marginTop, marginBottom };
};

const rowPackAll = (board, magnets) => {
  const { width: boardWidth } = boardRect(board);
  const width = Math.max(boardWidth || 0, 1);
  let cursorX = BOARD_PADDING;
  let cursorY = BOARD_PADDING;
  let rowHeight = 0;

  magnets.forEach((magnet) => {
    const dims = measureMagnet(magnet);
    const footprintWidth = dims.width + dims.marginLeft + dims.marginRight;
    const footprintHeight = dims.height + dims.marginTop + dims.marginBottom;
    if (cursorX > BOARD_PADDING && cursorX + footprintWidth + LAYOUT_GAP_X > width) {
      cursorX = BOARD_PADDING;
      cursorY += rowHeight + LAYOUT_GAP_Y;
      rowHeight = 0;
    }
    const maxX = Math.max(width - dims.width, 0);
    const x = clamp(cursorX + dims.marginLeft, 0, maxX);
    const y = cursorY + dims.marginTop;
    setTransform(magnet, x, y);
    cursorX += footprintWidth + LAYOUT_GAP_X;
    rowHeight = Math.max(rowHeight, footprintHeight);
  });

  updateBoardHeight(board, magnets);
};

const maxBottomForIds = (magnets, allowedIds) => {
  let bottom = 0;
  magnets.forEach((magnet) => {
    if (allowedIds && !allowedIds.has(magnet.dataset.magnetId || '')) {
      return;
    }
    const { y } = readTransform(magnet);
    const dims = measureMagnet(magnet);
    bottom = Math.max(bottom, y + dims.height + dims.marginBottom);
  });
  return bottom;
};

const placeNewMagnetsAtEnd = (board, magnets, newMagnets, appliedIds) => {
  const { width: boardWidth } = boardRect(board);
  const width = Math.max(boardWidth || 0, 1);
  const baseBottom = maxBottomForIds(magnets, appliedIds);
  let cursorX = BOARD_PADDING;
  let cursorY = baseBottom > 0 ? baseBottom + LAYOUT_GAP_Y : BOARD_PADDING;
  let rowHeight = 0;

  newMagnets.forEach((magnet) => {
    const dims = measureMagnet(magnet);
    const footprintWidth = dims.width + dims.marginLeft + dims.marginRight;
    const footprintHeight = dims.height + dims.marginTop + dims.marginBottom;
    if (cursorX > BOARD_PADDING && cursorX + footprintWidth + LAYOUT_GAP_X > width) {
      cursorX = BOARD_PADDING;
      cursorY += rowHeight + LAYOUT_GAP_Y;
      rowHeight = 0;
    }
    const maxX = Math.max(width - dims.width, 0);
    const x = clamp(cursorX + dims.marginLeft, 0, maxX);
    const y = cursorY + dims.marginTop;
    setTransform(magnet, x, y);
    cursorX += footprintWidth + LAYOUT_GAP_X;
    rowHeight = Math.max(rowHeight, footprintHeight);
  });

  updateBoardHeight(board, magnets);
};

const updateToggleLabel = (toggle, active) => {
  if (!toggle) {
    return;
  }
  toggle.textContent = active ? 'Done' : '+ Play with';
  toggle.setAttribute('aria-pressed', active ? 'true' : 'false');
};

const reconcileBoard = (board, magnets, reason) => {
  syncMagnets(board, magnets);
  const data = loadPositions();
  if (!data?.byId) {
    if (DEBUG_MAGNETS) {
      console.info('[magnets] reseed CALLED', reason ?? 'initial');
    }
    rowPackAll(board, magnets);
    persist(board);
    return;
  }

  const applied = applyPositionsPct(board, data.byId);
  if (!applied.size) {
    if (DEBUG_MAGNETS) {
      console.info('[magnets] reseed CALLED', `${reason ?? 'initial'}-full`);
    }
    rowPackAll(board, magnets);
    persist(board);
    return;
  }

  const missing = magnets.filter((magnet) => !applied.has(magnet.dataset.magnetId || ''));
  if (missing.length) {
    if (DEBUG_MAGNETS) {
      console.info('[magnets] reseed CALLED', `${reason ?? 'load'}-missing`);
    }
    placeNewMagnetsAtEnd(board, magnets, missing, applied);
  }

  persist(board);
};

const initializeBoard = async (root) => {
  const board = root.querySelector('[data-magnet-board]');
  if (!board) {
    return;
  }
  const magnets = Array.from(board.querySelectorAll('.magnet'));
  if (!magnets.length) {
    return;
  }
  magnets.forEach((magnet, index) => {
    if (!magnet.dataset.magnetId) {
      magnet.dataset.magnetId = `magnet-${index}`;
    }
    applyMagnetDecorations(magnet, index);
  });

  const guard = setupClickGuard(board);
  registerBoard(board, magnets, { onDragRelease: () => guard.suppress() });
  updateToggleLabel(root.querySelector('[data-magnet-toggle]'), false);

  await fontsReady;
  await waitForAnimationFrames(2);

  reconcileBoard(board, magnets, 'initial');
  board.dataset.ready = '1';

  const toggle = root.querySelector('[data-magnet-toggle]');
  if (toggle) {
    toggle.addEventListener('click', () => {
      if (isToggling()) {
        return;
      }
      if (isPlaying(board)) {
        exitPlay(board);
        updateToggleLabel(toggle, false);
      } else {
        enterPlay(board);
        updateToggleLabel(toggle, true);
      }
    });
  }

  const shuffleButton = root.querySelector('[data-magnet-shuffle]');
  if (shuffleButton) {
    shuffleButton.textContent = shuffleButton.textContent || SHUFFLE_LABEL_DEFAULT;
    shuffleButton.addEventListener('click', () => {
      if (shuffleButton.dataset.busy === '1') {
        return;
      }
      shuffleButton.dataset.busy = '1';
      const original = shuffleButton.dataset.originalLabel || shuffleButton.textContent || SHUFFLE_LABEL_DEFAULT;
      shuffleButton.dataset.originalLabel = original;
      shuffleButton.textContent = SHUFFLE_LABEL_BUSY;
      shuffleButton.setAttribute('aria-busy', 'true');
      shuffleButton.disabled = true;
      shuffle(board, magnets)
        .catch(() => {})
        .finally(() => {
          shuffleButton.disabled = false;
          shuffleButton.textContent = shuffleButton.dataset.originalLabel || SHUFFLE_LABEL_DEFAULT;
          shuffleButton.removeAttribute('aria-busy');
          shuffleButton.dataset.busy = '0';
        });
    });
  }

  setupResize(board, () => {
    reconcileBoard(board, magnets, 'resize');
  });
};

const setup = async () => {
  const roots = Array.from(document.querySelectorAll('[data-magnet-root]'));
  if (!roots.length) {
    return;
  }
  await fontsReady;
  for (const root of roots) {
    // eslint-disable-next-line no-await-in-loop
    await initializeBoard(root);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setup().catch(() => {});
  });
} else {
  setup().catch(() => {});
}
