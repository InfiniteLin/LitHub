/* Real Electron first-use profile creation and duplicate-process handoff, without a user window. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const directory = mkdtempSync(path.join(tmpdir(), 'lithub-instance-test-'));
const entry = path.join(directory, 'main.cjs');
writeFileSync(entry, `
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path');
const {acquireDesktopInstance}=require(${JSON.stringify(path.resolve('electron/desktop-instance.js'))});
app.setPath('appData',${JSON.stringify(directory)});
const actions=[];
const window={isDestroyed:()=>false,isMinimized:()=>true,
  restore:()=>actions.push('restore'),show:()=>actions.push('show'),focus:()=>{
    actions.push('focus');console.log('FOCUSED '+actions.join(','));setTimeout(()=>app.exit(0),100);
  }};
if(!acquireDesktopInstance(app,()=>window))app.exit(0);
else app.whenReady().then(()=>{
  const expected=path.join(${JSON.stringify(directory)},'文枢 LitHub-dev');
  if(!fs.existsSync(expected)||app.getPath('userData')!==expected||app.getPath('sessionData')!==expected)app.exit(2);
  console.log('PRIMARY_READY');
  setTimeout(()=>app.exit(3),15000);
});
`);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const children = [];
function start() {
  const child = spawn(require('electron'), [entry], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  return child;
}
try {
  const primary = start();
  let output = '';
  primary.stdout.on('data', data => { output += data; });
  primary.stderr.on('data', data => { output += data; });
  const firstExit = new Promise(resolve => primary.once('exit', resolve));
  for (let i = 0; i < 100 && !output.includes('PRIMARY_READY'); i++) {
    if (primary.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(output.includes('PRIMARY_READY'), output || 'Primary instance not ready');
  const duplicate = start();
  const secondExit = new Promise(resolve => duplicate.once('exit', resolve));
  assert.equal(await secondExit, 0);
  assert.equal(await firstExit, 0, output);
  assert.ok(output.includes('FOCUSED restore,show,focus'), output);
  console.log('PASS real Electron creates an isolated development profile and duplicate launch focuses the primary');
} finally {
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill();
      await new Promise(resolve => child.once('exit', resolve));
    }
  }
  assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep));
  rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
