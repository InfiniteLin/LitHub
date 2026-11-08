import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {createUpdateService}=require('../electron/update-service');
const root=mkdtempSync(path.join(os.tmpdir(),'lithub-discovered-download-'));
const payload=Buffer.from('verified ZIP fixture'),sha=createHash('sha256').update(payload).digest('hex');
const metadata={tag_name:'v0.2.5',assets:[{name:'LitHub-0.2.5-win-x64.zip',size:payload.length,state:'uploaded',digest:'sha256:'+sha}]};
let seq=0;
const services=[];
function make(options={}) {
  const calls=[];let failure=false,corrupt=false;
  const storageFile=options.storageFile||path.join(root,`${seq++}.json`);
  const service=createUpdateService({version:'0.2.4',storageFile,canInstall:true,distribution:'portable',useManifest:false,
    downloadDirectory:path.join(root,`downloads-${seq++}`),
    fetch:async url=>{
      calls.push(url);
      if(url.includes('api.github.com'))return failure
        ? new Response('',{status:429,headers:{'retry-after':'3600'}})
        : new Response(JSON.stringify(metadata));
      assert.equal(url,'https://github.com/InfiniteLin/LitHub/releases/download/v0.2.5/LitHub-0.2.5-win-x64.zip');
      return new Response(corrupt?Buffer.from('bad'):payload);
    },...options});
  services.push(service);
  return {service,calls,storageFile,failCheck:()=>failure=true,badDownload:value=>corrupt=value};
}
try {
  const first=make();
  await first.service.check();
  first.failCheck();await first.service.check();
  assert.equal(first.service.getState().status,'error');
  assert.ok(first.service.getState().hasUpdate);
  first.calls.length=0;
  first.badDownload(true);await first.service.download();
  assert.equal(first.service.getState().download.status,'error');
  first.badDownload(false);await first.service.download();
  assert.equal(first.service.getState().download.status,'ready');
  assert.equal(first.calls.length,2);
  assert.ok(first.calls.every(u=>!u.includes('api.github.com')),'download and retry must bypass checks under rate limits');
  first.service.stop();

  // Startup restores asset identity/hash/size, deriving its URL from the fixed repository.
  const saved=JSON.parse(readFileSync(first.storageFile,'utf8'));
  saved.release.portable.url='https://evil.example/download.zip';
  writeFileSync(first.storageFile,JSON.stringify(saved));
  const restarted=make({storageFile:first.storageFile});
  await restarted.service.download();
  assert.equal(restarted.service.getState().download.status,'ready');
  assert.equal(restarted.calls.length,1,'restart downloads directly without a check');
  assert.equal(restarted.service.getState().checkedAt,saved.checkedAt);

  for(const field of ['name','size','sha256']) {
    const corrupted=structuredClone(saved);
    corrupted.release.portable[field]=field==='size'?-1:'invalid';
    const file=path.join(root,`tampered-${field}.json`);writeFileSync(file,JSON.stringify(corrupted));
    const fixture=make({storageFile:file});await fixture.service.download();
    assert.equal(fixture.calls.length,0,'invalid metadata must neither download nor silently check');
    assert.equal(fixture.service.getState().download.status,'error');
    assert.match(fixture.service.getState().download.error,/检查更新/);
  }
  delete saved.release.portable;delete saved.release.installer;
  const legacyFile=path.join(root,'legacy.json');writeFileSync(legacyFile,JSON.stringify(saved));
  for(const fixture of [make({storageFile:legacyFile}),make()]) {
    await fixture.service.download();assert.equal(fixture.calls.length,0);
    assert.match(fixture.service.getState().download.error,/检查更新/);
  }
  console.log('PASS direct download/retry during rate limits, persisted asset metadata, safe URL reconstruction and explicit missing-metadata errors');
} finally {services.forEach(s=>s.stop());rmSync(root,{recursive:true,force:true});}
