/* Real DOM/router regression; native window calls and PDF loading are isolated doubles.
   No sidecar, personal library, AI service or logged-in browser profile is used. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { findBrowser } from './_browser.mjs';

const root = path.resolve('frontend');
const viewMode = process.argv.includes('--view');
const server = createServer(async (req, res) => {
  try {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://local').pathname.replace(/\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) throw Error('invalid path');
    const data = await readFile(file);
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const debugPort = 11000 + Math.floor(Math.random() * 1000);
const profile = mkdtempSync(path.join(tmpdir(), 'lithub-session-test-'));
const chrome = spawn(findBrowser(), ['--headless=new', '--disable-gpu', '--no-first-run',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
try {
  let target;
  for (let i = 0; i < 80 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!target) await sleep(100);
  }
  assert.ok(target, 'browser started');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0;
  const pending = new Map(), errors = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise(resolve => {
    const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description);
    return r.result.result.value;
  };
  const check = async (name, expression) => { assert.equal(await evaluate(expression), true, name); console.log('PASS ' + name); };
  const route = async hash => {
    await evaluate(`location.hash = ${JSON.stringify(hash)}`);
    await sleep(220);
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.native = { opens: [], closes: 0, visible: false, delay: false, release: null, fail: false };
    const adapter = {
      async embed(opts) {
        native.opens.push(opts.url);
        if (native.delay) await new Promise(r => native.release = r);
        native.visible = !native.fail;
        return { ok: !native.fail, error: 'test failure' };
      },
      async close() { native.closes++; native.visible = false; return { ok: true }; },
      async setBounds(r) { native.visible = r.visible; return { ok: true }; }
    };
    adapter.open = url => adapter.embed({ url });
    adapter.hide = () => adapter.close();
    window.lithub = ${viewMode ? '{ webAi: adapter }' : '{ browser: adapter }'};
  ` });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/#/library` });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    ready = await evaluate(`typeof state !== 'undefined' && !!document.querySelector('#view')`);
    if (ready) break;
    await sleep(100);
  }
  assert.ok(ready, 'application scripts and initial view ready');
  await evaluate(`
    window.a = state.db.papers[0].id; window.b = state.db.papers[1].id;
    // Delayed PDF layout exercises scroll restoration after an asynchronous mount.
    window.pdfMounts = 0;
    PdfView.mount = async pane => {
      pdfMounts++;
      await new Promise(r => setTimeout(r, 60));
      pane.innerHTML = '<div style="height:9000px">Test PDF</div>';
      return 10;
    };
    state.db.papers.slice(0,2).forEach(p => { p.live = true; p.translated = false; });
    readerSession(a).mode = 'en';
  `);
  await route('#/reader/' + await evaluate('a'));
  await evaluate(`state.reader.fit = 'manual'; state.reader.zoom = 1.5; state.reader.webAiWidth = 55;
    document.querySelector('#pane-en').scrollTop = 700;
    openWebAiInline('https://example.test/first')`);
  await sleep(160);
  await check('open does not remount PDF', `window.pdfMounts === 1`);
  await check('open keeps PDF scroll', `document.querySelector('#pane-en').scrollTop === 700`);
  await check('divider does not overlap paper or scrollbar', `(() => {
    const paper = document.querySelector('#pane-en').getBoundingClientRect();
    const divider = document.querySelector('#webai-divider').getBoundingClientRect();
    return divider.width === 8 && divider.left >= paper.right - 0.5
      && !document.elementFromPoint(paper.right - 3, paper.top + 100).closest('#webai-divider');
  })()`);
  const dividerPoint = () => evaluate(`(() => {
    const r = document.querySelector('#webai-divider').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 160 };
  })()`);
  let point = await dividerPoint();
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...point, deltaY: 180, deltaX: 0 });
  await sleep(120);
  await check('real wheel over divider scrolls paper without starting resize', `document.querySelector('#pane-en').scrollTop > 700
    && !document.body.classList.contains('webai-resizing')`);
  await check('line and page wheel units scroll correctly', `(() => {
    const pane = document.querySelector('#pane-en'), divider = document.querySelector('#webai-divider');
    pane.scrollTop = 100;
    const line = parseFloat(getComputedStyle(pane).lineHeight) || 16;
    divider.dispatchEvent(new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, bubbles: true, cancelable: true }));
    const lineOK = Math.abs(pane.scrollTop - (100 + 3 * line)) < 1;
    const before = pane.scrollTop;
    divider.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, deltaMode: 2, bubbles: true, cancelable: true }));
    return lineOK && Math.abs(pane.scrollTop - before - pane.clientHeight) < 1;
  })()`);
  await check('Ctrl wheel on divider zooms without scrolling', `(() => {
    const pane = document.querySelector('#pane-en'), before = pane.scrollTop, zoom = state.reader.zoom;
    document.querySelector('#webai-divider').dispatchEvent(new WheelEvent('wheel', {
      deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }));
    return state.reader.zoom > zoom && pane.scrollTop === before;
  })()`);
  point = await dividerPoint();
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  // CDP 的确认早于页面收到输入；等 pointerdown 完成后再发送拖动。
  for (let i = 0; i < 40 && !await evaluate(`document.body.classList.contains('webai-resizing')`); i++) await sleep(25);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x - 80, y: point.y, buttons: 1 });
  for (let i = 0; i < 40 && !await evaluate(`state.reader.webAiWidth > 55`); i++) await sleep(25);
  await check('divider still resizes by dragging', `document.body.classList.contains('webai-resizing') && state.reader.webAiWidth > 55`);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x - 80, y: point.y, button: 'left', clickCount: 1 });
  await check('release clears resize cursor', `!document.body.classList.contains('webai-resizing')`);
  for (const cancellation of ['cancel', 'blur']) {
    point = await dividerPoint();
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await evaluate(cancellation === 'blur' ? `window.dispatchEvent(new Event('blur'))` : `(() => {
      const d = document.querySelector('#webai-divider');
      d.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await check(cancellation + ' clears resize state', `!document.body.classList.contains('webai-resizing')`);
  }
  point = await dividerPoint();
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  // Process pending pointer capture before removing the divider through navigation.
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x - 1, y: point.y, buttons: 1 });
  await route('#/settings');
  await check('navigation during drag clears resize cursor', `!document.body.classList.contains('webai-resizing')`);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  await route('#/reader/' + await evaluate('a'));
  await evaluate(`state.reader.zoom = 1.5; state.reader.webAiWidth = 55;
    document.querySelector('#pane-en').scrollTop = 700; renderReader(a);`);
  await sleep(160);
  for (const dest of ['#/library', '#/settings', '#/tasks', '#/note/' + await evaluate('a')]) {
    await route(dest);
    await check('hidden on ' + dest, `!native.visible && native.closes === 0`);
    await route('#/reader/' + await evaluate('a'));
    await check('restored from ' + dest, `native.visible && native.opens.length === 1 && state.reader.webAi
      && state.reader.zoom === 1.5 && state.reader.fit === 'manual' && state.reader.webAiWidth === 55
      && document.querySelector('#pane-en').scrollTop === 700`);
  }
  await route('#/reader/' + await evaluate('b'));
  await check('other paper has independent state and hides AI', `!native.visible && !state.reader.webAi && state.reader.zoom === 1`);
  await route('#/reader/' + await evaluate('a'));
  await check('original paper retains native session', `native.visible && native.opens.length === 1`);
  await evaluate(`openWebAiInline('https://example.test/second')`);
  await check('explicit site change navigates', `native.opens.at(-1) === 'https://example.test/second'`);
  await evaluate('closeWebAiInline(); webAiController.whenIdle()');
  await route('#/library');
  await route('#/reader/' + await evaluate('a'));
  await check('explicit close does not revive', `!native.visible && !state.reader.webAi`);
  await evaluate(`native.delay = true; window.opening = openWebAiInline('https://example.test/slow'); void 0`);
  await sleep(80);
  await route('#/settings');
  await evaluate('native.release(); opening');
  await check('open completing offscreen remains hidden', `!native.visible`);
  await route('#/reader/' + await evaluate('a'));
  await check('offscreen completion restored without navigation', `native.visible && state.reader.webAi && native.opens.length === 3`);
  await evaluate(`window.opening = openWebAiInline('https://example.test/cancel'); void 0`);
  await sleep(80);
  await evaluate('closeWebAiInline(); native.release(); opening.then(() => webAiController.whenIdle())');
  await check('close during open wins', `!native.visible && !state.reader.webAi`);
  await evaluate(`native.delay = false; native.fail = true; openWebAiInline('https://example.test/fail')`);
  await check('failed open clears panel', `!state.reader.webAi && !native.visible`);
  await evaluate(`native.fail = false; openWebAiInline('https://example.test/final')`);
  await route('#/library');
  await evaluate(`closeTab('paper:' + a); webAiController.whenIdle()`);
  await check('closing inactive reader tab cleans native session', `!native.visible && !readerSessions.has(a)`);
  await route('#/reader/' + await evaluate('a'));
  await evaluate(`native.delay = true; window.opening = openWebAiInline('https://example.test/deleted'); void 0`);
  await sleep(80);
  await evaluate(`closeTab('paper:' + a); native.release(); opening.then(() => webAiController.whenIdle())`);
  await sleep(100);
  await check('closing tab during pending open cleans window', `!native.visible && !readerSessions.has(a)`);
  await route('#/reader/' + await evaluate('a'));
  await evaluate(`native.delay = false; openWebAiInline('https://example.test/owner-a')`);
  await route('#/reader/' + await evaluate('b'));
  await evaluate(`openWebAiInline('https://example.test/owner-b')`);
  await check('explicit opening on another paper transfers single window', `native.visible && webAiController.owner === b && !readerSession(a).webAi`);
  await route('#/reader/' + await evaluate('a'));
  await check('old owner does not revive replaced session', `!native.visible && !state.reader.webAi`);
  await evaluate(`const queued = openWebAiInline('https://example.test/queued'); closeWebAiInline(); queued.then(() => webAiController.whenIdle())`);
  await check('close cancels not-yet-started open', `!native.visible && !state.reader.webAi && native.opens.at(-1) !== 'https://example.test/queued'`);
  await evaluate(`openWebAiInline('https://example.test/shared')`);
  const opensBeforeTransfer = await evaluate('native.opens.length');
  await route('#/reader/' + await evaluate('b'));
  await evaluate(`window.pdfBeforeTransfer = document.querySelector('#pane-en, #pane-dual2'); openWebAiInline('https://example.test/shared')`);
  await sleep(100);
  await check('same-site session transfers without reopening or remounting', `native.opens.length === ${opensBeforeTransfer}
    && native.visible && webAiController.owner === b
    && window.pdfBeforeTransfer === document.querySelector('#pane-en, #pane-dual2')
    && document.querySelector('#webai-pane-url').textContent === paperById(b).title`);
  await evaluate(`
    window.storageCalls = 0; window.storageFailure = false;
    LithubAPI.live = true;
    LithubAPI.pdfStorage = async () => ({ directory: 'D:/Current', default_directory: 'D:/App/pdfs',
      originals_directory: 'D:/Current/files', translated_directory: 'D:/Current/out', metadata_directory: 'D:/Metadata' });
    LithubAPI.setPdfStorage = async directory => {
      storageCalls++;
      if (storageFailure) throw new Error('test read-only folder');
      return { directory, default_directory: 'D:/App/pdfs', originals_directory: directory + '/files',
        translated_directory: directory + '/out', metadata_directory: 'D:/Metadata' };
    };
    window.lithub.pdfStorage = {
      pickDirectory: async () => ({ ok: true, directory: 'E:/自定义文献' }),
      openDirectory: async () => ({ ok: true }),
    };
    state.settingsTab = 'storage';
  `);
  await route('#/settings');
  await check('storage settings load and show actual paths', `document.querySelector('#set-pdf-directory').value === 'D:/Current'
    && document.querySelector('.set-body').textContent.includes('D:/Current/files')`);
  await evaluate(`document.querySelector('[data-action="pdf-storage-browse"]').click()`);
  await sleep(30);
  await check('folder picker changes draft only', `document.querySelector('#set-pdf-directory').value === 'E:/自定义文献' && storageCalls === 0`);
  await evaluate(`document.querySelector('[data-action="pdf-storage-apply"]').click()`);
  await sleep(50);
  await check('apply migration updates active path and closes progress', `pdfStorageState.info.directory === 'E:/自定义文献'
    && storageCalls === 1 && !pdfStorageState.busy && !document.querySelector('#overlay-root .modal-mask')`);
  await evaluate(`storageFailure = true; document.querySelector('#set-pdf-directory').value = 'E:/blocked';
    document.querySelector('[data-action="pdf-storage-apply"]').click()`);
  await sleep(50);
  await check('failed migration keeps previous setting', `pdfStorageState.info.directory === 'E:/自定义文献' && !pdfStorageState.busy`);
  await evaluate(`document.querySelector('[data-action="pdf-storage-default"]').click()`);
  await check('default button selects program folder without moving files', `document.querySelector('#set-pdf-directory').value === 'D:/App/pdfs' && storageCalls === 2`);
  await evaluate('LithubAPI.live = false');
  assert.deepEqual(errors, [], 'no uncaught browser errors');
} finally {
  ws?.close(); chrome.kill(); server.close();
}
