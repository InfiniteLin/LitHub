import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Exercise the real geometry routine with browser Range-like rectangles.
const context = vm.createContext({window:{}});
const source = readFileSync('frontend/js/pdf-annot.js','utf8').replace('COLORS, selectionToRects,','COLORS, mergeRects, visibleHighlights, selectionToRects,');
vm.runInContext(source,context);
const merge = rects => context.window.PdfAnnot.mergeRects(rects);
const rect = (left,top,width,height=12) => ({left,top,width,height});
assert.equal(merge([rect(10,10,80),rect(95,10,30)]).length,1,'adjacent font spans merge');
assert.equal(merge([rect(10,10,80),rect(320,10,80)]).length,2,'separate columns never bridge');
assert.equal(merge([rect(10,10,80),rect(10,26,80)]).length,2,'separate lines remain separate');
assert.equal(merge([rect(10,10,80),rect(40,10,50)]).length,1,'overlapping Range fragments merge');
console.log('PASS real selection geometry: adjacent fragments, separated columns, lines and overlaps');

// Exercise production painting and hit testing without a real library.
const piece = (id,color,x,y,w,h,extra={}) => ({id,color,kind:'highlight',view:'en',page:1,created:'2026-11-06T10:00:00',rects:[{x,y,w,h}],...extra});
const yellow = piece('old','yellow',.1,.1,.5,.1,{created:'2026-11-06T10:00:00',paint_order:0});
const blue = piece('new','blue',.3,.1,.5,.1,{created:'2026-11-06T10:00:00',paint_order:1});
const api = context.window.PdfAnnot;
const visible = list => api.visibleHighlights(list);
const at = (pieces,x,y) => pieces.filter(p => x>p.rect.x && x<p.rect.x+p.rect.w && y>p.rect.y && y<p.rect.y+p.rect.h);
let pieces = visible([blue,yellow]); // reverse API reading order, same legacy second
assert.equal(at(pieces,.4,.15).length,1);
assert.equal(at(pieces,.4,.15)[0].ann.id,'new');
assert.equal(at(pieces,.2,.15)[0].ann.id,'old');
assert.equal(at(pieces,.7,.15)[0].ann.id,'new');
assert.equal(visible([yellow,{...blue,rects:yellow.rects}]).length,1,'full replacement paints one color');
assert.equal(visible([yellow,{...yellow,id:'repeat'}]).length,1,'same-color duplicate never darkens');
const inset = piece('inset','pink',.2,.12,.1,.04);
pieces = visible([yellow,inset]);
for(let x=.105;x<.6;x+=.01) for(let y=.105;y<.2;y+=.01) {
  assert.equal(at(pieces,x,y).length,1,'2D clipping preserves area with no stacked fills');
}
assert.equal(at(pieces,.25,.14)[0].ann.id,'inset');
assert.equal(at(visible([yellow,blue,{...yellow,modified:'2026-11-06T10:01:00'}]),.4,.15)[0].ann.id,'old','recolor has latest precedence');
assert.equal(at(visible([yellow]),.4,.15)[0].ann.id,'old','deletion restores underlying highlight');
assert.equal(visible([yellow,{...blue,kind:'underline'}]).length,1,'underline does not clip highlights');

const children=[];
const layer={set innerHTML(v){children.length=0;},appendChild(e){children.push(e);}};
context.document={createElement(){return {dataset:{},style:{},classList:{add(){}}};}};
const page={querySelector(){return layer;},getBoundingClientRect(){return {left:0,top:0,width:1000,height:1000};}};
const pane={id:'pane-en',_pdf:{metas:[{sides:[{div:page}]}]}};
api.setAll(pane,[blue,yellow,piece('foreign','green',0,0,1,1,{view:'dual2'})]);
assert.equal(children.filter(c=>c.className==='annot-rect annot-highlight').length,2);
assert.equal(api.hitTest(pane,page,400,150).id,'new','hit testing matches visible color');
api.select(pane,'old');
assert.equal(children.filter(c=>c.className.includes('annot-selection')).length,1);
assert.ok(Number.parseFloat(children.find(c=>c.className.includes('annot-selection')).style.width)<21,'selection uses visible part');
api.update(pane,{...yellow,modified:'2026-11-06T10:01:00',color:'pink'});
assert.equal(api.hitTest(pane,page,400,150).id,'old');
api.setAll(pane,[yellow,{...blue,rects:yellow.rects}]);
assert.equal(children.filter(c=>c.className==='annot-del-float').length,1,'hidden highlights have no overlapping delete control');
api.remove(pane,'new');
assert.equal(api.hitTest(pane,page,400,150).id,'old');
console.log('PASS latest-color overlap, exact clipping, same-second reload order, recolor, selection, hit testing, deletion and view isolation');
