const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const randomizeMagnets = (grid, magnets) => {
  const gridWidth = grid.clientWidth;
  const gridHeight = grid.clientHeight;

  magnets.forEach((magnet) => {
    const magnetWidth = magnet.offsetWidth;
    const magnetHeight = magnet.offsetHeight;
    const maxLeft = Math.max(gridWidth - magnetWidth, 0);
    const maxTop = Math.max(gridHeight - magnetHeight, 0);
    const left = Math.random() * maxLeft;
    const top = Math.random() * maxTop;
    magnet.style.left = `${left}px`;
    magnet.style.top = `${top}px`;
  });
};

const enableDragging = (grid, magnets) => {
  let zIndex = 1;

  magnets.forEach((magnet) => {
    magnet.addEventListener('pointerdown', (event) => {
      const magnetRect = magnet.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();
      const offsetX = event.clientX - magnetRect.left;
      const offsetY = event.clientY - magnetRect.top;
      let moved = false;

      magnet.setPointerCapture(event.pointerId);
      magnet.style.zIndex = String(++zIndex);

      const handleMove = (moveEvent) => {
        if (!moved && (Math.abs(moveEvent.clientX - event.clientX) > 2 || Math.abs(moveEvent.clientY - event.clientY) > 2)) {
          moved = true;
          magnet.classList.add('dragging');
        }

        if (!moved) {
          return;
        }

        const magnetWidth = magnetRect.width;
        const magnetHeight = magnetRect.height;
        const left = clamp(moveEvent.clientX - gridRect.left - offsetX, 0, gridRect.width - magnetWidth);
        const top = clamp(moveEvent.clientY - gridRect.top - offsetY, 0, gridRect.height - magnetHeight);
        magnet.style.left = `${left}px`;
        magnet.style.top = `${top}px`;
      };

      const releasePointer = (releaseEvent) => {
        magnet.releasePointerCapture(event.pointerId);
        magnet.removeEventListener('pointermove', handleMove);
        magnet.removeEventListener('pointerup', releasePointer);
        magnet.removeEventListener('pointercancel', releasePointer);
        magnet.classList.remove('dragging');

        if (moved) {
          magnet.dataset.justDragged = 'true';
          releaseEvent.preventDefault();
          setTimeout(() => {
            magnet.dataset.justDragged = 'false';
          }, 0);
        }
      };

      magnet.addEventListener('pointermove', handleMove);
      magnet.addEventListener('pointerup', releasePointer);
      magnet.addEventListener('pointercancel', releasePointer);
    });

    magnet.addEventListener('click', (event) => {
      if (magnet.dataset.justDragged === 'true') {
        event.preventDefault();
      }
    });
  });
};

const prepareMagnets = () => {
  const grids = document.querySelectorAll('.pill-grid');

  grids.forEach((grid) => {
    const magnets = Array.from(grid.querySelectorAll('.pill'));
    if (!magnets.length) {
      return;
    }

    grid.classList.add('magnet-grid');
    grid.style.position = 'relative';
    grid.style.overflow = 'hidden';

    const measurements = magnets.map((magnet) => {
      const rect = magnet.getBoundingClientRect();
      return { magnet, width: rect.width, height: rect.height };
    });

    measurements.forEach(({ magnet, width, height }) => {
      magnet.classList.add('magnet');
      magnet.style.position = 'absolute';
      magnet.style.width = `${width}px`;
      magnet.style.height = `${height}px`;
      magnet.style.touchAction = 'none';
      magnet.style.left = '0px';
      magnet.style.top = '0px';
    });

    const shuffleButton = document.createElement('button');
    shuffleButton.type = 'button';
    shuffleButton.className = 'shuffle-button';
    shuffleButton.textContent = 'Shuffle magnets';

    grid.parentElement?.insertBefore(shuffleButton, grid);

    const shuffle = () => {
      randomizeMagnets(grid, magnets);
    };

    shuffleButton.addEventListener('click', shuffle);
    shuffle();
    enableDragging(grid, magnets);
  });
};

document.addEventListener('DOMContentLoaded', prepareMagnets);
