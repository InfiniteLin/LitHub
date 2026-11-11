"""Keep note contents and attachments beside the program, separately per library."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile


class NoteStorage:
    def __init__(self, data_dir, program_dir, library_id, previous=None):
        if not isinstance(library_id, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', library_id):
            raise ValueError('无效的文献库标识，无法打开笔记目录')
        self.root = Path(program_dir) / 'notes' / library_id
        self.images = self.root / 'images'
        self.file = self.root / 'notes.json'
        self.legacy = Path(data_dir) / 'notes'
        self.library_id = library_id
        self.previous = Path(previous) if previous else None
        self._saved = None

    def load(self, legacy_notes):
        self.images.mkdir(parents=True, exist_ok=True)
        if self.file.exists():
            data = json.loads(self.file.read_text(encoding='utf8'))
            if data.get('library_id') != self.library_id or not isinstance(data.get('notes'), dict):
                raise ValueError(f'笔记文件格式不正确：{self.file}')
            self._saved = self.file.read_text(encoding='utf8')
            return data['notes']
        if self.previous:
            old_file = self.previous / 'notes.json'
            if not old_file.is_file():
                raise FileNotFoundError(f'原笔记目录不可用，请恢复后再启动：{self.previous}')
            old = json.loads(old_file.read_text(encoding='utf8'))
            if old.get('library_id') != self.library_id or not isinstance(old.get('notes'), dict):
                raise ValueError(f'原笔记文件格式不正确：{old_file}')
            legacy_notes = old['notes']
            self.legacy = self.previous / 'images'
        # Copy before switching the index. Interrupted copies can safely resume;
        # the old library and images are retained as the migration backup.
        if self.legacy.is_dir():
            for source in self.legacy.iterdir():
                if not source.is_file() or not re.fullmatch(r'[a-f0-9]{32}\.(png|jpg|jpeg|gif|webp|svg)', source.name, re.I):
                    continue
                target = self.images / source.name
                original = hashlib.sha256(source.read_bytes()).digest()
                if target.exists():
                    if hashlib.sha256(target.read_bytes()).digest() == original:
                        continue
                    raise ValueError(f'笔记图片冲突，原文件已保留：{source.name}')
                temporary = target.with_suffix(target.suffix + '.tmp')
                shutil.copyfile(source, temporary)
                if hashlib.sha256(temporary.read_bytes()).digest() != original:
                    raise OSError(f'笔记图片复制校验失败：{source.name}')
                os.replace(temporary, target)
        if legacy_notes:
            backup = self.root / 'migration-backup.json'
            if not backup.exists():
                backup.write_text(json.dumps(legacy_notes, ensure_ascii=False, indent=1), encoding='utf8')
        self.save(legacy_notes)
        return legacy_notes

    def save(self, notes):
        text = json.dumps({'format': 1, 'library_id': self.library_id, 'notes': notes}, ensure_ascii=False, indent=1)
        if text == self._saved:
            return
        self.root.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf8', dir=self.root, delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(text)
            os.replace(temporary, self.file)
            self._saved = text
        finally:
            if temporary:
                temporary.unlink(missing_ok=True)
