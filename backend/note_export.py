"""Portable note exports. Only package our own image files; never fetch URLs."""
import io
import re
import zipfile
from pathlib import Path
from urllib.parse import urlsplit


def export_name(title):
    title = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', title or '未命名笔记').strip(' .')[:100]
    if not title or re.fullmatch(r'(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])', title, re.I):
        title = '笔记_' + title
    return title


def export_note(note, image_dir):
    assets = {}
    def replace(match):
        url = match.group(0)
        parsed = urlsplit(url)
        if parsed.netloc and parsed.hostname not in ('127.0.0.1', 'localhost', '::1'):
            return url
        name = Path(parsed.path).name
        if not re.fullmatch(r'[a-f0-9]{32}\.(png|jpg|jpeg|gif|webp|svg)', name):
            return url
        source = image_dir / name
        if not source.is_file():
            raise FileNotFoundError(f'笔记图片缺失：{name}')
        assets[name] = source
        return 'images/' + name
    content = re.sub(r'(?:https?://[^\s<>"\x27)]+)?/api/notes/image/[a-f0-9]{32}\.(?:png|jpg|jpeg|gif|webp|svg)\b',
                     replace, note.get('content') or '')
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(export_name(note.get('title')) + '.md', content)
        for name, source in assets.items():
            archive.write(source, 'images/' + name)
    return buffer.getvalue()
