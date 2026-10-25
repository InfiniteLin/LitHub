"""Exercise the production NSIS ZIP decoder in an isolated Chinese directory."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

root = Path(__file__).resolve().parents[1]
config = json.loads(subprocess.check_output(
    ['node', '-e', 'console.log(JSON.stringify(require("./electron-builder.config.js")))'],
    cwd=root, text=True, encoding='utf-8'))
name = config['executableName'] + '.exe'
assert name.isascii(), name
assert config['nsis']['shortcutName'] == '文枢 LitHub'
cache = Path(os.environ['LOCALAPPDATA']) / 'electron-builder/Cache/nsis'
compiler = next(cache.glob('nsis-*/makensis.exe'))
plugins = next(cache.glob('nsis-resources-*')) / 'plugins/x86-unicode'
with tempfile.TemporaryDirectory(prefix='lithub-filenames-') as temp:
    folder = Path(temp)
    output = folder / '中文安装目录'
    payload = folder / 'payload.zip'
    unpacked = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'release/install-optimized/win-unpacked'
    binary = (unpacked / name).read_bytes()
    with zipfile.ZipFile(payload, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(name, binary)
    script = folder / 'fixture.nsi'
    fixture = folder / 'fixture.exe'
    script.write_text(f'''Unicode true
RequestExecutionLevel user
Name "LitHub filename test"
OutFile "{fixture}"
SilentInstall silent
!addplugindir "{plugins}"
Section
 InitPluginsDir
 CreateDirectory "{output}"
 File /oname=$PLUGINSDIR\\payload.zip "{payload}"
 nsisunz::Unzip "$PLUGINSDIR\\payload.zip" "{output}"
 Pop $0
 StrCmp $0 "success" +3
 SetErrorLevel 1
 Quit
SectionEnd
''', encoding='utf-8-sig')
    subprocess.run([str(compiler), '/V2', str(script)], check=True, capture_output=True)
    subprocess.run([str(fixture), '/S'], check=True, timeout=60)
    assert sorted(p.name for p in output.iterdir()) == [name]
    assert (output / name).read_bytes() == binary
    print('PASS production NSIS ZIP decoder: LitHub.exe preserved in Chinese installation directory')
