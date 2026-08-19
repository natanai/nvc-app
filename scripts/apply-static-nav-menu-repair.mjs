import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function write(path, content) {
  writeFileSync(join(root, path), content);
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`Missing expected ${label}: ${needle}`);
  }
}

function replaceOnce(text, needle, replacement, label) {
  const index = text.indexOf(needle);
  if (index < 0) throw new Error(`Unable to find ${label}`);
  if (text.indexOf(needle, index + needle.length) >= 0) {
    throw new Error(`Expected exactly one ${label}`);
  }
  return text.slice(0, index) + replacement + text.slice(index + needle.length);
}

const menuMarkup = `            <button
              class=\"pill magnet site-nav__magnet site-nav__magnet--menu\"
              type=\"button\"
              data-magnet-id=\"nav-menu\"
              aria-label=\"Open More menu\"
              aria-haspopup=\"dialog\"
              aria-expanded=\"false\"
              aria-controls=\"nav-more-menu\"
            >
              <svg class=\"site-nav__menu-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\">
                <path d=\"M4 7h16M4 12h16M4 17h16\"></path>
              </svg>
              <span class=\"site-nav__magnet-label visually-hidden\">More</span>
            </button>
`;

// 1. Generator: Menu is real markup, normal script ordering, and nav prefill waits
// for a complete saved visible layout before revealing the board.
{
  const path = 'scripts/build-pages.mjs';
  let text = read(path);

  if (!text.includes("{ src: 'scripts/inventory-core-shell.js', defer: true }")) {
    text = replaceOnce(
      text,
      "    { src: 'assets/js/journal/store.js', module: true },\n    { src: 'scripts/inventory.js', defer: true },",
      "    { src: 'assets/js/journal/store.js', module: true },\n    { src: 'scripts/inventory-core-shell.js', defer: true },\n    { src: 'scripts/inventory.js', defer: true },",
      'base script list',
    );
  }

  if (!text.includes('data-magnet-id=\\"nav-menu\\"')) {
    const homeLineNeedle = '            <a class=\\"pill magnet site-nav__magnet site-nav__magnet--home\\" data-magnet-id=\\"nav-home\\"';
    assertIncludes(text, homeLineNeedle, 'nav Home markup');
    text = text.replace(homeLineNeedle, menuMarkup + homeLineNeedle);
  }

  // Journal is no longer part of the default core board, but remains available
  // via More and can still be enabled through saved/customized nav settings.
  const visibilityStart = text.indexOf('const navVisibilityBootstrapScript');
  const visibilityEnd = text.indexOf('const BRAND_NAME', visibilityStart);
  if (visibilityStart < 0 || visibilityEnd < 0) throw new Error('Unable to locate nav visibility bootstrap');
  let visibility = text.slice(visibilityStart, visibilityEnd);
  visibility = visibility.replace('            journal: true,', '            journal: false,');

  if (!visibility.includes("allneeds.navMore.v2")) {
    const parsedGuard = `          if (!parsed || typeof parsed !== 'object') {
            return;
          }
`;
    assertIncludes(visibility, parsedGuard, 'nav settings parsed guard');
    const migration = `${parsedGuard}
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
`;
    visibility = visibility.replace(parsedGuard, migration);
  }
  text = text.slice(0, visibilityStart) + visibility + text.slice(visibilityEnd);

  // A static Menu magnet must use the same no-flicker contract as every other
  // core nav object. If saved positions predate any visible magnet, do not mark
  // the board ready; magnets.js will perform one canonical reseed while hidden.
  const prefillStart = text.indexOf('const navPrefillScript');
  const prefillEnd = text.indexOf('const navVisibilityBootstrapScript', prefillStart);
  if (prefillStart < 0 || prefillEnd < 0) throw new Error('Unable to locate nav prefill script');
  let prefill = text.slice(prefillStart, prefillEnd);
  if (!prefill.includes('hasMissingVisiblePlacement')) {
    const loopNeedle = `          for (var i = 0; i < magnets.length; i += 1) {
`;
    assertIncludes(prefill, loopNeedle, 'nav prefill loop');
    prefill = prefill.replace(loopNeedle, `          var hasMissingVisiblePlacement = false;
${loopNeedle}`);

    const missingNeedle = `            if (!id || !(id in parsed.magnets)) {
              continue;
            }
`;
    assertIncludes(prefill, missingNeedle, 'nav prefill missing-position branch');
    prefill = prefill.replace(missingNeedle, `            if (!id) {
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
`);

    const readyNeedle = `          if (board && (board.dataset || typeof board.setAttribute === 'function')) {
`;
    assertIncludes(prefill, readyNeedle, 'nav ready marker');
    prefill = prefill.replace(readyNeedle, `          if (hasMissingVisiblePlacement) {
            if (restoreTransitions) {
              restoreTransitions();
            }
            return;
          }

${readyNeedle}`);
  }
  text = text.slice(0, prefillStart) + prefill + text.slice(prefillEnd);

  write(path, text);
}

// 2. Magnet engine: a visible new nav object means the saved board is an old
// schema. Reseed canonically instead of appending the newcomer below the board.
{
  const path = 'scripts/magnets.js';
  let text = read(path);
  const orderPattern = /const NAV_MOBILE_ORDER_IDS = \[[\s\S]*?\];/;
  if (!orderPattern.test(text)) throw new Error('Unable to locate nav mobile order');
  text = text.replace(orderPattern, `const NAV_MOBILE_ORDER_IDS = [
  'nav-menu',
  'nav-home',
  'nav-observations',
  'nav-feelings',
  'nav-needs',
  'nav-inventory',
  'nav-customizer',
  'nav-journal',
];`);

  if (!text.includes('hasMissingVisibleNavMagnet')) {
    const storedNeedle = `  const stored = storedResult?.magnets || null;
`;
    assertIncludes(text, storedNeedle, 'stored magnet layout');
    text = text.replace(storedNeedle, `${storedNeedle}  const storedIds = Array.isArray(stored)
    ? new Set(stored.map((item) => item?.id).filter(Boolean))
    : null;
  const hasMissingVisibleNavMagnet = Boolean(
    isNavBoardState(state)
    && storedIds
    && state.magnets.some((magnet) => !magnet.navHidden && !storedIds.has(magnet.id)),
  );
`);
    text = replaceOnce(
      text,
      '  if (stored && stored.length) {',
      '  if (stored && stored.length && !hasMissingVisibleNavMagnet) {',
      'stored layout restore condition',
    );
  }
  write(path, text);
}

// 3. Customizer defaults align with the new core board.
{
  const path = 'scripts/inventory.js';
  let text = read(path);
  const journalStart = text.indexOf("    id: 'journal',");
  const journalEnd = text.indexOf("    id: 'inventory',", journalStart);
  if (journalStart < 0 || journalEnd < 0) throw new Error('Unable to locate journal nav definition');
  let journalBlock = text.slice(journalStart, journalEnd);
  journalBlock = journalBlock.replace('defaultEnabled: true', 'defaultEnabled: false');
  text = text.slice(0, journalStart) + journalBlock + text.slice(journalEnd);
  write(path, text);
}

// 4. Restore contrast.js to its page-specific prepaint responsibilities. The
// shared More prototype must not inject a parser-time script before Body Cues.
{
  const path = 'assets/js/ui/contrast.js';
  let text = read(path);
  const start = text.indexOf('  function loadSharedMoreNavigationBeforeMagnets()');
  if (start >= 0) {
    const call = '  loadSharedMoreNavigationBeforeMagnets();\n\n';
    const end = text.indexOf(call, start);
    if (end < 0) throw new Error('Unable to locate shared More loader call');
    text = text.slice(0, start) + text.slice(end + call.length);
  }
  assertIncludes(text, 'loadBodyCuesStylesBeforePaint();', 'Body Cues prepaint loader');
  write(path, text);
}

// 5. Menu magnet critical styles belong with the other nav magnets, while the
// drawer CSS can load through the normal global stylesheet.
{
  const path = 'styles/nav-critical.css';
  let text = read(path);
  if (!text.includes('.site-nav__magnet--menu {')) {
    const anchor = `.site-nav__magnet--home,
.site-nav__magnet--customizer {`;
    assertIncludes(text, anchor, 'Home/Customizer critical styles');
    const menuCss = `.site-nav__magnet--menu {
  padding: 0.45rem;
  gap: 0;
  justify-content: center;
  min-width: 0;
  background: color-mix(in srgb, var(--gold) 72%, #ffffff 28%);
}

.site-nav__menu-icon {
  width: 1.4rem;
  height: 1.4rem;
  display: block;
  flex-shrink: 0;
  fill: none;
  stroke: var(--outline);
  stroke-width: 2.2;
  stroke-linecap: round;
  pointer-events: none;
}

.site-nav__magnet--menu[aria-expanded='true'] {
  background: color-mix(in srgb, var(--gold) 88%, #ffffff 12%);
  box-shadow: inset 0 -8px 0 color-mix(in srgb, var(--outline) 18%, transparent);
}

`;
    text = text.replace(anchor, menuCss + anchor);
  }
  if (!text.includes(".magnet-board:not([data-ready='1']) .magnet")) {
    const boardAnchor = `.site-nav__board {
`;
    assertIncludes(text, boardAnchor, 'site nav board styles');
    text = text.replace(boardAnchor, `.magnet-board:not([data-ready='1']) .magnet {
  position: absolute;
  touch-action: none;
  transition: none;
  visibility: hidden;
}

${boardAnchor}`);
  }
  write(path, text);
}

{
  const path = 'styles.css';
  let text = read(path);
  if (!text.includes("@import url('styles/inventory-core-shell.css');")) {
    const anchor = "@import url('styles/needs-magnet-icons.css');\n";
    assertIncludes(text, anchor, 'stylesheet imports');
    text = text.replace(anchor, anchor + "@import url('styles/inventory-core-shell.css');\n");
  }
  // Safari's layout viewport can extend behind browser chrome. Keep the mobile
  // Customizer inside the stable visible viewport.
  text = text.replace(
    '    max-height: calc(100vh - clamp(7rem, 22vw, 10rem));',
    '    max-height: calc(100vh - clamp(7rem, 22vw, 10rem));\n    max-height: calc(100svh - clamp(7rem, 22vw, 10rem));',
  );
  write(path, text);
}

// 6. More controller now expects a real static magnet. It no longer creates,
// reorders, or changes nav visibility at runtime.
{
  const path = 'scripts/inventory-core-shell.js';
  let text = read(path);
  const dynamicBlockStart = text.indexOf('  let menuMagnet = board.querySelector');
  const dynamicBlockEndNeedle = '  const rootUrl = getSiteRootUrl(nav);';
  const dynamicBlockEnd = text.indexOf(dynamicBlockEndNeedle, dynamicBlockStart);
  if (dynamicBlockStart < 0 || dynamicBlockEnd < 0) throw new Error('Unable to locate dynamic Menu initialization');
  text = text.slice(0, dynamicBlockStart)
    + `  const menuMagnet = board.querySelector(\`[data-magnet-id="\${MENU_MAGNET_ID}"]\`);
  if (!(menuMagnet instanceof HTMLElement)) return false;

`
    + text.slice(dynamicBlockEnd);
  write(path, text);
}

// 7. Build all generator-owned pages so the static Menu is present before the
// existing nav prefill script. Non-generator HTML is normalized afterward.

function collectHtml(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) out.push(...collectHtml(full));
    else if (info.isFile() && name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}

function normalizeStaticNavHtml() {
  for (const full of collectHtml(root)) {
    let html = readFileSync(full, 'utf8');
    if (!html.includes('data-magnet-root') || !html.includes('data-magnet-key="site-nav"')) continue;
    let changed = false;

    if (!html.includes('data-magnet-id="nav-menu"')) {
      const homeIndex = html.indexOf('<a class="pill magnet site-nav__magnet site-nav__magnet--home"');
      if (homeIndex < 0) throw new Error(`No Home magnet insertion point in ${relative(root, full)}`);
      const staticMenu = menuMarkup.replaceAll('\\"', '"');
      html = html.slice(0, homeIndex) + staticMenu + html.slice(homeIndex);
      changed = true;
    }

    if (!html.includes('scripts/inventory-core-shell.js')) {
      const magnetScript = /<script([^>]*?)src="([^"]*scripts\/magnets\.js)"([^>]*)><\/script>/;
      const match = html.match(magnetScript);
      if (!match) throw new Error(`No magnets.js script in ${relative(root, full)}`);
      const shellSrc = match[2].replace('scripts/magnets.js', 'scripts/inventory-core-shell.js');
      html = html.replace(match[0], `<script defer src="${shellSrc}"></script>\n    ${match[0]}`);
      changed = true;
    }

    // Static pages that are not generator-owned still need the exact same
    // prefill completeness guard. Keep the board hidden if Menu has no saved
    // position rather than revealing it at (0,0).
    if (!html.includes('hasMissingVisiblePlacement')) {
      const loopNeedle = `          for (var i = 0; i < magnets.length; i += 1) {
`;
      const missingNeedle = `            if (!id || !(id in parsed.magnets)) {
              continue;
            }
`;
      const readyNeedle = `          if (board && (board.dataset || typeof board.setAttribute === 'function')) {
`;
      if (html.includes(loopNeedle) && html.includes(missingNeedle) && html.includes(readyNeedle)) {
        html = html.replace(loopNeedle, `          var hasMissingVisiblePlacement = false;
${loopNeedle}`);
        html = html.replace(missingNeedle, `            if (!id) {
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
`);
        html = html.replace(readyNeedle, `          if (hasMissingVisiblePlacement) {
            if (restoreTransitions) {
              restoreTransitions();
            }
            return;
          }

${readyNeedle}`);
        changed = true;
      }
    }

    if (changed) writeFileSync(full, html);
  }
}

normalizeStaticNavHtml();
console.log('Static shared Menu source repair staged successfully.');
