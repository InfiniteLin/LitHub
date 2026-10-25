/* Real backend boot while another local backend occupies a port. No personal data or AI requests. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const { selectSidecarPort, waitForOwnedSidecar } = require('../electron/sidecar-connection.js');
const temporary = mkdtempSync(path.join(tmpdir(), 'lithub-instance-'));
writeFileSync(path.join(temporary, 'library.json'), JSON.stringify({ papers: {}, tasks: {}, settings: {} }));
const port = await selectSidecarPort(), instance = randomUUID();
const pythonArgs = process.env.LITHUB_TEST_SITE_PACKAGES
  ? ['-B', '-c', `import sys;sys.path.insert(0,${JSON.stringify(path.resolve(process.env.LITHUB_TEST_SITE_PACKAGES))});import uvicorn;uvicorn.run('main:app',host='127.0.0.1',port=${port})`]
  : ['-B', '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(port)];
const child = spawn(process.env.LITHUB_TEST_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), pythonArgs, {
  cwd: path.resolve('backend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, LITHUB_DATA_DIR: temporary, LITHUB_PROGRAM_DIR: temporary,
    LITHUB_PDF_DEFAULT_DIR: path.join(temporary, 'pdfs'), LITHUB_INSTANCE_ID: instance,
    LITHUB_API_PORT: String(port), PYTHONDONTWRITEBYTECODE: '1' },
});
let logs = '';
child.stdout.on('data', data => { logs += data; });
child.stderr.on('data', data => { logs += data; });
child.on('error', error => { logs += error.message; });
try {
  const baseURL = `http://127.0.0.1:${port}`;
  await waitForOwnedSidecar({ baseURL, instanceId: instance, fetch,
    isAlive: () => child.exitCode === null && !child.killed });
  const info = await (await fetch(baseURL + '/api/health')).json();
  assert.equal(info.instance_id, instance);
  const served = Buffer.from(await (await fetch(baseURL + '/js/app.js')).arrayBuffer());
  assert.ok(served.equals(readFileSync('frontend/js/app.js')), 'serves the current workspace frontend');
  const api = await (await fetch(baseURL + '/openapi.json')).json();
  assert.ok(api.paths['/api/tasks/{tid}/cancel']);
  assert.equal((await fetch(baseURL + '/api/tasks/missing/cancel', { method: 'POST' })).status, 404);
  for (const headers of [{}, { 'X-LitHub-Instance': 'different-application' }]) {
    assert.equal((await fetch(baseURL + '/api/browser/shutdown', { method: 'POST', headers })).status, 403);
    assert.equal((await (await fetch(baseURL + '/api/browser/status')).json()).stopping, false);
  }
  assert.equal((await fetch(baseURL + '/api/browser/shutdown', {
    method: 'POST', headers: { 'X-LitHub-Instance': instance },
  })).status, 200);
  assert.equal((await (await fetch(baseURL + '/api/browser/status')).json()).stopping, true);
  console.log('PASS foreign/legacy shutdown cannot poison the browser session; only the owner can stop it');
  console.log(`PASS real backend at ${baseURL}: own instance, workspace frontend and cancellation endpoint`);
} catch (error) {
  throw new Error(error.message + '\n' + logs);
} finally {
  if (child.exitCode === null) {
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
  }
  rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
