import { getMainDoors, resolveDoorHref, resolvePath } from './doors-data.js';

const ICON_MAP = {
  observations: 'icons/door-observations.svg',
  feelings: 'icons/door-feelings.svg',
  needs: 'icons/door-needs.svg',
};

function createDoorCard(door) {
  const card = document.createElement('div');
  card.className = `door-card door-card--${door.id}`;

  const link = document.createElement('a');
  link.className = 'door-card__link';
  link.href = resolveDoorHref(door.href);

  const doorWrap = document.createElement('span');
  doorWrap.className = 'door-card__door';
  doorWrap.setAttribute('aria-hidden', 'true');

  const iconSrc = ICON_MAP[door.id];
  if (iconSrc) {
    const img = document.createElement('img');
    img.className = 'door-card__icon';
    img.src = resolvePath(iconSrc);
    img.alt = '';
    img.loading = 'lazy';
    img.setAttribute('aria-hidden', 'true');
    doorWrap.appendChild(img);
  }

  const label = document.createElement('span');
  label.className = 'door-card__label';
  label.textContent = door.label ?? door.id;

  link.append(doorWrap, label);
  card.appendChild(link);

  if (door.id === 'feelings') {
    const supportLink = document.createElement('a');
    supportLink.className = 'door-card__support';
    supportLink.href = resolvePath('alexithymia-support/');
    supportLink.textContent = 'Alexithymia support';
    card.appendChild(supportLink);
  }

  return card;
}

async function renderDoors() {
  const container = document.querySelector('[data-door-grid]');
  if (!(container instanceof HTMLElement)) {
    return;
  }

  container.textContent = '';

  const doors = await getMainDoors();
  if (!doors.length) {
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const door of doors) {
    fragment.appendChild(createDoorCard(door));
  }
  container.appendChild(fragment);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderDoors);
} else {
  renderDoors();
}
