import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url),{createUpdateService}=require('../electron/update-service'),{fetchPublicRelease,MANIFEST_URL,FEED_URL}=require('../electron/release-manifest');
const root=mkdtempSync(path.join(tmpdir(),'lithub-release-manifest-'));
const now=Date.UTC(2026,10,7),raw={tag_name:'v0.2.5',assets:[{name:'LitHub-0.2.5-win-x64.zip',size:10,state:'uploaded',digest:'sha256:'+'1'.repeat(64)}]};
const isManifest = url => new URL(url).pathname === new URL(MANIFEST_URL).pathname;
const manifest=()=>new Response(JSON.stringify({schemaVersion:1,release:raw}));
let serial=0;
function service(fetch,prefs={}) {
  const file=path.join(root,String(serial++)+'.json');writeFileSync(file,JSON.stringify(prefs));
  return createUpdateService({version:'0.2.4',storageFile:file,fetch,now:()=>now});
}
try {
  let calls=[];
  const s=service(async url=>{calls.push(url);assert.ok(isManifest(url));return manifest();},{blockedUntil:now+3600000,nextCheckAt:now+3600000});
  await s.check();assert.equal(s.getState().status,'available');assert.equal(calls.length,1);assert.ok(s.getState().release.portable.sha256);s.stop();
  const tagged = 'https://github.com/InfiniteLin/LitHub/releases/download/v0.2.5/update.json';
  const expired = 'https://release-assets.githubusercontent.com/fixture?se=expired&sig=old%2Bsignature';
  const fresh = 'https://release-assets.githubusercontent.com/fixture?se=fresh&sig=new%2Bsignature';
  const redirect = location => new Response(null,{status:302,headers:{location}});
  for (const failure of ['signed-url','http2']) {
    const requests=[];
    const recovered=service(async (url,options)=>{
      requests.push({url,transport:options.transport});
      assert.equal(options.headers['Cache-Control'],'no-cache, no-store');
      if (isManifest(url)) return redirect(tagged);
      if (url.startsWith(tagged+'?')) return redirect(options.transport==='http1'?fresh:expired);
      if (url===fresh) { assert.equal(options.transport,'http1');return manifest(); }
      assert.equal(url,expired,'the CDN signature must be passed through verbatim');
      if (failure==='http2') throw Error('net::ERR_HTTP2_PROTOCOL_ERROR');
      return new Response('',{status:400});
    },{blockedUntil:now+3600000,nextCheckAt:now+3600000});
    await recovered.check();
    assert.equal(recovered.getState().status,'available');
    assert.equal(requests.length,6);
    const nonce = index => new URL(requests[index].url).searchParams.get('lithub_manifest');
    assert.ok(nonce(0) && nonce(3));
    assert.equal(nonce(0),nonce(1));
    assert.equal(nonce(3),nonce(4));
    assert.notEqual(nonce(0),nonce(3));
    recovered.stop();
  }
  for (const [code, status] of [[404,'unavailable'],[403,'error'],[429,'error']]) {
    calls=[];
    const failed=service(async url=>{calls.push(url);return new Response('',{status:code});});
    await failed.check();await failed.check();
    assert.equal(failed.getState().status,status);
    assert.ok(failed.getState().error.includes('HTTP '+code));
    assert.equal(calls.length,4);
    assert.ok(calls.every(url=>isManifest(url) || url===FEED_URL),'manual retries use only public sources');
    failed.stop();
  }
  calls=[];
  const mirror=service(async (url,options)=>{
    calls.push([url,options.transport]);
    if (url===FEED_URL) return manifest();
    assert.ok(isManifest(url));
    throw Error('net::ERR_CONNECTION_RESET');
  });
  const mirrored=await mirror.check();
  assert.equal(mirrored.status,'available');
  assert.ok(mirrored.release.portable.sha256);
  assert.deepEqual(calls.map(([url,transport])=>[isManifest(url)?MANIFEST_URL:url,transport]),
    [[MANIFEST_URL,undefined],[MANIFEST_URL,'http1'],[FEED_URL,undefined]]);
  mirror.stop();
  const signal=new AbortController().signal;
  const redirects=[];
  await assert.rejects(fetchPublicRelease(async url=>{redirects.push(url);return new Response(null,{status:302,headers:{location:'https://evil.example/update.json'}});},signal),/不安全/);
  assert.equal(redirects.length,1);
  await assert.rejects(fetchPublicRelease(async()=>new Response('x'.repeat(65537)),signal),/过大/);
  await assert.rejects(fetchPublicRelease(async()=>new Response(JSON.stringify(raw)),signal),/格式/);
  let n=0;const data=await fetchPublicRelease(async()=>++n===1?new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/fixture'}}):manifest(),signal);
  assert.equal(data.tag_name,'v0.2.5');
  console.log('PASS public manifest, CDN/HTTP2 retry, independent static feed, safe redirects and bounded JSON');
} finally {rmSync(root,{recursive:true,force:true});}
