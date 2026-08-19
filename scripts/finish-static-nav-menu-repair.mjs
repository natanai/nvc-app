import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const write = (path, content) => writeFileSync(join(root, path), content);

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

const migrationBlock = `          // v2 repairs the short-lived first More prototype, which forced the
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

// Generator: Journal is present but hidden in the default board before JS.
{
  const path = 'scripts/build-pages.mjs';
  let text = read(path);
  const lines = text.split('\n');
  const index = lines.findIndex((line) => line.includes('data-magnet-id=\\"nav-journal\\"'));
  if (index < 0) throw new Error('Unable to locate generated Journal magnet');
  const nearby = lines.slice(index, index + 6).join('\n');
  if (!nearby.includes('data-nav-hidden')) {
    lines.splice(index + 1, 0,
      '              data-nav-hidden=\\"true\\"',
      '              aria-hidden=\\"true\\"',
      '              tabindex=\\"-1\\"',
    );
    text = lines.join('\n');
  }
  write(path, text);
}

for (const full of collectHtml(root)) {
  let html = readFileSync(full, 'utf8');
  if (!html.includes('data-magnet-root') || !html.includes('data-magnet-key="site-nav"')) continue;
  const original = html;

  // Keep Journal secondary on a fresh load. Stored user settings can still
  // re-enable it through the existing nav customizer.
  html = html.replace(/(<button\b[^>]*data-magnet-id="nav-journal"[^>]*)(>)/s, (match, start, end) => {
    if (start.includes('data-nav-hidden=')) return match;
    return `${start} data-nav-hidden="true" aria-hidden="true" tabindex="-1"${end}`;
  });
  html = html.replace('            journal: true,', '            journal: false,');

  // Hand-maintained pages need the same one-time repair as generator pages.
  if (!html.includes('allneeds.navMore.v2')) {
    const guard = `          if (!parsed || typeof parsed !== 'object') {
            return;
          }
`;
    if (!html.includes(guard)) {
      throw new Error(`No nav settings parsed guard in ${relative(root, full)}`);
    }
    html = html.replace(guard, guard + '\n' + migrationBlock);
  }

  if (html !== original) writeFileSync(full, html);
}

console.log('Static nav repair gaps closed.');
