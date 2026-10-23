"""全文检索：SQLite FTS5（trigram 分词，支持中文子串）+ 逐篇 .txt 旁车文件

索引是派生数据：可随时全量重建，不怕损坏。
- 导入时同步索引（原文；已有译文则中文译文也入索引）
- 删除文献时同步移除
- 启动时后台重建：缺旁车文件的从 PDF 提取，索引整体从 txt 重建
"""

import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

from paths import DATA_DIR

TEXT_DIR = DATA_DIR / "text"
DB_PATH = DATA_DIR / "search.db"

MAX_PAGES = 200      # 单篇提取页数上限
MAX_CHARS = 400_000  # 单篇提取字符上限
SEARCH_LIMIT = 50
BUSY_TIMEOUT = 5.0   # 秒：并发写入时排队等待，而不是立刻抛 "database is locked"

_conn: sqlite3.Connection | None = None
_lock = threading.RLock()


def _ensure_dirs():
    TEXT_DIR.mkdir(parents=True, exist_ok=True)


def _connect() -> sqlite3.Connection:
    """进程内单连接（check_same_thread=False）。

    - WAL：读不阻塞写，启动重建索引时搜索仍可用
    - busy_timeout：并发写入排队而非立即失败
    - 连接失效（被 close 或异常）时自动重连，避免一次失败永久拖垮检索
    """
    global _conn
    if _conn is not None:
        return _conn
    with _lock:
        if _conn is None:
            _ensure_dirs()
            conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=BUSY_TIMEOUT)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute(f"PRAGMA busy_timeout={int(BUSY_TIMEOUT * 1000)}")
            _conn = conn
        return _conn


@contextmanager
def _session():
    """串行化访问。连接在别处被关闭（ProgrammingError）时重建一次再重试。

    注意：重试必须放在 `yield` 之外——在生成器里捕获自身 yield 抛出的异常
    会破坏上下文管理器协议（RuntimeError: generator didn't stop after throw）。
    """
    global _conn
    with _lock:
        for attempt in (1, 2):
            conn = _connect()
            try:
                cursor = conn.cursor()   # 探测连接是否已失效
                cursor.close()
                break
            except sqlite3.ProgrammingError:
                try:
                    conn.close()
                except Exception:
                    pass
                _conn = None
                if attempt == 2:
                    raise
        yield conn


def _ensure_db(conn: sqlite3.Connection):
    # trigram 分词：无需词典即可做中文子串检索（SQLite 3.34+）
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5("
        "content, paper_id UNINDEXED, lang UNINDEXED, tokenize = 'trigram')"
    )
    conn.commit()


def close():
    """服务退出时关闭连接（lifespan 调用）。"""
    global _conn
    with _lock:
        if _conn is not None:
            try:
                _conn.close()
            except Exception:
                pass
            _conn = None


def txt_path(paper_id: str, lang: str = "en") -> Path:
    return TEXT_DIR / (f"{paper_id}.zh.txt" if lang == "zh" else f"{paper_id}.txt")


def extract_text(pdf_path: Path) -> str:
    from pypdf import PdfReader

    try:
        reader = PdfReader(str(pdf_path))
        parts = []
        for page in reader.pages[:MAX_PAGES]:
            parts.append((page.extract_text() or "").strip())
        return "\n".join(parts)[:MAX_CHARS]
    except Exception:
        return ""


def index_paper(paper_id: str, pdf_path: Path, lang: str = "en") -> bool:
    """提取全文 → 写旁车 txt → 写入 FTS。无可提取文本时返回 False。"""
    _ensure_dirs()
    tp = txt_path(paper_id, lang)
    text = tp.read_text(encoding="utf-8") if tp.exists() else extract_text(pdf_path)
    if not text.strip():
        return False
    if not tp.exists():
        tp.write_text(text, encoding="utf-8")
    with _session() as conn:
        _ensure_db(conn)
        conn.execute("DELETE FROM fts WHERE paper_id = ? AND lang = ?", (paper_id, lang))
        conn.execute("INSERT INTO fts (content, paper_id, lang) VALUES (?, ?, ?)",
                     (text, paper_id, lang))
        conn.commit()
    return True


def remove_paper(paper_id: str):
    for lang in ("en", "zh"):
        txt_path(paper_id, lang).unlink(missing_ok=True)
    if _conn is not None:
        with _session() as conn:
            _ensure_db(conn)
            conn.execute("DELETE FROM fts WHERE paper_id = ?", (paper_id,))
            conn.commit()


def rebuild(papers, pdf_of) -> int:
    """全量重建（启动时后台执行）：缺 txt 的从 PDF 提取；索引整体从 txt 重建。返回索引篇数。"""
    _ensure_dirs()
    with _session() as conn:
        _ensure_db(conn)
        conn.execute("DELETE FROM fts")
        conn.commit()
    n = 0
    for p in papers:
        pid = p["id"]
        try:
            if index_paper(pid, pdf_of(pid), "en"):
                n += 1
        except Exception:
            continue
        if p.get("translated") and p.get("translated_file"):
            try:
                index_paper(pid, Path(p["translated_file"]), "zh")
            except Exception:
                continue
    return n


def search(q: str, limit: int = SEARCH_LIMIT):
    """返回 [{paper_id, snippet}]；片段以 [[ ]] 标记命中位置；<3 字符退化为 LIKE（无片段）。"""
    q = q.strip()
    if not q:
        return []
    _ensure_dirs()
    out: dict[str, str] = {}
    with _session() as conn:
        _ensure_db(conn)
        if len(q) >= 3:
            phrase = '"' + q.replace('"', '""') + '"'
            try:
                rows = conn.execute(
                    "SELECT paper_id, snippet(fts, 0, '[[', ']]', '…', 24) "
                    "FROM fts WHERE fts MATCH ? LIMIT ?",
                    (phrase, limit),
                ).fetchall()
            except sqlite3.OperationalError:
                rows = []
            for pid, snip in rows:
                out.setdefault(pid, snip)
        else:
            rows = conn.execute(
                "SELECT DISTINCT paper_id FROM fts WHERE content LIKE ? LIMIT ?",
                (f"%{q}%", limit),
            ).fetchall()
            for (pid,) in rows:
                out.setdefault(pid, "")
    return [{"paper_id": pid, "snippet": snip} for pid, snip in out.items()]
