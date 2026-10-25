/* Real Electron helper + harmless NSIS installer fixture. No registry or application writes. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const require = createRequire(import.meta.url);
const root=mkdtempSync(path.join(os.tmpdir(),'lithub-update-handoff-'));
const compilerRoot=path.join(process.env.LOCALAPPDATA,'electron-builder/Cache/nsis');
const compiler=path.join(compilerRoot,readdirSync(compilerRoot).find(n=>/^nsis-[\d]/.test(n)),'makensis.exe');
const installer=path.join(root,'fixture.exe'),marker=path.join(root,'installed.txt'),entry=path.join(root,'parent.cjs');
const source=path.join(root,'fixture.nsi');
writeFileSync(source,'\uFEFF'+`Unicode true
RequestExecutionLevel user
Name "LitHub update handoff test"
OutFile "${installer}"
SilentInstall silent
Section
 ReadEnvStr $0 ELECTRON_RUN_AS_NODE
 FileOpen $1 "${marker}" w
 FileWrite $1 "installed:$0"
 FileClose $1
SectionEnd
`);
execFileSync(compiler,['/V2',source],{windowsHide:true});
writeFileSync(entry,`const {launchInstallerAfterExit}=require(${JSON.stringify(path.resolve('electron/update-launcher.js'))});
(async()=>{await launchInstallerAfterExit(${JSON.stringify(installer)},process.execPath);
 console.log('handoff-ready');
 await new Promise(r=>setTimeout(r,750));
 if(require('node:fs').existsSync(${JSON.stringify(marker)})) throw Error('Installer ran before parent exit');
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});`);
try {
  const child=spawn(require('electron'),[entry],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  const timer=setTimeout(()=>child.kill(),20000);
  const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});
  clearTimeout(timer);assert.equal(code,0,output);assert.ok(output.includes('handoff-ready'));
  for(let i=0;i<200&&!existsSync(marker);i++)await new Promise(r=>setTimeout(r,100));
  assert.equal(existsSync(marker),true,'NSIS fixture started after Electron parent exited');
  assert.equal(readFileSync(marker,'utf8'),'installed:');
  console.log('PASS real Electron handoff waits for exit, runs NSIS and removes run-as-node environment');
} finally {rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:150});}
