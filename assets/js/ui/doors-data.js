const DOORS_ENDPOINT = '/data/doors_main.json';
let cachedDoors = null;
let loadingPromise = null;

function resolveEndpoint() {
  if (typeof window === 'undefined' || !window.location) {
    return DOORS_ENDPOINT;
  }
  try {
    const url = new URL(DOORS_ENDPOINT, window.location.origin);
    return url.toString();
  } catch (error) {
    return DOORS_ENDPOINT;
  }
}

async function fetchDoors() {
  if (cachedDoors) {
    return cachedDoors;
  }
  if (loadingPromise) {
    return loadingPromise;
  }

  const endpoint = resolveEndpoint();
  loadingPromise = fetch(endpoint, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load main doors: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => (Array.isArray(data) ? data : []))
    .catch((error) => {
      if (typeof console !== 'undefined' && console.error) {
        console.error('Unable to fetch main doors data', error);
      }
      return [];
    })
    .finally(() => {
      loadingPromise = null;
    });

  cachedDoors = await loadingPromise;
  return cachedDoors;
}

export async function getMainDoors() {
  const doors = await fetchDoors();
  return doors.filter((door) => door && typeof door === 'object' && door.id && door.href);
}

export function resolvePath(path) {
  if (!path) {
    return '';
  }
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('/')) {
    return path;
  }
  if (typeof document === 'undefined') {
    return path;
  }
  const basePath = document.body?.dataset?.basePath ?? '';
  return `${basePath}${path}`;
}

export function resolveDoorHref(href) {
  if (!href) {
    if (typeof document === 'undefined') {
      return '';
    }
    return document.body?.dataset?.basePath ?? '';
  }
  if (/^(?:[a-z]+:)?\/\//i.test(href) || href.startsWith('#')) {
    return href;
  }
  if (href.startsWith('/')) {
    return href;
  }
  return resolvePath(href);
}
