'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

function copyRuntime(source, destination) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(to);
      copyRuntime(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function windowsRuntime(executable) {
  const source = path.dirname(executable);
  const { version } = require('electron/package.json');
  const cache = path.join(os.tmpdir(), 'lithub-dev-electron');
  const runtime = path.join(cache, `${version}-${process.arch}`);
  const cachedExecutable = path.join(runtime, 'electron.exe');
  if (fs.existsSync(cachedExecutable)) return cachedExecutable;

  // Electron can exit before loading main.js when launched from the workspace.
  // Keep a complete copy of the same runtime at a local, per-user path.
  fs.mkdirSync(cache, { recursive: true });
  const staging = fs.mkdtempSync(path.join(cache, 'staging-'));
  try {
    copyRuntime(source, staging);
    try {
      fs.renameSync(staging, runtime);
    } catch (error) {
      if (!fs.existsSync(cachedExecutable)) throw error;
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  return cachedExecutable;
}

let executable = require('electron');
if (process.platform === 'win32' && !process.env.ELECTRON_OVERRIDE_DIST_PATH) {
  executable = windowsRuntime(executable);
}

const child = spawn(executable, ['.', ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('error', error => {
  console.error('无法启动 Electron：', error.message);
});
child.on('close', (code, signal) => {
  if (code !== 0) console.error(`Electron 启动进程退出（${signal ?? code}）。`);
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM', 'SIGUSR2']) {
  process.on(signal, () => {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  });
}
