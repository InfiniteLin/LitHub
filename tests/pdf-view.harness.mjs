import { readFileSync } from 'node:fs';

export const tick = () => new Promise(r => setTimeout(r, 0));
export const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
export function harness() {
  class El {
    constructor(tag = 'div') {
      Object.assign(this, { tag, children: [], className: '', style: { setProperty() {} },
        listeners: new Map(), clientWidth: 660, clientHeight: 800, scrollTop: 0, scrollLeft: 0,
        width: 0, height: 0, innerHTML: '' });
    }
    appendChild(el) { this.children.push(el); el.parentElement = this; return el; }
    insertAdjacentHTML() {}
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    querySelectorAll(sel) {
      return this.children.flatMap(el => [ ...(el.className === sel.slice(1) ? [el] : []), ...el.querySelectorAll(sel) ]);
    }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(el => el !== this); }
    addEventListener(event, callback) { this.listeners.set(event, callback); }
    removeEventListener(event) { this.listeners.delete(event); }
    getContext() { return { canvas: this }; }
    getBoundingClientRect() {
      if (this.rect) return this.rect();
      const width = parseFloat(this.style.width) || this.clientWidth;
      const height = parseFloat(this.style.height) || this.clientHeight;
      return { top: 0, bottom: height, left: 0, right: width, width, height };
    }
  }
  const calls = { pages: [], renders: [], text: [], destroyed: [], taskDestroyed: [], observers: [], errors: [] };
  const controls = {};
  const docs = new Map();
  function makeDoc(name, sizes = Array.from({ length: 34 }, () => [612, 792])) {
    const doc = {
      name, numPages: sizes.length,
      async getPage(n) {
        calls.pages.push([name, n]);
        if (controls.page) return controls.page(doc, n);
        return makePage(n, sizes[n - 1]);
      },
      destroy() { calls.destroyed.push(name); return Promise.resolve(); },
    };
    docs.set(name, doc);
    return doc;
  }
  function makePage(n, [w, h] = [612, 792]) {
    return { n, getViewport: ({ scale }) => ({ width: w * scale, height: h * scale }),
      streamTextContent: () => n, cleanup() {},
      render(params) {
        calls.renders.push(params);
        return controls.render?.(n, params) || { promise: Promise.resolve(), cancel() {} };
      },
    };
  }
  const lib = {
    GlobalWorkerOptions: {},
    getDocument({ url }) {
      if (controls.load) return controls.load(url);
      return { promise: Promise.resolve(docs.get(url) || makeDoc(url)) };
    },
    TextLayer: class {
      constructor(opts) { calls.text.push(opts); }
      render() { return Promise.resolve(); }
      cancel() {}
    },
  };
  const window = { devicePixelRatio: 2, listeners: new Map(),
    addEventListener(name, fn) { this.listeners.set(name, fn); },
    removeEventListener(name) { this.listeners.delete(name); },
    matchMedia() { return { addEventListener() {}, removeEventListener() { calls.mediaRemoved = true; } }; },
  };
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; calls.observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
    fire(side, near = true) { this.callback([{ target: side.div, isIntersecting: near }]); }
  }
  class ResizeObserver extends IntersectionObserver {}
  const document = { baseURI: 'http://localhost/', createElement: tag => new El(tag) };
  const source = readFileSync('frontend/js/pdf-view.js', 'utf8').replace('await import(VENDOR + "pdf.min.js")', 'lib');
  const PdfView = new Function('window', 'document', 'IntersectionObserver', 'ResizeObserver', 'lib', 'console',
    source + ';return window.PdfView;')(window, document, IntersectionObserver, ResizeObserver, lib,
      { error: (...args) => calls.errors.push(args) });
  async function idle(pane) {
    for (let i = 0; i < 100; i++) {
      await tick();
      if (!pane._pdf?.running && !pane._pdf?.queue.size) return;
    }
    throw Error('render queue did not settle');
  }
  return { PdfView, pane: new El(), calls, controls, makeDoc, makePage, window, idle };
}
