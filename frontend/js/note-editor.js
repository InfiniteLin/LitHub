/* LitHub host adapter for Muya (MarkText). Markdown remains the storage format. */
'use strict';
const NoteEditor=(()=>{
  const MODES=['live','read'];
  let kit,loading,instance=null,container=null,mode='live',editable=true,callbacks={},value='',ready=false,serial=0,binding=null;
  let contentRevision=0;
  const resolvedText=new Map();let resolutionQueued=false;
  let liveHost,preview,scroll,lastSelection=null,insertion=Promise.resolve();
  async function load(){
    if(kit)return kit;
    if(!loading)loading=(async()=>{
      const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('vendor/muya/index.css',document.baseURI);document.head.append(link);
      const lib=await import(new URL('vendor/muya/index.js',document.baseURI));
      for(const name of ['InlineFormatToolbar','CodeBlockLanguageSelector','FootnoteTool','ParagraphFrontButton','ParagraphFrontMenu','ParagraphQuickInsertMenu','TableColumnToolbar','TableDragBar','TableRowColumMenu','ImageResizeBar','ImageToolBar','PreviewToolBar'])lib.Muya.use(lib[name]);
      lib.Muya.use(lib.LinkTools,{jumpClick:info=>{const url=info?.href;if(/^https?:\/\//i.test(url))window.open(url,'_blank','noopener,noreferrer');}});
      return kit=lib;
    })().catch(e=>{loading=null;throw e;});
    return loading;
  }
  const localImages=text=>String(text||'').replace(/(?:https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?|file:\/\/)(\/api\/notes\/image\/[a-f0-9]{32}\.(?:png|jpg|jpeg|webp|gif|svg))\b/gi,'$1');
  // Muya treats root-relative image sources as file:// paths. Resolve owned
  // attachments for the editor only; getValue keeps storage/export port-free.
  const editorImages=text=>localImages(text).replace(/(?<![\w:/])\/api\/notes\/image\/[a-f0-9]{32}\.(?:png|jpg|jpeg|webp|gif|svg)\b/gi,
    src=>new URL(src,typeof API_BASE==='string'?API_BASE:document.baseURI).href);
  function preserveImageSize(muya){
    // Muya 0.2.0 parses HTML dimensions as strings, but its asynchronous image
    // loader only applies numbers. Keep tokens/Markdown intact for native undo.
    const renderer=muya.editor.inlineRenderer.renderer,load=renderer.loadImageAsync;
    renderer.loadImageAsync=function(info,attrs,...args){
      const dimensions={};
      for(const key of ['width','height'])if(/^[1-9]\d*$/.test(String(attrs[key]||'')))dimensions[key]=Number(attrs[key]);
      return load.call(this,info,{...attrs,...dimensions},...args);
    };
  }
  function convertDisplayMath(){
    if(!instance||instance.editor.history._ignoreChange)return;
    const page=instance.editor.scrollPage,selection=instance.editor.selection.getSelection(),blocks=[];
    page.depthFirstTraverse(block=>{
      if(block.blockName!=='paragraph')return;
      const text=block.getState().text;
      const match=/^[ \t]*\$\$(?!\$)((?:\\.|(?!\$\$)[^\\\n])+?)\$\$[ \t]*$/.exec(text);
      if(!match||!match[1].trim())return;
      const active=selection?.anchorBlock?.parent===block;
      // Auto-paired closing delimiters may already exist while the user is
      // still typing inside the formula. Convert once the caret moves past them.
      if(active&&selection.anchor.offset<text.trimEnd().length)return;
      blocks.push({block,text:match[1].trim(),active});
    });
    for(const {block,text,active} of blocks){
      const math=page.constructor.loadBlock('math-block').create(instance,{name:'math-block',text,meta:{mathStyle:''}});
      block.replaceWith(math,'user');
      if(active){
        const next=page.constructor.loadBlock('paragraph').create(instance,{name:'paragraph',text:''});
        math.parent.insertAfter(next,math,'user');next.firstContentInDescendant().setCursor(0,0,true);
      }
    }
  }
  function notify(){if(ready)callbacks.onChange?.();}
  function getValue(){
    if(mode==='live'&&instance&&ready){
      // 0.2.0 batches OT commits until the next frame. Flush its native transaction
      // so Ctrl+S, tab switches and pagehide also include the latest keystroke.
      instance._lithubBoundary?.flush();value=localImages(instance.getMarkdown());
    }
    return value;
  }
  function renderPreview(){if(preview)preview.innerHTML=kit.renderToStaticHTML(editorImages(value),{sanitize:true});}
  function setValue(text){
    contentRevision++;
    const incoming=localImages(text);
    if(instance&&ready)instance._lithubBoundary?.flush();
    instance?.ui.hideAllFloatTools();
    value=incoming;lastSelection=null;resolvedText.clear();
    if(!ready)return;
    if(instance){instance.setContent(editorImages(value),false);liveHost=instance.domNode;setEditable(editable);}
    if(mode!=='live')renderPreview();
  }
  function setEditable(next){
    editable=!!next;
    // Muya owns the nested editing islands (math, images, code and tables).
    // Rewriting all contenteditable flags makes rendered widgets editable text.
    if(liveHost)liveHost.inert=!editable;
  }
  function replaceText(text,replacement){
    if(!ready||!instance||!text)return false;
    getValue();
    const current=instance.editor.selection.getSelection();
    const saved=current&&{anchorPath:[...current.anchorPath],focusPath:[...current.focusPath],anchor:{...current.anchor},focus:{...current.focus}};
    const ownsFocus=liveHost.contains(document.activeElement)||liveHost.contains(getSelection()?.anchorNode);
    const top=position();let changed=false;
    instance.editor.scrollPage.depthFirstTraverse(block=>{
      if(!block.isContent()||!block.text.includes(text))return;
      const index=block.text.indexOf(text),next=editorImages(replacement);
      if(saved)for(const end of ['anchor','focus'])if(current[`${end}Block`]===block){
        const offset=saved[end].offset;
        if(offset>index)saved[end].offset=offset>=index+text.length?offset+next.length-text.length:index+next.length;
      }
      block.text=block.text.replace(text,next);block.update();changed=true;
    });
    if(!changed)return false;
    instance._lithubBoundary.flush('api');
    // Use model offsets, not rendered image/Markdown character counts.
    if(saved){lastSelection={selection:saved};if(ownsFocus&&mode==='live')instance.editor.selection.setSelection({...saved,anchorBlock:current.anchorBlock,focusBlock:current.focusBlock});}
    value=localImages(instance.getMarkdown());if(mode==='read')renderPreview();
    if(scroll)scroll.scrollTop=top;
    return true;
  }
  function resolveText(text,replacement){
    resolvedText.set(text,replacement);
    return replaceText(text,replacement);
  }
  function restoreResolvedText(){
    if(resolutionQueued||!resolvedText.size)return;
    const ticket=serial,revision=contentRevision;resolutionQueued=true;
    // Native undo/redo must finish updating its stacks before rebasing. In
    // particular, redoing a paste after its upload finished cannot revive a
    // placeholder whose network job no longer exists.
    queueMicrotask(()=>{
      resolutionQueued=false;
      if(ticket!==serial||revision!==contentRevision||!ready)return;
      for(const [text,replacement] of resolvedText)if(value.includes(text))replaceText(text,replacement);
    });
  }
  function position(){return scroll?.scrollTop||0;}
  function bookmark(){
    const result={mode,scroll:position()};
    if(instance){
      const sel=instance.editor.selection.getSelection();if(sel)result.selection={anchorPath:[...sel.anchorPath],focusPath:[...sel.focusPath],anchor:{...sel.anchor},focus:{...sel.focus}};
      const selection=getSelection();
      if(selection?.rangeCount&&liveHost?.contains(selection.anchorNode)){
        const range=selection.getRangeAt(0),before=document.createRange();before.selectNodeContents(liveHost);before.setEnd(range.startContainer,range.startOffset);
        result.start=before.toString().length;result.length=range.toString().length;
      }
    }
    return result;
  }
  function restoreBookmark(mark){
    if(!mark)return;
    const revision=contentRevision,ticket=serial;
    requestAnimationFrame(()=>{
      if(!container||ticket!==serial||revision!==contentRevision)return;
      if(mode==='live'&&Number.isFinite(mark.start)){
        const point=offset=>{const walker=document.createTreeWalker(liveHost,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(offset<=node.length)return [node,offset];offset-=node.length;}return [liveHost,liveHost.childNodes.length];};
        const range=document.createRange();range.setStart(...point(mark.start));range.setEnd(...point(mark.start+(mark.length||0)));
        const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
      }else if(instance&&mark.selection)try{instance.editor.selection.setSelection(mark.selection);}catch{}
      if(mark.focus)focus();
      if(scroll)scroll.scrollTop=mark.scroll||0;
    });
  }
  function setMode(next){
    if(next==='source')next='live';
    if(!MODES.includes(next)||next===mode||!ready)return;
    const old=bookmark();value=getValue();mode=next;
    instance.ui.hideAllFloatTools();
    // Keep the Muya instance mounted while reading: history and selection remain native.
    if(next==='live'){
      preview.hidden=true;liveHost.hidden=false;
    }else{
      preview.hidden=false;liveHost.hidden=true;renderPreview();
    }
    container.dataset.mode=mode;setEditable(editable);restoreBookmark({scroll:old.scroll});callbacks.onReady?.();
  }
  async function mount(target,options={}){
    const ticket=++serial;
    try{await load();}catch{return false;}
    if(ticket!==serial||!target.isConnected)return false;
    destroy(false);container=target;callbacks=options;value=localImages(options.value);mode='live';editable=options.editable!==false;
    binding=new AbortController();const signal=binding.signal;
    target.classList.add('note-muya-mount');
    target.innerHTML='<div class="note-native-scroll"><div class="note-muya-host"></div><article class="note-md-preview" hidden></article></div>';
    scroll=target.querySelector('.note-native-scroll');liveHost=target.querySelector('.note-muya-host');preview=target.querySelector('article');
    instance=new kit.Muya(liveHost,{markdown:editorImages(value),lineHeight:1.5,math:true,footnote:true,frontMatter:true,codeBlockLineNumbers:true,disableHtml:false});
    instance.locale(kit.zh);preserveImageSize(instance);instance.init();instance._lithubBoundary=kit.persistenceBoundary(instance);liveHost=instance.domNode;ready=true;
    instance.on('json-change',()=>{if(container===target&&mode==='live'){convertDisplayMath();value=getValue();notify();restoreResolvedText();}});
    instance.on('selection-change',()=>{const b=bookmark();if(b.selection)lastSelection=b;});
    const pairedInputs=new WeakMap();
    target.addEventListener('input',e=>{
      if(e.data!=='$'||e.isComposing)return;
      const muya=instance,block=muya.editor.selection.getSelection()?.anchorBlock;
      if(block?.blockName!=='paragraph.content'||!/^\$\$[^\n]*[^$\s][^\n]*$/.test(block.text))return;
      // Native inline-math pairing adds an unwanted third closing dollar to
      // $$formula$$. Preserve pairing for other Markdown and inline formulas.
      pairedInputs.set(e,muya.options.autoPairMarkdownSyntax);muya.options.autoPairMarkdownSyntax=false;
    },{capture:true,signal});
    liveHost.addEventListener('input',e=>{
      if(pairedInputs.has(e)){instance.options.autoPairMarkdownSyntax=pairedInputs.get(e);pairedInputs.delete(e);}
    },{signal});
    target.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopPropagation();callbacks.onSave?.();}},{capture:true,signal});
    target.addEventListener('beforeinput',e=>{if(!editable)e.preventDefault();},{capture:true,signal});
    target.addEventListener('paste',e=>{const files=[...(e.clipboardData?.files||[])].filter(f=>f.type.startsWith('image/'));if(files.length){e.preventDefault();e.stopPropagation();window.handleNoteImageFiles?.(files);}},{capture:true,signal});
    setEditable(editable);if(options.mode&&options.mode!=='live')setMode(options.mode);callbacks.onReady?.();return true;
  }
  function insertValue(text){
    const ticket=serial,revision=contentRevision;
    insertion=insertion.catch(()=>{}).then(async()=>{
      if(ticket!==serial||revision!==contentRevision||!container||!editable)return;
      if(mode==='read')setMode('live');
      if(lastSelection?.selection)try{instance.editor.selection.setSelection(lastSelection.selection);}catch{}
      if(!lastSelection)focus();
      let selection=instance.editor.selection.getSelection();
      if(!selection?.anchorBlock?.domNode?.isConnected){focusEnd();await new Promise(requestAnimationFrame);selection=instance.editor.selection.getSelection();}
      if(selection?.isCollapsed){const block=selection.anchorBlock,prefix=/^#{1,6}\s+/.exec(block.text)?.[0].length||0;if(selection.anchor.offset<prefix)block.setCursor(prefix,prefix,true);}
      await new Promise(requestAnimationFrame);
      if(ticket!==serial||revision!==contentRevision)return;
      const data=new DataTransfer();data.setData('text/plain',editorImages(text));
      await instance.editor.clipboard.pasteHandler(new ClipboardEvent('paste',{clipboardData:data}));
      if(ticket===serial&&revision===contentRevision){value=getValue();notify();}
    });return insertion;
  }
  function focus(){
    if(mode==='live'&&instance){const block=instance.editor.scrollPage.firstContentInDescendant();if(block){const offset=/^#{1,6}\s+/.exec(block.text)?.[0].length||0;block.setCursor(offset,offset,true);}}
  }
  function focusEnd(){
    if(mode==='live'&&instance){
      const page=instance.editor.scrollPage;let block=page.lastContentInDescendant();
      block?.setCursor(block.text.length,block.text.length,true);
      // A cursor after the final image otherwise lands inside its non-editable
      // rendering island. Give subsequent typing/paste a native text paragraph.
      const node=getSelection()?.anchorNode;
      if((node?.nodeType===Node.ELEMENT_NODE?node:node?.parentElement)?.closest('.mu-inline-image')){
        const paragraph=page.constructor.loadBlock('paragraph').create(instance,{name:'paragraph',text:''});
        page.append(paragraph,'user');block=paragraph.firstContentInDescendant();block.setCursor(0,0,true);
      }
    }
  }
  function headings(){
    if(mode==='live'&&instance){instance._lithubBoundary?.flush();return instance.getTOC().map((h,index)=>{const node=document.createElement('span');node.innerHTML=h.contentHtml||h.content;return {level:h.lvl,text:node.textContent,index};});}
    const node=document.createElement('article');node.innerHTML=kit.renderToStaticHTML(getValue(),{sanitize:true});
    return [...node.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h,index)=>({level:Number(h.tagName[1]),text:h.textContent,index}));
  }
  function scrollToHeading(index){const root=mode==='live'?liveHost:preview;root?.querySelectorAll('h1,h2,h3,h4,h5,h6')[index]?.scrollIntoView({block:'center'});}
  function destroy(invalidate=true){
    if(invalidate)serial++;ready=false;binding?.abort();binding=null;
    instance?._lithubBoundary?.destroy();
    if(instance){
      instance.ui.hideAllFloatTools();
      // Muya 0.2.0 does not dispose its UI plugins. Their body-level popups and
      // ResizeObservers otherwise accumulate every time a note panel is opened.
      for(const plugin of Object.values(instance._uiPlugins)){
        plugin.destroy?.();plugin._resizeObserver?.disconnect();plugin.resizeObserver?.disconnect();
        plugin._floatBox?.remove();
        if(plugin._container?.classList.contains('mu-transformer'))plugin._container.remove();
      }
      instance.destroy();
    }
    instance=null;container=null;callbacks={};lastSelection=null;liveHost=preview=scroll=null;resolvedText.clear();
  }
  return {mount,destroy,getValue,setValue,setMode,insertValue,resolveText,focus,focusEnd,bookmark,restoreBookmark,headings,scrollToHeading,setEditable,refreshTheme:()=>{},isMounted:()=>!!container,MODES,getMode:()=>mode,_instance:()=>instance,_ready:()=>ready};
})();
