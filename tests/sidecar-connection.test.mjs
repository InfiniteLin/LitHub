import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
const require = createRequire(import.meta.url);
const { selectSidecarPort, waitForOwnedSidecar } = require('../electron/sidecar-connection.js');

let owner = 'installed-instance', alive = true, requests = 0;
const server = createServer((_req, res) => {
  requests++;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, service: 'lithub-sidecar', instance_id: owner }));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const occupied = server.address().port;
const options = { baseURL: `http://127.0.0.1:${occupied}`, instanceId: 'development-instance',
  fetch, isAlive: () => alive, timeoutMs: 150, retryMs: 10 };
try {
  await assert.rejects(selectSidecarPort(String(occupied)), /不可用/);
  for (const value of ['0', '-1', '65536', 'NaN', '1.5']) {
    await assert.rejects(selectSidecarPort(value), /整数/);
  }
  console.log('PASS occupied explicit ports and invalid configuration fail clearly');
  await assert.rejects(waitForOwnedSidecar(options), /未就绪/);
  assert.ok(requests > 0, 'old backend really returned successful health responses');
  owner = 'development-instance';
  await waitForOwnedSidecar(options);
  alive = false;
  await assert.rejects(waitForOwnedSidecar(options), /已退出/);
  console.log('PASS HTTP 200 from another instance is rejected, only own live backend is accepted');
  // Simulate the installed application occupying the normal default, without closing any existing listener.
  const defaultServer = createServer();
  const ownsDefault = await new Promise(resolve => {
    defaultServer.once('error', () => resolve(false));
    defaultServer.listen(8130, '127.0.0.1', () => resolve(true));
  });
  try {
    const selected = await selectSidecarPort();
    assert.notEqual(selected, 8130);
    assert.ok(selected > 0 && selected <= 65535);
    console.log('PASS default port conflict automatically selects a different local port');
  } finally {
    if (ownsDefault) await new Promise(resolve => defaultServer.close(resolve));
  }
} finally {
  await new Promise(resolve => server.close(resolve));
}
