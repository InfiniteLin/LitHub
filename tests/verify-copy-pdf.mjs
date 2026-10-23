/* 验证「复制 PDF」真的只是复制，不是下载。
   覆盖：
     1) 面板头的按钮点下去后，剪贴板出现 CF_HDROP（文件拖放格式），且不是文本
     2) 后台（sidecar）没有向下载文件夹写入任何文件
     3) 剪贴板里的文件名是论文标题，不是内部 ID
   用法：先启动应用（--remote-debugging-port=9333），再 node tests/verify-copy-pdf.mjs
*/
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.argv[2] || 9333);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = tabs.find((t) => t.type === "page");
if (!page) throw new Error("no page target");

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
await new Promise((r) => (ws.onopen = r));

function send(method, params = {}) {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((res, rej) => {
    pending.set(mid, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(method + " timeout")); } }, 20000);
  });
}
async function evalJS(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

/* ---------- 读剪贴板（CF_HDROP）---------- */
const READER = path.join(os.tmpdir(), "lithub-clip-read.py");
const readerSrc = String.raw`
import ctypes, json, sys
u = ctypes.windll.user32; k = ctypes.windll.kernel32
u.OpenClipboard.argtypes=[ctypes.c_void_p]; u.OpenClipboard.restype=ctypes.c_int
u.GetClipboardData.argtypes=[ctypes.c_uint]; u.GetClipboardData.restype=ctypes.c_void_p
u.CloseClipboard.restype=ctypes.c_int
u.IsClipboardFormatAvailable.argtypes=[ctypes.c_uint]; u.IsClipboardFormatAvailable.restype=ctypes.c_int
k.GlobalLock.argtypes=[ctypes.c_void_p]; k.GlobalLock.restype=ctypes.c_void_p
k.GlobalUnlock.argtypes=[ctypes.c_void_p]; k.GlobalUnlock.restype=ctypes.c_int
k.GlobalSize.argtypes=[ctypes.c_void_p]; k.GlobalSize.restype=ctypes.c_size_t
# shell32.DragQueryFileW 是「剪贴板里的文件」被资源管理器/浏览器真正解析的入口，
# 用它读一遍能确认我们写的 DROPFILES 结构合法（不只是字节看起来对）
s = ctypes.windll.shell32
s.DragQueryFileW.argtypes=[ctypes.c_void_p, ctypes.c_uint, ctypes.c_wchar_p, ctypes.c_uint]
s.DragQueryFileW.restype=ctypes.c_uint
out = {"hdrop": False, "text": False, "files": [], "drag_count": 0, "drag_files": []}
if u.OpenClipboard(None):
    try:
        out["hdrop"] = bool(u.IsClipboardFormatAvailable(15))
        out["text"] = bool(u.IsClipboardFormatAvailable(13))
        if out["hdrop"]:
            h = u.GetClipboardData(15)
            if h:
                out["drag_count"] = int(s.DragQueryFileW(h, 0xFFFFFFFF, None, 0))
                for i in range(out["drag_count"]):
                    n = s.DragQueryFileW(h, i, None, 0)
                    buf = ctypes.create_unicode_buffer(n + 1)
                    s.DragQueryFileW(h, i, buf, n + 1)
                    out["drag_files"].append(buf.value)
                ptr = k.GlobalLock(h)
                if ptr:
                    size = k.GlobalSize(h)
                    p_files = ctypes.c_uint32.from_address(ptr).value
                    f_wide = ctypes.c_int.from_address(ptr+16).value
                    # 只读到这个内存块真正的大小，越界读会 access violation
                    n = max(0, min(size - p_files, 1 << 20))
                    raw = ctypes.string_at(ptr + p_files, n) if n else b""
                    if f_wide:
                        cur, i = [], 0
                        while i + 1 < len(raw):
                            unit = raw[i:i+2]; i += 2
                            if unit == b"\x00\x00":
                                if not cur: break
                                out["files"].append(b"".join(cur).decode("utf-16-le")); cur = []
                            else:
                                cur.append(unit)
                    k.GlobalUnlock(h)
    finally:
        u.CloseClipboard()
print(json.dumps(out, ensure_ascii=False))
`;
import { writeFileSync } from "node:fs";
writeFileSync(READER, readerSrc, "utf8");

function readClipboard() {
  const out = execFileSync("python", [READER], { encoding: "utf8", timeout: 20000 });
  return JSON.parse(out.trim().split(/\r?\n/).pop());
}

/* 用 Python 把剪贴板改写成纯文本探针：Electron 渲染进程的 navigator.clipboard
   在没有焦点时不可靠（要用它就还得管窗口焦点，跟被测行为无关）。*/
const SETTER = path.join(os.tmpdir(), "lithub-clip-set.py");
writeFileSync(SETTER, String.raw`
import ctypes
u = ctypes.windll.user32; k = ctypes.windll.kernel32
u.OpenClipboard.argtypes=[ctypes.c_void_p]; u.OpenClipboard.restype=ctypes.c_int
u.EmptyClipboard.restype=ctypes.c_int
u.SetClipboardData.argtypes=[ctypes.c_uint, ctypes.c_void_p]
u.SetClipboardData.restype=ctypes.c_void_p
u.CloseClipboard.restype=ctypes.c_int
k.GlobalAlloc.argtypes=[ctypes.c_uint, ctypes.c_size_t]
k.GlobalAlloc.restype=ctypes.c_void_p
k.GlobalLock.argtypes=[ctypes.c_void_p]; k.GlobalLock.restype=ctypes.c_void_p
k.GlobalUnlock.argtypes=[ctypes.c_void_p]; k.GlobalUnlock.restype=ctypes.c_int
data = "LITHUB-CLIP-PROBE".encode("utf-16-le") + b"\x00\x00"
h = k.GlobalAlloc(0x0002, len(data))
p = k.GlobalLock(h)
ctypes.memmove(p, data, len(data))
k.GlobalUnlock(h)
if u.OpenClipboard(None):
    u.EmptyClipboard()
    u.SetClipboardData(13, h)
    u.CloseClipboard()
`, "utf8");
function setClipboardProbe() {
  execFileSync("python", [SETTER], { encoding: "utf8", timeout: 20000 });
}

function listDownloads() {
  const dir = path.join(os.homedir(), "Downloads");
  try {
    return execFileSync("powershell", ["-NoProfile", "-Command",
      `Get-ChildItem -LiteralPath '${dir}' -Filter *.pdf -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name`],
      { encoding: "utf8", timeout: 20000 }).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
}

/* ---------- 进入某篇文献 + 打开网页 AI 面板 ---------- */
const paperId = await evalJS(`(async () => {
  const list = await LithubAPI.papers();
  const p = list.find(x => (x.orig_name || "").includes("AgentPoison")) || list.find(x => x.pages > 5) || list[0];
  return p ? p.id : null;
})()`);
check("找到可测试的文献", !!paperId, paperId || "无");

await evalJS(`(async () => {
  const list = await LithubAPI.papers();
  state.db.papers = list;
  const p = list.find(x => x.id === ${JSON.stringify(paperId)});
  location.hash = "#/reader/" + p.id;
  return true;
})()`);
await sleep(1200);

// 直接把面板显示出来（不依赖真实浏览器嵌入，验证的是复制动作本身）
await evalJS(`(() => { state.reader.webAi = true; renderReader(${JSON.stringify(paperId)}); return true; })()`);
await sleep(900);

const hasBtn = await evalJS(`!!document.querySelector('[data-action="webai-copy-pdf"]')`);
check("面板头出现「复制 PDF」按钮", hasBtn);

/* ---------- 点它 ---------- */
const before = listDownloads();

// 先清空剪贴板，确保读到的是这次写入的（用文本占位，随后应被 CF_HDROP 顶掉）
setClipboardProbe();
await sleep(400);
const probe = readClipboard();
check("清空后剪贴板先只有文本（探针）", probe.text && !probe.hdrop, JSON.stringify(probe));

await evalJS(`document.querySelector('[data-action="webai-copy-pdf"]').click(), true`);
await sleep(2500);

const after = readClipboard();
const toastText = await evalJS(`(document.querySelector('#toast-root .toast span') || {}).textContent || ""`);

check("剪贴板里出现文件（CF_HDROP）", after.hdrop === true, JSON.stringify(after.files));
check("DragQueryFile 能解析出 1 个文件（DROPFILES 结构合法）",
  after.drag_count === 1 && after.drag_files.length === 1, JSON.stringify(after.drag_files));
check("剪贴板里是 1 个 PDF", after.files.length === 1 && /\.pdf$/i.test(after.files[0] || ""), (after.files[0] || "").split(/[\\/]/).pop());
check("文件名是论文标题而非内部 ID", /^AgentPoison/i.test(path.basename(after.files[0] || "")),
  path.basename(after.files[0] || ""));
check("剪贴板不再是被探针文本占着（真的写入了文件格式）", after.hdrop === true && !after.text, JSON.stringify({ hdrop: after.hdrop, text: after.text }));
check("文件确实存在且大小合理", (() => {
  try { return readFileSync(after.files[0]).length > 1000; } catch { return false; }
})());

const added = listDownloads().filter((n) => !before.includes(n));
check("没有往下载文件夹写文件", added.length === 0, added.length ? "新增：" + added.join(", ") : "无新增");

check("提示是「已复制」而不是「已另存」", /已复制/.test(toastText) && !/另存|下载文件夹/.test(toastText), toastText);

/* ---------- 失败路径：文件缺失时必须报错、不落盘 ---------- */
const failDir = path.join(os.homedir(), "Downloads");
const beforeFail = listDownloads();
const failResp = await evalJS(`(async () => {
  try {
    const r = await fetch("http://127.0.0.1:8130/api/papers/__no_such__/copy-file", { method: "POST" });
    return { status: r.status, body: await r.text() };
  } catch (e) { return { status: 0, body: String(e) }; }
})()`);
await sleep(600);
check("文件缺失时返回 4xx（不静默降级）", failResp.status >= 400 && failResp.status < 500, `status=${failResp.status}`);
const addedFail = listDownloads().filter((n) => !beforeFail.includes(n));
check("失败时也没有写下载文件夹", addedFail.length === 0, addedFail.join(", ") || "无新增");

console.log("\n" + (results.every((r) => r.ok) ? "全部通过" : "存在失败项"));
ws.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
