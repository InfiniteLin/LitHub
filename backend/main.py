"""文枢 LitHub · 本地 sidecar API

文献导入 / 翻译任务队列（pdf2zh 子进程）/ 译文文件服务。
前端（Electron 或浏览器）经 HTTP 调用；CORS 仅放行本地已知来源。
"""

import asyncio
import hashlib
import contextlib
import os
import sys
import tempfile
import threading
import uuid
from pathlib import Path
from urllib.parse import quote
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pypdf import PdfReader
from paper_title import clean_title, detect_title
from paper_authors import detect_authors
from note_export import export_note, export_name

from store import store
from paths import DATA_DIR, FRONTEND_DIR
import translate
import search_index
import clipboard_file
from browser_session import BrowserSession

try:
    import browser_embed
except Exception:  # 非 Windows / 缺依赖时不影响其它接口
    browser_embed = None

SERVICE_VERSION = "0.2.1"


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    """启动时后台重建全文索引（自愈，不阻塞启动）；退出时稳妥关闭 SQLite 连接。"""
    import threading

    def _rebuild():
        try:
            n = search_index.rebuild(store.list_papers(), store.paper_file)
            print(f"[main] 全文索引就绪：{n} 篇", flush=True)
        except Exception as exc:
            print(f"[main] 全文索引重建失败：{exc}", flush=True)

    threading.Thread(target=_rebuild, daemon=True).start()
    yield
    try:
        _browser_session.shutdown()
    finally:
        search_index.close()


app = FastAPI(title="LitHub Sidecar", version=SERVICE_VERSION, lifespan=lifespan)

# 仅放行本地前端来源：Electron（同源 8130）、浏览器开发端口、file:// 回退场景
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:8130",
        "http://127.0.0.1:8130",
        "null",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"ok": True, "service": "lithub-sidecar", "version": SERVICE_VERSION}


# ---------- 文献 ----------

@app.get("/api/papers")
def papers():
    # 附带笔记数量，前端列表/附件树可直接展示，避免逐篇再请求
    items = store.list_papers()
    for p in items:
        p["note_count"] = len(store.list_notes(p["id"]))
    return items


@app.post("/api/import")
async def import_pdf(file: UploadFile = File(...), cat: str = Form("local"), auto_title: bool = Form(True)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "仅支持 PDF 文件")
    data = await file.read()
    if not data:
        raise HTTPException(400, "空文件")

    # 分类校验：未知分类回退到「本地文献」
    if cat != "local" and not any(c["id"] == cat for c in store.list_categories()):
        cat = "local"

    digest = hashlib.sha256(data).hexdigest()
    existing = store.find_paper_by_hash(digest)
    if existing:
        raise HTTPException(409, f"该文件已导入过：《{existing['title']}》")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)

    try:
        reader = PdfReader(str(tmp_path))
        pages = len(reader.pages)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(400, "无法解析的 PDF 文件")

    try:
        title = await asyncio.to_thread(detect_title, tmp_path, file.filename) if auto_title else None
        authors = await asyncio.to_thread(detect_authors, tmp_path, file.filename)
        paper = store.add_paper(tmp_path, file.filename, pages, title, digest, cat, authors=authors)
    finally:
        tmp_path.unlink(missing_ok=True)
    # 全文索引：提取旁车 txt 并入 FTS（翻译完成后中文译文会在重建时补充索引）
    try:
        await asyncio.to_thread(search_index.index_paper, paper["id"], store.paper_file(paper["id"]), "en")
    except Exception:
        pass
    return paper


def _out_artifact(pid: str, kind: str) -> Path | None:
    """在产物目录里找指定类型的 pdf2zh 输出（mono 译文 / dual 双联）。

    扫描版等场景下 pdf2zh 可能产出的文件名与预期不同，因此：
    先按 *<kind>*.pdf 匹配，再退化为「同目录下唯一的 pdf 且非该类型」的兜底。
    """
    d = store.output_dir / pid
    if not d.is_dir():
        return None
    c = sorted(d.glob(f"*{kind}*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
    return c[0] if c else None


def _resolve_translated(pid: str, paper: dict) -> Path | None:
    stored = paper.get("translated_file")
    if stored and Path(stored).exists():
        return Path(stored)
    return _out_artifact(pid, "mono")


def build_compare_pdf(pid: str, en: Path, zh: Path) -> Path:
    """合成左右并排对照版：每页 = 左原文 · 右译文。

    为什么不用 pdf2zh 自带的 *-dual.pdf：
      babeldoc 的 TranslationConfig 有个向后兼容分支 ——
        if use_side_by_side_dual is False and use_alternating_pages_dual is False:
            self.use_alternating_pages_dual = True
      而 pdf2zh 的 CLI 构造 YadtConfig 时两者都不传，于是实际产出的是
      **原文页/译文页交替**（页数翻倍），并不是左右对照。
      这里按 babeldoc 的 create_side_by_side_dual_pdf 同样逻辑自行合成，
      好处是历史译文无需重跑翻译即可立刻获得对照视图。

    结果缓存在 out/<pid>/<pid>-compare.pdf；原文或译文更新（mtime）后自动重建。
    """
    import pymupdf

    out_dir = store.output_dir / pid
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{pid}-compare.pdf"

    # 缓存有效性：比两份源文件都新
    try:
        if target.exists() and target.stat().st_mtime >= max(en.stat().st_mtime, zh.stat().st_mtime):
            return target
    except OSError:
        pass

    src_en, src_zh = pymupdf.open(str(en)), pymupdf.open(str(zh))
    try:
        dual = pymupdf.open()
        n = min(src_en.page_count, src_zh.page_count)
        for i in range(n):
            left, right = src_en[i], src_zh[i]
            total_w = left.rect.width + right.rect.width
            max_h = max(left.rect.height, right.rect.height)
            page = dual.new_page(width=total_w, height=max_h)
            page.show_pdf_page(pymupdf.Rect(0, 0, left.rect.width, max_h), src_en, i, keep_proportion=True)
            page.show_pdf_page(pymupdf.Rect(left.rect.width, 0, total_w, max_h), src_zh, i, keep_proportion=True)
        # 先写临时文件再替换，避免并发请求读到半成品。
        # 实测：合成 22 页 74ms、保存 39ms；garbage=4/clean=True 在含重复对象时
        # 会触发 MuPDF "object out of range" 错误，因此用保守且稳定的 garbage=3。
        tmp = target.with_suffix(".pdf.tmp")
        dual.save(str(tmp), garbage=3, deflate=True)
        dual.close()
        os.replace(tmp, target)
    finally:
        src_en.close()
        src_zh.close()
    return target


@app.get("/api/papers/{pid}/file")
def paper_file(pid: str, kind: str = "original"):
    paper = store.get_paper(pid)
    if not paper:
        raise HTTPException(404, "文献不存在")
    if kind == "translated":
        path = _resolve_translated(pid, paper)
        if not path:
            raise HTTPException(404, "译文尚未生成")
    elif kind == "compare":
        # 左右并排对照版（动态合成，兼容历史译文）
        zh = _resolve_translated(pid, paper)
        if not zh:
            raise HTTPException(404, "译文尚未生成，无法生成对照版")
        en = store.paper_file(pid)
        if not en.exists():
            raise HTTPException(404, "原文缺失")
        try:
            path = build_compare_pdf(pid, en, zh)
        except Exception as exc:
            raise HTTPException(500, f"对照版生成失败：{exc}")
    elif kind == "dual":
        # pdf2zh 原生双联产物（交替页）：优先取任务记录的路径，旧记录回退到产物目录查找
        path = None
        stored = paper.get("translated_dual_file")
        if stored and Path(stored).exists():
            path = Path(stored)
        else:
            path = _out_artifact(pid, "dual")
        if not path:
            raise HTTPException(404, "双联对照版尚未生成")
    else:
        path = store.paper_file(pid)
    if not path or not path.exists():
        raise HTTPException(404, "文件缺失")
    suffix = {"translated": "-译文", "compare": "-双语对照"}.get(kind, "")
    return FileResponse(path, media_type="application/pdf", filename=_safe_file_stem(paper.get("title")) + suffix + ".pdf")


class PaperUpdateBody(BaseModel):
    title: str | None = None
    fav: bool | None = None
    tags: list[str] | None = None
    cat: str | None = None


@app.get("/api/papers/{pid}/export-text")
def export_paper_text(pid: str, max_pages: int = 0, max_chars: int = 0):
    """导出「可粘贴给网页 AI」的全文纯文本。

    与 /api/summaries 内部用的 4 页/8000 字节选不同，这里默认不限量，
    但仍做去噪（合并硬换行、剔除页眉页码），避免碎行浪费 token。
    max_pages / max_chars 传 0 表示不限制。"""
    paper = store.get_paper(pid)
    if not paper:
        raise HTTPException(404, "文献不存在")
    src = store.paper_file(pid)
    if not src.exists():
        raise HTTPException(404, "原文缺失")
    text = _extract_text_clean(src, max_pages=max_pages, max_chars=max_chars)
    if not text:
        raise HTTPException(400, "无法从该 PDF 提取文本（可能是扫描版）")
    return {
        "paper_id": pid,
        "title": paper.get("title") or "",
        "authors": paper.get("authors") or "",
        "venue": paper.get("venue") or "",
        "year": paper.get("year"),
        "pages": paper.get("pages"),
        "chars": len(text),
        "text": text,
    }


def _safe_file_stem(title: str) -> str:
    """把论文标题变成对文件系统安全的文件名主干（不含扩展名）。"""
    import re

    base = (title or "paper").strip()
    base = re.sub(r"[\\/:*?\"<>|\r\n\t]", " ", base)
    base = re.sub(r"\s+", " ", base).strip().strip(".")
    if len(base) > 80:
        base = base[:80].rstrip()
    return base or "paper"


def _stage_for_clipboard(src: Path, paper: dict) -> Path:
    """给剪贴板准备一份「名字好看」的临时副本。

    CF_HDROP 只能引用磁盘上真实存在的文件，所以粘贴时附件名就是文件名。
    库里的文件名是内部 ID（9091beec169d.pdf），直接复制过去用户会看到一串乱码
    似的 ID。这里复制到系统临时目录、用论文标题命名，粘贴时就是正常标题。
    只在临时目录里操作，不碰用户的下载文件夹。
    """
    import shutil
    import tempfile

    stage_dir = Path(tempfile.gettempdir()) / "lithub-clip"
    try:
        stage_dir.mkdir(parents=True, exist_ok=True)
        dest = stage_dir / (_safe_file_stem(paper.get("title")) + ".pdf")
        if dest.resolve() != src.resolve():
            shutil.copyfile(src, dest)
        # 顺手清理一小时前的旧副本。**不能**立刻删上一次的副本：
        # 剪贴板只持有路径、不持有内容，删早了用户按 Ctrl+V 会粘到空附件
        _prune_stage_dir(stage_dir, keep=dest)
        return dest
    except Exception:
        # 临时副本失败不影响主流程：退回用库里的原始文件路径
        return src


def _prune_stage_dir(stage_dir: Path, keep: Path | None = None) -> None:
    """清掉**过期**的临时副本（1 小时前的）。

    为什么要留一段时间而不是「复制下一份时全删」：剪贴板里的 CF_HDROP 只是引用
    磁盘路径，不持有文件内容。如果刚复制完 A 就立刻删掉 A，用户还没来得及按
    Ctrl+V，粘出来就会是个空附件。所以按时间清，不按次数清。
    """
    import time

    try:
        cutoff = time.time() - 3600
        for old in stage_dir.glob("*.pdf"):
            if keep is not None and old.name == keep.name:
                continue
            try:
                if old.stat().st_mtime < cutoff:
                    old.unlink()
            except OSError:
                pass
    except Exception:
        pass


@app.post("/api/papers/{pid}/copy-file")
def copy_paper_file(pid: str, kind: str = "original"):
    """把文献 PDF **文件本身**放进系统剪贴板（CF_HDROP），
    用户可直接在网页版 AI 的对话框里 Ctrl+V 上传，无需先另存。
    与资源管理器里对文件按 Ctrl+C 的效果一致。

    注意：这个接口**只写剪贴板**。失败就报错，绝不在失败时另存文件 ——
    用户点的是「复制」，不是「下载」。"""
    paper = store.get_paper(pid)
    if not paper:
        raise HTTPException(404, "文献不存在")
    if kind == "translated":
        path = _resolve_translated(pid, paper)
        if not path:
            raise HTTPException(404, "译文尚未生成")
    else:
        path = store.paper_file(pid)
    if not path or not path.exists():
        raise HTTPException(404, "文件缺失")
    staged = _stage_for_clipboard(path, paper)
    ok, err = clipboard_file.copy_files_to_clipboard([staged])
    if not ok:
        raise HTTPException(400, err or "复制文件到剪贴板失败")
    return {
        "ok": True,
        "name": staged.name,
        "size": path.stat().st_size,
        "kind": kind,
    }


@app.patch("/api/papers/{pid}")
def update_paper(pid: str, body: PaperUpdateBody):
    paper = store.get_paper(pid)
    if not paper:
        raise HTTPException(404, "文献不存在")
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if "title" in fields:
        title = clean_title(fields["title"])
        if not title or len(title) > 500:
            raise HTTPException(400, "文献名称不能为空，且不能超过 500 个字符")
        fields["title"] = title
    if "tags" in fields:
        # 规整：去空白、去重、限长限量
        clean: list[str] = []
        for t in fields["tags"]:
            t = str(t).strip()[:16]
            if t and t not in clean:
                clean.append(t)
            if len(clean) >= 12:
                break
        fields["tags"] = clean
    if fields:
        store.update_paper(pid, **fields)
    return store.get_paper(pid)


@app.delete("/api/papers/{pid}")
def delete_paper(pid: str):
    translate.cancel(pid)  # 若该文献正在翻译，终止其子进程
    if not store.delete_paper(pid):
        raise HTTPException(404, "文献不存在")
    search_index.remove_paper(pid)
    return {"ok": True}


# ---------- 全文检索 ----------

@app.get("/api/search")
def fulltext_search(q: str):
    return search_index.search(q[:64])


# ---------- 分类 ----------

class CategoryBody(BaseModel):
    name: str
    parent: str | None = None


class CategoryPatchBody(BaseModel):
    name: str | None = None
    parent: str | None = None


@app.get("/api/categories")
def categories():
    return store.list_categories()


@app.post("/api/categories")
def add_category(body: CategoryBody):
    if not body.name.strip():
        raise HTTPException(400, "分类名称不能为空")
    return store.add_category(body.name.strip(), body.parent)


@app.patch("/api/categories/{cid}")
def patch_category(cid: str, body: CategoryPatchBody):
    ok, msg, cat = store.update_category(cid, name=body.name, parent=body.parent)
    if not ok:
        raise HTTPException(400, msg)
    return cat


@app.delete("/api/categories/{cid}")
def delete_category(cid: str):
    ok, msg = store.delete_category(cid)
    if not ok:
        raise HTTPException(400, msg)
    return {"ok": True}


# ---------- 翻译任务 ----------

class TranslateBody(BaseModel):
    paper_id: str


@app.post("/api/translate")
def start_translation(body: TranslateBody):
    paper = store.get_paper(body.paper_id)
    if not paper:
        raise HTTPException(404, "文献不存在")
    if paper.get("translated"):
        raise HTTPException(400, "该文献已有译文")
    task = store.add_task(body.paper_id)
    translate.enqueue(task["id"])
    return task


@app.get("/api/tasks")
def tasks():
    return store.list_tasks()


# ---------- 设置 ----------

class PdfStorageBody(BaseModel):
    directory: str | None = None
    use_default: bool = False


@app.get("/api/settings/pdf-storage")
def get_pdf_storage():
    return store.pdf_storage_info()


@app.post("/api/settings/pdf-storage")
def set_pdf_storage(body: PdfStorageBody):
    if not body.use_default and not (body.directory or "").strip():
        raise HTTPException(400, "请选择 PDF 存储目录")
    try:
        return store.change_pdf_storage(None if body.use_default else body.directory.strip())
    except (ValueError, OSError) as exc:
        raise HTTPException(400, str(exc))

MASK_CHAR = "*"
MASK_PREFIX_LEN = 6   # 保留前 6 位做「是哪个 Key」的辨识，其余全遮


def _mask(key: str) -> str:
    """掩码与真实 Key **等长**（前 6 位明文 + 其余用 * 补足），
    这样输入框宽度/字符数与真实值一致，看起来就是一把真实 key。
    真实 Key 不会含 `*`，因此「含 * 即未修改」是可靠的判定。"""
    if not key:
        return ""
    keep = min(MASK_PREFIX_LEN, len(key))
    return key[:keep] + MASK_CHAR * (len(key) - keep)


def _is_mask(value: str) -> bool:
    return MASK_CHAR in (value or "")


def _public_settings(cfg: dict, key_map: dict | None = None) -> dict:
    """剥离明文 Key：当前 provider 的 Key 给掩码 + has_key，
    另外附上 keys 映射（provider -> 掩码/是否已配置），供前端切换服务商时回显。"""
    out = {k: v for k, v in cfg.items() if k not in ("api_key", "api_keys")}
    key = cfg.get("api_key") or ""
    out["has_key"] = bool(key)
    out["api_key"] = _mask(key)
    km = key_map if key_map is not None else {}
    out["keys"] = {prov: {"masked": _mask(v), "has_key": bool(v)} for prov, v in km.items() if v}
    return out


class SettingsBody(BaseModel):
    service: str | None = None
    provider: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    api_keys: dict[str, str] | None = None
    model: str | None = None
    target_lang: str | None = None
    web_ai_url: str | None = None
    web_ai_sites: list[dict] | None = None
    web_ai_export: str | None = None
    web_ai_max_pages: int | None = None
    web_ai_embed_mode: str | None = None
    web_ai_browser: str | None = None
    web_ai_browser_path: str | None = None


@app.get("/api/settings")
def get_settings():
    """对外配置快照：API Key 只返回掩码 + has_key 标记，明文永不离开 sidecar 进程。"""
    return _public_settings(store.get_settings(), store.get_api_key_map())


@app.post("/api/settings")
def set_settings(body: SettingsBody):
    raw = body.model_dump()
    fields = {k: v for k, v in raw.items() if v not in (None, "")}
    # 这几个字段的「空串」是有意义的值（= 清空 / 回到自动检测），不能被上面的过滤吃掉。
    # 只认前端**显式传过**的字段（model_fields_set），没传的不动，避免误清空。
    for k in ("web_ai_browser_path", "web_ai_browser"):
        if k in body.model_fields_set and raw.get(k) == "":
            fields[k] = ""
    # api_key 是掩码（未修改）时不覆盖真实值
    if _is_mask(fields.get("api_key", "")):
        fields.pop("api_key")
    # 整表里的掩码同样视为「不修改」；空串表示「删除该服务商的 Key」
    if isinstance(fields.get("api_keys"), dict):
        fields["api_keys"] = {
            p: v for p, v in fields["api_keys"].items()
            if not _is_mask(str(v or ""))
        }
    saved = store.set_settings(fields)
    return _public_settings(saved, store.get_api_key_map())


class TestConnectionBody(BaseModel):
    """测试连接用的草稿配置：前端直接把界面上填的值传进来，
    这样「刚切了服务商/改了 Base URL 或模型、还没保存」也能测到正确的目标。"""
    provider: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None


@app.post("/api/settings/test")
def test_settings(body: TestConnectionBody | None = None):
    """测试连接：用『界面当前填写值』优先，缺省回落到该 provider 已保存的配置。"""
    draft = body or TestConnectionBody()
    cfg = store.get_settings(draft.provider)
    key_map = store.get_api_key_map()

    base_url = (draft.base_url or "").strip() or cfg.get("base_url") or "https://api.deepseek.com/v1"
    model = (draft.model or "").strip() or cfg.get("model") or "deepseek-chat"

    # Key：界面填了明文就用它；填的是掩码/没填 → 用「该 provider 名下」已保存的 Key
    typed = (draft.api_key or "").strip()
    if typed and not _is_mask(typed):
        api_key = typed
    else:
        api_key = (key_map.get(draft.provider or cfg.get("provider") or "") or "").strip() \
            or (cfg.get("api_key") or "")
    if not api_key or _is_mask(api_key):
        raise HTTPException(400, "尚未配置 API Key，请在上方填写后再测试")

    import openai as openai_lib

    try:
        client = openai_lib.OpenAI(base_url=base_url, api_key=api_key, timeout=25)
        client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
        )
    except Exception as exc:
        raise HTTPException(400, f"连接失败：{exc}")
    return {"ok": True, "model": model, "base_url": base_url}


# ---------- 提示词模板 ----------

class PromptBody(BaseModel):
    name: str
    desc: str = ""
    content: str
    default: bool = False


@app.get("/api/prompts")
def list_prompts():
    return store.list_prompts()


@app.post("/api/prompts")
def create_prompt(body: PromptBody):
    return store.upsert_prompt(body.model_dump())


@app.put("/api/prompts/{pid}")
def update_prompt(pid: str, body: PromptBody):
    if not store.get_prompt(pid):
        raise HTTPException(404, "模板不存在")
    return store.upsert_prompt(body.model_dump(), pid)


@app.delete("/api/prompts/{pid}")
def remove_prompt(pid: str):
    if not store.delete_prompt(pid):
        raise HTTPException(400, "无法删除（不存在或至少需保留一个模板）")
    return {"ok": True}


# ---------- AI 总结（SSE 流式） ----------

def _clean_pdf_text(raw: str) -> str:
    """把 pypdf 抽出的原始文本收拾成可粘贴的连续段落：
    · 合并被 PDF 硬换行打断的句子（行尾不是句末标点就接上）
    · 去掉页眉页脚式的孤立短行、纯数字行、连字符断词
    · 压缩多余空行
    目标：粘给网页 AI 时不要满是碎行，那样既费 token 又影响理解。"""
    import re

    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u00ad", "")                      # 软连字符
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)           # hyphen 断词：inter-\nest → interest
    lines = [ln.strip() for ln in text.split("\n")]
    out, buf = [], ""
    for ln in lines:
        if not ln:
            if buf:
                out.append(buf)
                buf = ""
            continue
        # 孤立短行（页眉/页码/图表编号）：长度 < 4 或纯数字/罗马数字
        if len(ln) < 4 or re.fullmatch(r"[\divxlcIVXLC\.\-—–\s]{1,6}", ln):
            continue
        if buf:
            # 上一行没有以句末标点结束 → 视为同一段被硬换行打断
            if not re.search(r"[.。!?！？:：;；)\]】”\"']$", buf):
                buf = buf + (" " if re.match(r"[A-Za-z0-9]", ln) else "") + ln
                continue
            out.append(buf)
        buf = ln
    if buf:
        out.append(buf)
    result = "\n\n".join(out)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result.strip()


def _extract_text_clean(pdf_path: Path, max_pages: int = 0, max_chars: int = 0) -> str:
    """导出给网页 AI 用的全文抽取：默认不设页数/字数上限（0 = 不限），
    但会做 _clean_pdf_text 去噪，避免碎行浪费 token。"""
    try:
        reader = PdfReader(str(pdf_path))
        pages = reader.pages if not max_pages else reader.pages[:max_pages]
        parts, total = [], 0
        for page in pages:
            t = (page.extract_text() or "").strip()
            if not t:
                continue
            parts.append(t)
            total += len(t)
            if max_chars and total >= max_chars:
                break
        joined = "\n".join(parts)
        if max_chars:
            joined = joined[:max_chars]
        return _clean_pdf_text(joined)
    except Exception:
        return ""


def _extract_text(pdf_path: Path, max_pages: int = 4, max_chars: int = 8000) -> str:
    try:
        reader = PdfReader(str(pdf_path))
        parts, total = [], 0
        for page in reader.pages[:max_pages]:
            t = (page.extract_text() or "").strip()
            parts.append(t)
            total += len(t)
            if total >= max_chars:
                break
        return "\n".join(parts)[:max_chars]
    except Exception:
        return ""


def _render_prompt(template: str, paper: dict, content: str) -> str:
    return (template
            .replace("{{title}}", paper.get("title") or "未知标题")
            .replace("{{venue}}", f"{paper.get('venue') or ''} {paper.get('year') or ''}".strip() or "未知来源")
            .replace("{{lang}}", "简体中文")
            .replace("{{abstract}}", content or "（未能提取到正文文本）"))


class SummaryBody(BaseModel):
    paper_id: str
    prompt_id: str
    force: bool = False
    mode: str = "text"          # text | vision（视觉精读：逐页渲染成图随消息发送）


VISION_MAX_PAGES = 12
VISION_DPI = 130


def _render_page_images(pdf_path: Path, max_pages: int = VISION_MAX_PAGES,
                        dpi: int = VISION_DPI, quality: int = 80) -> list[str]:
    """PyMuPDF 逐页渲染 JPEG → base64 data URL（多模态消息用）"""
    import base64

    import fitz  # pymupdf

    urls = []
    doc = fitz.open(str(pdf_path))
    try:
        for page in doc.pages(0, min(doc.page_count, max_pages)):
            pix = page.get_pixmap(dpi=dpi)
            img = pix.tobytes("jpeg", jpg_quality=quality)
            urls.append("data:image/jpeg;base64," + base64.b64encode(img).decode())
    finally:
        doc.close()
    return urls


@app.post("/api/summaries")
def create_summary(body: SummaryBody):
    import json as _json
    import openai as openai_lib

    paper = store.get_paper(body.paper_id)
    if not paper:
        raise HTTPException(404, "文献不存在")
    prompt = store.get_prompt(body.prompt_id)
    if not prompt:
        raise HTTPException(404, "提示词模板不存在")

    cfg = store.get_settings()
    api_key = (cfg.get("api_key") or "").strip()
    if not api_key or _is_mask(api_key):
        raise HTTPException(400, "尚未配置 API Key，请到「设置 → AI 服务」填写")
    base_url = cfg.get("base_url") or "https://api.deepseek.com/v1"
    model = cfg.get("model") or "deepseek-chat"

    mode = body.mode if body.mode in ("text", "vision") else "text"
    text = _extract_text(store.paper_file(body.paper_id))
    if mode == "text" and not text.strip():
        raise HTTPException(400, "无法从该 PDF 提取文本（扫描版可在侧栏开启「视觉精读」）")

    page_images: list[str] = []
    if mode == "vision":
        try:
            page_images = _render_page_images(store.paper_file(body.paper_id))
        except Exception as exc:
            raise HTTPException(400, f"页面渲染失败：{exc}")
        if not page_images:
            raise HTTPException(400, "该 PDF 没有可渲染的页面")
        # 视觉模式下正文文本仅作辅助（前 2 页），页面图承载完整版面
        text = _extract_text(store.paper_file(body.paper_id), max_pages=2, max_chars=5000)

    user_prompt = _render_prompt(prompt["content"], paper, text)
    if mode == "vision":
        user_prompt += "\n\n（随消息附上了论文逐页截图，请结合页面中的图表、公式与排版信息补充总结；如与文本不一致，以图为准。）"
        if paper.get("pages") and paper["pages"] > len(page_images):
            user_prompt += f"\n\n（注意：论文共 {paper['pages']} 页，本次仅提供前 {len(page_images)} 页截图，请基于现有内容总结，不要臆测未提供的部分。）"

    cache_key = f"{body.prompt_id}:{mode}"

    def gen():
        accumulated, completed = [], False
        try:
            client = openai_lib.OpenAI(base_url=base_url, api_key=api_key, timeout=180)
            meta = {"model": model, "prompt": prompt["name"], "mode": mode,
                    "pages": len(page_images)}
            yield f"data: {_json.dumps({'meta': meta}, ensure_ascii=False)}\n\n"

            if mode == "vision":
                content: list = [{"type": "text", "text": user_prompt}]
                content += [{"type": "image_url", "image_url": {"url": u}} for u in page_images]
                user_message = {"role": "user", "content": content}
            else:
                user_message = {"role": "user", "content": user_prompt}

            stream = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "你是严谨的学术文献助手，严格按用户要求的格式输出。"},
                    user_message,
                ],
                stream=True,
                temperature=0.3,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices and chunk.choices[0].delta else None
                if delta:
                    accumulated.append(delta)
                    yield f"data: {_json.dumps({'delta': delta}, ensure_ascii=False)}\n\n"
            completed = True  # 上游已完整生成；此后断连也照常落盘
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: {_json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"
        finally:
            if completed and accumulated:
                store.save_summary(body.paper_id, cache_key, "".join(accumulated), model)

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@app.get("/api/summaries/{paper_id}")
def get_summary(paper_id: str, prompt_id: str, mode: str = "text"):
    key = f"{prompt_id}:{mode if mode in ('text', 'vision') else 'text'}"
    return store.get_summary(paper_id, key) or {}


# ---------- 笔记（Markdown） ----------

NOTE_IMAGE_DIR = DATA_DIR / "notes"
NOTE_IMAGE_MAX_MB = 8


class NoteBody(BaseModel):
    title: str | None = None
    content: str | None = None
    pinned: bool | None = None


@app.get("/api/papers/{pid}/notes")
def list_notes(pid: str):
    if not store.get_paper(pid):
        raise HTTPException(404, "文献不存在")
    return store.list_notes(pid)


@app.post("/api/papers/{pid}/notes")
def create_note(pid: str, body: NoteBody | None = None):
    if not store.get_paper(pid):
        raise HTTPException(404, "文献不存在")
    body = body or NoteBody()
    return store.add_note(pid, title=body.title or "", content=body.content or "", pinned=body.pinned or False)


@app.put("/api/papers/{pid}/notes/{nid}")
def update_note(pid: str, nid: str, body: NoteBody):
    note = store.update_note(pid, nid, title=body.title, content=body.content, pinned=body.pinned)
    if not note:
        raise HTTPException(404, "笔记不存在")
    return note


@app.delete("/api/papers/{pid}/notes/{nid}")
def delete_note(pid: str, nid: str):
    if not store.delete_note(pid, nid):
        raise HTTPException(404, "笔记不存在")
    return {"ok": True}


@app.post("/api/papers/{pid}/notes/{nid}/restore")
def restore_note(pid: str, nid: str):
    note = store.restore_note(pid, nid)
    if not note:
        raise HTTPException(404, "笔记已恢复或撤销时间已过")
    return note


@app.get("/api/papers/{pid}/notes/{nid}/export")
def download_note(pid: str, nid: str):
    note = store.get_note(pid, nid)
    if not note:
        raise HTTPException(404, "笔记不存在")
    try:
        data = export_note(note, NOTE_IMAGE_DIR)
    except FileNotFoundError as error:
        raise HTTPException(409, str(error)) from error
    return Response(data, media_type="application/zip", headers={
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(export_name(note['title']) + '.zip')}"
    })


"""笔记内图片：上传后返回可直接嵌入 Markdown 的 URL"""
@app.post("/api/notes/image")
async def upload_note_image(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"):
        raise HTTPException(400, "仅支持 png/jpg/gif/webp/svg 图片")
    data = await file.read()
    if not data:
        raise HTTPException(400, "空文件")
    if len(data) > NOTE_IMAGE_MAX_MB * 1024 * 1024:
        raise HTTPException(400, f"图片过大（上限 {NOTE_IMAGE_MAX_MB}MB）")
    NOTE_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    name = uuid.uuid4().hex + ext
    (NOTE_IMAGE_DIR / name).write_bytes(data)
    return {"url": f"/api/notes/image/{name}", "name": name, "size": len(data)}


@app.get("/api/notes/image/{name}")
def get_note_image(name: str):
    # 防目录穿越：只允许纯文件名
    if Path(name).name != name:
        raise HTTPException(400, "非法文件名")
    path = NOTE_IMAGE_DIR / name
    if not path.exists():
        raise HTTPException(404, "图片不存在")
    return FileResponse(path)


# ---------- PDF 批注（高亮 / 划线 / 批注） ----------

ANNOT_KINDS = ("highlight", "underline", "note")


class AnnotationBody(BaseModel):
    view: Literal["en", "zh", "dual2"] = "en"
    kind: str = "highlight"
    page: int = 1
    rects: list[dict] = []
    text: str = ""
    color: str = "yellow"
    comment: str = ""


class AnnotationPatch(BaseModel):
    view: Literal["en", "zh", "dual2"] | None = None
    kind: str | None = None
    color: str | None = None
    comment: str | None = None


@app.get("/api/papers/{pid}/annotations")
def list_annotations(pid: str, view: Literal["en", "zh", "dual2"] | None = None):
    if not store.get_paper(pid):
        raise HTTPException(404, "文献不存在")
    items = store.list_annotations(pid)
    return [a for a in items if a["view"] in (view, "legacy")] if view else items


@app.post("/api/papers/{pid}/annotations")
def create_annotation(pid: str, body: AnnotationBody):
    if not store.get_paper(pid):
        raise HTTPException(404, "文献不存在")
    if body.kind not in ANNOT_KINDS:
        raise HTTPException(400, "不支持的批注类型")
    if body.page < 1:
        raise HTTPException(400, "页码无效")
    if not body.rects and body.kind != "note":
        raise HTTPException(400, "缺少选区几何信息")
    return store.add_annotation(pid, body.model_dump())


@app.patch("/api/papers/{pid}/annotations/{aid}")
def patch_annotation(pid: str, aid: str, body: AnnotationPatch):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if fields.get("kind") and fields["kind"] not in ANNOT_KINDS:
        raise HTTPException(400, "不支持的批注类型")
    ann = store.update_annotation(pid, aid, **fields)
    if not ann:
        raise HTTPException(404, "批注不存在")
    return ann


@app.delete("/api/papers/{pid}/annotations/{aid}")
def remove_annotation(pid: str, aid: str):
    if not store.delete_annotation(pid, aid):
        raise HTTPException(404, "批注不存在")
    return {"ok": True}


@app.post("/api/papers/{pid}/annotations/{aid}/restore")
def restore_annotation(pid: str, aid: str):
    ann = store.restore_annotation(pid, aid)
    if not ann:
        raise HTTPException(404, "批注无法恢复，撤销时间已过或文献已删除")
    return ann


# ---------- 嵌入用户自己的浏览器（Chrome / Edge，复用真实登录态） ----------

class EmbedBrowserBody(BaseModel):
    url: str
    browser_id: str = ""
    parent_hwnd: int
    x: int = 0
    y: int = 0
    width: int = 800
    height: int = 600
    # 用户手动指定的浏览器 exe（设置页填的）。给了就优先用它，
    # 自动检测找不到浏览器时（装在非默认目录 / 便携版）靠它兜底。
    browser_path: str = ""


class BrowserCheckBody(BaseModel):
    path: str = ""


class EmbedBoundsBody(BaseModel):
    x: int = 0
    y: int = 0
    width: int = 800
    height: int = 600
    visible: bool = True
    # 单调递增的序号（前端生成）。拖动分隔条时前端每帧都会上报一次矩形，而 FastAPI
    # 的同步端点跑在线程池里——两个请求可能「后发先至」，最终窗口停在某个中间尺寸上
    # （现象：拖完面板，嵌入的网页还是拖动过程中的某个位置/大小，明显错位）。
    # 带序号就能把过期的请求丢掉，只认最新的。
    seq: int = 0
    session_id: str = ""


_browser_session = BrowserSession()


def _require_embed():
    if browser_embed is None:
        raise HTTPException(400, "嵌入浏览器不可用（仅 Windows 支持）")
    if sys.platform != "win32":
        raise HTTPException(400, "嵌入浏览器仅支持 Windows")
    return browser_embed


@app.get("/api/browser/detect")
def browser_detect(custom_path: str = ""):
    """列出可用的 Chromium 系浏览器，供设置页选择。

    三路来源（优先级从高到低）：用户手动指定的路径 → 注册表 App Paths（真实安装
    位置，装在 D 盘也能找到）→ 默认安装路径。每条结果带 `source` 说明来路。
    """
    if browser_embed is None:
        return {"browsers": [], "error": "仅 Windows 支持"}
    try:
        return {"browsers": browser_embed.detect_browsers(custom_path)}
    except Exception as exc:
        return {"browsers": [], "error": str(exc)}


@app.post("/api/browser/check-path")
def browser_check_path(body: BrowserCheckBody):
    """校验用户手动输入的浏览器 exe 路径。

    单独一个端点，是为了让设置页在「保存之前」就能给出明确提示
    （文件不存在 / 选成了文件夹 / 选错了程序），而不是等到打开面板时才失败。
    """
    if browser_embed is None:
        raise HTTPException(400, "嵌入浏览器不可用（仅 Windows 支持）")
    info, err = browser_embed.inspect_browser_path(body.path)
    if not info:
        raise HTTPException(400, err or "路径不可用")
    return {"ok": True, **info}


@app.post("/api/browser/embed")
def browser_embed_open(body: EmbedBrowserBody):
    mod = _require_embed()
    from urllib.parse import urlsplit
    target = urlsplit(body.url)
    if target.scheme not in ("http", "https") or not target.hostname:
        raise HTTPException(400, "只允许 http/https 网址")
    try:
        return _browser_session.open(
            lambda: mod.EmbeddedBrowser(browser_id=body.browser_id or None,
                                        custom_path=body.browser_path or ""),
            body.url, body.parent_hwnd, (body.x, body.y, body.width, body.height))
    except Exception as exc:
        raise HTTPException(500, f"嵌入浏览器失败：{exc}")


@app.post("/api/browser/bounds")
def browser_embed_bounds(body: EmbedBoundsBody):
    try:
        return _browser_session.bounds(**body.model_dump())
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@app.get("/api/browser/status")
def browser_embed_status():
    return {**_browser_session.status(),
            "dpi_awareness": getattr(browser_embed, "DPI_AWARENESS", "unknown")}


@app.post("/api/browser/close")
def browser_embed_close():
    try:
        return _browser_session.close()
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@app.post("/api/browser/hide")
def browser_embed_hide():
    return _browser_session.bounds(visible=False)


@app.post("/api/browser/shutdown")
def browser_embed_shutdown():
    try:
        return _browser_session.shutdown()
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# 静态托管前端（Electron 直接从 localhost 加载，规避 file:// 的 worker 限制）
class _NoCacheStaticFiles(StaticFiles):
    """开发期静态资源禁缓存：js/css 改动即时生效，避免浏览器拿到旧版本"""

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-cache"
        return response


_FRONTEND = FRONTEND_DIR
if _FRONTEND.exists():
    app.mount("/", _NoCacheStaticFiles(directory=str(_FRONTEND), html=True), name="frontend")
