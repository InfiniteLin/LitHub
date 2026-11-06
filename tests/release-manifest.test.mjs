import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url),{createUpdateService}=require('../electron/update-service'),{fetchPublicRelease,MANIFEST_URL}=require('../electron/release-manifest');
const root=mkdtempSync(path.join(tmpdir(),'lithub-release-manifest-'));
const now=Date.UTC(2026,10,7),raw={tag_name:'v0.2.5',assets:[{name:'LitHub-0.2.5-win-x64.zip',size:10,state:'uploaded',digest:'sha256:'+'1'.repeat(64)}]};
const manifest=()=>new Response(JSON.stringify({schemaVersion:1,release:raw}));
let serial=0;
function service(fetch,prefs={}) {
  const file=path.join(root,String(serial++)+'.json');writeFileSync(file,JSON.stringify(prefs));
  return createUpdateService({version:'0.2.4',storageFile:file,fetch,now:()=>now});
}
try {
  let calls=[];
  const s=service(async url=>{calls.push(url);assert.equal(url,MANIFEST_URL);return manifest();},{blockedUntil:now+3600000,nextCheckAt:now+3600000});
  await s.check();assert.equal(s.getState().status,'available');assert.equal(calls.length,1);assert.ok(s.getState().release.portable.sha256);s.stop();
  calls=[];const fallback=service(async url=>{calls.push(url);return url===MANIFEST_URL?new Response('',{status:404}):new Response(JSON.stringify(raw));});
  await fallback.check();assert.equal(calls.length,2);assert.equal(fallback.getState().status,'available');fallback.stop();
  calls=[];const rate=service(async url=>{calls.push(url);return url===MANIFEST_URL?new Response('',{status:404}):new Response('',{status:403,headers:{'x-ratelimit-remaining':'0','x-ratelimit-reset':String((now+3600000)/1000)}});});
  await rate.check();await rate.check();assert.equal(calls.filter(x=>x.includes('api.github.com')).length,1,'API wait is respected while public channel remains usable');rate.stop();
  const forbidden=service(async url=>new Response('',{status:url===MANIFEST_URL?404:403}));await forbidden.check();assert.ok(forbidden.getState().error.includes('HTTP 403'));assert.ok(!forbidden.getState().error.includes('限流'));forbidden.stop();
  const signal=new AbortController().signal;
  const redirects=[];
  await assert.rejects(fetchPublicRelease(async url=>{redirects.push(url);return new Response(null,{status:302,headers:{location:'https://evil.example/update.json'}});},signal),/不安全/);
  assert.equal(redirects.length,1);
  await assert.rejects(fetchPublicRelease(async()=>new Response('x'.repeat(65537)),signal),/过大/);
  await assert.rejects(fetchPublicRelease(async()=>new Response(JSON.stringify(raw)),signal),/格式/);
  let n=0;const data=await fetchPublicRelease(async()=>++n===1?new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/fixture'}}):manifest(),signal);
  assert.equal(data.tag_name,'v0.2.5');
  console.log('PASS public manifest under legacy API backoff, API fallback, 403 classification, API rate-limit respect, safe redirects and bounded JSON');
} finally {rmSync(root,{recursive:true,force:true});}
