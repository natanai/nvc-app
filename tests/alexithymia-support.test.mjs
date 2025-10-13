import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NVC_TEST = '1';

import {
  inferZoneFromSensations,
  mergeCompassAndInferredZone,
  calculateRejectionPenalty,
  normalizeScoresWithPenalty,
} from '../scripts/alexithymia-support-logic.js';

class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.className = '';
    this.textContent = '';
    this.dataset = {};
    this.attributes = new Map();
    this._innerHTML = '';
    this.hidden = false;
    this.classList = {
      add: (...classes) => {
        classes.forEach((cls) => {
          if (!this.className.includes(cls)) {
            this.className = `${this.className} ${cls}`.trim();
          }
        });
      },
      remove: (...classes) => {
        this.className = this.className
          .split(/\s+/)
          .filter((cls) => !classes.includes(cls))
          .join(' ');
      },
      toggle: (cls, force) => {
        if (force === undefined) {
          if (this.className.split(/\s+/).includes(cls)) {
            this.classList.remove(cls);
            return false;
          }
          this.classList.add(cls);
          return true;
        }
        if (force) {
          this.classList.add(cls);
        } else {
          this.classList.remove(cls);
        }
        return force;
      },
    };
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
  }
}

const fakeBody = new FakeElement('body');
fakeBody.dataset = {};
fakeBody.classList = {
  add() {},
  remove() {},
};

global.document = {
  readyState: 'loading',
  body: fakeBody,
  querySelector: () => null,
  createElement: (tag) => new FakeElement(tag),
  addEventListener: () => {},
  removeEventListener: () => {},
};

fakeBody.appendChild = (child) => {
  fakeBody.children.push(child);
  return child;
};

fakeBody.removeChild = (child) => {
  fakeBody.children = fakeBody.children.filter((item) => item !== child);
};

global.window = {
  NVC_FLAGS: {},
  location: { pathname: '/' },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  requestAnimationFrame: (fn) => fn(),
};

Object.defineProperty(global, 'navigator', {
  value: { clipboard: { writeText: async () => {} } },
  configurable: true,
});

global.CustomEvent = class {
  constructor(type, detail) {
    this.type = type;
    this.detail = detail?.detail;
  }
};

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
};

await import('../scripts/alexithymia-support.js');

const { renderSuggestionBlock } = globalThis.__NVC_SUPPORT_TESTS__;

test('inferZoneFromSensations infers expected zone', () => {
  const selections = [
    {
      option: { emotions: { anxiety: 1, fear: 0.5 } },
      intensity: 8,
    },
    {
      option: { emotions: { anger: 0.4 } },
      intensity: 6,
    },
  ];
  const zone = inferZoneFromSensations(selections);
  assert.equal(zone, 'high-unpleasant');
});

test('mergeCompassAndInferredZone respects compass override', () => {
  assert.equal(mergeCompassAndInferredZone('low-pleasant', 'high-unpleasant'), 'low-pleasant');
  assert.equal(mergeCompassAndInferredZone(null, 'medium-neutral'), 'medium-neutral');
});

test('calculateRejectionPenalty decreases with rejections', () => {
  assert.equal(calculateRejectionPenalty(0), 1);
  assert.equal(Number(calculateRejectionPenalty(1).toFixed(2)), 0.5);
  assert.ok(calculateRejectionPenalty(5) > 0);
});

test('renderSuggestionBlock provides fallback when no suggestions', () => {
  const container = new FakeElement('div');
  renderSuggestionBlock(container, 'Test', 'Message', [], []);
  assert.equal(container.children.length, 3); // heading, message, fallback note
  const fallback = container.children.at(-1);
  assert.equal(fallback.className.includes('support-note'), true);
  assert.match(fallback.textContent, /No clear matches yet/);
});

test('normalizeScoresWithPenalty returns max confidence of 1', () => {
  const normalized = normalizeScoresWithPenalty([
    { key: 'a', score: 0.2 },
    { key: 'b', score: 0.5 },
    { key: 'c', score: 0.1 },
  ]);
  const max = normalized.reduce((acc, item) => Math.max(acc, item.confidence), 0);
  assert.equal(max, 1);
  const min = normalized.reduce((acc, item) => Math.min(acc, item.confidence), 1);
  assert.ok(min >= 0);
});

test('renderSuggestionBlock includes evidence trigger when context provided', () => {
  const container = new FakeElement('div');
  renderSuggestionBlock(container, 'Contexted', 'Message', [{ key: 'joy', confidence: 0.8 }], [
    'zone-pleasant-high',
  ]);
  assert.equal(container.children.length >= 2, true);
  const headingWrap = container.children[0];
  const hasButton = headingWrap.children.some(
    (child) => child.tagName === 'button' && child.dataset.evidenceTrigger === 'true'
  );
  assert.equal(hasButton, true);
});
