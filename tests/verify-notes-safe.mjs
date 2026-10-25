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
    if (pathname.startsWith('/api/notes/image/')) { res.setHeader('Content-Type','image/png');res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMvUAAAAASUVORK5CYII=','base64'));return; }
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
const profile = mkdtempSync(path.join(tmpdir(), 'lithub-notes-ui-'));
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
    console.log('NOTE STATE', await evaluate(`JSON.stringify({note:noteState.currentId,data:activeNoteDraft()?.data,a:noteDrafts.get(testPaper.id,'na')?.data,selection:{node:getSelection()?.anchorNode?.nodeName,text:getSelection()?.anchorNode?.textContent,offset:getSelection()?.anchorOffset},jobs:[...noteUploads.values()].map(j=>({token:j.token,status:j.status}))})`));
    throw Error('timeout: ' + name + '\n' + diagnostic + '\n' + errors.join('\n'));
  };
  const check = async (name, expression) => { const result=await evaluate(expression);if(!result)console.log('DIAGNOSTIC',await evaluate(`JSON.stringify({id:noteState.currentId,dirty:noteState.dirty,data:activeNoteDraft()?.data,value:NoteEditor.getValue(),status:document.querySelector('#note-save-state')?.textContent,errors:[]})`));assert.equal(result,true,name);console.log('PASS '+name); };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/#/library` });
  await until('application ready', `typeof state !== 'undefined' && !!document.querySelector('#view')`);

  await evaluate(`
    window.testPaper=state.db.papers[0];
    Object.assign(testPaper,{live:true,translated:true,fileUrl:'/fixture.pdf',zhUrl:'/fixture.pdf',compareUrl:'/wide.pdf'});
    window.secondPaper={...testPaper,id:'isolated-second',title:'Second paper'}; state.db.papers.push(secondPaper);
    window.testNotes=[{id:'na',title:'方法笔记',content:'# Method\\n\\nOriginal text',updated:'2026-10-25T10:00:00'},
      {id:'nb',title:'实验结果',content:'Results baseline',updated:'2026-10-25T09:00:00'}];
    window.noteDB=new Map([[testPaper.id,testNotes],[secondPaper.id,[{id:'nc',title:'Other paper',content:'Other content'}]]]);
    window.noteTrash=new Map(); window.writes=[];
    LithubAPI.live=true;
    LithubAPI.notes=async id=>structuredClone(noteDB.get(id)||[]);
    LithubAPI.updateNote=async(p,id,data)=>{
      writes.push({p,id,...data});
      if(window.holdSave){window.holdSave=false;await new Promise(r=>window.resolveSave=r);}
      if(window.failSave)throw Error('Offline');
      const note=noteDB.get(p).find(n=>n.id===id);Object.assign(note,data,{updated:'2026-10-25T12:00:00'});return {...note};
    };
    LithubAPI.createNote=async(p,data)=>{const n={id:'new-'+Date.now(),...data};noteDB.get(p).push(n);return {...n}};
    LithubAPI.deleteNote=async(p,id)=>{const list=noteDB.get(p);noteTrash.set(id,list.find(n=>n.id===id));noteDB.set(p,list.filter(n=>n.id!==id));return {ok:true}};
    LithubAPI.restoreNote=async(p,id)=>{const n=noteTrash.get(id);noteDB.get(p).push(n);return {...n}};
    LithubAPI.annotations=async()=>[];LithubAPI.summaryCache=async()=>({});
    location.hash='#/note/'+testPaper.id;
  `);
  await until('real Vditor note and outline mounted', `NoteEditor._ready() && noteState.currentId==='na' && document.querySelector('#note-title').value==='方法笔记' && document.querySelectorAll('#note-outline-list button').length===1`);
  await evaluate(`holdSave=true;NoteEditor.setValue('First snapshot');markNoteDirty();void saveCurrentNote(true);`);
  await until('first save is pending', `typeof resolveSave==='function'`);
  await evaluate(`NoteEditor.setValue('Latest while saving');markNoteDirty();resolveSave();`);
  await check('old response leaves new content dirty', `noteState.dirty && activeNoteDraft().data.content.trim()==='Latest while saving' && document.querySelector('#note-save-state').textContent!=='已保存'`);
  await until('latest content eventually saves in order', `!noteState.dirty && noteDB.get(testPaper.id)[0].content.trim()==='Latest while saving'`);
  await evaluate(`failSave=true;NoteEditor.setValue('Durable offline draft');markNoteDirty();void saveCurrentNote(true);`);
  await until('failure preserves local draft and shows retry', `document.querySelector('#note-save-state').textContent.includes('点击重试') && localStorage.getItem(activeNoteDraft().key).includes('Durable offline draft')`);
  await evaluate(`switchNote('nb')`);
  await check('switch does not inject previous note content', `NoteEditor.getValue().trim()==='Results baseline' && noteState.currentId==='nb'`);
  await evaluate(`switchNote('na')`);
  await check('return restores unsaved draft', `NoteEditor.getValue().trim()==='Durable offline draft' && noteState.dirty`);
  await evaluate(`failSave=false;void saveCurrentNote(false)`);
  await until('retry saves recovered draft', `!noteState.dirty && !localStorage.getItem(activeNoteDraft().key)`);
  await evaluate(`document.querySelector('.note-browser').open=true;const q=document.querySelector('#note-search');q.value='实验';q.dispatchEvent(new Event('input',{bubbles:true}));`);
  await check('note search filters title and body', `document.querySelectorAll('.note-list-row').length===1 && document.querySelector('.note-list-row strong').textContent==='实验结果'`);
  await evaluate(`document.querySelector('#note-search').value='';renderNoteList();document.querySelector('[data-action="note-pin"][data-id="nb"]').click()`);
  await until('pin persists and sorts note first', `noteDB.get(testPaper.id).find(n=>n.id==='nb').pinned && document.querySelector('.note-list-row [data-action="note-select"]').dataset.id==='nb'`);
  await evaluate(`document.querySelector('.note-browser').open=false;LithubAPI.uploadNoteImage=async()=>await new Promise(r=>window.resolveImage=r);
    void handleNoteImageFiles([new File(['image'],'owner.png',{type:'image/png'})]);`);
  await until('upload has a visible progress row', `typeof resolveImage==='function' && document.querySelector('#note-uploads').textContent.includes('上传中')`);
  await evaluate(`switchNote('nb');NoteEditor.setValue('B content untouched');markNoteDirty();resolveImage({url:'/api/notes/image/'+'a'.repeat(32)+'.png'});`);
  await until('late upload returns to originating note', `noteDrafts.get(testPaper.id,'na').data.content.includes('![owner]') && !noteDrafts.get(testPaper.id,'na').data.content.includes('【图片上传中')`);
  await check('upload cannot leak to another open note', `NoteEditor.getValue().trim()==='B content untouched' && !activeNoteDraft().data.content.includes('owner.png')`);
  await evaluate(`switchNote('na')`);
  await check('reopening original note retains completed background upload', `NoteEditor.getValue().includes('![owner]') && NoteEditor.getValue().includes('Durable offline draft')`);
  await evaluate(`LithubAPI.uploadNoteImage=async()=>{throw Error('Upload probe')};void handleNoteImageFiles([new File(['img'],'retry.png',{type:'image/png'})]);`);
  await until('failed image offers retry', `!!document.querySelector('[data-action="note-upload-retry"]')`);
  await evaluate(`LithubAPI.uploadNoteImage=async()=>({url:'/api/notes/image/'+'b'.repeat(32)+'.png'});document.querySelector('[data-action="note-upload-retry"]').click();`);
  await until('image retry replaces its placeholder', `!document.querySelector('#note-uploads').textContent.trim() && NoteEditor.getValue().includes('![retry]')`);
  await evaluate(`NoteEditor.setValue('# Method\\n\\nFormat this text\\n\\n## Results\\n\\nDone');markNoteDirty();`);
  await until('note outline updates', `document.querySelectorAll('#note-outline-list button').length===2 && document.querySelector('.vditor-ir p')?.textContent.includes('Format this')`);
  await evaluate(`const p=[...document.querySelectorAll('.vditor-ir p')].find(n=>n.textContent.includes('Format this'));const r=document.createRange();r.selectNodeContents(p);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);p.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));`);
  await check('selection format bar stays compact', `document.querySelector('.note-formatbar').getBoundingClientRect().width<120`);
  await evaluate(`document.querySelector('.note-formatbar button[aria-label="粗体"]').click()`);
  await until('format toolbar changes real Markdown', `NoteEditor.getValue().includes('**Format this text**')`);
  await evaluate(`NoteEditor.setValue('');NoteEditor.focus();`);
  await sleep(300);
  await send('Input.insertText',{text:'/'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'/',code:'Slash',windowsVirtualKeyCode:191});
  await until('slash opens insertion menu', `!!document.querySelector('.note-command-menu')`);
  await evaluate(`[...document.querySelectorAll('.note-command-menu button')].find(b=>b.textContent==='表格').click()`);
  await until('slash table command inserts Markdown table', `NoteEditor.getValue().includes('| 列一 | 列二 |') && !document.querySelector('.note-command-menu')`);
  for (const [label,expected] of [['标题','## 标题'],['项目列表','- 条目'],['任务列表','- [ ] 待办事项'],['代码块','```python'],['公式','E = mc^2']]) {
    await evaluate(`NoteEditor.setValue('');NoteEditor.focus()`);
    await send('Input.insertText',{text:'/'});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'/',code:'Slash',windowsVirtualKeyCode:191});
    await until(`slash ${label} ready`, `!!document.querySelector('.note-command-menu')`);
    await evaluate(`[...document.querySelectorAll('.note-command-menu button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
    await check(`slash ${label} inserts expected Markdown`, `NoteEditor.getValue().replace(/ +/g,' ').includes(${JSON.stringify(expected)}) && !NoteEditor.getValue().split('\\n').some(line=>line.trim()==='/')`);
  }
  await evaluate(`NoteEditor.setValue('# Mode check\\n\\nInline $a^2$ and **bold**');markNoteDirty();`);
  for (const mode of ['source','read','live']) {
    await evaluate(`document.querySelector('[data-action="note-mode"][data-id="${mode}"]').click()`);
    await until(`${mode} mode preserves Markdown`, `NoteEditor._ready() && NoteEditor.getMode()==='${mode}' && NoteEditor.getValue().includes('Mode check') && NoteEditor.getValue().includes('$a^2$')`);
    if (mode!=='source') await until(`${mode} mode renders local math`, `!!document.querySelector('${mode==='read'?'.note-read-host':'.vditor-ir'} .katex')`);
  }
  // Real pointer resize must modify only the selected duplicate image.
  await evaluate(`const c=document.createElement('canvas');c.width=160;c.height=80;window.imageURL=c.toDataURL();
    NoteEditor.setValue('![first]('+imageURL+')\\n\\n![second]('+imageURL+')');markNoteDirty();`);
  await until('duplicate images render', `document.querySelectorAll('.vditor-ir img').length===2`);
  const drag=await evaluate(`(()=>{const img=document.querySelectorAll('.vditor-ir img')[1];img.dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));const r=NoteEditor._grip().getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:drag.x,y:drag.y});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:drag.x,y:drag.y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:drag.x+65,y:drag.y+30,buttons:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:drag.x+65,y:drag.y+30,button:'left',clickCount:1});
  await check('resizing second duplicate leaves first Markdown untouched', `NoteEditor.getValue().includes('![first](') && !NoteEditor.getValue().includes('![second](') && (NoteEditor.getValue().match(/<img/g)||[]).length===1`);
  await evaluate(`document.querySelector('.vditor-ir img[style]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));`);
  await check('image preview offers original size', `!!document.querySelector('.note-image-preview .note-image-reset') && !document.querySelector('.vditor-img')`);
  await evaluate(`document.querySelector('.note-image-reset').click()`);
  await check('reset only removes dimensions from selected image', `NoteEditor.getValue().includes('![first](') && !NoteEditor.getValue().includes('width:')`);
  // Save a real caret and scroll position, then tear down and reopen the editor.
  await evaluate(`switchNote('nb');NoteEditor.setValue(Array.from({length:90},(_,i)=>'Paragraph '+i+' content.').join('\\n\\n'));markNoteDirty();`);
  await until('long note renders for position recovery', `document.querySelectorAll('.vditor-ir p').length===90`);
  await evaluate(`(()=>{const root=NoteEditor._instance().vditor.ir.element, p=[...root.querySelectorAll('p')].find(n=>n.textContent.includes('Paragraph 20 '));
    const range=document.createRange();range.setStart(p.firstChild,4);range.collapse(true);getSelection().removeAllRanges();getSelection().addRange(range);root.scrollTop=420;window.positionBefore=NoteEditor.bookmark();})()`);
  await evaluate(`(async()=>{await saveCurrentNote(true);location.hash='#/library'})()`);
  await until('notes unmount cleanly', `state.route.view==='library' && !NoteEditor.isMounted()`);
  await evaluate(`location.hash='#/note/'+testPaper.id`);
  await until('last selected note restored', `NoteEditor._ready() && noteState.currentId==='nb'`);
  await until('real scroll position and caret restored', `Math.abs(NoteEditor.bookmark().scroll-positionBefore.scroll)<2 && NoteEditor.bookmark().start===positionBefore.start`);
  // Distinguish failed loading from a genuinely empty library.
  await evaluate(`window.originalNotes=LithubAPI.notes;LithubAPI.notes=async()=>{throw Error('Load probe')};location.hash='#/note/'+secondPaper.id`);
  await until('failed load shows retry instead of creating an empty note', `document.querySelector('[data-action="note-reload"]') && noteDB.get(secondPaper.id).length===1`);
  await evaluate(`LithubAPI.notes=originalNotes;document.querySelector('[data-action="note-reload"]').click()`);
  await until('retry loads existing note', `NoteEditor._ready() && noteState.currentId==='nc' && NoteEditor.getValue().trim()==='Other content'`);
  // A slow response from another paper never fills the current editor.
  await evaluate(`LithubAPI.notes=id=>id===testPaper.id?new Promise(r=>window.resolveOldNotes=r):originalNotes(id);location.hash='#/note/'+testPaper.id`);
  await until('old note load is waiting', `typeof resolveOldNotes==='function'`);
  await evaluate(`location.hash='#/note/'+secondPaper.id`);
  await until('new paper loads while old request waits', `noteState.currentId==='nc' && NoteEditor._ready()`);
  await evaluate(`resolveOldNotes(structuredClone(testNotes))`);
  await check('late note list cannot replace another paper', `noteState.paperId===secondPaper.id && noteState.currentId==='nc' && NoteEditor.getValue().trim()==='Other content'`);
  await evaluate(`LithubAPI.notes=originalNotes;void deleteCurrentNote()`);
  await until('delete offers undo without a confirmation popup', `noteState.notes.length===0 && !!document.querySelector('.annot-undo-toast button')`);
  await evaluate(`document.querySelector('.annot-undo-toast button').click()`);
  await until('undo restores exact note and content', `noteState.currentId==='nc' && NoteEditor.getValue().trim()==='Other content'`);
  // Citations carry a comparison PDF position and reopen that exact version.
  await evaluate(`const ref=noteReferenceLink(testPaper.id,{view:'dual2',page:3,rects:[{x:.25,y:.2,w:.2,h:.03}]});
    NoteEditor.setValue('> A quoted sentence\\n\\n'+ref);markNoteDirty();noteState.mode='read';layoutNoteMode();`);
  await until('source reference renders as a real link', `!!document.querySelector('#note-body a[href*="lithub-ref"]')`);
  mkdirSync('tests/.shots/notes',{recursive:true});
  writeFileSync('tests/.shots/notes/reading.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await evaluate(`document.querySelector('#note-body a[href*="lithub-ref"]').click()`);
  await until('note reference opens comparison PDF and flashes exact position', `state.route.view==='reader' && state.route.id===testPaper.id && currentAnnotationView()==='dual2' && !!document.querySelector('.note-reference-flash')`);
  await check('citation does not create a permanent annotation', `PdfAnnot.all(activePdfPane()).length===0 && document.querySelector('.note-reference-flash').style.left==='25%'`);
  // Selecting PDF text exposes a separate excerpt action, distinct from annotation.
  await until('comparison selectable text ready', `document.querySelector('#pane-dual2 .textLayer span')`);
  await evaluate(`(()=>{const span=document.querySelector('#pane-dual2 .textLayer span');const r=document.createRange();r.selectNodeContents(span);getSelection().removeAllRanges();getSelection().addRange(r);span.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));})()`);
  await until('PDF selection has an excerpt action', `!!document.querySelector('[data-selact="excerpt"]')`);
  await evaluate(`document.querySelector('[data-selact="excerpt"]').click()`);
  await until('excerpt inserts quoted text and source in this paper note', `NoteEditor._ready() && noteState.paperId===testPaper.id && NoteEditor.getValue().includes('lithub-ref') && NoteEditor.getValue().includes('Synthetic paper')`);
  await evaluate(`window.noteExports=[];LithubAPI.exportNote=async(p,n)=>{noteExports.push({p,n});return new Blob(['fixture ZIP'],{type:'application/zip'})};
    window.anchorClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.href.startsWith('blob:')){window.downloadedNote={name:this.download,url:this.href};return;}return anchorClick.call(this)};
    void exportCurrentNote();`);
  await until('export saves the current note and starts a named ZIP download', `noteExports.length===1 && noteExports[0].p===testPaper.id && noteExports[0].n===noteState.currentId && downloadedNote.name.endsWith('.zip')`);
  await evaluate(`HTMLAnchorElement.prototype.click=anchorClick;document.querySelector('.note-browser').open=true`);
  writeFileSync('tests/.shots/notes/editor.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await check('note list stays inside viewport', `(()=>{const r=document.querySelector('.note-browser-pop').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth})()`);
  await evaluate(`document.documentElement.dataset.theme='dark';NoteEditor.refreshTheme()`);
  await check('dark note menu has an opaque themed surface', `getComputedStyle(document.querySelector('.note-browser-pop')).backgroundColor==='rgb(32, 29, 22)'`);
  await sleep(200);
  writeFileSync('tests/.shots/notes/dark.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:720,height:800,deviceScaleFactor:1,mobile:false});
  await until('narrow note panel keeps reader toolbar accessible', `document.querySelector('#note-panel').getBoundingClientRect().width<=innerWidth && document.querySelector('#note-panel').getBoundingClientRect().top>=document.querySelector('.reader-bar').getBoundingClientRect().bottom`);
  await check('note controls remain visible and clickable after image preview', `(()=>{const b=document.querySelector('[data-action="note-save"]'),r=b.getBoundingClientRect();return !document.querySelector('.vditor-img') && b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()`);
  await check('narrow list fits available viewport', `(()=>{const r=document.querySelector('.note-browser-pop').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth})()`);
  writeFileSync('tests/.shots/notes/narrow.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).result.data,'base64'));
  await evaluate(`document.documentElement.dataset.theme='light';NoteEditor.refreshTheme();window.savedPanelDraft=NoteEditor.getValue();mountAiPanel(testPaper);`);
  await check('switching to AI panel tears editor down after retaining draft', `!NoteEditor.isMounted() && noteDrafts.get(testPaper.id,noteState.currentId).data.content===savedPanelDraft`);
  assert.deepEqual(errors,[],'no uncaught application errors');
  console.log('PASS isolated real-editor note reliability, management, image, formatting and PDF citation flows');
} finally { ws?.close(); chrome.kill(); server.close(); }
