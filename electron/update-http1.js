'use strict';
const https = require('node:https');
const tls = require('node:tls');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

function proxyAgent(result, signal) {
  // Use the same system/PAC decision as Chromium, never silently bypass a proxy.
  const first = result.split(';')[0].trim();
  if (first === 'DIRECT') return new https.Agent({ keepAlive: false });
  const match = /^(PROXY|HTTPS|SOCKS|SOCKS4|SOCKS5)\s+(\S+)$/.exec(first);
  if (!match) throw Error('更新下载的系统代理配置不受支持。');
  const [, kind, address] = match;
  if (kind === 'PROXY' || kind === 'HTTPS')
    return new HttpsProxyAgent(`${kind === 'HTTPS' ? 'https' : 'http'}://${address}`, { signal });
  return new SocksProxyAgent(`${kind === 'SOCKS4' ? 'socks4a' : 'socks5h'}://${address}`,
    { timeout: 15000, socketOptions: { signal } });
}

// Only used for a failed package transfer. Node HTTPS speaks HTTP/1.1 and does
// not share Chromium's broken HTTP/2 connection. Redirect validation stays in
// fetchAsset; TLS certificate checks remain enabled, including through proxies.
async function requestHTTP1(url, options, resolveProxy) {
  const { signal } = options;
  signal?.throwIfAborted();
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.username || target.password)
    throw Error('更新下载地址无效。');
  const proxy = await resolveProxy(url);
  signal?.throwIfAborted();
  const agent = proxyAgent(proxy, signal);
  return new Promise((resolve, reject) => {
    let body;
    const cleanup = () => { signal?.removeEventListener('abort', abort); agent.destroy(); };
    const request = https.request(target, { method: 'GET', agent, headers: options.headers,
      ALPNProtocols: ['http/1.1'],
      checkServerIdentity: (_name, cert) => tls.checkServerIdentity(target.hostname.replace(/^\[|\]$/g, ''), cert) });
    const abort = () => { body?.destroy(signal.reason); request.destroy(signal.reason); cleanup(); reject(signal.reason); };
    signal?.addEventListener('abort', abort, { once: true });
    request.on('error', error => { body?.destroy(error); cleanup(); reject(error); });
    request.on('response', response => {
      body = response;
      body.once('end', cleanup); body.once('close', cleanup);
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers))
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      resolve({ status: response.statusCode, ok: response.statusCode >= 200 && response.statusCode < 300,
        headers, body });
    });
    if (signal?.aborted) abort();
    else request.end();
  });
}
module.exports = { requestHTTP1, proxyAgent };
