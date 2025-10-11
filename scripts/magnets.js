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
