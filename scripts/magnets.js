const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const parsePosition = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getMagnetMetrics = (magnet) => {
  const left = parsePosition(magnet.style.left);
  const top = parsePosition(magnet.style.top);
  const width = magnet.offsetWidth;
  const height = magnet.offsetHeight;

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
};

const getOverlap = (a, b) => {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);

  if (width > 0 && height > 0) {
    return { width, height };
  }

  return null;
};

const moveMagnet = (grid, magnet, deltaX, deltaY) => {
  const currentLeft = parsePosition(magnet.style.left);
  const currentTop = parsePosition(magnet.style.top);
  const maxLeft = Math.max(grid.clientWidth - magnet.offsetWidth, 0);
  const maxTop = Math.max(grid.clientHeight - magnet.offsetHeight, 0);

  const nextLeft = clamp(Math.round(currentLeft + deltaX), 0, maxLeft);
  const nextTop = clamp(Math.round(currentTop + deltaY), 0, maxTop);

  magnet.style.left = `${nextLeft}px`;
  magnet.style.top = `${nextTop}px`;

  return {
    deltaX: nextLeft - currentLeft,
    deltaY: nextTop - currentTop,
  };
};

const resolveCollisions = (grid, rootMagnet, magnets) => {
  const maxIterations = 16;
  const baseWeight = 1;
  const rootWeight = 0.35;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let overlapFound = false;

    for (let index = 0; index < magnets.length; index += 1) {
      for (let compare = index + 1; compare < magnets.length; compare += 1) {
        const magnetA = magnets[index];
        const magnetB = magnets[compare];

        const metricsA = getMagnetMetrics(magnetA);
        const metricsB = getMagnetMetrics(magnetB);
        const overlap = getOverlap(metricsA, metricsB);

        if (!overlap) {
          continue;
        }

        overlapFound = true;

        const horizontal = overlap.width < overlap.height;
        const directionX = metricsA.centerX <= metricsB.centerX ? 1 : -1;
        const directionY = metricsA.centerY <= metricsB.centerY ? 1 : -1;
        const separation = (horizontal ? overlap.width : overlap.height) + 1;

        const weightA = rootMagnet && magnetA === rootMagnet ? rootWeight : baseWeight;
        const weightB = rootMagnet && magnetB === rootMagnet ? rootWeight : baseWeight;
        const totalWeight = weightA + weightB || baseWeight * 2;

        const moveAX = horizontal ? -directionX * separation * (weightA / totalWeight) : 0;
        const moveAY = horizontal ? 0 : -directionY * separation * (weightA / totalWeight);
        const moveBX = horizontal ? directionX * separation * (weightB / totalWeight) : 0;
        const moveBY = horizontal ? 0 : directionY * separation * (weightB / totalWeight);

        moveMagnet(grid, magnetA, moveAX, moveAY);
        moveMagnet(grid, magnetB, moveBX, moveBY);
      }
    }

    if (!overlapFound) {
      break;
    }
  }
};

const randomizeMagnets = (grid, magnets) => {
  const gridWidth = grid.clientWidth;
  const gridHeight = grid.clientHeight;

  magnets.forEach((magnet) => {
    const magnetWidth = magnet.offsetWidth;
    const magnetHeight = magnet.offsetHeight;
    const maxLeft = Math.max(gridWidth - magnetWidth, 0);
    const maxTop = Math.max(gridHeight - magnetHeight, 0);
    const left = Math.round(Math.random() * maxLeft);
    const top = Math.round(Math.random() * maxTop);
    magnet.style.left = `${left}px`;
    magnet.style.top = `${top}px`;
  });

  resolveCollisions(grid, null, magnets);
};

const enableDragging = (grid, magnets) => {
  let zIndex = 1;

  magnets.forEach((magnet) => {
    magnet.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

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
        magnet.style.left = `${Math.round(left)}px`;
        magnet.style.top = `${Math.round(top)}px`;

        resolveCollisions(grid, magnet, magnets);
      };

      const releasePointer = (releaseEvent) => {
        magnet.releasePointerCapture(event.pointerId);
        magnet.removeEventListener('pointermove', handleMove);
        magnet.removeEventListener('pointerup', releasePointer);
        magnet.removeEventListener('pointercancel', releasePointer);
        magnet.classList.remove('dragging');

        if (moved) {
          resolveCollisions(grid, null, magnets);
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
