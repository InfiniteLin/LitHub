'use strict';

// net.fetch rejects manual redirects in Electron. Expose each redirect as a
// response so the update caller can validate its destination before requesting it.
function requestUpdate(net,url,options={}) {
  return new Promise((resolve,reject)=>{
    const {signal}=options;
    if(signal?.aborted){reject(signal.reason);return;}
    const request=net.request({url,method:'GET',redirect:'manual',credentials:'omit',useSessionCookies:false,cache:options.cache||'no-store'});
    let body;
    const cleanup=()=>signal?.removeEventListener('abort',abort);
    const abort=()=>{cleanup();body?.destroy(signal.reason);request.abort();reject(signal.reason);};
    signal?.addEventListener('abort',abort,{once:true});
    request.on('error',error=>{cleanup();body?.destroy(error);reject(error);});
    for(const [key,value] of Object.entries(options.headers||{}))request.setHeader(key,value);
    const headersFor=record=>{
      const headers=new Headers();
      for(const [key,value] of Object.entries(record||{}))headers.set(key,Array.isArray(value)?value.join(', '):String(value));
      return headers;
    };
    request.on('redirect',(status,_method,target,record)=>{
      cleanup();
      if(options.redirect==='error'){reject(Error('更新请求不允许跳转。'));request.abort();return;}
      const headers=headersFor(record);headers.set('location',target);
      resolve({status,ok:false,headers,body:null});
      request.abort();
    });
    request.on('response',response=>{
      body=response;
      body.once('end',cleanup);body.once('close',cleanup);
      response.on('aborted',()=>body.destroy(signal?.reason||Error('更新请求已中断。')));
      resolve({status:response.statusCode,ok:response.statusCode>=200&&response.statusCode<300,
        headers:headersFor(response.headers),body,
        json:async()=>{const chunks=[];for await(const chunk of body)chunks.push(Buffer.from(chunk));return JSON.parse(Buffer.concat(chunks).toString('utf8'));}});
    });
    request.end();
  });
}
module.exports={requestUpdate};
