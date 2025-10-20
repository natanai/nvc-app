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

async function loadHtml(filePath) {
  const html = await fs.readFile(filePath, 'utf8');
  return html;
}

function extractNavMarkup(html, sourcePath) {
  const navMatch = html.match(/<nav class="site-nav[\s\S]*?<\/nav>/);
  assert.ok(navMatch, `nav markup missing from ${sourcePath}`);
  return navMatch[0];
}

function extractBootstrapScript(html, sourcePath) {
  const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for (const match of scriptMatches) {
    if (match[1].includes('nvcApp.navSettings')) {
      return match[1];
    }
  }
  assert.fail(`bootstrap script missing from ${sourcePath}`);
}

function extractMagnetMap(scriptBody) {
  const mapMatch = scriptBody.match(/var\s+magnetMap\s*=\s*\{([\s\S]*?)\};/);
  assert.ok(mapMatch, 'magnet map missing from bootstrap script');
  const mapBody = mapMatch[1];
  const magnetIdToNavId = new Map();
  const pairRegex = /([A-Za-z0-9_$]+)\s*:\s*'([^']+)'/g;
  let match;
  while ((match = pairRegex.exec(mapBody))) {
    const navId = match[1];
    const magnetId = match[2];
    magnetIdToNavId.set(magnetId, navId);
  }
  return magnetIdToNavId;
}

function extractObjectKeys(scriptBody, variableName) {
  const pattern = new RegExp(`var\\s+${variableName}\\s*=\\s*\\{([\\s\\S]*?)\\};`);
  const match = pattern.exec(scriptBody);
  assert.ok(match, `${variableName} object missing from bootstrap script`);
  const body = match[1];
  const keyRegex = /([A-Za-z0-9_$]+)\s*:/g;
  const keys = new Set();
  let keyMatch;
  while ((keyMatch = keyRegex.exec(body))) {
    keys.add(keyMatch[1]);
  }
  return keys;
}

async function listIndexFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const childFiles = await listIndexFiles(fullPath);
      files.push(...childFiles);
    } else if (entry.isFile() && entry.name === 'index.html') {
      files.push(fullPath);
    }
  }
  return files;
}

async function runBootstrapAssertions(htmlPath) {
  const html = await loadHtml(htmlPath);
  if (!html.includes('nvcApp.navSettings')) {
    return;
  }
  const navMarkup = extractNavMarkup(html, htmlPath);
  const scriptBody = extractBootstrapScript(html, htmlPath);
  const nav = buildNavFromMarkup(navMarkup);
  const magnetIdToNavId = extractMagnetMap(scriptBody);

  const defaultsKeys = extractObjectKeys(scriptBody, 'defaults');
  const magnetMapKeys = extractObjectKeys(scriptBody, 'magnetMap');

  assert.ok(defaultsKeys.size > 0, 'defaults object missing nav entries');
  for (const key of defaultsKeys) {
    assert.ok(magnetMapKeys.has(key), `magnetMap missing nav mapping for ${key}`);
  }
  for (const key of magnetMapKeys) {
    assert.ok(defaultsKeys.has(key), `defaults missing nav toggle for ${key}`);
  }

  const supplementalMagnets = nav
    .querySelectorAll('[data-magnet-id]')
    .filter((magnet) =>
      magnet.getAttribute('data-nav-supplemental') === 'true' ||
      magnet.hasAttribute('data-nav-hidden'),
    );

  assert.ok(supplementalMagnets.length > 0, 'no supplemental magnets discovered');

  const enabledNavIds = {};
  for (const magnet of supplementalMagnets) {
    const magnetId = magnet.getAttribute('data-magnet-id');
    const navId = magnetIdToNavId.get(magnetId);
    assert.ok(navId, `missing navId mapping for magnet ${magnetId}`);
    enabledNavIds[navId] = true;
  }

  const document = createDocument(nav);
  const localStorage = new FakeStorage();
  localStorage.setItem(
    NAV_STORAGE_KEY,
    JSON.stringify({
      enabled: enabledNavIds,
    }),
  );
  const sessionStorage = new FakeStorage();

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

  for (const magnet of supplementalMagnets) {
    assert.equal(
      magnet.getAttribute('data-nav-hidden'),
      null,
      `${magnet.getAttribute('data-magnet-id')} data-nav-hidden should be removed`,
    );
    assert.equal(
      magnet.getAttribute('aria-hidden'),
      null,
      `${magnet.getAttribute('data-magnet-id')} aria-hidden should be removed`,
    );
    assert.equal(
      magnet.getAttribute('tabindex'),
      null,
      `${magnet.getAttribute('data-magnet-id')} tabindex should not be forced`,
    );
  }

  const navExpanded = nav.getAttribute('data-nav-expanded');
  assert.equal(navExpanded, 'true', 'nav should be flagged as expanded');
}

test('nav bootstrap reveals supplemental magnets before app boot', async () => {
  const htmlFiles = await listIndexFiles(repoRoot);
  assert.ok(htmlFiles.length > 0, 'no index.html files found');
  for (const file of htmlFiles) {
    await runBootstrapAssertions(file);
  }
});
