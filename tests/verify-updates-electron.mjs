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
  const checked=await u.check();await u.setAutoCheck(false);await u.openRelease();unsub();
  return {initial,checked,events,final:await u.getState()};
})()`;
writeFileSync(entry, `
const {app,BrowserWindow,ipcMain,net}=require('electron');
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {createUpdateService,registerUpdateIPC}=require(${JSON.stringify(path.resolve('electron/update-service.js'))});
app.setPath('userData',${JSON.stringify(path.join(dir,'user'))});
let win,service,server;
app.whenReady().then(async()=>{
  server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({tag_name:'v0.1.2',draft:false,prerelease:false,body:'Integration release'}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const opened=[];
  service=createUpdateService({version:'0.1.1',storageFile:${JSON.stringify(path.join(dir,'state.json'))},
    fetch:(url,options)=>{assert.equal(url,'https://api.github.com/repos/InfiniteLin/LitHub/releases/latest');return net.fetch('http://127.0.0.1:'+server.address().port,options);},
    openExternal:async url=>opened.push(url),onChange:s=>win.webContents.send('updates:changed',s)});
  registerUpdateIPC(ipcMain,()=>service,e=>!!win && e.sender===win.webContents && e.senderFrame===win.webContents.mainFrame);
  win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,
    preload:${JSON.stringify(path.resolve('electron/preload.js'))}}});
  await win.loadFile(${JSON.stringify(path.join(dir,'test.html'))});
  const result=await win.webContents.executeJavaScript(${JSON.stringify(renderer)});
  assert.equal(result.initial.currentVersion,'0.1.1');assert.equal(result.checked.status,'available');
  assert.ok(result.events.includes('checking'));assert.ok(result.events.includes('available'));
  assert.equal(result.final.autoCheck,false);
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
