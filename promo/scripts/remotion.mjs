// Standard Remotion CLI with a writable, project-local temporary directory.
// Changes affect only the child process, not the user's system environment.
import {mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = join(root, '.cache', 'render-temp');
mkdirSync(temp, {recursive: true});
const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve('@remotion/cli/package.json')), 'remotion-cli.js');
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
  env: {...process.env, TEMP: temp, TMP: temp, TMPDIR: temp},
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
