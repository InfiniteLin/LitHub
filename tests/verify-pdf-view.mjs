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
  await evaluate(`
    (async () => {
    window.pollingOriginalLive = LithubAPI.live;
    window.pollingOriginalTasks = LithubAPI.tasks;
    window.pollingPdf = pane()._pdf;
    window.pollingCanvas = side(0).canvas;
    window.pollingTask = { paper_id: testPaper.id, status: 'queued', progress: 0 };
    LithubAPI.live = true;
    LithubAPI.tasks = async () => [{ ...pollingTask }];
    testPaper.translated = false;
    pane().scrollTop = 250;
    window.pollingScroll = pane().scrollTop;
    await pollTasks();
    for (const progress of [10, 20, 50, 90]) {
      Object.assign(pollingTask, {status: 'running', progress});
      await pollTasks();
    }
    })()
  `);
  await check('translation polling preserves original PDF, canvas and scroll', `pane()._pdf===pollingPdf
    && side(0).canvas===pollingCanvas && !pollingPdf.dead && pane().scrollTop===pollingScroll
    && document.querySelector('.reader-bar [data-action="translate"] .spin').textContent==='翻译中 90%'`);
  await evaluate(`(async () => { pollingTask.status='done'; await pollTasks(); await pollTasks(); })()`);
  await check('translation completion preserves original PDF and updates button', `testPaper.translated
    && pane()._pdf===pollingPdf && side(0).canvas===pollingCanvas && !pollingPdf.dead
    && pane().scrollTop===pollingScroll
    && document.querySelector('.reader-bar [data-action="translate"]').textContent==='已翻译'`);
  await evaluate(`
    testPaper.zhUrl='/fixture.pdf'; testPaper.compareUrl='/wide.pdf';
    state.liveTasks=[];
    LithubAPI.live=pollingOriginalLive; LithubAPI.tasks=pollingOriginalTasks;
  `);
  await evaluate(`
    window.renamePdf = pane()._pdf;
    window.renameCanvas = side(0).canvas;
    window.wasLive = LithubAPI.live;
    window.oldUpdate = LithubAPI.updatePaper;
    LithubAPI.live = true;
    LithubAPI.updatePaper = async (id, fields) => ({ title: fields.title });
    document.querySelector('.reader-bar [data-action="rename-paper"]').click();
    document.querySelector('.paper-title-input').value = '  Updated Paper Title  ';
  `);
  await check('rename edits the existing heading without a modal', `document.querySelector('.reader-title h1 .paper-title-input')===document.activeElement && !document.querySelector('.modal-mask')`);
  mkdirSync('tests/.shots/pdf-view', { recursive: true });
  writeFileSync('tests/.shots/pdf-view/rename-inline.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until('reader rename updates heading and tab without replacing PDF', `!document.querySelector('.paper-title-input')
    && document.querySelector('.reader-title h1').textContent==='Updated Paper Title'
    && document.querySelector('.tab.active .tab-title').textContent==='Updated Paper Title'
    && pane()._pdf===renamePdf && side(0).canvas===renameCanvas && !renamePdf.dead`);
  await evaluate(`
    LithubAPI.updatePaper = async () => { throw new Error('Test save failed'); };
    document.querySelector('.reader-bar [data-action="rename-paper"]').click();
    document.querySelector('.paper-title-input').value = 'Should not be saved';
    document.querySelector('.paper-title-input').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true}));
  `);
  await until('rename API failure retains old title and editable input', `document.querySelector('.paper-title-input')
    && !document.querySelector('.paper-title-input').readOnly && testPaper.title==='Updated Paper Title'`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await check('Escape cancels inline rename without affecting reader', `!document.querySelector('.paper-title-input') && testPaper.title==='Updated Paper Title' && pane()._pdf===renamePdf`);
  await evaluate(`
    LithubAPI.updatePaper=async (id, fields) => ({title:fields.title});
    document.querySelector('.reader-bar [data-action="rename-paper"]').click();
    const input=document.querySelector('.paper-title-input');
    input.value='IME draft';
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}));
  `);
  await check('IME Enter does not submit an unfinished title', `!!document.querySelector('.paper-title-input') && testPaper.title==='Updated Paper Title'`);
  await evaluate(`document.querySelector('.paper-title-input').value='  '; document.querySelector('.paper-title-input').blur();`);
  await check('empty blur restores original title', `!document.querySelector('.paper-title-input') && testPaper.title==='Updated Paper Title'`);
  await evaluate(`LithubAPI.live=wasLive; LithubAPI.updatePaper=oldUpdate;`);
  await evaluate(`window.fullToolbarWidth=document.querySelector('.reader-bar').getBoundingClientRect().width; mountNotePanel(testPaper);`);
  await until('note panel and actual Markdown editor mount', `!!document.querySelector('#note-panel') && NoteEditor.isMounted()`);
  await until('notes start below toolbar and only PDF gives up width', `(() => {
    const bar=document.querySelector('.reader-bar').getBoundingClientRect(), panel=document.querySelector('#note-panel').getBoundingClientRect();
    return Math.abs(panel.top-bar.bottom)<1 && Math.abs(bar.width-fullToolbarWidth)<1
      && getComputedStyle(document.querySelector('.reader')).paddingRight==='0px'
      && parseFloat(getComputedStyle(document.querySelector('#panes')).paddingRight)>0;
  })()`);
  await check('toolbar AI and note buttons remain clickable with notes open', `['ai-panel','note-panel','webai-toggle'].every(action => {
    const el=document.querySelector('.reader-bar [data-action="'+action+'"]'); if (!el) return true;
    const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
  })`);
  await evaluate(`setNotePanelWidth(1100)`);
  await check('wide notes keep the full toolbar visible', `document.querySelector('#note-panel').getBoundingClientRect().width===1100
    && document.querySelector('.reader-bar').getBoundingClientRect().width===fullToolbarWidth`);
  await evaluate(`document.querySelector('.reader-bar').style.paddingBottom='30px'`);
  await until('notes follow toolbar height changes', `Math.abs(document.querySelector('#note-panel').getBoundingClientRect().top-document.querySelector('.reader-bar').getBoundingClientRect().bottom)<1`);
  await evaluate(`document.querySelector('.reader-bar').style.paddingBottom=''; setNotePanelWidth(760);`);
  await until('notes realign after toolbar height restored', `Math.abs(document.querySelector('#note-panel').getBoundingClientRect().top-document.querySelector('.reader-bar').getBoundingClientRect().bottom)<1`);
  writeFileSync('tests/.shots/pdf-view/note-toolbar.png', Buffer.from((await send('Page.captureScreenshot', {format:'png'})).result.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride', {width:1000,height:800,deviceScaleFactor:1,mobile:false});
  await until('narrow window note overlay still stays below toolbar', `document.querySelector('#note-panel').getBoundingClientRect().width<=innerWidth
    && Math.abs(document.querySelector('#note-panel').getBoundingClientRect().top-document.querySelector('.reader-bar').getBoundingClientRect().bottom)<1
    && getComputedStyle(document.querySelector('#panes')).paddingRight==='0px'`);
  await evaluate(`closeNotePanel()`);
  await check('closing notes releases layout and observer', `!document.body.classList.contains('note-open')
    && !document.body.style.getPropertyValue('--note-top') && !notePanelLayoutObserver`);
  await send('Emulation.setDeviceMetricsOverride', {width:1500,height:1000,deviceScaleFactor:1,mobile:false});
  await until('PDF returns to full width after notes close', `pane().clientWidth>1400 && side(0).rendered`);
  await evaluate(`openAnnotationPanel(testPaper)`);
  await until('annotation sidebar has resize handle below toolbar', `!!document.querySelector('[data-annot-grip]')
    && Math.abs(document.querySelector('#annot-panel').getBoundingClientRect().top-document.querySelector('.reader-bar').getBoundingClientRect().bottom)<1`);
  await evaluate(`
    window.oldAnnotationAPI={update:LithubAPI.updateAnnotation,list:LithubAPI.annotations,live:LithubAPI.live};
    window.sidebarAnnotation={id:'sidebar-note',view:'en',kind:'note',page:1,rects:[],color:'yellow',text:'Selected original passage',comment:'',created:'2026-10-24T12:00:00'};
    annotListState.items=[sidebarAnnotation]; renderAnnotationList();
    PdfAnnot.add(pane(),sidebarAnnotation);
    LithubAPI.live=true;
    LithubAPI.annotations=()=>new Promise(resolve=>window.resolveOldAnnotationList=resolve);
    refreshAnnotationList(testPaper);
    LithubAPI.updateAnnotation=async(id,annId,fields)=>({...sidebarAnnotation,...fields});
    const textarea=document.createElement('textarea'); textarea.id='annot-comment';
    textarea.value='First comment line\\nSecond comment line <b>plain text</b>'; document.body.appendChild(textarea);
    saveAnnotationComment(pane(),'sidebar-note');
  `);
  await until('saved comment immediately appears in sidebar with line breaks', `document.querySelector('.annot-comment')?.textContent==='First comment line\\nSecond comment line <b>plain text</b>'
    && !document.querySelector('.annot-comment b') && getComputedStyle(document.querySelector('.annot-comment')).whiteSpace==='pre-wrap'`);
  await check('sidebar distinguishes selected passage and written comment', `document.querySelector('.annot-text').textContent==='Selected original passage'
    && [...document.querySelectorAll('.annot-content-label')].map(el=>el.textContent).join(',')==='原文摘录,批注内容'`);
  await evaluate(`resolveOldAnnotationList([{...sidebarAnnotation,comment:''}]);`);
  await check('older list response cannot erase saved comment', `annotListState.items[0].comment.startsWith('First comment line') && !!document.querySelector('.annot-comment')`);
  await evaluate(`(async()=>{document.querySelector('#annot-comment').value=''; await saveAnnotationComment(pane(),'sidebar-note');})()`);
  await check('cleared comment is also removed from sidebar', `!document.querySelector('.annot-comment') && annotListState.items[0].comment===''`);
  await evaluate(`(async()=>{document.querySelector('#annot-comment').value='这是写下的批注内容。\\n第二行备注，会在右侧完整显示。'; await saveAnnotationComment(pane(),'sidebar-note');
    document.querySelector('#annot-comment').remove();
    LithubAPI.updateAnnotation=oldAnnotationAPI.update; LithubAPI.annotations=oldAnnotationAPI.list; LithubAPI.live=oldAnnotationAPI.live;})()`);
  await evaluate(`
    window.annotationControlAPI={live:LithubAPI.live,update:LithubAPI.updateAnnotation,del:LithubAPI.deleteAnnotation,restore:LithubAPI.restoreAnnotation};
    LithubAPI.live=true;
    window.pendingAnnotationWrites=[];
    LithubAPI.updateAnnotation=(id,aid,fields)=>new Promise(resolve=>pendingAnnotationWrites.push({fields,resolve}));
    openAnnotationEditor(pane(),sidebarAnnotation);
    document.querySelector('#annot-comment').value='First draft';
    document.querySelector('#annot-comment').dispatchEvent(new Event('input'));
  `);
  await until('idle annotation typing automatically saves', `pendingAnnotationWrites.length===1`);
  await evaluate(`
    document.querySelector('#annot-comment').value='Newer draft'; document.querySelector('#annot-comment').dispatchEvent(new Event('input'));
    document.querySelector('[data-annot-color]').value='purple'; document.querySelector('[data-annot-color]').dispatchEvent(new Event('change'));
    void saveAnnotationComment(pane(),'sidebar-note',{close:false,silent:true});
  `);
  await check('annotation writes serialize per ID', `pendingAnnotationWrites.length===1`);
  await evaluate(`pendingAnnotationWrites[0].resolve({...sidebarAnnotation,...pendingAnnotationWrites[0].fields})`);
  await until('queued newer draft starts after older save', `pendingAnnotationWrites.length===2`);
  await check('older save cannot clear newer annotation draft', `readAnnotationDraft(testPaper.id,'sidebar-note')?.comment==='Newer draft'`);
  await evaluate(`pendingAnnotationWrites[1].resolve({...sidebarAnnotation,...pendingAnnotationWrites[1].fields})`);
  await until('latest draft and color reach PDF and sidebar', `!readAnnotationDraft(testPaper.id,'sidebar-note')
    && PdfAnnot.get(pane(),'sidebar-note').comment==='Newer draft' && PdfAnnot.get(pane(),'sidebar-note').color==='purple'`);
  await evaluate(`LithubAPI.updateAnnotation=async()=>{throw new Error('Simulated offline')};
    document.querySelector('#annot-comment').value='Recover after failed save';
    document.querySelector('#annot-comment').dispatchEvent(new Event('input'));
    closeAnnotationEditor();
  `);
  await until('failed close save retains local draft', `!annotationSaves.size && !!readAnnotationDraft(testPaper.id,'sidebar-note')`);
  await evaluate(`annotationDrafts.clear(); openAnnotationEditor(pane(),sidebarAnnotation);`);
  await check('annotation draft survives reopening from local storage', `document.querySelector('#annot-comment').value==='Recover after failed save'`);
  await evaluate(`LithubAPI.updateAnnotation=async(id,aid,fields)=>({...sidebarAnnotation,...fields});
    saveAnnotationComment(pane(),'sidebar-note');`);
  await until('retry saves and clears recovered draft', `!document.querySelector('#annot-pop') && !readAnnotationDraft(testPaper.id,'sidebar-note')`);
  await evaluate(`window.undoAnnotation=PdfAnnot.get(pane(),'sidebar-note');
    LithubAPI.deleteAnnotation=async()=>({ok:true}); LithubAPI.restoreAnnotation=async()=>undoAnnotation;
    deleteAnnotationById(pane(),testPaper,'sidebar-note');`);
  await until('annotation deletion offers undo and removes sidebar item', `!PdfAnnot.get(pane(),'sidebar-note') && !!document.querySelector('.annot-undo-toast button')`);
  await evaluate(`document.querySelector('.annot-undo-toast button').click()`);
  await until('undo restores same annotation to PDF and sidebar', `PdfAnnot.get(pane(),'sidebar-note')?.comment==='Recover after failed save'
    && annotListState.items.some(a=>a.id==='sidebar-note') && !document.querySelector('.annot-undo-toast')`);
  await evaluate(`Object.assign(LithubAPI,{live:annotationControlAPI.live,updateAnnotation:annotationControlAPI.update,deleteAnnotation:annotationControlAPI.del,restoreAnnotation:annotationControlAPI.restore});
    window.independentHighlights=[{id:'highlight-a',view:'en',kind:'highlight',color:'yellow',page:1,rects:[{x:.1,y:.1,w:.2,h:.02}]},
      {id:'highlight-b',view:'en',kind:'highlight',color:'yellow',page:1,rects:[{x:.1,y:.2,w:.2,h:.02}]}];
    PdfAnnot.setAll(pane(),[...independentHighlights,undoAnnotation]); PdfAnnot.select(pane(),'highlight-b');`);
  await check('same-color highlight selection and delete control are independent', `side(0).div.querySelectorAll('.annot-selection').length===1
    && side(0).div.querySelector('.annot-selection').dataset.annotId==='highlight-b'
    && side(0).div.querySelectorAll('.annot-del-float.is-selected').length===1
    && side(0).div.querySelector('.annot-del-float.is-selected').dataset.annotId==='highlight-b'`);
  await check('text-layer hit testing resolves the correct annotation', `(() => {
    const r=side(0).div.getBoundingClientRect(); return PdfAnnot.hitTest(pane(),side(0).div,r.x+r.width*.15,r.y+r.height*.21)?.id==='highlight-b';
  })()`);
  await evaluate(`annotListState.items=[...independentHighlights,undoAnnotation]; renderAnnotationList(); getSelection().removeAllRanges();`);
  const annotationPoint = await evaluate(`(()=>{const r=side(0).div.getBoundingClientRect();return {x:r.x+r.width*.15,y:r.y+r.height*.21};})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...annotationPoint,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...annotationPoint,button:'left',clickCount:1});
  await until('clicking painted highlight opens its own editor and selects sidebar row', `document.querySelector('#annot-pop')?.dataset.annotId==='highlight-b'
    && document.querySelector('.annot-item.is-active')?.dataset.id==='highlight-b'`);
  await check('highlight controls contain no comment input or type conversion', `!document.querySelector('#annot-pop textarea')
    && !document.querySelector('#annot-pop [data-annot-kind]') && document.querySelectorAll('#annot-pop [data-mark-color]').length===5`);
  await check('highlight controls are a compact single row without header or text buttons', `(() => {
    const pop=document.querySelector('#annot-pop'), r=pop.getBoundingClientRect();
    const page=side(0).div.getBoundingClientRect();
    return r.width<=200 && r.height<=42 && r.bottom<page.top+page.height*.2
      && !pop.querySelector('.annot-pop-head') && pop.querySelector('[data-annot-del]').textContent.trim()==='';
  })()`);
  await sleep(250);
  writeFileSync('tests/.shots/pdf-view/annotation-editor.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await evaluate(`closeAnnotationEditor()`);
  await evaluate(`
    window.separateKindsAPI={live:LithubAPI.live,update:LithubAPI.updateAnnotation}; LithubAPI.live=true;
    window.underlineFixture={id:'underline-only',view:'en',kind:'underline',color:'yellow',page:1,text:'Underline selection',rects:[{x:.1,y:.3,w:.2,h:.02}],comment:''};
    PdfAnnot.add(pane(),underlineFixture);
    LithubAPI.updateAnnotation=async(id,aid,fields)=>{window.lastKindPayload=fields;return {...underlineFixture,...fields};};
    openAnnotationEditor(pane(),underlineFixture);
    document.querySelector('#annot-pop [data-mark-color="green"]').click();
  `);
  await until('underline recoloring preserves kind and sends no comment', `PdfAnnot.get(pane(),'underline-only').color==='green'
    && PdfAnnot.get(pane(),'underline-only').kind==='underline' && Object.keys(lastKindPayload).join(',')==='color'`);
  await check('underline controls contain no writing or type conversion', `!document.querySelector('#annot-pop textarea') && !document.querySelector('#annot-pop select')`);
  await evaluate(`closeAnnotationEditor();openAnnotationEditor(pane(),undoAnnotation);`);
  await check('only notes offer description editing and drafts', `!!document.querySelector('#annot-pop #annot-comment')
    && !!document.querySelector('#annot-pop .annot-save-state') && !document.querySelector('#annot-pop [data-annot-kind]')`);
  await evaluate(`closeAnnotationEditor();LithubAPI.live=separateKindsAPI.live;LithubAPI.updateAnnotation=separateKindsAPI.update;`);
  await sleep(250); // Wait for the opening transform before hitting the physical grip.
  const gripPoint = await evaluate(`(() => { const r=document.querySelector('[data-annot-grip]').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+150}; })()`);
  await send('Input.dispatchMouseEvent', {type:'mouseMoved',...gripPoint});
  await send('Input.dispatchMouseEvent', {type:'mousePressed',...gripPoint,button:'left',clickCount:1});
  await until('annotation grip captures real pointer', `document.body.classList.contains('annot-resizing')`);
  await send('Input.dispatchMouseEvent', {type:'mouseMoved',x:gripPoint.x-180,y:gripPoint.y,button:'left',buttons:1});
  await until('dragging annotations resizes sidebar and PDF together', `document.querySelector('#annot-panel').getBoundingClientRect().width===540
    && getComputedStyle(document.querySelector('#panes')).paddingRight==='540px'
    && document.querySelector('.reader-bar').getBoundingClientRect().width===fullToolbarWidth`);
  await send('Input.dispatchMouseEvent', {type:'mouseReleased',x:gripPoint.x-180,y:gripPoint.y,button:'left',clickCount:1});
  await check('releasing annotation drag clears cursor state', `!document.body.classList.contains('annot-resizing')`);
  writeFileSync('tests/.shots/pdf-view/annotation-resize.png', Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await evaluate(`closeAnnotationPanel(); openAnnotationPanel(testPaper);`);
  await check('annotation width is restored on reopen', `document.querySelector('#annot-panel').getBoundingClientRect().width===540`);
  await evaluate(`document.querySelector('[data-annot-grip]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));`);
  await check('annotation separator supports keyboard resizing', `annotListState.width===564`);
  await evaluate(`document.querySelector('[data-annot-grip]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));`);
  await check('double click resets annotation width', `annotListState.width===360`);
  await evaluate(`setAnnotationPanelWidth(-10000)`);
  await check('annotation minimum width is bounded', `annotListState.width===280`);
  await evaluate(`setAnnotationPanelWidth(10000)`);
  await check('annotation maximum width preserves PDF space', `annotListState.width===900`);
  await send('Emulation.setDeviceMetricsOverride', {width:700,height:800,deviceScaleFactor:1,mobile:false});
  await until('annotation width clamps to a smaller window', `document.querySelector('#annot-panel').getBoundingClientRect().width<=676
    && getComputedStyle(document.querySelector('#panes')).paddingRight==='0px'`);
  await evaluate(`closeAnnotationPanel()`);
  await check('annotation close releases width and resize observers', `!document.body.classList.contains('annot-open')
    && !document.body.style.getPropertyValue('--annot-w') && !disposeAnnotationPanelLayout`);
  await send('Emulation.setDeviceMetricsOverride', {width:1500,height:1000,deviceScaleFactor:1,mobile:false});
  await until('closing annotations restores full PDF width', `pane().clientWidth>1400 && side(0).rendered`);
  await evaluate(`openAnnotationPanel(testPaper); setAnnotationPanelWidth(360);`);
  await sleep(250);
  for (const ending of ['cancel', 'close']) {
    const point = await evaluate(`(() => { const grip=document.querySelector('[data-annot-grip]');
      grip.addEventListener('pointerdown',e=>window.annotTestPointer=e.pointerId,{once:true});
      const r=grip.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+150}; })()`);
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await until(`annotation ${ending} test has active pointer`, `document.body.classList.contains('annot-resizing')`);
    await evaluate(ending==='cancel'
      ? `document.querySelector('[data-annot-grip]').dispatchEvent(new PointerEvent('pointercancel',{pointerId:annotTestPointer}))`
      : `closeAnnotationPanel()`);
    await check(`annotation ${ending} during drag cleans capture and cursor`, `!document.body.classList.contains('annot-resizing')`);
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  }
  await check('fit width has no horizontal overflow and all portrait slots match', `pane().scrollWidth<=pane().clientWidth+1 && side(0).cssW===side(5).cssW`);
  await check('real canvas contains paper content', `(() => {
    const c = side(0).canvas, pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < pixels.length; i += 68) if (pixels[i] < 180) return true;
    return false;
  })()`);
  await sleep(250);
  await until('text layer is ready after sidebar resizing', `!pane()._pdf.running && !!side(0).textDiv.querySelector('span')`);
  await evaluate(`(()=>{const span=side(0).textDiv.querySelector('span'), range=document.createRange();
    range.setStart(span.firstChild,0); range.setEnd(span.firstChild,1);
    const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
    span.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));})()`);
  await check('single character selection opens toolbar below reader controls', `!!document.querySelector('.sel-pop')
    && document.querySelector('.sel-pop').getBoundingClientRect().top>=document.querySelector('.reader-bar').getBoundingClientRect().bottom`);
  await evaluate(`document.querySelector('[data-selcolor="purple"]').click(); document.querySelector('.sel-pop').remove();
    side(0).textDiv.querySelector('span').dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));`);
  await check('selection color preference persists to next toolbar', `document.querySelector('.sel-pop .sel-dot.active')?.dataset.selcolor==='purple'
    && localStorage.getItem('lithub-annotation-color')==='purple'`);
  await evaluate(`document.querySelector('.sel-pop').remove();getSelection().removeAllRanges();`);
  await check('text selection and normalized annotations work', `(() => {
    const span = side(0).textDiv.querySelector('span'), range = document.createRange();
    range.selectNodeContents(span); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    const info = PdfAnnot.selectionToRects(); sel.removeAllRanges();
    if (!info || !info.text.includes('Synthetic paper')) return false;
    PdfAnnot.setAll(pane(), [{ id:'test', view:'en', kind:'highlight', page:1, color:'yellow', rects:info.rects }]);
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
  await check('library list and grid expose rename and updated attachment name', `rowHTML(testPaper).includes('data-action="rename-paper"')
    && gcardHTML(testPaper).includes('data-action="rename-paper"') && attachmentsHTML(testPaper).includes('Updated Paper Title.pdf')`);
  for (const layout of ['list', 'grid']) {
    await evaluate(`state.libView='${layout}'; renderLibrary(); document.querySelector('[data-action="rename-paper"][data-id="'+testPaper.id+'"]').click();`);
    await check(`${layout} inline editor prevents opening the paper`, `(() => {
      const input=document.querySelector('.paper-title-input'); input.click();
      input.value='Updated Paper Title';
      return state.route.view==='library' && !document.querySelector('.modal-mask') && document.activeElement===input;
    })()`);
    await evaluate(`LithubAPI.live=true; LithubAPI.updatePaper=async (id,fields)=>({title:fields.title});
      document.querySelector('.paper-title-input').value='Temporary Library Title'; document.querySelector('.paper-title-input').blur();`);
    await until(`${layout} saves on blur in place`, `!document.querySelector('.paper-title-input') && testPaper.title==='Temporary Library Title'
      && document.querySelector('[data-paper-title="'+testPaper.id+'"]').textContent==='Temporary Library Title'`);
    await evaluate(`document.querySelector('[data-action="rename-paper"][data-id="'+testPaper.id+'"]').click();
      document.querySelector('.paper-title-input').value='Updated Paper Title'; document.querySelector('.paper-title-input').blur();`);
    await until(`${layout} repeated rename succeeds`, `testPaper.title==='Updated Paper Title' && !document.querySelector('.paper-title-input')`);
    await evaluate(`LithubAPI.live=wasLive; LithubAPI.updatePaper=oldUpdate;`);
  }
  await evaluate(`importModal()`);
  await check('import title recognition enabled by default and can be disabled', `(() => {
    const input=document.querySelector('#import-auto-title');
    if (!input.checked) return false; input.click(); return !input.checked;
  })()`);
  await evaluate(`closeModal()`);
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
  await evaluate(`(async()=>{
    window.scopedAPIs={live:LithubAPI.live,list:LithubAPI.annotations,create:LithubAPI.createAnnotation,update:LithubAPI.updateAnnotation};
    window.scopedFixtures=['en','zh','dual2'].map(view=>({id:'scoped-'+view,view,kind:'highlight',page:1,color:'yellow',text:view,rects:[{x:.1,y:.1,w:.15,h:.02}]}));
    scopedFixtures.push({id:'legacy-unscoped',view:'legacy',kind:'note',page:1,comment:'Old annotation without version',rects:[{x:.2,y:.2,w:.1,h:.02}]});
    LithubAPI.live=true;
    // Return all records intentionally: rendering and list code must also isolate views.
    LithubAPI.annotations=async()=>scopedFixtures;
    await loadAnnotations(testPaper);openAnnotationPanel(testPaper);
  })()`);
  await check('comparison draws only comparison annotations and keeps legacy unpainted', `PdfAnnot.all(activePdfPane()).length===1
    && PdfAnnot.all(activePdfPane())[0].view==='dual2' && document.querySelectorAll('.annot-item').length===1
    && !!document.querySelector('.annot-legacy')`);
  await evaluate(`(async()=>{
    LithubAPI.createAnnotation=async(id,fields)=>{window.scopedCreatePayload=fields;const ann={id:'new-comparison',...fields};scopedFixtures.push(ann);return ann;};
    pendingSelection={view:'dual2',pageIndex:0,text:'New comparison mark',rects:[{x:.2,y:.3,w:.1,h:.02}]};
    await createAnnotation('highlight','blue');
  })()`);
  await check('new annotations persist the actual PDF view', `scopedCreatePayload.view==='dual2' && PdfAnnot.get(activePdfPane(),'new-comparison')?.view==='dual2'`);
  for (const view of ['en','zh','dual2']) {
    await evaluate(`document.querySelector('[data-action="mode"][data-id="${view}"]').click()`);
    await until(`${view} annotation layer and sidebar are isolated`, `currentAnnotationView()==='${view}' && annotListState.view==='${view}'
      && activePdfPane()?._pdf?.metas.length && PdfAnnot.all(activePdfPane()).length===${view==='dual2'?2:1}
      && PdfAnnot.all(activePdfPane()).every(a=>a.view==='${view}') && document.querySelectorAll('.annot-item').length===${view==='dual2'?2:1}`);
  }
  await evaluate(`LithubAPI.annotations=(id,view)=>view==='dual2'?new Promise(resolve=>window.resolveOldScoped=resolve):Promise.resolve(scopedFixtures);
    void loadAnnotations(testPaper);document.querySelector('[data-action="mode"][data-id="en"]').click();`);
  await until('original view loads while comparison request is pending', `currentAnnotationView()==='en' && annotListState.view==='en'
    && PdfAnnot.all(activePdfPane()).length===1`);
  await evaluate(`resolveOldScoped(scopedFixtures)`);
  await check('late comparison response cannot contaminate original view', `annotListState.view==='en'
    && PdfAnnot.all(activePdfPane()).every(a=>a.view==='en')`);
  await evaluate(`LithubAPI.updateAnnotation=async(id,aid,fields)=>{const item=scopedFixtures.find(a=>a.id===aid);Object.assign(item,fields);return {...item};};
    document.querySelector('[data-action="annot-assign-current"]').click();`);
  await until('legacy annotation only draws after explicit version assignment', `PdfAnnot.get(activePdfPane(),'legacy-unscoped')?.view==='en'
    && !document.querySelector('.annot-legacy')`);
  await evaluate(`Object.assign(LithubAPI,{live:scopedAPIs.live,annotations:scopedAPIs.list,createAnnotation:scopedAPIs.create,updateAnnotation:scopedAPIs.update});`);
  assert.deepEqual(errors, [], 'no uncaught errors or page render failures');
  console.log('PASS real PDF.js lifecycle, geometry, selection, budgets and route integration');
} finally {
  ws?.close(); chrome.kill(); server.close();
}
