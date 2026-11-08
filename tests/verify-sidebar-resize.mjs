/* Real settings UI + isolated backend. Credentials are fictional; no external API calls. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { findBrowser } from './_browser.mjs';
const require=createRequire(import.meta.url);
const {selectSidecarPort,waitForOwnedSidecar}=require('../electron/sidecar-connection');
const root=mkdtempSync(path.join(os.tmpdir(),'lithub-sidebar-ui-'));
const data=path.join(root,'data');mkdirSync(data);
writeFileSync(path.join(data,'library.json'),JSON.stringify({papers:{},tasks:{},settings:{}}));
const port=await selectSidecarPort(),base=`http://127.0.0.1:${port}`,instance='profiles-ui-test';
const backend=spawn('python',['-B','-m','uvicorn','main:app','--host','127.0.0.1','--port',String(port)],{
  cwd:path.resolve('backend'),windowsHide:true,stdio:['ignore','pipe','pipe'],
  env:{...process.env,LITHUB_DATA_DIR:data,LITHUB_PROGRAM_DIR:root,LITHUB_PDF_DEFAULT_DIR:path.join(root,'pdfs'),LITHUB_INSTANCE_ID:instance}
});
let logs='';backend.stdout.on('data',b=>logs+=b);backend.stderr.on('data',b=>logs+=b);
let chrome,ws;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try {
  await waitForOwnedSidecar({baseURL:base,instanceId:instance,fetch,isAlive:()=>backend.exitCode===null});
  const debug=await selectSidecarPort();
  chrome=spawn(findBrowser(),['--headless=new','--disable-gpu','--no-first-run',`--user-data-dir=${path.join(root,'chrome')}`,`--remote-debugging-port=${debug}`,'about:blank'],{stdio:'ignore',windowsHide:true});
  let target;
  for(let i=0;i<100&&!target;i++) {try{target=(await(await fetch(`http://127.0.0.1:${debug}/json/list`)).json()).find(t=>t.type==='page');}catch{}if(!target)await sleep(100);}
  assert.ok(target);ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let sequence=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
  const send=(method,params={})=>new Promise(resolve=>{const id=++sequence;pending.set(id,resolve);ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description);return r.result.result.value;};
  const until=async(name,expression)=>{for(let i=0;i<140;i++){if(await evaluate(`typeof state !== 'undefined' && !!window.LithubAPI?.live && (${expression})`)){console.log('PASS '+name);return;}await sleep(60);}throw Error('Timeout: '+name);};
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:base+'/#/library'});
  await until('sidebar drag boundary ready',`!!document.querySelector('.sidebar-resize')`);
  const width=()=>evaluate(`document.getElementById('sidebar').getBoundingClientRect().width`);
  const drag=async target=>{
    const start=await evaluate(`(()=>{const r=document.querySelector('.sidebar-resize').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+120};})()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:start.x,y:start.y,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:target,y:start.y,buttons:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:target,y:start.y,button:'left',clickCount:1});
  };
  await drag(380);assert.ok(Math.abs(await width()-380)<3);
  assert.equal(await evaluate(`Math.round(document.getElementById('view').getBoundingClientRect().left)===Math.round(document.getElementById('sidebar').getBoundingClientRect().right)`),true);
  await send('Page.reload');await until('custom width survives reload',`Math.abs(document.getElementById('sidebar').getBoundingClientRect().width-380)<3`);
  await evaluate(`location.hash='#/settings'`);await until('custom width survives settings navigation',`document.querySelector('.set-card') && Math.abs(document.getElementById('sidebar').getBoundingClientRect().width-380)<3`);
  await evaluate(`document.querySelector('.sidebar-resize').focus()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'End'});assert.equal(await width(),480);
  await send('Emulation.setDeviceMetricsOverride',{width:900,height:1000,deviceScaleFactor:1,mobile:false});await sleep(100);assert.equal(await width(),340);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});await sleep(100);assert.equal(await width(),480);
  await evaluate(`document.querySelector('.sidebar-resize').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`);assert.equal(await width(),248);
  await drag(10);assert.equal(await width(),208);
  const point=await evaluate(`(()=>{const r=document.querySelector('.sidebar-resize').getBoundingClientRect();return {x:r.left+4,y:r.top+100};})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  assert.equal(await evaluate(`document.body.classList.contains('sidebar-resizing')`),true);
  await evaluate(`window.dispatchEvent(new Event('blur'))`);
  assert.equal(await evaluate(`document.body.classList.contains('sidebar-resizing')`),false);
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
  await evaluate(`document.querySelector('.sidebar-resize').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));localStorage.setItem('lithub-sidebar-width','invalid');`);
  await send('Page.reload');await until('invalid saved width uses default',`document.querySelector('.sidebar-resize') && document.getElementById('sidebar').getBoundingClientRect().width===248`);
  assert.deepEqual(errors,[]);
  console.log('PASS real mouse drag, bounds, content reflow, persistence, navigation, keyboard, viewport restoration, reset and blur cleanup');
} catch(error) {throw Error(error.message+'\n'+logs.slice(-1800));}
finally {
  ws?.close();
  for(const child of [chrome,backend])if(child && child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
  rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}

