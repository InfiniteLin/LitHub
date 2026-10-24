import assert from 'node:assert/strict';
import { harness, tick, deferred } from './pdf-view.harness.mjs';

async function test(name, run) { await run(); console.log('PASS ' + name); }

await test('mixed landscape page keeps actual ratio after repeated layouts', async () => {
  const h = harness(), { PdfView, pane } = h;
  h.makeDoc('/mixed', [[612, 792], [792, 396]]);
  await PdfView.mount(pane, '/mixed');
  const side = pane._pdf.metas[1].sides[0];
  pane._pdf.io.fire(side); await h.idle(pane);
  assert.equal(side.ratio, .5);
  const height = side.cssH;
  PdfView.layout(pane); PdfView.layout(pane);
  assert.equal(side.cssH, height);
  assert.equal(height, Math.round(side.cssW / 2));
});

await test('manual zoom really grows pages; wide 400% retains CSS size within bitmap budget', async () => {
  const h = harness(), { PdfView, pane } = h;
  h.makeDoc('/wide', [[1224, 792]]);
  await PdfView.mount(pane, '/wide');
  PdfView.setZoom(pane, 2);
  const side = pane._pdf.metas[0].sides[0], width = side.cssW;
  PdfView.setZoom(pane, 4);
  assert.equal(side.cssW, width * 2);
  assert.equal(side.cssW, 4896);
  pane._pdf.io.fire(side); await h.idle(pane);
  assert.ok(side.rendered);
  assert.ok(side.canvas.width * side.canvas.height <= 8e6);
  assert.ok(side.paintedK < 1, 'sampling can decrease without shrinking CSS zoom');
});

await test('leaving preload region releases canvas and text, retains page placeholder, reentry redraws', async () => {
  const h = harness(), { PdfView, pane } = h;
  await PdfView.mount(pane, '/doc');
  const pdf = pane._pdf, side = pdf.metas[4].sides[0];
  pdf.io.fire(side); await h.idle(pane);
  const height = side.div.style.height;
  assert.ok(side.canvas.width > 0);
  pdf.io.fire(side, false); await h.idle(pane);
  assert.equal(side.canvas.width, 0);
  assert.equal(side.page, null);
  assert.equal(side.div.style.height, height);
  pdf.io.fire(side); await h.idle(pane);
  assert.ok(side.rendered && side.canvas.width > 0);
});

await test('bilingual dispose destroys both documents and observers, removes listeners', async () => {
  const h = harness(), { PdfView, pane, calls } = h;
  h.makeDoc('/en', [[612, 792], [612, 792]]); h.makeDoc('/zh', [[612, 792]]);
  await PdfView.mountBilingual(pane, '/en', '/zh');
  const pdf = pane._pdf;
  pdf.io.fire(pdf.metas[1].sides[1]); await h.idle(pane);
  assert.equal(calls.renders.length, 0, 'missing translated page never rendered');
  await PdfView.dispose(pane);
  assert.deepEqual(calls.destroyed.sort(), ['/en', '/zh']);
  assert.ok(calls.observers.every(o => o.disconnected));
  assert.ok(calls.mediaRemoved);
  assert.equal(pane.listeners.size, 0);
  assert.equal(h.window.listeners.size, 0);
  assert.equal(pane._pdf, null);
});

await test('late old load cannot replace current document and is destroyed', async () => {
  const h = harness(), { PdfView, pane, controls, calls } = h;
  const old = deferred(), newer = deferred();
  controls.load = url => ({ promise: url === '/old' ? old.promise : newer.promise });
  const first = PdfView.mount(pane, '/old').catch(e => e);
  await tick();
  const second = PdfView.mount(pane, '/new');
  await tick(); newer.resolve(h.makeDoc('/new')); await second;
  old.resolve(h.makeDoc('/old'));
  assert.equal((await first).name, 'AbortException');
  assert.equal(pane._pdf.doc.name, '/new');
  assert.deepEqual(calls.destroyed, ['/old']);
});

await test('dispose cancels a pending loading task immediately', async () => {
  const h = harness(), { PdfView, pane, controls } = h;
  const pending = deferred(); let destroyed = 0;
  controls.load = () => ({ promise: pending.promise, destroy() { destroyed++; pending.reject(Error('cancelled')); } });
  const load = PdfView.mount(pane, '/pending').catch(e => e);
  await tick(); await PdfView.dispose(pane);
  await load;
  assert.equal(destroyed, 1);
  assert.equal(pane._pdf, null);
});

await test('rapid zoom cancels obsolete bitmap, serializes same canvas and only builds latest text', async () => {
  const h = harness(), { PdfView, pane, controls, calls } = h;
  const jobs = []; let count = 0, peak = 0;
  controls.render = (_, params) => {
    if (params.canvasContext.canvas.className === 'pdf-detail-canvas') return { promise: Promise.resolve(), cancel() {} };
    count++; peak = Math.max(peak, count);
    const d = deferred();
    const job = { promise: d.promise.finally(() => count--), cancel() { d.reject(Object.assign(Error('cancel'), { name: 'RenderingCancelledException' })); } };
    jobs.push(d); return job;
  };
  await PdfView.mount(pane, '/doc');
  const side = pane._pdf.metas[0].sides[0];
  pane._pdf.io.fire(side); await tick();
  PdfView.setZoom(pane, 2); PdfView.setZoom(pane, 4);
  await tick(); await tick();
  assert.equal(jobs.length, 2);
  assert.equal(calls.text.length, 0, 'cancelled paint must not build stale text');
  jobs[1].resolve(); await h.idle(pane);
  assert.equal(peak, 1);
  assert.equal(side.paintedW, 2448);
  assert.equal(calls.text.length, 1);
});

await test('queue bounds concurrency and total canvas pixels', async () => {
  const h = harness(), { PdfView, pane, controls } = h;
  let count = 0, peak = 0;
  controls.render = () => {
    count++; peak = Math.max(count, peak);
    return { promise: tick().finally(() => count--), cancel() {} };
  };
  await PdfView.mount(pane, '/doc'); PdfView.setZoom(pane, 4);
  const pdf = pane._pdf;
  for (const meta of pdf.metas) pdf.io.fire(meta.sides[0]);
  await h.idle(pane);
  assert.ok(peak <= 2);
  assert.ok(pdf.metas.reduce((n, m) => n + m.sides[0].canvas.width * m.sides[0].canvas.height, 0) <= 24e6);
});

await test('zooming back to a previously painted size still redraws a cancelled canvas', async () => {
  const h = harness(), { PdfView, pane, controls } = h;
  await PdfView.mount(pane, '/doc');
  const side = pane._pdf.metas[0].sides[0];
  PdfView.setZoom(pane, 1);
  pane._pdf.io.fire(side); await h.idle(pane);
  assert.equal(side.paintedW, 612);
  const pending = deferred(); let cancelled = false;
  controls.render = () => ({ promise: pending.promise, cancel() {
    cancelled = true;
    pending.reject(Object.assign(Error('cancel'), { name: 'RenderingCancelledException' }));
  } });
  PdfView.setZoom(pane, 2); await tick();
  controls.render = null;
  PdfView.setZoom(pane, 1); await h.idle(pane);
  assert.ok(cancelled);
  assert.ok(side.rendered);
  assert.equal(side.paintedW, 612);
  assert.equal(side.paintedKey, side.key);
});

await test('zoom during initial loading is applied once the document arrives', async () => {
  const h = harness(), { PdfView, pane, controls } = h;
  const pending = deferred();
  controls.load = () => ({ promise: pending.promise });
  const load = PdfView.mount(pane, '/pending');
  await tick();
  PdfView.setZoom(pane, 3);
  pending.resolve(h.makeDoc('/pending'));
  await load;
  assert.equal(pane._pdf.fit, 'manual');
  assert.equal(pane._pdf.metas[0].sides[0].cssW, 1836);
  await PdfView.dispose(pane);
});

await test('late getPage after disposal never resurrects a canvas', async () => {
  const h = harness(), { PdfView, pane, controls } = h;
  await PdfView.mount(pane, '/doc');
  const d = deferred(); controls.page = () => d.promise;
  const pdf = pane._pdf, side = pdf.metas[1].sides[0];
  pdf.io.fire(side); await tick(); await PdfView.dispose(pane);
  d.resolve(h.makePage(2)); await tick(); await tick();
  assert.equal(side.canvas.width, 0);
  assert.equal(side.page, null);
  assert.equal(pdf.running, 0);
});

await test('page failure offers retry and retries the same page successfully', async () => {
  const h = harness(), { PdfView, pane, controls } = h;
  await PdfView.mount(pane, '/doc');
  const side = pane._pdf.metas[1].sides[0];
  controls.page = async () => { throw Error('temporary'); };
  pane._pdf.io.fire(side); await h.idle(pane);
  assert.ok(side.errorEl);
  controls.page = null;
  side.errorEl.listeners.get('click')(); await h.idle(pane);
  assert.ok(side.rendered);
});

await test('failed bilingual open destroys already loaded and late sibling documents', async () => {
  const h = harness(), { PdfView, pane, controls, calls } = h;
  const late = deferred();
  controls.load = url => ({ promise: url === '/bad' ? Promise.reject(Error('bad')) : late.promise });
  await assert.rejects(PdfView.mountBilingual(pane, '/bad', '/late'));
  late.resolve(h.makeDoc('/late')); await tick();
  assert.deepEqual(calls.destroyed, ['/late']);
  assert.equal(pane._pdf, null);
});

function scrollGeometry(h, side) {
  h.pane.scrollLeft = h.pane.scrollTop = 0;
  side.div.rect = () => ({ left: -h.pane.scrollLeft, top: -h.pane.scrollTop,
    right: side.cssW - h.pane.scrollLeft, bottom: side.cssH - h.pane.scrollTop,
    width: side.cssW, height: side.cssH });
}

await test('sharp region is reused within its buffer and follows horizontal scrolling without rebuilding text', async () => {
  const h = harness(), { PdfView, pane, calls } = h;
  await PdfView.mount(pane, '/doc'); PdfView.setZoom(pane, 4);
  const pdf = pane._pdf, side = pdf.metas[0].sides[0]; scrollGeometry(h, side);
  pdf.io.fire(side); await h.idle(pane);
  const first = side.detailCanvas, texts = calls.text.length, pages = calls.pages.length;
  assert.ok(first && side.detailK >= h.window.devicePixelRatio);
  pane.scrollLeft = 40; pdf.onScroll(); await h.idle(pane);
  assert.ok(side.detailCanvas === first, 'small scroll should reuse the overscan region');
  pane.scrollLeft = 600; pdf.onScroll(); await h.idle(pane);
  assert.ok(side.detailCanvas !== first);
  assert.equal(first.width, 0, 'old sharp bitmap is released after replacement');
  assert.ok(side.detailWanted.x <= 600 && side.detailWanted.x + side.detailWanted.width >= 1260);
  assert.equal(calls.text.length, texts);
  assert.equal(calls.pages.length, pages);
  assert.equal(calls.errors.length, 0);
  await PdfView.dispose(pane);
});

await test('pan during a sharp render cancels the obsolete crop and paints the latest region', async () => {
  const h = harness(), { PdfView, pane, controls, calls } = h;
  const jobs = [];
  controls.render = (_, params) => {
    if (params.canvasContext.canvas.className !== 'pdf-detail-canvas') return;
    const d = deferred(); jobs.push({ ...d, canvas: params.canvasContext.canvas });
    return { promise: d.promise, cancel() { d.reject(Object.assign(Error('cancel'), { name:'RenderingCancelledException' })); } };
  };
  await PdfView.mount(pane, '/doc'); PdfView.setZoom(pane, 4);
  const pdf=pane._pdf, side=pdf.metas[0].sides[0]; scrollGeometry(h, side);
  pdf.io.fire(side); await tick(); await tick();
  assert.equal(jobs.length, 1);
  pane.scrollLeft=600; pdf.onScroll(); await tick(); await tick();
  assert.equal(jobs.length, 2);
  jobs[1].resolve(); await h.idle(pane);
  assert.equal(jobs[0].canvas.width, 0);
  assert.equal(side.detailPaintedKey, side.detailWanted.key);
  assert.equal(calls.text.length, 1);
  assert.equal(calls.errors.length, 0);
  await PdfView.dispose(pane);
});

await test('zoom during a detail-only redraw does not strand the new page layout', async () => {
  const h = harness(), { PdfView, pane, controls } = h;
  await PdfView.mount(pane, '/doc'); PdfView.setZoom(pane, 4);
  const pdf=pane._pdf, side=pdf.metas[0].sides[0]; scrollGeometry(h, side);
  pdf.io.fire(side); await h.idle(pane);
  const pending=deferred(); let cancelled=false;
  controls.render = (_, params) => {
    if (params.canvasContext.canvas.className !== 'pdf-detail-canvas') return;
    return { promise:pending.promise, cancel() { cancelled=true; pending.reject(Object.assign(Error('cancel'), {name:'RenderingCancelledException'})); } };
  };
  pane.scrollLeft=600; pdf.onScroll(); await tick(); await tick();
  controls.render=null;
  PdfView.setZoom(pane, 2); await h.idle(pane);
  assert.ok(cancelled);
  assert.equal(side.paintedW, 1224);
  assert.equal(side.paintedKey, side.key);
  assert.ok(side.rendered);
  assert.ok((side.detailCanvas ? side.detailK : side.paintedK) >= 2);
  await PdfView.dispose(pane);
});

await test('detail canvases are absent outside the viewport and all sharp resources are disposed', async () => {
  const h=harness(), {PdfView,pane}=h;
  await PdfView.mount(pane, '/doc'); PdfView.setZoom(pane, 4);
  const pdf=pane._pdf, side=pdf.metas[0].sides[0]; scrollGeometry(h,side);
  pdf.io.fire(side); await h.idle(pane);
  const canvas=side.detailCanvas;
  pane.scrollLeft=side.cssW+100; pdf.onScroll(); await h.idle(pane);
  assert.equal(canvas.width,0);
  assert.equal(side.detailCanvas,null);
  assert.ok(side.canvas.width>0,'prefetch region keeps its small preview');
  pane.scrollLeft=0; pdf.onScroll(); await h.idle(pane);
  const restored=side.detailCanvas;
  await PdfView.dispose(pane);
  assert.equal(restored.width,0);
  assert.equal(side.detailPending,null);
});

await test('large DPR crops honor combined preview/detail budget while replacing the old region', async () => {
  const h=harness(), {PdfView,pane,controls}=h;
  h.window.devicePixelRatio=4; pane.clientWidth=1500; pane.clientHeight=900;
  h.makeDoc('/wide',[[1224,792]]);
  await PdfView.mount(pane,'/wide'); PdfView.setZoom(pane,4);
  const pdf=pane._pdf, side=pdf.metas[0].sides[0]; scrollGeometry(h,side);
  let peak=0;
  controls.render=()=>{
    const pixels=pdf.metas.flatMap(m=>m.sides).reduce((n,s)=>n+[s.canvas,s.detailCanvas,s.detailPending]
      .reduce((v,c)=>v+(c?c.width*c.height:0),0),0);
    peak=Math.max(peak,pixels);
  };
  pdf.io.fire(side); await h.idle(pane);
  const old=side.detailCanvas;
  assert.ok(side.detailK>=4);
  pane.scrollLeft=600; pdf.onScroll(); await h.idle(pane);
  assert.ok(old!==side.detailCanvas && old.width===0);
  assert.ok(peak<=48e6, 'combined active and pending bitmaps must remain bounded');
  assert.ok(side.detailK>=4);
  await PdfView.dispose(pane);
});

await test('dispose during sharp rendering cancels and releases the pending canvas', async () => {
  const h=harness(), {PdfView,pane,controls}=h;
  const pending=deferred(); let canvas, cancelled=false;
  controls.render=(_,params)=>{
    if(params.canvasContext.canvas.className!=='pdf-detail-canvas') return;
    canvas=params.canvasContext.canvas;
    return {promise:pending.promise,cancel(){cancelled=true;pending.reject(Object.assign(Error('cancel'),{name:'RenderingCancelledException'}));}};
  };
  await PdfView.mount(pane,'/doc'); PdfView.setZoom(pane,4);
  const pdf=pane._pdf, side=pdf.metas[0].sides[0];
  pdf.io.fire(side); await tick(); await tick();
  assert.ok(canvas);
  await PdfView.dispose(pane); await tick();
  assert.ok(cancelled);
  assert.equal(canvas.width,0);
  assert.equal(side.detailPending,null);
  assert.equal(pdf.running,0);
});
