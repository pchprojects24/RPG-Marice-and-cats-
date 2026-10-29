// Isolate real game scripts with a minimal DOM, storage, and controlled timers.
// This tests progression and persistence, not browser layout or rendering.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = process.env.GAME_TEST_ROOT || path.join(__dirname, '..');

function setup(options = {}) {
  let nextId = 0;
  const timers = new Map();
  const storage = new Map();
  const elements = new Map();
  const drawing = new Proxy({}, {
    get: (_, key) => key === 'createRadialGradient' || key === 'createLinearGradient'
      ? () => ({ addColorStop() {} })
      : () => {}
  });

  function events(target) {
    const listeners = new Map();
    target.addEventListener = (name, handler) => {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(handler);
    };
    target.dispatch = (name, props = {}) => {
      const event = { type: name, target, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...props };
      for (const listener of listeners.get(name) || []) listener.call(target, event);
      return event;
    };
    return target;
  }

  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const classes = new Set();
    const attributes = new Map();
    const el = {
      id, tagName: '', tabIndex: 0, inert: false,
      style: {}, value: '50', checked: false, textContent: '', children: [],
      offsetParent: {}, offsetWidth: 100,
      classList: {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        contains: name => classes.has(name),
        toggle(name, enabled = !classes.has(name)) {
          if (enabled) classes.add(name);
          else classes.delete(name);
        }
      },
      set innerHTML(value) { this.children = []; },
      addEventListener() {},
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.get(name) ?? null; },
      contains(target) { return target === this || this.children.some(child => child.contains(target)); },
      closest(selector) {
        if (selector === '[inert]') return this.inert ? this : this.parentElement?.closest(selector);
        return selector.split(', ').some(tag => tag.toUpperCase() === this.tagName)
          ? this : this.parentElement?.closest(selector);
      },
      getClientRects() { return this.style.display === 'none' ? [] : [{}]; },
      focus(options) { document.activeElement = this; this.focusOptions = options; },
      appendChild(child) { this.children.push(child); child.parentElement = this; },
      getContext: () => drawing,
      getBoundingClientRect: () => ({ top: 0, bottom: 70, left: 0, right: 100, width: 100, height: 70 }),
      querySelector: selector => element(id + selector),
      querySelectorAll() {
        return this.children.flatMap(child => [child, ...child.querySelectorAll()])
          .filter(child => ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(child.tagName));
      }
    };
    events(el);
    elements.set(id, el);
    return el;
  }

  const document = {
    getElementById: element,
    createElement: tag => { const el = element(tag + (++nextId)); el.tagName = tag.toUpperCase(); return el; },
    querySelector: element,
    querySelectorAll: () => [],
    addEventListener() {}
  };
  events(document);
  const window = events({
    innerWidth: 1280, innerHeight: 720,
    matchMedia: () => ({ matches: true }),
    PointerEvent: options.pointerEvents === false ? undefined : class {}
  });
  const context = vm.createContext({
    console, document, Date, Math,
    getComputedStyle: el => ({ visibility: el.style.visibility || 'visible' }),
    window,
    navigator: { maxTouchPoints: 0 },
    Image: class {},
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    setTimeout(fn, ms) {
      const id = ++nextId;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout: id => timers.delete(id),
    setInterval: () => ++nextId,
    clearInterval() {},
    requestAnimationFrame() {}
  });
  for (const filename of ['data/maps.js', 'data/dialogue.js', 'game-engine.js', 'game-art.js', 'game-main.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, filename), 'utf8'), context, { filename });
  }
  return { run: source => vm.runInContext(source, context), timers, storage, elements, document, window };
}

module.exports = { setup };
