import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NVC_TEST = '1';

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName).toUpperCase();
    this._className = '';
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.previousSibling = null;
    this.nextSibling = null;
    this.textContent = '';
    this.hidden = false;
    this.dataset = {};
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this._className = value || '';
    if (this._className) {
      this.attributes.set('class', this._className);
    } else {
      this.attributes.delete('class');
    }
  }

  setAttribute(name, value) {
    if (name === 'class') {
      this.className = String(value);
      return;
    }
    this.attributes.set(name, String(value));
    if (name === 'type') {
      this.type = String(value);
    }
    if (name === 'href') {
      this.href = String(value);
    }
  }

  removeAttribute(name) {
    if (name === 'class') {
      this.className = '';
      return;
    }
    this.attributes.delete(name);
    if (name === 'type') {
      this.type = '';
    }
    if (name === 'href') {
      this.href = '';
    }
  }

  getAttribute(name) {
    if (name === 'class') {
      return this.className || null;
    }
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    if (name === 'class') {
      return Boolean(this.className);
    }
    return this.attributes.has(name);
  }

  appendChild(child) {
    child.parentNode = this;
    const last = this.children.at(-1) ?? null;
    if (last) {
      last.nextSibling = child;
    }
    child.previousSibling = last;
    child.nextSibling = null;
    this.children.push(child);
    return child;
  }

  insertBefore(child, reference) {
    if (!reference) {
      return this.appendChild(child);
    }
    const index = this.children.indexOf(reference);
    if (index === -1) {
      return this.appendChild(child);
    }
    child.parentNode = this;
    this.children.splice(index, 0, child);
    const prev = this.children[index - 1] ?? null;
    if (prev) {
      prev.nextSibling = child;
    }
    child.previousSibling = prev;
    child.nextSibling = reference;
    reference.previousSibling = child;
    return child;
  }

  append(...nodes) {
    nodes.forEach((node) => this.appendChild(node));
  }

  get firstChild() {
    return this.children[0] ?? null;
  }

  querySelector(selector) {
    if (matchesSelector(this, selector)) {
      return this;
    }
    for (const child of this.children) {
      const match = child.querySelector(selector);
      if (match) {
        return match;
      }
    }
    return null;
  }
}

function matchesSelector(element, selector) {
  if (!selector) {
    return false;
  }
  if (selector.startsWith('.')) {
    const cls = selector.slice(1);
    return element.className.split(/\s+/).includes(cls);
  }
  if (selector.startsWith('[') && selector.endsWith(']')) {
    const body = selector.slice(1, -1);
    if (!body) {
      return false;
    }
    const [attrName, attrValue] = body.split('=');
    if (!attrValue) {
      return element.hasAttribute(attrName);
    }
    const normalized = attrValue.replace(/^"|"$/g, '');
    return element.getAttribute(attrName) === normalized;
  }
  return false;
}

let currentNavLinks = [];

const documentElement = new FakeElement('html');
const body = new FakeElement('body');
const siteNav = new FakeElement('nav');
siteNav.className = 'site-nav';
body.appendChild(siteNav);
documentElement.appendChild(body);

global.HTMLElement = FakeElement;

global.document = {
  readyState: 'loading',
  documentElement,
  body,
  createElement: (tag) => new FakeElement(tag),
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: (selector) => {
    if (selector === '.site-nav') {
      return siteNav;
    }
    if (selector === '.site-nav__row--primary') {
      return siteNav.querySelector(selector);
    }
    return null;
  },
  querySelectorAll: (selector) => {
    if (selector === '.site-nav__link[href]') {
      return currentNavLinks;
    }
    return [];
  },
};

global.window = {
  location: { href: 'https://example.com/', pathname: '/' },
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }),
  requestAnimationFrame: (fn) => fn(),
  scrollTo: () => {},
  confirm: () => true,
  dispatchEvent: () => {},
  localStorage: { getItem: () => null, setItem: () => {} },
};

global.localStorage = window.localStorage;

global.CustomEvent = class {
  constructor(type, detail) {
    this.type = type;
    this.detail = detail?.detail ?? detail;
  }
};

Object.defineProperty(global, 'navigator', {
  value: {},
  configurable: true,
});

await import('../scripts/inventory.js');

const { highlightNavigation, resolveNavCustomizerToggle } = window.__NVC_INVENTORY_TESTS__;

function makeLink(href) {
  const link = new FakeElement('a');
  link.className = 'site-nav__link';
  link.setAttribute('href', href);
  return link;
}

test('highlightNavigation leaves pre-rendered active link unchanged', () => {
  const feelingsLink = makeLink('../feelings/');
  feelingsLink.setAttribute('aria-current', 'page');
  const needsLink = makeLink('../needs/');
  currentNavLinks = [feelingsLink, needsLink];
  window.location.pathname = '/feelings/';
  window.location.href = 'https://example.com/feelings/';

  highlightNavigation();

  assert.equal(feelingsLink.getAttribute('aria-current'), 'page');
  assert.equal(needsLink.hasAttribute('aria-current'), false);
});

test('highlightNavigation prefers the most specific matching link', () => {
  const feelingsLink = makeLink('../../feelings/');
  feelingsLink.setAttribute('aria-current', 'page');
  const bodyCuesLink = makeLink('../../feelings/body-cues/');
  currentNavLinks = [feelingsLink, bodyCuesLink];
  window.location.pathname = '/feelings/body-cues/';
  window.location.href = 'https://example.com/feelings/body-cues/';

  highlightNavigation();

  assert.equal(bodyCuesLink.getAttribute('aria-current'), 'page');
  assert.equal(feelingsLink.hasAttribute('aria-current'), false);
});

test('highlightNavigation falls back to alias when needed', () => {
  const situationsLink = makeLink('../situations/');
  const feelingsLink = makeLink('../feelings/');
  currentNavLinks = [situationsLink, feelingsLink];
  window.location.pathname = '/alexithymia-support/';
  window.location.href = 'https://example.com/alexithymia-support/';

  highlightNavigation();

  assert.equal(feelingsLink.getAttribute('aria-current'), 'page');
  assert.equal(situationsLink.hasAttribute('aria-current'), false);
});

test('highlightNavigation activates direct path when aria-current missing', () => {
  const homeLink = makeLink('../');
  const inventoryLink = makeLink('../inventory/');
  currentNavLinks = [homeLink, inventoryLink];
  window.location.pathname = '/inventory/';
  window.location.href = 'https://example.com/inventory/';

  highlightNavigation();

  assert.equal(inventoryLink.getAttribute('aria-current'), 'page');
  assert.equal(homeLink.hasAttribute('aria-current'), false);
});

function resetNavStructure() {
  siteNav.children = [];
  const primaryRow = new FakeElement('div');
  primaryRow.className = 'site-nav__row site-nav__row--primary';
  const homeLink = new FakeElement('a');
  homeLink.className = 'site-nav__link site-nav__link--home';
  primaryRow.appendChild(homeLink);
  siteNav.appendChild(primaryRow);
  return { primaryRow, homeLink };
}

test('resolveNavCustomizerToggle reuses existing toggle', () => {
  const { primaryRow } = resetNavStructure();
  const existingToggle = new FakeElement('button');
  existingToggle.className = 'site-nav__link site-nav__link--customizer';
  existingToggle.setAttribute('data-palette-toggle', '');
  primaryRow.appendChild(existingToggle);

  const result = resolveNavCustomizerToggle(siteNav);

  assert.strictEqual(result, existingToggle);
  assert.equal(result.getAttribute('type'), 'button');
  assert.equal(result.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(result.hasAttribute('data-palette-toggle'), true);
  assert.equal(primaryRow.children.length, 2);
});

test('resolveNavCustomizerToggle creates toggle when missing', () => {
  const { primaryRow, homeLink } = resetNavStructure();
  const result = resolveNavCustomizerToggle(siteNav);

  assert.ok(result instanceof FakeElement);
  assert.equal(result.className.includes('site-nav__link--customizer'), true);
  assert.equal(result.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(primaryRow.children.length, 2);
  assert.strictEqual(primaryRow.children[0], homeLink);
  assert.strictEqual(primaryRow.children[1], result);
});
