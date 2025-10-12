const CLICK_SUPPRESS_WINDOW = 150;

const now = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

export function setupClickGuard(board) {
  let suppressUntil = 0;

  const handleClick = (event) => {
    if (now() < suppressUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  board.addEventListener('click', handleClick, true);

  return {
    suppress() {
      suppressUntil = now() + CLICK_SUPPRESS_WINDOW;
    },
    destroy() {
      board.removeEventListener('click', handleClick, true);
    },
  };
}
