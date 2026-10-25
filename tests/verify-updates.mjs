/* Real settings UI, isolated Chrome profile, mocked desktop bridge; no personal library or GitHub writes. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { findBrowser } from './_browser.mjs';
const root = path.resolve('frontend');
const server = createServer(async (req,res) => {
  try {
    const pathname = new URL(req.url,'http://local').pathname;
    const file = path.resolve(root,'.'+pathname.replace(/\/$/,'/index.html'));
    if (!file.startsWith(root+path.sep)) throw Error('path');
    const data=await readFile(file);
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port,debugPort=14000+Math.floor(Math.random()*1000);
const chrome=spawn(findBrowser(),['--headless=new','--disable-gpu','--no-first-run',
  `--user-data-dir=${mkdtempSync(path.join(tmpdir(),'lithub-updates-ui-'))}`,`--remote-debugging-port=${debugPort}`,'about:blank'],
  {stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws;
try {
  let target;
  for(let i=0;i<80&&!target;i++) {
    try { target=(await(await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(t=>t.type==='page'); } catch {}
    if(!target)await sleep(100);
  }
  assert.ok(target);ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>{ws.onopen=r;});
  let id=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
  const send=(method,params={})=>new Promise(resolve=>{const n=++id;pending.set(n,resolve);ws.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description);return r.result.result.value;};
  const until=async(name,expr)=>{for(let i=0;i<120;i++){if(await evaluate(expr)){console.log('PASS '+name);return;}await sleep(50);}throw Error('timeout: '+name);};
  const check=async(name,expr)=>{assert.equal(await evaluate(expr),true,name);console.log('PASS '+name);};
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Network.setBlockedURLs',{urls:['https://*']});
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.updateSnapshot={currentVersion:'0.1.1',autoCheck:true,status:'idle',revision:1,checkedAt:0,release:null,hasUpdate:false};
    window.updateListener=null;window.updateOpened=0;window.updateSaved=[];
    window.emitUpdate=patch=>{Object.assign(updateSnapshot,patch,{revision:updateSnapshot.revision+1});updateListener?.({...updateSnapshot});delete updateSnapshot.notify;};
    window.lithub={updates:{getState:async()=>({...updateSnapshot}),
      onChange:fn=>{updateListener=fn;return()=>{updateListener=null;}},
      check:()=>new Promise(resolve=>{emitUpdate({status:'checking',error:''});window.finishCheck=patch=>{emitUpdate(patch);resolve({...updateSnapshot});};}),
      setAutoCheck:async enabled=>{updateSaved.push(enabled);emitUpdate({autoCheck:enabled});return {...updateSnapshot};},
      openRelease:async()=>{updateOpened++;return {ok:true};}}};
  `});
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/#/settings`});
  await until('application settings ready',`typeof state!=='undefined' && !!document.querySelector('.set-tabs')`);
  await evaluate(`document.querySelector('[data-action="set-tab"][data-id="about"]').click()`);
  await until('about page gets actual app version and automatic preference',`document.querySelector('.update-version')?.textContent==='当前版本 v0.1.1' && document.querySelector('#set-update-auto').checked`);
  await evaluate(`document.querySelector('[data-action="updates-check"]').click()`);
  await until('checking disables duplicate checks',`document.querySelector('[data-action="updates-check"]').disabled && document.querySelector('.update-status').textContent.includes('正在检查')`);
  await evaluate(`finishCheck({status:'available',checkedAt:Date.now(),hasUpdate:true,release:{version:'0.1.2',notes:'# 改进阅读体验\\n<img src=x onerror="window.noteExecuted=true">',publishedAt:'2026-10-25T00:00:00Z'}})`);
  await until('new release notes and download entry shown',`document.querySelector('.update-notes')?.textContent.includes('改进阅读体验') && !document.querySelector('[data-action="updates-check"]').disabled`);
  await check('remote HTML stays inert text',`!document.querySelector('.update-notes img') && !window.noteExecuted && document.querySelector('.update-notes').textContent.includes('<img')`);
  await evaluate(`document.querySelector('[data-action="updates-open"]').click()`);
  await until('download action reaches desktop bridge',`updateOpened===1`);
  await evaluate(`document.querySelector('#set-update-auto').click()`);
  await until('auto-check preference persists immediately',`updateSaved.at(-1)===false && !document.querySelector('#set-update-auto').checked && !document.querySelector('#set-update-auto').disabled`);
  await evaluate(`document.querySelector('[data-action="updates-check"]').click();finishCheck({status:'error',error:'无法连接 GitHub，请检查网络后重试。'})`);
  await until('network failure never says up to date',`document.querySelector('.update-status').textContent.includes('无法连接') && !document.querySelector('.update-status').textContent.includes('最新正式版本')`);
  await check('cached release is explicitly labelled after failure',`document.querySelector('.update-release-head').textContent.includes('上次发现的版本')`);
  await evaluate(`document.querySelector('[data-action="updates-check"]').click();finishCheck({status:'up-to-date',error:'',hasUpdate:false,release:null})`);
  await until('up-to-date state removes obsolete release card',`!document.querySelector('.update-release') && document.querySelector('.update-status').textContent.includes('最新正式版本')`);
  await evaluate(`document.querySelector('[data-action="set-tab"][data-id="ai"]').click();document.querySelector('#set-model').value='Unsaved model choice';
    emitUpdate({status:'available',hasUpdate:true,notify:true,release:{version:'0.1.3',notes:'修复 PDF 渲染\\n改进笔记保存',publishedAt:'2026-10-25T00:00:00Z'}})`);
  await check('background result preserves unsaved settings form',`document.querySelector('#set-model').value==='Unsaved model choice' && document.querySelector('.toast-update') && document.querySelector('.set-tab[data-id="about"]').classList.contains('has-update')`);
  await evaluate(`location.hash='#/library'`);
  await until('navigation leaves settings',`state.route.view==='library' && !!document.querySelector('#view')`);
  await evaluate(`document.querySelector('[data-action="updates-details"]').click()`);
  await until('notice opens the correct settings tab',`state.route.view==='settings' && state.settingsTab==='about' && !!document.querySelector('.update-card')`);
  await evaluate(`document.querySelector('.update-notes').textContent=Array(60).fill('改进：'+('长说明'.repeat(30))).join('\\n')`);
  await check('long notes scroll inside the release card',`document.querySelector('.update-notes').scrollHeight>document.querySelector('.update-notes').clientHeight && document.querySelector('.update-notes').clientHeight<=300`);
  await evaluate(`document.querySelector('.update-notes').textContent='改进 PDF 阅读与渲染清晰度\\n优化笔记保存和草稿恢复\\n修复网页 AI 打开时窗口闪现的问题'`);
  const shots=path.resolve('tests/.shots/updates');mkdirSync(shots,{recursive:true});
  async function shot(name){const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(path.join(shots,name+'.png'),Buffer.from(r.result.data,'base64'));}
  await shot('light');
  await evaluate(`document.documentElement.dataset.theme='dark'`);await sleep(250);await shot('dark');
  await send('Emulation.setDeviceMetricsOverride',{width:1000,height:900,deviceScaleFactor:1,mobile:false});
  await check('narrow layout keeps settings card and actions in view',`(()=>{const card=document.querySelector('.update-card').getBoundingClientRect();return card.right<=innerWidth && card.left>=0 && document.documentElement.scrollWidth<=innerWidth;})()`);
  await shot('narrow');
  await evaluate(`(async()=>{delete window.lithub;await AppUpdates.init({onChange:refreshUpdateSettings});})()`);
  await check('browser preview has an explicit unsupported state',`document.querySelector('.update-status').textContent.includes('桌面程序') && document.querySelector('[data-action="updates-check"]').disabled`);
  assert.deepEqual(errors,[]);
} finally {ws?.close();chrome.kill();await new Promise(r=>server.close(r));}
