"""ZIP update worker: stdlib only, runs from a copied Python outside the app."""
import ctypes
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import time
import zipfile

ROOTS = {'LitHub.exe','resources','locales','chrome_100_percent.pak','chrome_200_percent.pak',
         'd3dcompiler_47.dll','dxcompiler.dll','dxil.dll','ffmpeg.dll','icudtl.dat',
         'LICENSE.electron.txt','LICENSES.chromium.html','resources.pak','snapshot_blob.bin',
         'v8_context_snapshot.bin','vk_swiftshader_icd.json','vk_swiftshader.dll','vulkan-1.dll',
         'lithub-portable.json','使用说明.txt'}
REQUIRED = ['LitHub.exe','resources/app.asar','resources/backend/main.py',
            'resources/frontend/index.html','resources/python/python.exe']

def write_json(path, data):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False), encoding='utf8')
    os.replace(temporary, path)

def extract(archive, destination, version):
    prefix = f'LitHub-{version}-win-x64'
    with zipfile.ZipFile(archive) as package:
        entries = package.infolist()
        if len(entries)>50000 or sum(e.file_size for e in entries)>4*1024**3:
            raise ValueError('ZIP 超出允许的解压大小或文件数量')
        if shutil.disk_usage(destination.parent).free < sum(e.file_size for e in entries) + 100*1024**2:
            raise OSError('磁盘空间不足')
        seen = set()
        for entry in entries:
            name=entry.filename
            parts=PurePosixPath(name).parts
            if (entry.orig_filename != name or '\\' in name or not parts or parts[0]!=prefix or
                any(p in ('.','..') or ':' in p or p.endswith((' ','.')) or
                    re.match(r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)',p,re.I) for p in parts) or
                any(ord(c)<32 for c in name) or name.startswith('/') or
                stat.S_ISLNK(entry.external_attr>>16) or entry.flag_bits&1):
                raise ValueError('ZIP 包含不安全的路径或链接')
            # PurePath normalizes '.', so also check the original components.
            if any(p in ('.','..') for p in name.rstrip('/').split('/')):
                raise ValueError('ZIP 路径非法')
            if len(parts)==1:
                if not entry.is_dir(): raise ValueError('ZIP 根目录非法')
                continue
            if parts[1] not in ROOTS: raise ValueError('ZIP 包含非程序文件：'+parts[1])
            key='/'.join(parts[1:]).casefold()
            if key in seen: raise ValueError('ZIP 包含重复路径')
            seen.add(key)
        # Validate the entire directory before writing any payload files.
        destination.mkdir()
        for entry in entries:
            parts=PurePosixPath(entry.filename).parts[1:]
            if not parts: continue
            target=destination.joinpath(*parts)
            if entry.is_dir(): target.mkdir(parents=True,exist_ok=True)
            else:
                target.parent.mkdir(parents=True,exist_ok=True)
                with package.open(entry) as src, target.open('xb') as dst: shutil.copyfileobj(src,dst)
    for name in REQUIRED:
        if not (destination/name).is_file(): raise ValueError('更新包缺少程序文件：'+name)
    with (destination/'LitHub.exe').open('rb') as executable: valid = executable.read(2)==b'MZ'
    if not valid: raise ValueError('更新包的 EXE 无效')
    write_json(destination/'lithub-portable.json',{'format':1,'distribution':'portable'})

def prepare(plan):
    work=Path(plan['work']).resolve(); target=Path(plan['target']).resolve()
    if work.parent!=target or not work.name.startswith('.lithub-update-'):
        raise ValueError('更新工作目录不属于目标程序目录')
    if target.is_symlink() or target.is_junction() or work.is_symlink() or work.is_junction(): raise ValueError('更新目录不能是链接')
    archive=Path(plan['archive'])
    with archive.open('rb') as stream:
        if hashlib.file_digest(stream,'sha256').hexdigest()!=plan['sha256']: raise ValueError('ZIP 校验失败')
    extract(archive, work/'incoming', plan['version'])
    (work/'backup').mkdir()
    # Only roots owned by this application are replaced. Never enumerate/delete user folders.
    for name in ROOTS:
        if (target/name).is_symlink() or (target/name).is_junction(): raise ValueError('程序文件不能是链接')
    plan.update(moved=[],placed=[],phase='prepared')
    write_json(work/'plan.json',plan)

def replace_with_retry(source, target):
    for attempt in range(30):
        try: os.replace(source,target); return
        except PermissionError:
            if attempt==29: raise
            time.sleep(.2)

def apply(plan, launch, await_start):
    work=Path(plan['work']); target=Path(plan['target']); incoming=work/'incoming'; backup=work/'backup'
    try:
        plan['phase']='replacing'; write_json(work/'plan.json',plan)
        for name in sorted(ROOTS):
            old=target/name
            if old.exists():
                replace_with_retry(old,backup/name); plan['moved'].append(name)
                write_json(work/'plan.json',plan)
            new=incoming/name
            if new.exists():
                replace_with_retry(new,old); plan['placed'].append(name)
                write_json(work/'plan.json',plan)
        process=launch(target/'LitHub.exe',True)
        if not await_start(process): raise RuntimeError('新版本启动未能确认')
        write_json(target/'.lithub-update-result.json',{'ok':True,'version':plan['version']})
    except Exception as error:
        # Ensure the new app and its sidecar release their files before restoring.
        if 'process' in locals():
            subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],capture_output=True) if os.name=='nt' else process.terminate()
            try:process.wait(timeout=15)
            except subprocess.TimeoutExpired:raise RuntimeError('无法关闭新程序，旧文件保留在 '+str(backup)) from error
        for name in reversed(plan['placed']):
            current=target/name
            if current.exists(): replace_with_retry(current,incoming/name)
        for name in reversed(plan['moved']): replace_with_retry(backup/name,target/name)
        write_json(target/'.lithub-update-result.json',{'ok':False,'error':str(error),'version':plan['version']})
        launch(target/'LitHub.exe',False)
        try:shutil.rmtree(work)
        except OSError:pass
        return False
    shutil.rmtree(work)
    return True

def parent_handle(pid):
    if os.name!='nt': raise RuntimeError('ZIP 自动更新仅支持 Windows')
    kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    kernel.OpenProcess.restype=ctypes.c_void_p
    handle=kernel.OpenProcess(0x100000,False,pid)
    if not handle: raise ctypes.WinError(ctypes.get_last_error())
    return kernel,handle

def main():
    mode,file,*args=sys.argv[1:]; plan=json.loads(Path(file).read_text(encoding='utf8'))
    if mode=='prepare': prepare(plan); return
    kernel,handle=parent_handle(int(args[0]))
    try:
        print('ready',flush=True)
        kernel.WaitForSingleObject.argtypes=[ctypes.c_void_p,ctypes.c_ulong]
        if kernel.WaitForSingleObject(handle,90000)!=0: raise RuntimeError('程序未退出，已取消替换')
    finally:
        kernel.CloseHandle.argtypes=[ctypes.c_void_p]; kernel.CloseHandle(handle)
    work=Path(plan['work']); ack=work/'started.json'
    def launch(executable,updated):
        env=dict(os.environ)
        for key in ('ELECTRON_RUN_AS_NODE','LITHUB_UPDATE_ACK','LITHUB_UPDATE_TOKEN'):env.pop(key,None)
        if updated: env.update(LITHUB_UPDATE_ACK=str(ack),LITHUB_UPDATE_TOKEN=plan['token'])
        return subprocess.Popen([str(executable)],cwd=executable.parent,env=env,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    def await_start(process):
        for _ in range(450):
            if process.poll() is not None: return False
            try:
                if json.loads(ack.read_text(encoding='utf8')).get('token')==plan['token']: return True
            except (OSError,ValueError):pass
            time.sleep(.2)
        return False
    apply(plan,launch,await_start)

if __name__=='__main__':
    try:main()
    except Exception as error:
        # Keep diagnostics outside the program directory, even if replacement failed.
        Path(__file__).with_name('portable-error.txt').write_text(str(error),encoding='utf8')
        raise
