/* 真实 PDF.js + 真实应用路由，使用生成的合成论文和独立浏览器配置。
 * 不启动 sidecar，不读取个人文献库，不连接外部 AI。 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { findBrowser } from './_browser.mjs';

const fixtures=JSON.parse(execFileSync('python',['-c',`import pymupdf,sys,json,base64
pdf=pymupdf.open()
for _ in range(3):pdf.new_page(width=612,height=792)
pdf[0].insert_text((50,70),'See Figure 4. Also compare Table 2 and Figure 99.',fontsize=13)
pdf[1].insert_text((60,350),'Figure 4: A native PDF link target.',fontsize=13)
pdf[2].insert_text((60,450),'Table 2: A table caption without a PDF link.',fontsize=13)
pdf[0].insert_link({'kind':pymupdf.LINK_GOTO,'from':pymupdf.Rect(74,55,130,74),'page':1,'to':pymupdf.Point(60,330)})
wide=pymupdf.open()
for _ in range(3):wide.new_page(width=1224,height=792)
wide[0].insert_text((80,70),'Compare Table 2.',fontsize=13)
wide[0].insert_text((720,70),'Compare Table 2.',fontsize=13)
wide[1].insert_text((80,200),'Table 2: Left caption.',fontsize=13)
wide[1].insert_text((720,600),'Table 2: Right caption.',fontsize=13)
print(json.dumps({'normal':base64.b64encode(pdf.tobytes()).decode(),'wide':base64.b64encode(wide.tobytes()).decode()}))`],{maxBuffer:5e6}).toString());
const makePdf=wide=>Buffer.from(wide?fixtures.wide:fixtures.normal,'base64');
const root = path.resolve('frontend'), fixture = makePdf(), wide = makePdf(true);
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://local').pathname;
    if (pathname === '/fixture.pdf' || pathname === '/wide.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.end(pathname === '/wide.pdf' ? wide : fixture); return;
    }
    const file = path.resolve(root, '.' + pathname.replace(/\/$/, '/index.html'));
    if (!file.startsWith(root + path.sep)) throw Error('path');
    const data = await readFile(file);
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port, debugPort = 13000 + Math.floor(Math.random() * 1000);
const profile = mkdtempSync(path.join(tmpdir(), 'lithub-pdf-view-'));
const chrome = spawn(findBrowser(), ['--headless=new', '--disable-gpu', '--no-first-run',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
try {
  let target;
  for (let i = 0; i < 80 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
    if (!target) await sleep(100);
  }
  assert.ok(target, 'browser started');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0;
  const pending = new Map(), errors = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise(resolve => {
    const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.exception?.description);
    return r.result.result.value;
  };
  const until = async (name, expression) => {
    for (let i = 0; i < 160; i++) {
      if (await evaluate(expression)) { console.log('PASS ' + name); return; }
      await sleep(50);
    }
    const diagnostic = await evaluate(`typeof activePdfPane === 'function' && activePdfPane()?._pdf?.metas.length ? (() => {
      const p=activePdfPane(), s=p._pdf.metas[0].sides[0];
      return JSON.stringify({current:PdfView.captureAnchor(p), saved:window.savedAnchor, session:readerSession(testPaper.id).anchors,
        scroll:p.scrollTop,width:p.clientWidth,height:p.clientHeight,docHeight:p.scrollHeight,state:state.reader.fit,zoom:state.reader.zoom,
        dpr:devicePixelRatio,media:p._pdf.dprQuery?.media,matches:p._pdf.dprQuery?.matches,key:s.key,paintedKey:s.paintedKey,
        rendered:s.rendered,near:s.near,running:p._pdf.running,queued:p._pdf.queue.size});
    })() : ''`);
    console.log(await evaluate(`window.pane && JSON.stringify({html:pane.innerHTML.slice(0,2000),s:pane._pdf?.metas[0].sides.map(s=>({near:s.near,rendered:s.rendered,cssW:s.cssW,revision:s.revision,links:s.referenceLayer?.innerHTML,text:s.textDiv?.textContent}))})`));
    throw Error('timeout: ' + name + '\n' + diagnostic + '\n' + errors.join('\n'));
  };
  const check = async (name, expression) => { assert.equal(await evaluate(expression), true, name); console.log('PASS ' + name); };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/#/library` });
  await until('application ready', `typeof state !== 'undefined' && !!document.querySelector('#view')`);
  await evaluate(`(async()=>{disposePdfHosts();document.getElementById('view').innerHTML='<div class="pane" id="reference-test" style="height:650px;overflow:auto;position:relative"></div>';window.pane=document.getElementById('reference-test');await PdfView.mount(pane,'/fixture.pdf',{fit:'width'});})()`);
  await until('text rendered',`pane._pdf.metas[0].sides[0].rendered`);
  await until('native and detected references are clickable',`pane.querySelectorAll('.pdf-reference-link').length>=3`);
  const click=async label=>{
    const point=await evaluate(`(()=>{const link=[...pane.querySelectorAll('.pdf-reference-link')].find(a=>a.title.includes(${JSON.stringify(label)}));if(!link)throw Error('missing link');const r=link.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  };
  await click('文内位置');
  await until('native Figure destination and return control',`PdfView.captureAnchor(pane).page===1 && !pane.querySelector('.pdf-reference-nav').hidden`);
  await evaluate(`pane.querySelector('.pdf-reference-nav button').click()`);
  await until('return restores original reading position',`PdfView.captureAnchor(pane).page===0 && !pane.querySelector('.pdf-reference-nav')?.offsetHeight`);
  await until('source references remount after returning',`[...pane.querySelectorAll('.pdf-reference-link')].some(a=>a.title.includes('Table 2'))`);
  await click('Table 2');
  await until('caption fallback finds Table on another page',`PdfView.captureAnchor(pane).page===2 && pane.querySelector('.pdf-reference-nav [role=status]').textContent===''`);
  await evaluate(`pane.querySelector('.pdf-reference-nav button').click();PdfView.setZoom(pane,1.5)`);
  await until('links rebuilt after zoom',`pane._pdf.metas[0].sides[0].rendered && [...pane.querySelectorAll('.pdf-reference-link')].some(a=>a.title.includes('Table 2'))`);
  await click('Figure 99');
  await until('missing target shows inline feedback without moving',`pane.querySelector('.pdf-reference-nav [role=status]').textContent.includes('未找到') && PdfView.captureAnchor(pane).page===0`);
  await evaluate(`(async()=>{await PdfView.mountBilingual(pane,'/fixture.pdf','/fixture.pdf',{fit:'width'});})()`);
  await until('bilingual links ready',`pane._pdf.metas[0].sides.every(s=>s.referenceLayer?.querySelector('[title*="Table 2"]'))`);
  await evaluate(`pane._pdf.metas[0].sides[1].referenceLayer.querySelector('[title*="Table 2"]').click()`);
  await until('translated side resolves within its own PDF',`PdfView.captureAnchor(pane).page===2 && !pane.querySelector('.pdf-reference-nav').hidden`);
  await evaluate(`PdfView.mount(pane,'/wide.pdf',{fit:'width',referenceColumns:2})`);
  await until('combined bilingual page links ready',`pane._pdf.metas[0].sides[0].referenceLayer?.querySelectorAll('[title*="Table 2"]').length===2`);
  await evaluate(`pane._pdf.metas[0].sides[0].referenceLayer.querySelectorAll('[title*="Table 2"]')[1].click()`);
  await until('combined bilingual chooses right caption',`PdfView.captureAnchor(pane).page===1 && PdfView.captureAnchor(pane).y>.6`);
  await evaluate(`PdfView.dispose(pane)`);
  assert.equal(await evaluate(`!!document.querySelector('.pdf-reference-nav')`),false);
  assert.deepEqual(errors,[]);
  console.log('PASS real PDF.js native links, fallback captions, return history, zoom, missing targets, bilingual documents and disposal');
} finally {
  ws?.close(); chrome.kill(); server.close();
}
