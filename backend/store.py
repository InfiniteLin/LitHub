"""JSON 文件存储：文献库 / 任务 / 设置。

MVP 阶段使用单文件 JSON + 线程锁，接口按 SQLite 可替换的粒度设计。
元数据目录由 paths.py 决定。PDF 附件目录由 PdfStorage 管理，
默认在程序目录的 pdfs/ 下；旧库沿用原位置，用户可在设置中校验迁移。
PDF 根目录下 files/ 存原文，out/<id>/ 存译文与对照版。
"""

import json
import os
import shutil
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path

import secret
from paths import DATA_DIR
from pdf_storage import PdfStorage

STORE_PATH = DATA_DIR / "library.json"

_lock = threading.RLock()

DEFAULT_SETTINGS = {
    "service": "bing",          # bing | openai（OpenAI 兼容）
    "provider": "",             # deepseek | zhipu | openai | custom（当前选中的服务商）
    "base_url": "",
    "api_key": "",              # 当前 provider 的 Key（冗余镜像，便于老代码直接读取）
    "api_keys": {},             # provider -> 加密后的 Key（每个服务商各存各的）
    "model": "",
    "target_lang": "zh",
    # ---- 网页 AI（免 token 路线）：在系统浏览器里打开，沿用本机已登录的账号 ----
    "web_ai_url": "https://chat.deepseek.com/",   # 默认站点，可在设置里改
    "web_ai_sites": [],                            # 常用站点列表 [{name, url}]
    "web_ai_export": "full",                       # 复制全文时的范围：full | first_pages | meta
    "web_ai_max_pages": 0,                         # 0 = 不限；与 web_ai_export 配合
    # ---- 内嵌方式：现在固定为 browser（嵌入用户自己的 Chrome/Edge）----
    # 设置页已不再提供这个选项；字段保留只为兼容存量 library.json，读取方按默认处理
    "web_ai_embed_mode": "browser",
    "web_ai_browser": "",                          # 空 = 自动挑第一个可用的（chrome / edge …）
    # 手动指定的浏览器 exe。空 = 自动检测（注册表 App Paths + 默认安装位置）。
    # 自动检测找不到时（装在 D 盘 / 便携版）由用户填这里。
    "web_ai_browser_path": "",
}

DEFAULT_PROMPTS = [
    {
        "id": "d1", "name": "默认 · 文献速读", "desc": "快速把握论文全貌，输出结构化速读卡片", "default": True,
        "content": "你是学术文献助手。请基于提供的论文内容，用简体中文输出结构化总结。\n\n"
                   "格式要求：\n"
                   "- 用 Markdown 二级标题（## 小节名）分节；\n"
                   "- 依次输出小节：一句话总结、研究背景、核心方法、实验结果、局限与思考、关键要点；\n"
                   "- 「核心方法」与「关键要点」小节内使用 '- ' 开头的列表，其余为简洁段落；\n"
                   "- 忠于原文，不编造数据。\n\n"
                   "论文标题：{{title}}\n发表信息：{{venue}}\n论文内容节选：\n{{abstract}}",
    },
    {
        "id": "d2", "name": "深度方法剖析", "desc": "聚焦方法细节：架构、公式、复杂度与对比", "default": False,
        "content": "请以方法论的视角剖析论文《{{title}}》，用简体中文输出。\n\n"
                   "格式要求：用 Markdown 二级标题（## 小节名）分节，依次输出：方法拆解、关键公式与设计选择、"
                   "与已有架构的对比、计算与参数复杂度分析、可复现性评估；要点用 '- ' 开头的列表；保留必要的英文术语。\n\n"
                   "论文内容节选：\n{{abstract}}",
    },
    {
        "id": "d3", "name": "审稿人视角", "desc": "以顶会审稿人的标准审视论文优缺点", "default": False,
        "content": "假设你是 {{venue}} 的审稿人，请评审论文《{{title}}》，用简体中文输出，语气专业克制。\n\n"
                   "格式要求：用 Markdown 二级标题（## 小节名）分节，依次输出：优点、主要疑问与潜在风险、"
                   "缺失的实验或论述、总体评价与修改建议；要点用 '- ' 开头的列表。\n\n"
                   "论文内容节选：\n{{abstract}}",
    },
    {
        "id": "d4", "name": "组会汇报版", "desc": "适合口头汇报的五分钟讲述结构", "default": False,
        "content": "请为组会汇报整理论文《{{title}}》，用简体中文输出。\n\n"
                   "格式要求：用 Markdown 二级标题（## 小节名）分节，依次输出：这篇论文做了什么、为什么重要、"
                   "怎么做到的、结果如何、对我们课题的启发；每部分不超过 3 句话。\n\n"
                   "论文内容节选：\n{{abstract}}",
    },
]


def _ensure_dirs():
    for d in (DATA_DIR,):
        d.mkdir(parents=True, exist_ok=True)


def _empty():
    return {
        "papers": {}, "tasks": {}, "settings": dict(DEFAULT_SETTINGS),
        "prompts": {p["id"]: dict(p) for p in DEFAULT_PROMPTS}, "summaries": {},
        "categories": [{"id": "local", "name": "本地文献", "parent": None}],
        "notes": {},       # paper_id -> [note]
        "annotations": {},  # paper_id -> [annotation]
    }


def _load():
    _ensure_dirs()
    if STORE_PATH.exists():
        try:
            db = json.loads(STORE_PATH.read_text(encoding="utf-8"))
            db.setdefault("papers", {})
            db.setdefault("tasks", {})
            db.setdefault("settings", dict(DEFAULT_SETTINGS))
            if not db.setdefault("prompts", {}):
                db["prompts"] = {p["id"]: dict(p) for p in DEFAULT_PROMPTS}
            db.setdefault("summaries", {})
            db.setdefault("notes", {})
            db.setdefault("annotations", {})
            if not db.setdefault("categories", []):
                db["categories"] = [{"id": "local", "name": "本地文献", "parent": None}]
            if not any(c["id"] == "local" for c in db["categories"]):
                db["categories"].append({"id": "local", "name": "本地文献", "parent": None})
            # 服务重启后，未完成任务不可能仍在运行：标记为失败供用户重试
            for t in db["tasks"].values():
                if t.get("status") in ("running", "queued"):
                    t["status"] = "failed"
                    t["note"] = "任务中断（服务重启），可重试"
            # 存量明文 API Key → 立即加密并落盘
            key = db["settings"].get("api_key") or ""
            if key and not secret.is_encrypted(key):
                db["settings"]["api_key"] = secret.encrypt(key)
                _save(db)
            # 老数据只有一个全局 key：迁移成「当前 provider 名下的 key」
            keys = db["settings"].setdefault("api_keys", {})
            legacy = db["settings"].get("api_key") or ""
            prov = db["settings"].get("provider") or ""
            if legacy and prov and not keys.get(prov):
                keys[prov] = legacy
                _save(db)
            return db
        except Exception:
            pass
    return _empty()


def _save(db):
    # 原子写：先写临时文件再替换，进程崩溃不会损坏整个库
    tmp = STORE_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, STORE_PATH)


class Store:
    """全量读写 + RLock；数据量小，简单可靠。"""

    def __init__(self):
        self._db = _load()
        self._annotation_trash = {}
        self._note_trash = {}
        program = Path(os.environ.get("LITHUB_PROGRAM_DIR") or Path(__file__).resolve().parent.parent)
        default = os.environ.get("LITHUB_PDF_DEFAULT_DIR")
        if not default and os.environ.get("LITHUB_DATA_DIR") and not os.environ.get("LITHUB_PROGRAM_DIR"):
            default = str(DATA_DIR / "pdfs")
        self._pdf_storage = PdfStorage(DATA_DIR, program, default)
        self._pdf_storage.initialize(self._db, self._flush)

    @property
    def files_dir(self):
        return self._pdf_storage.files

    @property
    def output_dir(self):
        return self._pdf_storage.out

    def pdf_storage_info(self):
        with _lock:
            return self._pdf_storage.info()

    def change_pdf_storage(self, directory=None):
        with _lock:
            return self._pdf_storage.change(self._db, directory or self._pdf_storage.default, self._flush)

    def _flush(self):
        _save(self._db)

    # ---------- papers ----------
    def list_papers(self):
        with _lock:
            items = sorted(self._db["papers"].values(), key=lambda p: p["added"], reverse=True)
            return [dict(p) for p in items]

    def get_paper(self, pid):
        with _lock:
            p = self._db["papers"].get(pid)
            return dict(p) if p else None

    def find_paper_by_hash(self, digest: str):
        with _lock:
            for p in self._db["papers"].values():
                if p.get("hash") == digest:
                    return dict(p)
        return None

    def add_paper(self, src: Path, orig_name: str, pages: int, title: str | None,
                  digest: str | None = None, cat: str = "local", *, authors: str = "") -> dict:
        with _lock:
            pid = uuid.uuid4().hex[:12]
            dst = self.files_dir / f"{pid}.pdf"
            shutil.copyfile(src, dst)
            paper = {
                "id": pid,
                "title": title or Path(orig_name).stem,
                "authors": authors,
                "venue": "本地导入",
                "year": None,
                "type": "PDF",
                "cat": cat if cat else "local",
                "tags": [],
                "fav": False,
                "translated": False,
                "translated_file": None,
                "pages": pages,
                "orig_name": orig_name,
                "hash": digest,
                "added": datetime.now().isoformat(timespec="seconds"),
            }
            self._db["papers"][pid] = paper
            self._flush()
            return dict(paper)

    def update_paper(self, pid, **fields):
        with _lock:
            p = self._db["papers"].get(pid)
            if not p:
                return
            p.update(fields)
            self._flush()

    def delete_paper(self, pid) -> bool:
        """删除文献记录及其原文、译文产物、任务、总结、笔记与批注"""
        with _lock:
            p = self._db["papers"].pop(pid, None)
            if not p:
                return False
            translated_file = p.get("translated_file")
            self._db["tasks"] = {k: t for k, t in self._db["tasks"].items() if t.get("paper_id") != pid}
            self._db["summaries"].pop(pid, None)
            self._db["notes"].pop(pid, None)
            self._db["annotations"].pop(pid, None)
            self._flush()
            try:
                (self.files_dir / f"{pid}.pdf").unlink(missing_ok=True)
            except Exception:
                pass
            if translated_file:
                try:
                    Path(translated_file).unlink(missing_ok=True)
                except Exception:
                    pass
            shutil.rmtree(self.output_dir / pid, ignore_errors=True)
            return True

    def paper_file(self, pid) -> Path:
        return self.files_dir / f"{pid}.pdf"

    # ---------- categories ----------
    def list_categories(self):
        with _lock:
            return [dict(c) for c in self._db["categories"]]

    def add_category(self, name: str, parent: str | None = None) -> dict:
        cat = {"id": "c" + uuid.uuid4().hex[:10], "name": name, "parent": parent or None}
        with _lock:
            self._db["categories"].append(cat)
            self._flush()
        return dict(cat)

    def update_category(self, cid: str, name: str | None = None, parent: str | None = None):
        """重命名 / 改父级。返回 (ok, msg, cat)。

        改父级时拒绝「挂到自己或自己的后代下」—— 否则分类树成环，
        前端递归渲染会无限展开。"""
        with _lock:
            cat = next((c for c in self._db["categories"] if c["id"] == cid), None)
            if not cat:
                return False, "分类不存在", None
            if name is not None:
                clean = str(name).strip()[:40]
                if not clean:
                    return False, "分类名称不能为空", None
                cat["name"] = clean
            if parent is not None:
                new_parent = parent or None
                if new_parent == cid:
                    return False, "不能把分类挂到自己下面", None
                if new_parent and not any(c["id"] == new_parent for c in self._db["categories"]):
                    return False, "目标父级分类不存在", None
                # 沿着 new_parent 向上走，若遇到 cid 说明是后代
                seen, cur = set(), new_parent
                while cur and cur not in seen:
                    if cur == cid:
                        return False, "不能把分类挂到它的子分类下面", None
                    seen.add(cur)
                    nxt = next((c for c in self._db["categories"] if c["id"] == cur), None)
                    cur = (nxt or {}).get("parent")
                cat["parent"] = new_parent
            self._flush()
            return True, "", dict(cat)

    def delete_category(self, cid) -> tuple[bool, str]:
        with _lock:
            if not any(c["id"] == cid for c in self._db["categories"]):
                return False, "分类不存在"
            if any(c["parent"] == cid for c in self._db["categories"]):
                return False, "请先删除其子分类"
            # 未标注 cat 的旧记录视为 local（导入时无分类字段的历史数据）
            n = sum(1 for p in self._db["papers"].values() if (p.get("cat") or "local") == cid)
            if n:
                return False, f"分类下仍有 {n} 篇文献，请先删除或移动"
            self._db["categories"] = [c for c in self._db["categories"] if c["id"] != cid]
            self._flush()
        return True, ""

    # ---------- tasks ----------
    def add_task(self, paper_id: str) -> dict:
        task = {
            "id": uuid.uuid4().hex[:12],
            "paper_id": paper_id,
            "status": "queued",     # queued | running | done | failed | cancelled
            "progress": 0,
            "note": "排队中",
            "error": None,
            "created": time.time(),
        }
        with _lock:
            self._db["tasks"][task["id"]] = task
            self._flush()
        return dict(task)

    def get_task(self, tid):
        with _lock:
            t = self._db["tasks"].get(tid)
            return dict(t) if t else None

    def update_task(self, tid, **fields):
        with _lock:
            t = self._db["tasks"].get(tid)
            if not t:
                return
            t.update(fields)
            self._flush()

    def list_tasks(self, limit=50):
        with _lock:
            items = sorted(self._db["tasks"].values(), key=lambda t: t["created"], reverse=True)
            return [dict(t) for t in items[:limit]]

    # ---------- settings ----------
    def _key_for(self, cfg: dict, provider: str | None = None) -> str:
        """取某个 provider 名下的明文 Key；provider 为空则取当前选中的。
        兼容老数据：api_keys 里没有时回落到全局 api_key。"""
        keys = cfg.get("api_keys") or {}
        prov = provider if provider is not None else (cfg.get("provider") or "")
        enc = keys.get(prov) or (cfg.get("api_key") if prov in ("", cfg.get("provider") or "") else "")
        return secret.decrypt(enc or "")

    def get_settings(self, provider: str | None = None):
        """配置快照；api_key 一律以**明文**返回，仅供 sidecar 内部使用。

        `provider` 指定时，返回该服务商名下的 Key；不指定则返回当前选中的。
        对外（HTTP / 前端）必须经 main.py 的 _public_settings() 过滤，
        不能把这个明文 key 直接序列化给渲染进程。
        """
        with _lock:
            # 老数据可能缺新加的键（如 web_ai_*）：用默认值补齐，保证对外字段稳定
            cfg = {**{k: (v if not isinstance(v, (list, dict)) else (list(v) if isinstance(v, list) else dict(v)))
                      for k, v in DEFAULT_SETTINGS.items()}, **dict(self._db["settings"])}
        cfg["api_key"] = self._key_for(cfg, provider)
        return cfg

    def get_api_key_map(self) -> dict:
        """provider -> 明文 Key（只给 main.py 生成掩码用，不外发）。"""
        with _lock:
            raw = dict(self._db["settings"].get("api_keys") or {})
            legacy = self._db["settings"].get("api_key") or ""
            prov = self._db["settings"].get("provider") or ""
        out = {k: secret.decrypt(v or "") for k, v in raw.items()}
        if legacy and prov and not out.get(prov):
            out[prov] = secret.decrypt(legacy)
        return out

    def has_api_key(self) -> bool:
        with _lock:
            cfg = dict(self._db["settings"])
        return bool(self._key_for(cfg))

    def set_settings(self, fields: dict):
        """写入配置。api_key 为明文入参，落盘前加密；密文永不重复加密。

        约定：`api_key` 写到「当前 provider」名下（同时镜像到全局字段）；
        `api_keys` 可直接传 provider->明文 的整表（前端一次保存多个服务商时用）。
        """
        fields = dict(fields)
        per_provider = fields.pop("api_keys", None)
        with _lock:
            clean = {k: v for k, v in fields.items() if k in DEFAULT_SETTINGS and v is not None}
            key_plain = clean.pop("api_key", None)
            target_prov = clean.get("provider", self._db["settings"].get("provider") or "")

            keys = dict(self._db["settings"].get("api_keys") or {})
            if isinstance(per_provider, dict):
                for prov, plain in per_provider.items():
                    if plain is None:
                        continue
                    if plain == "":
                        keys.pop(prov, None)
                    elif not secret.is_encrypted(plain):
                        keys[prov] = secret.encrypt(plain)
                    else:
                        keys[prov] = plain
            if key_plain:
                if not secret.is_encrypted(key_plain):
                    key_plain = secret.encrypt(key_plain)
                keys[target_prov] = key_plain
                clean["api_key"] = key_plain       # 老字段镜像，兼容直接读它的代码

            clean["api_keys"] = keys
            self._db["settings"].update(clean)
            self._flush()
            cfg = dict(self._db["settings"])
        cfg["api_key"] = self._key_for(cfg)
        return cfg

    # ---------- prompts ----------
    def list_prompts(self):
        with _lock:
            items = sorted(self._db["prompts"].values(), key=lambda p: p["id"])
            return [dict(p) for p in items]

    def get_prompt(self, pid):
        with _lock:
            p = self._db["prompts"].get(pid)
            return dict(p) if p else None

    def upsert_prompt(self, data: dict, pid: str | None = None):
        with _lock:
            target = pid or data.get("id") or ("p" + uuid.uuid4().hex[:10])
            existing = self._db["prompts"].get(target)
            prompt = {**(existing or {"id": target}), **{k: v for k, v in data.items() if k in ("name", "desc", "content", "default")}}
            if prompt.get("default"):
                for p in self._db["prompts"].values():
                    p["default"] = False
            self._db["prompts"][target] = prompt
            self._flush()
            return dict(prompt)

    def delete_prompt(self, pid) -> bool:
        with _lock:
            if len(self._db["prompts"]) <= 1 or pid not in self._db["prompts"]:
                return False
            del self._db["prompts"][pid]
            self._flush()
            return True

    # ---------- summaries ----------
    def get_summary(self, paper_id, prompt_id):
        with _lock:
            s = self._db["summaries"].get(paper_id, {}).get(prompt_id)
            return dict(s) if s else None

    def save_summary(self, paper_id, prompt_id, content, model):
        with _lock:
            if paper_id not in self._db["papers"]:
                return  # 文献已删除，丢弃孤儿总结
            self._db["summaries"].setdefault(paper_id, {})[prompt_id] = {
                "content": content,
                "model": model,
                "created": datetime.now().isoformat(timespec="seconds"),
            }
            self._flush()

    # ---------- notes（Markdown 笔记） ----------
    def list_notes(self, paper_id):
        with _lock:
            items = sorted(self._db["notes"].get(paper_id, []),
                           key=lambda n: (bool(n.get("pinned")), n.get("updated") or n.get("created") or ""), reverse=True)
            return [dict(n) for n in items]

    def get_note(self, paper_id, note_id):
        with _lock:
            for n in self._db["notes"].get(paper_id, []):
                if n["id"] == note_id:
                    return dict(n)
        return None

    def add_note(self, paper_id, title="", content="", pinned=False):
        note = {
            "id": "n" + uuid.uuid4().hex[:10],
            "title": (title or "").strip()[:120] or "未命名笔记",
            "content": content or "",
            "pinned": bool(pinned),
            "created": datetime.now().isoformat(timespec="seconds"),
            "updated": datetime.now().isoformat(timespec="seconds"),
        }
        with _lock:
            self._db["notes"].setdefault(paper_id, []).append(note)
            self._flush()
        return dict(note)

    def update_note(self, paper_id, note_id, **fields):
        with _lock:
            for n in self._db["notes"].get(paper_id, []):
                if n["id"] != note_id:
                    continue
                if "title" in fields and fields["title"] is not None:
                    n["title"] = str(fields["title"]).strip()[:120] or "未命名笔记"
                if "content" in fields and fields["content"] is not None:
                    n["content"] = str(fields["content"])
                if fields.get("pinned") is not None:
                    n["pinned"] = bool(fields["pinned"])
                n["updated"] = datetime.now().isoformat(timespec="seconds")
                self._flush()
                return dict(n)
        return None

    def delete_note(self, paper_id, note_id) -> bool:
        with _lock:
            items = self._db["notes"].get(paper_id, [])
            for i, n in enumerate(items):
                if n["id"] == note_id:
                    now = time.monotonic()
                    self._note_trash = {k: v for k, v in self._note_trash.items() if now - v[0] < 60}
                    if len(self._note_trash) >= 100:
                        self._note_trash.pop(next(iter(self._note_trash)))
                    self._note_trash[(paper_id, note_id)] = (now, dict(n))
                    items.pop(i)
                    if not items:
                        self._db["notes"].pop(paper_id, None)
                    self._flush()
                    return True
        return False

    def restore_note(self, paper_id, note_id):
        with _lock:
            item = self._note_trash.get((paper_id, note_id))
            if not item or time.monotonic() - item[0] >= 60 or paper_id not in self._db["papers"]:
                return None
            notes = self._db["notes"].setdefault(paper_id, [])
            if any(n["id"] == note_id for n in notes):
                return None
            notes.append(dict(item[1]))
            self._flush()
            self._note_trash.pop((paper_id, note_id), None)
            return dict(item[1])

    # ---------- annotations（高亮 / 划线 / 批注） ----------
    def list_annotations(self, paper_id):
        with _lock:
            items = list(self._db["annotations"].get(paper_id, []))
        # 按页码、页内纵向位置排序，便于侧栏按文序展示
        items.sort(key=lambda a: (a.get("page") or 0, (a.get("rects") or [{}])[0].get("y", 0)))
        return [dict(a, view=a.get("view") or "legacy") for a in items]

    def add_annotation(self, paper_id, data: dict):
        ann = {
            "view": data.get("view") or "legacy",
            "id": "a" + uuid.uuid4().hex[:10],
            "kind": data.get("kind") or "highlight",   # highlight | underline | note
            "page": int(data.get("page") or 1),        # 1-based 页码
            "rects": data.get("rects") or [],          # 相对页面宽高的归一化矩形
            "text": (data.get("text") or "")[:4000],   # 被标注的原文
            "color": data.get("color") or "yellow",
            "comment": (data.get("comment") or "")[:4000],
            "created": datetime.now().isoformat(timespec="seconds"),
        }
        with _lock:
            self._db["annotations"].setdefault(paper_id, []).append(ann)
            self._flush()
        return dict(ann)

    def update_annotation(self, paper_id, ann_id, **fields):
        with _lock:
            for a in self._db["annotations"].get(paper_id, []):
                if a["id"] != ann_id:
                    continue
                for k in ("kind", "color", "comment", "view"):
                    if k in fields and fields[k] is not None:
                        a[k] = str(fields[k])[:4000] if k == "comment" else str(fields[k])
                self._flush()
                return dict(a)
        return None

    def delete_annotation(self, paper_id, ann_id) -> bool:
        with _lock:
            items = self._db["annotations"].get(paper_id, [])
            for i, a in enumerate(items):
                if a["id"] == ann_id:
                    now = time.monotonic()
                    self._annotation_trash = {key: value for key, value in self._annotation_trash.items() if now - value[0] < 60}
                    if len(self._annotation_trash) >= 100:
                        self._annotation_trash.pop(next(iter(self._annotation_trash)))
                    self._annotation_trash[(paper_id, ann_id)] = (now, dict(a))
                    items.pop(i)
                    if not items:
                        self._db["annotations"].pop(paper_id, None)
                    self._flush()
                    return True
        return False

    def restore_annotation(self, paper_id, ann_id):
        with _lock:
            item = self._annotation_trash.get((paper_id, ann_id))
            if not item or time.monotonic() - item[0] >= 60 or paper_id not in self._db["papers"]:
                return None
            annotations = self._db["annotations"].setdefault(paper_id, [])
            if any(a["id"] == ann_id for a in annotations):
                return None
            annotations.append(dict(item[1]))
            self._flush()
            self._annotation_trash.pop((paper_id, ann_id), None)
            return dict(item[1])


store = Store()
