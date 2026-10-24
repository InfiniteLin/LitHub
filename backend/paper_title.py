"""Local, bounded PDF title detection. No network or model credentials required."""
import re
import unicodedata
from pathlib import Path

import fitz


def clean_title(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    return re.sub(r"\s+", " ", "".join(c for c in value if not unicodedata.category(c).startswith("C") or c.isspace())).strip()


def usable_title(value: str, filename: str = "", *, fragment: bool = False) -> bool:
    minimum = 2 if fragment else (4 if re.search(r"[\u3400-\u9fff]", value) else 8)
    if not minimum <= len(value) <= 500 or sum(c.isalpha() for c in value) < max(2, minimum - 2):
        return False
    lower = value.lower()
    if lower in {"untitled", "document", "unknown", "microsoft word", "latex", "title", "论文标题"}:
        return False
    if re.search(r"(?:\.pdf|\.docx?|\.tex)$|^(?:microsoft word|arxiv:|https?://|doi:|abstract\b|摘要)", lower):
        return False
    if filename and lower == Path(filename).stem.lower():
        return False
    return True


def detect_title(path: Path, filename: str, *, prefer_metadata: bool = True) -> str | None:
    """Prefer meaningful metadata; otherwise rank adjacent large-font first-page lines.

    Only the first page is inspected. Uncertain/image-only documents keep their filename.
    """
    try:
        with fitz.open(path) as doc:
            metadata = clean_title((doc.metadata or {}).get("title", ""))
            if prefer_metadata and usable_title(metadata, filename):
                return metadata
            if not doc.page_count:
                return None
            page = doc[0]
            lines = []
            for block in page.get_text("dict").get("blocks", []):
                for line in block.get("lines", []):
                    spans = [s for s in line.get("spans", []) if s.get("text", "").strip()]
                    if not spans:
                        continue
                    text = clean_title(" ".join(s["text"] for s in spans))
                    size = max(s["size"] for s in spans)
                    box = line["bbox"]
                    if box[1] < page.rect.height * .48 and box[1] > page.rect.height * .025:
                        lines.append((box, size, text))
            lines.sort(key=lambda item: (round(item[0][1], 1), item[0][0]))
            candidates = []
            for i, (box, size, text) in enumerate(lines):
                if size < 12 or not usable_title(text, fragment=True):
                    continue
                parts = [text]
                bottom = box[3]
                for next_box, next_size, next_text in lines[i + 1:i + 5]:
                    if (abs(next_size - size) > size * .12 or next_box[1] < bottom - size * .35
                            or next_box[1] - bottom > size * 1.3
                            or not usable_title(next_text, fragment=True)):
                        break
                    parts.append(next_text)
                    bottom = next_box[3]
                title = clean_title(" ".join(parts))
                if usable_title(title) and not re.search(r"@|\b(?:university|institute|proceedings|copyright|conference on)\b", title, re.I):
                    score = size + min(len(title), 100) * .025 - box[1] / page.rect.height * 4
                    candidates.append((score, title))
            return max(candidates, default=(0, None))[1]
    except Exception:
        # Title extraction must never make an otherwise valid PDF fail to import.
        return None
