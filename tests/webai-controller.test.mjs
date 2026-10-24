import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sandbox = { window: {}, setTimeout, clearTimeout };
vm.runInNewContext(readFileSync('frontend/js/webai-controller.js', 'utf8'), sandbox);
const Controller = sandbox.window.WebAiController;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(r => setTimeout(r, 0));
function fixture(overrides = {}, config = {}) {
  const calls = { open: 0, close: 0, bounds: [] }, errors = [], closed = [];
  const adapter = {
    open: async () => { calls.open++; return { ok: true, session_id: 'session' }; },
    close: async () => { calls.close++; return { ok: true }; },
    bounds: async r => { calls.bounds.push(r); return { ok: true }; },
    ...overrides,
  };
  const c = new Controller({ adapters: { browser: adapter }, onError: e => errors.push(e),
    onClosed: id => closed.push(id), timeout: 40, boundsTimeout: 30, ...config });
  const open = (owner = 'a', url = 'https://example.test', force = false) => c.open({ owner, url, mode: 'browser', force });
  return { c, calls, errors, closed, open, adapter };
}

{
  const { c, calls, open } = fixture();
  assert.equal((await open()).ok, true);
  assert.equal(c.state, 'hidden');
  const rect = { x: 1, y: 2, width: 400, height: 500, visible: true, dpr: 1.5 };
  await c.sync(rect);
  await c.sync(rect);
  assert.equal(calls.bounds.length, 1, 'identical geometry is deduplicated');
  assert.equal(calls.bounds[0].session_id, 'session');
  await c.sync({ ...rect, visible: false });
  assert.equal(c.state, 'hidden');
  assert.equal((await open('b')).reused, true);
  assert.equal(c.owner, 'b');
  assert.equal(calls.open, 1, 'same site keeps the conversation across papers');
  await c.dispose('a');
  assert.equal(c.owner, 'b', 'disposing old paper does not close transferred window');
  await open('b', 'https://example.test', true);
  assert.equal(calls.open, 2, 'explicit refresh bypasses reuse');
  await c.close();
  assert.equal(c.state, 'closed');
  console.log('PASS lifecycle, same-site reuse, explicit refresh and bounds deduplication');
}
{
  const gate = deferred();
  const { c, calls, open } = fixture({ open: async () => gate.promise }, { timeout: 1000 });
  const opening = open();
  await tick();
  const closing = c.close();
  await tick();
  assert.ok(calls.close > 0, 'native cancellation is issued before pending open finishes');
  gate.resolve({ ok: true });
  assert.equal((await opening).cancelled, true);
  await closing;
  assert.equal(c.owner, null);
  assert.equal(c.state, 'closed');
  console.log('PASS close cancels in-flight open immediately');
}
{
  const { c, open, calls } = fixture();
  const first = open();
  const second = open('b');
  assert.equal((await first).cancelled, true);
  await second;
  assert.equal(calls.open, 1);
  assert.equal(c.owner, 'b');
  console.log('PASS obsolete queued opens never start');
}
{
  const { c, open, calls } = fixture({ open: () => new Promise(() => {}) });
  const result = await open();
  assert.equal(result.ok, false);
  assert.match(result.error, /超时/);
  assert.equal(c.state, 'failed');
  assert.ok(calls.close > 0, 'timeout performs native cleanup');
  console.log('PASS timeout releases operation queue and cleans native session');
}
{
  const { c, open, adapter, errors } = fixture();
  await open();
  adapter.close = async () => ({ ok: false, error: 'cannot close' });
  assert.equal((await c.close()).ok, false);
  assert.equal(c.state, 'failed');
  assert.equal(errors[0], 'cannot close');
  console.log('PASS native close failure is reported');
}
{
  const gate = deferred();
  const { c, open, calls, adapter } = fixture();
  await open();
  let first = true;
  adapter.bounds = async r => { calls.bounds.push(r); if (first) { first = false; await gate.promise; } return { ok: true }; };
  const syncing = c.sync({ visible: true, x: 1 });
  await tick();
  c.sync({ visible: true, x: 2 });
  c.sync({ visible: false, x: 3 });
  gate.resolve();
  await syncing;
  assert.equal(calls.bounds.length, 2);
  assert.equal(calls.bounds.at(-1).x, 3);
  assert.equal(c.state, 'hidden');
  console.log('PASS in-flight geometry collapses to latest visibility and position');
}
{
  let attempts = 0;
  const { c, open, closed } = fixture({ bounds: async () => ++attempts === 1
    ? { ok: false, busy: true } : { ok: true } });
  await open();
  await c.sync({ visible: true });
  assert.equal(attempts, 2, 'temporary failure is retried');
  c.adapters.browser.bounds = async () => ({ ok: false, closed: true });
  await c.sync({ visible: false });
  assert.equal(c.state, 'closed');
  assert.equal(closed[0], 'a');
  console.log('PASS transient retry and native-closed detection');
}
