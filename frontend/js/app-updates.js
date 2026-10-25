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
  function html() {
    const s = snapshot, busy = loading || s?.status === "checking";
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
      <div class="set-foot update-actions"><button class="btn" data-action="updates-check" ${!bridge || busy ? 'disabled' : ''}>${busy ? '正在检查…' : '检查更新'}</button>
        <button class="btn ${release ? 'btn-primary' : ''}" data-action="updates-open" ${!bridge ? 'disabled' : ''}>${release ? '查看更新并下载' : '查看发布记录'}</button></div>
      <p class="update-source">更新来源：GitHub · InfiniteLin/LitHub。下载后运行安装包完成更新。</p>
    </section>`;
  }
  return { init, html, check, setAutoCheck, openRelease, hasUpdate: () => !!snapshot?.hasUpdate };
})();
