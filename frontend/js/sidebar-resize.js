'use strict';
window.SidebarResize = (() => {
  const key='lithub-sidebar-width';
  let preferred=null,drag=null;
  try {const n=Number(localStorage.getItem(key));if(Number.isFinite(n)&&n>=120&&n<=1000)preferred=n;} catch {}
  const defaultWidth=()=>innerWidth<=1080?208:248;
  function limits() {
    const min=Math.min(208,Math.max(120,innerWidth-320));
    return {min,max:Math.max(min,Math.min(480,innerWidth-560))};
  }
  function apply() {
    const sidebar=document.getElementById('sidebar');if(!sidebar)return;
    const {min,max}=limits(),width=Math.round(Math.max(min,Math.min(max,preferred??defaultWidth())));
    sidebar.style.width=width+'px';
    const handle=sidebar.querySelector('.sidebar-resize');
    if(handle)for(const [name,value] of Object.entries({'aria-valuemin':min,'aria-valuemax':max,'aria-valuenow':width,'aria-valuetext':width+' 像素'}))handle.setAttribute(name,value);
  }
  function persist() {try {if(preferred===null)localStorage.removeItem(key);else localStorage.setItem(key,String(preferred));}catch {}}
  function stop() {
    if(!drag)return;
    const previous=drag;drag=null;
    previous.events.abort();document.body.classList.remove('sidebar-resizing');
    if(previous.handle.hasPointerCapture(previous.id))previous.handle.releasePointerCapture(previous.id);
    persist();
  }
  function attach(sidebar) {
    stop();if(!sidebar)return;
    let handle=sidebar.querySelector('.sidebar-resize');
    if(!handle) {
      handle=document.createElement('div');handle.className='sidebar-resize';handle.tabIndex=0;
      handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');
      handle.setAttribute('aria-label','调整左侧导航栏宽度');handle.setAttribute('aria-controls','sidebar');
      handle.title='左右拖动调整宽度，双击恢复默认';sidebar.appendChild(handle);
      handle.addEventListener('pointerdown',e=>{
        if(e.button!==0||!e.isPrimary)return;
        e.preventDefault();stop();handle.focus({preventScroll:true});
        drag={handle,id:e.pointerId,start:e.clientX,width:sidebar.getBoundingClientRect().width,events:new AbortController()};
        const current=drag;
        document.body.classList.add('sidebar-resizing');handle.setPointerCapture(e.pointerId);
        document.addEventListener('pointermove',event=>{
          if(event.pointerId!==current.id)return;
          const {min,max}=limits();preferred=Math.max(min,Math.min(max,current.width+event.clientX-current.start));apply();
        },{signal:current.events.signal});
        for(const type of ['pointerup','pointercancel'])document.addEventListener(type,event=>{if(event.pointerId===current.id)stop();},{signal:current.events.signal});
        handle.addEventListener('lostpointercapture',stop,{signal:current.events.signal});
      });
      handle.addEventListener('dblclick',()=>{stop();preferred=null;persist();apply();});
      handle.addEventListener('keydown',e=>{
        if(!['ArrowLeft','ArrowRight','Home','End','Enter'].includes(e.key))return;
        e.preventDefault();const {min,max}=limits();
        preferred=e.key==='Enter'?null:e.key==='Home'?min:e.key==='End'?max:
          Math.max(min,Math.min(max,sidebar.getBoundingClientRect().width+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?40:10)));
        persist();apply();
      });
    }
    apply();
  }
  window.addEventListener('resize',()=>{stop();apply();});
  window.addEventListener('blur',stop);window.addEventListener('hashchange',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  return {attach};
})();
