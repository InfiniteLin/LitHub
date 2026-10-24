"""PDF attachments live independently of library metadata. Never delete the source."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import uuid


def digest(file):
    with Path(file).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def inside(child, parent):
    return child == parent or parent in child.parents


def writable(directory):
    directory.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryFile(dir=directory):
        pass


class PdfStorage:
    marker = '.lithub-pdf-storage.json'

    def __init__(self, data_dir, program_dir, default_dir=None):
        self.legacy = Path(data_dir).resolve()
        self.program = Path(program_dir).resolve()
        self.default = Path(default_dir).resolve() if default_dir else self.program / 'pdfs'
        self.root = self.legacy
        self.warning = ''

    @property
    def files(self): return self.root / 'files'

    @property
    def out(self): return self.root / 'out'

    def initialize(self, db, save):
        db.setdefault('library_id', uuid.uuid4().hex)
        configured = db['settings'].get('pdf_storage_dir')
        if configured:
            self.root = Path(configured).resolve()
            try:
                if db['papers'] and not self.files.is_dir():
                    raise ValueError('已设置的 PDF 目录不可用，请检查磁盘或在设置中选择保留副本的目录')
                writable(self.root)
                self.files.mkdir(exist_ok=True)
                self.out.mkdir(exist_ok=True)
            except (OSError, ValueError) as exc:
                self.warning = str(exc)
            return
        if db['papers']:
            # An old, large library must not block sidecar startup or be silently moved.
            # The settings page performs its verified migration after explicit application.
            self.warning = '检测到已有文献，当前沿用旧目录；选择“使用默认目录”并应用即可迁移至程序文件夹。'
            return
        try:
            self.change(db, self.default, save)
        except (OSError, ValueError) as exc:
            # Existing libraries remain readable if the executable folder is protected.
            # Fresh installs use the user-writable data directory as a fallback.
            self.warning = f'默认目录不可用，当前使用文献库目录：{exc}'
            writable(self.legacy)
            self.files.mkdir(exist_ok=True)
            self.out.mkdir(exist_ok=True)

    def info(self):
        return {'directory': str(self.root), 'originals_directory': str(self.files),
                'translated_directory': str(self.out), 'default_directory': str(self.default),
                'metadata_directory': str(self.legacy), 'warning': self.warning,
                'is_default': self.root == self.default}

    def change(self, db, directory, save):
        if not str(directory).strip() or not Path(directory).expanduser().is_absolute():
            raise ValueError('请选择完整的文件夹路径')
        target = Path(directory).expanduser().resolve()
        if target == self.root:
            if any(not (self.files / f'{pid}.pdf').is_file() for pid in db['papers']):
                raise ValueError('当前目录的 PDF 文件缺失，请先恢复文件或选择保留副本的目录')
            writable(target)
            self.files.mkdir(exist_ok=True)
            self.out.mkdir(exist_ok=True)
            previous = db['settings'].get('pdf_storage_dir')
            db['settings']['pdf_storage_dir'] = str(target)
            try:
                save()
            except Exception:
                if previous is None:
                    db['settings'].pop('pdf_storage_dir', None)
                else:
                    db['settings']['pdf_storage_dir'] = previous
                raise
            self.warning = ''
            return {**self.info(), 'copied_files': 0}
        if any(task.get('status') in ('running', 'queued') for task in db['tasks'].values()):
            raise ValueError('请等待翻译任务结束后再切换 PDF 目录')
        if target != self.default and inside(target, self.program) and not inside(target, self.program / 'pdfs'):
            raise ValueError('程序文件夹内请使用 pdfs 目录；其他磁盘可自由选择文件夹')
        # Managed trees cannot contain each other, even through a junction/symlink.
        for old in (self.files.resolve(), self.out.resolve()):
            for new in ((target / 'files').resolve(), (target / 'out').resolve()):
                if inside(old, new) or inside(new, old):
                    raise ValueError('新目录不能与当前 PDF 子目录重叠')
        writable(target)
        library_id = db.setdefault('library_id', uuid.uuid4().hex)
        marker = target / self.marker
        if marker.exists():
            if json.loads(marker.read_text(encoding='utf-8')).get('library_id') != library_id:
                raise ValueError('目标目录属于其他文献库，请选择空文件夹')
        elif target != self.legacy and any((target / name).exists() and any((target / name).iterdir())
                                          for name in ('files', 'out')):
            raise ValueError('目标目录已有文件，请选择空文件夹，避免覆盖已有文献')
        for name in ('files', 'out'):
            tree = target / name
            if tree.exists():
                for entry in [tree, *tree.rglob('*')]:
                    if entry.is_symlink() or (hasattr(entry, 'is_junction') and entry.is_junction()):
                        raise ValueError('目标目录包含链接，请选择实际文件夹')
        lock = target / '.lithub-pdf-migration.lock'
        try:
            guard = lock.open('x', encoding='utf-8')
        except FileExistsError:
            raise ValueError('目标目录正在迁移，请稍后重试')
        created, copied = [], 0
        previous_settings = dict(db['settings'])
        previous_paths = {pid: {key: paper.get(key) for key in ('translated_file', 'translated_dual_file')}
                          for pid, paper in db['papers'].items()}
        marker_created = False
        try:
            guard.write(library_id)
            guard.close()
            for name in ('files', 'out'):
                source_tree = self.root / name
                destination_tree = target / name
                destination_tree.mkdir(exist_ok=True)
                if not source_tree.exists():
                    continue
                for source in source_tree.rglob('*'):
                    if source.is_symlink() or not inside(source.resolve(), source_tree.resolve()):
                        raise ValueError('PDF 目录含外部链接，请先将链接替换为实际文件')
                    destination = destination_tree / source.relative_to(source_tree)
                    if source.is_dir():
                        destination.mkdir(exist_ok=True)
                        continue
                    if not source.is_file():
                        continue
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    if destination.exists():
                        if digest(source) != digest(destination):
                            raise ValueError(f'目标文件内容不同，已停止迁移：{destination.name}')
                        continue
                    # Exclusive creation never replaces a file created by another process.
                    with destination.open('xb') as output:
                        created.append(destination)
                        with source.open('rb') as original:
                            shutil.copyfileobj(original, output)
                    if digest(source) != digest(destination):
                        raise OSError(f'复制校验失败：{source.name}')
                    copied += 1
            for pid, paper in db['papers'].items():
                original = target / 'files' / f'{pid}.pdf'
                if not original.is_file():
                    raise ValueError(f'原文文件缺失，未切换目录：{paper.get("title", pid)}')
                if paper.get('hash') and digest(original) != paper['hash']:
                    raise ValueError(f'原文校验失败：{paper.get("title", pid)}')
                for key in ('translated_file', 'translated_dual_file'):
                    if paper.get(key):
                        old = Path(paper[key]).resolve()
                        if inside(old, self.root):
                            relocated = target / old.relative_to(self.root)
                            if not relocated.is_file():
                                raise ValueError(f'译文文件缺失，未切换目录：{paper.get("title", pid)}')
                            paper[key] = str(relocated)
            if not marker.exists():
                with marker.open('x', encoding='utf-8') as stream:
                    json.dump({'library_id': library_id, 'version': 1}, stream)
                marker_created = True
            db['settings']['pdf_storage_dir'] = str(target)
            save()
            previous = self.root
            self.root = target
            self.warning = ''
            return {**self.info(), 'copied_files': copied, 'previous_directory': str(previous)}
        except Exception:
            db['settings'] = previous_settings
            for pid, fields in previous_paths.items():
                db['papers'][pid].update(fields)
            for file in reversed(created):
                file.unlink(missing_ok=True)
            if marker_created:
                marker.unlink(missing_ok=True)
            raise
        finally:
            guard.close()
            lock.unlink(missing_ok=True)
