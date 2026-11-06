"use strict";
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Resolve against the executable, never the working directory of a desktop shortcut.
// Select lazily on download; checking for updates does not create download folders.
async function resolveUpdateDirectory({ executable, userData, filesystem = fs.promises }) {
  const preferred = path.join(path.dirname(executable), 'updates');
  const fallback = path.join(userData, 'updates');
  for (const directory of new Set([preferred, fallback])) {
    const probe = path.join(directory, `.write-test-${randomUUID()}`);
    let handle;
    try {
      await filesystem.mkdir(directory, { recursive: true });
      handle = await filesystem.open(probe, 'wx');
      await handle.close(); handle = null;
      await filesystem.unlink(probe);
      return directory;
    } catch {
      await handle?.close().catch(() => {});
      await filesystem.unlink(probe).catch(() => {});
    }
  }
  throw Error('无法写入更新缓存目录，请检查程序目录和用户数据目录的写入权限后重试。');
}
module.exports = { resolveUpdateDirectory };
