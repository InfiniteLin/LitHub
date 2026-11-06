'use strict';
const URL = 'https://github.com/InfiniteLin/LitHub/releases/latest/download/update.json';
const MAX = 65536;
function allowed(value) {
  const u=new globalThis.URL(value);
  return u.protocol==='https:' && !u.username && !u.password && !u.port && !u.hash &&
    (u.href===URL || (u.hostname==='github.com' && u.pathname.startsWith('/InfiniteLin/LitHub/releases/download/')) ||
      ['release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(u.hostname));
}
async function fetchPublicRelease(fetch,signal) {
  let url=URL;
  for(let i=0;i<6;i++) {
    if(!allowed(url))throw Error('更新清单跳转地址不安全。');
    const r=await fetch(url,{signal,redirect:'manual',credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}});
    if([301,302,303,307,308].includes(r.status)) {
      const location=r.headers?.get('location');await r.body?.cancel?.();
      if(!location)throw Error('更新清单跳转无效。');
      url=new globalThis.URL(location,url).href;continue;
    }
    if(!r.ok)throw Error('更新清单暂不可用。');
    if(Number(r.headers?.get('content-length'))>MAX){await r.body?.cancel?.();throw Error('更新清单过大。');}
    let data;
    if(r.body) {
      const parts=[];let size=0;
      for await(const chunk of r.body){signal.throwIfAborted();size+=chunk.length;if(size>MAX)throw Error('更新清单过大。');parts.push(Buffer.from(chunk));}
      data=JSON.parse(Buffer.concat(parts).toString('utf8'));
    } else {data=await r.json();}
    if(data?.schemaVersion!==1 || !data.release || data.release.draft===true || data.release.prerelease===true)throw Error('更新清单格式无效。');
    return data.release;
  }
  throw Error('更新清单跳转过多。');
}
module.exports={fetchPublicRelease,MANIFEST_URL:URL};
