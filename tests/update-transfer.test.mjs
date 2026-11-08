import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
const require=createRequire(import.meta.url);
const {fetchAsset,createInstallerUpdate}=require('../electron/installer-update');
const {proxyAgent}=require('../electron/update-http1');
const source='https://github.com/InfiniteLin/LitHub/releases/download/v0.2.6/LitHub-0.2.6-win-x64.zip';
const signed='https://release-assets.githubusercontent.com/asset?sig=must%2Bremain%2Funchanged&jwt=expired';
const payload=Buffer.from('complete verified update bytes');
const root=mkdtempSync(path.join(tmpdir(),'lithub-transfer-'));
const release={version:'0.2.6',portable:{kind:'portable',name:'LitHub-0.2.6-win-x64.zip',url:source,
  size:payload.length,sha256:createHash('sha256').update(payload).digest('hex')}};
let seq=0;
function fixture(fetch){
  const directory=path.join(root,String(seq++));let resolutions=0;
  const updater=createInstallerUpdate({directory,packageKind:'portable',fetch,resolveRelease:async()=>{resolutions++;return release;}});
  return {updater,directory,resolutions:()=>resolutions};
}
try {
  for(const status of [400,401,403]){
    const calls=[],options=[];let discarded=0;
    const response=await fetchAsset(async(url,opts)=>{
      calls.push(url);options.push(opts);
      if(new URL(url).hostname==='github.com')return new Response(null,{status:302,headers:{location:signed}});
      assert.equal(url,signed,'signed query must be preserved exactly');
      if(calls.length===2)return {ok:false,status,body:{destroy(){discarded++;}}};
      return new Response(payload);
    },source);
    assert.equal(await response.text(),payload.toString());
    assert.equal(calls.length,4);assert.equal(discarded,1);
    const first=new URL(calls[0]),retry=new URL(calls[2]);
    assert.notEqual(first.searchParams.get('lithub_download'),retry.searchParams.get('lithub_download'));
    first.search='';retry.search='';assert.equal(first.href,source);assert.equal(retry.href,source);
    assert.ok(options.every(o=>o.cache==='no-store'&&o.headers['Cache-Control'].includes('no-cache')));
  }
  let attempts=0;
  await assert.rejects(fetchAsset(async url=>{
    attempts++;
    return new URL(url).hostname==='github.com'?new Response(null,{status:302,headers:{location:signed}}):new Response('expired',{status:400});
  },source),/HTTP 400/);
  assert.equal(attempts,4,'expired links have one bounded refresh');
  console.log('PASS expired signed URL 400/401/403 refresh, cache bypass, exact signed queries and Node/Web response cleanup');

  for(const failure of ['headers','body']){
    const transports=[];
    const f=fixture(async(_url,options)=>{
      transports.push(options.transport||'native');
      if(options.transport==='http1')return new Response(payload);
      if(failure==='headers')throw Error('net::ERR_HTTP2_PROTOCOL_ERROR');
      return {ok:true,status:200,body:Readable.from((async function*(){yield payload.subarray(0,5);throw Error('net::ERR_HTTP2_PROTOCOL_ERROR');})())};
    });
    await f.updater.download();
    assert.equal(f.updater.getState().status,'ready');
    assert.deepEqual(transports,['native','http1']);assert.equal(f.resolutions(),1,'no extra metadata check');
    const file=path.join(f.directory,readdirSync(f.directory)[0],'package.zip');
    assert.deepEqual(readFileSync(file),payload,'partial native bytes are replaced, not appended');
  }
  let nativeRequests=0,http1Requests=0;
  const expired=fixture(async(url,options)=>{
    if(options.transport==='http1')http1Requests++;else nativeRequests++;
    if(new URL(url).hostname==='github.com')return new Response(null,{status:302,headers:{location:signed}});
    return options.transport==='http1'?new Response(payload):new Response('expired',{status:400});
  });
  await expired.updater.download();assert.equal(expired.updater.getState().status,'ready');
  assert.equal(nativeRequests,4);assert.equal(http1Requests,2);assert.equal(expired.resolutions(),1);
  for(const failure of ['persistent','corrupt','cancel']){
    let requests=0;
    const f=fixture(async(_url,options)=>{
      requests++;
      if(failure==='cancel'){f.updater.cancel();throw options.signal.reason;}
      if(options.transport==='http1'&&failure==='corrupt')return new Response(Buffer.alloc(payload.length,1));
      throw Error('net::ERR_HTTP2_PROTOCOL_ERROR');
    });
    await f.updater.download();
    assert.equal(requests,failure==='cancel'?1:2);
    assert.equal(f.updater.getState().status,failure==='cancel'?'idle':'error');
    assert.deepEqual(readdirSync(f.directory),[]);
    if(failure==='corrupt')assert.match(f.updater.getState().error,/校验/);
  }
  const cancelled=new AbortController();let requests=0;
  await assert.rejects(fetchAsset(async()=>{requests++;cancelled.abort();return new Response(null,{status:302,headers:{location:signed}});},source,cancelled.signal));
  assert.equal(requests,1);
  const refused=fixture(async()=>new Response('not found',{status:404}));
  await refused.updater.download();assert.match(refused.updater.getState().error,/404/);
  assert.equal(refused.resolutions(),1);
  for(const result of ['DIRECT','PROXY localhost:1234','HTTPS localhost:1234','SOCKS5 localhost:1234','SOCKS4 localhost:1234'])proxyAgent(result).destroy();
  assert.throws(()=>proxyAgent('UNSUPPORTED localhost:1234'),/代理/);
  console.log('PASS HTTP/2 header/body failure fallback, clean file/hash restart, bounded retry, cancellation and SHA-256 rejection');
} finally {rmSync(root,{recursive:true,force:true});}
