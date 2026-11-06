import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const native=createRequire(import.meta.url),source=readFileSync('build/release.cjs','utf8');
function run(args,fail=false) {
  const calls=[];
  const custom=name=>name==='node:child_process'?{spawnSync:(file,argv)=>{calls.push({file,argv});return {status:fail?1:0};}}:name==='../package.json'?{version:'0.2.4'}:native(name);
  custom.resolve=native.resolve;
  const context={require:custom,__dirname:path.resolve('build'),process:{argv:['node','release.cjs',...args],execPath:'node',env:{},exit:code=>{throw Error('exit:'+code);}}};
  if(fail) assert.throws(()=>vm.runInNewContext(source,context),/exit:1/);else vm.runInNewContext(source,context);
  return calls;
}
const defaults=run([]);assert.equal(defaults.length,2);
assert.ok(defaults[0].argv.includes('--dir'));assert.ok(defaults[0].argv.includes('--config.directories.output='+path.join('release','v0.2.4')));
assert.ok(!defaults[0].argv.includes('nsis'));
assert.equal(defaults[1].argv.at(-1),path.join('release','v0.2.4'));
const custom=run(['--config.directories.output=release/custom']);assert.equal(custom[1].argv.at(-1),'release/custom');
assert.equal(run([],true).length,1,'failed app build must not produce a ZIP from stale files');
console.log('PASS ZIP-only default release, output routing and failure short-circuit');
