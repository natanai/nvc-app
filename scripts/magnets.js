const shuffleArray = (items) => {
  const array = [...items];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }
  return array;
};

const applyMagnetStyles = (magnet, index) => {
  magnet.classList.add('magnet');
  magnet.style.order = String(index);
  const tilt = (Math.random() - 0.5) * 4; // -2deg to 2deg
  const offset = (Math.random() - 0.5) * 6; // slight vertical wiggle
  magnet.style.setProperty('--magnet-tilt', `${tilt.toFixed(2)}deg`);
  magnet.style.setProperty('--magnet-offset', `${offset.toFixed(2)}px`);
};

const prepareMagnets = () => {
  const grids = document.querySelectorAll('.pill-grid');

  grids.forEach((grid) => {
    const magnets = Array.from(grid.querySelectorAll('.pill'));
    if (!magnets.length) {
      return;
    }

    grid.classList.add('magnet-grid');

    const shuffleButton = document.createElement('button');
    shuffleButton.type = 'button';
    shuffleButton.className = 'shuffle-button';
    shuffleButton.textContent = 'Shuffle magnets';
    grid.parentElement?.insertBefore(shuffleButton, grid);

    const randomize = () => {
      const shuffled = shuffleArray(magnets);
      const fragment = document.createDocumentFragment();
      shuffled.forEach((magnet, index) => {
        applyMagnetStyles(magnet, index);
        fragment.appendChild(magnet);
      });
      grid.appendChild(fragment);
    };

    shuffleButton.addEventListener('click', randomize);
    randomize();
  });
};

document.addEventListener('DOMContentLoaded', prepareMagnets);
