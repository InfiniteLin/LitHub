/* Hidden real Electron window: validate preload, frame trust, events and net.fetch together. */
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
const require=createRequire(import.meta.url);
const dir=mkdtempSync(path.join(os.tmpdir(),'lithub-update-electron-'));
const entry=path.join(dir,'main.cjs');
const renderer=`(async()=>{
  const u=window.lithub.updates,initial=await u.getState(),events=[];
  const unsub=u.onChange(s=>events.push(s.status));
  const checked=await u.check();await u.setAutoCheck(false);await u.openRelease();
  const downloaded=await u.download();if(downloaded.download.status!=='ready')throw Error(JSON.stringify(downloaded.download));const installed=await u.install();unsub();
  return {initial,checked,downloaded,installed,events,final:await u.getState()};
})()`;
writeFileSync(entry, `
const {app,BrowserWindow,ipcMain,net}=require('electron');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createServer}=require('node:http');
const {createUpdateService,registerUpdateIPC}=require(${JSON.stringify(path.resolve('electron/update-service.js'))});
const {requestUpdate}=require(${JSON.stringify(path.resolve('electron/update-network.js'))});
app.setPath('userData',${JSON.stringify(path.join(dir,'user'))});
let win,service,server;
app.whenReady().then(async()=>{
  const payload=Buffer.from('isolated Electron update fixture');
  const digest=createHash('sha256').update(payload).digest('hex');
  server=createServer((req,res)=>{
    if(req.url==='/redirect'){res.writeHead(302,{location:'/asset'});res.end();return;}
    if(req.url==='/slow'){res.write('started');return;}
    if(req.url==='/asset'){res.end(payload);return;}
    res.setHeader('Content-Type','application/json');const metadata={tag_name:'v0.1.2',draft:false,prerelease:false,body:'Integration release',
      assets:[{name:'LitHub Setup 0.1.2.exe',size:payload.length,state:'uploaded',digest:'sha256:'+digest}]};res.end(JSON.stringify(req.url==='/manifest'?{schemaVersion:1,release:metadata}:metadata));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const local='http://127.0.0.1:'+server.address().port;
  const redirected=await requestUpdate(net,local+'/redirect',{redirect:'manual'});assert.equal(redirected.status,302);assert.ok(redirected.headers.get('location').endsWith('/asset'));
  await assert.rejects(requestUpdate(net,local+'/redirect',{redirect:'error'}));
  const aborter=new AbortController();const pendingSlow=requestUpdate(net,local+'/slow',{signal:aborter.signal});
  const abortTimer=setTimeout(()=>aborter.abort(),100);
  try {await assert.rejects((async()=>{const slow=await pendingSlow;for await(const chunk of slow.body){void chunk;}})());}finally{clearTimeout(abortTimer);}
  console.log('PASS native manual redirect capture, forbidden redirects and request cancellation');
  const opened=[];let installCalls=0;
  service=createUpdateService({version:'0.1.1',storageFile:${JSON.stringify(path.join(dir,'state.json'))},
    canInstall:true,install:async()=>{installCalls++;return false;},
    fetch:(url,options)=>{const manifest=url==='https://github.com/InfiniteLin/LitHub/releases/latest/download/update.json';
      const api=url==='https://api.github.com/repos/InfiniteLin/LitHub/releases/latest';
      if(!api&&!manifest)assert.ok(url.startsWith('https://github.com/InfiniteLin/LitHub/releases/download/'));
      return requestUpdate(net,'http://127.0.0.1:'+server.address().port+(manifest?'/manifest':api?'/':'/asset'),options);},
    openExternal:async url=>opened.push(url),onChange:s=>win.webContents.send('updates:changed',s)});
  registerUpdateIPC(ipcMain,()=>service,e=>!!win && e.sender===win.webContents && e.senderFrame===win.webContents.mainFrame);
  win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,
    preload:${JSON.stringify(path.resolve('electron/preload.js'))}}});
  await win.loadFile(${JSON.stringify(path.join(dir,'test.html'))});
  const result=await win.webContents.executeJavaScript(${JSON.stringify(renderer)});
  assert.equal(result.initial.currentVersion,'0.1.1');assert.equal(result.checked.status,'available');
  assert.ok(result.events.includes('checking'));assert.ok(result.events.includes('available'));
  assert.equal(result.final.autoCheck,false);
  assert.equal(result.downloaded.download.status,'ready');assert.equal(result.installed.download.status,'ready');assert.equal(installCalls,1);
  assert.deepEqual(opened,['https://github.com/InfiniteLin/LitHub/releases/tag/v0.1.2']);
  console.log('PASS real Electron preload, trusted-frame IPC, native networking and state events');
}).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{
  service?.stop();win?.destroy();server?.close();app.exit(process.exitCode||0);
});
`);
writeFileSync(path.join(dir,'test.html'),'<html><body>Isolated update integration test</body></html>');
try {
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(require('electron'),[entry],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',d=>{output+=d;});child.stderr.on('data',d=>{output+=d;});
  const timeout=setTimeout(()=>child.kill(),30000);
  try {
    const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
    if(code!==0)throw Error(output||'Electron integration test failed');
    console.log(output.trim());
  } finally {clearTimeout(timeout);}
} finally {rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
