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
const root=mkdtempSync(path.join(os.tmpdir(),'lithub-plugin-ui-'));
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
  await until('settings available',`!!document.querySelector('.sidebar-resize')`);
  await evaluate(`location.hash='#/settings'`);
  await until('settings tabs available',`!!document.querySelector('[data-action="set-tab"][data-id="translate"]')`);
  await evaluate(`document.querySelector('[data-action="set-tab"][data-id="translate"]').click()`);
  await until('plugin version loaded from backend',`!!document.querySelector('[data-plugin="install"]')`);
  assert.ok(await evaluate(`document.querySelector('#translation-plugin').textContent.includes('translation-plugins')`));
  // Exercise busy/poll/cancel/error states without downloading third-party code in this UI test.
  await evaluate(`window.pluginInfo={current:'1.9.11',latest:'1.9.12',available:true,source:'bundled',directory:'test/plugins',message:'found',busy:false};
    window.realFetch=window.fetch;window.pluginCalls=[];window.fetch=async(url,options)=>{
      if(String(url).includes('/api/settings/translation-plugin')){
        const op=String(url).split('/').pop();pluginCalls.push(op);
        if(op==='install'){pluginInfo.busy=true;pluginInfo.message='downloading';}
        if(op==='cancel'){pluginInfo.busy=false;pluginInfo.message='cancelled';}
        if(op==='restore')return new Response(JSON.stringify({detail:'active translation'}),{status:409});
        return new Response(JSON.stringify(pluginInfo),{status:200});
      }
      return realFetch(url,options);
    };document.querySelector('#set-target').value='English';
    document.querySelector('[data-plugin="install"]').click();`);
  await until('install shows cancellation',`!!document.querySelector('[data-plugin="cancel"]')`);
  assert.equal(await evaluate(`document.querySelector('#set-target').value`),'English');
  await evaluate(`document.querySelector('[data-plugin="cancel"]').click()`);
  await until('cancel restores install actions',`!!document.querySelector('[data-plugin="install"]') && document.querySelector('#translation-plugin').textContent.includes('cancelled')`);
  await evaluate(`pluginInfo.can_restore=true;document.querySelector('[data-plugin="check"]').click()`);
  await until('restore option visible',`!!document.querySelector('[data-plugin="restore"]')`);
  await evaluate(`document.querySelector('[data-plugin="restore"]').click()`);
  await until('conflict is shown inline',`document.querySelector('#translation-plugin').textContent.includes('active translation')`);
  await evaluate(`document.querySelector('[data-plugin="reload"]').click()`);
  await until('recover after error',`!!document.querySelector('[data-plugin="install"]')`);
  assert.equal(await evaluate(`document.querySelector('#set-target').value`),'English');
  console.log('PASS plugin card, real backend status, install/cancel UI, errors and settings draft preservation');
  assert.deepEqual(errors,[]);

} catch(error) {throw Error(error.message+'\n'+logs.slice(-1800));}
finally {
  if (ws?.readyState === WebSocket.OPEN) {ws.send(JSON.stringify({id:999999,method:'Browser.close'}));await sleep(800);}
  ws?.close();
  for(const child of [chrome,backend])if(child && child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
  await sleep(800);
  const {rm}=await import('node:fs/promises');
  await rm(root,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}

