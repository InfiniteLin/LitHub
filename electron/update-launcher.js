"use strict";
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
async function launchInstallerAfterExit(installer, executable) {
  // Copy out of asar: Electron's run-as-node mode receives a regular filesystem script.
  const helper = path.join(path.dirname(installer), 'handoff.cjs');
  fs.copyFileSync(path.join(__dirname, 'update-handoff.cjs'), helper);
  const child = spawn(executable, [helper, String(process.pid), installer, executable], {
    detached: true, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(Error('更新安装准备超时，请重试。')); }, 10000);
    const fail = error => { clearTimeout(timer); reject(error); };
    child.once('error', fail);
    child.once('exit', () => fail(Error('更新安装准备失败，请重试。')));
    child.once('message', message => { if (message === 'ready') { clearTimeout(timer); resolve(); } });
  });
  child.disconnect();
  child.unref();
}
module.exports = { launchInstallerAfterExit };
