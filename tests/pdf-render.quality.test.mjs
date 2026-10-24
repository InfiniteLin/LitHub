/* 运行真实 PdfView，检查最终 canvas 和文本 viewport，避免复刻实现公式。 */
import assert from 'node:assert/strict';
import { harness } from './pdf-view.harness.mjs';

for (const pageW of [612, 1224]) {
  for (const dpr of [1, 1.5, 2, 3, 4]) {
    const h = harness(), { pane, PdfView } = h;
    h.window.devicePixelRatio = dpr;
    pane.clientWidth = 1400;
    h.makeDoc('/fixture', [[pageW, 792]]);
    await PdfView.mount(pane, '/fixture');
    const side = pane._pdf.metas[0].sides[0];
    pane._pdf.io.fire(side); await h.idle(pane);
    assert.ok(side.canvas.width / pageW >= 1.5, 'normal-width reading should remain sharp');
    assert.ok(side.canvas.width * side.canvas.height <= 8e6);
    assert.ok(Math.abs(side.paintedW - 1312) < 1);
    assert.equal(h.calls.text.at(-1).viewport.width, side.cssW);
    const render = h.calls.renders.findLast(r => r.canvasContext.canvas === side.canvas);
    assert.ok(Math.abs(render.transform[0] * render.viewport.width - side.canvas.width) < .001);
    PdfView.setZoom(pane, 4); await h.idle(pane);
    assert.equal(side.paintedW, pageW * 4, 'memory protection must preserve 400% CSS zoom');
    assert.ok(side.canvas.width * side.canvas.height <= 8e6);
    assert.equal(h.calls.text.at(-1).viewport.width, side.cssW);
    assert.ok(side.detailCanvas, 'high zoom must paint a sharp visible region');
    assert.ok(side.detailK >= dpr, 'visible region must retain physical screen resolution');
    assert.ok(side.detailK >= 2, 'zoom must not merely enlarge the capped whole-page bitmap');
    assert.ok(side.detailCanvas.width * side.detailCanvas.height <= 32e6);
    assert.ok(side.detailCanvas.width / parseFloat(side.detailCanvas.style.width) >= dpr);
    const detailRender = h.calls.renders.findLast(r => r.canvasContext.canvas === side.detailCanvas);
    assert.equal(detailRender.transform[0], side.detailK);
    assert.equal(detailRender.viewport.width, side.cssW, 'crop must keep the full page coordinate system');
    await PdfView.dispose(pane);
  }
}
console.log('PASS preview budgets and native-resolution visible regions at 400%, DPR 1/1.5/2/3/4');
