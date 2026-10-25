/* Each desktop window must connect only to the backend it started. */
const { createServer } = require('node:net');

function availablePort(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      const selected = server.address().port;
      server.close(error => error ? reject(error) : resolve(selected));
    });
  });
}

async function selectSidecarPort(configured) {
  if (configured !== undefined && configured !== '') {
    const port = Number(configured);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('LITHUB_API_PORT 必须是 1–65535 的整数');
    try { return await availablePort(port); }
    catch { throw new Error(`指定的后端端口 ${port} 不可用，请关闭占用程序或修改 LITHUB_API_PORT`); }
  }
  try { return await availablePort(8130); }
  catch { return availablePort(0); }
}

async function waitForOwnedSidecar({ baseURL, instanceId, fetch, isAlive,
  timeoutMs = 20000, retryMs = 200 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive()) throw new Error('本次启动的后端已退出，请检查 Python 依赖和启动日志');
    try {
      const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(1500), cache: 'no-store' });
      const info = response.ok ? await response.json() : null;
      if (info?.ok === true && info.service === 'lithub-sidecar' && info.instance_id === instanceId && isAlive()) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, retryMs));
  }
  throw new Error('本次启动的后端未就绪；未连接到其他已运行实例');
}

module.exports = { selectSidecarPort, waitForOwnedSidecar };
