"use strict";

const fs = require("node:fs");
const path = require("node:path");
const RELEASES_URL = "https://github.com/InfiniteLin/LitHub/releases";
const API_URL = "https://api.github.com/repos/InfiniteLin/LitHub/releases/latest";
const DAY = 24 * 60 * 60 * 1000;

function parseVersion(value) {
  if (typeof value !== "string" || value.length > 160) return null;
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/i.exec(value);
  if (!match) return null;
  const pre = match[4]?.split(".") || [];
  if (pre.some(x => /^\d+$/.test(x) && x.length > 1 && x[0] === "0")) return null;
  return { core: match.slice(1, 4).map(BigInt), pre, version: value.replace(/^v/i, "") };
}

function compareVersions(a, b) {
  a = parseVersion(a); b = parseVersion(b);
  if (!a || !b) throw Error("版本号格式无效");
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i] ? 1 : -1;
  }
  if (!a.pre.length || !b.pre.length) return a.pre.length === b.pre.length ? 0 : a.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i], y = b.pre[i];
    if (x === y) continue;
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
    if (xn && yn) return BigInt(x) > BigInt(y) ? 1 : -1;
    if (xn !== yn) return xn ? -1 : 1;
    return x > y ? 1 : -1;
  }
  return 0;
}

function normalizeRelease(data) {
  if (!data || typeof data !== "object") throw Error("发布信息格式无效");
  if (data.draft === true || data.prerelease === true) return null;
  const version = parseVersion(data.tag_name);
  if (!version) throw Error("发布版本号格式无效");
  if (version.pre.length) return null;
  const date = Date.parse(data.published_at);
  return {
    version: version.version, tag: data.tag_name,
    name: typeof data.name === "string" ? data.name.slice(0, 200) : data.tag_name,
    notes: typeof data.body === "string" ? data.body.slice(0, 20000) : "",
    publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : "",
    // Ignore all remotely supplied links, including html_url and asset URLs.
    url: `${RELEASES_URL}/tag/${encodeURIComponent(data.tag_name)}`,
  };
}

function createUpdateService({ version, storageFile, fetch, openExternal, onChange = () => {},
  now = Date.now, timers = globalThis }) {
  if (!parseVersion(version)) throw Error("当前程序版本号格式无效");
  let prefs = { autoCheck: true, lastAttemptAt: 0, checkedAt: 0, blockedUntil: 0, notifiedVersion: "", release: null };
  try {
    if (fs.statSync(storageFile).size <= 65536) {
      const saved = JSON.parse(fs.readFileSync(storageFile, "utf8"));
      for (const k of ["lastAttemptAt", "checkedAt", "blockedUntil"]) {
        if (Number.isFinite(saved[k]) && saved[k] >= 0 && saved[k] <= now() + DAY) prefs[k] = saved[k];
      }
      if (typeof saved.autoCheck === "boolean") prefs.autoCheck = saved.autoCheck;
      if (parseVersion(saved.notifiedVersion)) prefs.notifiedVersion = saved.notifiedVersion;
      if (saved.release) {
        // Revalidate the cache; never load an external URL from preferences.
        const r = saved.release;
        prefs.release = normalizeRelease({ tag_name: r.tag, name: r.name, body: r.notes, published_at: r.publishedAt });
      }
    }
  } catch { /* Missing/corrupt preferences use defaults; the library is untouched. */ }
  let status = baseStatus(), error = "", settingsError = "", revision = 0;
  let inFlight = null, controller = null, startupTimer = null, interval = null, stopped = false;

  function baseStatus() {
    return prefs.checkedAt && prefs.release ? (compareVersions(prefs.release.version, version) > 0 ? "available" : "up-to-date") : "idle";
  }
  function getState() {
    return { currentVersion: version, autoCheck: prefs.autoCheck, status, error, settingsError,
      checkedAt: prefs.checkedAt, lastAttemptAt: prefs.lastAttemptAt, release: prefs.release && { ...prefs.release },
      hasUpdate: !!prefs.release && compareVersions(prefs.release.version, version) > 0, revision };
  }
  function emit(notify = false) {
    revision++;
    try { onChange({ ...getState(), notify }); } catch { /* A closing renderer must not fail the check. */ }
  }
  function write(next) {
    fs.mkdirSync(path.dirname(storageFile), { recursive: true });
    const tmp = `${storageFile}.${process.pid}.tmp`;
    try { fs.writeFileSync(tmp, JSON.stringify(next), "utf8"); fs.renameSync(tmp, storageFile); }
    finally { try { fs.unlinkSync(tmp); } catch {} }
  }
  function persist() {
    try { write(prefs); settingsError = ""; }
    catch { settingsError = "检查记录未能保存，重启后可能重复检查。"; }
  }
  function setAutoCheck(enabled) {
    if (typeof enabled !== "boolean") throw Error("更新偏好格式无效");
    const next = { ...prefs, autoCheck: enabled };
    try { write(next); } catch { throw Error("无法保存更新偏好，本次设置未生效。请检查用户目录是否可写。" ); }
    prefs = next; settingsError = ""; emit();
    return getState();
  }
  function check({ automatic = false } = {}) {
    if (stopped) return Promise.resolve(getState());
    if (inFlight) return inFlight;
    if (automatic && (!prefs.autoCheck || (prefs.lastAttemptAt && now() - prefs.lastAttemptAt < DAY))) return Promise.resolve(getState());
    inFlight = Promise.resolve().then(async () => {
      if (stopped) return getState();
      if (now() < prefs.blockedUntil) {
        status = "error"; error = "GitHub 暂时限制了检查频率，请稍后重试。"; emit(); return getState();
      }
      status = "checking"; error = ""; prefs.lastAttemptAt = now(); persist(); emit();
      controller = new AbortController();
      const timeout = timers.setTimeout(() => controller?.abort(), 15000);
      try {
        let response;
        try {
          response = await fetch(API_URL, { signal: controller.signal,
            headers: { Accept: "application/vnd.github+json", "User-Agent": `LitHub/${version}` },
            credentials: "omit", redirect: "error" });
        } catch { throw Error("无法连接 GitHub，请检查网络后重试。"); }
        if (response.status === 404) {
          status = "unavailable"; error = "暂无可访问的正式版本。发布源可能尚未发布版本，或仓库未公开。";
        } else {
          if (response.status === 403 || response.status === 429) {
            const reset = Number(response.headers?.get("x-ratelimit-reset")) * 1000;
            const retry = Number(response.headers?.get("retry-after")) * 1000;
            prefs.blockedUntil = now() + Math.min(DAY, Math.max(60000, reset - now() || 0, retry || 0));
            throw Error("GitHub 暂时限制了检查频率，请稍后重试。");
          }
          if (!response.ok) throw Error(`检查失败（HTTP ${response.status}），请稍后重试。`);
          let data;
          try { data = await response.json(); } catch { throw Error("发布信息无法解析，请稍后重试。"); }
          let release;
          try { release = normalizeRelease(data); } catch (e) { throw Error(e.message); }
          if (!release) {
            status = "unavailable"; error = "当前发布的版本是草稿或测试版，暂不提供正式版更新。";
          } else {
            prefs.release = release; prefs.checkedAt = now(); prefs.blockedUntil = 0;
            status = compareVersions(release.version, version) > 0 ? "available" : "up-to-date";
          }
        }
      } catch (e) {
        if (stopped) { status = baseStatus(); return getState(); }
        status = "error";
        error = controller.signal.aborted ? "检查超时，请检查网络后重试。"
          : (e instanceof TypeError ? "无法连接 GitHub，请检查网络后重试。" : e.message || "检查失败，请稍后重试。");
      } finally { timers.clearTimeout(timeout); controller = null; }
      if (stopped) return getState();
      const notify = automatic && prefs.autoCheck && status === "available" && prefs.notifiedVersion !== prefs.release.version;
      if (status === "available") prefs.notifiedVersion = prefs.release.version;
      persist(); emit(notify); return getState();
    }).finally(() => { inFlight = null; });
    return inFlight;
  }
  async function openRelease() {
    try { await openExternal(getState().hasUpdate ? prefs.release.url : RELEASES_URL); return { ok: true }; }
    catch { return { ok: false, error: "无法打开系统浏览器，请稍后重试。" }; }
  }
  function start() {
    if (startupTimer !== null || stopped) return;
    startupTimer = timers.setTimeout(() => { void check({ automatic: true }); }, 10000);
    interval = timers.setInterval(() => { void check({ automatic: true }); }, 60 * 60 * 1000);
    startupTimer.unref?.(); interval.unref?.();
  }
  function stop() {
    stopped = true; timers.clearTimeout(startupTimer); timers.clearInterval(interval); controller?.abort();
  }
  return { getState, check, setAutoCheck, openRelease, start, stop };
}

function registerUpdateIPC(ipcMain, getService, trusted) {
  const service = event => {
    if (!trusted(event)) throw Error("更新请求来源无效");
    const updater = getService();
    if (!updater) throw Error("更新服务尚未就绪，请稍后重试。");
    return updater;
  };
  ipcMain.handle("updates:state", e => service(e).getState());
  ipcMain.handle("updates:check", e => service(e).check());
  ipcMain.handle("updates:auto-check", (e, enabled) => service(e).setAutoCheck(enabled));
  ipcMain.handle("updates:open-release", e => service(e).openRelease());
}

module.exports = { createUpdateService, registerUpdateIPC, compareVersions, normalizeRelease };
