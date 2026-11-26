/* ============================================================
 * LitHub · sidecar API 适配层
 * sidecar 未启动时 live=false，前端保持演示模式（mock 数据）
 * ============================================================ */

"use strict";

/* sidecar 托管前端时用同源地址（端口可配，如 LITHUB_API_PORT）；
   从 file:// 或独立静态服务器打开时才回退到固定 8130 */
const API_BASE = location.protocol.startsWith("http") ? location.origin : "http://127.0.0.1:8130";

window.LithubAPI = {
  live: false,

  async pdfStorage() {
    const response = await fetch(`${API_BASE}/api/settings/pdf-storage`);
    if (!response.ok) throw new Error("读取 PDF 存储设置失败");
    return response.json();
  },

  async setPdfStorage(directory) {
    const response = await fetch(`${API_BASE}/api/settings/pdf-storage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "切换 PDF 存储目录失败");
    return result;
  },

  async ping() {
    try {
      const r = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(2500) });
      this.live = (await r.json()).ok === true;
    } catch {
      this.live = false;
    }
    return this.live;
  },

  async papers() {
    const r = await fetch(`${API_BASE}/api/papers`);
    if (!r.ok) throw new Error("获取文献列表失败");
    return r.json();
  },

  async importFile(file, cat = "local", autoTitle = true, onProgress) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("cat", cat);
    fd.append("auto_title", String(autoTitle));
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();xhr.open('POST',`${API_BASE}/api/import`);
      xhr.responseType='json';
      xhr.upload.onprogress=e=>onProgress?.({loaded:e.loaded,total:e.lengthComputable?e.total:null,processing:false});
      xhr.upload.onload=()=>onProgress?.({loaded:file.size,total:file.size,processing:true});
      xhr.onload=()=>{
        if(xhr.status>=200&&xhr.status<300)resolve(xhr.response);
        else reject(new Error(xhr.response?.detail||'导入失败'));
      };
      xhr.onerror=()=>reject(new Error('上传失败，请检查本地服务连接'));
      xhr.onabort=()=>reject(new Error('上传已取消'));
      xhr.send(fd);
    });
  },

  async translate(paperId, retranslate = false) {
    const r = await fetch(`${API_BASE}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper_id: paperId, retranslate }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "发起翻译失败");
    return r.json();
  },

  async tasks() {
    const r = await fetch(`${API_BASE}/api/tasks`);
    if (!r.ok) throw new Error("获取任务失败");
    return r.json();
  },

  async cancelTranslation(taskId) {
    const r = await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(taskId)}/cancel`, { method: "POST" });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "取消翻译失败");
    return r.json();
  },

  async updatePaper(id, fields) {
    const r = await fetch(`${API_BASE}/api/papers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "更新失败");
    return r.json();
  },

  async deletePaper(id) {
    const r = await fetch(`${API_BASE}/api/papers/${id}`, { method: "DELETE" });
    if (!r.ok) throw new Error("删除失败");
    return r.json();
  },

  async fulltextSearch(q) {
    const r = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`);
    if (!r.ok) return [];
    return r.json();
  },

  /* ---------- 分类 ---------- */

  async categories() {
    const r = await fetch(`${API_BASE}/api/categories`);
    if (!r.ok) throw new Error("获取分类失败");
    return r.json();
  },

  async createCategory(name, parent = null) {
    const r = await fetch(`${API_BASE}/api/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "创建失败");
    return r.json();
  },

  async updateCategory(id, fields = {}) {
    const r = await fetch(`${API_BASE}/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "更新失败");
    return r.json();
  },

  async deleteCategory(id) {
    const r = await fetch(`${API_BASE}/api/categories/${id}`, { method: "DELETE" });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "删除失败");
    return r.json();
  },

  async saveSettings(fields) {
    const r = await fetch(`${API_BASE}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!r.ok) { const body = await r.json().catch(()=>({})); throw new Error(typeof body.detail === 'string' ? body.detail : '保存设置失败，请检查 API 配置'); }
    return r.json();
  },

  /* 服务端配置（api_key 只有掩码 + has_key，明文不出 sidecar） */
  async settings() {
    const r = await fetch(`${API_BASE}/api/settings`);
    if (!r.ok) throw new Error("获取设置失败");
    return r.json();
  },

  /* 测试连接：传入界面当前填写的草稿（base_url / api_key / model），
     不传则后端回落到已保存配置。这样未保存的改动也能测到。 */
  async testSettings(draft = {}) {
    const r = await fetch(`${API_BASE}/api/settings/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "连接失败");
    return r.json();
  },

  async discoverModels(draft, { signal } = {}) {
    const r = await fetch(`${API_BASE}/api/settings/models`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(draft), signal,
    });
    if (!r.ok) throw new Error('暂时无法获取模型列表');
    return r.json();
  },

  /* ---------- 提示词模板 ---------- */

  async prompts() {
    const r = await fetch(`${API_BASE}/api/prompts`);
    if (!r.ok) throw new Error("获取提示词失败");
    return r.json();
  },

  async createPrompt(p) {
    const r = await fetch(`${API_BASE}/api/prompts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!r.ok) throw new Error("创建模板失败");
    return r.json();
  },

  async updatePrompt(id, p) {
    const r = await fetch(`${API_BASE}/api/prompts/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!r.ok) throw new Error("保存模板失败");
    return r.json();
  },

  async deletePrompt(id) {
    const r = await fetch(`${API_BASE}/api/prompts/${id}`, { method: "DELETE" });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "删除失败");
    return r.json();
  },

  /* ---------- 文献导出与复制 ---------- */

  /* 导出「可粘贴给网页 AI」的全文纯文本（默认不限页数，后端已去噪） */
  async exportPaperText(paperId, { maxPages = 0, maxChars = 0 } = {}) {
    const q = new URLSearchParams();
    if (maxPages) q.set("max_pages", String(maxPages));
    if (maxChars) q.set("max_chars", String(maxChars));
    const r = await fetch(`${API_BASE}/api/papers/${paperId}/export-text?${q}`);
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "导出失败");
    return r.json();
  },

  /* 把 PDF 文件本身放进系统剪贴板（CF_HDROP）。成功后用户可在网页 AI 里 Ctrl+V 直接上传。
     注意：这里**只复制，不下载**——不要再加「失败就另存文件」的兜底。 */
  async copyPaperFile(paperId, kind = "original") {
    const r = await fetch(`${API_BASE}/api/papers/${paperId}/copy-file?kind=${encodeURIComponent(kind)}`, {
      method: "POST",
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "复制失败");
    return r.json();
  },

  /* ---------- Markdown 笔记 ---------- */

  async notes(paperId) {
    const r = await fetch(`${API_BASE}/api/papers/${paperId}/notes`);
    if (!r.ok) throw new Error("获取笔记失败");
    return r.json();
  },

  async importNote(paperId, file) {
    const data=new FormData();data.append('file',file);
    const response=await fetch(`${API_BASE}/api/papers/${encodeURIComponent(paperId)}/notes/import`,{method:'POST',body:data});
    const result=await response.json();if(!response.ok)throw new Error(result.detail||'导入笔记失败');return result;
  },
  async createNote(paperId, { title = "", content = "" } = {}) {
    const r = await fetch(`${API_BASE}/api/papers/${paperId}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "创建笔记失败");
    return r.json();
  },

  async updateNote(paperId, noteId, { title, content, pinned }) {
    const r = await fetch(`${API_BASE}/api/papers/${paperId}/notes/${noteId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, pinned }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "保存笔记失败");
    return r.json();
  },

  async deleteNote(paperId, noteId) {
    const r = await fetch(`${API_BASE}/api/papers/${paperId}/notes/${noteId}`, { method: "DELETE" });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "删除笔记失败");
    return r.json();
  },

  async restoreNote(paperId, noteId) {
    const r = await fetch(`${API_BASE}/api/papers/${paperId}/notes/${noteId}/restore`, { method:'POST' });
    const result = await r.json();
    if (!r.ok) throw new Error(result.detail || '恢复失败');
    return result;
  },

  async exportNote(paperId, noteId) {
    const r = await fetch(`${API_BASE}/api/papers/${paperId}/notes/${noteId}/export`);
    if (!r.ok) throw new Error((await r.json().catch(()=>({}))).detail || '导出失败');
    return r.blob();
  },

  async uploadNoteImage(blob, filename = "image.png", signal) {
    const fd = new FormData();
    fd.append("file", blob, filename);
    const r = await fetch(`${API_BASE}/api/notes/image`, { method: "POST", body: fd, signal });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "图片上传失败");
    return r.json();
  },

  /* ---------- PDF 批注 ---------- */

  async annotations(paperId, view) {
    const r = await fetch(`${API_BASE}/api/papers/${paperId}/annotations${view ? `?view=${encodeURIComponent(view)}` : ""}`);
    if (!r.ok) throw new Error("获取批注失败");
    return r.json();
  },

  async createAnnotation(paperId, data) {
    const r = await fetch(`${API_BASE}/api/papers/${paperId}/annotations`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "创建批注失败");
    return r.json();
  },

  async updateAnnotation(paperId, annId, fields) {
    const r = await fetch(`${API_BASE}/api/papers/${paperId}/annotations/${annId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "更新批注失败");
    return r.json();
  },

  async deleteAnnotation(paperId, annId) {
    const r = await fetch(`${API_BASE}/api/papers/${paperId}/annotations/${annId}`, { method: "DELETE" });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || "删除批注失败");
    return r.json();
  },

  async restoreAnnotation(paperId, annId) {
    const r = await fetch(`${API_BASE}/api/papers/${paperId}/annotations/${annId}/restore`, {method:"POST"});
    if (!r.ok) throw new Error((await r.json().catch(()=>({}))).detail || "撤销失败");
    return r.json();
  },
};
