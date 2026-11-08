/* Real settings UI + isolated backend. Credentials are fictional; no external API calls. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { findBrowser } from './_browser.mjs';
const require=createRequire(import.meta.url);
const {selectSidecarPort,waitForOwnedSidecar}=require('../electron/sidecar-connection');
const root=mkdtempSync(path.join(os.tmpdir(),'lithub-muya-ui-'));
const data=path.join(root,'data');mkdirSync(data);
writeFileSync(path.join(data,'library.json'),JSON.stringify({papers:{p1:{id:'p1',title:'Notes fixture',added:'2026-11-08',authors:'Test author',cat:'local',pages:1}},tasks:{},settings:{}}));
const port=await selectSidecarPort(),base=`http://127.0.0.1:${port}`,instance='profiles-ui-test';
const backend=spawn('python',['-B','-m','uvicorn','main:app','--host','127.0.0.1','--port',String(port)],{
  cwd:path.resolve('backend'),windowsHide:true,stdio:['ignore','pipe','pipe'],
  env:{...process.env,LITHUB_DATA_DIR:data,LITHUB_PROGRAM_DIR:root,LITHUB_PDF_DEFAULT_DIR:path.join(root,'pdfs'),LITHUB_INSTANCE_ID:instance}
});
let logs='';backend.stdout.on('data',b=>logs+=b);backend.stderr.on('data',b=>logs+=b);
let chrome,ws;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try {
  await waitForOwnedSidecar({baseURL:base,instanceId:instance,fetch,isAlive:()=>backend.exitCode===null});
  const debug=await selectSidecarPort();
  chrome=spawn(findBrowser(),['--headless=new','--disable-gpu','--no-first-run',`--user-data-dir=${path.join(root,'chrome')}`,`--remote-debugging-port=${debug}`,'about:blank'],{stdio:'ignore',windowsHide:true});
  let target;
  for(let i=0;i<100&&!target;i++) {try{target=(await(await fetch(`http://127.0.0.1:${debug}/json/list`)).json()).find(t=>t.type==='page');}catch{}if(!target)await sleep(100);}
  assert.ok(target);ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let sequence=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
  const send=(method,params={})=>new Promise(resolve=>{const id=++sequence;pending.set(id,resolve);ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description);return r.result.result.value;};
  const until=async(name,expression)=>{for(let i=0;i<140;i++){if(await evaluate(`typeof state !== 'undefined' && !!window.LithubAPI?.live && (${expression})`)){console.log('PASS '+name);return;}await sleep(60);}throw Error('Timeout: '+name);};
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:base+'/#/library'});
  await until('application ready',`!!document.getElementById('view')`);
  await evaluate(`document.getElementById('view').innerHTML='<div id="editor-fixture" style="height:700px;display:flex"></div>';window.ed=document.getElementById('editor-fixture');window.changes=0;`);
  assert.equal(await evaluate(`NoteEditor.mount(ed,{value:'# Imported title\\n\\nHello **world**.\\n\\n- [ ] Task\\n\\n| A | B |\\n| --- | --- |\\n| 1 | 2 |',onChange:()=>changes++})`),true);
  await until('Muya mounts with real Markdown blocks',`NoteEditor._ready() && !!ed.querySelector('h1') && !!ed.querySelector('table')`);
  assert.ok((await evaluate(`NoteEditor.getValue()`)).includes('**world**'));
  await evaluate(`NoteEditor.setValue('Typing here');NoteEditor.focus()`);
  await send('Input.insertText',{text:'A'});
  assert.ok((await evaluate(`NoteEditor.getValue()`)).includes('A'),'latest native input included immediately');
  await until('native typing emits change',`changes>0`);
  await evaluate(`NoteEditor.setValue('# Reading mode\\n\\nNew content');NoteEditor.setMode('read');`);
  assert.ok((await evaluate(`NoteEditor.getValue()`)).includes('New content'));
  await evaluate(`NoteEditor.setMode('live')`);
  await until('reading mode returns to native editor',`ed.querySelector('h1')?.textContent.includes('Reading mode')`);
  assert.equal(await evaluate(`!!ed.querySelector('textarea')`),false);
  await evaluate(`NoteEditor.setEditable(false)`);
  assert.equal(await evaluate(`!ed.querySelector('.note-muya-host').inert`),false);
  await evaluate(`NoteEditor.setEditable(true);NoteEditor.focus();`);
  await evaluate(`NoteEditor.insertValue(' inserted **native** text')`);
  await until('native Markdown insertion completes',`NoteEditor.getValue().includes('inserted')`);
  await evaluate(`NoteEditor._instance().undo()`);
  await until('native undo retains host persistence history',`!NoteEditor.getValue().includes('inserted')`);
  await evaluate(`NoteEditor._instance().redo()`);
  await until('native redo restores formatted insertion',`NoteEditor.getValue().includes('inserted **native**')`);
  await evaluate(`NoteEditor.setValue('Fresh destination');NoteEditor.focusEnd();window.pendingInsertion=NoteEditor.insertValue('late insertion');NoteEditor.setValue('Another note');`);
  await evaluate(`pendingInsertion`);
  assert.equal((await evaluate(`NoteEditor.getValue()`)).trim(),'Another note');
  await evaluate(`NoteEditor.setValue('![Owned image](http://127.0.0.1:9999/api/notes/image/'+'a'.repeat(32)+'.png)')`);
  assert.ok((await evaluate(`NoteEditor.getValue()`)).includes('](/api/notes/image/'));
  await evaluate(`NoteEditor.destroy()`);
  assert.equal(await evaluate(`NoteEditor.isMounted()`),false);
  await evaluate(`location.hash='#/note/p1'`);
  await until('real note page and import action ready',`noteState.ready && NoteEditor._ready() && !!document.querySelector('[data-action="note-import"]')`);
  await evaluate(`window.originalNote=noteState.currentId;NoteEditor.setValue('Existing note stays intact');markNoteDirty();`);
  await evaluate(`importNoteFiles([new File(['# Imported MD\\n\\nLoaded from an external file.'],'external.md',{type:'text/markdown'})])`);
  await until('MD import creates a separate editable note',`noteState.currentId!==originalNote && NoteEditor.getValue().includes('Loaded from an external file.') && document.getElementById('note-title').value==='external'`);
  assert.ok((await evaluate(`LithubAPI.notes('p1')`)).some(n=>n.content.includes('Existing note stays intact')));
  await evaluate(`NoteEditor.focusEnd()`);
  await send('Input.insertText',{text:' Persisted edit.'});
  await evaluate(`saveCurrentNote(true)`);
  assert.ok((await evaluate(`LithubAPI.notes('p1')`)).some(n=>n.content.includes('Persisted edit.')));
  await evaluate(`location.hash='#/library'`);
  await until('leaving notes releases editor',`!NoteEditor.isMounted()`);
  await evaluate(`location.hash='#/note/p1'`);
  await until('saved imported note survives reopening',`noteState.ready && NoteEditor.getValue().includes('Persisted edit.')`);
  await evaluate(`NoteEditor.setValue('# Notes editor\\n\\n## Research findings\\n\\nText with **bold**, *italic* and $a^2+b^2=c^2$.\\n\\n- [x] Review completed\\n- [ ] Add experiments\\n\\n| Model | Result |\\n| --- | --- |\\n| Baseline | 82% |\\n\\n:::');markNoteDirty();`);
  await until('native math and headings render',`document.querySelector('.note-muya-host .katex') && document.querySelector('.note-muya-host table') && document.querySelectorAll('#note-outline-list button').length===2`);
  const shot=await send('Page.captureScreenshot',{format:'png'});
  mkdirSync(path.resolve('tests/.shots'),{recursive:true});writeFileSync(path.resolve('tests/.shots/muya-note.png'),Buffer.from(shot.result.data,'base64'));
  console.log('PASS Muya native input/modes/lock/insertion, MD import, original preservation, backend save and reopening');
  assert.deepEqual(errors,[]);

} catch(error) {throw Error(error.message+'\\n'+logs.slice(-1800));}
finally {
  if (ws?.readyState === WebSocket.OPEN) {ws.send(JSON.stringify({id:999999,method:'Browser.close'}));await sleep(800);}
  ws?.close();
  for(const child of [chrome,backend])if(child && child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
  await sleep(800);
  const {rm}=await import('node:fs/promises');
  await rm(root,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}

