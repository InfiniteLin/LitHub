export * from '@muyajs/core';
import {type} from 'ot-json1';
import '@muyajs/core/lib/core.css';
// Host persistence boundary for the pinned Muya 0.2.0 OT scheduler.
// Emit the same native transaction event so undo history and plugins stay native.
export function persistenceBoundary(muya) {
 const json=muya.editor.jsonState;let frame=null,closed=false;
 function flush(){
  if(frame!==null)cancelAnimationFrame(frame);frame=null;
  if(closed||!json._operationCache.length)return;
  const operation=json._operationCache.reduce(type.compose),previous=json.getState();
  json._operationCache=[];json._isGoing=false;json.apply(operation);
  muya.eventCenter.emit('json-change',{op:operation,source:'user',prevDoc:previous,doc:json.getState()});
 }
 json._emitStateChange=()=>{if(frame===null&&!closed)frame=requestAnimationFrame(flush);};
 return {flush,destroy(){if(frame!==null)cancelAnimationFrame(frame);closed=true;frame=null;}};
}
