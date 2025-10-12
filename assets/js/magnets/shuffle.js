import { setTransform, updateBoardHeight, boardRect } from './layout.js';
import { isPlaying, requestShuffle, persist } from './controller.js';
import { DEBUG_MAGNETS } from './debug.js';

const LAYOUT_GAP_X = 12;
const LAYOUT_GAP_Y = 14;
const BOARD_PADDING = 24;

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value, min, max) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const shuffleArray = (items) => {
  const list = items.slice();
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

const measure = (magnet) => {
  const styles = window.getComputedStyle(magnet);
  const width = magnet.offsetWidth || toNumber(styles.width);
  const height = magnet.offsetHeight || toNumber(styles.height);
  const marginLeft = toNumber(styles.marginLeft);
  const marginRight = toNumber(styles.marginRight);
  const marginTop = toNumber(styles.marginTop);
  const marginBottom = toNumber(styles.marginBottom);
  return { width, height, marginLeft, marginRight, marginTop, marginBottom };
};

function layoutRowPacked(board, magnets) {
  const { width: boardWidth } = boardRect(board);
  const width = Math.max(boardWidth || 0, 1);
  const order = shuffleArray(magnets);
  const placements = [];
  const startX = BOARD_PADDING;
  const startY = BOARD_PADDING;
  let cursorX = startX;
  let cursorY = startY;
  let rowHeight = 0;

  order.forEach((magnet) => {
    const dims = measure(magnet);
    const footprintWidth = dims.width + dims.marginLeft + dims.marginRight;
    const footprintHeight = dims.height + dims.marginTop + dims.marginBottom;
    if (cursorX > startX && cursorX + footprintWidth + LAYOUT_GAP_X > width) {
      cursorX = startX;
      cursorY += rowHeight + LAYOUT_GAP_Y;
      rowHeight = 0;
    }
    const maxX = Math.max(width - dims.width, 0);
    const x = clamp(cursorX + dims.marginLeft, 0, maxX);
    const y = cursorY + dims.marginTop;
    placements.push({ magnet, x, y });
    cursorX += footprintWidth + LAYOUT_GAP_X;
    rowHeight = Math.max(rowHeight, footprintHeight);
  });

  placements.forEach(({ magnet, x, y }) => {
    setTransform(magnet, x, y);
  });
  updateBoardHeight(board, magnets);
}

export function shuffle(board, magnets) {
  if (isPlaying(board)) {
    if (DEBUG_MAGNETS) {
      console.info('[magnets] reseed CALLED', 'shuffle-physics');
    }
    return requestShuffle(board).then(() => {
      persist(board);
    });
  }

  if (DEBUG_MAGNETS) {
    console.info('[magnets] reseed CALLED', 'shuffle-manual');
  }
  layoutRowPacked(board, magnets);
  persist(board);
  return Promise.resolve();
}
