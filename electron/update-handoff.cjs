// Run as a short-lived Node helper. Wait for the entire app process to exit before NSIS runs.
"use strict";
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
async function handoff({ parentPid, installer, executable, timeout = 90000, args = null }) {
  const started = Date.now();
  for (;;) {
    let alive = true;
    try { process.kill(parentPid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; }
    if (!alive) break;
    if (Date.now() - started > timeout) throw Error('Application did not exit; update postponed');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(installer, args || ['/S', '--updated', '--force-run', `/D=${path.dirname(executable)}`],
    { detached: true, windowsHide: true, stdio: 'ignore', env });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
}
if (require.main === module) {
  const [parentPid, installer, executable] = process.argv.slice(2);
  process.send?.('ready');
  handoff({ parentPid: Number(parentPid), installer, executable }).catch(error => {
    // Keep diagnostics beside the cached installer if launch fails after the app has exited.
    try { fs.writeFileSync(path.join(path.dirname(installer), 'install-error.txt'), error.message); } catch {}
  }).finally(() => process.exit());
}
module.exports = { handoff };
