import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { acquireDesktopInstance } = require('../electron/desktop-instance.js');
for (const packaged of [true, false]) {
  const handlers = new Map(), paths = [], operations = [], directories = [];
  const filesystem = { mkdirSync: (directory, options) => { assert.equal(options.recursive, true); directories.push(directory); } };
  const app = { isPackaged: packaged, getPath: () => '/profile', setPath: (...args) => { assert.ok(directories.includes(args[1])); paths.push(args); },
    requestSingleInstanceLock: () => true, on: (name, run) => handlers.set(name, run) };
  const win = { isDestroyed: () => false, isMinimized: () => true,
    restore: () => operations.push('restore'), show: () => operations.push('show'), focus: () => operations.push('focus') };
  assert.equal(acquireDesktopInstance(app, () => win, filesystem), true);
  assert.equal(paths.length, packaged ? 0 : 2);
  if (!packaged) assert.ok(paths[0][1].endsWith('文枢 LitHub-dev'));
  handlers.get('second-instance')();
  assert.deepEqual(operations, ['restore', 'show', 'focus']);
  app.requestSingleInstanceLock = () => false;
  app.on = () => { throw Error('duplicate process must not register callbacks'); };
  assert.equal(acquireDesktopInstance(app, () => win, filesystem), false);
}
console.log('PASS duplicate starts focus the existing window and dev/installed editions use separate locks');
