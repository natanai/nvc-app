import { readFileSync, writeFileSync } from 'fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  assert(index !== -1, `Missing ${label}`);
  assert(source.indexOf(search, index + search.length) === -1, `Expected one ${label}`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

// 1) Load the tangible More magnet + drawer on every page before magnets.js.
{
  const path = new URL('../assets/js/ui/contrast.js', import.meta.url);
  let source = readFileSync(path, 'utf8');
  const pattern = /\n  function loadInventoryCoreShellBeforeMagnets\(\) \{[\s\S]*?\n  loadInventoryCoreShellBeforeMagnets\(\);\n/;
  const match = source.match(pattern);
  assert(match, 'Missing Inventory core shell bootstrap');

  const replacement = String.raw`
  function loadSharedMoreNavigationBeforeMagnets() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    if (
      document.querySelector('script[data-shared-nav-more-bootstrap]') ||
      document.querySelector('link[data-shared-nav-more-styles]')
    ) {
      return;
    }

    const current = document.currentScript;
    if (!current || !current.src) {
      return;
    }

    let root;
    try {
      root = new URL('../../../', current.src);
    } catch (error) {
      return;
    }

    const styleHref = new URL('styles/inventory-core-shell.css', root).href;
    const scriptSrc = new URL('scripts/inventory-core-shell.js', root).href;

    if (document.readyState === 'loading' && typeof document.write === 'function') {
      document.write(
        '<link rel="stylesheet" href="' + styleHref + '" data-shared-nav-more-styles="true">' +
        '<script defer src="' + scriptSrc + '" data-shared-nav-more-bootstrap="true"><\\/script>'
      );
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = styleHref;
    link.dataset.sharedNavMoreStyles = 'true';
    link.setAttribute('blocking', 'render');
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.defer = true;
    script.dataset.sharedNavMoreBootstrap = 'true';
    document.head.appendChild(script);
  }

  loadSharedMoreNavigationBeforeMagnets();
`;

  source = source.replace(pattern, replacement);
  writeFileSync(path, source);
}

// 2) Make the magnet engine's mobile canonical order match the new shared board.
{
  const path = new URL('./magnets.js', import.meta.url);
  let source = readFileSync(path, 'utf8');
  const oldOrder = `const NAV_MOBILE_ORDER_IDS = [\n  'nav-home',\n  'nav-customizer',\n  'nav-journal',\n  'nav-observations',\n  'nav-feelings',\n  'nav-needs',\n  'nav-inventory',\n];`;
  const newOrder = `const NAV_MOBILE_ORDER_IDS = [\n  'nav-menu',\n  'nav-home',\n  'nav-observations',\n  'nav-feelings',\n  'nav-needs',\n  'nav-customizer',\n  'nav-journal',\n  'nav-inventory',\n];`;
  source = replaceOnce(source, oldOrder, newOrder, 'mobile nav order');
  writeFileSync(path, source);
}

// 3) The More stylesheet is now loaded globally before paint; do not import it
// a second time from the Inventory-only mobile stylesheet.
{
  const path = new URL('../styles/inventory-mobile.css', import.meta.url);
  let source = readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    "@import url('./inventory-core-shell.css');\n\n",
    '',
    'Inventory duplicate More stylesheet import',
  );
  writeFileSync(path, source);
}

console.log('Shared persistent More magnet integration applied.');
