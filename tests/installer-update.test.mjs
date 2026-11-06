import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync, mkdirSync, utimesSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { createInstallerUpdate, installerAsset, fetchAsset } = require('../electron/installer-update');
const { createUpdateService } = require('../electron/update-service');
const { handoff } = require('../electron/update-handoff.cjs');
const { resolveUpdateDirectory } = require('../electron/update-directory');
const { stageInstaller, pruneUpdateStaging } = require('../electron/update-staging');
const root = mkdtempSync(path.join(os.tmpdir(), 'lithub-download-'));
const payload = Buffer.from('isolated installer fixture');
const digest = createHash('sha256').update(payload).digest('hex');
const raw = { tag_name: 'v0.3.0', assets: [{ name: '文枢 LitHub Setup 0.3.0.exe', size: payload.length,
  digest: `sha256:${digest}`, state: 'uploaded', browser_download_url: 'https://evil.test/file.exe' }] };
const release = { version: '0.3.0', installer: installerAsset(raw) };
let seq = 0;
function make(extra = {}) {
  const directory = path.join(root, String(seq++)), events = [], installed = [];
  const updater = createInstallerUpdate({ directory, fetch: async () => new Response(payload),
    resolveRelease: async () => release, onChange: () => events.push(updater.getState()),
    install: async file => { installed.push(readFileSync(file)); return true; }, ...extra });
  return { updater, directory, events, installed };
}
try {
  const program = path.join(root, '应用程序'), userData = path.join(root, '用户数据'), desktop = path.join(root, '桌面');
  mkdirSync(program); mkdirSync(desktop);
  const beforeDirectoryCheck = process.cwd();
  process.chdir(desktop);
  let directory;
  try { directory = await resolveUpdateDirectory({ executable:path.join(program,'LitHub.exe'), userData }); }
  finally { process.chdir(beforeDirectoryCheck); }
  assert.equal(directory, path.join(program,'updates'));
  assert.deepEqual(readdirSync(desktop), [], 'desktop working directory is never used for update storage');
  assert.deepEqual(readdirSync(directory), [], 'writability probes are removed');
  const fallback = await resolveUpdateDirectory({executable:path.join(program,'LitHub.exe'),userData,
    filesystem:{mkdir:async p=>{if(p.startsWith(program))throw Error('read only');},open:async()=>({close:async()=>{}}),unlink:async()=>{}}});
  assert.equal(fallback,path.join(userData,'updates'));
  await assert.rejects(resolveUpdateDirectory({executable:path.join(program,'LitHub.exe'),userData,
    filesystem:{mkdir:async()=>{throw Error('denied');},unlink:async()=>{}}}),/写入权限/);
  console.log('PASS executable-relative update directory, desktop cwd isolation and read-only fallback');

  assert.match(release.installer.url, /^https:\/\/github.com\/InfiniteLin\/LitHub\/releases\/download\/v0.3.0\//);
  assert.ok(!release.installer.url.includes('evil'));
  for (const name of ['../../evil.exe', 'LitHub Setup 0.3.0-arm64.exe/evil.exe', 'uninstall.exe']) {
    assert.equal(installerAsset({ ...raw, assets: [{ ...raw.assets[0], name }] }), null);
  }
  assert.equal(installerAsset({ ...raw, assets: [raw.assets[0], raw.assets[0]] }), null);
  let requested = [];
  await assert.rejects(fetchAsset(async url => {
    requested.push(url); return new Response(null, { status:302, headers:{location:'http://127.0.0.1/internal'} });
  }, release.installer.url), /地址/);
  assert.equal(requested.length, 1, 'forbidden redirect rejected before request');
  requested = [];
  await fetchAsset(async url => {
    requested.push(url);
    return requested.length === 1 ? new Response(null, {status:302,headers:{location:'https://release-assets.githubusercontent.com/asset'}}) : new Response(payload);
  }, release.installer.url);
  assert.equal(requested.length, 2);
  console.log('PASS fixed repository, unambiguous installer selection and restricted redirects');

  const ok = make();
  const a = ok.updater.download(), b = ok.updater.download();
  assert.equal(a, b);
  await a;
  assert.equal(ok.updater.getState().status, 'ready');
  assert.equal(ok.updater.getState().received, payload.length);
  assert.ok(ok.events.some(e=>e.status==='downloading'));
  await ok.updater.install();
  assert.deepEqual(ok.installed, [payload]);
  const cachedFolder = path.join(ok.directory,readdirSync(ok.directory)[0]);
  utimesSync(path.join(cachedFolder,'.lithub-update'),new Date(0),new Date(0));
  const reused = make({directory:ok.directory,fetch:async()=>{throw Error('cache must not be downloaded again');}});
  await reused.updater.download();
  assert.equal(reused.updater.getState().status,'ready','validated cached installers survive restart and expiry pruning');
  await reused.updater.install();assert.deepEqual(reused.installed,[payload]);
  const invalidated = make({directory:ok.directory});
  writeFileSync(path.join(cachedFolder,'installer.exe'),Buffer.alloc(payload.length, 1));
  await invalidated.updater.download();
  assert.equal(invalidated.updater.getState().status,'ready','corrupt cached installer is downloaded afresh');
  assert.equal(existsSync(cachedFolder),false);
  const tamper = make(); await tamper.updater.download();
  const file = path.join(tamper.directory, readdirSync(tamper.directory)[0], 'installer.exe');
  writeFileSync(file, Buffer.alloc(payload.length, 1));
  await tamper.updater.install();
  assert.equal(tamper.installed.length, 0);
  assert.match(tamper.updater.getState().error, /校验/);
  console.log('PASS coalesced downloads, progress, SHA-256 and install-time tamper detection');

  for (const extra of [
    {fetch:async()=>new Response(Buffer.from('truncated'))},
    {fetch:async()=>new Response(Buffer.alloc(payload.length, 2))},
    {fetch:async()=>new Response(Buffer.alloc(payload.length + 1))},
    {fetch:async()=>new Response(null,{status:503})},
    {resolveRelease:async()=>({ ...release, installer:{...release.installer,sha256:''} })},
    {resolveRelease:async()=>({ ...release, installer:null })},
  ]) {
    const bad = make(extra); await bad.updater.download();
    assert.equal(bad.updater.getState().status, 'error');
    assert.deepEqual(existsSync(bad.directory) ? readdirSync(bad.directory) : [], []);
    await assert.rejects(bad.updater.install(), /先下载/);
    assert.equal(bad.installed.length, 0);
  }
  let calls = 0;
  const retry = make({fetch:async()=>++calls===1 ? new Response(null,{status:500}) : new Response(payload)});
  await retry.updater.download(); await retry.updater.download();
  assert.equal(retry.updater.getState().status, 'ready');
  let started;
  const startedPromise = new Promise(r=>started=r);
  const cancel = make({fetch:async(_url,{signal})=>new Response(new ReadableStream({
    start(c) { c.enqueue(payload.subarray(0,3)); started(); signal.addEventListener('abort',()=>c.error(signal.reason)); }
  }))});
  const pending = cancel.updater.download(); await startedPromise; cancel.updater.cancel(); await pending;
  assert.equal(cancel.updater.getState().status, 'idle');
  assert.deepEqual(readdirSync(cancel.directory), []);
  const dev = make({enabled:false}); await assert.rejects(dev.updater.download(), /安装版/);
  let directorySelections=0;
  const lazy = make({directory:async()=>{directorySelections++;return path.join(program,'updates');}});
  assert.equal(directorySelections,0);
  await lazy.updater.download();assert.equal(directorySelections,1);assert.equal(lazy.updater.getState().status,'ready');
  assert.deepEqual(readdirSync(desktop),[]);
  console.log('PASS truncation, corruption, size overflow, HTTP failures, missing digest, cancel, retry and dev guard');

  const metadata = {...raw, draft:false, prerelease:false};
  let checks = 0, installs = 0, assetRequests = 0;
  const service = createUpdateService({version:'0.2.0',storageFile:path.join(root,'service.json'),canInstall:true,
    fetch:async url=>{ if(url.includes('api.github.com')) { checks++; return new Response(JSON.stringify(metadata)); } assetRequests++;return new Response(payload); },
    install:async()=>{installs++;return false;},openExternal:async()=>{throw Error('should not open browser');} });
  await service.check({automatic:true});assert.equal(assetRequests,0,'automatic checks never download installers');
  await service.download();
  assert.equal(checks, 2, 'fresh metadata before downloading');
  assert.equal(service.getState().download.status, 'ready');
  await service.install(); assert.equal(installs, 1); assert.equal(service.getState().download.status, 'ready');
  service.stop();

  const stagingRoot=path.join(root,'staging');mkdirSync(stagingRoot);
  const source=path.join(root,'source.exe');writeFileSync(source,payload);
  const staged=await stageInstaller(source,stagingRoot);
  assert.deepEqual(readFileSync(staged.file),payload);
  rmSync(source);assert.deepEqual(readFileSync(staged.file),payload,'old uninstall cannot delete the executing installer');
  const untouched=path.join(stagingRoot,'lithub-update-handoff-unmarked');mkdirSync(untouched);writeFileSync(path.join(untouched,'keep'),'personal');
  await pruneUpdateStaging({temporaryDirectory:stagingRoot,now:Date.now()+2*86400000});
  assert.equal(existsSync(staged.directory),false);assert.equal(existsSync(path.join(untouched,'keep')),true);
  console.log('PASS cache reuse across restarts, corrupt cache retry, lazy directory selection and safe temporary staging cleanup');

  const marker = path.join(root,'launched.json');
  const stub = path.join(root,'stub.cjs');
  writeFileSync(stub, `require('node:fs').writeFileSync(${JSON.stringify(marker)},JSON.stringify({env:process.env.ELECTRON_RUN_AS_NODE||'',args:process.argv.slice(2)}));`);
  const parent = spawn(process.execPath, ['-e','setInterval(()=>{},1000)'], {stdio:'ignore'});
  await new Promise((resolve,reject)=>{parent.once('spawn',resolve);parent.once('error',reject);});
  const before = process.env.ELECTRON_RUN_AS_NODE; process.env.ELECTRON_RUN_AS_NODE='1';
  const handed = handoff({parentPid:parent.pid,installer:process.execPath,executable:'C:/中文目录/LitHub.exe',args:[stub,'/S','--updated']});
  await new Promise(r=>setTimeout(r,250)); assert.equal(existsSync(marker),false);
  parent.kill(); await new Promise(r=>parent.once('exit',r)); await handed;
  if (before===undefined) delete process.env.ELECTRON_RUN_AS_NODE; else process.env.ELECTRON_RUN_AS_NODE=before;
  for(let i=0;i<100&&!existsSync(marker);i++) await new Promise(r=>setTimeout(r,30));
  assert.deepEqual(JSON.parse(readFileSync(marker)), {env:'',args:['/S','--updated']});
  console.log('PASS fresh release metadata, postpone install and wait-for-exit handoff with clean restart environment');
} finally { rmSync(root, { recursive:true, force:true }); }
