const BOARD_PADDING = 24;

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getMatrixValues = (transform) => {
  if (!transform || transform === 'none') {
    return { x: 0, y: 0 };
  }
  if (typeof DOMMatrixReadOnly === 'function') {
    try {
      const matrix = new DOMMatrixReadOnly(transform);
      return { x: matrix.m41, y: matrix.m42 };
    } catch {
      // fall through to manual parsing
    }
  }
  const match = transform.match(/matrix(?:3d)?\(([^)]+)\)/);
  if (!match) {
    return { x: 0, y: 0 };
  }
  const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
  if (match[0].startsWith('matrix3d')) {
    const x = Number.isFinite(parts[12]) ? parts[12] : 0;
    const y = Number.isFinite(parts[13]) ? parts[13] : 0;
    return { x, y };
  }
  const x = Number.isFinite(parts[4]) ? parts[4] : 0;
  const y = Number.isFinite(parts[5]) ? parts[5] : 0;
  return { x, y };
};

export function readTransform(element) {
  const dataX = Number.parseFloat(element.dataset.magnetX || '');
  const dataY = Number.parseFloat(element.dataset.magnetY || '');
  if (Number.isFinite(dataX) && Number.isFinite(dataY)) {
    return { x: dataX, y: dataY };
  }
  const style = window.getComputedStyle(element);
  const parsed = getMatrixValues(style.transform || element.style.transform || '');
  return parsed;
}

export function setTransform(element, x, y) {
  element.dataset.magnetX = String(x);
  element.dataset.magnetY = String(y);
  element.style.transform =
    `translate3d(${x}px, ${y}px, 0) translateY(calc(var(--magnet-offset, 0px) + var(--magnet-hover-offset, 0px))) rotate(var(--magnet-tilt, 0))`;
}

export function updateBoardHeight(board, magnets) {
  let bottom = 0;
  magnets.forEach((magnet) => {
    const { y: currentY } = readTransform(magnet);
    const styles = window.getComputedStyle(magnet);
    const height = magnet.offsetHeight || toNumber(styles.height);
    const marginBottom = toNumber(styles.marginBottom);
    bottom = Math.max(bottom, currentY + height + marginBottom);
  });
  const height = Math.ceil(bottom + BOARD_PADDING);
  board.style.height = `${height}px`;
  return { bottom, height };
}

export function boardRect(board) {
  const rect = board.getBoundingClientRect();
  const width = rect.width || board.clientWidth;
  const height = rect.height || board.clientHeight;
  return {
    width: Math.max(width || 0, 0),
    height: Math.max(height || 0, 0),
  };
}
