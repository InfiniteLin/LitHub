/* Implicit discovery: debounce, cache by profile/credentials, discard obsolete responses. */
"use strict";
const ApiModelDiscovery = (() => {
  function create({ request, onChange = () => {}, timers = globalThis, now = Date.now, delay = 700 }) {
    const records = new Map();
    let active = null, timer = null, controller = null, generation = 0;
    const waiting = () => ({ status:'waiting', models:[], message:'填写地址和 Key 后自动获取模型，也可手动填写。' });
    function cancel() { generation++; timers.clearTimeout(timer); timer = null; controller?.abort(); controller = null; active = null; }
    function schedule({ id, baseURL, key }) {
      const base = (baseURL || '').trim().replace(/\/+$/, ''), credential = (key || '').trim();
      let valid = false;
      try { const u = new URL(base); valid = ['http:','https:'].includes(u.protocol) && !!u.hostname && !u.username && !u.password && !u.search && !u.hash; } catch {}
      const signature = JSON.stringify([base,credential]);
      if (active && active.id === id && active.signature === signature && (timer !== null || controller)) return;
      cancel();
      if (!id) return;
      if (!valid || !credential) { records.set(id,{...waiting(),signature}); onChange(id); return; }
      active = { id, signature };
      const cached = records.get(id);
      if (cached?.signature === signature && now() - cached.at < (cached.status === 'ready' ? 300000 : 60000)) { onChange(id); return; }
      const current = generation;
      records.set(id,{status:'loading',models:[],message:'正在获取上游模型…',signature}); onChange(id);
      timer = timers.setTimeout(async () => {
        timer = null; const abort = new AbortController(); controller = abort;
        try {
          const result = await request({ provider:id, base_url:base, api_key:credential }, { signal:abort.signal });
          if (generation !== current || abort.signal.aborted) return;
          const models = Array.isArray(result.models) ? [...new Set(result.models.filter(m=>typeof m === 'string' && m.length > 0 && m.length <= 256))].slice(0,1000) : [];
          records.set(id,{status:result.ok ? 'ready' : 'unavailable',models,signature,at:now(),
            message:models.length ? `已获取 ${models.length} 个模型，可输入筛选或手动填写。` : result.message || '未获取到模型列表，可手动填写模型。'});
        } catch {
          if (generation !== current || abort.signal.aborted) return;
          records.set(id,{status:'unavailable',models:[],signature,at:now(),message:'暂时无法获取模型列表，可继续手动填写。'});
        } finally { if (generation === current) { controller = null; onChange(id); } }
      }, delay);
    }
    return { schedule, cancel, forget: id => { if (active?.id === id) cancel(); records.delete(id); },
      get: id => { const r = records.get(id) || waiting(); return { status:r.status, models:[...r.models], message:r.message }; } };
  }
  return { create };
})();
if (typeof module !== 'undefined') module.exports = ApiModelDiscovery;
