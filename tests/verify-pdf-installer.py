"""Compile/run isolated NSIS fixtures; all removal targets are private temporary folders."""
import os
from pathlib import Path
import subprocess
import tempfile

project = Path(__file__).resolve().parents[1]
compiler = next((Path(os.environ['LOCALAPPDATA']) / 'electron-builder/Cache/nsis').glob('nsis-*/makensis.exe'))
template = (project / 'node_modules/app-builder-lib/templates/nsis/uninstaller.nsh').read_text(encoding='utf-8')
functions = []
for name in ('un.atomicRMDir', 'un.restoreFiles'):
    start = template.index('Function ' + name + '\n')
    end = template.index('FunctionEnd', start) + len('FunctionEnd')
    functions.append(template[start:end])

with tempfile.TemporaryDirectory(prefix='lithub-installer-test-') as temporary:
    base = Path(temporary).resolve()
    assert base.is_relative_to(Path(tempfile.gettempdir()).resolve())
    for updated in (False, True):
        fixture = base / ('update' if updated else 'uninstall')
        install = fixture / 'installed'
        assert install.is_relative_to(base)
        (install / 'resources').mkdir(parents=True)
        (install / 'pdfs/files').mkdir(parents=True)
        (install / 'app.exe').write_bytes(b'application binary')
        (install / 'resources/engine.bin').write_bytes(b'runtime binary')
        pdf = install / 'pdfs/files/keep.pdf'
        pdf.write_bytes(b'user PDF fixture')
        script = f'''Unicode true
RequestExecutionLevel user
Name "LitHub storage fixture"
OutFile "{fixture / 'fixture.exe'}"
InstallDir "{install}"
SilentInstall silent
SilentUnInstall silent
!include "LogicLib.nsh"
!define isUpdated '"{int(updated)}" == "1"'
!define UNINSTALL_FILENAME "test-uninstall.exe"
!include "{project / 'build/preserve-pdfs.nsh'}"
{chr(10).join(functions)}
Function un.onInit
 InitPluginsDir
FunctionEnd
Section "install"
 WriteUninstaller "$EXEDIR\\test-uninstall.exe"
SectionEnd
Section "un.test"
 !insertmacro customRemoveFiles
SectionEnd
'''
        source = fixture / 'fixture.nsi'
        source.write_text(script, encoding='utf-8-sig')
        flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        subprocess.run([str(compiler), '/V2', str(source)], check=True, creationflags=flags)
        subprocess.run([str(fixture / 'fixture.exe'), '/S'], check=True, creationflags=flags, timeout=20)
        subprocess.run([str(fixture / 'test-uninstall.exe'), '/S', f'_?={install}'],
                       check=True, creationflags=flags, timeout=20)
        assert pdf.read_bytes() == b'user PDF fixture'
        assert not (install / 'app.exe').exists()
        assert not (install / 'resources').exists()
        print(f'PASS NSIS {"update" if updated else "uninstall"} removes binaries and preserves program-local PDFs')
