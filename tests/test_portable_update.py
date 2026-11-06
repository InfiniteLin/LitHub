"""Portable updater tests use disposable programs; never the user's installation."""
import importlib.util
import hashlib
import json
import os
from pathlib import Path
import tempfile
import subprocess
import sys
import time
from unittest import TestCase, main
from unittest.mock import patch
import zipfile
spec=importlib.util.spec_from_file_location('portable',Path(__file__).resolve().parents[1]/'electron/portable-update.py')
worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)

class PortableTests(TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory(prefix='lithub-portable-test-');self.addCleanup(self.temporary.cleanup)
        self.root=Path(self.temporary.name); self.target=self.root/'程序';self.target.mkdir()
        (self.target/'LitHub.exe').write_bytes(b'MZold')
        (self.target/'resources').mkdir();(self.target/'resources/old').write_text('original')
        for directory in ('pdfs','updates','notes','my-pdfs'):
            (self.target/directory).mkdir();(self.target/directory/'keep').write_text('personal')
        self.work=self.target/'.lithub-update-test';self.work.mkdir()
        self.archive=self.root/'new.zip'
        self.plan=dict(target=str(self.target),work=str(self.work),archive=str(self.archive),version='0.3.0',token='fictional-token')
    def make_archive(self, extra=None):
        with zipfile.ZipFile(self.archive,'w') as z:
            for name in worker.REQUIRED:z.writestr('LitHub-0.3.0-win-x64/'+name,b'MZnew' if name=='LitHub.exe' else b'new')
            for name,value in (extra or {}).items():
                entry=zipfile.ZipInfo(name);entry.filename=name;entry.orig_filename=name;z.writestr(entry,value)
        self.plan['sha256']=hashlib.sha256(self.archive.read_bytes()).hexdigest()
    def assert_personal(self):
        for directory in ('pdfs','updates','notes','my-pdfs'):self.assertEqual((self.target/directory/'keep').read_text(),'personal')
    def test_success_preserves_data_and_removes_backup_only_after_ack(self):
        self.make_archive();worker.prepare(self.plan)
        def launched(executable,updated):
            self.assertEqual((self.work/'backup/LitHub.exe').read_bytes(),b'MZold')
            self.assertEqual(executable.read_bytes(),b'MZnew');return object()
        self.assertTrue(worker.apply(self.plan,launched,lambda p:True))
        self.assertFalse(self.work.exists());self.assert_personal()
        self.assertEqual(json.loads((self.target/'lithub-portable.json').read_text())['distribution'],'portable')
    def test_replacement_failure_restores_original(self):
        self.make_archive();worker.prepare(self.plan)
        original=worker.replace_with_retry
        def failing(source,target):
            if source==self.work/'incoming/resources':raise PermissionError('fixture locked file')
            return original(source,target)
        launches=[]
        with patch.object(worker,'replace_with_retry',failing):
            self.assertFalse(worker.apply(self.plan,lambda exe,updated:launches.append(updated),lambda p:True))
        self.assertEqual(launches,[False]);self.assertEqual((self.target/'LitHub.exe').read_bytes(),b'MZold')
        self.assertEqual((self.target/'resources/old').read_text(),'original');self.assert_personal()
    def test_failed_start_rolls_back_and_restarts_old(self):
        self.make_archive();worker.prepare(self.plan)
        class Process:
            pid=123456
            def terminate(self):pass
            def wait(self,timeout):pass
        launches=[]
        with patch.object(worker.subprocess,'run'):
            self.assertFalse(worker.apply(self.plan,lambda exe,updated:(launches.append(updated) or Process()),lambda p:False))
        self.assertEqual(launches,[True,False]);self.assert_personal()
        self.assertEqual((self.target/'LitHub.exe').read_bytes(),b'MZold')
        self.assertFalse(json.loads((self.target/'.lithub-update-result.json').read_text(encoding='utf8'))['ok'])
    def test_rejects_dangerous_archives_before_modifying_program(self):
        for name in ('../evil','LitHub-0.3.0-win-x64/../evil','LitHub-0.3.0-win-x64/resources/./evil',
                     '/LitHub-0.3.0-win-x64/resources/evil','LitHub-0.3.0-win-x64/resources\\evil',
                     'LitHub-0.3.0-win-x64/resources/CON.txt','LitHub-0.3.0-win-x64/resources/file:stream',
                     'LitHub-0.3.0-win-x64/resources/name.','LitHub-0.3.0-win-x64/pdfs/keep',
                     'LitHub-0.3.0-win-x64/resources/APP.ASAR'):
            with self.subTest(name=name):
                self.make_archive({name:b'bad'})
                with self.assertRaises(ValueError):worker.prepare(self.plan)
                self.assertFalse((self.work/'incoming').exists());self.assert_personal()
    def test_rejects_symlinks_and_missing_required_files(self):
        with zipfile.ZipFile(self.archive,'w') as z:
            entry=zipfile.ZipInfo('LitHub-0.3.0-win-x64/resources/link');entry.external_attr=0o120777<<16;z.writestr(entry,b'outside')
        self.plan['sha256']=hashlib.sha256(self.archive.read_bytes()).hexdigest()
        with self.assertRaises(ValueError):worker.prepare(self.plan)
        self.assertFalse((self.work/'incoming').exists())
        self.make_archive();self.plan['sha256']='0'*64
        with self.assertRaisesRegex(ValueError,'校验'):worker.prepare(self.plan)
        self.assert_personal()
    def test_disk_space_failure_keeps_current_program(self):
        self.make_archive()
        with patch.object(worker.shutil,'disk_usage') as usage:
            usage.return_value.free=1
            with self.assertRaisesRegex(OSError,'空间'):worker.prepare(self.plan)
        self.assertEqual((self.target/'LitHub.exe').read_bytes(),b'MZold')

    def test_release_zip_builder_produces_the_updaters_layout(self):
        spec=importlib.util.spec_from_file_location('zip_builder',Path(__file__).resolve().parents[1]/'build/package-zip.py')
        builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
        unpacked=self.root/'unpacked';unpacked.mkdir()
        for name in worker.REQUIRED:
            file=unpacked/name;file.parent.mkdir(parents=True,exist_ok=True)
            file.write_bytes(b'MZfixture' if name=='LitHub.exe' else b'fixture')
        (unpacked/'resources/backend/main.py').write_text('SERVICE_VERSION = "0.3.0"',encoding='utf8')
        result=builder.package_zip(unpacked,self.root/'output','0.3.0')
        worker.extract(result,self.root/'extracted','0.3.0')
        self.assertTrue((self.root/'extracted/LitHub.exe').exists())
        (unpacked/'pdfs').mkdir();(unpacked/'pdfs/personal.pdf').write_bytes(b'personal')
        with self.assertRaisesRegex(ValueError,'user data'):builder.package_zip(unpacked,self.root/'bad-output','0.3.0')

    def test_real_windows_worker_waits_for_parent_and_confirms_new_process(self):
        if os.name!='nt':self.skipTest('Windows worker fixture')
        cache=Path(os.environ['LOCALAPPDATA'])/'electron-builder/Cache/nsis'
        compiler=next(cache.glob('nsis-*/makensis.exe'))
        new_exe=self.root/'fixture.exe';script=self.root/'fixture.nsi'
        script.write_text(f'''Unicode true
RequestExecutionLevel user
Name "LitHub portable update fixture"
OutFile "{new_exe}"
SilentInstall silent
Section
 ReadEnvStr $0 LITHUB_UPDATE_ACK
 ReadEnvStr $1 LITHUB_UPDATE_TOKEN
 FileOpen $2 "$0" w
 FileWrite $2 '{{"token":"$1"}}'
 FileClose $2
 Sleep 3000
SectionEnd
''',encoding='utf-8-sig')
        subprocess.run([str(compiler),'/V2',str(script)],check=True,capture_output=True)
        self.make_archive()
        with zipfile.ZipFile(self.archive,'w') as package:
            for name in worker.REQUIRED:package.writestr('LitHub-0.3.0-win-x64/'+name,new_exe.read_bytes() if name=='LitHub.exe' else b'new')
        self.plan['sha256']=hashlib.sha256(self.archive.read_bytes()).hexdigest()
        # Run the actual JS launcher, copied embedded Python and Windows worker.
        # The old Python runtime must be movable after the launcher parent exits.
        runtime=Path(__file__).resolve().parents[1]/'build/runtime'
        old_python=self.target/'resources/python';old_python.mkdir()
        for file in runtime.iterdir():
            if file.is_file() and not file.name.startswith('.'):worker.shutil.copy2(file,old_python/file.name)
        self.work.rmdir()
        entry=self.root/'parent.cjs'
        module=str(Path(__file__).resolve().parents[1]/'electron/portable-update.js')
        args=json.dumps([str(self.archive),str(self.target/'LitHub.exe'),dict(version='0.3.0',sha256=self.plan['sha256'])])
        entry.write_text("const {launchPortableAfterExit}=require("+json.dumps(module)+"); (async()=>{let rejected=false;try{await launchPortableAfterExit(..."+args+",{beforeHandoff:async()=>{throw Error('fixture-unsaved');}});}catch(e){if(e.message!=='fixture-unsaved')throw e;rejected=true;}if(!rejected)throw Error('guard not enforced');const state=await launchPortableAfterExit(..."+args+");console.log(JSON.stringify(state));await new Promise(r=>setTimeout(r,3000));})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});",encoding='utf8')
        parent=subprocess.Popen(['node',str(entry)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        stage=None
        try:
            line=parent.stdout.readline().strip()
            if not line:
                _,error=parent.communicate(timeout=20);self.fail(error)
            state=json.loads(line);stage=Path(state['staging']).resolve()
            self.assertIsNone(parent.poll());self.assertEqual((self.target/'LitHub.exe').read_bytes(),b'MZold')
            parent.wait(timeout=10)
            self.assertEqual(parent.returncode,0,parent.stderr.read())
            result=self.target/'.lithub-update-result.json'
            for _ in range(150):
                if result.exists():break
                time.sleep(.2)
            self.assertTrue(json.loads(result.read_text(encoding='utf8'))['ok'])
            for _ in range(100):
                if not any(p.is_dir() for p in self.target.glob('.lithub-update-*')):break
                time.sleep(.1)
            self.assertFalse([p for p in self.target.glob('.lithub-update-*') if p.is_dir()]);self.assert_personal()
        finally:
            if parent.poll() is None:parent.kill();parent.wait()
            parent.stdout.close();parent.stderr.close()
            time.sleep(3)
            if stage:
                self.assertEqual(stage.parent,Path(tempfile.gettempdir()).resolve())
                self.assertTrue(stage.name.startswith('lithub-update-handoff-'))
                self.assertEqual((stage/'.lithub-update-handoff').read_text(),'1')
                worker.shutil.rmtree(stage)

if __name__=='__main__':main()
