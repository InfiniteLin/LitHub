import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('electron/main.js', 'utf8');
const handlers = new Map(), requests = [];
let body = { ok: true }, scriptReads = 0;
const sandbox = {
  ipcMain: { handle: (name, run) => handlers.set(name, run) },
  win: { getNativeWindowHandle: () => Buffer.alloc(8), getBounds: () => ({}),
    webContents: { executeJavaScript: () => { scriptReads++; throw Error('unexpected renderer read'); } } },
  screen: { getDisplayMatching: () => ({ scaleFactor: 2 }) },
  net: { fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => body }; } },
  SIDECAR_PORT: 8130, AbortSignal,
  webAiVisible: false, webAiView: null,
};
vm.runInNewContext(source.slice(source.indexOf('function cssToPhysical('), source.indexOf('/* ---------------- 生命周期')), sandbox);
await handlers.get('browser:bounds')(null, { x: 10, y: 20, width: 300, height: 400, visible: true, seq: 7, session_id: 'abc', dpr: 1.5 });
let payload = JSON.parse(requests.at(-1).options.body);
assert.equal(payload.x, 15);
assert.equal(payload.width, 450);
assert.equal(payload.session_id, 'abc');
assert.equal(scriptReads, 0, 'bounds never executes a renderer script');
await handlers.get('browser:bounds')(null, { x: 10, dpr: NaN });
payload = JSON.parse(requests.at(-1).options.body);
assert.equal(payload.x, 20, 'invalid DPR falls back to host monitor');
body = { ok: false, error: 'native close failed' };
const result = await handlers.get('browser:close')();
assert.equal(result.ok, false);
assert.equal(result.error, 'native close failed');
console.log('PASS Electron DPR conversion, session identity, timeouts and native error propagation');

const events = new Map(), order = [];
let finish;
const lifecycle = {
  app: { on: (name, run) => events.set(name, run), quit: () => order.push('quit') },
  quitting: false, stopSidecar: () => order.push('stop'), log: () => {},
  closeBrowserSession: shutdown => { assert.equal(shutdown, true); order.push('close'); return new Promise(resolve => { finish = resolve; }); },
};
vm.runInNewContext(source.slice(source.indexOf('let shutdownComplete = false;')), lifecycle);
let prevented = 0;
events.get('before-quit')({ preventDefault() { prevented++; } });
events.get('before-quit')({ preventDefault() { prevented++; } });
assert.equal(prevented, 2);
assert.deepEqual(order, ['close'], 'sidecar stays alive during native cleanup');
finish({ ok: true });
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(order, ['close', 'stop', 'quit']);
events.get('before-quit')({ preventDefault() { throw Error('completed shutdown must not be prevented'); } });
console.log('PASS application shutdown waits for native cleanup and prevents duplicate shutdown');
