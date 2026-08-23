export const NAV_MAGNET_STORAGE_KEY = 'site-nav';

export const navVisibilityBootstrapScript = () => String.raw`
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
export const magnetPrefillScript = (storageKey) => String.raw`
      <script>
        (function() {
          if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
          }
          var root = document.querySelector('[data-magnet-root][data-magnet-key="${storageKey}"]');
          if (!root) {
            return;
          }
          var board = root.querySelector('[data-magnet-board]');
          if (!board) {
            return;
          }
          var LEGACY_STORAGE_KEY = 'magnetPositions:${storageKey}';
          var bucket = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches ? 'mobile' : 'desktop';
          var STORAGE_KEY = LEGACY_STORAGE_KEY + '@' + bucket;
          var MIGRATION_KEY = LEGACY_STORAGE_KEY + '@responsive-v1';
          var raw;
          try {
            if (!('localStorage' in window)) {
              return;
            }
            raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw && !window.localStorage.getItem(MIGRATION_KEY)) {
              var legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
              if (legacyRaw) {
                window.localStorage.setItem(STORAGE_KEY, legacyRaw);
                raw = legacyRaw;
              }
              window.localStorage.setItem(MIGRATION_KEY, bucket);
            }
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
          // Navigation positions are responsive percentages. The current
          // canonical CSS owns the board height; restoring a historical height
          // lets an older route permanently enlarge the shared navigation lane.
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
