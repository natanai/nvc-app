import { getMainDoors, resolveDoorHref } from './doors-data.js';

function isActive(href) {
  if (typeof window === 'undefined' || !window.location) {
    return false;
  }
  try {
    const target = new URL(resolveDoorHref(href), window.location.origin);
    const pathname = target.pathname.endsWith('/') ? target.pathname : `${target.pathname}/`;
    const current = window.location.pathname.endsWith('/')
      ? window.location.pathname
      : `${window.location.pathname}/`;
    return current.startsWith(pathname);
  } catch (error) {
    return window.location.pathname.startsWith(href);
  }
}

function createMagnet(door) {
  const link = document.createElement('a');
  link.className = 'nav-magnets__link';
  link.href = resolveDoorHref(door.href);
  link.textContent = door.label ?? door.id;
  if (isActive(door.href)) {
    link.classList.add('active');
    link.setAttribute('aria-current', 'page');
  }
  return link;
}

async function renderMagnets() {
  const containers = document.querySelectorAll('[data-nav-magnets]');
  if (!containers.length) {
    return;
  }

  const doors = await getMainDoors();
  if (!doors.length) {
    return;
  }

  for (const container of containers) {
    if (!(container instanceof HTMLElement)) {
      continue;
    }
    container.textContent = '';
    for (const door of doors) {
      container.appendChild(createMagnet(door));
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderMagnets);
} else {
  renderMagnets();
}
