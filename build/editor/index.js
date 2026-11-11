export * from '@muyajs/core';
import {type} from 'ot-json1';
import '@muyajs/core/lib/core.css';
// JSON1 can represent a removal split between a block and its text property.
// Muya's DOM updater expects newly inserted blocks to be complete when redoing.
function wholeRemovals(operation,doc){
 const read=type.readCursor(operation),items=[],write=type.writeCursor(),removed=[];
 read.traverse(null,c=>items.push({path:read.getPath(),c}));
 const below=(p,parent)=>p.length>parent.length&&parent.every((key,i)=>p[i]===key);
 for(const {path,c} of items){
  if(removed.some(parent=>below(path,parent)))continue;
  if(Object.keys(c).length===1&&Object.hasOwn(c,'r')&&items.filter(item=>below(item.path,path)).every(item=>Object.keys(item.c).every(key=>key==='r'))){
   write.writeAtPath(path,'r',path.reduce((value,key)=>value[key],doc));removed.push(path);
  }else for(const [key,value] of Object.entries(c))write.writeAtPath(path,key,value);
 }
 return write.get();
}
// Host persistence boundary for the pinned Muya 0.2.0 OT scheduler.
// Emit the same native transaction event so undo history and plugins stay native.
export function persistenceBoundary(muya) {
 const json=muya.editor.jsonState;let frame=null,closed=false;
 function flush(source='user'){
  if(frame!==null)cancelAnimationFrame(frame);frame=null;
  if(closed||!json._operationCache.length)return;
  const operation=json._operationCache.reduce(type.compose),previous=json.getState();
  json._operationCache=[];json._isGoing=false;json.apply(operation);
  muya.eventCenter.emit('json-change',{op:operation,source,prevDoc:previous,doc:json.getState()});
 }
 json._emitStateChange=()=>{if(frame===null&&!closed)frame=requestAnimationFrame(()=>flush());};
 // Attachment resolutions transform previous undo steps; they are not user
 // edits and must never restore a now-finished "uploading" placeholder.
 muya.editor.history.options.userOnly=true;
 muya.editor.history.transform=operation=>{
  // Muya's default transform rejects removing a paragraph edited by an API
  // resolution and drops invertible data. A user undo should remove that image
  // paragraph as intended. Rebase each native step against the resulting doc.
  for(const name of ['undo','redo']){
   const stack=muya.editor.history._stack[name];let remote=operation,doc=json.getState();
   for(let i=stack.length-1;i>=0;i--){
    const original=stack[i].operation;
    const rebased=type.transformNoConflict(original,remote,'left');
    remote=type.transformNoConflict(remote,original,'right');
    if(type.isNoop(rebased)){stack.splice(i,1);continue;}
    stack[i].operation=wholeRemovals(type.makeInvertible(rebased,doc),doc);
    doc=type.apply(doc,stack[i].operation);
   }
  }
 };
 return {flush,destroy(){if(frame!==null)cancelAnimationFrame(frame);closed=true;frame=null;}};
}
