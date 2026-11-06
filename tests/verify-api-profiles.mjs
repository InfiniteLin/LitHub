/* Real settings UI + isolated backend. Credentials are fictional; no external API calls. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { findBrowser } from './_browser.mjs';
const require=createRequire(import.meta.url);
const {selectSidecarPort,waitForOwnedSidecar}=require('../electron/sidecar-connection');
const root=mkdtempSync(path.join(os.tmpdir(),'lithub-profiles-ui-'));
const upstreamRequests=[];
let betaDelay=0;
const upstream=createServer((req,res)=>{
  upstreamRequests.push({url:req.url,key:req.headers.authorization});
  if(req.url==='/unsupported/v1/models'){res.writeHead(404).end();return;}
  const prefix=req.url.startsWith('/alpha/')?'alpha':'beta';
  const reply=()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:prefix+'-model'},{id:prefix+'-second'}]}));};
  if(prefix==='beta' && betaDelay)setTimeout(reply,betaDelay);else reply();
});
await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
const upstreamBase=`http://127.0.0.1:${upstream.address().port}`;
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
  const click=action=>evaluate(`document.querySelector('[data-action="${action}"]').click()`);
  const fill=(id,value)=>evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const saved=()=>until('settings saved',`!settingsSaving && state.db.settings.pendingKeys && Object.keys(state.db.settings.pendingKeys).length===0`);
  const screenshot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(path.join(shots,name+'.png'),Buffer.from(r.result.data,'base64'));};
  const shots=path.resolve('tests/.shots/api-profiles');mkdirSync(shots,{recursive:true});
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Network.setBlockedURLs',{urls:['https://*']});
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1100,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:base+'/#/settings'});
  await until('fresh installation has no predefined APIs',`LithubAPI.live && !!document.querySelector('.api-empty') && document.querySelectorAll('.prov-card').length===0`);
  await screenshot('empty');
  await click('api-add');
  await fill('set-api-name','论文总结');await fill('set-base',upstreamBase+'/alpha/v1');await fill('set-model','alpha-model');await fill('set-key','sk-fictional-alpha-only');await fill('set-temp','0.2');
  await until('model list is discovered implicitly without replacing the typed model',`document.querySelector('#api-model-list option[value="alpha-second"]') && document.getElementById('set-model').value==='alpha-model' && document.getElementById('api-model-hint').textContent.includes('2')`);
  assert.equal(upstreamRequests.length,1,'typing is debounced into one upstream model-list request');
  await fill('set-webai-url','https://example.com/');
  const alpha=await evaluate('state.db.settings.provider');
  await click('api-add');
  await fill('set-api-name','推理服务');await fill('set-base',upstreamBase+'/beta/v1');await fill('set-model','beta-model');await fill('set-key','sk-fictional-beta-only');await fill('set-temp','0.8');
  await until('second API discovers its own upstream models',`!!document.querySelector('#api-model-list option[value="beta-second"]')`);
  const beta=await evaluate('state.db.settings.provider');
  await evaluate(`document.querySelector('[data-action="provider"][data-id="${alpha}"]').click()`);
  await until('switch restores independent unsaved URL, model, temperature, key and web AI draft',`document.getElementById('set-base').value==='${upstreamBase}/alpha/v1' && document.getElementById('set-model').value==='alpha-model' && document.getElementById('set-key').value==='sk-fictional-alpha-only' && document.getElementById('set-temp').value==='0.2' && document.getElementById('set-webai-url').value==='https://example.com/'`);
  assert.equal(await evaluate(`!!document.querySelector('#api-model-list option[value="alpha-second"]') && !document.querySelector('#api-model-list option[value="beta-second"]')`),true);
  await fill('set-api-name','我的论文 API');
  await click('save-settings');await saved();
  let cfg=await(await fetch(base+'/api/settings')).json();assert.equal(cfg.api_profiles.length,2);assert.equal(cfg.api_profiles[0].name,'我的论文 API');
  assert.ok(!JSON.stringify(cfg).includes('sk-fictional-alpha-only'));
  assert.ok(!readFileSync(path.join(data,'library.json'),'utf8').includes('sk-fictional-alpha-only'));
  await send('Page.reload');
  await until('saved names and profiles survive reload without exposing keys',`LithubAPI.live && state.db.providers.length===2 && document.getElementById('set-api-name')?.value==='我的论文 API' && document.getElementById('set-key').value.includes('*')`);
  await until('saved masked credential triggers discovery on opening settings',`!!document.querySelector('#api-model-list option[value="alpha-second"]')`);
  await screenshot('configured');
  betaDelay=1400;const beforeBeta=upstreamRequests.filter(r=>r.url.startsWith('/beta/')).length;
  await evaluate(`document.querySelector('[data-action="provider"][data-id="${beta}"]').click()`);
  await until('second profile keeps its own saved configuration',`document.getElementById('set-base').value==='${upstreamBase}/beta/v1' && document.getElementById('set-model').value==='beta-model' && document.getElementById('set-temp').value==='0.8'`);
  for(let i=0;i<80 && upstreamRequests.filter(r=>r.url.startsWith('/beta/')).length===beforeBeta;i++)await sleep(50);
  await evaluate(`document.querySelector('[data-action="provider"][data-id="${alpha}"]').click()`);
  await sleep(1600);
  assert.equal(await evaluate(`document.getElementById('set-model').value==='alpha-model' && !!document.querySelector('#api-model-list option[value="alpha-second"]') && !document.querySelector('#api-model-list option[value="beta-second"]')`),true,'obsolete model response cannot change the selected API');
  betaDelay=0;
  await evaluate(`document.querySelector('[data-action="provider"][data-id="${beta}"]').click()`);
  await fill('set-api-name','<img src=x onerror=alert(1)>');
  assert.equal(await evaluate(`!!document.querySelector('.prov-card img')`),false);
  await fill('set-api-name','推理 API');
  await click('api-delete');await click('api-delete-cancel');
  assert.equal(await evaluate('state.db.providers.length'),2);
  await click('api-delete');await click('api-delete-confirm');await click('save-settings');await saved();
  cfg=await(await fetch(base+'/api/settings')).json();assert.equal(cfg.api_profiles.length,1);assert.equal(cfg.keys[beta],undefined);
  await click('api-delete');await click('api-delete-confirm');
  await until('deleting final API restores the empty state',`!!document.querySelector('.api-empty') && !document.getElementById('set-key')`);
  await click('save-settings');await saved();
  cfg=await(await fetch(base+'/api/settings')).json();assert.deepEqual(cfg.api_profiles,[]);assert.deepEqual(cfg.keys,{});assert.equal(cfg.provider,'');
  await send('Page.reload');await until('deleted profiles never reappear after reload',`LithubAPI.live && !!document.querySelector('.api-empty') && state.db.settings.provider===''`);
  await click('api-add');await fill('set-api-name','重试配置');await fill('set-base','file:///not-an-api');
  await click('save-settings');
  await until('failed save retains user input and re-enables controls',`!settingsSaving && document.getElementById('set-base').value==='file:///not-an-api' && !document.querySelector('[data-action="save-settings"]').disabled`);
  await fill('set-base',upstreamBase+'/unsupported/v1');await fill('set-model','retry-model');await fill('set-key','sk-fictional-retry');await click('save-settings');await saved();
  await until('unsupported upstream quietly preserves manual model entry',`document.getElementById('api-model-hint').textContent.includes('手动填写') && document.getElementById('set-model').value==='retry-model' && document.getElementById('api-model-hint').dataset.status==='unavailable'`);
  cfg=await(await fetch(base+'/api/settings')).json();assert.equal(cfg.api_profiles[0].name,'重试配置');
  await send('Emulation.setDeviceMetricsOverride',{width:1000,height:1000,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await screenshot('narrow');
  await evaluate(`document.documentElement.dataset.theme='dark'`);await screenshot('dark');
  assert.deepEqual(errors,[]);
  assert.ok(upstreamRequests.every(r=>r.url.endsWith('/models')),'discovery never sends a chat-completion request');
  assert.ok(upstreamRequests.filter(r=>r.url.startsWith('/alpha/')).every(r=>r.key==='Bearer sk-fictional-alpha-only'));
  console.log('PASS add, inline rename, delete, empty reset, failed save retry, layout and inert names');
} catch(error) {throw Error(error.message+'\n'+logs.slice(-1800));}
finally {
  ws?.close();
  for(const child of [chrome,backend])if(child && child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
  await new Promise(resolve=>upstream.close(resolve));
  rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
