// Isolated browser pixel regression: production renderer/CSS, no API or user library.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {findBrowser} from './_browser.mjs';
const server=createServer((req,res)=>{
  if(req.url==='/annot.js') {res.setHeader('Content-Type','text/javascript');res.end(readFileSync('frontend/js/pdf-annot.js'));}
  else if(req.url==='/styles.css') {res.setHeader('Content-Type','text/css');res.end(readFileSync('frontend/css/styles.css'));}
  else {res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<link rel="stylesheet" href="/styles.css"><style>body{margin:0;background:white}.pdf-page{position:absolute;left:0;top:0;width:800px;height:600px;background:white}</style><div id="pane-en"><div class="pdf-page"><div class="pdf-annot"></div></div></div><script src="/annot.js"></script>`);}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=mkdtempSync(join(tmpdir(),'lithub-overlap-'));
const debugPort=11000+Math.floor(Math.random()*1000);
const chrome=spawn(findBrowser(),['--headless=new','--disable-gpu','--no-sandbox',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'--window-size=900,700','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws;
try {
  let tab;
  for(let i=0;i<60;i++) {
    try {tab=(await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(t=>t.type==='page');if(tab)break;}catch{}
    await sleep(100);
  }
  assert.ok(tab,'browser started');
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r=>ws.onopen=r);
  let id=0;const pending=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>reject(Error(method+' timed out')),15000);pending.set(n,m=>{clearTimeout(timer);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result);});ws.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;};
  await send('Page.enable');
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}`});
  for(let i=0;i<60;i++){if(await evaluate('!!window.PdfAnnot'))break;await sleep(100);}
  await evaluate(`window.pane=document.getElementById('pane-en');window.page=document.querySelector('.pdf-page');pane._pdf={metas:[{sides:[{div:page}]}]};
    window.ann=(id,color,x,w)=>({id,color,view:'en',page:1,kind:'highlight',created:'2026-11-06T10:00:00',paint_order:id==='old'?0:1,rects:[{x,y:.2,w,h:.1}]});
    window.old=ann('old','yellow',.1,.5);window.latest=ann('new','blue',.3,.5);`);
  const pixel=async(x,y)=>{
    const {data}=await send('Page.captureScreenshot',{format:'png',clip:{x,y,width:2,height:2,scale:1}});
    return evaluate(`(async()=>{const i=new Image();i.src='data:image/png;base64,${data}';await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);return [...ctx.getImageData(0,0,1,1).data];})()`);
  };
  await evaluate('PdfAnnot.setAll(pane,[latest])');const blue=await pixel(320,150);
  await evaluate('PdfAnnot.setAll(pane,[old])');const yellow=await pixel(160,150);
  await evaluate('PdfAnnot.add(pane,latest)');
  assert.deepEqual(await pixel(320,150),blue,'overlap equals single blue, no blended yellow');
  assert.deepEqual(await pixel(160,150),yellow,'uncovered old region preserved');
  assert.deepEqual(await pixel(560,150),blue,'new extension blue');
  await evaluate('PdfAnnot.setAll(pane,[latest,old])');
  assert.deepEqual(await pixel(320,150),blue,'reload reading order cannot change latest color');
  await evaluate("PdfAnnot.update(pane,{...old,color:'pink',modified:'2026-11-06T10:01:00'})");
  const pink=await pixel(320,150);
  await evaluate("PdfAnnot.setAll(pane,[{...old,color:'pink'}])");
  assert.deepEqual(await pixel(320,150),pink,'recolor also replaces overlap without blending');
  await evaluate("PdfAnnot.setAll(pane,[old,{...latest,rects:old.rects}])");
  assert.deepEqual(await pixel(320,150),blue,'full overlap only latest color');
  assert.equal(await evaluate("document.querySelectorAll('.annot-highlight').length"),1);
  await evaluate("PdfAnnot.remove(pane,'new')");
  assert.deepEqual(await pixel(320,150),yellow,'deleting latest restores original color');
  console.log('PASS real Chromium pixels: partial/full overlap, no mixed colors, reload order, recolor and deletion');
} finally {
  ws?.close();chrome.kill();
  await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));
  await new Promise(r=>server.close(r));
  rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
