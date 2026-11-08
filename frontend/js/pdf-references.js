/* Local PDF destinations first; text-only figure/table references use a lazy caption index. */
window.PdfReferences = (() => {
  const sessions = new WeakMap();
  const pattern = () => /\b(?:fig(?:ure)?s?\.?|tables?)\s*([A-Z]?\d+(?:\.\d+)*)(?:\s*\([a-z]\))?|[图表]\s*([A-Z]?\d+(?:\.\d+)*)/gi;
  const key = text => {
    const match = pattern().exec(text);
    return match ? `${/^(?:tab|表)/i.test(match[0]) ? 'table' : 'figure'}:${(match[1] || match[2]).toUpperCase()}` : null;
  };
  function attach(pane) {
    dispose(pane);
    const session = {pdf:pane._pdf, history:[], indexes:new Map(), busy:false};
    sessions.set(pane, session);
    session.bar = document.createElement('div');
    session.bar.className = 'pdf-reference-nav';
    session.bar.hidden = true;
    session.back = document.createElement('button');
    session.back.className = 'btn sm';
    session.back.textContent = '← 返回引用处';
    session.back.onclick = () => {
      const anchor = session.history.pop();
      if (anchor) window.PdfView.restoreAnchor(pane, anchor);
      session.bar.hidden = !session.history.length;
    };
    session.message = document.createElement('span');
    session.message.setAttribute('role', 'status');
    const close=document.createElement('button');
    close.type='button';close.className='icon-btn sm';close.textContent='×';
    close.setAttribute('aria-label','收起跳转提示');close.onclick=()=>session.bar.hidden=true;
    session.bar.append(session.back, session.message,close);
    pane.append(session.bar);
    session.position = () => {
      const r = pane.getBoundingClientRect();
      session.bar.style.top = `${r.top + 10}px`;
      session.bar.style.right = `${Math.max(12, innerWidth - r.right + 24)}px`;
    };
    window.addEventListener('resize', session.position);
    if (typeof ResizeObserver !== 'undefined') {
      session.resize = new ResizeObserver(session.position);
      session.resize.observe(pane);
    }
  }
  function valid(pane, session) {return sessions.get(pane) === session && pane._pdf === session.pdf && !session.pdf.dead;}
  function dispose(pane) {
    const session = sessions.get(pane);
    if (!session) return;
    sessions.delete(pane);
    session.resize?.disconnect();
    window.removeEventListener('resize', session.position);
    session.bar.remove();
  }
  function clear(side) {side.referenceLayer?.remove();side.referenceLayer = null;}
  async function destination(doc, dest) {
    if (typeof dest === 'string') dest = await doc.getDestination(dest);
    if (!Array.isArray(dest) || !dest[1]) return null;
    const page = Number.isInteger(dest[0]) ? dest[0] : await doc.getPageIndex(dest[0]);
    let x = null, y = null;
    if (dest[1].name === 'XYZ') {x=dest[2];y=dest[3];}
    if (dest[1].name === 'FitR') {x=dest[2];y=dest[5];}
    if (['FitH','FitBH'].includes(dest[1].name)) y=dest[2];
    return {page,x,y};
  }
  async function captionIndex(pane, session, doc) {
    if (session.indexes.has(doc)) return session.indexes.get(doc);
    const job = (async () => {
      const result = new Map();
      for (let n=1;n<=doc.numPages;n++) {
        if (!valid(pane,session)) return result;
        const page = await doc.getPage(n), text = await page.getTextContent();
        const lines = [];
        for (const item of text.items) {
          if (!item.str?.trim() || !item.transform) continue;
          const x=item.transform[4], y=item.transform[5];
          let line=lines.find(l=>Math.abs(l.y-y)<2);
          if (!line) {line={y,items:[]};lines.push(line);}
          line.items.push({x,text:item.str});
        }
        for (const line of lines) {
          line.items.sort((a,b)=>a.x-b.x);
          // Treat each column independently; avoid combining unrelated left/right captions.
          for (let i=0;i<line.items.length;i++) {
            const value=line.items.slice(i).map(item=>item.text).join(' ');
            const match=pattern().exec(value);
            if (!match || match.index!==0) continue;
            const tail=value.slice(match[0].length);
            // A caption normally begins a text run and has punctuation or descriptive text.
            const score=/^\s*[:.：]/.test(tail)?3:1;
            const id=key(match[0]), vp=page.getViewport({scale:1});
            const candidates=result.get(id)||[];
            candidates.push({page:n-1,x:line.items[i].x,y:line.y,score,
              column:vp.convertToViewportPoint(line.items[i].x,line.y)[0]/vp.width>.5?1:0});
            result.set(id,candidates);
          }
        }
        if (!session.pdf.metas[n-1]?.sides.some(side=>side.doc===doc && side.near)) page.cleanup?.();
        // Do not hold additional page resources: the viewer owns its own visible proxies.
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      return result;
    })();
    session.indexes.set(doc,job);
    job.catch(()=>{if(session.indexes.get(doc)===job)session.indexes.delete(doc);});
    return job;
  }
  async function jump(pane, side, target, label) {
    const session=sessions.get(pane);
    if (!session || session.busy || !valid(pane,session)) return;
    session.busy=true;
    const origin=window.PdfView.captureAnchor(pane);
    session.bar.hidden=false;session.back.hidden=!session.history.length;
    session.message.textContent='正在定位图表…';session.position();
    try {
      let dest=target.dest ? await destination(side.doc,target.dest) : null;
      if (!dest && label) {
        let candidates=(await captionIndex(pane,session,side.doc)).get(key(label))||[];
        if (session.pdf.referenceColumns===2) {
          const sameColumn=candidates.filter(c=>c.column===(target.xRatio>.5?1:0));
          if(sameColumn.length)candidates=sameColumn;
        }
        dest=candidates.sort((a,b)=>b.score-a.score)[0];
      }
      if (!valid(pane,session)) return;
      if (!dest || dest.page<0 || dest.page>=side.doc.numPages) throw Error('未找到对应图表，可能是扫描件或缺少图表标题。');
      const page=await side.doc.getPage(dest.page+1), vp=page.getViewport({scale:1});
      if (!valid(pane,session)) return;
      const point=vp.convertToViewportPoint(Number.isFinite(dest.x)?dest.x:page.view[0],Number.isFinite(dest.y)?dest.y:page.view[3]);
      const column=session.pdf.metas[dest.page].sides.findIndex(s=>s.doc===side.doc);
      if (origin) {session.history.push(origin);if(session.history.length>50)session.history.shift();}
      window.PdfView.restoreAnchor(pane,{page:dest.page,column:Math.max(0,column),x:point[0]/vp.width,y:point[1]/vp.height,viewportX:.08,viewportY:60});
      session.message.textContent='';session.back.hidden=false;
    } catch(error) {
      if (valid(pane,session)) session.message.textContent=error.message || '无法跳转到此图表。';
    } finally {session.busy=false;}
  }
  async function paint(pane, side, viewport) {
    clear(side);
    const session=sessions.get(pane), revision=side.revision;
    if (!session) return;
    const annotations=await side.page.getAnnotations({intent:'display'});
    if (!valid(pane,session) || side.revision!==revision || !side.rendered) return;
    const layer=document.createElement('div');layer.className='pdf-reference-layer';
    side.referenceLayer=layer;side.div.append(layer);
    const rects=[];
    const add=(rect,target,label)=>{
      const [x1,y1,x2,y2]=rect;
      const box={x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.abs(x2-x1),h:Math.abs(y2-y1)};
      if (!box.w || !box.h) return;
      const link=document.createElement('button');link.className='pdf-reference-link';link.type='button';
      link.title=label?`跳转到 ${label}`:'跳转到文内位置';link.setAttribute('aria-label',link.title);
      Object.assign(link.style,{left:`${box.x/viewport.width*100}%`,top:`${box.y/viewport.height*100}%`,width:`${box.w/viewport.width*100}%`,height:`${box.h/viewport.height*100}%`});
      link.onclick=event=>{event.preventDefault();event.stopPropagation();void jump(pane,side,target,label);};
      layer.append(link);rects.push(box);
    };
    for (const a of annotations) if (a.subtype==='Link' && a.dest && a.rect)
      add([...viewport.convertToViewportPoint(a.rect[0],a.rect[1]),
        ...viewport.convertToViewportPoint(a.rect[2],a.rect[3])],{dest:a.dest},'');
    const spans=[...side.textDiv.querySelectorAll('span')].filter(s=>s.firstChild?.nodeType===3);
    let content='',nodes=[];
    for(const span of spans){nodes.push({node:span.firstChild,start:content.length,end:content.length+span.firstChild.length});content+=span.firstChild.textContent+' ';}
    const base=side.div.getBoundingClientRect();
    for(const match of content.matchAll(pattern())) {
      const start=nodes.find(n=>n.end>match.index),end=nodes.find(n=>n.end>=match.index+match[0].length);
      if(!start||!end)continue;
      const range=document.createRange();range.setStart(start.node,match.index-start.start);range.setEnd(end.node,match.index+match[0].length-end.start);
      for(const r of range.getClientRects()) {
        const x=r.left-base.left,y=r.top-base.top;
        if(rects.some(b=>x+r.width/2>=b.x&&x+r.width/2<=b.x+b.w&&y+r.height/2>=b.y&&y+r.height/2<=b.y+b.h))continue;
        add([x,y,x+r.width,y+r.height],{xRatio:(x+r.width/2)/viewport.width},match[0]);
      }
    }
  }
  return {attach,dispose,clear,paint,key,destination};
})();
