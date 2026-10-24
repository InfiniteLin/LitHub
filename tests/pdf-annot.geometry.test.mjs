import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Exercise the real geometry routine with browser Range-like rectangles.
const context = vm.createContext({window:{}});
const source = readFileSync('frontend/js/pdf-annot.js','utf8').replace('COLORS, selectionToRects,','COLORS, mergeRects, selectionToRects,');
vm.runInContext(source,context);
const merge = rects => context.window.PdfAnnot.mergeRects(rects);
const rect = (left,top,width,height=12) => ({left,top,width,height});
assert.equal(merge([rect(10,10,80),rect(95,10,30)]).length,1,'adjacent font spans merge');
assert.equal(merge([rect(10,10,80),rect(320,10,80)]).length,2,'separate columns never bridge');
assert.equal(merge([rect(10,10,80),rect(10,26,80)]).length,2,'separate lines remain separate');
assert.equal(merge([rect(10,10,80),rect(40,10,50)]).length,1,'overlapping Range fragments merge');
console.log('PASS real selection geometry: adjacent fragments, separated columns, lines and overlaps');
