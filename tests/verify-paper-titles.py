"""Real PDF extraction and isolated import/rename API regression. Never opens the user's library."""
import hashlib
import contextlib
import json
import os
from pathlib import Path
import sys
import tempfile

import fitz

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from paper_title import detect_title
from paper_authors import author_names, detect_authors


def pdf(metadata="", text=True, author=""):
    doc = fitz.open()
    page = doc.new_page()
    if text:
        page.insert_text((72, 35), "Conference on Test Systems 2026", fontsize=10)
        page.insert_text((72, 95), "Reliable Document Reading:", fontsize=22)
        page.insert_text((72, 123), "A Practical Study of Scientific Papers", fontsize=22)
        page.insert_text((72, 165), "Alice Example, Bob Example", fontsize=12)
        page.insert_text((72, 195), "Example University", fontsize=11)
        page.insert_text((72, 240), "Abstract", fontsize=13)
        page.insert_text((72, 260), "We evaluate a document reading system.", fontsize=10)
    doc.set_metadata({"title": metadata, "author": author})
    result = doc.tobytes()
    doc.close()
    return result


with tempfile.TemporaryDirectory(prefix="lithub-title-test-") as temporary, contextlib.ExitStack() as cleanup:
    base = Path(temporary)
    metadata = base / "metadata"
    metadata.mkdir()
    (metadata / "library.json").write_text(json.dumps({"papers": {}, "settings": {}, "tasks": {}}), encoding="utf-8")
    os.environ.update(LITHUB_DATA_DIR=str(metadata), LITHUB_PROGRAM_DIR=str(base),
                      LITHUB_PDF_DEFAULT_DIR=str(base / "pdfs"))
    from fastapi.testclient import TestClient
    from main import app, store
    import search_index
    cleanup.callback(search_index.close)
    client = TestClient(app)
    cleanup.callback(client.close)
    expected = "Reliable Document Reading: A Practical Study of Scientific Papers"
    for meta in ["", "Untitled", "Microsoft Word - manuscript.docx", "sample.pdf"]:
        path = base / "sample.pdf"
        path.write_bytes(pdf(meta))
        assert detect_title(path, "sample.pdf") == expected, meta
    path.write_bytes(pdf("A Metadata Title for Scientific Papers"))
    assert detect_title(path, "sample.pdf") == "A Metadata Title for Scientific Papers"
    path.write_bytes(pdf("中文论文标题与文献管理研究"))
    assert detect_title(path, "sample.pdf") == "中文论文标题与文献管理研究"
    path.write_bytes(pdf(text=False))
    assert detect_title(path, "scan.pdf") is None
    print("PASS metadata, generic metadata rejection, multiline layout, CJK and image-only fallback")

    path.write_bytes(pdf())
    assert detect_authors(path, "sample.pdf") == "Alice Example, Bob Example"
    path.write_bytes(pdf(author="Jane Doe; José García and Jean-Luc Picard"))
    assert detect_authors(path) == "Jane Doe, José García, Jean-Luc Picard"
    path.write_bytes(pdf(author="张三、李四、王五"))
    assert detect_authors(path) == "张三, 李四, 王五"
    assert author_names("张三 李四") == "张三, 李四"
    assert author_names("Alice Example1*, Bob Example2†") == "Alice Example, Bob Example"
    for invalid in ["Unknown", "Anonymous Authors", "Microsoft Word", "Adobe Acrobat", "Example University", "alice@example.com"]:
        path.write_bytes(pdf(author=invalid))
        assert detect_authors(path) == "Alice Example, Bob Example", invalid
    path.write_bytes(pdf(text=False))
    assert detect_authors(path) == ""
    path.write_bytes(pdf(text=False, author="Ludwig van Beethoven; Marie Curie"))
    assert detect_authors(path) == "Ludwig van Beethoven, Marie Curie"
    # Multi-column names and small affiliation markers, followed by institutions/email.
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 70), "Reliable Document Reading", fontsize=22)
    page.insert_text((72, 115), "Alice Example", fontsize=12)
    page.insert_text((148, 111), "1", fontsize=7)
    page.insert_text((310, 115), "Bob Example", fontsize=12)
    page.insert_text((72, 140), "Example University", fontsize=10)
    page.insert_text((72, 160), "alice@example.com", fontsize=10)
    page.insert_text((72, 200), "Abstract", fontsize=13)
    page.insert_text((72, 225), "Another Person", fontsize=12)
    path.write_bytes(doc.tobytes())
    doc.close()
    assert detect_authors(path) == "Alice Example, Bob Example", detect_authors(path)
    print("PASS author metadata, CJK/Latin names, byline fallback, affiliation markers, columns and abstract boundary")

    def upload(content, **fields):
        return client.post("/api/import", files={"file": ("sample.pdf", content, "application/pdf")}, data=fields)

    content = pdf()
    response = upload(content)
    assert response.status_code == 200, response.text
    paper = response.json()
    assert paper["title"] == expected
    assert paper["authors"] == "Alice Example, Bob Example"
    pid = paper["id"]
    assert upload(content).status_code == 409
    manual = upload(pdf("A Different Paper Metadata Title"), auto_title="false").json()
    assert manual["title"] == "sample"
    assert manual["authors"] == "Alice Example, Bob Example", "title toggle must not disable authors"
    blank = upload(pdf(text=False)).json()
    assert blank["title"] == "sample"
    assert blank["authors"] == ""
    note = client.post(f"/api/papers/{pid}/notes", json={"title": "note", "content": "keep me"}).json()
    before = store.paper_file(pid).read_bytes()
    renamed = client.patch(f"/api/papers/{pid}", json={"title": "  新的论文名称  \n Test  "})
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["title"] == "新的论文名称 Test"
    assert renamed.json()["hash"] == hashlib.sha256(before).hexdigest()
    assert store.paper_file(pid).read_bytes() == before
    assert client.get(f"/api/papers/{pid}/notes").json()[0]["id"] == note["id"]
    assert client.patch(f"/api/papers/{pid}", json={"title": "  "}).status_code == 400
    assert client.patch(f"/api/papers/{pid}", json={"title": "x" * 501}).status_code == 400
    assert client.patch("/api/papers/missing", json={"title": "valid"}).status_code == 404
    assert client.patch(f"/api/papers/{pid}", json={"fav": True}).json()["title"] == "新的论文名称 Test"
    assert "filename*=utf-8''" in client.get(f"/api/papers/{pid}/file").headers["content-disposition"]
    from store import Store
    assert Store().get_paper(pid)["title"] == "新的论文名称 Test"
    assert Store().get_paper(pid)["authors"] == "Alice Example, Bob Example"
    assert upload(b"invalid pdf").status_code == 400
    print("PASS import toggle/fallback, duplicate detection, validated persistent rename, PDF/note preservation, export name")
