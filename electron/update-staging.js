"use strict";
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');

const PREFIX = 'lithub-update-handoff-';
const MARKER = '.lithub-update-handoff';

async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

// Older uninstallers remove every program subfolder except PDFs. Run the installer/helper
// from OS temporary storage so upgrading an older edition cannot delete its own updater.
async function stageInstaller(installer, temporaryDirectory = os.tmpdir()) {
  const directory = await fs.promises.mkdtemp(path.join(temporaryDirectory, PREFIX));
  try {
    await fs.promises.writeFile(path.join(directory, MARKER), '1');
    const file = path.join(directory, 'installer.exe');
    await fs.promises.copyFile(installer, file);
    if (await digest(installer) !== await digest(file)) throw Error('更新安装包临时副本校验失败，请重试。');
    return { directory, file };
  } catch (error) {
    await fs.promises.rm(directory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function pruneUpdateStaging({ temporaryDirectory = os.tmpdir(), now = Date.now() } = {}) {
  const entries = await fs.promises.readdir(temporaryDirectory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(PREFIX)) continue;
    const directory = path.join(temporaryDirectory, entry.name), marker = path.join(directory, MARKER);
    try {
      const stat = await fs.promises.stat(marker);
      if (stat.size !== 1 || await fs.promises.readFile(marker, 'utf8') !== '1' || now - stat.mtimeMs < 86400000) continue;
      // If Windows still has the installer locked, leave the ownership marker for the next cleanup.
      await fs.promises.unlink(path.join(directory, 'installer.exe')).catch(error => { if (error.code !== 'ENOENT') throw error; });
      await fs.promises.rm(directory, { recursive: true, force: true });
    } catch { /* In-use files are retried on a later launch. Unmarked directories are untouched. */ }
  }
}
module.exports = { stageInstaller, pruneUpdateStaging };
