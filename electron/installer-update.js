"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const MAX_SIZE = 2 * 1024 ** 3;
const PREFIX = "https://github.com/InfiniteLin/LitHub/releases/download/";

function installerAsset(data) {
  const version = String(data.tag_name || '').replace(/^v/i, '');
  const expectedNames = [`文枢 LitHub Setup ${version}.exe`, `LitHub Setup ${version}.exe`];
  const candidates = (Array.isArray(data.assets) ? data.assets : []).filter(a =>
    a && expectedNames.includes(a.name)
    && Number.isSafeInteger(a.size) && a.size > 0 && a.size <= MAX_SIZE
    && a.state === "uploaded");
  // An ambiguous release must not arbitrarily pick an architecture or installer.
  if (candidates.length !== 1) return null;
  const a = candidates[0];
  return { name: a.name, size: a.size,
    url: `${PREFIX}${encodeURIComponent(data.tag_name)}/${encodeURIComponent(a.name)}`,
    sha256: /^sha256:[a-f0-9]{64}$/i.test(a.digest || "") ? a.digest.slice(7).toLowerCase() : "" };
}

function allowedDownloadURL(value) {
  const u = new URL(value);
  return u.protocol === "https:" && !u.username && !u.password && !u.port &&
    ((u.hostname === "github.com" && u.pathname.startsWith("/InfiniteLin/LitHub/releases/download/")) ||
      u.hostname === "release-assets.githubusercontent.com" || u.hostname === "objects.githubusercontent.com");
}

// Redirects are validated before each request. No renderer-provided URL/path is used.
async function fetchAsset(fetch, url, signal) {
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (!allowedDownloadURL(url)) throw Error("安装包下载地址无效。");
    const response = await fetch(url, { signal, redirect: "manual", credentials: "omit" });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw Error("安装包下载跳转无效。");
      url = new URL(location, url).href;
    } else {
      if (!response.ok) throw Error(`下载失败（HTTP ${response.status}），请重试。`);
      return response;
    }
  }
  throw Error("安装包下载跳转次数过多。");
}

async function verifyFile(file, expected) {
  const stat = await fs.promises.stat(file);
  if (stat.size !== expected.size) throw Error("安装包大小校验失败，请重新下载。");
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  if (hash.digest("hex") !== expected.sha256) throw Error("安装包校验失败，请重新下载。");
}

async function pruneDownloads(directory) {
  for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('download-')) continue;
    const folder = path.join(directory, entry.name), marker = path.join(folder, '.lithub-update');
    try {
      const stat = await fs.promises.stat(marker);
      if (Date.now() - stat.mtimeMs > 24 * 60 * 60 * 1000)
        await fs.promises.rm(folder, { recursive: true, force: true });
    } catch { /* Only remove recognized, expired updater folders. */ }
  }
}

function createInstallerUpdate({ directory, fetch, resolveRelease, install, onChange = () => {}, enabled = true }) {
  let state = { status: "idle", received: 0, total: 0, error: "", version: "" };
  let flight = null, controller = null, ready = null, installing = false;
  const emit = patch => { state = { ...state, ...patch }; onChange(); };
  function download() {
    if (flight) return flight;
    if (installing || state.status === "ready") return Promise.resolve();
    if (!enabled) return Promise.reject(Error("请使用 Windows 安装版进行应用内更新。"));
    controller = new AbortController();
    const signal = controller.signal;
    flight = Promise.resolve().then(async () => {
      let work;
      let timeout;
      try {
        emit({ status: "preparing", received: 0, total: 0, error: "" });
        // Refresh metadata, including GitHub's SHA-256 digest; never trust a disk cache for execution.
        let abort;
        const aborted = new Promise((_, reject) => {
          abort = () => reject(signal.reason);
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) abort();
        });
        const release = await Promise.race([resolveRelease(), aborted]).finally(() => signal.removeEventListener('abort', abort));
        signal.throwIfAborted();
        const asset = release?.installer;
        if (!asset) throw Error("此版本尚未提供可用的 Windows 安装包。");
        if (!asset.sha256) throw Error("此版本缺少 SHA-256 校验信息，请等待发布者重新上传安装包。");
        await fs.promises.mkdir(directory, { recursive: true });
        await pruneDownloads(directory);
        work = await fs.promises.mkdtemp(path.join(directory, "download-"));
        await fs.promises.writeFile(path.join(work, '.lithub-update'), '1');
        const partial = path.join(work, "installer.part"), file = path.join(work, "installer.exe");
        emit({ status: "downloading", total: asset.size, version: release.version });
        const armTimeout = () => { clearTimeout(timeout); timeout = setTimeout(() => controller?.abort(new Error("下载超时，请重试。")), 60000); };
        armTimeout();
        const response = await fetchAsset(fetch, asset.url, signal);
        if (!response.body) throw Error("安装包下载内容为空。");
        const handle = await fs.promises.open(partial, "wx");
        const hash = createHash("sha256");
        let received = 0, lastEmit = 0;
        try {
          for await (const chunk of response.body) {
            signal.throwIfAborted(); armTimeout();
            received += chunk.length;
            if (received > asset.size) throw Error("安装包大小不符合发布信息。");
            hash.update(chunk);
            let offset = 0;
            while (offset < chunk.length) offset += (await handle.write(chunk, offset, chunk.length - offset)).bytesWritten;
            if (Date.now() - lastEmit > 200) { emit({ received }); lastEmit = Date.now(); }
          }
        } finally { await handle.close(); }
        signal.throwIfAborted();
        emit({ status: "verifying", received });
        if (received !== asset.size || hash.digest("hex") !== asset.sha256) throw Error("安装包校验失败，请重新下载。");
        await fs.promises.rename(partial, file);
        ready = { file, ...asset };
        emit({ status: "ready", error: "" });
      } catch (error) {
        ready = null;
        if (work) await fs.promises.rm(work, { recursive: true, force: true }).catch(() => {});
        emit({ status: signal.aborted && signal.reason?.name === "AbortError" ? "idle" : "error",
          error: signal.aborted ? (signal.reason?.name === "AbortError" ? "" : signal.reason.message) : error.message });
      } finally { clearTimeout(timeout); }
    }).finally(() => { flight = null; controller = null; });
    return flight;
  }
  async function installReady() {
    if (installing) return;
    if (!enabled || !ready || state.status !== "ready") throw Error("请先下载并校验更新。");
    installing = true; emit({ status: "installing", error: "" });
    try {
      await verifyFile(ready.file, ready);
      const accepted = await install(ready.file);
      if (accepted === false) emit({ status: "ready" });
    } catch (error) {
      // Corrupt/deleted cached files must allow a fresh download rather than an endless install retry.
      try { await verifyFile(ready.file, ready); }
      catch { ready = null; emit({ status: "error", error: "安装包校验失败，请重新下载。" }); return; }
      emit({ status: "ready", error: error.message || "无法启动安装程序，请重试。" });
    }
    finally { installing = false; }
  }
  return { getState: () => ({ ...state }), download, install: installReady,
    cancel: () => { controller?.abort(); }, stop: () => controller?.abort() };
}
module.exports = { installerAsset, createInstallerUpdate, fetchAsset, verifyFile };
