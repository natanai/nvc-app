export const NAV_MAGNET_STORAGE_KEY = 'site-nav';
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
