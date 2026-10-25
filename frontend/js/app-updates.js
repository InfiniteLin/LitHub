/* Update UI is independent of the library/sidecar, and never renders remote HTML. */
"use strict";
window.AppUpdates = (() => {
  let snapshot = null, bridge = null, changed = () => {}, notify = () => {}, unsubscribe = null;
  let saving = false, loading = false, generation = 0;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  function accept(next) {
    if (!next || typeof next !== "object" || (snapshot && next.revision < snapshot.revision)) return;
    snapshot = { ...next }; changed();
    if (next.notify && next.hasUpdate) notify(next.release.version);
  }
  function failure(error) {
    snapshot = { ...snapshot, status: "error", error: error?.message || "更新服务暂不可用，请重新打开程序后重试。" };
    changed();
  }
  async function init(options = {}) {
    const current = ++generation;
    unsubscribe?.();
    bridge = window.lithub?.updates;
    changed = options.onChange || (() => {}); notify = options.onAvailable || (() => {});
    if (!bridge) { snapshot = null; loading = false; changed(); return; }
    loading = true;
    unsubscribe = bridge.onChange(next => { if (current === generation) accept(next); });
    try { const next = await bridge.getState(); if (current === generation) accept(next); }
    catch (e) { if (current === generation) failure(e); }
    finally { if (current === generation) { loading = false; changed(); } }
  }
  async function check() {
    if (!bridge || loading || snapshot?.status === "checking") return;
    loading = true; changed();
    try { accept(await bridge.check()); } catch (e) { failure(e); }
    finally { loading = false; changed(); }
  }
  async function setAutoCheck(enabled) {
    if (!bridge || saving) return;
    saving = true; changed();
    try { accept(await bridge.setAutoCheck(enabled)); }
    catch (e) { throw Error(e?.message || "保存更新偏好失败。"); }
    finally { saving = false; changed(); }
  }
  async function openRelease() {
    if (!bridge) return { ok: false, error: "请使用桌面程序查看更新。" };
    try { return await bridge.openRelease(); }
    catch { return { ok: false, error: "无法打开更新页面，请稍后重试。" }; }
  }
  async function operation(name) {
    if (!bridge?.[name]) return;
    try { accept(await bridge[name]()); } catch (e) { failure(e); }
  }
  function html() {
    const s = snapshot, d = s?.download || { status: 'idle' };
    const transferring = ['preparing','downloading','verifying','installing'].includes(d.status);
    const busy = loading || s?.status === "checking" || transferring;
    const labels = { idle: "准备好时，可检查是否有新版本。", checking: "正在检查更新…",
      available: `发现新版本 v${s?.release?.version || ""}`, "up-to-date": "当前已是最新正式版本。" };
    const status = !bridge ? "请在桌面程序中检查更新。" : !s ? "正在读取版本信息…"
      : s.status === "error" || s.status === "unavailable" ? s.error : labels[s.status] || "尚未检查更新。";
    const release = s?.hasUpdate && s.release;
    return `<section class="set-card update-card">
      <div class="update-heading"><span class="update-brand" aria-hidden="true">文</span><div><h3>文枢 LitHub</h3>
        <p class="update-version">${s?.currentVersion ? `当前版本 v${esc(s.currentVersion)}` : bridge ? '正在读取版本…' : '浏览器预览'}</p></div></div>
      <div class="update-status" role="status" aria-live="polite" data-status="${esc(s?.status || 'idle')}">
        <span class="update-status-dot" aria-hidden="true"></span><span>${esc(status)}</span></div>
      ${s?.checkedAt ? `<p class="update-checked">上次成功检查：${esc(new Date(s.checkedAt).toLocaleString())}</p>` : ''}
      ${release ? `<div class="update-release"><div class="update-release-head"><h4>${s.status === 'available' ? '新版本' : '上次发现的版本'} v${esc(release.version)}</h4>
        ${release.publishedAt ? `<time>${esc(new Date(release.publishedAt).toLocaleDateString())}</time>` : ''}</div>
        <div class="update-notes">${esc(release.notes.trim() || '此版本尚未填写更新说明，可前往发布页面查看。')}</div></div>` : ''}
      <label class="update-auto"><input type="checkbox" id="set-update-auto" ${s?.autoCheck ? 'checked' : ''} ${!bridge || !s || saving ? 'disabled' : ''}>
        <span>启动时自动检查更新<small>每天最多自动检查一次，发现新版本时轻量提醒。</small></span></label>
      ${s?.settingsError ? `<p class="update-warning">${esc(s.settingsError)}</p>` : ''}
      ${transferring || d.status === 'ready' || d.error ? `<div class="update-download" role="status" aria-live="polite">
        <p>${esc(({preparing:'正在获取安装包信息…', downloading:`正在下载 ${d.total ? Math.min(100, Math.floor(d.received / d.total * 100)) : 0}%`,
          verifying:'正在校验安装包…', ready:`v${d.version || release?.version || ''} 已下载，可以重启安装。`, installing:'正在准备重启安装…'})[d.status] || '')}</p>
        ${d.status === 'downloading' ? `<progress max="${Number(d.total) || 1}" value="${Number(d.received) || 0}" aria-label="更新下载进度"></progress><small>${(d.received / 1048576).toFixed(1)} / ${(d.total / 1048576).toFixed(1)} MB</small>` : ''}
        ${d.error ? `<p class="update-warning">${esc(d.error)}</p>` : ''}</div>` : ''}
      <div class="set-foot update-actions"><button class="btn" data-action="updates-check" ${!bridge || busy ? 'disabled' : ''}>${busy ? '正在检查…' : '检查更新'}</button>
        ${d.status === 'ready' ? '<button class="btn btn-primary" data-action="updates-install">重启并安装</button>'
          : release ? `<button class="btn btn-primary" data-action="updates-download" ${!s.canInstall || busy ? 'disabled' : ''}>${transferring ? '正在更新…' : d.status === 'error' ? '重新下载' : '下载更新'}</button>` : ''}
        ${['preparing','downloading','verifying'].includes(d.status) ? '<button class="btn" data-action="updates-cancel">取消下载</button>' : ''}
        <button class="btn" data-action="updates-open" ${!bridge ? 'disabled' : ''}>发布记录</button></div>
      <p class="update-source">更新来源：GitHub · InfiniteLin/LitHub。应用内下载并校验，点击重启安装后完成更新，保留文献与设置。${bridge && s && !s.canInstall ? '开发版仅支持检查更新，请使用 Windows 安装版安装更新。' : ''}</p>
    </section>`;
  }
  return { init, html, check, setAutoCheck, openRelease,
    download: () => operation('download'), cancelDownload: () => operation('cancelDownload'), install: () => operation('install'),
    hasUpdate: () => !!snapshot?.hasUpdate };
})();
