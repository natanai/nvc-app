let initializedBoards;

function getInitializedBoards() {
  if (!initializedBoards) {
    initializedBoards = new WeakSet();
  }
  return initializedBoards;
}

export async function initMagnetBoard(board, magnets, { fontsBarrier = true } = {}) {
  if (!board) return;
  const boards = getInitializedBoards();
  if (boards.has(board)) {
    return;
  }

  if (fontsBarrier && typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (error) {
      // Ignore font readiness rejections.
    }
  }

  board.classList.add('no-transitions');

  const boardRect = board.getBoundingClientRect();
  magnets.forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const style = getComputedStyle(element);
    const hasMatrix = style.transform && style.transform !== 'none';
    if (hasMatrix) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const x = rect.left - boardRect.left + board.scrollLeft;
    const y = rect.top - boardRect.top + board.scrollTop;
    element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  });

  updateBoardHeight(board, magnets);

  requestAnimationFrame(() => {
    board.classList.remove('no-transitions');
  });

  boards.add(board);
  console.info('[magnets] init: didInitLayout = true');
}

function parseMatrix(transform) {
  if (!transform || transform === 'none') {
    return { x: 0, y: 0 };
  }

  const MatrixCtor = typeof DOMMatrixReadOnly === 'function'
    ? DOMMatrixReadOnly
    : (typeof DOMMatrix === 'function' ? DOMMatrix : null);

  if (MatrixCtor) {
    const matrix = new MatrixCtor(transform);
    return { x: matrix.m41, y: matrix.m42 };
  }

  // Fallback: attempt to parse translate(x, y)
  const match = transform.match(/translate(?:3d)?\(([^,]+),\s*([^,\)]+)(?:,[^\)]*)?\)/i);
  if (!match) {
    return { x: 0, y: 0 };
  }
  const x = Number.parseFloat(match[1]);
  const y = Number.parseFloat(match[2]);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

export function updateBoardHeight(board, magnets) {
  let bottom = 0;
  magnets.forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const style = getComputedStyle(element);
    if (
      element.hidden ||
      element.getAttribute('aria-hidden') === 'true' ||
      element.dataset.navHidden === 'true' ||
      style.display === 'none' ||
      style.visibility === 'hidden'
    ) {
      return;
    }
    const { y } = parseMatrix(style.transform);
    const height = element.offsetHeight || Number.parseFloat(style.height || '0') || 0;
    bottom = Math.max(bottom, y + height);
  });
  const height = Math.ceil(bottom + 24);
  board.style.height = `${height}px`;
  return height;
}

