"""Independently installed pdf2zh 1.x runtimes; bundled Python stays immutable."""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import threading
import urllib.request
import uuid


class PluginManager:
    def __init__(self, root, guard=None):
        self.root = Path(root)
        self.guard = guard or (lambda: None)
        self.lock = threading.RLock()
        self.cancelled = threading.Event()
        self.proc = None
        self.state = {"status": "idle", "message": "", "latest": "", "available": False}

    def _pointer(self):
        try:
            value = json.loads((self.root / "active.json").read_text(encoding="utf8"))
            name = value["directory"]
            if not re.fullmatch(r"pdf2zh-1\.[0-9]+\.[0-9]+-[a-f0-9]{12}", name):
                return None
            folder = self.root / name
            if folder.is_symlink() or not (folder / "ready.json").is_file():
                return None
            ready = json.loads((folder / "ready.json").read_text(encoding="utf8"))
            if ready["version"] != value["version"] or not self._python(folder).is_file():
                return None
            return value
        except (OSError, ValueError, KeyError, TypeError):
            return None

    @staticmethod
    def _python(folder):
        if os.name == "nt":
            return folder / ("python.exe" if (folder / "python.exe").exists() else "Scripts/python.exe")
        return folder / "bin/python"

    def command(self):
        with self.lock:
            active = self._pointer()
            if active:
                return [str(self._python(self.root / active["directory"])), "-B",
                        str(Path(__file__).with_name("pdf2zh_cli.py"))]
            return None

    def snapshot(self):
        with self.lock:
            active = self._pointer()
            try:
                bundled = importlib.metadata.version("pdf2zh")
            except importlib.metadata.PackageNotFoundError:
                bundled = ""
            return {**self.state, "current": active["version"] if active else bundled,
                    "source": "independent" if active else "bundled", "can_restore": bool(active),
                    "directory": str(self.root), "busy": self.state["status"] in {"checking", "installing"}}

    def _set(self, **fields):
        with self.lock:
            self.state.update(fields)

    @staticmethod
    def _json(url):
        request = urllib.request.Request(url, headers={"User-Agent": "LitHub-plugin-updater/1"})
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError("版本信息过大")
        return json.loads(raw)

    @staticmethod
    def _latest(metadata):
        versions = []
        for version, files in metadata.get("releases", {}).items():
            if re.fullmatch(r"1\.[0-9]+\.[0-9]+", version) and any(not f.get("yanked") for f in files):
                versions.append(version)
        if not versions:
            raise ValueError("未找到兼容的 pdf2zh 1.x 正式版")
        return max(versions, key=lambda v: tuple(map(int, v.split("."))))

    def start(self, operation):
        with self.lock:
            if self.snapshot()["busy"]:
                raise ValueError("插件操作正在进行，请稍候")
            if operation == "restore":
                self.guard()
                (self.root / "active.json").unlink(missing_ok=True)
                self.state.update(status="idle", message="已恢复内置插件", available=False)
                return self.snapshot()
            if operation not in {"check", "install"}:
                raise ValueError("未知插件操作")
            if operation == "install":
                self.guard()
            self.cancelled.clear()
            self.state.update(status="checking" if operation == "check" else "installing", message="正在检查 PyPI 版本…")
            threading.Thread(target=self._work, args=(operation,), daemon=True).start()
            return self.snapshot()

    def cancel(self):
        with self.lock:
            self.cancelled.set()
            if self.snapshot()["busy"]:
                self.state["message"] = "正在取消插件更新…"
            if self.proc and self.proc.poll() is None:
                self.proc.kill()
            return self.snapshot()

    def _check_cancel(self):
        if self.cancelled.is_set():
            raise InterruptedError("已取消插件更新")

    def _run(self, cmd, timeout=1200):
        self._check_cancel()
        # No upstream API keys or developer pip indexes/configuration enter the installer.
        env = {k: v for k, v in os.environ.items() if not k.startswith(("PIP_", "PYTHON", "OPENAI_"))}
        env.update(PYTHONIOENCODING="utf-8", PIP_CONFIG_FILE=os.devnull,
                   PIP_DISABLE_PIP_VERSION_CHECK="1", PIP_NO_INPUT="1")
        log = self.root / "install.log"
        with log.open("w", encoding="utf8") as output:
            with self.lock:
                self._check_cancel()
                proc = subprocess.Popen(cmd, stdout=output, stderr=subprocess.STDOUT, env=env,
                                        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                self.proc = proc
            try:
                code = proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                raise ValueError("插件安装超时，请检查网络后重试")
            finally:
                with self.lock:
                    self.proc = None
        self._check_cancel()
        if code:
            raise ValueError("插件安装或兼容性验证失败，原插件保持可用。详情见插件目录 install.log")

    def _environment(self, folder):
        source = Path(sys.executable).parent
        if os.name == "nt" and list(source.glob("python*._pth")):
            folder.mkdir()
            for item in source.iterdir():
                if item.is_file() and item.suffix.lower() in {".exe", ".dll", ".pyd", ".zip"}:
                    shutil.copy2(item, folder / item.name)
            (folder / "Lib/site-packages").mkdir(parents=True)
            pth = next(source.glob("python*._pth"))
            (folder / pth.name).write_text(
                f"python{sys.version_info.major}{sys.version_info.minor}.zip\n.\nLib/site-packages\nimport site\n", encoding="ascii")
        else:
            self._run([sys.executable, "-m", "venv", "--without-pip", str(folder)], timeout=120)

    def _bootstrap(self, folder):
        # A universal wheel is sufficient to execute pip, even in embedded Python without ensurepip.
        data = self._json("https://pypi.org/pypi/pip/25.3/json")
        wheel = next(f for f in data["urls"] if f["filename"].endswith("-py3-none-any.whl") and not f.get("yanked"))
        from urllib.parse import urlsplit
        url = urlsplit(wheel["url"])
        if url.scheme != "https" or url.hostname != "files.pythonhosted.org" or url.username or url.port:
            raise ValueError("无效的 pip 下载地址")
        target = folder / "pip-bootstrap.whl"
        digest = hashlib.sha256()
        total = 0
        with urllib.request.urlopen(wheel["url"], timeout=30) as response, target.open("wb") as output:
            while chunk := response.read(256 * 1024):
                self._check_cancel()
                total += len(chunk)
                if total > 10_000_000:
                    raise ValueError("pip 下载文件过大")
                digest.update(chunk)
                output.write(chunk)
        if digest.hexdigest() != wheel["digests"]["sha256"]:
            raise ValueError("pip 校验失败")
        return target

    def _work(self, operation):
        folder = None
        try:
            latest = self._latest(self._json("https://pypi.org/pypi/pdf2zh/json"))
            self._check_cancel()
            current = self.snapshot()["current"]
            available = not re.fullmatch(r"1\.[0-9]+\.[0-9]+", current) or tuple(map(int, latest.split("."))) > tuple(map(int, current.split(".")))
            self._set(latest=latest, available=available)
            if operation == "check":
                self._set(status="idle", message="发现兼容新版" if available else "当前已是兼容的最新版本")
                return
            self.root.mkdir(parents=True, exist_ok=True)
            folder = self.root / f"pdf2zh-{latest}-{uuid.uuid4().hex[:12]}"
            self._set(message="正在创建独立 Python 环境…")
            self._environment(folder)
            self._check_cancel()
            self._set(message="正在下载插件及依赖，首次安装可能需要几分钟…")
            wheel = self._bootstrap(folder)
            code = "import sys,runpy;sys.path.insert(0,sys.argv.pop(1));runpy.run_module('pip',run_name='__main__')"
            self._run([str(self._python(folder)), "-B", "-c", code, str(wheel), "install",
                       "--index-url", "https://pypi.org/simple", "--only-binary=:all:", "--no-cache-dir", "--no-compile",
                       "--target", str(folder / "Lib/site-packages" if os.name == "nt"
                                     else folder / f"lib/python{sys.version_info.major}.{sys.version_info.minor}/site-packages"),
                       f"pdf2zh=={latest}", "bitstring==4.4.0", "numpy==2.3.5", "scipy==1.15.2",
                       "tencentcloud-sdk-python-tmt==3.0.1478", "tencentcloud-sdk-python-common==3.1.185"])
            self._set(message="正在验证插件命令与版本…")
            probe = ("import sys,runpy;from pathlib import Path;from importlib.metadata import version;"
                     "assert version('pdf2zh')==sys.argv[1];home=Path(sys.argv[2]);"
                     "Path.home=classmethod(lambda cls:home);cli=sys.argv[3];"
                     "sys.argv=[cli,'--help'];runpy.run_path(cli,run_name='__main__')")
            home = folder / "probe-home"
            home.mkdir()
            self._run([str(self._python(folder)), "-B", "-c", probe, latest, str(home),
                       str(Path(__file__).with_name("pdf2zh_cli.py"))], timeout=120)
            self._check_cancel()
            wheel.unlink()
            ready = {"directory": folder.name, "version": latest}
            (folder / "ready.json").write_text(json.dumps(ready), encoding="utf8")
            with self.lock:
                self._check_cancel()
                self.guard()
                pending = self.root / "active.pending.json"
                pending.write_text(json.dumps(ready), encoding="utf8")
                os.replace(pending, self.root / "active.json")
                folder = None  # The verified environment now belongs to the active installation.
                self.state.update(status="idle", available=False, message="插件已更新，下一次翻译立即生效")
        except InterruptedError:
            self._set(status="idle", message="已取消更新，继续使用原插件")
        except Exception as exc:
            self._set(status="error", message=str(exc))
        finally:
            if folder and folder.exists():
                shutil.rmtree(folder, ignore_errors=True)


program = Path(os.environ.get("LITHUB_PROGRAM_DIR") or Path(__file__).resolve().parent.parent)
manager = PluginManager(program / "translation-plugins/pdf2zh")
