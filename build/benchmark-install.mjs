/* Measure actual NSIS runtime extraction, without registering or launching the application. */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
const require = createRequire(import.meta.url);
const { archive } = require('app-builder-lib/out/targets/archive');
const project = path.resolve('.');
const benchmarkRoot = path.join(project, 'release', 'install-benchmark');
const folder = process.argv[2] ? path.resolve(process.argv[2]) : path.join(benchmarkRoot, String(Date.now()));
if (!folder.startsWith(benchmarkRoot + path.sep)) throw Error('Benchmark output must stay inside release/install-benchmark');
mkdirSync(folder, { recursive: true });
const cache = path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'nsis');
const compiler = path.join(cache, readdirSync(cache).find(n => n.startsWith('nsis-') && !n.startsWith('nsis-resources')), 'makensis.exe');
const plugins = path.join(cache, readdirSync(cache).find(n => n.startsWith('nsis-resources')), 'plugins', 'x86-unicode');
const template = path.join(project, 'node_modules/app-builder-lib/templates/nsis/include/extractAppPackage.nsh');
const cases = [
  { name: 'original-7z', source: path.join(project, 'build/python'), format: '7z' },
  { name: 'slim-7z', source: path.join(project, 'build/runtime'), format: '7z' },
  { name: 'slim-zip', source: path.join(project, 'build/runtime'), format: 'zip' },
];
if (process.argv.includes('--zip-first')) cases.unshift(cases.splice(2, 1)[0]);
for (const item of cases) {
  const payload = path.join(folder, `${item.name}.${item.format}`);
  console.log(`Compressing ${item.name} with electron-builder's production archive settings...`);
  const started = performance.now();
  await archive(item.format, payload, item.source, { withoutDir: true, compression: 'normal',
    ...(item.format === '7z' ? { dictSize: 1, solid: false } : {}) });
  item.archiveSeconds = (performance.now() - started) / 1000;
  item.payloadBytes = statSync(payload).size;
  const executable = path.join(folder, item.name + '.exe');
  const source = path.join(folder, item.name + '.nsi');
  writeFileSync(source, '\uFEFF' + `Unicode true
RequestExecutionLevel user
Name "LitHub extraction benchmark"
OutFile "${executable}"
SilentInstall silent
SetCompress off
!include "LogicLib.nsh"
!define PRODUCT_NAME "LitHub extraction benchmark"
LangString appCannotBeClosed 1033 "Cannot replace test files"
!addplugindir "${plugins}"
!include "${template}"
Section
  InitPluginsDir
  SetOutPath $INSTDIR
  File /oname=$PLUGINSDIR\\payload.${item.format} "${payload}"
  ${item.format === 'zip' ? `nsisunz::Unzip "$PLUGINSDIR\\payload.zip" "$INSTDIR"
  Pop $R0
  StrCmp $R0 "success" +3
    SetErrorLevel 1
    Quit` : '!insertmacro extractUsing7za "$PLUGINSDIR\\payload.7z"'}
SectionEnd
`);
  execFileSync(compiler, ['/V2', source], { windowsHide: true, stdio: 'pipe' });
  item.executable = executable;
  item.installerBytes = statSync(executable).size;
  item.seconds = [];
}
for (const round of process.argv.includes('--quick') ? [cases] : [cases, [...cases].reverse()]) {
  for (const item of round) {
    const destination = path.join(folder, item.name + '-run-' + item.seconds.length + '-' + Date.now());
    const started = performance.now();
    await new Promise((resolve, reject) => {
      const child = spawn(item.executable, ['/S', `/D=${destination}`], { windowsHide: true, stdio: 'ignore' });
      const timer = setTimeout(() => { child.kill(); reject(Error('Benchmark timeout')); }, 600000);
      child.once('error', e => { clearTimeout(timer); reject(e); });
      child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(Error(`NSIS exit ${code}`)); });
    });
    item.seconds.push((performance.now() - started) / 1000);
    const sample = path.join(destination, 'Lib/site-packages/pdf2zh/pdf2zh.py');
    if (!readFileSync(sample).equals(readFileSync(path.join(item.source, 'Lib/site-packages/pdf2zh/pdf2zh.py')))) throw Error('Extracted CLI differs');
    execFileSync(path.join(destination, 'python.exe'), ['-B', '-c', 'import cv2, scipy, onnxruntime, pymupdf, fastapi; print("PASS extracted runtime")'], { windowsHide: true, stdio: 'pipe', timeout: 90000 });
    console.log(`${item.name}: ${item.seconds.at(-1).toFixed(2)}s; ${(item.installerBytes / 1024 ** 2).toFixed(1)} MiB`);
  }
}
const report = { scope: 'Bundled Python runtime NSIS extraction only; no registry, shortcuts or app startup',
  generatedAt: new Date().toISOString(), results: cases.map(({ executable, ...item }) => ({ ...item,
    averageSeconds: item.seconds.reduce((a, b) => a + b) / item.seconds.length })) };
writeFileSync(path.join(folder, 'results.json'), JSON.stringify(report, null, 2));
console.log('Benchmark report: ' + path.join(folder, 'results.json'));
