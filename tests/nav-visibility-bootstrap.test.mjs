import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const NAV_STORAGE_KEY = 'nvcApp.navSettings';

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName).toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name.startsWith('data-')) {
      this.dataset[dataNameToProp(name.slice(5))] = stringValue;
    }
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith('data-')) {
      delete this.dataset[dataNameToProp(name.slice(5))];
    }
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (matchesSelector(child, selector)) {
        return child;
      }
      const match = child.querySelector(selector);
      if (match) {
        return match;
      }
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    collectMatches(this, selector, results);
    return results;
  }
}

class FakeStorage {
  constructor(initial = {}) {
    this.store = new Map();
    for (const [key, value] of Object.entries(initial)) {
      this.store.set(key, String(value));
    }
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }
}

function dataNameToProp(name) {
  return name
    .split('-')
    .map((part, index) => {
      if (index === 0) {
        return part;
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

function matchesSelector(element, selector) {
  if (!selector) {
    return false;
  }

  if (selector.startsWith('[') && selector.endsWith(']') && selector.includes('][')) {
    const inner = selector.slice(1, -1);
    const parts = inner.split('][');
    return parts.every((part) => matchesSelector(element, `[${part}]`));
  }

  if (selector.startsWith('[') && selector.endsWith(']')) {
    const body = selector.slice(1, -1);
    const [rawName, rawValue] = body.split('=');
    const attrName = rawName;
    if (typeof rawValue === 'undefined') {
      return element.hasAttribute(attrName);
    }
    const expected = rawValue.replace(/^"|"$/g, '');
    return element.getAttribute(attrName) === expected;
  }

  return false;
}

function collectMatches(element, selector, results) {
  for (const child of element.children) {
    if (matchesSelector(child, selector)) {
      results.push(child);
    }
    collectMatches(child, selector, results);
  }
}

function parseAttributes(attributeString = '') {
  const attributes = [];
  const regex = /([^\s=]+)(?:="([^"]*)")?/g;
  let match;
  while ((match = regex.exec(attributeString))) {
    const name = match[1];
    const value = typeof match[2] === 'undefined' ? '' : match[2];
    attributes.push([name, value]);
  }
  return attributes;
}

function buildNavFromMarkup(markup) {
  const navStart = markup.match(/<nav\s+([^>]*)>/i);
  assert.ok(navStart, 'nav markup missing start tag');
  const nav = new FakeElement('nav');
  for (const [name, value] of parseAttributes(navStart[1])) {
    nav.setAttribute(name, value);
  }

  const board = new FakeElement('div');
  board.setAttribute('data-magnet-board', '');
  nav.appendChild(board);

  const magnetRegex = /<(a|button)\s+([^>]*data-magnet-id="[^"]+"[^>]*)>/gi;
  let magnetMatch;
  while ((magnetMatch = magnetRegex.exec(markup))) {
    const tagName = magnetMatch[1];
    const attributes = parseAttributes(magnetMatch[2]);
    const magnet = new FakeElement(tagName);
    for (const [name, value] of attributes) {
      if (value || name.startsWith('data-')) {
        magnet.setAttribute(name, value);
      } else {
        magnet.setAttribute(name, '');
      }
    }
    board.appendChild(magnet);
  }

  return nav;
}

function createDocument(nav) {
  return {
    querySelector(selector) {
      if (matchesSelector(nav, selector)) {
        return nav;
      }
      return nav.querySelector(selector);
    },
    querySelectorAll() {
      return [];
    },
  };
}

async function loadNavMarkup() {
  const htmlPath = path.join(repoRoot, 'index.html');
  const html = await fs.readFile(htmlPath, 'utf8');
  const navMatch = html.match(/<nav class="site-nav[\s\S]*?<\/nav>/);
  assert.ok(navMatch, 'nav markup missing from index.html');
  return navMatch[0];
}

async function loadBootstrapScript() {
  const htmlPath = path.join(repoRoot, 'index.html');
  const html = await fs.readFile(htmlPath, 'utf8');
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for (const match of scriptMatches) {
    if (match[1].includes('nvcApp.navSettings')) {
      return match[1];
    }
  }
  assert.fail('bootstrap script missing from index.html');
}

test('nav bootstrap reveals supplemental magnets before app boot', async () => {
  const navMarkup = await loadNavMarkup();
  const scriptBody = await loadBootstrapScript();
  const nav = buildNavFromMarkup(navMarkup);

  const document = createDocument(nav);
  const localStorage = {
    getItem() {
      throw new Error('local storage disabled');
    },
  };
  const sessionStorage = new FakeStorage({
    [NAV_STORAGE_KEY]: JSON.stringify({
      updatedAt: Date.now() + 1000,
      enabled: {
        bodyCues: true,
        journalDashboard: true,
      },
    }),
  });

  const sandbox = {
    window: {
      localStorage,
      sessionStorage,
    },
    document,
    HTMLElement: FakeElement,
    console: { warn: () => {}, error: () => {}, log: () => {} },
  };
  sandbox.window.document = document;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(scriptBody, sandbox);

  const bodyCues = nav.querySelector('[data-magnet-id="nav-body-cues"]');
  assert.ok(bodyCues, 'body cues magnet missing');
  assert.equal(bodyCues.getAttribute('data-nav-hidden'), null);
  assert.equal(bodyCues.getAttribute('aria-hidden'), null);
  assert.equal(bodyCues.getAttribute('tabindex'), null);

  const journalDashboard = nav.querySelector('[data-magnet-id="nav-journal-dashboard"]');
  assert.ok(journalDashboard, 'journal dashboard magnet missing');
  assert.equal(journalDashboard.getAttribute('data-nav-hidden'), null);
  assert.equal(journalDashboard.getAttribute('aria-hidden'), null);
  assert.equal(journalDashboard.getAttribute('tabindex'), null);

  const navExpanded = nav.getAttribute('data-nav-expanded');
  assert.equal(navExpanded, 'true');
});
