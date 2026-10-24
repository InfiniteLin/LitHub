"""Conservative local author extraction from metadata and the first-page byline."""
import re
from pathlib import Path

import fitz

from paper_title import clean_title, detect_title


def author_names(value: str) -> str:
    value = re.sub(r"[\d*†‡§✉]+", "", value or "")
    value = clean_title(value).strip(" ,;，；")
    if not value or len(value) > 1500:
        return ""
    if re.search(r"@|https?://|\b(?:university|institute|department|school|laboratory|research|inc|corp|abstract|introduction|copyright|anonymous|unknown|admin|user|author|authors|microsoft|adobe|acrobat|latex|overleaf|preprint|arxiv|conference|proceedings|submitted|accepted|equal|contribution|corresponding)\b|大学|学院|实验室|匿名|未知|摘要|作者|单位", value, re.I):
        return ""
    if re.fullmatch(r"[\u3400-\u9fff]{2,4}(?:\s+[\u3400-\u9fff]{2,4})+", value):
        value = re.sub(r"\s+", ", ", value)
    names = re.split(r"\s*(?:[,;，；、&]|\band\b)\s*|\s{2,}", value)
    result = []
    for name in names:
        name = name.strip(" .")
        if not name:
            continue
        if re.fullmatch(r"[\u3400-\u9fff]{2,4}(?:·[\u3400-\u9fff]{2,4})?", name):
            pass
        else:
            words = name.split()
            if not 2 <= len(words) <= 5:
                return ""
            for word in words:
                if not re.fullmatch(r"[^\W\d_]+(?:[.'’\-][^\W\d_]+)*\.?", word, re.UNICODE):
                    return ""
                if not word[0].isupper() and word.lower() not in {"van", "von", "de", "del", "der", "da", "dos", "di", "la", "le"}:
                    return ""
        if name not in result:
            result.append(name)
    return ", ".join(result)


def detect_authors(path: Path, filename: str = "") -> str:
    try:
        with fitz.open(path) as doc:
            metadata = author_names((doc.metadata or {}).get("author", ""))
            if metadata:
                return metadata
            if not doc.page_count:
                return ""
            page = doc[0]
            lines = []
            for block in page.get_text("dict").get("blocks", []):
                for line in block.get("lines", []):
                    spans = [s for s in line.get("spans", []) if s.get("text", "").strip()]
                    if spans:
                        # Superscript affiliation marks are separate spans in most papers.
                        text = clean_title(" ".join(s["text"] for s in spans if not (s.get("flags", 0) & 1)))
                        lines.append((line["bbox"], max(s["size"] for s in spans), text))
            # Use visible title geometry; metadata titles may differ from the printed title.
            title = detect_title(path, filename, prefer_metadata=False)
            title_lines = [box for box, size, text in lines if title and len(text) >= 4 and text in title
                           and box[1] < page.rect.height * .48]
            if not title_lines:
                return ""
            start = max(box[3] for box in title_lines)
            end = min(start + 180, page.rect.height * .58)
            for box, size, text in lines:
                if box[1] >= start - 2 and re.match(r"^(?:abstract\b|摘要|(?:1[. ]+)?introduction\b)", text, re.I):
                    end = min(end, box[1])
            names = []
            for box, size, text in sorted(lines, key=lambda line: (round(line[0][1] / 4), line[0][0])):
                if start - 2 <= box[1] < end and size >= 8:
                    detected = author_names(text)
                    for name in detected.split(", ") if detected else []:
                        if name not in names:
                            names.append(name)
            return ", ".join(names)[:1500]
    except Exception:
        return ""
