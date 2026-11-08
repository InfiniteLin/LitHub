import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {distributionFor,confirmPortableStartup,readPortableResult}=require('../electron/portable-update');
const {createUpdateService,normalizeRelease}=require('../electron/update-service');
const root=mkdtempSync(path.join(tmpdir(),'lithub-portable-routing-'));
const oldEnv={ack:process.env.LITHUB_UPDATE_ACK,token:process.env.LITHUB_UPDATE_TOKEN};
try {
  const executable=path.join(root,'LitHub.exe');writeFileSync(executable,'fixture');
  assert.equal(distributionFor(executable,false,'win32'),'development');
  assert.equal(distributionFor(executable,true,'win32'),'portable','legacy ZIP needs no new marker');
  writeFileSync(path.join(root,'Uninstall 文枢 LitHub.exe'),'fixture');
  assert.equal(distributionFor(executable,true,'win32'),'installer');
  const work=path.join(root,'.lithub-update-fixture');mkdirSync(work);
  writeFileSync(path.join(work,'plan.json'),JSON.stringify({target:root,token:'fixture-token'}));
  const ack=path.join(work,'started.json');
  process.env.LITHUB_UPDATE_ACK=ack;process.env.LITHUB_UPDATE_TOKEN='fixture-token';confirmPortableStartup(executable);
  assert.equal(JSON.parse(readFileSync(ack)).token,'fixture-token');
  process.env.LITHUB_UPDATE_ACK=path.join(root,'do-not-write');process.env.LITHUB_UPDATE_TOKEN='bad';confirmPortableStartup(executable);
  writeFileSync(path.join(root,'.lithub-update-result.json'),JSON.stringify({ok:false,error:'fixture failed',version:'0.3.0'}));
  assert.equal(readPortableResult(executable).ok,false);
  const data=Buffer.from('ZIP download fixture'),digest=createHash('sha256').update(data).digest('hex');
  const raw={tag_name:'v0.3.0',assets:[{name:'LitHub.Setup.0.3.0.exe',size:123,state:'uploaded',digest:'sha256:'+'1'.repeat(64)},
    {name:'LitHub-0.3.0-win-x64.zip',size:data.length,state:'uploaded',digest:'sha256:'+digest}]};
  assert.equal(normalizeRelease(raw).portable.sha256,digest);
  let installs=0,urls=[];
  const service=createUpdateService({version:'0.2.3',storageFile:path.join(root,'prefs.json'),canInstall:true,distribution:'portable',downloadDirectory:path.join(root,'updates'),
    fetch:async url=>{urls.push(url);return url.includes('/releases/latest')?new Response(JSON.stringify(raw)):new Response(data);},
    install:async(file,asset)=>{installs++;assert.ok(file.endsWith('.zip'));assert.equal(asset.version,'0.3.0');assert.equal(asset.sha256,digest);assert.deepEqual(readFileSync(file),data);return false;}});
  await service.check();
  const checksBeforeDownload=urls.length;
  await service.download();assert.equal(service.getState().download.status,'ready');
  assert.ok(urls.slice(checksBeforeDownload).every(u=>!u.includes('/releases/latest')));
  assert.ok(urls.some(u=>u.endsWith('.zip')));assert.ok(!urls.some(u=>u.endsWith('.exe')));
  await service.install();assert.equal(installs,1);assert.equal(service.getState().download.status,'ready');service.stop();
  const missing=createUpdateService({version:'0.2.3',storageFile:path.join(root,'missing.json'),canInstall:true,distribution:'portable',downloadDirectory:path.join(root,'updates'),
    fetch:async()=>new Response(JSON.stringify({...raw,assets:raw.assets.slice(0,1)}))});
  await missing.check();await missing.download();assert.equal(missing.getState().download.status,'error','portable never silently switches to installer');missing.stop();
  let migrated=false;
  const migration=createUpdateService({version:'0.2.3',storageFile:path.join(root,'migration.json'),canInstall:true,distribution:'installer',downloadDirectory:path.join(root,'updates'),
    fetch:async url=>url.includes('/releases/latest')?new Response(JSON.stringify({...raw,assets:raw.assets.slice(1)})):new Response(data),
    install:async(file,asset)=>{assert.equal(asset.kind,'portable');assert.ok(file.endsWith('.zip'));migrated=true;return false;}});
  await migration.check();await migration.download();assert.equal(migration.getState().download.kind,'portable');
  await migration.install();assert.equal(migrated,true,'installed edition uses ZIP for ZIP-only releases');migration.stop();
  const uiContext={window:{lithub:{updates:{onChange:()=>()=>{},getState:async()=>({revision:1,distribution:'portable',currentVersion:'0.2.3',status:'available',hasUpdate:true,canInstall:true,release:{version:'0.3.0',notes:''},download:{status:'ready',version:'0.3.0'},lastUpdate:{ok:false,error:'<unsafe>'}})}}}};
  vm.runInNewContext(readFileSync('frontend/js/app-updates.js','utf8'),uiContext);
  await uiContext.window.AppUpdates.init();const html=uiContext.window.AppUpdates.html();
  assert.ok(html.includes('重启并更新') && html.includes('ZIP 原位更新') && html.includes('&lt;unsafe&gt;'));
  console.log('PASS legacy ZIP/installed detection, scoped startup acknowledgment, ZIP-only download/integrity/cache and missing ZIP behavior');
} finally {
  for(const [key,value] of [['LITHUB_UPDATE_ACK',oldEnv.ack],['LITHUB_UPDATE_TOKEN',oldEnv.token]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  rmSync(root,{recursive:true,force:true});
}
