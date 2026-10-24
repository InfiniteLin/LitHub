/* 真实 PDF.js + 真实应用路由，使用生成的合成论文和独立浏览器配置。
 * 不启动 sidecar，不读取个人文献库，不连接外部 AI。 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { findBrowser } from './_browser.mjs';

function makePdf(wide = false) {
  const objects = [];
  const put = text => { objects.push(text); return objects.length; };
  put('<< /Type /Catalog /Pages 2 0 R >>');
  put('');
  const font = put('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pages = [];
  for (let i = 0; i < 24; i++) {
    const [w, h] = wide ? [1224, 792] : i === 1 ? [792, 396] : i === 2 ? [300, 500] : [612, 792];
    const stream = `0.2 0.4 0.7 rg 40 40 80 50 re f\n0 g BT /F1 18 Tf 50 ${h - 70} Td (Synthetic paper page ${i + 1}) Tj 0 -30 Td (Selectable reading text) Tj
      /F1 8 Tf 0 -22 Td (Fine print: vector text should remain sharp when zoomed.) Tj ET
      0 G 0.18 w 50 ${h - 130} m 360 ${h - 130} l S`;
    const content = put(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    pages.push(put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ${i === 2 && !wide ? '/Rotate 90' : ''}
      /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(n => n + ' 0 R').join(' ')}] >>`;
  let output = '%PDF-1.7\n', offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(output)); output += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const start = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(output);
}
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
    throw Error('timeout: ' + name + '\n' + diagnostic + '\n' + errors.join('\n'));
  };
  const check = async (name, expression) => { assert.equal(await evaluate(expression), true, name); console.log('PASS ' + name); };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/#/library` });
  await until('application ready', `typeof state !== 'undefined' && !!document.querySelector('#view')`);
  await evaluate(`
    window.testPaper = state.db.papers[0];
    Object.assign(testPaper, { live: true, translated: true, fileUrl: '/fixture.pdf', zhUrl: '/fixture.pdf', compareUrl: '/wide.pdf' });
    readerSession(testPaper.id).mode = 'en';
    location.hash = '#/reader/' + testPaper.id;
    window.pane = () => document.querySelector('#pane-en');
    window.side = n => pane()._pdf.metas[n].sides[0];
    window.anchor = point => PdfView.captureAnchor(pane(), point);
  `);
  await until('real PDF bitmap and text layer render', `pane()?._pdf?.metas[0]?.sides[0].rendered && document.querySelector('.textLayer span')`);
  await check('fit width has no horizontal overflow and all portrait slots match', `pane().scrollWidth<=pane().clientWidth+1 && side(0).cssW===side(5).cssW`);
  await check('real canvas contains paper content', `(() => {
    const c = side(0).canvas, pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < pixels.length; i += 68) if (pixels[i] < 180) return true;
    return false;
  })()`);
  await check('text selection and normalized annotations work', `(() => {
    const span = side(0).textDiv.querySelector('span'), range = document.createRange();
    range.selectNodeContents(span); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    const info = PdfAnnot.selectionToRects(); sel.removeAllRanges();
    if (!info || !info.text.includes('Synthetic paper')) return false;
    PdfAnnot.setAll(pane(), [{ id:'test', kind:'highlight', page:1, color:'yellow', rects:info.rects }]);
    return !!side(0).div.querySelector('.annot-highlight');
  })()`);
  mkdirSync('tests/.shots/pdf-view', { recursive: true });
  writeFileSync('tests/.shots/pdf-view/reading.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  await evaluate(`(() => { const p=pane(), s=side(5); p.scrollTop += s.div.getBoundingClientRect().top - p.getBoundingClientRect().top + s.cssH * .35 - 24; })()`);
  await until('reading page six ready', `side(5).rendered && anchor().page === 5`);
  await sleep(80);
  await evaluate(`window.beforeResize=anchor(); document.querySelector('#panes').style.width='850px'`);
  await until('pane resize keeps page and relative reading position', `(() => {
    const a=anchor(); return side(5).cssW < 850 && a.page===beforeResize.page && Math.abs(a.y-beforeResize.y)<.005;
  })()`);
  await evaluate(`(() => { const r=pane().getBoundingClientRect(); window.point={x:r.left+pane().clientWidth/2,y:r.top+200}; window.beforeZoom=anchor(point); applyReaderZoom(4, null, point); })()`);
  await until('400% zoom renders without canvas reuse errors', `side(5).paintedW === 2448 && !pane()._pdf.running`);
  await check('zoom keeps content under cursor and enables horizontal scrolling', `(() => {
    const a=anchor(point); return a.page===beforeZoom.page && Math.abs(a.y-beforeZoom.y)<.005 && Math.abs(a.x-beforeZoom.x)<.005
      && pane().scrollWidth > pane().clientWidth && pane().scrollLeft > 0;
  })()`);
  await check('canvas, page and selectable text use matching CSS dimensions', `(() => {
    const s=side(5), t=s.textDiv.getBoundingClientRect(), r=s.div.getBoundingClientRect();
    return Math.abs(t.width-s.cssW)<1 && Math.abs(t.height-s.cssH)<2 && Math.abs(r.width-s.cssW)<1
      && s.canvas.width*s.canvas.height <= 8e6;
  })()`);
  await evaluate(`applyReaderZoom(null, 'width');`);
  for (const [n, ratio] of [[1, .5], [2, .6]]) {
    await evaluate(`pane().scrollTop += side(${n}).div.getBoundingClientRect().top - pane().getBoundingClientRect().top - 50`);
    await until(`mixed page ${n + 1} renders with actual size/rotation`, `side(${n}).rendered && Math.abs(side(${n}).ratio - ${ratio})<.001`);
    await evaluate(`PdfView.layout(pane())`);
    await check(`mixed page ${n + 1} remains correct after relayout`, `Math.abs(side(${n}).cssH/side(${n}).cssW-${ratio})<.002`);
  }
  for (let n = 0; n < 24; n++) {
    await evaluate(`pane().scrollTop += side(${n}).div.getBoundingClientRect().top - pane().getBoundingClientRect().top - 34`);
    await until(`scroll page ${n + 1}`, `side(${n}).rendered`);
    assert.ok(await evaluate(`pane()._pdf.metas.reduce((v,m)=>v+m.sides[0].canvas.width*m.sides[0].canvas.height,0)<=24e6`));
  }
  await check('long scrolling releases old page bitmaps', `side(0).canvas.width === 0 && side(0).page === null`);
  await sleep(80);
  await evaluate(`window.savedAnchor=anchor(); window.oldPdf=pane()._pdf; location.hash='#/library'`);
  await until('route exit disposes document and every bitmap', `oldPdf.dead && oldPdf.entries.every(e=>e.destroyed) && !oldPdf.running && oldPdf.metas.every(m=>m.sides.every(s=>s.canvas.width===0))`);
  await evaluate(`location.hash='#/reader/'+testPaper.id`);
  await until('return to paper restores page anchor', `pane()?._pdf?.metas.length && anchor().page===savedAnchor.page && Math.abs(anchor().y-savedAnchor.y)<.01`);
  await evaluate(`window.oldMode=pane()._pdf; document.querySelector('[data-action="mode"][data-id="zh"]').click()`);
  await until('mode switch disposes prior PDF and renders translation', `oldMode.dead && document.querySelector('#pane-zh')?._pdf?.metas[0]?.sides[0].rendered`);
  await evaluate(`document.querySelector('[data-action="mode"][data-id="dual2"]').click()`);
  await until('wide comparison PDF ready', `document.querySelector('#pane-dual2')?._pdf?.metas[0]?.sides[0].rendered`);
  await evaluate(`applyReaderZoom(4)`);
  await until('wide comparison keeps full 400% layout within bitmap budget', `(() => {
    const s=document.querySelector('#pane-dual2')._pdf.metas[0].sides[0];
    return s.rendered && s.cssW===4896 && s.canvas.width*s.canvas.height<=8e6;
  })()`);
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 2, mobile: false });
  await until('DPR changes repaint text and bitmap together', `(() => {
    const s=document.querySelector('#pane-dual2')._pdf.metas[0].sides[0];
    return s.rendered && s.key.endsWith(':2') && s.paintedKey===s.key;
  })()`);
  await evaluate(`window.comparisonPane=document.querySelector('#pane-dual2'); comparisonPane.scrollTop=0; comparisonPane.scrollLeft=0;`);
  await until('wide 400% view has a completed native-resolution crop', `(() => {
    const s=comparisonPane._pdf.metas[0].sides[0];
    return !comparisonPane._pdf.running && s.detailCanvas && s.detailK >= devicePixelRatio && s.detailPaintedKey===s.detailWanted.key
      && s.detailWanted.x===0 && s.detailWanted.y===0;
  })()`);
  const quality = await evaluate(`(async () => {
    const s=comparisonPane._pdf.metas[0].sides[0], a=s.detailWanted;
    const reference=document.createElement('canvas'); reference.width=a.dw; reference.height=a.dh;
    await s.page.render({canvasContext:reference.getContext('2d',{alpha:false}),
      viewport:s.page.getViewport({scale:s.cssW/s.w}), transform:[a.k,0,0,a.k,-a.dx,-a.dy]}).promise;
    const preview=document.createElement('canvas'); preview.width=a.dw; preview.height=a.dh;
    preview.getContext('2d').drawImage(s.canvas,a.x/s.cssW*s.canvas.width,a.y/s.cssH*s.canvas.height,
      a.width/s.cssW*s.canvas.width,a.height/s.cssH*s.canvas.height,0,0,a.dw,a.dh);
    const r=reference.getContext('2d').getImageData(0,0,a.dw,a.dh).data,
      d=s.detailCanvas.getContext('2d').getImageData(0,0,a.dw,a.dh).data,
      b=preview.getContext('2d').getImageData(0,0,a.dw,a.dh).data;
    let detailError=0,previewError=0,count=0;
    for(let i=0;i<r.length;i+=4) {
      if(r[i]>245 && b[i]>245) continue;
      count++; detailError+=Math.abs(r[i]-d[i]); previewError+=Math.abs(r[i]-b[i]);
    }
    reference.width=preview.width=0;
    return {detailError:detailError/count,previewError:previewError/count,inkPixels:count,
      previewSampling:s.paintedK,sharpSampling:s.detailK};
  })()`);
  assert.ok(quality.inkPixels>1000, 'reference region contains real text and vector edges: '+JSON.stringify(quality));
  assert.ok(quality.previewError>1, 'capped whole-page preview loses detail at 400%');
  assert.ok(quality.detailError<quality.previewError*.1, 'sharp region matches direct high-resolution PDF rendering');
  console.log('PASS high-zoom pixel comparison: '+JSON.stringify(quality));
  await evaluate(`document.querySelectorAll('.pdf-detail-canvas').forEach(c=>c.style.visibility='hidden')`);
  writeFileSync('tests/.shots/pdf-view/zoom-preview.png', Buffer.from((await send('Page.captureScreenshot', {format:'png'})).result.data,'base64'));
  await evaluate(`document.querySelectorAll('.pdf-detail-canvas').forEach(c=>c.style.visibility='')`);
  writeFileSync('tests/.shots/pdf-view/zoom-sharp.png', Buffer.from((await send('Page.captureScreenshot', {format:'png'})).result.data,'base64'));
  await evaluate(`for(let i=0;i<16;i++) applyReaderZoom(1+i/8); applyReaderZoom(2);`);
  await until('rapid zoom converges to latest bitmap and text', `(() => {
    const p=document.querySelector('#pane-dual2'), s=p._pdf.metas[0].sides[0];
    return s.paintedW===2448 && s.paintedKey===s.key && !p._pdf.running;
  })()`);
  assert.deepEqual(errors, [], 'no uncaught errors or page render failures');
  console.log('PASS real PDF.js lifecycle, geometry, selection, budgets and route integration');
} finally {
  ws?.close(); chrome.kill(); server.close();
}
