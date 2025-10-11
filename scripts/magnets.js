const shuffleArray = (items) => {
  const array = [...items];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }
  return array;
};

// Whole-number transforms help keep the magnet text crisp on high-density displays.
const tiltOptions = [-2, -1, 0, 1, 2];
const offsetOptions = [-3, -2, -1, 0, 1, 2, 3];

const randomFrom = (options) => options[Math.floor(Math.random() * options.length)];

const applyMagnetStyles = (magnet, index) => {
  magnet.classList.add('magnet');
  magnet.style.order = String(index);
  const tilt = randomFrom(tiltOptions);
  const offset = randomFrom(offsetOptions);
  magnet.style.setProperty('--magnet-tilt', `${tilt}deg`);
  magnet.style.setProperty('--magnet-offset', `${offset}px`);
};

const prepareMagnets = () => {
  const grids = document.querySelectorAll('.pill-grid');

  grids.forEach((grid) => {
    const magnets = Array.from(grid.querySelectorAll('.pill'));
    if (!magnets.length) {
      return;
    }

    const parent = grid.parentElement;
    if (!parent) {
      return;
    }

    grid.classList.add('magnet-grid');

    const shuffleButton = document.createElement('button');
    shuffleButton.type = 'button';
    shuffleButton.className = 'shuffle-button';
    shuffleButton.textContent = 'Shuffle magnets';

    const wrapper = document.createElement('div');
    wrapper.className = 'magnet-grid-wrapper';

    parent.insertBefore(wrapper, grid);
    wrapper.appendChild(grid);
    parent.insertBefore(shuffleButton, wrapper);

    const state = {
      active: false,
      animationId: null,
      positions: new Map(),
      velocities: new Map(),
      sizes: new Map(),
      dragState: null,
      suppressedClicks: new WeakSet(),
      mousePosition: null,
      savedPositions: new Map(),
      savedVelocities: new Map(),
    };

    const clearSavedLayout = () => {
      state.savedPositions.clear();
      state.savedVelocities.clear();
      magnets.forEach((magnet) => {
        magnet.style.removeProperty('--magnet-play-offset-x');
        magnet.style.removeProperty('--magnet-play-offset-y');
      });
    };

    const randomize = () => {
      const shuffled = shuffleArray(magnets);
      const fragment = document.createDocumentFragment();
      shuffled.forEach((magnet, index) => {
        applyMagnetStyles(magnet, index);
        fragment.appendChild(magnet);
      });
      grid.appendChild(fragment);
      clearSavedLayout();
    };

    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'magnet-play-toggle';
    playButton.textContent = '+ play with';
    playButton.setAttribute('aria-pressed', 'false');
    wrapper.appendChild(playButton);

    const updateToggleLabel = () => {
      if (state.active) {
        playButton.textContent = 'Done';
        playButton.setAttribute('aria-pressed', 'true');
      } else {
        playButton.textContent = '+ play with';
        playButton.setAttribute('aria-pressed', 'false');
      }
    };

    const updateMousePosition = (event) => {
      if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') {
        state.mousePosition = null;
        return;
      }
      const gridRect = grid.getBoundingClientRect();
      state.mousePosition = {
        x: event.clientX - gridRect.left,
        y: event.clientY - gridRect.top,
      };
    };

    const resolveCollisions = () => {
      for (let i = 0; i < magnets.length; i += 1) {
        const magnetA = magnets[i];
        if (state.dragState?.magnet === magnetA) {
          continue;
        }
        const posA = state.positions.get(magnetA);
        const velA = state.velocities.get(magnetA);
        const sizeA = state.sizes.get(magnetA);
        if (!posA || !velA || !sizeA) {
          continue;
        }

        for (let j = i + 1; j < magnets.length; j += 1) {
          const magnetB = magnets[j];
          if (state.dragState?.magnet === magnetB) {
            continue;
          }
          const posB = state.positions.get(magnetB);
          const velB = state.velocities.get(magnetB);
          const sizeB = state.sizes.get(magnetB);
          if (!posB || !velB || !sizeB) {
            continue;
          }

          const centerAx = posA.x + sizeA.width / 2;
          const centerAy = posA.y + sizeA.height / 2;
          const centerBx = posB.x + sizeB.width / 2;
          const centerBy = posB.y + sizeB.height / 2;

          const diffX = centerAx - centerBx;
          const diffY = centerAy - centerBy;
          const overlapX = sizeA.width / 2 + sizeB.width / 2 - Math.abs(diffX);
          const overlapY = sizeA.height / 2 + sizeB.height / 2 - Math.abs(diffY);

          if (overlapX > 0 && overlapY > 0) {
            if (overlapX < overlapY) {
              const direction = diffX > 0 ? 1 : -1;
              const separation = overlapX / 2;
              posA.x += separation * direction;
              posB.x -= separation * direction;
              const temp = velA.x;
              velA.x = velB.x;
              velB.x = temp;
            } else {
              const direction = diffY > 0 ? 1 : -1;
              const separation = overlapY / 2;
              posA.y += separation * direction;
              posB.y -= separation * direction;
              const temp = velA.y;
              velA.y = velB.y;
              velB.y = temp;
            }
          }
        }
      }
    };

    const animate = () => {
      if (!state.active) {
        return;
      }

      const width = grid.clientWidth;
      const height = grid.clientHeight;
      const pointer = state.mousePosition;

      magnets.forEach((magnet) => {
        if (state.dragState?.magnet === magnet) {
          return;
        }

        const velocity = state.velocities.get(magnet);
        const position = state.positions.get(magnet);
        const size = state.sizes.get(magnet);

        if (!velocity || !position || !size) {
          return;
        }

        velocity.x += (Math.random() - 0.5) * 0.05;
        velocity.y += (Math.random() - 0.5) * 0.05;

        if (pointer) {
          const centerX = position.x + size.width / 2;
          const centerY = position.y + size.height / 2;
          const diffX = centerX - pointer.x;
          const diffY = centerY - pointer.y;
          const distanceSquared = diffX * diffX + diffY * diffY;
          const influenceRadius = 180;
          if (distanceSquared < influenceRadius * influenceRadius) {
            const distance = Math.sqrt(distanceSquared) || 0.0001;
            const strength = 1 - Math.min(distance / influenceRadius, 1);
            const force = strength * 0.08;
            velocity.x += (diffX / distance) * force;
            velocity.y += (diffY / distance) * force;
          }
        }

        velocity.x *= 0.99;
        velocity.y *= 0.99;

        position.x += velocity.x;
        position.y += velocity.y;

        if (position.x <= 0) {
          position.x = 0;
          velocity.x *= -0.8;
        } else if (position.x + size.width >= width) {
          position.x = Math.max(0, width - size.width);
          velocity.x *= -0.8;
        }

        if (position.y <= 0) {
          position.y = 0;
          velocity.y *= -0.8;
        } else if (position.y + size.height >= height) {
          position.y = Math.max(0, height - size.height);
          velocity.y *= -0.8;
        }
      });

      resolveCollisions();

      magnets.forEach((magnet) => {
        if (state.dragState?.magnet === magnet) {
          return;
        }

        const position = state.positions.get(magnet);
        const size = state.sizes.get(magnet);
        if (!position || !size) {
          return;
        }

        const maxX = Math.max(0, width - size.width);
        const maxY = Math.max(0, height - size.height);

        if (position.x < 0) {
          position.x = 0;
        } else if (position.x > maxX) {
          position.x = maxX;
        }

        if (position.y < 0) {
          position.y = 0;
        } else if (position.y > maxY) {
          position.y = maxY;
        }
      });

      magnets.forEach((magnet) => {
        const position = state.positions.get(magnet);
        if (!position) {
          return;
        }
        magnet.style.left = `${position.x}px`;
        magnet.style.top = `${position.y}px`;
      });

      state.animationId = window.requestAnimationFrame(animate);
    };

    const resetMagnetStyles = () => {
      magnets.forEach((magnet) => {
        magnet.style.position = '';
        magnet.style.left = '';
        magnet.style.top = '';
        magnet.style.margin = '';
        magnet.style.transition = '';
        magnet.classList.remove('magnet--dragging');
      });
    };

    const stopPhysics = () => {
      if (!state.active) {
        return;
      }

      state.active = false;
      if (state.animationId) {
        window.cancelAnimationFrame(state.animationId);
        state.animationId = null;
      }

      if (state.dragState) {
        state.dragState.magnet.classList.remove('magnet--dragging');
        state.dragState.magnet.releasePointerCapture(state.dragState.pointerId);
        state.dragState = null;
      }

      const gridRect = grid.getBoundingClientRect();

      state.savedPositions.clear();
      magnets.forEach((magnet) => {
        const position = state.positions.get(magnet);
        const size = state.sizes.get(magnet);
        if (position && size) {
          state.savedPositions.set(magnet, {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
          });
        } else {
          const rect = magnet.getBoundingClientRect();
          state.savedPositions.set(magnet, {
            x: rect.left - gridRect.left,
            y: rect.top - gridRect.top,
            width: rect.width,
            height: rect.height,
          });
        }
      });
      state.savedVelocities.clear();
      state.velocities.forEach((velocity, magnet) => {
        if (velocity) {
          state.savedVelocities.set(magnet, {
            x: velocity.x,
            y: velocity.y,
          });
        }
      });

      const orderedMagnets = magnets
        .map((magnet) => {
          const position = state.positions.get(magnet);
          const size = state.sizes.get(magnet);
          if (position && size) {
            return {
              magnet,
              centerX: position.x + size.width / 2,
              centerY: position.y + size.height / 2,
            };
          }

          const rect = magnet.getBoundingClientRect();
          return {
            magnet,
            centerX: rect.left - gridRect.left + rect.width / 2,
            centerY: rect.top - gridRect.top + rect.height / 2,
          };
        })
        .sort((a, b) => (a.centerY - b.centerY) || (a.centerX - b.centerX));

      const fragment = document.createDocumentFragment();
      orderedMagnets.forEach(({ magnet }, index) => {
        magnet.style.order = String(index);
        fragment.appendChild(magnet);
      });
      grid.appendChild(fragment);

      state.positions.clear();
      state.velocities.clear();
      state.sizes.clear();
      state.mousePosition = null;
      state.suppressedClicks = new WeakSet();

      grid.classList.remove('magnet-grid--playing');
      grid.style.height = '';

      resetMagnetStyles();
      updateToggleLabel();

      window.requestAnimationFrame(() => {
        const latestGridRect = grid.getBoundingClientRect();
        magnets.forEach((magnet) => {
          const savedPosition = state.savedPositions.get(magnet);
          if (!savedPosition) {
            magnet.style.removeProperty('--magnet-play-offset-x');
            magnet.style.removeProperty('--magnet-play-offset-y');
            return;
          }

          const rect = magnet.getBoundingClientRect();
          const savedCenterX = savedPosition.x + (savedPosition.width ?? rect.width) / 2;
          const savedCenterY = savedPosition.y + (savedPosition.height ?? rect.height) / 2;
          const currentCenterX = rect.left - latestGridRect.left + rect.width / 2;
          const currentCenterY = rect.top - latestGridRect.top + rect.height / 2;
          const offsetX = savedCenterX - currentCenterX;
          const offsetY = savedCenterY - currentCenterY;

          magnet.style.setProperty('--magnet-play-offset-x', `${offsetX}px`);
          magnet.style.setProperty('--magnet-play-offset-y', `${offsetY}px`);
        });
      });
    };

    const startPhysics = () => {
      if (state.active) {
        return;
      }

      const initialHeight = grid.clientHeight;
      const gridRect = grid.getBoundingClientRect();
      grid.style.height = `${initialHeight}px`;
      grid.classList.add('magnet-grid--playing');

      state.positions.clear();
      state.velocities.clear();
      state.sizes.clear();
      state.mousePosition = null;
      state.suppressedClicks = new WeakSet();

      const width = grid.clientWidth;
      const height = grid.clientHeight;

      magnets.forEach((magnet) => {
        const rect = magnet.getBoundingClientRect();
        const savedPosition = state.savedPositions.get(magnet);
        const size = {
          width: rect.width,
          height: rect.height,
        };

        let position;
        if (savedPosition) {
          position = {
            x: savedPosition.x,
            y: savedPosition.y,
          };
        } else {
          position = {
            x: rect.left - gridRect.left,
            y: rect.top - gridRect.top,
          };
        }

        const maxX = Math.max(0, width - size.width);
        const maxY = Math.max(0, height - size.height);
        position.x = Math.min(Math.max(0, position.x), maxX);
        position.y = Math.min(Math.max(0, position.y), maxY);

        const savedVelocity = state.savedVelocities.get(magnet);
        const velocity = savedVelocity
          ? { x: savedVelocity.x * 0.6, y: savedVelocity.y * 0.6 }
          : {
              x: (Math.random() - 0.5) * 0.6,
              y: (Math.random() - 0.5) * 0.6,
            };

        state.positions.set(magnet, position);
        state.velocities.set(magnet, velocity);
        state.sizes.set(magnet, size);

        magnet.style.position = 'absolute';
        magnet.style.left = `${position.x}px`;
        magnet.style.top = `${position.y}px`;
        magnet.style.margin = '0';
        magnet.style.transition = 'none';
        magnet.style.setProperty('--magnet-play-offset-x', '0px');
        magnet.style.setProperty('--magnet-play-offset-y', '0px');
      });

      state.active = true;
      updateToggleLabel();
      state.animationId = window.requestAnimationFrame(animate);
    };

    const handlePointerDown = (event) => {
      if (!state.active) {
        return;
      }

      const magnet = event.currentTarget;
      const position = state.positions.get(magnet);
      const size = state.sizes.get(magnet);
      if (!position || !size) {
        return;
      }

      event.preventDefault();
      const gridRect = grid.getBoundingClientRect();
      state.dragState = {
        magnet,
        pointerId: event.pointerId,
        offsetX: event.clientX - gridRect.left - position.x,
        offsetY: event.clientY - gridRect.top - position.y,
        startX: event.clientX,
        startY: event.clientY,
        hasDragged: false,
      };

      const velocity = state.velocities.get(magnet);
      if (velocity) {
        velocity.x = 0;
        velocity.y = 0;
      }

      magnet.classList.add('magnet--dragging');
      magnet.setPointerCapture(event.pointerId);
      state.suppressedClicks.delete(magnet);
      updateMousePosition(event);
    };

    const handlePointerMove = (event) => {
      if (!state.active) {
        return;
      }

      if (!state.dragState || state.dragState.pointerId !== event.pointerId) {
        return;
      }

      const { magnet, offsetX, offsetY, startX, startY } = state.dragState;
      const position = state.positions.get(magnet);
      const size = state.sizes.get(magnet);
      if (!position || !size) {
        return;
      }

      const gridRect = grid.getBoundingClientRect();
      const width = grid.clientWidth;
      const height = grid.clientHeight;

      let x = event.clientX - gridRect.left - offsetX;
      let y = event.clientY - gridRect.top - offsetY;

      const maxX = Math.max(0, width - size.width);
      const maxY = Math.max(0, height - size.height);

      x = Math.min(Math.max(0, x), maxX);
      y = Math.min(Math.max(0, y), maxY);

      position.x = x;
      position.y = y;
      magnet.style.left = `${x}px`;
      magnet.style.top = `${y}px`;

      if (!state.dragState.hasDragged) {
        const moveX = Math.abs(event.clientX - startX);
        const moveY = Math.abs(event.clientY - startY);
        if (moveX > 6 || moveY > 6) {
          state.dragState.hasDragged = true;
        }
      }

      updateMousePosition(event);
    };

    const handlePointerUp = (event) => {
      if (!state.dragState || state.dragState.pointerId !== event.pointerId) {
        return;
      }

      const { magnet, hasDragged } = state.dragState;
      magnet.classList.remove('magnet--dragging');
      magnet.releasePointerCapture(event.pointerId);
      if (hasDragged) {
        state.suppressedClicks.add(magnet);
      }
      state.dragState = null;
      updateMousePosition(event);
    };

    const handleGridPointerMove = (event) => {
      if (!state.active) {
        return;
      }
      updateMousePosition(event);
    };

    const handleGridPointerLeave = () => {
      state.mousePosition = null;
    };

    magnets.forEach((magnet, index) => {
      magnet.addEventListener('pointerdown', handlePointerDown);
      magnet.addEventListener('pointermove', handlePointerMove);
      magnet.addEventListener('pointerup', handlePointerUp);
      magnet.addEventListener('pointercancel', handlePointerUp);
      magnet.addEventListener('click', (event) => {
        if (state.active && state.suppressedClicks.has(magnet)) {
          event.preventDefault();
          event.stopPropagation();
          state.suppressedClicks.delete(magnet);
        }
      });
      applyMagnetStyles(magnet, index);
    });

    grid.addEventListener('pointermove', handleGridPointerMove);
    grid.addEventListener('pointerleave', handleGridPointerLeave);

    shuffleButton.addEventListener('click', () => {
      if (state.active) {
        stopPhysics();
        return;
      }
      randomize();
    });
    playButton.addEventListener('click', () => {
      if (state.active) {
        stopPhysics();
      } else {
        startPhysics();
      }
    });

    updateToggleLabel();
    randomize();
  });
};

document.addEventListener('DOMContentLoaded', prepareMagnets);
