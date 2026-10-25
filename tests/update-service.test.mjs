import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { createUpdateService, registerUpdateIPC, compareVersions, normalizeRelease } = require('../electron/update-service.js');
const root = mkdtempSync(path.join(os.tmpdir(), 'lithub-update-tests-'));
let seq = 0;
const release = (tag = 'v0.1.2', extra = {}) => ({ tag_name: tag, draft: false, prerelease: false,
  name: 'New version', body: 'Update notes', published_at: '2026-10-25T00:00:00Z', ...extra });
const reply = (data = release(), status = 200, headers = {}) => ({ ok: status >= 200 && status < 300, status,
  headers: { get: key => headers[key] ?? null }, json: async () => data });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function make(options = {}) {
  let time = Date.UTC(2026, 9, 25), response = async () => reply();
  const requests = [], events = [], opened = [];
  const storageFile = options.storageFile || path.join(root, `${seq++}.json`);
  const service = createUpdateService({ version: options.version || '0.1.1', storageFile,
    fetch: async (url, opts) => { requests.push({ url, opts }); return response(url, opts); },
    openExternal: async url => { opened.push(url); }, now: () => time,
    onChange: state => events.push(state), ...options });
  return { service, storageFile, requests, events, opened, setResponse: fn => { response = fn; },
    advance: ms => { time += ms; } };
}
try {
  for (const [a, b, expected] of [['0.1.10','0.1.9',1], ['v1.0.0','0.99.0',1], ['1.0.0+build','1.0.0',0],
    ['1.0.0-beta.2','1.0.0-beta.10',-1], ['1.0.0-beta','1.0.0',-1], ['1.0.0-1','1.0.0-a',-1],
    ['1.0.0-alpha','1.0.0-alpha.1',-1], ['9007199254740993.0.0','9007199254740992.0.0',1]]) {
    assert.equal(compareVersions(a,b), expected, `${a} versus ${b}`);
  }
  for (const bad of ['1.0','01.0.0','1.0.0-01','1.0.0/evil','1.0.0\n','latest']) assert.throws(() => compareVersions(bad, '1.0.0'));
  assert.equal(normalizeRelease(release('v1.0.0-beta')), null);
  assert.equal(normalizeRelease(release('v1.0.0', { draft: true })), null);
  assert.equal(normalizeRelease(release('v1.0.0', { prerelease: true })), null);
  const hostile = normalizeRelease(release('v1.0.0+build', { html_url: 'javascript:alert(1)', body: 'x'.repeat(40000) }));
  assert.equal(hostile.url, 'https://github.com/InfiniteLin/LitHub/releases/tag/v1.0.0%2Bbuild');
  assert.equal(hostile.notes.length, 20000);
  console.log('PASS semantic versions, formal-release filtering and fixed release URLs');

  const x = make();
  const gate = deferred(); x.setResponse(() => gate.promise);
  const first = x.service.check({ automatic: true }), second = x.service.check();
  assert.equal(first, second, 'manual and scheduled checks share one request');
  await Promise.resolve(); assert.equal(x.service.getState().status, 'checking');
  gate.resolve(reply()); await first;
  assert.equal(x.requests.length, 1);
  assert.equal(x.requests[0].opts.credentials, 'omit');
  assert.equal(x.requests[0].opts.redirect, 'error');
  assert.equal(x.service.getState().status, 'available');
  assert.equal(x.events.filter(e => e.notify).length, 1);
  await x.service.openRelease('javascript:ignored');
  assert.deepEqual(x.opened, ['https://github.com/InfiniteLin/LitHub/releases/tag/v0.1.2']);
  await x.service.check({ automatic: true }); assert.equal(x.requests.length, 1, 'daily throttle');
  const reload = make({ storageFile: x.storageFile });
  assert.equal(reload.service.getState().status, 'available');
  await reload.service.check({ automatic: true }); assert.equal(reload.requests.length, 0, 'throttle survives restart');
  x.advance(86400001); x.setResponse(async () => reply()); await x.service.check({ automatic: true });
  assert.equal(x.events.filter(e => e.notify).length, 1, 'same version does not notify twice');
  await x.service.setAutoCheck(false);
  assert.equal(JSON.parse(readFileSync(x.storageFile)).autoCheck, false);
  x.advance(86400001); await x.service.check({ automatic: true }); assert.equal(x.requests.length, 2);
  await x.service.check(); assert.equal(x.requests.length, 3, 'manual check bypasses preference and daily throttle');
  assert.equal(make({ storageFile: x.storageFile }).service.getState().autoCheck, false);
  console.log('PASS request coalescing, daily persistence, opt-out, manual retry and once-per-version notices');

  for (const [data, status, expected] of [[release('v0.1.1'),200,'up-to-date'], [release('v0.1.0'),200,'up-to-date'],
    [release('v0.1.2-beta'),200,'unavailable'], [release('v0.1.2',{draft:true}),200,'unavailable'],
    [{},200,'error'], [null,200,'error'], [null,404,'unavailable'], [null,500,'error']]) {
    const t = make(); t.setResponse(async () => reply(data,status));
    assert.equal((await t.service.check()).status, expected);
    assert.equal(t.events.some(e => e.notify), false, 'manual/error checks do not notify');
  }
  const offline = make(); offline.setResponse(async () => { throw new TypeError('fetch failed'); });
  assert.equal((await offline.service.check()).status, 'error');
  assert.equal(offline.service.getState().checkedAt, 0, 'failure is not recorded as successful check');
  const badJSON = make(); badJSON.setResponse(async () => ({ status:200,ok:true,json:async()=>{throw Error('bad JSON');} }));
  assert.equal((await badJSON.service.check()).status, 'error');
  const rate = make(); rate.setResponse(async () => reply(null,429,{'retry-after':'120'}));
  await rate.service.check(); await rate.service.check(); assert.equal(rate.requests.length, 1);
  rate.advance(120001); rate.setResponse(async () => reply()); await rate.service.check();
  assert.equal(rate.service.getState().status, 'available');
  console.log('PASS equal/newer installed versions, empty releases, offline/JSON/HTTP failures and rate-limit backoff');

  const timeoutHandles = [];
  const timers = { setTimeout: fn => { const h={fn,unref(){}};timeoutHandles.push(h);return h; },
    clearTimeout: h => { if(h)h.cleared=true; },setInterval: fn=>({fn,unref(){}}),clearInterval:()=>{} };
  const timeout = make({ timers });
  timeout.setResponse((_url, {signal}) => new Promise((_,reject) => signal.addEventListener('abort',()=>reject(Error('aborted')))));
  const waiting = timeout.service.check(); await Promise.resolve(); timeoutHandles.at(-1).fn();
  assert.match((await waiting).error, /超时/);
  const stop = timeout.service.check(); await Promise.resolve(); timeout.service.stop(); await stop;
  const stopped = make(); const abortedBeforeStart = stopped.service.check(); stopped.service.stop(); await abortedBeforeStart;
  assert.equal(stopped.requests.length,0);
  const schedule = make({ timers }); schedule.service.start(); const n=timeoutHandles.length;
  schedule.service.start(); assert.equal(timeoutHandles.length,n);
  const startup = timeoutHandles.at(-1); startup.fn(); await schedule.service.check({automatic:true});
  assert.equal(schedule.requests.length,1); assert.equal(schedule.events.some(e=>e.notify),true);
  schedule.service.stop(); assert.equal(startup.cleared,true);
  console.log('PASS timeout, shutdown cancellation and timer cleanup');

  const cacheFile = path.join(root,'bad-cache.json');
  writeFileSync(cacheFile, JSON.stringify({ autoCheck:false,checkedAt:Date.UTC(2026,9,24),release:{tag:'bad',url:'javascript:bad'} }));
  const badCache=make({storageFile:cacheFile}); assert.equal(badCache.service.getState().status,'idle');
  writeFileSync(cacheFile,'broken JSON'); assert.equal(make({storageFile:cacheFile}).service.getState().autoCheck,true);
  const unwritable=make({storageFile:path.join(root,'parent-is-file','config.json')});
  writeFileSync(path.join(root,'parent-is-file'),'x');
  assert.throws(()=>unwritable.service.setAutoCheck(false),/无法保存/);
  assert.equal(unwritable.service.getState().autoCheck,true);
  assert.equal((await unwritable.service.check()).status,'available');
  assert.match(unwritable.service.getState().settingsError,/未能保存/);
  const toggled=make();const hold=deferred();toggled.setResponse(()=>hold.promise);
  const pending=toggled.service.check({automatic:true});await Promise.resolve();toggled.service.setAutoCheck(false);
  hold.resolve(reply());await pending;assert.equal(toggled.events.some(e=>e.notify),false);
  console.log('PASS corrupt caches, preference write failure and opt-out during an automatic request');

  const handlers=new Map();registerUpdateIPC({handle:(name,fn)=>handlers.set(name,fn)},()=>x.service,e=>e.own);
  assert.throws(()=>handlers.get('updates:check')({own:false}),/来源/);
  assert.throws(()=>handlers.get('updates:auto-check')({own:true},'false'),/格式/);
  assert.equal(handlers.get('updates:state')({own:true}).currentVersion,'0.1.1');
  let exposed;const listeners=new Map(),calls=[];
  vm.runInNewContext(readFileSync('electron/preload.js','utf8'),{process,require:()=>({contextBridge:{exposeInMainWorld:(_name,x)=>{exposed=x;}},
    ipcRenderer:{invoke:(...x)=>{calls.push(x);return Promise.resolve();},on:(n,f)=>listeners.set(n,f),removeListener:(n,f)=>{assert.equal(listeners.get(n),f);listeners.delete(n);}}})});
  let delivered;const unsubscribe=exposed.updates.onChange(s=>{delivered=s;});
  listeners.get('updates:changed')({untrustedEvent:true},{version:'1'});assert.equal(delivered.version,'1');
  unsubscribe();assert.equal(listeners.has('updates:changed'),false);
  await exposed.updates.openRelease('javascript:ignored');assert.deepEqual(calls.at(-1),['updates:open-release']);
  console.log('PASS own-window IPC, typed preferences and preload event unsubscribe');

  const initial=deferred();let uiListener,uiNotices=0;
  const browser={lithub:{updates:{getState:()=>initial.promise,onChange:fn=>{uiListener=fn;return()=>{};},
    check:async()=>{throw Error('IPC unavailable');},setAutoCheck:async()=>{throw Error('write failed');}}}};
  vm.runInNewContext(readFileSync('frontend/js/app-updates.js','utf8'),{window:browser});
  const ui=browser.AppUpdates,initialized=ui.init({onAvailable:()=>{uiNotices++;}});
  const newer={currentVersion:'0.1.1',status:'available',autoCheck:true,revision:3,hasUpdate:true,
    notify:true,release:{version:'0.1.2',notes:'<script>bad</script>'}};
  uiListener(newer); initial.resolve({...newer,revision:1,status:'idle',hasUpdate:false});await initialized;
  assert.equal(ui.hasUpdate(),true,'late initial state cannot overwrite a newer event');
  assert.equal(uiNotices,1);assert.ok(ui.html().includes('&lt;script&gt;bad&lt;/script&gt;'));
  await assert.rejects(ui.setAutoCheck(false),/write failed/);
  assert.ok(ui.html().includes('id="set-update-auto" checked'),'failed preference write restores checkbox');
  await ui.check();assert.ok(ui.html().includes('IPC unavailable'));
  const late=deferred();browser.lithub.updates.getState=()=>late.promise;
  const oldInit=ui.init();delete browser.lithub;await ui.init();late.resolve(newer);await oldInit;
  assert.ok(ui.html().includes('浏览器预览'));assert.equal(ui.hasUpdate(),false);
  console.log('PASS renderer stale snapshots, safe notes, IPC failures and obsolete initialization');
} finally { rmSync(root,{recursive:true,force:true}); }
