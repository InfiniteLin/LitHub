const path = require('node:path');
const fs = require('node:fs');

function acquireDesktopInstance(app, getWindow, filesystem = fs) {
  // Separate Chromium profiles also give development and installed editions separate locks.
  if (!app.isPackaged) {
    const profile = path.join(app.getPath('appData'), '文枢 LitHub-dev');
    filesystem.mkdirSync(profile, { recursive: true });
    app.setPath('userData', profile);
    app.setPath('sessionData', profile);
  }
  if (!app.requestSingleInstanceLock()) return false;
  app.on('second-instance', () => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  return true;
}

module.exports = { acquireDesktopInstance };
