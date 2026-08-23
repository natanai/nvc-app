import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const read = path => readFileSync(join(root, path), 'utf8');
const write = (path, content) => writeFileSync(join(root, path), content.replace(/\r\n/g, '\n'));

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error(`Unbalanced CSS/function block near ${openIndex}`);
}

function splitPhoneMedia(source, threshold = 759) {
  const ranges = [];
  const inners = [];
  let cursor = 0;
  while (cursor < source.length) {
    const at = source.indexOf('@media', cursor);
    if (at === -1) break;
    const open = source.indexOf('{', at);
    if (open === -1) break;
    const prelude = source.slice(at, open);
    const match = prelude.match(/max-width\s*:\s*(\d+)px/i);
    const end = findMatchingBrace(source, open);
    if (match && Number(match[1]) <= threshold && !/min-width/i.test(prelude)) {
      ranges.push([at, end + 1]);
      inners.push(source.slice(open + 1, end));
    }
    cursor = end + 1;
  }

  let base = source;
  for (const [start, end] of ranges.reverse()) {
    base = `${base.slice(0, start)}${base.slice(end)}`;
  }
  return { base: base.replace(/\n{3,}/g, '\n\n').trim(), inners };
}

function extractOuterMediaInner(source) {
  const at = source.indexOf('@media');
  if (at === -1) throw new Error('Observations mobile stylesheet has no media block');
  const open = source.indexOf('{', at);
  const end = findMatchingBrace(source, open);
  return source.slice(open + 1, end);
}

function normalizeSelector(selector) {
  return selector.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
}

function parseDeclarations(body) {
  const props = new Map();
  for (const raw of body.split(';')) {
    const chunk = raw.trim();
    if (!chunk) continue;
    const colon = chunk.indexOf(':');
    if (colon <= 0) continue;
    const property = chunk.slice(0, colon).trim();
    const value = chunk.slice(colon + 1).trim();
    props.set(property, value);
  }
  return props;
}

function parseTopLevelRules(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = new Map();
  const order = [];
  const rawAtRules = [];
  let cursor = 0;
  while (cursor < css.length) {
    while (/\s/.test(css[cursor] || '')) cursor += 1;
    if (cursor >= css.length) break;
    const open = css.indexOf('{', cursor);
    if (open === -1) break;
    const prelude = css.slice(cursor, open).trim();
    const end = findMatchingBrace(css, open);
    const body = css.slice(open + 1, end);
    if (prelude.startsWith('@')) {
      rawAtRules.push(`${prelude} {${body}}`);
    } else if (prelude) {
      const key = normalizeSelector(prelude);
      if (!rules.has(key)) {
        rules.set(key, { selector: prelude, props: new Map() });
        order.push(key);
      }
      const entry = rules.get(key);
      for (const [property, value] of parseDeclarations(body)) entry.props.set(property, value);
    }
    cursor = end + 1;
  }
  return { rules, order, rawAtRules };
}

function setRule(model, selector, declarations) {
  const key = normalizeSelector(selector);
  if (!model.rules.has(key)) {
    model.rules.set(key, { selector, props: new Map() });
    model.order.push(key);
  }
  const entry = model.rules.get(key);
  entry.selector = selector;
  entry.props = new Map(Object.entries(declarations));
}

function deleteRule(model, selector) {
  const key = normalizeSelector(selector);
  model.rules.delete(key);
  model.order = model.order.filter(candidate => candidate !== key);
}

function renderRules(model) {
  const chunks = [];
  for (const key of model.order) {
    const entry = model.rules.get(key);
    if (!entry) continue;
    const declarations = [...entry.props.entries()].map(([property, value]) => `    ${property}: ${value};`).join('\n');
    chunks.push(`  ${entry.selector} {\n${declarations}\n  }`);
  }
  for (const raw of model.rawAtRules) chunks.push(`  ${raw}`);
  return chunks.join('\n\n');
}

function replaceFunction(source, name, replacement) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`Unable to find function ${name}`);
  const open = source.indexOf('{', start);
  const end = findMatchingBrace(source, open);
  return `${source.slice(0, start)}${replacement.trim()}${source.slice(end + 1)}`;
}

function replaceTestBlock(source, title, replacement) {
  const marker = `test('${title}'`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Unable to find test ${title}`);
  const next = source.indexOf('\ntest(', start + marker.length);
  const end = next === -1 ? source.length : next + 1;
  return `${source.slice(0, start)}${replacement.trim()}\n\n${source.slice(end)}`;
}

// 1. Collapse the two Observations presentation files into one route owner.
const critical = read('styles/observations-critical.css');
const mobile = read('styles/observations-mobile.css');
const split = splitPhoneMedia(critical, 759);
const phoneSource = `${split.inners.join('\n')}\n${extractOuterMediaInner(mobile)}`;
const phone = parseTopLevelRules(phoneSource);

for (const key of [...phone.order]) {
  if (key.includes('.observation-editor__field >')) {
    phone.rules.delete(key);
    phone.order = phone.order.filter(candidate => candidate !== key);
  }
}

// Shared native-app values mirror the existing Journal metadata groups and
// Inventory segmented controls rather than inventing a third visual language.
setRule(phone, 'body:has(#main.observations-page) .breadcrumbs', {
  display: 'none',
});
setRule(phone, 'body:has(#main.observations-page) .page-wrapper', {
  width: '100%',
  gap: '0.45rem',
});
setRule(phone, 'body:has(#main.observations-page) #main.observations-page', {
  width: 'calc(100% + 2rem)',
  'max-width': 'none',
  margin: '0 -1rem',
  padding: '0.45rem max(0.78rem, env(safe-area-inset-right)) max(1.25rem, env(safe-area-inset-bottom)) max(0.78rem, env(safe-area-inset-left))',
  gap: '0.72rem',
  border: '0',
  'border-radius': '0',
  background: 'var(--obs-screen-bg)',
  'box-shadow': 'none',
});
setRule(phone, '#main.observations-page .observations-header', {
  gap: '0.22rem',
  'padding-inline': '0.1rem',
});
setRule(phone, '#main.observations-page .observations-header__title-row', {
  'min-height': '44px',
  gap: '0.5rem',
});
setRule(phone, '#main.observations-page .observations-title', {
  'font-size': 'clamp(1.55rem, 8vw, 1.9rem)',
  'line-height': '1.05',
  'letter-spacing': '-0.025em',
  'text-transform': 'none',
});
setRule(phone, '#main.observations-page .observations-description', {
  'font-size': '0.82rem',
  'line-height': '1.38',
  color: 'var(--obs-secondary)',
});
setRule(phone, '#main.observations-page .observation-info-button', {
  width: '44px',
  height: '44px',
  'min-width': '44px',
  'min-height': '44px',
  border: '1px solid var(--obs-group-border)',
  background: 'var(--obs-group-bg)',
  'box-shadow': 'none',
  transform: 'none',
});
setRule(phone, '#main.observations-page .observation-info-button--subtle', {
  'border-color': 'transparent',
  background: 'transparent',
  'box-shadow': 'none',
});
setRule(phone, '#main.observations-page .observation-editor__card,\n  #main.observations-page .observation-editor__grid,\n  #main.observations-page .observation-editor__field', {
  gap: '0.68rem',
});
setRule(phone, '#main.observations-page .observation-editor__label-row', {
  gap: '0.35rem',
});
setRule(phone, '#main.observations-page .observation-editor__label', {
  'font-size': '0.74rem',
  'line-height': '1.2',
  'letter-spacing': '0.065em',
  color: 'var(--obs-secondary)',
});
setRule(phone, '#main.observations-page .observation-editor__input-wrapper', {
  '--observation-editor-padding-block': '0.82rem',
  '--observation-editor-padding-inline': '0.86rem',
  '--observation-editor-font-size': '17px',
  '--observation-editor-line-height': '1.48',
  border: '1px solid var(--obs-group-border)',
  'border-radius': 'var(--radius-xl)',
  background: 'var(--obs-group-bg)',
  'box-shadow': 'none',
});
setRule(phone, '#main.observations-page .observation-editor__input-wrapper:focus-within', {
  'border-color': 'var(--obs-focus)',
  'box-shadow': '0 0 0 2px color-mix(in srgb, var(--plum) 18%, transparent)',
});
setRule(phone, '#main.observations-page .observation-editor__input', {
  'min-height': '10.5rem',
});

setRule(phone, '#main.observations-page .observation-editor__slot-header', {
  'min-height': '44px',
  margin: '0.1rem 0 0',
  'padding-inline': '0.12rem 0',
  gap: '0.35rem',
});
setRule(phone, '#main.observations-page .observation-editor__slot-heading', {
  'font-size': '0.72rem',
  'line-height': '1.2',
  'letter-spacing': '0.075em',
  color: 'var(--obs-secondary)',
});
setRule(phone, '#main.observations-page .observation-editor__slot-row', {
  display: 'grid',
  gap: '0',
  margin: '0',
  padding: '0 0.76rem',
  border: '1px solid var(--obs-group-border)',
  'border-radius': 'var(--radius-xl)',
  background: 'var(--obs-group-bg)',
  overflow: 'hidden',
  'box-shadow': 'none',
});
setRule(phone, '#main.observations-page .observation-editor__slot', {
  width: '100%',
  'min-height': '50px',
  padding: '0.58rem 0.08rem',
  gap: '0.62rem',
  border: '0',
  'border-radius': '0',
  background: 'transparent',
});
setRule(phone, '#main.observations-page .observation-editor__slot + .observation-editor__slot', {
  'border-top': '1px solid var(--obs-separator)',
});
setRule(phone, '#main.observations-page .observation-editor__slot-indicator', {
  width: '0.72rem',
  height: '0.72rem',
  'box-shadow': '0 0 0 3px color-mix(in srgb, var(--outline) 7%, transparent)',
});
setRule(phone, '#main.observations-page .observation-editor__slot-label', {
  'font-size': '0.94rem',
  'line-height': '1.28',
  'font-weight': '650',
  'letter-spacing': '0',
  color: 'var(--ink)',
});

// One disclosure grammar: grouped surface + trailing chevron. No plus circles,
// literal v glyphs, or unrelated card treatments for equivalent interactions.
setRule(phone, '#main.observations-page .observation-editor__example', {
  display: 'grid',
  gap: '0',
  border: '1px solid var(--obs-group-border)',
  'border-radius': 'var(--radius-xl)',
  background: 'var(--obs-group-bg)',
  overflow: 'hidden',
  'box-shadow': 'none',
});
setRule(phone, '#main.observations-page .observation-editor__example-toggle', {
  width: '100%',
  'min-height': '52px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '0.65rem',
  padding: '0.68rem 0.76rem',
  border: '0',
  'border-radius': '0',
  background: 'transparent',
  'box-shadow': 'none',
  color: 'var(--ink)',
  'font-size': '0.92rem',
  'font-weight': '700',
  'line-height': '1.2',
  'text-align': 'left',
});
setRule(phone, '#main.observations-page .observation-editor__example-toggle::after', {
  content: "'›'",
  'flex': '0 0 auto',
  'font-size': '1.35rem',
  'font-weight': '500',
  'line-height': '1',
  color: 'var(--obs-secondary)',
  transition: 'transform 0.16s ease',
});
setRule(phone, "#main.observations-page .observation-editor__example-toggle[aria-expanded='true']::after", {
  transform: 'rotate(90deg)',
});
setRule(phone, '#main.observations-page .observation-editor__example-body', {
  padding: '0.72rem 0.76rem',
  gap: '0.55rem',
  border: '0',
  'border-top': '1px solid var(--obs-separator)',
  'border-radius': '0',
  background: 'transparent',
  'box-shadow': 'none',
});
setRule(phone, '#main.observations-page .observation-editor__example-text', {
  'font-size': '0.88rem',
  'line-height': '1.45',
});
setRule(phone, '#main.observations-page .observation-editor__example-apply', {
  'min-height': '44px',
  padding: '0.45rem 0.72rem',
  border: '1px solid var(--obs-group-border)',
  'border-radius': 'var(--radius-md)',
  background: 'color-mix(in srgb, #ffffff 80%, var(--mint) 20%)',
  'box-shadow': 'none',
  'font-size': '0.82rem',
  'font-weight': '700',
});

setRule(phone, '#main.observations-page .observation-editor__recipe', {
  'min-height': '52px',
  padding: '0',
  display: 'grid',
  'grid-template-columns': 'minmax(0, 1fr) 44px',
  gap: '0',
  border: '1px solid var(--obs-group-border)',
  'border-radius': 'var(--radius-xl)',
  background: 'var(--obs-group-bg)',
  overflow: 'hidden',
  'box-shadow': 'none',
});
setRule(phone, '#main.observations-page .observation-editor__recipe-title', {
  'grid-column': '1',
  'grid-row': '1',
  'align-self': 'center',
  margin: '0',
  padding: '0.68rem 0.76rem',
  'font-size': '0.92rem',
  'font-weight': '700',
  'line-height': '1.2',
  'letter-spacing': '0',
  'text-transform': 'none',
});
setRule(phone, '#main.observations-page .observation-editor__recipe-toggle', {
  'grid-column': '2',
  'grid-row': '1',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '44px',
  height: '52px',
  'min-width': '44px',
  'min-height': '44px',
  margin: '0',
  padding: '0',
  border: '0',
  'border-radius': '0',
  background: 'transparent',
  'box-shadow': 'none',
});
setRule(phone, '#main.observations-page .observation-editor__recipe-toggle::before', {
  content: "'›'",
  'font-size': '1.35rem',
  'font-weight': '500',
  'line-height': '1',
  color: 'var(--obs-secondary)',
  transition: 'transform 0.16s ease',
});
setRule(phone, "#main.observations-page .observation-editor__recipe-toggle[aria-expanded='true']::before", {
  transform: 'rotate(90deg)',
});
setRule(phone, '#main.observations-page .observation-editor__recipe-body', {
  'grid-column': '1 / -1',
  display: 'grid',
  gap: '0.55rem',
  padding: '0.72rem 0.76rem',
  'border-top': '1px solid var(--obs-separator)',
  background: 'transparent',
});
setRule(phone, "#main.observations-page .observation-editor__recipe[data-collapsed='true'] .observation-editor__recipe-body", {
  display: 'none',
});

// Result hierarchy: exact/nearby is post-load provenance, not a pre-load card.
setRule(phone, '#main.observations-page .observation-suggestions', {
  gap: '0.62rem',
  'padding-block': '0',
});
setRule(phone, "#main.observations-page .observation-suggestions[data-mode='editing']", {
  gap: '0',
  'padding-block': '0',
});
setRule(phone, "#main.observations-page .observation-suggestions[data-mode='editing'] .observation-suggestions__header", {
  gap: '0',
});
setRule(phone, "#main.observations-page .observation-suggestions[data-mode='editing'] .observation-suggestions__action-row", {
  display: 'grid',
  'grid-template-columns': 'minmax(0, 1fr)',
  gap: '0',
});
setRule(phone, "#main.observations-page .observation-suggestions[data-mode='editing'] .observation-suggestions__clear", {
  display: 'none',
});
setRule(phone, "#main.observations-page .observation-suggestions[data-mode='editing'] .observation-suggestions__action", {
  width: '100%',
  'min-height': '52px',
  padding: '0.6rem 0.8rem',
  border: '1px solid var(--obs-group-border)',
  'border-radius': 'var(--radius-xl)',
  background: 'color-mix(in srgb, #ffffff 72%, var(--gold) 28%)',
  'box-shadow': 'none',
  color: 'var(--ink)',
  'font-size': '0.96rem',
  'font-weight': '700',
  'letter-spacing': '0',
  'text-transform': 'none',
});
setRule(phone, "#main.observations-page .observation-suggestions[data-mode='results']", {
  gap: '0.62rem',
  'padding-block': '0.18rem 0',
  'border-top': '0',
});
setRule(phone, '#main.observations-page .observation-suggestions__header', {
  display: 'grid',
  gap: '0.5rem',
});
setRule(phone, '#main.observations-page .observation-suggestions__title', {
  'font-size': '1.06rem',
  'line-height': '1.18',
  'letter-spacing': '-0.01em',
});
setRule(phone, '#main.observations-page .observation-suggestions__preview', {
  display: '-webkit-box',
  margin: '0',
  overflow: 'hidden',
  '-webkit-box-orient': 'vertical',
  '-webkit-line-clamp': '2',
  'font-size': '0.78rem',
  'line-height': '1.4',
  color: 'var(--obs-secondary)',
});
setRule(phone, '#main.observations-page .observation-editor__match-summary', {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '0.35rem',
  margin: '0.08rem 0 0',
  padding: '0',
  border: '0',
  'border-radius': '0',
  background: 'transparent',
  'box-shadow': 'none',
  'font-size': '0.74rem',
  color: 'var(--obs-secondary)',
});
setRule(phone, '#main.observations-page .observation-editor__match-summary[hidden]', {
  display: 'none',
});
setRule(phone, '#main.observations-page .observation-editor__match-summary-main', {
  order: '2',
  display: 'flex',
  'align-items': 'center',
  'margin-left': 'auto',
});
setRule(phone, '#main.observations-page .observation-editor__match-summary-note', {
  display: 'none',
});
setRule(phone, '#main.observations-page .observation-editor__match-summary-main .observation-info-button', {
  border: '0',
  background: 'transparent',
  'box-shadow': 'none',
});
setRule(phone, '#main.observations-page .observation-editor__match-summary-chips', {
  order: '1',
  display: 'flex',
  'align-items': 'center',
  gap: '0.32rem',
});
setRule(phone, '#main.observations-page .observation-editor__match-summary-row', {
  display: 'inline-flex',
  'align-items': 'center',
  'min-height': '0',
  padding: '0',
  border: '0',
  'border-radius': '0',
  background: 'transparent',
  'box-shadow': 'none',
});
setRule(phone, '#main.observations-page .observation-editor__match-summary-row + .observation-editor__match-summary-row::before', {
  content: "'•'",
  'margin-right': '0.32rem',
  color: 'color-mix(in srgb, var(--ink-soft) 52%, transparent)',
});
setRule(phone, '#main.observations-page .observation-suggestions__action-row', {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'flex-end',
  gap: '0.35rem',
});
setRule(phone, "#main.observations-page .observation-suggestions__action[data-action='done']", {
  display: 'none',
});
setRule(phone, '#main.observations-page .observation-suggestions__clear', {
  'min-width': '44px',
  'min-height': '44px',
  padding: '0.34rem 0.16rem',
  border: '0',
  'border-radius': 'var(--radius-md)',
  background: 'transparent',
  'box-shadow': 'none',
  color: 'var(--obs-secondary)',
  'font-size': '0.78rem',
  'font-weight': '700',
  'letter-spacing': '0',
  'text-transform': 'none',
});
setRule(phone, '#main.observations-page .observation-feelings-toggle', {
  width: '100%',
});
setRule(phone, '#main.observations-page .need-status-toggle', {
  display: 'grid',
  'grid-template-columns': 'repeat(2, minmax(0, 1fr))',
  width: '100%',
  'min-height': '42px',
  padding: '3px',
  border: '1px solid var(--obs-group-border)',
  'border-radius': 'var(--radius-xl)',
  background: 'color-mix(in srgb, #ffffff 54%, var(--lavender) 46%)',
  'box-shadow': 'inset 0 1px 2px color-mix(in srgb, var(--outline) 8%, transparent)',
  overflow: 'hidden',
});
setRule(phone, '#main.observations-page .need-status-toggle__option', {
  'min-height': '38px',
  padding: '0.34rem 0.5rem',
  border: '0',
  'border-radius': 'calc(var(--radius-xl) - 3px)',
  background: 'transparent',
  color: 'var(--obs-secondary)',
  'font-size': '0.82rem',
  'font-weight': '700',
  'box-shadow': 'none',
  transform: 'none',
});
setRule(phone, '#main.observations-page .need-status-toggle__option--active', {
  background: '#ffffff',
  color: 'var(--ink)',
  'box-shadow': '0 1px 2px color-mix(in srgb, var(--outline) 10%, transparent), 0 2px 7px color-mix(in srgb, var(--outline) 10%, transparent)',
});
setRule(phone, '#main.observations-page .observation-panel', {
  gap: '0.48rem',
  padding: '0.7rem 0.74rem',
  border: '1px solid var(--obs-group-border)',
  'border-radius': 'var(--radius-xl)',
  background: 'var(--obs-group-bg)',
  'box-shadow': 'none',
});
setRule(phone, '#main.observations-page .observation-panel--needs,\n  #main.observations-page .observation-panel--feelings', {
  'border-color': 'var(--obs-group-border)',
  background: 'var(--obs-group-bg)',
});
setRule(phone, '#main.observations-page .observation-panel__title', {
  'font-size': '0.8rem',
  'font-weight': '750',
  'letter-spacing': '0',
  'text-transform': 'none',
  color: 'var(--obs-secondary)',
});
setRule(phone, '#main.observations-page .observation-chip-list', {
  gap: '0.34rem',
});
setRule(phone, '#main.observations-page .observation-chip', {
  'min-height': '44px',
  padding: '0.34rem 0.6rem',
  border: '1px solid color-mix(in srgb, var(--outline) 20%, transparent)',
  'border-radius': 'var(--radius-pill)',
  background: 'color-mix(in srgb, #ffffff 94%, var(--sky) 6%)',
  'box-shadow': 'none',
  'font-size': '0.82rem',
  'font-weight': '650',
});
setRule(phone, '#main.observations-page .observation-suggestions__why-details', {
  padding: '0',
  border: '1px solid var(--obs-group-border)',
  'border-radius': 'var(--radius-xl)',
  background: 'var(--obs-group-bg)',
  'box-shadow': 'none',
  overflow: 'hidden',
});
setRule(phone, '#main.observations-page .observation-suggestions__why-toggle', {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '0.65rem',
  'min-height': '52px',
  padding: '0.68rem 0.76rem',
  'font-size': '0.9rem',
  'font-weight': '700',
  'line-height': '1.2',
  background: 'transparent',
});
setRule(phone, '#main.observations-page .observation-suggestions__why-toggle::after', {
  content: "'›'",
  'flex': '0 0 auto',
  'font-size': '1.35rem',
  'font-weight': '500',
  'line-height': '1',
  color: 'var(--obs-secondary)',
  transition: 'transform 0.16s ease',
});
setRule(phone, '#main.observations-page .observation-suggestions__why-details[open] .observation-suggestions__why-toggle::after', {
  transform: 'rotate(90deg)',
});
setRule(phone, '#main.observations-page .observation-suggestions__why', {
  margin: '0',
  padding: '0.72rem 0.76rem',
  'border-top': '1px solid var(--obs-separator)',
  'font-size': '0.82rem',
  'line-height': '1.45',
  color: 'var(--obs-secondary)',
});
setRule(phone, '#main.observations-page .observation-suggestions__links', {
  gap: '0.32rem',
  'padding-inline': '0.1rem',
  'font-size': '0.78rem',
  'line-height': '1.35',
  color: 'var(--obs-secondary)',
});

// Top-level learning disclosures use the same grouped-row language.
setRule(phone, '#main.observations-page .observation-overview__details,\n  #main.observations-page .observation-guide', {
  border: '1px solid var(--obs-group-border)',
  'border-radius': 'var(--radius-xl)',
  background: 'var(--obs-group-bg)',
  'box-shadow': 'none',
  overflow: 'hidden',
});
setRule(phone, '#main.observations-page .observation-overview__summary,\n  #main.observations-page .observation-guide__toggle', {
  'min-height': '52px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '0.65rem',
  padding: '0.68rem 0.76rem',
  background: 'transparent',
  'box-shadow': 'none',
});
setRule(phone, '#main.observations-page .observation-overview__title,\n  #main.observations-page .observation-guide__toggle-title', {
  'font-size': '0.92rem',
  'line-height': '1.2',
  'letter-spacing': '0',
  'text-transform': 'none',
});
setRule(phone, '#main.observations-page .observation-overview__subtitle,\n  #main.observations-page .observation-guide__eyebrow', {
  'font-size': '0.68rem',
  'line-height': '1.2',
  'letter-spacing': '0.08em',
  color: 'var(--obs-secondary)',
});
setRule(phone, '#main.observations-page .observation-overview__summary-icon,\n  #main.observations-page .observation-guide__toggle-icon', {
  width: 'auto',
  height: 'auto',
  'min-width': '0',
  'min-height': '0',
  'margin-left': 'auto',
  border: '0',
  'border-radius': '0',
  background: 'transparent',
  color: 'var(--obs-secondary)',
  'font-size': '1.35rem',
  'font-weight': '500',
  'line-height': '1',
  'box-shadow': 'none',
  transition: 'transform 0.16s ease',
});
setRule(phone, '#main.observations-page .observation-overview__details[open] .observation-overview__summary-icon,\n  #main.observations-page .observation-guide[open] .observation-guide__toggle-icon', {
  transform: 'rotate(90deg)',
  background: 'transparent',
});
setRule(phone, '#main.observations-page .observation-overview__body,\n  #main.observations-page .observation-guide__card', {
  padding: '0.72rem 0.76rem',
  gap: '0.65rem',
  'border-top': '1px solid var(--obs-separator)',
  background: 'transparent',
});
setRule(phone, '#main.observations-page .observation-guide__desktop', {
  display: 'none',
});
setRule(phone, '#main.observations-page .observation-guide__mobile', {
  display: 'grid',
  gap: '0',
});
setRule(phone, '#main.observations-page .observation-guide__mobile-intro,\n  #main.observations-page .observation-guide__mobile-footer', {
  padding: '0.62rem 0.1rem',
  border: '0',
  background: 'transparent',
  'box-shadow': 'none',
});
setRule(phone, '#main.observations-page .observation-guide__mobile-panel', {
  margin: '0',
  border: '0',
  'border-top': '1px solid var(--obs-separator)',
  'border-radius': '0',
  background: 'transparent',
  'box-shadow': 'none',
  overflow: 'hidden',
});
setRule(phone, '#main.observations-page .observation-guide__mobile-panel + .observation-guide__mobile-panel', {
  'margin-top': '0',
});
setRule(phone, '#main.observations-page .observation-guide__mobile-summary', {
  'min-height': '48px',
  padding: '0.62rem 2rem 0.62rem 0.1rem',
  gap: '0.18rem',
});
setRule(phone, '#main.observations-page .observation-guide__mobile-summary::after', {
  content: "'›'",
  right: '0.1rem',
  width: 'auto',
  height: 'auto',
  border: '0',
  'border-radius': '0',
  background: 'transparent',
  color: 'var(--obs-secondary)',
  'font-size': '1.25rem',
  'font-weight': '500',
  transform: 'translateY(-50%)',
});
setRule(phone, '#main.observations-page .observation-guide__mobile-panel[open] .observation-guide__mobile-summary::after', {
  transform: 'translateY(-50%) rotate(90deg)',
});
setRule(phone, '#main.observations-page .observation-guide__mobile-content', {
  gap: '0.5rem',
  padding: '0.1rem 0.1rem 0.68rem',
  'font-size': '0.82rem',
  'line-height': '1.45',
});

setRule(phone, '#main.observations-page .observation-editor__footer', {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'stretch',
  gap: '0.55rem',
  'padding-top': '0',
});
setRule(phone, '#main.observations-page .observation-editor__status', {
  width: '100%',
  'margin-left': '0',
  gap: '0.5rem',
});
setRule(phone, "#main.observations-page #observation-validity-container[data-state='idle'],\n  #main.observations-page #observation-validity-container[data-state='pending'],\n  #main.observations-page #observation-validity-container[data-state='valid']", {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  'white-space': 'nowrap',
  border: '0',
});
setRule(phone, "#main.observations-page #observation-validity-container[data-state='invalid'],\n  #main.observations-page #observation-validity-container[data-state='error']", {
  padding: '0.52rem 0.68rem',
  border: '1px solid color-mix(in srgb, var(--rose) 42%, var(--obs-group-border))',
  'border-radius': 'var(--radius-md)',
  background: 'color-mix(in srgb, #ffffff 84%, var(--rose) 16%)',
  'font-size': '0.8rem',
  'line-height': '1.35',
});
setRule(phone, '#main.observations-page .observation-editor__next-link--cta', {
  width: '100%',
  'min-height': '52px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  padding: '0.68rem 0.76rem',
  border: '1px solid var(--obs-group-border)',
  'border-radius': 'var(--radius-xl)',
  background: 'var(--obs-group-bg)',
  'box-shadow': 'none',
  color: 'var(--ink)',
  'font-size': '0.88rem',
  'font-weight': '700',
  'letter-spacing': '0',
  'text-transform': 'none',
});
setRule(phone, '#main.observations-page .observation-editor__next-link--cta::after', {
  content: "'›'",
  'font-size': '1.35rem',
  'font-weight': '500',
  'line-height': '1',
  color: 'var(--obs-secondary)',
});

setRule(phone, '#main.observations-page .observation-info-dialog', {
  inset: 'auto 0 0 0',
  width: '100%',
  'max-width': 'none',
  'max-height': 'calc(100dvh - 1rem)',
  margin: '0',
  'border-radius': 'var(--radius-3xl) var(--radius-3xl) 0 0',
});
setRule(phone, '#main.observations-page .observation-info-dialog__sheet', {
  'padding-bottom': 'env(safe-area-inset-bottom, 0)',
  'border-bottom': '0',
  'border-radius': 'inherit',
});
setRule(phone, '#main.observations-page .observation-info-dialog__header', {
  padding: '0.72rem 0.78rem 0.55rem',
});
setRule(phone, '#main.observations-page .observation-info-dialog__body', {
  gap: '0.58rem',
  padding: '0.72rem max(0.78rem, env(safe-area-inset-right)) calc(0.82rem + env(safe-area-inset-bottom, 0px)) max(0.78rem, env(safe-area-inset-left))',
});

// Remove now-obsolete mobile-specific style fragments whose state is covered by
// the normalized rules above.
for (const selector of [
  '#main.observations-page .observation-suggestions__action:disabled',
  '#main.observations-page .observation-suggestions__action:not(:disabled)',
  '#main.observations-page .observation-suggestions__action:not(:disabled)::after',
  '#main.observations-page .observation-guide__toggle-text',
]) deleteRule(phone, selector);

let base = split.base;
base = base.replace(
  '.observations-page {',
  `.observations-page {\n    --obs-screen-bg: color-mix(in srgb, var(--lavender) 92%, #ffffff 8%);\n    --obs-group-bg: color-mix(in srgb, #ffffff 96%, var(--lavender) 4%);\n    --obs-group-border: color-mix(in srgb, var(--outline) 16%, transparent);\n    --obs-separator: color-mix(in srgb, var(--outline) 10%, transparent);\n    --obs-secondary: color-mix(in srgb, var(--ink-soft) 72%, transparent);\n    --obs-focus: color-mix(in srgb, var(--plum) 62%, #ffffff);`,
);

const unifiedCss = `/* Observations route presentation owner.\n   This is the single route-specific stylesheet for /observations/ on desktop and phone.\n   Shared site chrome still comes from the global stylesheets, but no second Observations\n   critical/mobile layer is allowed to restyle this route. Phone rules live in the one\n   <=640px block at the end and borrow the Journal/Inventory native-app grammar. */\n\n${base}\n\n/* Native phone presentation: hierarchy first, grouped surfaces, one disclosure grammar. */\n@media (max-width: 640px) {\n${renderRules(phone)}\n}\n`;
write('styles/observations.css', unifiedCss);

// 2. Make parser discovery explicit and leave the inline critical region nav-only.
let guide = read('scripts/observation-guide.mjs');
guide = guide.replace("const observationsCriticalCssPath = join(rootDir, 'styles', 'observations-critical.css');\n", '');
guide = guide.replace(
  "const SHARED_NAV_PREFILL_END = '<!-- shared-nav-prefill:end -->';\n",
  "const SHARED_NAV_PREFILL_END = '<!-- shared-nav-prefill:end -->';\nconst OBSERVATIONS_STYLESHEET_LINK = '    <link rel=\"stylesheet\" href=\"../styles/observations.css\" />';\nconst LEGACY_OBSERVATIONS_MOBILE_LINK = '    <link rel=\"stylesheet\" href=\"../styles/observations-mobile.css\" media=\"(max-width: 640px)\" />';\n",
);
guide = guide.replace("  const observationsCriticalCss = readFileSync(observationsCriticalCssPath, 'utf8').trim();\n", '');
guide = guide.replace(
  '`<style>${navCriticalCss}\\n${observationsCriticalCss}</style>`',
  '`<style>${navCriticalCss}</style>`',
);
guide = guide.replace(
  "  updated = replaceOwnedRegion(\n    updated,\n    SHARED_NAV_PREFILL_START,",
  "  updated = updated.replace(`${LEGACY_OBSERVATIONS_MOBILE_LINK}\\n`, '');\n  if (!updated.includes(OBSERVATIONS_STYLESHEET_LINK)) {\n    const sharedStylesheetLink = '    <link rel=\"stylesheet\" href=\"../styles.css\" fetchpriority=\"high\" />';\n    if (!updated.includes(sharedStylesheetLink)) {\n      throw new Error('Unable to locate styles.css link while installing the Observations route stylesheet');\n    }\n    updated = updated.replace(sharedStylesheetLink, `${sharedStylesheetLink}\\n${OBSERVATIONS_STYLESHEET_LINK}`);\n  }\n  updated = replaceOwnedRegion(\n    updated,\n    SHARED_NAV_PREFILL_START,",
);
guide = guide.replace(
  '<span class="observation-guide__toggle-icon" aria-hidden="true">+</span>',
  '<span class="observation-guide__toggle-icon" aria-hidden="true">›</span>',
);
write('scripts/observation-guide.mjs', guide);

// 3. Make task order real DOM order and place match provenance inside the loaded-result heading.
let html = read('observations/index.html');
html = html.replace('    <link rel="stylesheet" href="../styles/observations-mobile.css" media="(max-width: 640px)" />\n', '');
if (!html.includes('href="../styles/observations.css"')) {
  html = html.replace(
    '    <link rel="stylesheet" href="../styles.css" fetchpriority="high" />',
    '    <link rel="stylesheet" href="../styles.css" fetchpriority="high" />\n    <link rel="stylesheet" href="../styles/observations.css" />',
  );
}
html = html.replace(
  '<section id="observation-editor" class="observation-editor" aria-label="Observation editor">',
  '<section id="observation-editor" class="observation-editor" aria-label="Observation editor" data-mode="editing">',
);
html = html.replace(
  '<section id="observation-suggestions" class="observation-suggestions" aria-live="polite">',
  '<section id="observation-suggestions" class="observation-suggestions" aria-live="polite" data-mode="editing">',
);

const summaryStart = html.indexOf('                <div\n                  id="observation-detection-summary"');
const issuesStart = html.indexOf('                <ul id="observation-issues"', summaryStart);
if (summaryStart === -1 || issuesStart === -1) throw new Error('Unable to locate Observation match-summary block');
let summaryBlock = html.slice(summaryStart, issuesStart);
summaryBlock = summaryBlock.replace('                  aria-live="polite"\n                >', '                  aria-live="polite"\n                  hidden\n                >');
html = `${html.slice(0, summaryStart)}${html.slice(issuesStart)}`;

const suggestionsStart = html.indexOf('                <ul id="observation-issues"');
const fieldEndMarker = '\n              </div>\n              <aside\n                class="observation-editor__recipe"';
const fieldEnd = html.indexOf(fieldEndMarker, suggestionsStart);
if (suggestionsStart === -1 || fieldEnd === -1) throw new Error('Unable to locate Observation suggestions range');
let suggestionsBlock = html.slice(suggestionsStart, fieldEnd);
html = `${html.slice(0, suggestionsStart)}${html.slice(fieldEnd)}`;

const previewMarker = '                      <p id="observation-preview" class="observation-suggestions__preview"></p>\n';
if (!suggestionsBlock.includes(previewMarker)) throw new Error('Unable to locate Observation preview marker');
const nestedSummary = summaryBlock.replace(/^ {16}/gm, '                      ');
suggestionsBlock = suggestionsBlock.replace(previewMarker, `${previewMarker}${nestedSummary}`);

const inputToQuickCheck = '                  ></textarea>\n                </div>\n                <div class="observation-editor__slot-header">';
if (!html.includes(inputToQuickCheck)) throw new Error('Unable to locate input-to-Quick-Check boundary');
html = html.replace(
  inputToQuickCheck,
  `                  ></textarea>\n                </div>\n${suggestionsBlock}                <div class="observation-editor__slot-header">`,
);
html = html.replace(
  '<span class="observation-overview__summary-icon" aria-hidden="true">+</span>',
  '<span class="observation-overview__summary-icon" aria-hidden="true">›</span>',
);
html = html.replace(
  '<span class="observation-guide__toggle-icon" aria-hidden="true">+</span>',
  '<span class="observation-guide__toggle-icon" aria-hidden="true">›</span>',
);
write('observations/index.html', html);

// 4. Exact/nearby counts come from the same loaded direct-result/fallback state that renders the chips.
let editor = read('assets/js/observation-editor.js');
editor = replaceFunction(editor, 'syncLoadedMatchProvenance', `
function syncLoadedMatchProvenance(suggestions, source) {
  const normalizedSource = typeof source === 'string' ? source.trim() : '';
  const moduleCount = Array.isArray(suggestions?.modules) ? suggestions.modules.length : 0;
  const exactTotal = moduleCount || Math.max(Number(suggestions?.total) || 0, 0);
  const sameSource = state.detectionSource === normalizedSource;
  const fallbackQueue = sameSource && Array.isArray(state.detectionFallbackQueue)
    ? state.detectionFallbackQueue
    : [];

  state.detectionSource = normalizedSource;
  state.detectionMatches = exactTotal;
  state.detectionMatchLimit = Math.max(exactTotal, 1);

  if (exactTotal > 0) {
    state.detectionStatus = 'match';
    state.detectionFallbacks = 0;
    state.detectionFallbackQueue = [];
  } else {
    state.detectionFallbackQueue = fallbackQueue;
    state.detectionFallbacks = fallbackQueue.length;
    state.detectionNearLimit = Math.max(fallbackQueue.length, DETECTION_NEAR_LIMIT);
    state.detectionStatus = fallbackQueue.length ? 'near' : 'none';
  }

  renderDetectionSummary();
}
`);
write('assets/js/observation-editor.js', editor);

// 5. Focused permanent regression for ownership, task order, provenance, and native grammar.
write('tests/observations-native-language.test.mjs', `import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

test('Observations has one route-specific presentation owner', async () => {
  const html = await fs.readFile(path.join(root, 'observations/index.html'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles/observations.css'), 'utf8');
  const guide = await fs.readFile(path.join(root, 'scripts/observation-guide.mjs'), 'utf8');

  const routeLink = '<link rel="stylesheet" href="../styles/observations.css" />';
  assert.ok(html.includes(routeLink));
  assert.ok(html.indexOf(routeLink) > html.indexOf('<link rel="stylesheet" href="../styles.css" fetchpriority="high" />'));
  assert.ok(css.includes('single route-specific stylesheet for /observations/'));
  assert.ok(css.includes('@media (max-width: 640px)'));
  assert.ok(!css.includes('!important'));
  assert.ok(!guide.includes('observationsCriticalCssPath'));
  assert.ok(guide.includes('OBSERVATIONS_STYLESHEET_LINK'));
  await assert.rejects(fs.access(path.join(root, 'styles/observations-critical.css')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'styles/observations-mobile.css')), { code: 'ENOENT' });
});

test('Observation task order is authored in DOM rather than CSS order patches', async () => {
  const html = await fs.readFile(path.join(root, 'observations/index.html'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles/observations.css'), 'utf8');
  const input = html.indexOf('id="observation-text"');
  const suggestions = html.indexOf('id="observation-suggestions"');
  const quickCheck = html.indexOf('class="observation-editor__slot-header"');
  const example = html.indexOf('id="observation-example-toggle"');

  assert.ok(input >= 0 && suggestions > input && quickCheck > suggestions && example > quickCheck);
  assert.ok(!css.includes('.observation-editor__field > *'));
  assert.ok(!css.includes('order: 30;'));
  assert.ok(html.includes('id="observation-suggestions" class="observation-suggestions" aria-live="polite" data-mode="editing"'));
});

test('Exact and nearby provenance is post-load and sourced from loaded matches', async () => {
  const html = await fs.readFile(path.join(root, 'observations/index.html'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles/observations.css'), 'utf8');
  const editor = await fs.readFile(path.join(root, 'assets/js/observation-editor.js'), 'utf8');

  const heading = html.indexOf('class="observation-suggestions__heading"');
  const summary = html.indexOf('id="observation-detection-summary"');
  const actionRow = html.indexOf('class="observation-suggestions__action-row"');
  assert.ok(heading >= 0 && summary > heading && actionRow > summary);
  assert.ok(html.slice(summary, actionRow).includes('hidden'));
  assert.ok(editor.includes("const moduleCount = Array.isArray(suggestions?.modules) ? suggestions.modules.length : 0;"));
  assert.ok(editor.includes('state.detectionMatchLimit = Math.max(exactTotal, 1);'));
  assert.ok(editor.includes('renderDetectionSummary();'));
  assert.ok(css.includes(".observation-suggestions__action[data-action='done']"));
  assert.ok(css.includes("content: '•';"));
});

test('Equivalent Observation disclosures use one chevron language on phones', async () => {
  const html = await fs.readFile(path.join(root, 'observations/index.html'), 'utf8');
  const css = await fs.readFile(path.join(root, 'styles/observations.css'), 'utf8');
  const guide = await fs.readFile(path.join(root, 'scripts/observation-guide.mjs'), 'utf8');

  assert.ok(html.includes('observation-overview__summary-icon" aria-hidden="true">›</span>'));
  assert.ok(guide.includes('observation-guide__toggle-icon" aria-hidden="true">›</span>'));
  assert.ok(css.includes('.observation-editor__example-toggle::after'));
  assert.ok(css.includes('.observation-editor__recipe-toggle::before'));
  assert.ok(css.includes('.observation-suggestions__why-toggle::after'));
  assert.ok(css.includes('.observation-guide__mobile-summary::after'));
  assert.ok(css.includes("content: '›';"));
  assert.ok(css.includes('var(--obs-group-bg)'));
  assert.ok(css.includes('var(--obs-separator)'));
});
`);

let packageJson = read('package.json');
packageJson = packageJson.replace(
  'tests/bedrock-runtime-provenance.test.mjs"',
  'tests/bedrock-runtime-provenance.test.mjs tests/observations-native-language.test.mjs"',
);
write('package.json', packageJson);

// Update the older static-layout regression to the consolidated owner.
let sharedTest = read('tests/shared-density-polish.test.mjs');
sharedTest = replaceTestBlock(sharedTest, 'mobile Observations uses one parser-discovered phone presentation owner', `
test('Observations uses one parser-discovered route presentation owner', async () => {
  const css = await fs.readFile(path.join(root, 'styles/observations.css'), 'utf8');
  const html = await fs.readFile(path.join(root, 'observations/index.html'), 'utf8');

  const link = '<link rel="stylesheet" href="../styles/observations.css" />';
  assert.ok(html.includes(link));
  assert.ok(html.indexOf(link) > html.indexOf('<link rel="stylesheet" href="../styles.css" fetchpriority="high" />'));
  assert.ok(css.includes('single route-specific stylesheet for /observations/'));
  assert.ok(css.includes('body:has(#main.observations-page) .breadcrumbs'));
  assert.ok(css.includes('display: none;'));
  assert.ok(css.includes('width: calc(100% + 2rem);'));
  assert.ok(css.includes('.observation-editor__slot-row'));
  assert.ok(css.includes('.need-status-toggle'));
  assert.ok(css.includes('.observation-suggestions__why-toggle::after'));
  assert.ok(css.includes(".observation-suggestions__action[data-action='done']"));
  assert.ok(css.includes('.observation-editor__match-summary-row + .observation-editor__match-summary-row::before'));
  assert.ok(!css.includes('!important'));
  await assert.rejects(fs.access(path.join(root, 'styles/observations-critical.css')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'styles/observations-mobile.css')), { code: 'ENOENT' });
});
`);
write('tests/shared-density-polish.test.mjs', sharedTest);

// 6. Document the shared native-app visual grammar and route ownership.
write('docs/native-app-visual-language.md', `# Native app visual language\n\nallneeds.app uses an iOS-inspired native-app target for task-oriented screens. The goal is not to imitate Safari chrome or reproduce proprietary Apple assets; it is to use the platform conventions people already understand: clear hierarchy, grouped controls, restrained surfaces, predictable disclosure affordances, and large touch targets.\n\n## Reference implementations\n\nThe existing Journal metadata groups and Inventory segmented controls are the reference implementations for this language. New work should borrow their values and interaction structure before inventing a new component treatment.\n\n- Grouped surfaces use a near-white/lavender background, a one-pixel low-contrast outline, and separators between rows.\n- Interactive rows are at least 44px high; primary phone actions generally use 52px.\n- Segmented controls use one shared capsule, a quiet tinted track, and a white selected segment with only a small elevation shadow.\n- Ordinary phone surfaces do not use stacked drop shadows. Shadows are reserved for overlays, sheets, or the selected segment when depth communicates state.\n- Secondary copy uses the shared ink-soft color at reduced contrast instead of a new tint for every section.\n\n## Hierarchy\n\nA screen should make the next useful action obvious. One task stage gets one dominant action. Completed actions become status/context rather than disabled buttons that continue to compete for attention. Help, examples, explanations, and research remain available but sit below the primary task.\n\nUse color to communicate content/meaning, not to give every container its own visual identity. When two surfaces have the same interaction role, they should normally share the same background, border, radius, typography, and affordance.\n\n## Grouped rows and disclosures\n\nDisclosure rows use one trailing chevron: ‚Äúââ¨‚Äù. Closed points right; open rotates downward. Do not mix plus buttons, literal v glyphs, circled plus controls, and chevrons for equivalent expand/collapse behavior on the same screen. The row owns the visible surface; opened content stays inside that surface behind a one-pixel separator rather than becoming a second nested card.\n\nTop-level optional learning sections may include a short secondary label such as ‚ÄúOptional context‚Äù, but the action/title remains the strongest text in the row.\n\n## Buttons and state\n\nUse sentence case for task actions. Primary actions can span the available phone width when they are the clear next step. After completion, remove that primary emphasis and expose only useful follow-up actions. Destructive/reset actions such as Clear should be visually secondary unless data loss risk requires stronger treatment.\n\nDo not use a disabled primary button as a persistent ‚Äústatus badge‚Äù. Use compact metadata or plain status text instead.\n\n## Typography\n\nPhone page titles use the same compact, non-uppercase app-screen treatment already established on Inventory. Section labels may use the small uppercase grouped-section style. Row titles and action labels use sentence case. Avoid introducing a new display treatment for each component.\n\n## Ownership\n\nShared foundations live in the shared stylesheet owners. A complex route may have one route-specific presentation file when needed, but it should not split the same screen across a critical stylesheet, a mobile repair stylesheet, and browser-side cosmetic mutation. Responsive rules belong in that route owner.\n\nFor Observations, ‚Äùstyles/observations.css‚Äû is the sole route-specific presentation owner. Shared navigation remains independently owned by the shared navigation CSS/prepaint contract. Runtime JavaScript owns state and interaction lifecycle, not deterministic styling.\n\n## Review checklist\n\nBefore accepting a phone UI change, check: one obvious next action; 44px minimum touch targets; one disclosure grammar; one segmented-control grammar; grouped rows rather than card-on-card nesting; restrained color and shadow use; sentence-case actions; no runtime cosmetic mutation; and one named canonical style owner for the route-specific presentation.\n`);

write('docs/observations-layout.md', `# Observations presentation and task-flow contract\n\n## Ownership\n\n- ‚Äùstyles/observations.css‚Äû is the single route-specific presentation owner for ‚Äù/observations/‚Äû on desktop and phone.\n- Phone presentation lives in the one ‚Äù@media (max-width: 640px)‚Äû block in that file. The former route-critical and separate phone stylesheets are retired.\n- ‚Äùscripts/observation-guide.mjs‚Äû keeps the shared navigation critical region nav-only and ensures the route stylesheet is parser-discovered after ‚Äùstyles.css‚Äû.\n- Shared navigation, Journal overlays, fonts, and other cross-route primitives keep their existing shared owners. Their presence is not a second Observations presentation owner.\n\n## Primary flow\n\nThe authored DOM order is: observation input ‚Ä† Load matches/results ‚Ä† Quick Check ‚Ä† example ‚Ä† recipe. CSS must not reorder those task stages.\n\nBefore loading, the result heading/panels and exact/nearby provenance are absent from the visual flow. Load matches is the one primary action. After loading, Needs/Feelings become primary content, exact/nearby appears as compact provenance under the result context, and the completed Load matches button no longer remains as a large disabled control.\n\n‚ÄúWhy these matches?‚Äù explains which detector groups/observation slots led to the suggestions. It does not replace exact/nearby provenance. Exact counts are synchronized from the same loaded module result that renders the visible direct suggestions; nearby counts come from the fallback queue.\n\n## Native visual language\n\nObservations follows ‚Äùdocs/native-app-visual-language.md‚Äû. Quick Check uses an inset grouped list. Example, Observation recipe, Why these matches, Why try this, the full guide, and guide subpanels share the same grouped-row/disclosure grammar. Closed disclosures use a right chevron and open disclosures rotate it downward. Result panels use one neutral grouped surface rather than independent yellow/green card treatments.\n\nThe ordinary validity messages ‚ÄúReady for matches‚Äù / pending / valid remain available to assistive technology without occupying another visual card. Invalid/error guidance stays visible.\n\n## Detector resilience\n\nThe generated module artifact remains sufficient for direct matching if cue-row delivery is unavailable. ‚Äùtests/observation-suggest.test.mjs‚Äû protects detector delivery/data behavior; ‚Äùtests/observations-native-language.test.mjs‚Äû protects presentation ownership, real DOM task order, loaded-result provenance, and the shared disclosure grammar.\n\n## Acceptance\n\nOn iPhone: type and load both the built-in example and a manually written observation; verify exact/nearby appears only after loading and agrees with the visible result; verify all disclosures use the same chevron language; verify Quick Check and help remain secondary; and repeatedly scroll a long highlighted observation to confirm overlays remain aligned. On desktop: verify the editor, recipe, guide tabs, dialogs, and result interactions remain functional after the stylesheet consolidation.\n`);

const oldDoc = join(root, 'docs/observations-mobile-layout.md');
if (existsSync(oldDoc)) unlinkSync(oldDoc);

let readme = read('README.md');
readme = readme.replace(
  /`scripts\/nav-prepaint[.]mjs` is the shared build-time owner for that responsive navigation prefill; the Observations compiler composes shared navigation first-paint CSS from `styles\/nav-critical[.]css` with route-critical Observations layout from `styles\/observations-critical[.]css`, while its prefill comes from the same shared renderer[.] This keeps the hand-owned route aligned without deleting its own first-paint layout contract[.] Phone presentation is separately and explicitly owned by parser-discovered `styles\/observations-mobile[.]css` at `<=640px`, loaded after `styles[.]css` so the native-density layout is deterministic before paint and never relies on browser-side cosmetic mutation[.] \*\*Do not replace the composed Observations critical region with `styles\/nav-critical[.]css` alone; the route-critical source is required for the Observation editor, guide, dialogs, and responsive layout to paint correctly[.]\*\*/,
  '`scripts/nav-prepaint.mjs` is the shared build-time owner for responsive navigation prefill. The hand-owned Observations route now keeps the inline critical region navigation-only and parser-discovers `styles/observations.css` after `styles.css`. That one route stylesheet owns Observations desktop and phone presentation, including its single <=640px native-app block; the former route-critical/mobile split is retired so the screen cannot drift between two Observations style owners.',
);
readme = readme.replace(
  'The accepted ownership and delivery boundaries are documented in `docs/bedrock-runtime-contract.md`, `docs/bedrock-home-canary.md`, `docs/bedrock-route-runtime-matrix.md`, `docs/bedrock-performance-budget.md`, and `docs/bedrock-offline-cache.md`.',
  'The accepted ownership and delivery boundaries are documented in `docs/bedrock-runtime-contract.md`, `docs/bedrock-home-canary.md`, `docs/bedrock-route-runtime-matrix.md`, `docs/bedrock-performance-budget.md`, and `docs/bedrock-offline-cache.md`. The shared iOS-inspired interaction grammar is documented in `docs/native-app-visual-language.md`, with the Observations route contract in `docs/observations-layout.md`.',
);
readme = readme.replace(
  '├── styles/observations-critical.css # Observations route-critical first-paint layout\n├── styles/observations-mobile.css   # authoritative Observations phone presentation',
  '├── styles/observations.css        # single Observations route presentation owner',
);
write('README.md', readme);

// Remove retired route-specific layers only after all consumers have been migrated.
for (const path of ['styles/observations-critical.css', 'styles/observations-mobile.css']) {
  const absolute = join(root, path);
  if (existsSync(absolute)) unlinkSync(absolute);
}

console.log('Observations native cleanup authored: one route stylesheet, real task order, post-load provenance, shared disclosure grammar.');
