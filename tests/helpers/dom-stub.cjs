// tests/helpers/dom-stub.cjs
// A minimal DOM for driving the life-simulation UI (life-ui.js / life.js) in plain node, in the
// same spirit as helpers/module.cjs: only what the production code actually touches, no more.
// Not a browser: it verifies logic and wiring, not layout.

class StubElement {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.children = [];
    this.parentNode = null;
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.value = '';
    this.dataset = {};
    this.style = {};
    this._class = new Set();
    this._listeners = new Map();
    this._popoverOpen = false;
  }

  get className() {
    return [...this._class].join(' ');
  }
  set className(v) {
    this._class = new Set(String(v).split(/\s+/).filter(Boolean));
  }
  get firstChild() {
    return this.children[0] || null;
  }
  get lastChild() {
    return this.children[this.children.length - 1] || null;
  }

  get classList() {
    const set = this._class;
    return {
      add: (...names) => names.forEach((n) => set.add(n)),
      remove: (...names) => names.forEach((n) => set.delete(n)),
      toggle: (n, force) => {
        const on = force === undefined ? !set.has(n) : Boolean(force);
        if (on) set.add(n); else set.delete(n);
        return on;
      },
      contains: (n) => set.has(n)
    };
  }

  append(...nodes) {
    for (const n of nodes) this.appendChild(n);
  }

  appendChild(child) {
    if (child && child.parentNode) child.parentNode.removeChild(child);
    this.children.push(child);
    if (child) child.parentNode = this;
    return child;
  }

  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    if (child) child.parentNode = null;
    return child;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  replaceChildren(...nodes) {
    for (const c of this.children) c.parentNode = null;
    this.children = [];
    for (const n of nodes) this.appendChild(n);
  }

  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this._listeners.get(type)?.delete(fn);
  }
  dispatch(type, event = {}) {
    const ev = { target: this, defaultPrevented: false, ...event };
    for (const fn of [...(this._listeners.get(type) || [])]) fn(ev);
    return ev;
  }
  click() {
    this.dispatch('click', { detail: 1 });
  }

  setAttribute(name, value) {
    if (name === 'class') {
      this.className = String(value);
      return;
    }
    this[`_${name}`] = String(value);
    if (name === 'aria-selected' || name === 'hidden' || name === 'disabled') this[name === 'aria-selected' ? '_ariaSelected' : name] = value;
  }
  getAttribute(name) {
    return this[`_${name}`] ?? null;
  }

  matches(selector) {
    if (selector === ':popover-open') return this._popoverOpen === true;
    if (selector.startsWith('.')) return this._class.has(selector.slice(1));
    return false;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (selector.startsWith('.') && child._class.has(selector.slice(1))) out.push(child);
        if (selector.startsWith('#') && child.id === selector.slice(1)) out.push(child);
        if (selector.startsWith('[data-') && selector.endsWith(']')) {
          const attr = selector.slice(6, -1); // e.g. data-arrival
          if (child.dataset[attr.replace('data-', '')] !== undefined) out.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  focus() { this._focused = true; }
  blur() {}

  showPopover() { this._popoverOpen = true; }
  hidePopover() { this._popoverOpen = false; }
}

function createDom() {
  const byId = new Map();
  const windowListeners = new Map();
  const documentListeners = new Map();

  // Initial class names as they appear in index.html — the life-ui logic reads e.g.
  // classList.contains('hidden') on elements the real HTML ships with those classes.
  const initialClass = {
    'life-welcome': 'life-welcome hidden',
    'life-travel': 'life-travel hidden',
    'life-hud': 'panel life-hud hidden',
    'life-mission': 'panel life-mission hidden',
    'life-prompt': 'panel life-prompt hidden',
    'life-place': 'popover life-place',
    'life-journal': 'popover life-journal',
    'welcome-setup': 'welcome-setup',
    'welcome-choices': 'welcome-choices',
    'welcome-continue': 'pop-item welcome-btn',
    'welcome-new': 'pop-item welcome-btn',
    'welcome-roam': 'pop-item welcome-btn',
    'welcome-start': 'tool-btn welcome-start',
    'time-auto': 'time-btn'
  };

  const document = {
    hidden: false,
    getElementById(id) {
      if (!byId.has(id)) {
        const e = new StubElement('div', id);
        if (initialClass[id]) e.className = initialClass[id];
        byId.set(id, e);
      }
      return byId.get(id);
    },
    createElement(tag) {
      return new StubElement(tag);
    },
    createElementNS(_ns, tag) {
      return new StubElement(tag);
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    addEventListener(type, fn) {
      if (!documentListeners.has(type)) documentListeners.set(type, new Set());
      documentListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      documentListeners.get(type)?.delete(fn);
    },
    dispatch(type, event = {}) {
      for (const fn of [...(documentListeners.get(type) || [])]) fn(event);
    },
    body: new StubElement('body')
  };

  const window = {
    addEventListener(type, fn) {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set());
      windowListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      windowListeners.get(type)?.delete(fn);
    },
    dispatch(type, event = {}) {
      const ev = { target: { tagName: 'BODY' }, repeat: false, metaKey: false, ctrlKey: false, altKey: false, ...event };
      for (const fn of [...(windowListeners.get(type) || [])]) fn(ev);
    }
  };

  const g = globalThis;
  g.window = window;
  g.document = document;
  g.HTMLElement = { prototype: { showPopover() { this._popoverOpen = true; }, hidePopover() { this._popoverOpen = false; }, togglePopover() {} } };
  if (!g.localStorage) g.localStorage = { map: new Map(), getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }, setItem(k, v) { this.map.set(k, String(v)); }, removeItem(k) { this.map.delete(k); } };

  return {
    document,
    window,
    byId,
    reset() {
      windowListeners.clear();
      documentListeners.clear();
    }
  };
}

module.exports = { createDom, StubElement };
