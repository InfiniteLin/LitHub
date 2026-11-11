from pathlib import Path
import argparse,json,re,zipfile,hashlib


def package_zip(unpacked, output, version):
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)',version):raise ValueError('Invalid release version')
    unpacked=Path(unpacked).resolve();output=Path(output).resolve()
    for name in ('LitHub.exe','resources/app.asar','resources/backend/main.py','resources/frontend/index.html','resources/python/python.exe'):
        if not (unpacked/name).is_file():raise ValueError('Incomplete packaged app: '+name)
    source=(unpacked/'resources/backend/main.py').read_text(encoding='utf8')
    if not re.search(r'SERVICE_VERSION\s*=\s*[\"\']'+re.escape(version)+r'[\"\']',source):raise ValueError('Packaged backend version differs')
    output.mkdir(parents=True,exist_ok=True)
    archive=output/f'LitHub-{version}-win-x64.zip'
    if archive.is_relative_to(unpacked):raise ValueError('ZIP output must be outside the packaged app')
    prefix=f'LitHub-{version}-win-x64'
    instructions='完整解压后双击 LitHub.exe；请保留所有文件。文献库与设置位于 Windows 用户数据目录，PDF 默认在程序目录的 pdfs/，笔记与图片位于程序目录的 notes/。更新器会自动选择 ZIP 包，保留免安装使用方式。请从官方 Release 下载并校验 SHA-256。'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for file in sorted(unpacked.rglob('*')):
            relative=file.relative_to(unpacked)
            if file.is_symlink() or file.is_junction():raise ValueError('Packaged app contains links')
            if not file.is_file():continue
            if relative.parts[0] in ('pdfs','notes','updates','data') or relative.parts[:3]==('resources','backend','data') or relative.parts[0].startswith('.lithub-update'):
                raise ValueError('Packaged app contains local user data')
            if relative.as_posix() in ('lithub-portable.json','使用说明.txt'):continue
            z.write(file,prefix+'/'+relative.as_posix())
        z.writestr(prefix+'/lithub-portable.json',json.dumps({'format':1,'distribution':'portable'}))
        z.writestr(prefix+'/使用说明.txt',instructions.encode('utf-8-sig'))
    with zipfile.ZipFile(archive) as z:
        if z.testzip():raise ValueError('ZIP CRC verification failed')
    with archive.open('rb') as stream: digest=hashlib.file_digest(stream,'sha256').hexdigest()
    (output/'SHA256SUMS.txt').write_text(f'{digest}  {archive.name}\n',encoding='utf8')
    notes=output/'RELEASE_NOTES.md'
    manifest={'schemaVersion':1,'release':{'tag_name':'v'+version,'name':'文枢 LitHub v'+version,
        'draft':False,'prerelease':False,'body':notes.read_text(encoding='utf8') if notes.exists() else '',
        'assets':[{'name':archive.name,'size':archive.stat().st_size,'state':'uploaded','digest':'sha256:'+digest}]}}
    (output/'update.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    return archive

if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    parser=argparse.ArgumentParser(description='Package an existing Windows x64 build as the updater-compatible ZIP')
    parser.add_argument('--unpacked',type=Path,default=root/'release/win-unpacked')
    parser.add_argument('--output',type=Path,default=root/'release')
    parser.add_argument('--version',default=json.loads((root/'package.json').read_text(encoding='utf8'))['version'])
    args=parser.parse_args();print(package_zip(args.unpacked,args.output,args.version))
