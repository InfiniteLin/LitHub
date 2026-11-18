/* Independent pdf2zh runtime updates. Only replace this card, preserving settings drafts. */
window.TranslationPlugin = (() => {
  let timer = null, generation = 0, requesting = false;
  const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const html = () => '<section class="set-card" style="margin-top:18px" id="translation-plugin"><h3>pdf2zh-next</h3><p class="set-desc">正在读取版本…</p></section>';
  function draw(info) {
    const card = document.getElementById('translation-plugin');
    if (!card) return;
    const installedNext = info.package === 'pdf2zh-next';
    card.innerHTML = `<h3>pdf2zh-next</h3>
      <p class="set-desc">${installedNext ? `已安装 ${escape(info.current)}` : '未安装'}${info.available && info.latest ? ` · 可安装 ${escape(info.latest)}` : ''}</p>
      ${info.message ? `<p role="status">${escape(info.message)}</p>` : ''}
      <div class="set-foot" style="gap:10px;flex-wrap:wrap">
      ${info.busy ? '<button class="btn" data-plugin="cancel">取消更新</button>' : `
      ${info.can_restore ? '<button class="btn" data-plugin="restore">恢复内置版</button>' : ''}
      <button class="btn" data-plugin="check">检查更新</button>
      <button class="btn btn-primary" data-plugin="install">${!installedNext ? '安装 pdf2zh-next' : info.available ? '更新引擎' : '修复安装'}</button>`}</div>`;
  }
  async function request(operation) {
    const response = await fetch(`${API_BASE}/api/settings/translation-plugin${operation ? '/' + operation : ''}`, {
      method: operation ? 'POST' : 'GET', signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || '插件操作失败');
    return data;
  }
  async function refresh(token, operation) {
    try {
      const data = await request(operation);
      if (token !== generation || !document.getElementById('translation-plugin')) return;
      draw(data);
      if (data.busy) timer = setTimeout(() => refresh(token), 1200);
    } catch (error) {
      if (token !== generation) return;
      const card = document.getElementById('translation-plugin');
      if (card) {
        card.innerHTML = `<h3>pdf2zh-next</h3><p role="status">${escape(error.message)}</p><button class="btn" data-plugin="reload">重新读取</button>`;
      }
    }
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-plugin]');
    if (!button || requesting) return;
    requesting = true;
    button.disabled = true;
    clearTimeout(timer);
    await refresh(++generation, button.dataset.plugin === 'reload' ? '' : button.dataset.plugin);
    requesting = false;
  });
  function mount() {
    clearTimeout(timer);
    const token = ++generation;
    if (document.getElementById('translation-plugin')) refresh(token);
  }
  return {html, mount};
})();
