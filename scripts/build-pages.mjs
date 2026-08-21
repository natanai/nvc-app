import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { updateObservationGuidePage } from './observation-guide.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dataPath = join(rootDir, 'data', 'index.json');
const indexData = JSON.parse(readFileSync(dataPath, 'utf8'));
const { strategies } = indexData;
const data = indexData;
const bodyRegionsPath = join(rootDir, 'data', 'body-regions.json');
const bodyRegions = JSON.parse(readFileSync(bodyRegionsPath, 'utf8'));
const navCriticalCssPath = join(rootDir, 'styles', 'nav-critical.css');
const navCriticalCss = readFileSync(navCriticalCssPath, 'utf8').trim();

const KNOWN_SCOPES = new Set([
  'home',
  'faux-feelings',
  'feelings',
  'needs',
  'inventory',
  'observation-guide',
  'support-lane',
]);

const DEFAULT_SCOPES = [
  'home',
  'faux-feelings',
  'feelings',
  'needs',
  'inventory',
  'observation-guide',
  'support-lane',
];

const DIRECTORIES_BY_SCOPE = new Map([
  ['faux-feelings', ['faux-feelings']],
  ['feelings', ['feelings']],
  ['needs', ['needs']],
  ['inventory', ['inventory']],
]);

function parseScopeArgs(argv) {
  let scopeValue = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--scope') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        console.error('Missing value for --scope option.');
        process.exit(1);
      }
      scopeValue = next;
      index += 1;
    } else if (arg.startsWith('--scope=')) {
      scopeValue = arg.slice('--scope='.length);
    }
  }

  if (scopeValue == null) {
    return null;
  }

  const scopes = scopeValue
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (scopes.length === 0) {
    console.error('The --scope option requires at least one scope name.');
    process.exit(1);
  }

  const invalidScopes = scopes.filter((scope) => !KNOWN_SCOPES.has(scope));

  if (invalidScopes.length > 0) {
    console.error(`Unknown scope(s): ${invalidScopes.join(', ')}`);
    console.error(`Valid scopes: ${Array.from(KNOWN_SCOPES).join(', ')}`);
    process.exit(1);
  }

  return new Set(scopes);
}

const requestedScopes = parseScopeArgs(process.argv.slice(2));
const activeScopes = requestedScopes ? Array.from(requestedScopes) : DEFAULT_SCOPES;
const directoriesToResetSet = new Set();

for (const scope of activeScopes) {
  const directories = DIRECTORIES_BY_SCOPE.get(scope);
  if (!directories) {
    continue;
  }
  for (const directory of directories) {
    directoriesToResetSet.add(directory);
  }
}

const directoriesToReset = Array.from(directoriesToResetSet);

const HOME_ICON_INLINE = (basePath = '') => {
  const normalizedBase = basePath || '';
  return `
  <svg class="site-nav__magnet-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <use href="${normalizedBase}icons/nav-sprite.svg#icon-home" />
  </svg>`;
};

const NAV_MAGNET_STORAGE_KEY = 'site-nav';

const navPrefillScript = () => String.raw`
      <script>
        (function() {
          if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
          }
          var root = document.querySelector('[data-magnet-root][data-magnet-key="${NAV_MAGNET_STORAGE_KEY}"]');
          if (!root) {
            return;
          }
          var board = root.querySelector('[data-magnet-board]');
          if (!board) {
            return;
          }
          var STORAGE_KEY = 'magnetPositions:${NAV_MAGNET_STORAGE_KEY}';
          var raw;
          try {
            if (!('localStorage' in window)) {
              return;
            }
            raw = window.localStorage.getItem(STORAGE_KEY);
          } catch (error) {
            return;
          }
          if (typeof raw !== 'string' || !raw) {
            return;
          }
          var parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (error) {
            return;
          }
          if (!parsed || typeof parsed !== 'object' || typeof parsed.magnets !== 'object') {
            return;
          }
          var boardRect = board.getBoundingClientRect();
          var boardWidth = Math.max(boardRect.width || board.clientWidth || 1, 1);
          var boardStyles = typeof window.getComputedStyle === 'function'
            ? window.getComputedStyle(board)
            : null;
          var cssMinHeight = 0;
          if (boardStyles && boardStyles.minHeight) {
            var parsedMin = Number.parseFloat(boardStyles.minHeight);
            cssMinHeight = Number.isFinite(parsedMin) && parsedMin > 0 ? parsedMin : 0;
          }
          var boardHeight = Math.max(
            boardRect.height || board.clientHeight || cssMinHeight || 1,
            cssMinHeight || 1
          );
          if (typeof parsed.boardHeight === 'number' && parsed.boardHeight > 0) {
            var storedHeight = Math.max(parsed.boardHeight, cssMinHeight || 0, boardHeight);
            boardHeight = storedHeight;
            board.style.height = storedHeight + 'px';
          }
          var magnets = board.querySelectorAll('[data-magnet-id]');
          if (!magnets.length) {
            return;
          }

          var restoreTransitions = null;
          if (
            board.classList &&
            !board.classList.contains('no-transitions') &&
            typeof board.classList.add === 'function'
          ) {
            board.classList.add('no-transitions');
            restoreTransitions = function() {
              if (!board.classList || typeof board.classList.remove !== 'function') {
                return;
              }
              board.classList.remove('no-transitions');
            };
          }
          var hasMissingVisiblePlacement = false;
          for (var i = 0; i < magnets.length; i += 1) {
            var el = magnets[i];
            if (!el || !el.dataset) {
              continue;
            }
            var id = el.dataset.magnetId;
            if (!id) {
              continue;
            }
            if (!(id in parsed.magnets)) {
              var navHidden =
                el.hidden ||
                (el.dataset && el.dataset.navHidden === 'true') ||
                el.getAttribute('aria-hidden') === 'true';
              if (!navHidden) {
                hasMissingVisiblePlacement = true;
              }
              continue;
            }
            var entry = parsed.magnets[id];
            if (!entry || typeof entry !== 'object') {
              continue;
            }
            var rect = el.getBoundingClientRect();
            var magnetWidth = rect.width || el.offsetWidth || 0;
            var magnetHeight = rect.height || el.offsetHeight || 0;
            var maxX = Math.max(boardWidth - magnetWidth, 0);
            var maxY = Math.max(boardHeight - magnetHeight, 0);
            var xPct = typeof entry.xPct === 'number' ? entry.xPct : 0;
            var yPct = typeof entry.yPct === 'number' ? entry.yPct : 0;
            var x = Math.min(Math.max(xPct * boardWidth, 0), maxX);
            var y = Math.min(Math.max(yPct * boardHeight, 0), maxY);
            el.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
          }

          if (hasMissingVisiblePlacement) {
            if (restoreTransitions) {
              restoreTransitions();
            }
            return;
          }

          if (board && (board.dataset || typeof board.setAttribute === 'function')) {
            if (board.dataset) {
              board.dataset.ready = '1';
            } else {
              board.setAttribute('data-ready', '1');
            }
          }

          if (restoreTransitions) {
            var raf = typeof window.requestAnimationFrame === 'function'
              ? window.requestAnimationFrame
              : null;
            if (raf) {
              raf(function() {
                raf(restoreTransitions);
              });
            } else {
              window.setTimeout(restoreTransitions, 32);
            }
          }
        })();
      </script>`;

const navVisibilityBootstrapScript = () => String.raw`
      <script>
        (function() {
          if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
          }

          var nav = document.querySelector('[data-magnet-root][data-magnet-key="${NAV_MAGNET_STORAGE_KEY}"]');
          if (!nav || typeof nav.querySelectorAll !== 'function') {
            return;
          }

          var storageKey = 'nvcApp.navSettings';
          var storages = [];

          try {
            if (Object.prototype.hasOwnProperty.call(window, 'localStorage') && window.localStorage) {
              storages.push(window.localStorage);
            }
          } catch (error) {
            return;
          }

          try {
            if (Object.prototype.hasOwnProperty.call(window, 'sessionStorage') && window.sessionStorage) {
              storages.push(window.sessionStorage);
            }
          } catch (error) {
            return;
          }

          var raw = '';
          for (var i = 0; i < storages.length; i += 1) {
            var storage = storages[i];
            if (!storage || typeof storage.getItem !== 'function') {
              continue;
            }
            try {
              var candidate = storage.getItem(storageKey);
              if (typeof candidate === 'string' && candidate.trim()) {
                raw = candidate.trim();
                break;
              }
            } catch (error) {
              return;
            }
          }

          if (!raw) {
            return;
          }

          var parsed;
          try {
            parsed = JSON.parse(raw);
          } catch (error) {
            return;
          }

          if (!parsed || typeof parsed !== 'object') {
            return;
          }

          // v2 repairs the short-lived first More prototype, which forced the
          // Inventory magnet off. Restore Inventory before first paint while
          // keeping Journal secondary by default.
          var navMoreV2Key = 'allneeds.navMore.v2';
          var needsNavMoreV2 = true;
          try {
            needsNavMoreV2 = !window.localStorage || window.localStorage.getItem(navMoreV2Key) !== '1';
          } catch (error) {
            needsNavMoreV2 = true;
          }
          if (needsNavMoreV2) {
            parsed.enabled = parsed.enabled && typeof parsed.enabled === 'object'
              ? parsed.enabled
              : {};
            parsed.enabled.inventory = true;
            parsed.enabled.journal = false;
            parsed.updatedAt = Date.now();
            try {
              if (window.localStorage) {
                window.localStorage.setItem(storageKey, JSON.stringify(parsed));
                window.localStorage.setItem(navMoreV2Key, '1');
              }
            } catch (error) {
              // Continue with the in-memory repaired settings.
            }
          }

          var defaults = {
            home: true,
            customizer: true,
            journal: false,
            inventory: true,
            observations: true,
            fauxFeelings: false,
            feelings: true,
            needs: true,
            bodyCues: false,
            journalDashboard: false,
          };

          var alwaysEnabled = {
            home: true,
            customizer: true,
          };

          var enabledNavIds = {};
          for (var key in defaults) {
            if (Object.prototype.hasOwnProperty.call(defaults, key)) {
              enabledNavIds[key] = defaults[key];
            }
          }

          if (parsed.enabled && typeof parsed.enabled === 'object') {
            for (var id in parsed.enabled) {
              if (!Object.prototype.hasOwnProperty.call(parsed.enabled, id)) {
                continue;
              }
              if (Object.prototype.hasOwnProperty.call(alwaysEnabled, id)) {
                enabledNavIds[id] = true;
                continue;
              }
              enabledNavIds[id] = parsed.enabled[id] !== false;
            }
          }

          for (var required in alwaysEnabled) {
            if (Object.prototype.hasOwnProperty.call(alwaysEnabled, required)) {
              enabledNavIds[required] = true;
            }
          }

          var magnetMap = {
            home: 'nav-home',
            customizer: 'nav-customizer',
            journal: 'nav-journal',
            inventory: 'nav-inventory',
            observations: 'nav-observations',
            fauxFeelings: 'nav-faux-feelings',
            feelings: 'nav-feelings',
            needs: 'nav-needs',
            bodyCues: 'nav-body-cues',
            journalDashboard: 'nav-journal-dashboard',
          };

          var magnetEnabled = {};
          for (var navId in magnetMap) {
            if (!Object.prototype.hasOwnProperty.call(magnetMap, navId)) {
              continue;
            }
            var magnetId = magnetMap[navId];
            var isEnabled = Object.prototype.hasOwnProperty.call(enabledNavIds, navId)
              ? !!enabledNavIds[navId]
              : true;
            magnetEnabled[magnetId] = isEnabled;
          }

          var magnets = nav.querySelectorAll('[data-magnet-id]');
          if (!magnets || !magnets.length) {
            return;
          }

          var supplementalEnabled = false;

          for (var j = 0; j < magnets.length; j += 1) {
            var el = magnets[j];
            if (!el || typeof el.getAttribute !== 'function') {
              continue;
            }

            var magnetId = el.getAttribute('data-magnet-id');
            if (!magnetId) {
              continue;
            }

            var shouldEnable = Object.prototype.hasOwnProperty.call(magnetEnabled, magnetId)
              ? magnetEnabled[magnetId]
              : !(typeof el.hasAttribute === 'function' && el.hasAttribute('data-nav-hidden'));

            if (shouldEnable) {
              if (el.dataset && Object.prototype.hasOwnProperty.call(el.dataset, 'navStoredTabIndex')) {
                var stored = el.dataset.navStoredTabIndex;
                if (stored) {
                  el.setAttribute('tabindex', stored);
                } else if (typeof el.removeAttribute === 'function') {
                  el.removeAttribute('tabindex');
                }
                delete el.dataset.navStoredTabIndex;
              } else if (typeof el.removeAttribute === 'function') {
                el.removeAttribute('tabindex');
              }

              if (typeof el.removeAttribute === 'function') {
                el.removeAttribute('data-nav-hidden');
                el.removeAttribute('aria-hidden');
              }

              var isSupplemental = false;
              if (el.dataset && el.dataset.navSupplemental === 'true') {
                isSupplemental = true;
              } else if (typeof el.getAttribute === 'function' && el.getAttribute('data-nav-supplemental') === 'true') {
                isSupplemental = true;
              }

              if (isSupplemental) {
                supplementalEnabled = true;
              }
            } else {
              if (
                el.dataset &&
                !Object.prototype.hasOwnProperty.call(el.dataset, 'navStoredTabIndex') &&
                typeof el.getAttribute === 'function'
              ) {
                var existing = el.getAttribute('tabindex');
                if (existing != null) {
                  el.dataset.navStoredTabIndex = existing;
                } else {
                  el.dataset.navStoredTabIndex = '';
                }
              }

              if (typeof el.setAttribute === 'function') {
                el.setAttribute('tabindex', '-1');
                el.setAttribute('data-nav-hidden', 'true');
                el.setAttribute('aria-hidden', 'true');
              }
            }
          }

          if (typeof nav.setAttribute === 'function' && typeof nav.removeAttribute === 'function') {
            if (supplementalEnabled) {
              nav.setAttribute('data-nav-expanded', 'true');
            } else {
              nav.removeAttribute('data-nav-expanded');
            }
          }
        })();
      </script>`;

const BRAND_NAME = 'allneeds.app';
const DEFAULT_DESCRIPTION =
  'Build an inventory of strategies to tend to all your basic human needs. Everything stays on your device in localStorage with import and export controls.';

const SITE_ORIGIN = 'https://allneeds.app';
const FACEBOOK_APP_ID = '966242223397117';
const SOCIAL_ASSET_VERSION = 'v=2';
const FAVICON_SVG = 'icons/favicon-color.svg';
const FAVICON_PNG_32 = 'icons/favicon-color-32x32.png';
const FAVICON_PNG_16 = 'icons/favicon-color-16x16.png';
const TOUCH_ICON_SRC = 'icons/apple-touch-icon.png';
const MASK_ICON_SRC = 'icons/safari-pinned-tab.svg';
const TILE_IMAGE_SRC = 'icons/mstile-150x150.png';
const BROWSER_CONFIG_SRC = 'browserconfig.xml';
const SOCIAL_CARD_PATH = 'social/og-image-1200x630.png';
const TWITTER_CARD_PATH = 'social/twitter-card-1200x630.png';
const SOCIAL_CARD_SRC = `${SOCIAL_CARD_PATH}?${SOCIAL_ASSET_VERSION}`;
const TWITTER_CARD_SRC = `${TWITTER_CARD_PATH}?${SOCIAL_ASSET_VERSION}`;
const SOCIAL_CARD_WIDTH = 1200;
const SOCIAL_CARD_HEIGHT = 630;
const TILE_COLOR = '#ffffff';
const MASK_ICON_COLOR = '#000000';
const THEME_COLOR = '#ffffff';

function absoluteUrl(path = '') {
  if (!path) {
    return SITE_ORIGIN;
  }

  if (/^(?:[a-z]+:)?\/\//i.test(path)) {
    return path;
  }

  const origin = SITE_ORIGIN.replace(/\/+$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalized}`;
}

function normalizeCanonicalPath(path = '') {
  if (!path) {
    return '/';
  }
  const trimmed = path.trim();
  if (!trimmed) {
    return '/';
  }
  if (trimmed === '/') {
    return '/';
  }
  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return prefixed.endsWith('/') ? prefixed : `${prefixed}/`;
}

function guessMimeType(path = '') {
  if (!path) {
    return 'image/svg+xml';
  }
  const normalized = path
    .toLowerCase()
    .split('#', 1)[0]
    .split('?', 1)[0];
  if (normalized.endsWith('.svg')) {
    return 'image/svg+xml';
  }
  if (normalized.endsWith('.png')) {
    return 'image/png';
  }
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (normalized.endsWith('.webp')) {
    return 'image/webp';
  }
  if (normalized.endsWith('.avif')) {
    return 'image/avif';
  }
  return 'image/png';
}

function resolveHeadHref(basePath = '', target = '') {
  if (!target) {
    return '';
  }
  const trimmed = String(target).trim();
  if (!trimmed) {
    return '';
  }
  if (/^(?:data:|https?:|\/\/)/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  return `${basePath}${trimmed}`;
}

const themePreloadScript = (basePath) => {
  const contrastSrc = `${basePath}assets/js/ui/contrast.js`;
  return String.raw`    <script src="${contrastSrc}"></script>
    <script>
      (function() {
        const STORAGE_KEY = 'nvcApp.theme';
        const VAR_MAP = {
          plum: '--plum',
          lavender: '--lavender',
          ink: '--ink',
          inkSoft: '--ink-soft',
          rose: '--rose',
          mint: '--mint',
          gold: '--gold',
          sky: '--sky',
          outline: '--outline',
        };
        const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
        const root = document.documentElement;
        if (!root) {
          return;
        }

        function readStorageValue(key) {
          if (!key) {
            return '';
          }

          const candidates = [];
          const errors = [];

          try {
            if (window.localStorage) {
              const raw = localStorage.getItem(key);
              const value = typeof raw === 'string' ? raw.trim() : '';
              if (value) {
                candidates.push({ value, index: candidates.length });
              }
            }
          } catch (error) {
            errors.push(error);
          }

          try {
            if (window.sessionStorage) {
              const raw = sessionStorage.getItem(key);
              const value = typeof raw === 'string' ? raw.trim() : '';
              if (value) {
                candidates.push({ value, index: candidates.length });
              }
            }
          } catch (error) {
            errors.push(error);
          }

          if (!candidates.length) {
            if (errors.length && typeof console !== 'undefined' && console.warn) {
              console.warn('Unable to access theme storage', errors[errors.length - 1]);
            }
            return '';
          }

          if (candidates.length === 1) {
            return candidates[0].value;
          }

          let best = candidates[0];
          let bestTimestamp = readUpdatedAt(best.value);
          let bestIndex = typeof best.index === 'number' ? best.index : 0;

          for (let i = 1; i < candidates.length; i += 1) {
            const candidate = candidates[i];
            const timestamp = readUpdatedAt(candidate.value);
            const index = typeof candidate.index === 'number' ? candidate.index : i;
            if (timestamp > bestTimestamp || (timestamp === bestTimestamp && index < bestIndex)) {
              best = candidate;
              bestTimestamp = timestamp;
              bestIndex = index;
            }
          }

          return best.value;
        }

        function readUpdatedAt(value) {
          if (typeof value !== 'string') {
            return 0;
          }
          const trimmed = value.trim();
          if (!trimmed || trimmed[0] !== '{') {
            return 0;
          }
          try {
            const parsed = JSON.parse(trimmed);
            const candidate = parsed && typeof parsed === 'object' ? parsed.updatedAt : null;
            return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0;
          } catch (error) {
            return 0;
          }
        }

        function normalizeHex(value) {
          if (typeof value !== 'string') {
            return '';
          }
          const trimmed = value.trim();
          if (!trimmed) {
            return '';
          }
          const prefixed = trimmed.startsWith('#') ? trimmed : '#' + trimmed;
          return HEX_PATTERN.test(prefixed) ? prefixed.toUpperCase() : '';
        }

        function readStoredThemePayload() {
          const raw = readStorageValue(STORAGE_KEY);
          if (!raw) {
            return null;
          }
          try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
          } catch (error) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('Unable to parse saved theme', error);
            }
            return null;
          }
        }

        function readPaletteVar(varName) {
          const direct = normalizeHex(root.style.getPropertyValue(varName));
          if (direct) {
            return direct;
          }
          try {
            const computed = getComputedStyle(root).getPropertyValue(varName);
            return normalizeHex(computed);
          } catch (error) {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('Unable to read palette color', varName, error);
            }
          }
          return '';
        }

        let applied = false;

        try {
          const parsed = readStoredThemePayload();
          if (parsed && typeof parsed === 'object' && parsed.values && typeof parsed.values === 'object') {
            for (const [key, varName] of Object.entries(VAR_MAP)) {
              const value = normalizeHex(parsed.values[key]);
              if (!value) {
                continue;
              }
              root.style.setProperty(varName, value);
              applied = true;
            }

            const roundnessRaw =
              typeof parsed.roundness === 'number' ? parsed.roundness : Number(parsed.roundness);
            if (!Number.isNaN(roundnessRaw)) {
              const clampedRoundness = Math.min(200, Math.max(0, Math.round(roundnessRaw)));
              root.style.setProperty('--corner-scale', String(clampedRoundness / 100));
              applied = true;
            }
          }
        } catch (error) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Unable to preapply theme', error);
          }
        }

        try {
          const outlineValue = readPaletteVar('--outline') || '#12081F';
          const roseValue = readPaletteVar('--rose') || '#FFB3CB';
          root.style.setProperty('--btn-bg', roseValue);
          root.style.setProperty('--btn-fg', '#111111');
          root.style.setProperty('--chip-fg', '#111111');
          root.style.removeProperty('--chip-bg');
          root.removeAttribute('data-theme-contrast');
          root.style.setProperty('--shadow', 'color-mix(in srgb, ' + outlineValue + ' 55%, transparent)');

          if (window.NVCContrast && typeof window.NVCContrast.autoContrast === 'function') {
            try {
              const ratio = window.NVCContrast.autoContrast('--btn-bg', '--btn-fg');
              if (typeof ratio === 'number') {
                applied = true;
              }
            } catch (error) {
              if (typeof console !== 'undefined' && console.warn) {
                console.warn('Unable to auto-adjust button contrast', error);
              }
            }
          }

          if (applied) {
            root.setAttribute('data-theme-preapplied', 'true');
          }
        } catch (error) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Unable to apply prepaint adjustments', error);
          }
        }
      })();
    </script>`;
};
for (const dir of directoriesToReset) {
  rmSync(join(rootDir, dir), { recursive: true, force: true });
}

function basePathFromDepth(depth) {
  return depth === 0 ? '' : '../'.repeat(depth);
}

const localStorageReminderHtml =
  '<p class="local-storage-note">Reminder: This static site saves data in your browser; clearing local storage removes it, so export backups.</p>';

const customizerShellPlaceholderHtml = `    <div class="palette-corner" data-shell-customizer-placeholder>
      <button type="button" class="palette-corner__toggle" aria-haspopup="dialog" aria-expanded="false">
        <span class="palette-corner__glyph">+</span>
        <span class="visually-hidden">Open customizer</span>
      </button>
    </div>`;

function normalizeScripts(scripts, options = {}) {
  const includeInventoryRuntime = options.includeInventoryRuntime !== false;
  const baseScripts = [
    { src: 'scripts/inventory-core-shell.js', defer: true },
    ...(includeInventoryRuntime ? [{ src: 'scripts/inventory.js', defer: true }] : []),
    { src: 'scripts/magnets.js', module: true },
  ];
  const beforeBaseScripts = scripts.filter((entry) => entry && typeof entry === 'object' && entry.beforeBase === true);
  const regularScripts = scripts.filter((entry) => !(entry && typeof entry === 'object' && entry.beforeBase === true));
  const entries = [...beforeBaseScripts, ...baseScripts, ...regularScripts];
  const seen = new Set();
  const normalized = [];
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    const resolved =
      typeof entry === 'string'
        ? { src: entry, type: undefined, defer: true, async: false, nomodule: false }
        : {
            src: entry.src,
            type: entry.module ? 'module' : entry.type,
            defer: entry.defer ?? (!entry.module && entry.type !== 'module'),
            async: entry.async ?? false,
            nomodule: entry.nomodule ?? false,
            crossOrigin: entry.crossOrigin ?? entry.crossorigin,
            integrity: entry.integrity,
            referrerPolicy: entry.referrerPolicy ?? entry.referrerpolicy,
          };
    if (!resolved.src) {
      continue;
    }
    const key = `${resolved.src}|${resolved.type ?? ''}|${resolved.defer ? 'd' : ''}|${
      resolved.async ? 'a' : ''
    }|${resolved.nomodule ? 'n' : ''}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(resolved);
  }
  return normalized;
}

function htmlPage({
  title,
  depth,
  breadcrumbs = [],
  main,
  description = '',
  scripts = [],
  mainAttributes = '',
  activeNav,
  mainClass = 'page',
  navOptions = undefined,
  canonicalPath = '/',
  socialImage = SOCIAL_CARD_SRC,
  twitterImage = TWITTER_CARD_SRC,
  socialAlt = 'Three colorful doorways symbolizing allneeds.app',
  headExtras = '',
  bodyExtras = '',
  includeInventoryRuntime = true,
}) {
  const basePath = basePathFromDepth(depth);
  const cssHref = `${basePath}styles.css`;
  const headDescription = description || DEFAULT_DESCRIPTION;
  const escapedDescription = escapeHtml(headDescription);
  const escapedTitle = escapeHtml(title);
  const escapedBrand = escapeHtml(BRAND_NAME);
  const fullTitle = `${escapedTitle} • ${escapedBrand}`;
  const tabTitle = fullTitle.toLowerCase();
  const faviconSvgHref = resolveHeadHref(basePath, FAVICON_SVG);
  const faviconPng32Href = resolveHeadHref(basePath, FAVICON_PNG_32);
  const faviconPng16Href = resolveHeadHref(basePath, FAVICON_PNG_16);
  const manifestHref = resolveHeadHref(basePath, 'site.webmanifest');
  const canonicalPathNormalized = normalizeCanonicalPath(canonicalPath);
  const canonicalUrl = absoluteUrl(canonicalPathNormalized);
  const appleTouchIconHref = resolveHeadHref(basePath, TOUCH_ICON_SRC);
  const maskIconHref = resolveHeadHref(basePath, MASK_ICON_SRC);
  const tileImageHref = resolveHeadHref(basePath, TILE_IMAGE_SRC);
  const browserConfigHref = resolveHeadHref(basePath, BROWSER_CONFIG_SRC);
  const socialImagePath = socialImage || SOCIAL_CARD_SRC;
  const socialImageUrl = absoluteUrl(socialImagePath);
  const socialImageType = guessMimeType(socialImagePath);
  const twitterImagePath = twitterImage || TWITTER_CARD_SRC;
  const twitterImageUrl = absoluteUrl(twitterImagePath);
  const socialAltEscaped = escapeHtml(socialAlt || 'Three colorful doorways symbolizing allneeds.app');

  const breadcrumbHtml = breadcrumbs.length
    ? `<nav class="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          ${breadcrumbs
            .map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const labelContent = crumb.html || escapeHtml(crumb.label ?? '');
              if (isLast || !crumb.href) {
                return `<li aria-current="page">${labelContent}</li>`;
              }
              return `<li><a href="${crumb.href}">${labelContent}</a></li>`;
            })
            .join('')}
        </ol>
      </nav>`
    : '';

  const scriptEntries = normalizeScripts(scripts, { includeInventoryRuntime });
  const scriptsHtml = scriptEntries
    .map((script) => {
      const attrs = [`src="${basePath}${script.src}"`];
      if (script.type) {
        attrs.push(`type="${script.type}"`);
      }
      if (script.defer) {
        attrs.push('defer');
      }
      if (script.async) {
        attrs.push('async');
      }
      if (script.nomodule) {
        attrs.push('nomodule');
      }
      if (script.crossOrigin) {
        attrs.push(`crossorigin="${script.crossOrigin}"`);
      }
      if (script.integrity) {
        attrs.push(`integrity="${script.integrity}"`);
      }
      if (script.referrerPolicy) {
        attrs.push(`referrerpolicy="${script.referrerPolicy}"`);
      }
      return `    <script ${attrs.join(' ')}></script>`;
    })
    .join('\n');
  const navHtml = renderNav(basePath, activeNav, navOptions);
  const normalizedMainAttrs = mainAttributes ? ` ${mainAttributes.trim()}` : '';
  const mainClassAttr = mainClass ? ` class="${mainClass}"` : '';
  const criticalStyles = navCriticalCss ? `    <style>${navCriticalCss}</style>` : '';
  const extraHead = headExtras ? `\n${headExtras}` : '';
  const extraBody = bodyExtras ? `${bodyExtras}\n` : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${tabTitle}</title>
    <meta name="description" content="${escapedDescription}" />
    <link rel="icon" type="image/svg+xml" href="${faviconSvgHref}" />
    <link rel="icon" type="image/png" sizes="32x32" href="${faviconPng32Href}" />
    <link rel="icon" type="image/png" sizes="16x16" href="${faviconPng16Href}" />
    <link rel="manifest" href="${manifestHref}" />
    <meta name="theme-color" content="${THEME_COLOR}" />
    <meta name="application-name" content="${escapedBrand}" />
    <link rel="apple-touch-icon" href="${appleTouchIconHref}" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="${escapedBrand}" />
    <link rel="mask-icon" href="${maskIconHref}" color="${MASK_ICON_COLOR}" />
    <meta name="msapplication-TileColor" content="${TILE_COLOR}" />
    <meta name="msapplication-TileImage" content="${tileImageHref}" />
    <meta name="msapplication-config" content="${browserConfigHref}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="fb:app_id" content="${FACEBOOK_APP_ID}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapedBrand}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${tabTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:image" content="${socialImageUrl}" />
    <meta property="og:image:secure_url" content="${socialImageUrl}" />
    <meta property="og:image:type" content="${socialImageType}" />
    <meta property="og:image:width" content="${SOCIAL_CARD_WIDTH}" />
    <meta property="og:image:height" content="${SOCIAL_CARD_HEIGHT}" />
    <meta property="og:image:alt" content="${socialAltEscaped}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${tabTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />
    <meta name="twitter:url" content="${canonicalUrl}" />
    <meta name="twitter:image" content="${twitterImageUrl}" />
    <meta name="twitter:image:alt" content="${socialAltEscaped}" />
        ${themePreloadScript(basePath)}
${criticalStyles ? `${criticalStyles}\n` : ''}    <link rel="preload" href="${cssHref}" as="style" />
    <link rel="stylesheet" href="${cssHref}" fetchpriority="high" />${extraHead}
  </head>
  <body data-base-path="${basePath}">
    <a href="#main" class="skip-link">Skip to content</a>
    <div class="page-wrapper">
      ${navHtml}
      ${breadcrumbHtml}
      <main id="main"${mainClassAttr} role="main"${normalizedMainAttrs}>
        ${main}
      </main>
    </div>
${extraBody}${scriptsHtml ? `${scriptsHtml}\n` : ''}  </body>
</html>
`;
}

function renderNav(basePath, activeNav, options = {}) {
  const config = options || {};
  const activeAttr = (key) => (activeNav === key ? ' aria-current="page"' : '');
  const homeHref = basePath || './';

  const resolveHref = (href) => {
    if (!href) {
      return basePath;
    }
    if (/^(?:[a-z]+:)?\/\//i.test(href) || href.startsWith('#')) {
      return href;
    }
    if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
      return href;
    }
    return `${basePath}${href}`;
  };

  const defaultSecondaryLinks = [
    { key: 'observations', href: 'observations/', label: 'Observations' },
    {
      key: 'faux-feelings',
      href: 'faux-feelings/',
      label: 'Faux feelings',
      magnetId: 'nav-faux-feelings',
      className: 'site-nav__magnet--faux-feelings',
      attributes: {
        'data-nav-hidden': 'true',
        'aria-hidden': 'true',
        tabindex: '-1',
      },
    },
    { key: 'feelings', href: 'feelings/', label: 'Feelings' },
    { key: 'needs', href: 'needs/', label: 'Needs' },
    {
      key: 'body-cues',
      href: 'feelings/body-cues/',
      label: 'Body cues',
      magnetId: 'nav-body-cues',
      className: 'site-nav__magnet--body-cues',
      attributes: {
        'data-nav-hidden': 'true',
        'data-nav-supplemental': 'true',
        'aria-hidden': 'true',
        tabindex: '-1',
      },
    },
    {
      key: 'journal-dashboard',
      href: 'inventory/journal/',
      label: 'Journal History',
      magnetId: 'nav-journal-dashboard',
      className: 'site-nav__magnet--journal-dashboard',
      attributes: {
        'data-nav-hidden': 'true',
        'data-nav-supplemental': 'true',
        'aria-hidden': 'true',
        tabindex: '-1',
      },
    },
  ];

  const secondaryLinks = (config.secondaryLinks ?? defaultSecondaryLinks)
    .map((link, index) => {
      const href = resolveHref(link.href);
      const labelContent = link.html ? link.html : escapeHtml(link.label ?? '');
      const ariaAttr = link.key ? activeAttr(link.key).trim() : '';
      const magnetId = escapeHtml(link.magnetId ?? (link.key ? `nav-${link.key}` : `nav-secondary-${index + 1}`));
      const classNames = ['pill magnet site-nav__magnet'];
      if (link.className) {
        classNames.push(link.className);
      }
      const attrs = [
        `class="${classNames.join(' ')}"`,
        `data-magnet-id="${magnetId}"`,
        `href="${href}"`,
        ariaAttr,
      ].filter(Boolean);
      if (link.attributes && typeof link.attributes === 'object') {
        for (const [attrName, attrValue] of Object.entries(link.attributes)) {
          if (attrValue === null || typeof attrValue === 'undefined' || attrValue === false) {
            continue;
          }
          if (attrValue === true) {
            attrs.push(attrName);
          } else {
            attrs.push(`${attrName}="${escapeHtml(String(attrValue))}"`);
          }
        }
      }
      return `            <a ${attrs.join(' ')}><span class="site-nav__magnet-label">${labelContent}</span></a>`;
    })
    .join('\n');

  const navVisibilityBootstrap = navVisibilityBootstrapScript();
  const prefill = navPrefillScript();

  return `<nav class="site-nav magnet-section" aria-label="Primary" data-magnet-root data-magnet-key="${NAV_MAGNET_STORAGE_KEY}">
        <div class="magnet-board-wrapper site-nav__board-wrapper">
          <div class="pill-grid magnet-board site-nav__board" data-magnet-board>
            <button
              class="pill magnet site-nav__magnet site-nav__magnet--menu"
              type="button"
              data-magnet-id="nav-menu"
              aria-label="Open More menu"
              aria-haspopup="dialog"
              aria-expanded="false"
              aria-controls="nav-more-menu"
            >
              <svg class="site-nav__menu-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 7h16M4 12h16M4 17h16"></path>
              </svg>
              <span class="site-nav__magnet-label visually-hidden">More</span>
            </button>
            <a class="pill magnet site-nav__magnet site-nav__magnet--home" data-magnet-id="nav-home" href="${homeHref}"${activeAttr('home')}>
${HOME_ICON_INLINE(basePath)}
              <span class="site-nav__magnet-label visually-hidden">Home</span>
            </a>
            <button
              class="pill magnet site-nav__magnet site-nav__magnet--customizer"
              data-magnet-id="nav-customizer"
              type="button"
              data-palette-toggle
              aria-haspopup="dialog"
              aria-expanded="false"
            >
              <span class="site-nav__magnet-glyph" aria-hidden="true">+</span>
              <span class="site-nav__magnet-label visually-hidden">Customizer</span>
            </button>
            <button
              class="pill magnet site-nav__magnet site-nav__magnet--journal"
              data-magnet-id="nav-journal"
              data-nav-hidden="true"
              aria-hidden="true"
              tabindex="-1"
              type="button"
              data-support-journal-open
              aria-haspopup="dialog"
              aria-expanded="false"
              aria-controls="global-support-journal-layer"
            >
              <span class="site-nav__magnet-label">Journal</span>
            </button>
            <a class="pill magnet site-nav__magnet site-nav__magnet--inventory" data-magnet-id="nav-inventory" href="${basePath}inventory/"${activeAttr('inventory')}>
              <span class="site-nav__magnet-label">Inventory</span>
              <span class="site-nav__count" data-inventory-count hidden></span>
            </a>
${secondaryLinks ? `${secondaryLinks}\n` : ''}          </div>
          <label class="magnet-play-toggle" data-magnet-toggle data-state="off">
            <input type="checkbox" class="magnet-play-toggle__input" role="switch" aria-label="Enable magnet physics">
            <span class="magnet-play-toggle__track" aria-hidden="true">
              <span class="magnet-play-toggle__thumb"></span>
            </span>
            <span class="visually-hidden magnet-play-toggle__sr-state">Physics is off</span>
          </label>
        </div>
        <div class="site-nav__journal" data-support-journal data-journal-overlay>
          <div
            id="global-support-journal-layer"
            class="support-journal__layer"
            data-support-journal-layer
            data-state="closed"
            aria-hidden="true"
          >
            <div class="support-journal__dialog" data-support-journal-dialog tabindex="-1">
              <header class="support-journal__header">
                <div class="support-journal__titles">
                  <h3
                    class="support-journal__heading"
                    id="global-support-journal-heading"
                    data-support-journal-heading
                  >
                    Journal
                  </h3>
                </div>
                <button
                  class="support-journal__close"
                  type="button"
                  data-support-journal-close
                  aria-label="Close full screen journal"
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              </header>
              <div class="support-journal__body">
                <div class="support-journal__content">
                  <div data-journal-overlay-content></div>
                  <div class="journal-history-wrapper" data-journal-overlay-history></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
${navVisibilityBootstrap}
${prefill}`;
}

function indentBlock(value, indent) {
  const stringValue = String(value ?? '');
  if (!indent) {
    return stringValue;
  }

  const lines = stringValue.split('\n').map((line) => {
    if (!line) {
      return '';
    }

    if (/^\s/.test(line)) {
      return line;
    }

    return `${indent}${line}`;
  });

  return lines.join('\n');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMultilineText(value) {
  if (!value) {
    return '';
  }

  return escapeHtml(value).replace(/\r?\n/g, '<br />');
}

function sanitizeContributorName(value) {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'placeholder' ? trimmed : '';
}

function sanitizeLocation(value) {
  if (!value) {
    return '';
  }
  return value.trim();
}

function writePage(relativePath, html) {
  const outputPath = join(rootDir, relativePath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html.trimStart());
}

function renderStrategyForm({
  formId,
  idPrefix,
  submitLabel,
  titleLabel = 'Strategy name',
  descriptionLabel = 'Strategy details',
  descriptionRequired = true,
  includeNeedSelect = true,
  includePlaceholderOption = false,
  needSelectMultiple = false,
  defaultNeedSlug = '',
  includeContactFields = false,
  includeMessage = false,
  includeVisibilitySelect = false,
  notice = '',
  includeLocalStorageReminder = false,
}) {
  const needOptions = data.needs
    .map(
      (need) =>
        `<option value="${escapeHtml(need.slug)}"${
          need.slug === defaultNeedSlug ? ' selected' : ''
        }>${escapeHtml(need.title)}</option>`
    )
    .join('');

  const placeholderOption = includePlaceholderOption
    ? `<option value="" disabled${!needSelectMultiple && !defaultNeedSlug ? ' selected' : ''}>Select a need</option>`
    : '';

  const multipleAttr = needSelectMultiple ? ' multiple' : '';
  const needHintId = `${idPrefix}-need-hint`;
  const needDescribedByAttr = ` aria-describedby="${needHintId}"`;

  const needField = includeNeedSelect
    ? `
        <div class="strategy-form__field">
          <label for="${idPrefix}-need">Primary need</label>
          <p id="${needHintId}" class="strategy-form__hint">Tip: On desktop, hold Ctrl (Windows/Linux) or Command (Mac) to pick more than one need.</p>
          <div class="strategy-card strategy-card--input">
            <select id="${idPrefix}-need" name="need"${multipleAttr}${needDescribedByAttr} required>
              ${placeholderOption}
              ${needOptions}
            </select>
          </div>
        </div>`
    : '';

  const contactFields = includeContactFields
    ? `
        <div class="strategy-form__row">
          <div class="strategy-form__field">
            <label for="${idPrefix}-name">First name (optional)</label>
            <div class="strategy-card strategy-card--input">
              <input id="${idPrefix}-name" name="name" type="text" />
            </div>
          </div>
          <div class="strategy-form__field">
            <label for="${idPrefix}-location">Location (optional)</label>
            <div class="strategy-card strategy-card--input">
              <input id="${idPrefix}-location" name="location" type="text" />
            </div>
          </div>
        </div>`
    : '';

  const message = includeMessage
    ? `
      <p class="strategy-form__message" data-form-message hidden aria-live="polite"></p>`
    : '';

  const noticeMarkup = notice ? `
      ${notice}` : '';

  const descriptionRequiredAttr = descriptionRequired ? ' required' : '';

  const visibilityField = includeVisibilitySelect
    ? `
        <div class="strategy-form__field">
          <label for="${idPrefix}-visibility">Visibility</label>
          <p class="strategy-form__hint">Choose who can see this strategy when you export or share it.</p>
          <div class="strategy-card strategy-card--input">
            <select id="${idPrefix}-visibility" name="strategy-visibility">
              <option value="private">Private (only on this browser)</option>
              <option value="followers">Followers (Bluesky followers when synced)</option>
              <option value="public">Public</option>
            </select>
          </div>
        </div>`
    : '';

  const localStorageNote = includeLocalStorageReminder
    ? `
            ${localStorageReminderHtml}`
    : '';

  return `
      <div class="strategy-form__container" data-strategy-form-container>
        <div class="strategy-card strategy-card--form">
          <form id="${formId}" class="strategy-form" data-strategy-form>
            <div class="strategy-form__field">
              <label for="${idPrefix}-title">${escapeHtml(titleLabel)}</label>
              <div class="strategy-card strategy-card--input">
                <input id="${idPrefix}-title" name="title" type="text" required />
              </div>
            </div>
            <div class="strategy-form__field">
              <label for="${idPrefix}-description">${escapeHtml(descriptionLabel)}</label>
              <div class="strategy-card strategy-card--input">
                <textarea id="${idPrefix}-description" name="description" rows="4"${descriptionRequiredAttr}></textarea>
              </div>
            </div>
            ${needField}
            ${contactFields}
            ${visibilityField}
            <div class="strategy-card__actions strategy-card__actions--stacked strategy-form__actions">
              <button type="submit" class="strategy-form__submit strategy-card__save">${escapeHtml(submitLabel)}</button>
            </div>
            ${localStorageNote}
          </form>
        </div>
        ${noticeMarkup}
        ${message}
      </div>`;
}

function buildPersonalStrategyNotice(basePath, suffix = '') {
  const safeSuffix = suffix ? ` ${suffix}` : '';
  return `<p class="strategy-form__notice">Personal strategies you add stay on this browser. Visit the <a href="${basePath}inventory/">inventory screen</a> to export them if you would like a backup.${safeSuffix}</p>`;
}

function buildPersonalStrategyFormOptions({
  formId,
  idPrefix,
  notice,
  defaultNeedSlug = '',
}) {
  return {
    formId,
    idPrefix,
    submitLabel: '💾 Save to device',
    titleLabel: 'Strategy name',
    descriptionLabel: 'How do you put it into practice?',
    includePlaceholderOption: true,
    needSelectMultiple: true,
    defaultNeedSlug,
    includeContactFields: true,
    includeVisibilitySelect: true,
    includeMessage: true,
    notice,
    includeLocalStorageReminder: false,
  };
}

function renderHome() {
  const basePath = basePathFromDepth(0);
  const iconMap = {
    observations: `${basePath}icons/door-observations.svg`,
    feelings: `${basePath}icons/door-feelings.svg`,
    needs: `${basePath}icons/door-needs.svg`,
  };
  const cards = ['observations', 'feelings', 'needs']
    .map((type) => {
      const label = type
        .replace(/-/g, ' ')
        .replace(/\b([a-z])/g, (match, char) => char.toUpperCase());
      const icon = iconMap[type]
        ? `                <img class="door-card__icon" src="${iconMap[type]}" alt="" aria-hidden="true" loading="lazy" />\n`
        : '';
      const doorMarkup = `              <span class="door-card__door" aria-hidden="true">\n${icon}              </span>\n              <span class="door-card__label">${label}</span>`;

      if (type === 'feelings') {
        const supportHref = `${basePath}alexithymia-support/`;
        return `          <div class="door-card door-card--${type}">
            <a class="door-card__link" href="${type}/">
${doorMarkup}
            </a>
            <a class="door-card__support" href="${supportHref}">Alexithymia support</a>
          </div>`;
      }

      return `          <div class="door-card door-card--${type}">
            <a class="door-card__link" href="${type}/">
${doorMarkup}
            </a>
          </div>`;
    })
    .join('\n');

  const main = `
      <section class="home-doorways" aria-labelledby="doorwaysTitle">
        <h1 id="doorwaysTitle" class="visually-hidden">Choose a doorway</h1>
        <p class="home-doorways__prompt">Collect strategies for all your needs. Start with any door.</p>
        <div class="door-grid">
${cards}
        </div>
        <p class="home-doorways__support-note">
          <a href="${basePath}alexithymia-support/">Alexithymia Support</a>
        </p>
      </section>
    `;

  const html = htmlPage({
    title: 'Home',
    depth: 0,
    main,
    scripts: [{ src: 'scripts/shell-runtime-loader.js', defer: true, beforeBase: true }],
    activeNav: 'home',
    canonicalPath: '/',
    bodyExtras: customizerShellPlaceholderHtml,
    includeInventoryRuntime: false,
  });

  writePage('index.html', html);
}

function renderCategory(type, items) {
  const title = type
    .replace(/-/g, ' ')
    .replace(/\b([a-z])/g, (match, char) => char.toUpperCase());
  const escapedTitle = escapeHtml(title);
  const lowerTitle = escapeHtml(title.toLowerCase());
  const description = type === 'faux-feelings'
    ? 'Faux feelings (sometimes called evaluations) are often the first stories that surface. Follow them to the feelings and needs underneath.'
    : '';

  const supportLinks =
    type === 'feelings'
      ? `<div class="support-actions support-actions--muted feelings-page-header__actions">
          <a class="support-button" href="../alexithymia-support/">Support</a>
          <a class="support-button support-button--ghost" href="../inventory/journal/">Journal</a>
        </div>`
      : '';

  const magnets = items
  .map((item) => {
    const label = escapeHtml(item.title);
    return `<a class="pill magnet" data-magnet-id="${type}-${item.slug}" href="${item.slug}/"><span class="magnet__label">${label}</span></a>`;
  })
  .join('');


  const searchAltLinkInline =
    type === 'feelings'
      ? `<a class="magnet-search__alt magnet-search__alt--inline" href="body-cues/" aria-label="Open body cues page"><span aria-hidden="true">↗</span><span>Body cues</span></a>`
      : '';

  const searchInputMarkup = `<label class="magnet-search__field">
                <span class="magnet-search__label visually-hidden">Search ${lowerTitle}</span>
                <input
                  type="search"
                  name="${type}-search"
                  class="magnet-search__input"
                  placeholder="Search ${lowerTitle}"
                  autocomplete="off"
                  data-magnet-search-input
                >
              </label>`;

  const searchControlsMarkup = `<div class="magnet-search__search-row">
              ${searchInputMarkup}
              <button type="button" class="shuffle-button magnet-search__shuffle" data-magnet-shuffle aria-label="Shuffle magnets">
                <svg class="shuffle-button__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                  <path d="M16 3h5v5"></path>
                  <path d="M4 20L21 3"></path>
                  <path d="M21 16v5h-5"></path>
                  <path d="M15 15l6 6"></path>
                  <path d="M4 4l5 5"></path>
                </svg>
              </button>
            </div>`;

  const suppressDirectoryHeading = type === 'needs' || type === 'faux-feelings';
  const headerTitleMarkup =
    type === 'feelings'
      ? `<a class="emotion-wheel-link" href="emotions-wheel/" aria-label="Open interactive emotions wheel" title="Open interactive emotions wheel">
            <svg class="emotion-wheel-link__icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
              <circle cx="50" cy="50" r="46" fill="#ffffff"></circle>
              <path d="M50 50 L50 4 A46 46 0 0 1 89.84 27 Z" fill="#b5df8c"></path>
              <path d="M50 50 L89.84 27 A46 46 0 0 1 89.84 73 Z" fill="#f4a4be"></path>
              <path d="M50 50 L89.84 73 A46 46 0 0 1 50 96 Z" fill="#f6c48f"></path>
              <path d="M50 50 L50 96 A46 46 0 0 1 10.16 73 Z" fill="#b7c1f0"></path>
              <path d="M50 50 L10.16 73 A46 46 0 0 1 10.16 27 Z" fill="#92dad3"></path>
              <path d="M50 50 L10.16 27 A46 46 0 0 1 50 4 Z" fill="#ffd8a6"></path>
              <circle cx="50" cy="50" r="16" fill="#ffffff"></circle>
              <circle cx="50" cy="50" r="46" fill="none" stroke="var(--outline)" stroke-width="4"></circle>
              <circle cx="50" cy="50" r="16" fill="none" stroke="var(--outline)" stroke-width="3"></circle>
            </svg>
            <span class="visually-hidden">Open interactive emotions wheel</span>
          </a>
          <h2 id="${type}-list" class="section-title">Emotion wheel</h2>`
      : suppressDirectoryHeading
        ? ''
        : `<h2 id="${type}-list" class="section-title">${escapedTitle} directory</h2>`;
  const listSectionA11yAttr = suppressDirectoryHeading ? `aria-label="${escapedTitle} magnets"` : `aria-labelledby="${type}-list"`;

  const magnetHubStyles = `    <style>
      /* Magnet hub UX v4 — inset fixed toggle obstacle */
      [data-magnet-key$='-hub-v4'] .magnet-board {
        overflow: hidden;
      }

      [data-magnet-key$='-hub-v4'] .magnet-play-toggle--hub {
        top: 0.45rem;
        right: 0.45rem;
        z-index: 6;
        width: 44px;
        height: 44px;
        min-width: 44px;
        min-height: 44px;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        transform: none;
      }

      [data-magnet-key$='-hub-v4'] .magnet-play-toggle--hub:hover,
      [data-magnet-key$='-hub-v4'] .magnet-play-toggle--hub:focus-within {
        transform: none;
        background: transparent;
        box-shadow: none;
      }

      [data-magnet-key$='-hub-v4'] .magnet-play-toggle--hub:focus-within {
        outline: 2px dashed color-mix(in srgb, var(--outline) 48%, transparent);
        outline-offset: -3px;
      }

      @media (max-width: 640px) {
        body {
          padding-left: 0.65rem;
          padding-right: 0.65rem;
        }

        .page-wrapper {
          gap: 1rem;
        }

        .page {
          padding: 1.05rem 0.85rem 1.2rem;
          gap: 0.85rem;
        }

        .breadcrumbs {
          padding: 0.42rem 0.7rem;
        }

        [data-magnet-key$='-hub-v4'] {
          gap: 0.6rem;
        }

        [data-magnet-key$='-hub-v4'] .magnet-search {
          margin-top: 0;
          gap: 0.45rem;
        }

        [data-magnet-key$='-hub-v4'] .magnet-search__search-row {
          gap: 0.35rem;
        }

        [data-magnet-key$='-hub-v4'] .magnet-search__input {
          padding: 0.55rem 0.7rem;
        }

        [data-magnet-key$='-hub-v4'] .shuffle-button {
          width: 44px;
          min-width: 44px;
        }

        [data-magnet-key$='-hub-v4'] .magnet-board-wrapper {
          padding-top: 0.2rem;
        }

        [data-magnet-key$='-hub-v4'] .magnet-play-toggle--hub {
          top: 0.35rem;
          right: 0.35rem;
        }

        [data-magnet-key$='-hub-v4'] .magnet-board {
          padding: 0.55rem 0.35rem 0.45rem;
        }

        [data-magnet-key$='-hub-v4'] .pill.magnet {
          min-height: 44px;
          padding: 0.36rem 0.58rem;
          font-size: 0.9rem;
        }
      }
    </style>`;


  const main = `
      <header class="page-header">
        ${type === 'feelings'
          ? `<div class="feelings-page-header__topline">
        <h1 class="page-title">${escapedTitle}</h1>
        ${supportLinks}
      </div>`
          : `<h1 class="page-title">${escapedTitle}</h1>
        ${description ? `<p class="page-description">${escapeHtml(description)}</p>` : ''}${
          supportLinks ? `\n        ${supportLinks}` : ''
        }`
        }
      </header>
      <section ${listSectionA11yAttr} class="pill-section magnet-section" data-magnet-root data-magnet-key="${type}-hub-v4">
        <div class="magnet-section__header">
          ${headerTitleMarkup}
          ${searchAltLinkInline}
        </div>
        <div class="magnet-search" data-magnet-search>
          <div class="magnet-search__toolbar">
            <div class="magnet-search__controls">
              ${searchControlsMarkup}
            </div>
          </div>
          <div class="magnet-search__results" data-magnet-search-results aria-live="polite" hidden>
            <p class="magnet-search__count" data-magnet-search-count hidden>No matches yet.</p>
            <div class="magnet-search__list" data-magnet-search-list></div>
          </div>
        </div>
        <div class="magnet-board-wrapper">
          <div class="pill-grid magnet-board" data-magnet-board>
            ${magnets}
            <label class="magnet-play-toggle magnet-play-toggle--hub" data-magnet-toggle data-magnet-obstacle data-state="off" title="Toggle magnet motion">
              <input type="checkbox" class="magnet-play-toggle__input" role="switch" aria-label="Toggle magnet motion">
              <span class="magnet-play-toggle__track" aria-hidden="true">
                <span class="magnet-play-toggle__thumb"></span>
              </span>
              <span class="visually-hidden magnet-play-toggle__sr-state">Physics is off</span>
            </label>
          </div>
        </div>
      </section>
    `;

  const html = htmlPage({
    title,
    depth: 1,
    breadcrumbs: [
      { label: 'Home', href: '../' },
      { label: title }
    ],
    main,
    headExtras: magnetHubStyles,
    scripts: [{ src: 'scripts/magnets.js', type: 'module' }],
    activeNav: type,
    canonicalPath: `${type}/`,
  });

  writePage(`${type}/index.html`, html);
}

function renderBodyCueControls() {
  return bodyRegions
    .map((region) => {
      const options = Array.isArray(region.options) ? region.options : [];
      const optionMarkup = options
        .map((option) => {
          const title = escapeHtml(option.title || '');
          const optionId = escapeHtml(option.id || '');
          const note = option.note
            ? `
              <p class="body-cues-tool__option-note">${escapeHtml(option.note)}</p>`
            : '';
          return `
            <div class="body-cues-tool__option" data-option-id="${optionId}">
              <div class="body-cues-tool__option-header">
                <h4 class="body-cues-tool__option-title">${title}</h4>
                <span class="body-cues-tool__option-value">Off</span>
              </div>${note}
              <div class="body-cues-tool__slider-wrapper">
                <input
                  class="body-cues-tool__slider"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value="0"
                  style="--cue-progress: 0%;"
                  aria-label="${title} intensity"
                  aria-valuetext="Off"
                >
                <div class="body-cues-tool__slider-scale" aria-hidden="true">
                  <span>Off</span><span>Hint</span><span>Noticeable</span><span>Strong</span>
                </div>
              </div>
            </div>`;
        })
        .join('');

      return `
        <section class="body-cues-tool__region" data-region-id="${escapeHtml(region.id || '')}">
          <header class="body-cues-tool__region-header">
            <h3 class="body-cues-tool__region-title">${escapeHtml(region.label || '')}</h3>
            ${region.prompt ? `<p class="body-cues-tool__region-prompt">${escapeHtml(region.prompt)}</p>` : ''}
          </header>
          <div class="body-cues-tool__options">${optionMarkup}
          </div>
        </section>`;
    })
    .join('');
}

function renderBodyCuesPage() {
  const bodyCuesStyles = `    <link rel="preload" href="../../styles/body-cues.css" as="style" />
    <link rel="stylesheet" href="../../styles/body-cues.css" />
    <link rel="stylesheet" href="../../styles/body-cues-mobile.css" media="(max-width: 640px)" />`;

  const main = `
      <section class="body-cues-tool" data-body-cues-root>
        <h1 class="visually-hidden">Body Cues explorer</h1>

        <section class="body-cues-tool__summary-panel" data-pinned="true" aria-labelledby="body-cues-magnets-heading">
          <section class="body-cues-tool__magnets">
            <div class="magnet-search__results body-cues-tool__magnet-panel">
              <div class="body-cues-tool__magnet-header">
                <h2 id="body-cues-magnets-heading">Possible feelings</h2>
                <p class="body-cues-tool__magnet-subtitle" aria-live="polite" data-body-cues-live>Adjust a cue below to see possible feelings.</p>
              </div>
              <div class="body-cues-tool__magnet-container" data-body-cues-magnets data-empty="true" data-expanded="false" aria-live="polite">
                <p class="body-cues-tool__empty" data-body-cues-empty>
                  Start with one cue below. As you adjust its intensity, the strongest feeling matches will appear here.
                </p>
              </div>
              <button type="button" class="body-cues-tool__result-toggle" data-body-cues-result-toggle aria-expanded="false" hidden>Show more matches</button>
            </div>
            <p class="body-cues-tool__error" data-body-cues-error hidden>
              We couldn't load the body cues data. Check your connection and try again.
            </p>
          </section>

          <div class="body-cues-tool__actions">
            <button type="button" class="body-cues-tool__pin-toggle" data-body-cues-pin-toggle aria-pressed="true" aria-label="Unpin possible feelings" title="Unpin possible feelings">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"></path>
                <path d="M12 14v7"></path>
                <path class="body-cues-tool__pin-slash" d="M4 4l16 16"></path>
              </svg>
            </button>
            <button type="button" class="body-cues-tool__reset" data-body-cues-reset aria-label="Reset all cues">Reset</button>
          </div>
        </section>

        <section class="body-cues-tool__slider-panel" aria-labelledby="body-cues-sliders-heading">
          <div class="body-cues-tool__slider-header">
            <h2 id="body-cues-sliders-heading">Body cues</h2>
            <p class="body-cues-tool__instructions">Move a slider only when a cue fits. Leave everything else off.</p>
            <p class="body-cues-tool__active-count" data-body-cues-active-count>0 cues selected</p>
          </div>

          <div class="body-cues-tool__controls-shell" data-body-cues-controls-shell data-scrollable="false" data-scroll-position="none">
            <section class="body-cues-tool__controls" data-body-cues-controls aria-label="Body cue sliders">${renderBodyCueControls()}
            </section>
            <span class="body-cues-tool__scroll-fade body-cues-tool__scroll-fade--top" aria-hidden="true"></span>
            <span class="body-cues-tool__scroll-fade body-cues-tool__scroll-fade--bottom" aria-hidden="true"></span>
            <span class="body-cues-tool__scroll-more" aria-hidden="true">More cues below ↓</span>
          </div>
        </section>
      </section>
    `;

  const html = htmlPage({
    title: 'Body Cues explorer',
    depth: 2,
    description:
      'Describe the body sensations you notice to surface likely feelings and save insights to your strategy inventory. Everything stays on your device in localStorage with import and export controls.',
    breadcrumbs: [
      { label: 'Home', href: '../../' },
      { label: 'Feelings', href: '../' },
      { label: 'Body Cues' },
    ],
    main,
    headExtras: bodyCuesStyles,
    scripts: [{ src: 'scripts/body-cues-tool.js', type: 'module' }],
    activeNav: 'feelings',
    mainClass: 'page body-cues-page',
    canonicalPath: 'feelings/body-cues/',
  });

  writePage('feelings/body-cues/index.html', html);
}

function renderFauxFeeling(item) {
  const main = `
      <header class="page-header">
        <h1 class="page-title">Faux feeling: ${escapeHtml(item.title)}</h1>
      </header>
      ${renderPillGroup('Feelings', item.feelings, 'feelings')}
      ${renderPillGroup('Needs', item.needs, 'needs')}
    `;

  const html = htmlPage({
    title: `Faux feeling: ${item.title}`,
    depth: 2,
    breadcrumbs: [
      { label: 'Home', href: '../../' },
      { label: 'Faux feelings', href: '../' },
      { label: item.title }
    ],
    main,
    scripts: [{ src: 'scripts/magnets.js', type: 'module' }],
    activeNav: 'faux-feelings',
    canonicalPath: `faux-feelings/${item.slug}/`,
  });

  writePage(`faux-feelings/${item.slug}/index.html`, html);
}

function renderFeeling(item) {
  const inferencePanelId = `reverse-inference-panel-${slugify(item.slug)}`;
  const inferenceSection = `
      <section class="feeling-inference-wrapper" data-reverse-inference-container hidden>
        <button type="button" class="feeling-inference-toggle" data-reverse-inference-toggle aria-expanded="false" aria-controls="${inferencePanelId}" disabled>
          <span class="feeling-inference-toggle__copy">
            <span class="feeling-inference-toggle__badge">Alexithymia support</span>
            <span class="feeling-inference-toggle__label">How this feeling may show up</span>
          </span>
        </button>
        <div id="${inferencePanelId}" class="feeling-inference-panel" data-reverse-inference-panel hidden>
          <section class="feeling-inference" data-reverse-inference hidden></section>
        </div>
      </section>`;
  const needsSection = renderPillGroup('Related needs', item.needs, 'needs');
  const descriptionHtml = item.description
    ? `\n        <p class="page-description page-description--feeling">${escapeHtml(item.description)}</p>`
    : '';
  const poemQuote = typeof item.poemQuote === 'string' ? item.poemQuote.trim() : '';
  const poemUrl = typeof item.poemUrl === 'string' ? item.poemUrl.trim() : '';
  const poemHeadingId = `poem-heading-${slugify(item.slug)}`;
  const poemEntries = [];
  if (poemQuote) {
    poemEntries.push(`<blockquote class="feeling-poem__quote">${formatMultilineText(poemQuote)}</blockquote>`);
  }
  if (poemUrl) {
    poemEntries.push(
      `<figcaption class="feeling-poem__cta"><a class="feeling-poem__link" href="${escapeHtml(poemUrl)}" target="_blank" rel="noopener noreferrer">Continue reading the poem</a></figcaption>`,
    );
  }
  const poemSection = poemEntries.length
    ? `\n      <section class="feeling-poem" aria-labelledby="${poemHeadingId}">\n        <h2 id="${poemHeadingId}" class="section-title">Poem reflection</h2>\n        <figure class="feeling-poem__figure">\n          ${poemEntries.join('\n          ')}\n        </figure>\n      </section>`
    : '';

  const main = `
      ${needsSection}
      <header class="page-header">
        <h1 class="page-title">Feeling: ${escapeHtml(item.title)}</h1>
        ${descriptionHtml}
      </header>${poemSection}
      ${inferenceSection}
    `;

  const html = htmlPage({
    title: `Feeling: ${item.title}`,
    depth: 2,
    breadcrumbs: [
      { label: 'Home', href: '../../' },
      { label: 'Feelings', href: '../' },
      { label: item.title }
    ],
    main,
    scripts: [
      { src: 'scripts/magnets.js', type: 'module' },
      { src: 'scripts/feeling-reverse-inference.js', type: 'module' },
    ],
    mainAttributes: ` data-feeling-slug="${escapeHtml(item.slug)}"`,
    activeNav: 'feelings',
    canonicalPath: `feelings/${item.slug}/`,
    description: item.description,
  });

  writePage(`feelings/${item.slug}/index.html`, html);
}

function renderNeed(item, allStrategies) {
  const strategiesForNeed = Array.isArray(allStrategies)
    ? allStrategies.filter((strategy) =>
        Array.isArray(strategy.supportsNeeds)
        && strategy.supportsNeeds.some((needTitle) => needTitle === item.title),
      )
    : [];

  const hasPrefix = item.title.toLowerCase().startsWith('need for ');
  const displayTitle = hasPrefix ? item.title.replace(/^Need for\s*/i, '') : item.title;
  const fullTitle = `Need for ${displayTitle}`;

  const strategiesNote = `          ${localStorageReminderHtml}`;

  const strategiesHtml = strategiesForNeed.length
    ? `<section class="strategy-section" aria-labelledby="strategy-heading">
          <h2 id="strategy-heading" class="section-title">Strategies</h2>
${strategiesNote}
          <div class="strategy-deck-header">
            <button
              type="button"
              class="strategy-deck__shuffle"
              data-strategy-shuffle
            >
              Shuffle cards
            </button>
          </div>

          <div class="strategy-deck" data-strategy-deck>
            <div class="strategy-deck__stack" data-strategy-stack>
              ${strategiesForNeed
                .map((strategy) => {
                  const tags = Array.isArray(strategy.needs)
                    ? strategy.needs
                        .map((need) => need.slug)
                        .filter(Boolean)
                        .join('|')
                    : '';
                  const contributor = strategy.contributor || {};
                  const firstName = sanitizeContributorName(contributor.name);
                  const location = sanitizeLocation(contributor.location);
                  const contributorParts = [];
                  if (firstName) {
                    contributorParts.push(firstName);
                  }
                  if (location) {
                    contributorParts.push(location);
                  }
                  const contributorText = contributorParts.map((part) => escapeHtml(part)).join(' • ');
                  const contributorHtml = contributorText
                    ? `<p class="strategy-card__meta">${contributorText}</p>`
                    : '';
                  const dataAttrs = [
                    `data-strategy-slug="${escapeHtml(strategy.slug)}"`,
                    `data-strategy-tags="${escapeHtml(tags)}"`,
                  ];
                  if (firstName) {
                    dataAttrs.push(`data-first-name="${escapeHtml(firstName)}"`);
                  }
                  if (location) {
                    dataAttrs.push(`data-location="${escapeHtml(location)}"`);
                  }
                  const dataAttrString = dataAttrs.length ? ` ${dataAttrs.join(' ')}` : '';
                  const description = strategy.summary || strategy.description || '';

                  return `
                    <article class="strategy-card"${dataAttrString}>
                      <h3 class="strategy-card__title">${escapeHtml(strategy.title)}</h3>
                      <div class="strategy-card__body">
                        <p class="strategy-card__description">${escapeHtml(description)}</p>
                        ${contributorHtml}
                      </div>
                      <div class="strategy-card__actions strategy-card__actions--stacked">
                        <button type="button" class="strategy-card__save">Save to device</button>
                      </div>
                    </article>
                  `;
                })
                .join('')}
            </div>

            <div class="strategy-deck__controls">
              <button
                type="button"
                class="strategy-deck__nav strategy-deck__nav--prev"
                data-strategy-prev
                aria-label="Previous strategy"
              >
                ←
              </button>
              <span class="strategy-deck__counter" data-strategy-count></span>
              <button
                type="button"
                class="strategy-deck__nav strategy-deck__nav--next"
                data-strategy-next
                aria-label="Next strategy"
              >
                →
              </button>
            </div>
          </div>

          <p class="inventory-feedback" data-inventory-feedback hidden></p>
        </section>`
    : `<section class="strategy-section" aria-labelledby="strategy-heading">
          <h2 id="strategy-heading" class="section-title">Strategies</h2>
${strategiesNote}
          <p class="empty-state">Strategies for this need are coming soon.</p>
        </section>`;

  const descriptionHtml = item.description
    ? `<p class="page-description">${escapeHtml(item.description)}</p>`
    : '';

  const evidenceHtml = renderNeedEvidence(item);

  const quickAddHtml = `
      <div class="strategy-quick-actions">
        <a class="strategy-quick-actions__link" href="#suggestion-form">
          <span class="strategy-quick-actions__icon" aria-hidden="true">+</span>
          <span>Add personal strategy</span>
        </a>
      </div>`;

  const basePath = basePathFromDepth(2);
  const suggestionNotice = '';
  const suggestionForm = renderStrategyForm(
    buildPersonalStrategyFormOptions({
      formId: 'suggestion-form',
      idPrefix: 'suggestion',
      defaultNeedSlug: item.slug,
      notice: suggestionNotice,
    })
  );

  const main = `
      <header class="page-header">
        <h1 class="page-title">${escapeHtml(fullTitle)}</h1>
        ${descriptionHtml}
      </header>
      ${evidenceHtml}
      ${quickAddHtml}
      ${strategiesHtml}
      <section class="suggestion" aria-labelledby="suggestion-heading">
        <h2 id="suggestion-heading" class="section-title">Add a strategy</h2>
        ${suggestionForm}
      </section>
    `;

  const html = htmlPage({
    title: fullTitle,
    depth: 2,
    breadcrumbs: [
      { label: 'Home', href: '../../' },
      { label: 'Needs', href: '../' },
      { label: item.title }
    ],
    main,
        scripts: [
      { src: 'scripts/inventory-bluesky.js?v=2026-02-12', module: true },
    ],
    mainAttributes: `data-need-slug="${escapeHtml(item.slug)}" data-need-name="${escapeHtml(displayTitle)}" data-need-title="${escapeHtml(fullTitle)}"`,
    activeNav: 'needs',
    canonicalPath: `needs/${item.slug}/`,
  });

  writePage(`needs/${item.slug}/index.html`, html);
}

function renderNeedEvidence(item) {
  const claim = (item.originalClaim || '').trim();
  const rewrittenClaim = (item.rewrittenClaim || '').trim();
  const sources = Array.isArray(item.supportingSources)
    ? item.supportingSources.filter((source) => {
        if (!source) return false;
        if (typeof source === 'string') {
          return source.trim().length > 0;
        }
        return Boolean((source.url && source.url.trim()) || (source.description && source.description.trim()));
      })
    : [];

  if (!claim && !sources.length && !rewrittenClaim) {
    return '';
  }

  const claimHtml = claim
    ? `<p class="need-evidence__claim"><span class="need-evidence__claim-text">${escapeHtml(claim)}</span></p>`
    : '';

  const rewrittenHtml = rewrittenClaim
    ? `<details class="need-evidence__details"><summary class="need-evidence__details-toggle">Details<span class="visually-hidden"> about the rewritten claim</span></summary><div class="need-evidence__rewrite"><p class="need-evidence__rewrite-copy"><span class="need-evidence__rewrite-text">${escapeHtml(rewrittenClaim)}</span></p></div></details>`
    : '';

  let sourcesHtml = '';
  if (sources.length) {
    const inlineCitations = sources.map((source, index) => {
      const number = index + 1;
      if (typeof source === 'string') {
        return `<span class="need-evidence__citation-ref">[${number}]</span>`;
      }

      const url = (source.url || '').trim();
      const description = (source.description || '').trim();
      const title = description || url;

      if (url) {
        const safeUrl = escapeHtml(url);
        const safeTitle = title ? ` title="${escapeHtml(title)}"` : '';
        return `<span class="need-evidence__citation-ref">[<a class="need-evidence__link" href="${safeUrl}" target="_blank" rel="noreferrer noopener"${safeTitle}>${number}</a>]</span>`;
      }

      return `<span class="need-evidence__citation-ref">[${number}]</span>`;
    });

    const citationDetails = sources.map((source, index) => {
      const number = index + 1;
      const url = typeof source === 'object' && source
        ? (source.url || '').trim()
        : '';
      const description = typeof source === 'object' && source
        ? (source.description || '').trim()
        : (typeof source === 'string' ? source.trim() : '');
      const safeDescription = escapeHtml(description || url || `Source ${number}`);
      const safeUrl = url ? escapeHtml(url) : '';
      const urlHtml = url
        ? `<a class="need-evidence__citation-url" href="${safeUrl}" target="_blank" rel="noreferrer noopener">${safeUrl}</a>`
        : '<span class="need-evidence__citation-url need-evidence__citation-url--missing">No URL provided</span>';

      return `<li class="need-evidence__citation-item">`
        + `<span class="need-evidence__citation-number">${number}</span>`
        + `<div class="need-evidence__citation-body">`
        + `<span class="need-evidence__citation-description">${safeDescription}</span>`
        + `${urlHtml}`
        + `</div>`
        + `</li>`;
    });

    const inlineRow = inlineCitations.length
      ? `<div class="need-evidence__citation-row" aria-label="Supporting sources">${inlineCitations.join('')}</div>`
      : '';

    const detailsList = citationDetails.length
      ? `<details class="need-evidence__details need-evidence__citations"><summary class="need-evidence__details-toggle need-evidence__citations-toggle">Citations</summary><ol class="need-evidence__citation-list">${citationDetails.join('')}</ol></details>`
      : '';

    sourcesHtml = `<div class="need-evidence__sources"><h3 class="need-evidence__subheading">Supporting sources</h3>${inlineRow}${detailsList}</div>`;
  } else if (claim || rewrittenClaim) {
    sourcesHtml = '<p class="need-evidence__note">Supporting sources coming soon.</p>';
  }

  return `
      <section class="need-evidence" aria-labelledby="need-evidence-heading">
        <h2 id="need-evidence-heading" class="section-title">Evidence</h2>
        ${claimHtml}
        ${rewrittenHtml}
        ${sourcesHtml}
      </section>
    `;
}

function renderInventoryPage() {
  const basePath = basePathFromDepth(1);
  const inventoryFormNotice = buildPersonalStrategyNotice(
    basePath,
    'Use the export tools above whenever you would like a backup.'
  );
  const personalStrategyForm = renderStrategyForm(
    buildPersonalStrategyFormOptions({
      formId: 'inventory-form',
      idPrefix: 'inventory',
      notice: inventoryFormNotice,
    })
  );

  const blueskyPanelStyles = `    <style>
           /* Optional Bluesky sync panel */

      .inventory-bluesky-panel {
        margin-top: 1.75rem;
        border: 3px solid var(--outline);
        border-radius: var(--radius-xl);
        background: color-mix(in srgb, var(--lavender) 65%, #ffffff 35%);
        box-shadow: 0 14px 0 color-mix(in srgb, var(--outline) 18%, transparent);
        overflow: hidden;
      }

      .inventory-bluesky-panel__summary {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.9rem;
        padding: 1rem 1.1rem;
        cursor: pointer;
        list-style: none;
      }

      .inventory-bluesky-panel__summary::-webkit-details-marker {
        display: none;
      }

      .inventory-bluesky-panel__titles {
        display: grid;
        gap: 0.15rem;
      }

      .inventory-bluesky-panel__title {
        margin: 0;
        font-family: var(--font-display);
        font-size: 1.05rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .inventory-bluesky-panel__subtitle {
        margin: 0;
        font-size: 0.9rem;
        color: var(--ink-soft);
        max-width: 32rem;
      }

      .inventory-bluesky-panel__chevron {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 2px solid var(--outline);
        background: rgba(255, 255, 255, 0.9);
        font-size: 0.9rem;
        transform: rotate(90deg);
        transition: transform 0.18s ease, background 0.18s ease;
      }

      .inventory-bluesky-panel[open] .inventory-bluesky-panel__chevron {
        transform: rotate(270deg);
        background: color-mix(in srgb, var(--sky) 45%, #ffffff 55%);
      }

      .inventory-bluesky-panel__content {
        padding: 1rem 1.1rem 1.1rem;
        border-top: 3px solid var(--outline);
        background: color-mix(in srgb, #ffffff 82%, var(--lavender) 18%);
        display: grid;
        gap: 1rem;
        max-width: 100%;
        border-bottom-left-radius: var(--radius-xl);
        border-bottom-right-radius: var(--radius-xl);
      }

      .inventory-bluesky-panel__content p,
      .inventory-bluesky-panel__content li {
        margin: 0.25rem 0;
        font-size: 0.9rem;
        line-height: 1.5;
        color: var(--ink-soft);
        max-width: 100%;
        word-break: break-word;
        overflow-wrap: anywhere;
      }

      .inventory-bluesky-panel__content ul {
        padding-left: 1.15rem;
      }

      /* Card-like sections inside the panel */

      .inventory-auth-panel,
      .inventory-backend-sync {
        border-radius: var(--radius-lg);
        border: 2px solid color-mix(in srgb, var(--outline) 55%, transparent);
        background: rgba(255, 255, 255, 0.85);
        padding: 0.9rem 0.9rem 0.95rem;
        display: grid;
        gap: 0.55rem;
      }

      .inventory-auth-panel h2,
      .inventory-backend-sync__heading {
        margin: 0;
        font-family: var(--font-display);
        font-size: 0.9rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .inventory-auth-note {
        font-size: 0.85rem;
        color: var(--ink-soft);
      }

      .inventory-auth-note ul {
        margin: 0.4rem 0 0;
        padding-left: 1.15rem;
      }

      .inventory-auth-warning {
        margin: 0.35rem 0 0;
        padding: 0.5rem 0.6rem;
        border-radius: var(--radius-md);
        border: 2px dashed color-mix(in srgb, var(--outline) 60%, transparent);
        background: color-mix(in srgb, #ffffff 82%, var(--sky) 18%);
        font-size: 0.8rem;
        color: color-mix(in srgb, var(--ink) 80%, #000 20%);
      }

      .inventory-auth-panel__field {
        flex: 1 1 12rem;
        min-width: 0;
      }

      .inventory-auth-panel__field label {
        display: block;
        font-size: 0.8rem;
        font-weight: 600;
        margin-bottom: 0.2rem;
      }

      .inventory-auth-panel__field input[type='text'] {
        width: 100%;
        padding: 0.45rem 0.75rem;
        border-radius: var(--radius-pill);
        border: 2px solid color-mix(in srgb, var(--outline) 50%, transparent);
        background: rgba(255, 255, 255, 0.95);
        font: inherit;
        color: inherit;
      }

      .inventory-auth-panel__field input[type='text']:focus-visible {
        outline: 3px solid color-mix(in srgb, var(--sky) 70%, transparent);
        outline-offset: 1px;
      }

      /* Backend save/load + feed sections */

      .inventory-backend-sync__buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.35rem;
      }

      .inventory-backend-sync__status {
        font-size: 0.8rem;
        color: var(--ink-soft);
        min-height: 1.1em;
        margin-top: 0.25rem;
      }

      /* Small non-phone screens. Inventory phone layout is owned by inventory-mobile.css. */

      @media (min-width: 641px) and (max-width: 720px) {
        .inventory-bluesky-panel__summary {
          align-items: center;
        }

        .inventory-bluesky-panel__title {
          font-size: 0.98rem;
        }

        .inventory-bluesky-panel__subtitle {
          font-size: 0.85rem;
        }

        .inventory-auth-panel,
        .inventory-backend-sync {
          padding: 0.85rem 0.8rem 0.9rem;
        }
      }


      /* Inventory UX first pass v2 — inline pre-paint base styles */
      .inventory-header {
        gap: clamp(0.85rem, 2vw, 1.25rem);
      }

      .inventory-header__layout,
      .inventory-header__content {
        gap: clamp(0.6rem, 1.5vw, 0.9rem);
      }

      .inventory-header__title-row {
        align-items: center;
      }

      .inventory-header .page-description {
        max-width: 56ch;
        font-size: 0.96rem;
        line-height: 1.45;
      }

      /* Journal stays immediately available without competing with the
         Inventory's primary task. */
      .inventory-journal-button {
        min-height: 44px;
        padding: 0.42rem 0.72rem;
        border-width: 2px;
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, var(--sky) 32%, #ffffff 68%);
        box-shadow: 0 5px 0 color-mix(in srgb, var(--outline) 20%, transparent);
        font-weight: 700;
      }

      .inventory-journal-button:hover,
      .inventory-journal-button:focus-visible {
        transform: translateY(-1px);
        box-shadow: 0 7px 0 color-mix(in srgb, var(--outline) 24%, transparent);
      }

      .inventory-journal-button__icon {
        width: 1.35rem;
        height: 1.35rem;
      }

      .inventory-journal-button__label {
        font-size: 0.82rem;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      /* One task hierarchy: add is primary; saved/community destinations are
         quieter utilities. */
      .inventory-header__quick-actions {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.9fr);
        gap: clamp(0.55rem, 1.5vw, 0.8rem);
        margin: 0.15rem 0 0;
        align-items: stretch;
        width: 100%;
      }

      .inventory-header__quick-actions .strategy-quick-actions__link,
      .inventory-header__quick-actions .inventory-shared-button {
        width: 100%;
        min-height: 52px;
        margin: 0;
        justify-content: flex-start;
        padding: 0.65rem 0.8rem;
        border-radius: var(--radius-lg);
        line-height: 1.25;
      }

      .inventory-header__quick-actions > .strategy-quick-actions__link:first-child {
        border-width: 3px;
        background: color-mix(in srgb, var(--rose) 86%, #ffffff 14%);
        box-shadow: 0 8px 0 color-mix(in srgb, var(--outline) 35%, transparent);
        font-weight: 700;
      }

      .inventory-header__quick-actions > .strategy-quick-actions__link:first-child:hover,
      .inventory-header__quick-actions > .strategy-quick-actions__link:first-child:focus-visible {
        transform: translateY(-2px);
        box-shadow: 0 11px 0 color-mix(in srgb, var(--outline) 40%, transparent);
      }

      .inventory-header__quick-actions .strategy-quick-actions__link--secondary {
        border-width: 2px;
        background: color-mix(in srgb, var(--sky) 46%, #ffffff 54%);
        box-shadow: 0 5px 0 color-mix(in srgb, var(--outline) 20%, transparent);
        font-size: 0.9rem;
      }

      .inventory-header__quick-actions .inventory-shared-button {
        border-width: 2px;
        background: color-mix(in srgb, var(--lavender) 55%, #ffffff 45%);
        box-shadow: 0 5px 0 color-mix(in srgb, var(--outline) 18%, transparent);
      }

      .inventory-header__quick-actions .strategy-quick-actions__link--secondary:hover,
      .inventory-header__quick-actions .strategy-quick-actions__link--secondary:focus-visible,
      .inventory-header__quick-actions .inventory-shared-button:hover,
      .inventory-header__quick-actions .inventory-shared-button:focus-visible {
        transform: translateY(-1px);
        box-shadow: 0 7px 0 color-mix(in srgb, var(--outline) 24%, transparent);
      }

      .inventory-header__quick-actions .strategy-quick-actions__icon,
      .inventory-header__quick-actions .inventory-shared-button__icon {
        flex: 0 0 auto;
      }

      .inventory-header__quick-actions .inventory-shared-button__text {
        gap: 0.05rem;
      }

      .inventory-header__quick-actions .inventory-shared-button__eyebrow {
        font-size: 0.62rem;
        letter-spacing: 0.08em;
      }

      .inventory-header__quick-actions .inventory-shared-button__label {
        font-size: 0.84rem;
        line-height: 1.2;
      }

      /* Sync is useful but optional. Give it the visual weight of settings
         rather than another primary destination. */
      .inventory-bluesky-panel {
        margin-top: 0.45rem;
        border-width: 2px;
        border-radius: var(--radius-lg);
        background: color-mix(in srgb, var(--lavender) 45%, #ffffff 55%);
        box-shadow: 0 6px 0 color-mix(in srgb, var(--outline) 16%, transparent);
      }

      .inventory-bluesky-panel__summary {
        gap: 0.7rem;
        padding: 0.72rem 0.85rem;
        align-items: center;
      }

      .inventory-bluesky-panel__titles {
        gap: 0.08rem;
      }

      .inventory-bluesky-panel__title {
        font-size: 0.86rem;
        letter-spacing: 0.05em;
      }

      .inventory-bluesky-panel__subtitle {
        font-size: 0.78rem;
        line-height: 1.35;
      }

      .inventory-bluesky-panel__chevron {
        flex: 0 0 auto;
      }

      @media (min-width: 641px) and (max-width: 760px) {
        .inventory-header__quick-actions {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }

        .inventory-header__quick-actions > .strategy-quick-actions__link:first-child {
          grid-column: 1 / -1;
        }
      }

      /* Inventory model prototype v1 — base presentation only. */
      .inventory-main {
        display: flex;
        flex-direction: column;
        gap: clamp(0.9rem, 2vw, 1.25rem);
      }

      .inventory-overview { order: 1; }
      .inventory-form { order: 2; }
      .inventory-actions { order: 3; }

      .inventory-header__quick-actions {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }

      .inventory-view-switch {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px;
        padding: 4px;
        border: 2px solid color-mix(in srgb, var(--outline) 45%, transparent);
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, var(--lavender) 62%, #ffffff 38%);
        box-shadow: 0 5px 0 color-mix(in srgb, var(--outline) 12%, transparent);
      }

      .inventory-view-switch__button {
        min-height: 46px;
        border: 0;
        border-radius: var(--radius-pill);
        background: transparent;
        color: var(--ink);
        font: 700 0.9rem/1 var(--font-body);
        letter-spacing: 0.02em;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        cursor: pointer;
      }

      .inventory-view-switch__button.is-active,
      .inventory-view-switch__button[aria-selected='true'] {
        background: #ffffff;
        box-shadow: 0 2px 8px color-mix(in srgb, var(--outline) 13%, transparent);
      }

      .inventory-view-switch__count {
        min-width: 1.45rem;
        padding: 0.18rem 0.42rem;
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, var(--sky) 58%, #ffffff 42%);
        font-size: 0.72rem;
      }

      .inventory-overview {
        display: grid;
        gap: 0.85rem;
        padding: clamp(0.8rem, 2vw, 1.1rem);
        border: 2px solid color-mix(in srgb, var(--outline) 50%, transparent);
        border-radius: var(--radius-2xl);
        background: color-mix(in srgb, #ffffff 90%, var(--lavender) 10%);
        box-shadow: 0 8px 0 color-mix(in srgb, var(--outline) 12%, transparent);
      }

      .inventory-view-panel {
        display: grid;
        gap: 0.75rem;
        min-width: 0;
      }

      .inventory-view-panel[hidden] { display: none !important; }

      .inventory-view-panel__header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .inventory-view-panel__header .section-title,
      .inventory-view-panel__header p { margin: 0; }

      .inventory-overview__hint,
      .inventory-list__hint {
        margin-top: 0.18rem !important;
        font-size: 0.84rem;
        line-height: 1.35;
        color: var(--ink-soft);
      }

      .inventory-needs-status,
      .inventory-strategy-count {
        flex: 0 0 auto;
        font-size: 0.78rem;
        color: var(--ink-soft);
        text-align: right;
      }

      .inventory-summary__filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }

      .inventory-summary__filter-button {
        min-height: 38px;
        min-width: 0;
        width: auto;
        height: auto;
        max-width: none;
        padding: 0.42rem 0.74rem;
        white-space: nowrap;
        line-height: 1.1;
        flex: 0 0 auto;
        border: 1.5px solid color-mix(in srgb, var(--outline) 38%, transparent);
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, #ffffff 88%, var(--lavender) 12%);
        box-shadow: none;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .inventory-summary__filter-button[aria-pressed='true'],
      .inventory-summary__filter-button--active {
        border-color: var(--outline);
        background: color-mix(in srgb, var(--sky) 54%, #ffffff 46%);
      }

      .inventory-summary {
        display: grid;
        gap: 0;
        overflow: hidden;
        border: 2px solid color-mix(in srgb, var(--outline) 46%, transparent);
        border-radius: var(--radius-xl);
        background: #ffffff;
      }

      .inventory-summary__item {
        display: grid;
        padding: 0;
        margin: 0;
        border: 0;
        border-bottom: 1px solid color-mix(in srgb, var(--outline) 17%, transparent);
        border-radius: 0;
        background: #ffffff;
        box-shadow: none;
        overflow: hidden;
      }

      .inventory-summary__item:last-child { border-bottom: 0; }
      .inventory-summary__item--ready { background: color-mix(in srgb, var(--mint) 13%, #ffffff 87%); }
      .inventory-summary__item--missing { background: color-mix(in srgb, var(--rose) 8%, #ffffff 92%); }

      .inventory-summary__focus {
        width: 100%;
        min-height: 62px;
        padding: 0.7rem 0.8rem;
        border: 0;
        background: transparent;
        box-shadow: none;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.7rem;
        text-align: left;
        color: var(--ink);
      }

      .inventory-summary__focus:hover,
      .inventory-summary__focus:focus-visible {
        transform: none;
        background: color-mix(in srgb, var(--sky) 16%, #ffffff 84%);
      }

      .inventory-summary__status {
        width: 0.82rem;
        height: 0.82rem;
        border: 2px solid var(--outline);
        border-radius: 50%;
        background: #ffffff;
      }

      .inventory-summary__item--ready .inventory-summary__status {
        background: var(--mint);
      }

      .inventory-summary__text {
        min-width: 0;
        display: grid;
        gap: 0.08rem;
      }

      .inventory-summary__label {
        font-size: 0.94rem;
        font-weight: 750;
        line-height: 1.2;
      }

      .inventory-summary__count {
        font-size: 0.78rem;
        line-height: 1.2;
        color: var(--ink-soft);
      }

      .inventory-summary__chevron {
        font-size: 1.35rem;
        line-height: 1;
        color: var(--ink-soft);
        transition: transform 0.16s ease;
      }

      .inventory-summary__focus[aria-expanded='true'] .inventory-summary__chevron {
        transform: rotate(90deg);
      }

      .inventory-summary__detail {
        padding: 0.75rem;
        border-top: 1px solid color-mix(in srgb, var(--outline) 17%, transparent);
        background: color-mix(in srgb, var(--lavender) 18%, #ffffff 82%);
        display: grid;
        gap: 0.65rem;
      }

      .inventory-summary__detail[hidden] { display: none !important; }

      .inventory-summary__detail-header,
      .inventory-summary__detail-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .inventory-summary__detail-title {
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .inventory-summary__about-link,
      .inventory-summary__add-button {
        min-height: 40px;
        border-radius: var(--radius-pill);
        font-size: 0.78rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.38rem 0.72rem;
      }

      .inventory-summary__about-link {
        color: var(--ink);
        text-decoration: none;
        border: 1.5px solid color-mix(in srgb, var(--outline) 34%, transparent);
        background: #ffffff;
      }

      .inventory-summary__add-button {
        border: 2px solid var(--outline);
        background: color-mix(in srgb, var(--rose) 74%, #ffffff 26%);
        color: var(--ink);
      }

      .inventory-summary__strategy-list {
        display: grid;
        gap: 0.5rem;
      }

      .inventory-item--compact {
        padding: 0.65rem 0.7rem;
        border-width: 1.5px;
        border-radius: var(--radius-lg);
        box-shadow: 0 3px 0 color-mix(in srgb, var(--outline) 11%, transparent);
        background: #ffffff;
      }

      .inventory-item--compact .inventory-item__title { font-size: 0.95rem; }
      .inventory-item--compact .inventory-item__description { font-size: 0.82rem; line-height: 1.35; }
      .inventory-item--compact .inventory-item__actions { margin-top: 0.35rem; }

      .inventory-strategy-search {
        min-height: 48px;
        padding: 0 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.55rem;
        border: 2px solid color-mix(in srgb, var(--outline) 42%, transparent);
        border-radius: var(--radius-lg);
        background: #ffffff;
      }

      .inventory-strategy-search__icon {
        flex: 0 0 auto;
        font-size: 1.1rem;
        color: var(--ink-soft);
      }

      .inventory-strategy-search input {
        width: 100%;
        min-width: 0;
        min-height: 44px;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--ink);
        font: inherit;
      }

      .inventory-list-panel {
        display: block;
        padding: 0;
        border: 0;
        box-shadow: none;
        background: transparent;
      }

      .inventory-list {
        display: grid;
        gap: 0.65rem;
      }

      .inventory-list .inventory-item {
        margin: 0;
      }

      .inventory-form--collapsible,
      .inventory-actions--collapsible {
        border: 2px solid color-mix(in srgb, var(--outline) 40%, transparent);
        border-radius: var(--radius-xl);
        background: color-mix(in srgb, #ffffff 90%, var(--lavender) 10%);
        box-shadow: 0 5px 0 color-mix(in srgb, var(--outline) 10%, transparent);
        overflow: hidden;
      }

      .inventory-disclosure-summary {
        min-height: 50px;
        padding: 0.68rem 0.8rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        cursor: pointer;
        list-style: none;
        font-weight: 800;
      }

      .inventory-disclosure-summary::-webkit-details-marker { display: none; }

      .inventory-disclosure-summary__glyph {
        width: 1.7rem;
        height: 1.7rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: color-mix(in srgb, var(--sky) 45%, #ffffff 55%);
        transition: transform 0.16s ease;
      }

      details[open] > .inventory-disclosure-summary .inventory-disclosure-summary__glyph {
        transform: rotate(45deg);
      }

      .inventory-disclosure-body {
        padding: 0 0.8rem 0.85rem;
      }

      .inventory-actions--collapsible .inventory-actions__header .section-title { display: none; }
    </style>`;

  /* Keep the phone stylesheet after the shared graph and Inventory base styles so
     its <=640px rules are the final, single owner of the phone presentation. */
  const inventoryMobileStyles =
    '    <link rel="stylesheet" href="../styles/inventory-mobile.css" media="(max-width: 640px)" />';

  const main = `
      <header class="page-header inventory-header">
        <div class="inventory-header__layout">
          <div class="inventory-header__content">
            <div class="inventory-header__title-row">
              <h1 class="page-title">Strategy inventory</h1>
              <a class="inventory-journal-button" href="./journal/">
                <img
                  src="../icons/journal-32bit.svg"
                  class="inventory-journal-button__icon"
                  alt=""
                  aria-hidden="true"
                />
                <span class="inventory-journal-button__label">Journal</span>
              </a>
            </div>
            <p class="page-description">
              Build a personal library of strategies that help you care for your needs. Browse by need or review everything you have saved.
            </p>
            <div class="strategy-quick-actions inventory-header__quick-actions">
              <a class="strategy-quick-actions__link" href="#inventory-form" data-inventory-form-open>
                <span class="strategy-quick-actions__icon" aria-hidden="true">+</span>
                <span>Add strategy</span>
              </a>
              <a class="inventory-shared-button" href="../feed/">
                <span class="inventory-shared-button__icon" aria-hidden="true">⇢</span>
                <span class="inventory-shared-button__text">
                  <span class="inventory-shared-button__eyebrow">Shared feed</span>
                  <span class="inventory-shared-button__label">View shared strategies</span>
                </span>
              </a>
            </div>

            <details class="inventory-bluesky-panel">
              <summary class="inventory-bluesky-panel__summary">
                <div class="inventory-bluesky-panel__titles">
                  <h2 class="inventory-bluesky-panel__title">Optional Bluesky sync</h2>
                  <p class="inventory-bluesky-panel__subtitle">
                    Sign in to unlock profile saves and backend load, or keep everything local.
                  </p>
                </div>
                <span class="inventory-bluesky-panel__chevron" aria-hidden="true">➤</span>
              </summary>

              <div class="inventory-bluesky-panel__content">
                <p class="inventory-bluesky-panel__intro">
                  Use Bluesky sign-in if you want profile save/load. You can still keep everything local using export/import only.
                </p>

                <!-- OAuth sign-in / sign-out -->
                <section class="inventory-auth-panel" aria-label="Bluesky sign-in">
                  <h2 class="inventory-auth-panel__heading">Bluesky sign-in</h2>

                  <p class="inventory-auth-note">
                    Sign in with your Bluesky account so this browser can prove who you are to the allneeds backend.
                    After a fresh sign-in, the app loads your backend snapshot once. Then you can save either to device only or to profile (which also syncs backend).
                  </p>

                  <div class="inventory-auth-panel__field" data-bluesky-handle-field>
                    <label for="bluesky-handle-input">Bluesky handle (e.g. yourname.bsky.social)</label>
                    <input id="bluesky-handle-input" type="text" autocomplete="username" />
                  </div>
                  <button
                    id="bluesky-auth-button"
                    type="button"
                    class="inventory-button inventory-button--compact"
                  >
                    <span class="inventory-button__text">Sign in</span>
                  </button>
                  <p id="bluesky-auth-status-text" class="inventory-auth-panel__status-text"></p>

                  <p class="inventory-auth-warning">
                    We never see your Bluesky password. Authentication happens only on Bluesky’s servers.
                    You can ignore this sign-in and keep everything local if you prefer.
                  </p>
                </section>

                <!-- Optional backend save/load -->
                <section class="inventory-backend-sync" aria-labelledby="inventory-backend-sync-heading">
                  <h3 id="inventory-backend-sync-heading" class="inventory-backend-sync__heading">
                    Optional backend save/load
                  </h3>
                  <p>
                    When you are signed in, these buttons send and retrieve a single JSON snapshot of your inventory
                    (the same data you can export as a file). Profile saves also trigger backend save automatically, while
                    device saves remain local-only. Use “Load data from allneeds backend” any time you want to pull the latest snapshot manually.
                  </p>
                  <p>
                    This makes it easier to continue your work on another device, but it also means that snapshot is stored
                    on the allneeds backend and could be seen by the server operator or exposed in a breach. If that doesn’t
                    feel right for you, keep using the local export/import buttons instead.
                  </p>

                  <div class="inventory-backend-sync__buttons">
                    <button
                      type="button"
                      data-backend-save-button
                      class="inventory-button inventory-button--compact"
                    >
                      <span class="inventory-button__text">Save current data to allneeds backend</span>
                    </button>
                    <button
                      type="button"
                      data-backend-load-button
                      class="inventory-button inventory-button--ghost inventory-button--compact"
                    >
                      <span class="inventory-button__text">Load data from allneeds backend</span>
                    </button>
                  </div>

                  <div
                    class="inventory-backend-sync__status"
                    data-backend-sync-status
                    aria-live="polite"
                  ></div>
                </section>

              </div>
            </details>
          </div>
        </div>
      </header>

      <section class="inventory-main" aria-labelledby="inventory-overview-heading">
        <details class="inventory-actions inventory-actions--collapsible">
          <summary class="inventory-disclosure-summary">
            <span>Backup &amp; restore</span>
            <span class="inventory-disclosure-summary__glyph" aria-hidden="true">+</span>
          </summary>
          <div class="inventory-disclosure-body">
          <div class="inventory-actions__header">
            <h2 id="inventory-actions-heading" class="visually-hidden">Backup and restore</h2>
            <p class="inventory-actions__hint">
              Export or import a JSON dump of this site's localStorage (inventory, journal, and customizer settings).
            </p>
          </div>
          <div class="inventory-actions__buttons">
            <button
              type="button"
              id="inventory-export"
              class="inventory-button inventory-button--compact"
              aria-label="Export localStorage JSON"
            >
              <span class="inventory-button__glyph" aria-hidden="true">⤓</span>
              <span class="inventory-button__text">Export localStorage</span>
            </button>
            <button
              type="button"
              id="inventory-email-personal"
              class="inventory-button inventory-button--ghost inventory-button--compact"
              aria-label="Export personal strategies and email them to Nat"
            >
              <span class="inventory-button__glyph" aria-hidden="true">✉️</span>
              <span class="inventory-button__text">email me your strategies pretty please 🙏 - Nat</span>
            </button>
            <button
              type="button"
              id="inventory-import-trigger"
              class="inventory-button inventory-button--ghost inventory-button--compact"
              aria-label="Import localStorage JSON"
            >
              <span class="inventory-button__glyph" aria-hidden="true">⤒</span>
              <span class="inventory-button__text">Import localStorage</span>
            </button>
            <input type="file" id="inventory-import" accept="application/json,.json,text/csv,.csv" hidden />
          </div>
          <p class="inventory-message" data-inventory-message hidden aria-live="polite"></p>
          </div>
        </details>

        <section class="inventory-overview" aria-label="Strategy inventory views">
        <div class="inventory-view-switch" role="tablist" aria-label="Inventory view">
          <button
            type="button"
            id="inventory-view-needs"
            class="inventory-view-switch__button is-active"
            role="tab"
            aria-selected="true"
            aria-controls="inventory-needs-panel"
            data-inventory-view="needs"
          >
            Needs
          </button>
          <button
            type="button"
            id="inventory-view-strategies"
            class="inventory-view-switch__button"
            role="tab"
            aria-selected="false"
            aria-controls="inventory-strategies-panel"
            data-inventory-view="strategies"
          >
            Strategies
            <span class="inventory-view-switch__count" data-inventory-strategy-badge hidden></span>
          </button>
        </div>

        <section
          id="inventory-needs-panel"
          class="inventory-view-panel inventory-view-panel--needs"
          role="tabpanel"
          aria-labelledby="inventory-view-needs"
          data-inventory-view-panel="needs"
        >
          <div class="inventory-overview__header inventory-view-panel__header">
            <div>
              <h2 class="section-title">Needs</h2>
              <p class="inventory-overview__hint">Tap a need to see the strategies you have saved for it.</p>
            </div>
            <p class="inventory-needs-status" data-inventory-needs-status aria-live="polite"></p>
          </div>
          <div class="inventory-overview__tools">
            <div class="inventory-summary__filters" role="group" aria-label="Filter needs">
              <button type="button" class="inventory-summary__filter-button" data-summary-filter="all" aria-pressed="true">All</button>
              <button type="button" class="inventory-summary__filter-button" data-summary-filter="missing" aria-pressed="false">Needs care</button>
              <button type="button" class="inventory-summary__filter-button" data-summary-filter="ready" aria-pressed="false">Supported</button>
            </div>
          </div>
          <div id="inventory-summary" class="inventory-summary"></div>
        </section>

        <section
          id="inventory-strategies-panel"
          class="inventory-view-panel inventory-view-panel--strategies"
          role="tabpanel"
          aria-labelledby="inventory-view-strategies"
          data-inventory-view-panel="strategies"
          hidden
        >
          <div class="inventory-list__header inventory-view-panel__header">
            <div>
              <h2 id="inventory-list-heading" class="section-title" tabindex="-1">My strategies</h2>
              <p class="inventory-list__hint">Everything you have saved, regardless of which needs it supports.</p>
            </div>
            <p class="inventory-strategy-count" data-inventory-strategy-count aria-live="polite"></p>
          </div>
          <label class="inventory-strategy-search">
            <span class="visually-hidden">Search saved strategies</span>
            <span class="inventory-strategy-search__icon" aria-hidden="true">⌕</span>
            <input type="search" placeholder="Search your strategies" autocomplete="off" data-inventory-strategy-search />
          </label>
          <div
            class="inventory-list-panel"
            id="strategies-list"
            data-strategies-container
            aria-labelledby="inventory-list-heading"
          >
            <div id="inventory-list" class="inventory-list"></div>
          </div>
        </section>
      </section>

        <details class="inventory-form inventory-form--collapsible" data-inventory-form-shell>
          <summary class="inventory-disclosure-summary">
            <span>Add a personal strategy</span>
            <span class="inventory-disclosure-summary__glyph" aria-hidden="true">+</span>
          </summary>
          <div class="inventory-disclosure-body">
          <h2 id="inventory-form-heading" class="visually-hidden">Add a personal strategy</h2>
          ${personalStrategyForm}
          </div>
        </details>
      </section>
    `;

  const html = htmlPage({
    title: 'Inventory',
    depth: 1,
    breadcrumbs: [
      { label: 'Home', href: '../' },
      { label: 'Inventory' },
    ],
    scripts: [{ src: 'scripts/inventory-bluesky.js?v=2026-02-12', module: true }],
    headExtras: `${blueskyPanelStyles}\n${inventoryMobileStyles}`,
    main,
    mainClass: 'page inventory-page',
    activeNav: 'inventory',
    canonicalPath: 'inventory/',
  });

  writePage('inventory/index.html', html);
}

function renderInventoryJournalPage(needsList = []) {
  const needsDataset = needsList
    .map((need) => ({ slug: need.slug, title: need.title }))
    .filter((item) => item.slug && item.title);
  const needsJson = JSON.stringify(needsDataset);
  const journalPageStyles = `    <style>
      /* Journal UX first pass v1 — inline pre-paint overrides */
      main[data-page-id='inventory-journal'] {
        gap: clamp(1rem, 2.4vw, 1.5rem);
      }

      main[data-page-id='inventory-journal'] .journal-page-header {
        padding: clamp(1rem, 3vw, 1.35rem);
        border: 2px solid color-mix(in srgb, var(--outline) 58%, transparent);
        border-radius: var(--radius-2xl);
        background: color-mix(in srgb, #ffffff 90%, var(--lavender) 10%);
        box-shadow: 0 10px 0 color-mix(in srgb, var(--outline) 14%, transparent);
        gap: 0.8rem;
      }

      main[data-page-id='inventory-journal'] .journal-page-title-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(220px, 0.8fr);
        gap: 0.85rem;
        align-items: center;
      }

      main[data-page-id='inventory-journal'] .journal-page-header .page-title {
        display: block;
        position: static;
        width: auto;
        height: auto;
        margin: 0;
        overflow: visible;
        clip: auto;
        white-space: normal;
        font-size: clamp(1.45rem, 4.8vw, 2.2rem);
        line-height: 1.08;
        text-transform: uppercase;
        letter-spacing: 0.055em;
      }

      main[data-page-id='inventory-journal'] .journal-page-title-row__actions {
        width: 100%;
        justify-content: stretch;
      }

      main[data-page-id='inventory-journal'] .journal-fullscreen-button--spotlight {
        width: 100%;
        min-height: 58px;
        justify-content: center;
        padding: 0.72rem 0.9rem;
        border: 3px solid var(--outline);
        border-radius: var(--radius-lg);
        background: color-mix(in srgb, var(--rose) 84%, #ffffff 16%);
        color: var(--ink);
        box-shadow: 0 8px 0 color-mix(in srgb, var(--outline) 34%, transparent);
        font-weight: 700;
      }

      main[data-page-id='inventory-journal'] .journal-fullscreen-button--spotlight:hover,
      main[data-page-id='inventory-journal'] .journal-fullscreen-button--spotlight:focus-visible {
        transform: translateY(-2px);
        border-color: var(--outline);
        background: color-mix(in srgb, var(--rose) 90%, #ffffff 10%);
        box-shadow: 0 11px 0 color-mix(in srgb, var(--outline) 38%, transparent);
      }

      main[data-page-id='inventory-journal'] .journal-fullscreen-button__icon {
        width: 2rem;
        height: 2rem;
        min-width: 2rem;
        min-height: 2rem;
        border-width: 2px;
        box-shadow: none;
      }

      main[data-page-id='inventory-journal'] .journal-fullscreen-button__title {
        font-size: 0.95rem;
        letter-spacing: 0.035em;
        text-transform: uppercase;
      }

      main[data-page-id='inventory-journal'] .journal-page-description {
        max-width: 62ch;
        font-size: 0.94rem;
        line-height: 1.45;
      }

      main[data-page-id='inventory-journal'] .journal-page {
        display: grid;
        gap: clamp(0.9rem, 2.5vw, 1.25rem);
      }

      main[data-page-id='inventory-journal'] .journal-overview-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas:
          'summary'
          'backup';
        gap: clamp(0.75rem, 2vw, 1rem);
      }

      main[data-page-id='inventory-journal'] .journal-summary-section {
        grid-area: summary;
        border: 2px solid color-mix(in srgb, var(--outline) 45%, transparent);
        background: color-mix(in srgb, #ffffff 86%, var(--sky) 14%);
      }

      main[data-page-id='inventory-journal'] .journal-actions {
        grid-area: backup;
        border: 2px solid color-mix(in srgb, var(--outline) 34%, transparent);
        background: color-mix(in srgb, #ffffff 92%, var(--lavender) 8%);
      }

      main[data-page-id='inventory-journal'] .journal-panel {
        padding: clamp(0.9rem, 2.6vw, 1.15rem);
        border-radius: var(--radius-xl);
        box-shadow: 0 6px 0 color-mix(in srgb, var(--outline) 10%, transparent);
      }

      main[data-page-id='inventory-journal'] .journal-actions__header,
      main[data-page-id='inventory-journal'] .journal-history-section__header {
        gap: 0.25rem;
      }

      main[data-page-id='inventory-journal'] .journal-actions__hint,
      main[data-page-id='inventory-journal'] .journal-form-section__hint,
      main[data-page-id='inventory-journal'] .journal-list__hint {
        line-height: 1.4;
      }

      main[data-page-id='inventory-journal'] .journal-actions__buttons {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 0.55rem;
      }

      main[data-page-id='inventory-journal'] .journal-actions__buttons .inventory-button {
        width: 100%;
        min-height: 46px;
        padding: 0.55rem 0.7rem;
        border-width: 2px;
        box-shadow: 0 4px 0 color-mix(in srgb, var(--outline) 15%, transparent);
        font-size: 0.82rem;
      }

      main[data-page-id='inventory-journal'] .journal-summary__header {
        align-items: center;
        gap: 0.65rem;
      }

      main[data-page-id='inventory-journal'] .journal-summary__header .inventory-button {
        min-height: 44px;
        padding: 0.45rem 0.7rem;
        border-width: 2px;
        font-size: 0.78rem;
      }

      main[data-page-id='inventory-journal'] .journal-history-section {
        border: 2px solid color-mix(in srgb, var(--outline) 52%, transparent);
        background: #ffffff;
        box-shadow: 0 8px 0 color-mix(in srgb, var(--outline) 12%, transparent);
      }

      main[data-page-id='inventory-journal'] .journal-filters {
        gap: 0.65rem;
      }

      main[data-page-id='inventory-journal'] .journal-inline-fallback {
        margin-top: 0.1rem;
        border-width: 2px;
        border-color: color-mix(in srgb, var(--outline) 30%, transparent);
        background: color-mix(in srgb, #ffffff 92%, var(--lavender) 8%);
        box-shadow: none;
      }

      main[data-page-id='inventory-journal'] .journal-inline-fallback__summary {
        padding: 0.72rem 0.85rem;
        font-size: 0.82rem;
      }

      @media (min-width: 760px) {
        main[data-page-id='inventory-journal'] .journal-overview-grid {
          grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.6fr);
          grid-template-areas: 'summary backup';
          align-items: start;
        }
      }

      @media (max-width: 640px) {
        main[data-page-id='inventory-journal'] .journal-page-header {
          padding: 0.95rem;
          gap: 0.7rem;
        }

        main[data-page-id='inventory-journal'] .journal-page-title-row {
          grid-template-columns: minmax(0, 1fr);
          gap: 0.65rem;
        }

        main[data-page-id='inventory-journal'] .journal-fullscreen-button--spotlight {
          min-height: 62px;
        }

        main[data-page-id='inventory-journal'] .journal-page-description {
          font-size: 0.9rem;
        }

        main[data-page-id='inventory-journal'] .journal-panel {
          padding: 0.85rem;
        }

        main[data-page-id='inventory-journal'] .journal-actions__buttons {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    </style>`;

  const main = `
      <header class="page-header journal-page-header">
        <div class="journal-page-title-row">
          <h1 class="page-title">Journal</h1>
          <div class="journal-page-title-row__actions">
            <button
              type="button"
              class="journal-fullscreen-button journal-fullscreen-button--spotlight"
              data-support-journal-open
              aria-expanded="false"
              aria-controls="global-support-journal-layer"
            >
              <span class="journal-fullscreen-button__icon" aria-hidden="true"></span>
              <span class="journal-fullscreen-button__text">
                <span class="journal-fullscreen-button__title">Open journal</span>
              </span>
            </button>
          </div>
        </div>
        <p class="page-description journal-page-description">
          Log feelings, needs, and notes from any check-in. Review patterns over time, or export a backup when you want one.
        </p>
      </header>
      <section class="journal-page" data-inventory-section="journal">
        <div class="journal-overview-grid">
          <section class="journal-actions journal-panel" aria-labelledby="journal-actions-heading">
            <div class="journal-actions__header">
              <h2 id="journal-actions-heading" class="section-title">Backup &amp; restore</h2>
              <p class="journal-actions__hint">
                Export or import a backup of your journal, inventory, and customizer settings.
              </p>
            </div>
            <div class="journal-actions__buttons">
              <button type="button" id="journal-export" class="inventory-button">Export backup</button>
              <button type="button" id="journal-import-trigger" class="inventory-button inventory-button--ghost">Import backup</button>
              <input type="file" id="journal-import" accept="application/json,.json,text/csv,.csv" hidden />
            </div>
            <p class="journal-message" data-journal-message hidden aria-live="polite"></p>
          </section>

          <section class="journal-summary-section journal-panel" aria-labelledby="journal-summary-heading">
            <div class="journal-summary__header">
              <h2 id="journal-summary-heading" class="section-title">Patterns at a glance</h2>
              <button
                type="button"
                class="inventory-button inventory-button--ghost"
                data-journal-summary-toggle
                aria-expanded="true"
              >
                Hide summary
              </button>
            </div>
            <div class="journal-summary" data-journal-summary></div>
          </section>
        </div>

        <section class="journal-history-section journal-panel journal-panel--history" aria-labelledby="journal-history-heading">
          <div class="journal-history-section__header">
            <h2 id="journal-history-heading" class="section-title">Journal history</h2>
            <p class="journal-actions__hint">Search entries, focus on a tag, or sort by intensity to notice patterns.</p>
          </div>
          <form class="journal-filters" data-journal-filters>
            <div class="journal-filters__field">
              <label for="journal-filter-search">Search notes</label>
              <input id="journal-filter-search" name="search" type="search" placeholder="Search text" />
            </div>
            <div class="journal-filters__field">
              <label for="journal-filter-tag">Filter tags</label>
              <input id="journal-filter-tag" name="tag" type="text" placeholder="e.g. work" />
            </div>
            <div class="journal-filters__field">
              <label for="journal-filter-sort">Sort order</label>
              <select id="journal-filter-sort" name="sort">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="intensity-high">Highest intensity</option>
                <option value="intensity-low">Lowest intensity</option>
              </select>
            </div>
            <div class="journal-filters__actions">
              <button type="button" class="inventory-button inventory-button--ghost" data-journal-filters-reset>Reset filters</button>
            </div>
          </form>
          <p class="journal-empty" data-journal-empty hidden>Save entries to see them listed here.</p>
          <div class="journal-history journal-history--cards" data-journal-history></div>
        </section>

        <details class="journal-inline-fallback" data-journal-inline-fallback>
          <summary class="journal-inline-fallback__summary">
            <span class="journal-inline-fallback__summary-text">Need the legacy inline journal form?</span>
          </summary>
          <div class="journal-inline-fallback__body">
            <p class="journal-inline-fallback__note">
              The full screen journal above is the best experience&mdash;it's roomier, faster, and stays current with
              new features. This legacy form is more constrained and less polished, so only use it if the primary
              journal will not load.
            </p>
            <div class="journal-inline-container journal-panel journal-panel--form-shell" data-journal-inline-container>
              <section class="journal-form-section" aria-labelledby="journal-form-heading">
                <div class="journal-form-section__header">
                  <h2 id="journal-form-heading" class="section-title">Log a new entry</h2>
                  <p class="journal-form-section__hint">Tag what's present right now. Unsure of the feeling? Leave it blank and lean on the notes.</p>
                </div>
                <div class="journal-module" data-journal-module data-journal-variant="inventory" data-journal-id-prefix="journal">
                  <noscript>
                    <p class="journal-status">Enable JavaScript to use the journal form.</p>
                  </noscript>
                </div>
              </section>
            </div>
          </div>
        </details>
      </section>
      <script type="application/json" id="journal-needs-data">${escapeHtml(needsJson)}</script>
    `;

  const html = htmlPage({
    title: 'Journal',
    depth: 2,
    description:
      'Log feelings, needs, and reflections to extend your strategy inventory. Everything stays on your device in localStorage with import and export controls.',
    breadcrumbs: [
      { label: 'Home', href: '../../' },
      { label: 'Inventory', href: '../' },
      {
        html: '<span class="breadcrumbs__label"><img src="../../icons/journal-32bit.svg" class="journal-label-icon" alt="" aria-hidden="true" /> Journal</span>',
      },
    ],
    main,
    mainAttributes: 'data-page-id="inventory-journal"',
    headExtras: journalPageStyles,
    scripts: [
      { src: 'assets/js/journal/store.js', type: 'module', beforeBase: true },
      { src: 'assets/js/journal/module.js', type: 'module' },
      { src: 'scripts/inventory.js', defer: true },
    ],
    activeNav: 'inventory',
    canonicalPath: 'inventory/journal/',
  });

  writePage('inventory/journal/index.html', html);
}

function renderPillGroup(label, items, type) {
  if (!items || items.length === 0) {
    return '';
  }

  const magnets = items
  .map((item) => {
    const label = escapeHtml(item.title);
    return `<a class="pill magnet" data-magnet-id="${type}-${item.slug}" href="../../${type}/${item.slug}/"><span class="magnet__label">${label}</span></a>`;
  })
  .join('');


  return `<section class="pill-section magnet-section" aria-labelledby="${slugify(label)}-heading" data-magnet-root>
      <div class="magnet-section__header">
        <h2 id="${slugify(label)}-heading" class="section-title">${escapeHtml(label)}</h2>
        <button type="button" class="shuffle-button" data-magnet-shuffle aria-label="Shuffle magnets">
          <svg class="shuffle-button__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M16 3h5v5"></path>
            <path d="M4 20L21 3"></path>
            <path d="M21 16v5h-5"></path>
            <path d="M15 15l6 6"></path>
            <path d="M4 4l5 5"></path>
          </svg>
        </button>
      </div>
      <div class="magnet-board-wrapper">
        <div class="pill-grid magnet-board" data-magnet-board>
          ${magnets}
        </div>
          <label class="magnet-play-toggle" data-magnet-toggle data-state="on">
            <input type="checkbox" class="magnet-play-toggle__input" role="switch" aria-label="Disable magnet physics" checked>
            <span class="magnet-play-toggle__track" aria-hidden="true">
              <span class="magnet-play-toggle__thumb"></span>
            </span>
            <span class="visually-hidden magnet-play-toggle__sr-state">Physics is on</span>
          </label>
      </div>
    </section>`;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function updateSupportLaneNav() {
  const supportPath = join(rootDir, 'alexithymia-support', 'index.html');
  let contents;

  try {
    contents = readFileSync(supportPath, 'utf8');
  } catch (error) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Unable to read Alexithymia Support page for nav update', error);
    }
    return;
  }

  const navPattern = /(^\s*)<nav class="site-nav magnet-section"[\s\S]*?<\/nav>(?:\s*<script[\s\S]*?<\/script>)*(?=\s*<(?:nav|main)\b)/m;
  const match = navPattern.exec(contents);

  if (!match) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Alexithymia Support page is missing the primary nav block; skipped nav sync.');
    }
    return;
  }

  const indent = match[1] ?? '';
  const navMarkup = renderNav('../', 'feelings');
  const replacement = indentBlock(navMarkup, indent);

  if (match[0] === replacement) {
    return;
  }

  const updated = contents.replace(navPattern, replacement);

  if (updated !== contents) {
    writeFileSync(supportPath, updated);
  }
}

function build(scopeSet) {
  const shouldBuild = (scope) => !scopeSet || scopeSet.has(scope);

  const buildHome = shouldBuild('home');
  const buildFauxFeelings = shouldBuild('faux-feelings');
  const buildFeelings = shouldBuild('feelings');
  const buildNeeds = shouldBuild('needs');
  const buildInventory = shouldBuild('inventory');
  const buildObservationGuide = shouldBuild('observation-guide');
  const buildSupportLane = shouldBuild('support-lane');

  if (buildHome) {
    renderHome();
  }

  if (buildFauxFeelings) {
    renderCategory('faux-feelings', data.fauxFeelings);
  }

  if (buildFeelings) {
    renderCategory('feelings', data.feelings);
    renderBodyCuesPage();
  }

  if (buildNeeds) {
    renderCategory('needs', data.needs);
  }

  if (buildInventory) {
    renderInventoryPage();
    renderInventoryJournalPage(data.needs);
  }

  if (buildFauxFeelings) {
    for (const fauxFeeling of data.fauxFeelings) {
      renderFauxFeeling(fauxFeeling);
    }
  }

  if (buildFeelings) {
    for (const feeling of data.feelings) {
      renderFeeling(feeling);
    }
  }

  if (buildNeeds) {
    for (const need of data.needs) {
      renderNeed(need, strategies);
    }
  }

  if (buildObservationGuide) {
    updateObservationGuidePage();
  }

  if (buildSupportLane) {
    updateSupportLaneNav();
  }
}

build(requestedScopes);
