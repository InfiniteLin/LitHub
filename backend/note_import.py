"""Import Markdown bytes and optional companion images from a ZIP, without extracting paths."""
import io
import html
import posixpath
import re
import uuid
import zipfile
from pathlib import PurePosixPath
from urllib.parse import unquote, urlsplit

MAX_BYTES = 20 * 1024 * 1024
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'}


def decode_markdown(data):
    if len(data) > 5 * 1024 * 1024:
        raise ValueError('Markdown 文件不能超过 5 MB')
    if data.startswith((b'\xff\xfe', b'\xfe\xff')):
        return data.decode('utf-16')
    for encoding in ('utf-8-sig', 'gb18030'):
        try:
            text = data.decode(encoding)
            if '\0' in text:
                raise ValueError('文件不是有效的 Markdown 文本')
            return text
        except UnicodeDecodeError:
            continue
    raise ValueError('无法识别文本编码，请将文件另存为 UTF-8')


def prepare_import(filename, data):
    if len(data) > MAX_BYTES:
        raise ValueError('导入文件不能超过 20 MB')
    images = {}
    warnings = []
    suffix = PurePosixPath(filename.replace('\\', '/')).suffix.lower()
    if suffix in {'.md', '.markdown'}:
        name = PurePosixPath(filename.replace('\\', '/')).name
        content = decode_markdown(data)
        archive_files = {}
    elif suffix == '.zip':
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                entries = archive.infolist()
                if len(entries) > 300 or sum(e.file_size for e in entries) > 40 * 1024 * 1024:
                    raise ValueError('压缩包包含过多文件或解压后超过 40 MB')
                archive_files = {}
                for entry in entries:
                    parts = PurePosixPath(entry.filename).parts
                    if ('\\' in entry.filename or entry.filename.startswith('/') or
                            any(p in {'.', '..'} or ':' in p for p in entry.filename.rstrip('/').split('/')) or
                            (entry.external_attr >> 16) & 0o170000 == 0o120000 or entry.flag_bits & 1):
                        raise ValueError('压缩包包含非法路径、链接或加密文件')
                    if not entry.is_dir():
                        if entry.filename in archive_files:
                            raise ValueError('压缩包包含重复文件')
                        archive_files[entry.filename] = archive.read(entry)
                notes = [n for n in archive_files if PurePosixPath(n).suffix.lower() in {'.md', '.markdown'}]
                if len(notes) != 1:
                    raise ValueError('每个 ZIP 中请只放一个 Markdown 文件及其图片附件')
                name = notes[0]
                content = decode_markdown(archive_files[name])
        except zipfile.BadZipFile as exc:
            raise ValueError('ZIP 文件损坏') from exc
    else:
        raise ValueError('请选择 .md、.markdown 或包含笔记及图片的 ZIP 文件')

    imported_paths = {}
    def replace_image(match):
        raw = match.groupdict().get('angle') or match.group('url')
        source = html.unescape(raw) if match.group(0).lower().startswith('<img') else raw
        parsed = urlsplit(source)
        if parsed.scheme in {'http', 'https', 'data'} or source.startswith('/api/notes/image/'):
            return match.group(0)
        local = posixpath.normpath(posixpath.join(posixpath.dirname(name), unquote(parsed.path)))
        blob = archive_files.get(local)
        ext = PurePosixPath(local).suffix.lower()
        if blob is None or ext not in IMAGE_EXTENSIONS or len(blob) > 8 * 1024 * 1024:
            warnings.append('本地图片未导入：' + source)
            return match.group(0)
        if local not in imported_paths:
            image_name = uuid.uuid4().hex + ext
            imported_paths[local] = image_name
            images[image_name] = blob
        return match.group(0).replace(raw, '/api/notes/image/' + imported_paths[local], 1)

    # Rewrite actual images while leaving Markdown examples inside code intact.
    def rewrite(text):
        text = re.sub(r'!\[[^\]\n]*\]\(\s*(?:<(?P<angle>[^>\n]+)>|(?P<url>(?:[^\s()]+|\([^()]*\))+))(?:\s+["\x27][^\n]*?["\x27])?\s*\)', replace_image, text)
        return re.sub(r'<img\b[^>]*?\bsrc=["\x27](?P<url>[^"\x27]+)["\x27][^>]*>', replace_image, text, flags=re.I)
    code = re.compile(r'(?m)^ {0,3}(?P<fence>`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}(?P=fence)[ \t]*(?=\n|$)|\Z)|(?P<ticks>`+)[^\n]*?(?P=ticks)')
    parts, end = [], 0
    for match in code.finditer(content):
        parts.extend((rewrite(content[end:match.start()]),match.group(0)))
        end=match.end()
    content=''.join(parts)+rewrite(content[end:])
    title = PurePosixPath(name).stem[:120]
    return {'title': title, 'content': content, 'images': images, 'warnings': list(dict.fromkeys(warnings))}
