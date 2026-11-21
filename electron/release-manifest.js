'use strict';

const {randomUUID} = require('node:crypto');
const MANIFEST_PATH = '/InfiniteLin/LitHub/releases/latest/download/update.json';
const MANIFEST_URL = 'https://github.com' + MANIFEST_PATH;
const FEED_URL = 'https://raw.githubusercontent.com/InfiniteLin/LitHub/update-feed/update.json';
const MAX_BYTES = 65536;
const ATTEMPT_TIMEOUT = 6500;
const REDIRECTS = [301, 302, 303, 307, 308];

function allowed(url) {
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash &&
    (url.href === FEED_URL || (url.hostname === 'github.com' &&
      (url.pathname === MANIFEST_PATH ||
        /^\/InfiniteLin\/LitHub\/releases\/download\/[^/]+\/update\.json$/.test(url.pathname))) ||
      ['release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(url.hostname));
}

async function discard(response) {
  if (typeof response.body?.cancel === 'function') await response.body.cancel();
  else response.body?.destroy();
}

async function readManifest(fetch, source, signal, transport) {
  let url = new URL(source);
  const nonce = randomUUID();
  for (let hop = 0; hop < 6; hop++) {
    signal.throwIfAborted();
    if (!allowed(url)) throw Error('更新清单跳转地址不安全。');
    // Both GitHub hops can be cached. Leave the storage CDN's signed URL intact.
    if (url.hostname === 'github.com') url.searchParams.set('lithub_manifest', nonce);
    let response;
    try {
      response = await fetch(url.href, {signal, transport, redirect:'manual', credentials:'omit', cache:'no-store',
        headers:{Accept:'application/json', 'Cache-Control':'no-cache, no-store', Pragma:'no-cache'}});
    } catch (error) {
      throw Object.assign(Error('无法连接公开更新清单。', {cause: error}), {retryTransport: true});
    }
    if (REDIRECTS.includes(response.status)) {
      const location = response.headers.get('location');
      await discard(response);
      if (!location) throw Error('更新清单跳转无效。');
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      await discard(response);
      const signedURLRejected = source === MANIFEST_URL && url.hostname !== 'github.com' &&
        [400, 401, 403].includes(response.status);
      throw Object.assign(Error(`更新清单暂不可用（HTTP ${response.status}）。`),
        {status: response.status, retryTransport: signedURLRejected || response.status === 408 || response.status >= 500});
    }
    if (Number(response.headers?.get('content-length')) > MAX_BYTES) {
      await discard(response);
      throw Error('更新清单过大。');
    }

    let raw;
    if (response.body) {
      const parts = [];
      let size = 0;
      try {
        for await (const chunk of response.body) {
          signal.throwIfAborted();
          size += chunk.length;
          if (size > MAX_BYTES) break;
          parts.push(Buffer.from(chunk));
        }
      } catch (error) {
        throw Object.assign(Error('读取更新清单时连接中断。', {cause: error}), {retryTransport: true});
      }
      if (size > MAX_BYTES) throw Error('更新清单过大。');
      raw = Buffer.concat(parts).toString('utf8');
    }
    let data;
    try { data = raw === undefined ? await response.json() : JSON.parse(raw); }
    catch { throw Error('更新清单无法解析。'); }
    if (data?.schemaVersion !== 1 || !data.release || data.release.draft === true || data.release.prerelease === true)
      throw Error('更新清单格式无效。');
    return data.release;
  }
  throw Error('更新清单跳转过多。');
}

async function fetchFrom(fetch, source, signal) {
  const first = AbortSignal.any([signal, AbortSignal.timeout(ATTEMPT_TIMEOUT)]);
  try {
    return await readManifest(fetch, source, first);
  } catch (error) {
    signal.throwIfAborted();
    if (!first.aborted && !error.retryTransport) throw error;
  }
  return readManifest(fetch, source, AbortSignal.any([signal, AbortSignal.timeout(ATTEMPT_TIMEOUT)]), 'http1');
}

async function fetchPublicRelease(fetch, signal) {
  try {
    return await fetchFrom(fetch, MANIFEST_URL, signal);
  } catch (error) {
    signal.throwIfAborted();
    if (!error.retryTransport && ![403, 404, 429].includes(error.status)) throw error;
    try {
      return await fetchFrom(fetch, FEED_URL, signal);
    } catch {
      signal.throwIfAborted();
      throw error;
    }
  }
}

module.exports = {fetchPublicRelease, MANIFEST_URL, FEED_URL};
