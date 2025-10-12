import { isToggling } from './controller.js';

export function setupResize(board, callback) {
  let scheduled = false;

  const run = () => {
    scheduled = false;
    const info = { w: board.clientWidth, h: board.clientHeight, isToggling: isToggling() };
    console.info('[magnets] resize', info);
    if (isToggling()) {
      return;
    }
    callback();
  };

  const schedule = () => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    requestAnimationFrame(run);
  };

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => {
      schedule();
    });
    observer.observe(board);
    return () => {
      observer.disconnect();
    };
  }

  const handle = () => {
    schedule();
  };
  window.addEventListener('resize', handle);
  return () => {
    window.removeEventListener('resize', handle);
  };
}
