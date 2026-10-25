/* Per-note write queues and crash-recoverable drafts. No editor/DOM dependencies. */
"use strict";
const NoteDraftStore = (() => {
  const prefix = 'lithub-note-draft:';
  const same = (a, b) => a.title === b.title && a.content === b.content && !!a.pinned === !!b.pinned;
  const fields = n => ({ title: n.title === '未命名笔记' ? '' : (n.title || ''), content: n.content || '', pinned: !!n.pinned });
  function create({ storage, save }) {
    const entries = new Map();
    let clock = 0;
    const key = (p, n) => `${prefix}${p}:${n}`;
    function persist(e) {
      try {
        storage.setItem(e.key, JSON.stringify(e.data));
        e.storageError = false;
      } catch { e.storageError = true; }
    }
    function open(paperId, note, refreshAt = null) {
      const k = key(paperId, note.id);
      let e = entries.get(k);
      if (e) {
        // A list cached by the UI may predate a completed background save.
        // Only an explicitly fresh GET may replace a clean entry, and never after a newer local edit/write.
        if (refreshAt !== null && e.changedAt <= refreshAt && !e.dirty && !e.pending) {
          e.server = note; e.data = fields(note);
        }
        return e;
      }
      let draft;
      try {
        const value = JSON.parse(storage.getItem(k));
        if (value && typeof value.title === 'string' && typeof value.content === 'string') draft = fields(value);
      } catch {}
      e = { key:k, paperId, id:note.id, data:draft || fields(note), server:note, rev:0,
        dirty:!!draft && !same(draft, fields(note)), recovered:!!draft, pending:null, deleted:false, error:null, changedAt:++clock };
      entries.set(k, e);
      return e;
    }
    function change(e, value) {
      if (!e || e.deleted) return;
      const next = fields(value);
      if (same(e.data, next)) return;
      e.data = next; e.rev++; e.dirty = true; e.error = null;
      e.changedAt = ++clock;
      persist(e);
    }
    function enqueue(e) {
      if (!e || e.deleted) return Promise.resolve({ ok:false });
      if (!e.dirty) return e.pending || Promise.resolve({ ok:true, note:e.server });
      const rev = e.rev, snapshot = { ...e.data };
      if (e.queuedRev === rev && e.pending) return e.pending;
      e.queuedRev = rev;
      const operation = (e.pending || Promise.resolve()).then(async () => {
        if (e.deleted) return { ok:false };
        try {
          const note = await save(e.paperId, e.id, snapshot);
          e.server = note; e.error = null;
          e.changedAt = ++clock;
          if (e.rev === rev) {
            e.dirty = false;
            try { storage.removeItem(e.key); } catch {}
          }
          return { ok:true, note };
        } catch (error) {
          e.error = error;
          persist(e);
          return { ok:false, error };
        }
      });
      e.pending = operation;
      operation.finally(() => { if (e.pending === operation) { e.pending = null; e.queuedRev = null; } });
      return operation;
    }
    function discard(e) {
      if (!e) return;
      e.deleted = true; entries.delete(e.key);
      try { storage.removeItem(e.key); } catch {}
    }
    async function flushAll() {
      const results = await Promise.all([...entries.values()].filter(e=>!e.deleted).map(enqueue));
      return results.every(r=>r.ok) && [...entries.values()].every(e=>!e.dirty && !e.pending);
    }
    return { open, change, save:enqueue, flushAll, discard, version:()=>clock, get:(p,n)=>entries.get(key(p,n)) };
  }
  return { create };
})();
