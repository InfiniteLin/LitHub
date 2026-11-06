// Public release builds produce only a ZIP. NSIS remains available for historical rebuilds.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const version=require('../package.json').version;
const args=process.argv.slice(2);
let output=path.join('release',`v${version}`);
for(let i=0;i<args.length;i++) {
  if(args[i].startsWith('--config.directories.output=')) output=args[i].slice('--config.directories.output='.length);
  else if(args[i]==='--config.directories.output') output=args[++i];
}
function run(file,parameters) {
  const result=spawnSync(file,parameters,{cwd:root,stdio:'inherit',windowsHide:true});
  if(result.error) throw result.error;
  if(result.status!==0) process.exit(result.status||1);
}
run(process.execPath,[require.resolve('electron-builder/out/cli/cli.js'),'--config','electron-builder.config.js',`--config.directories.output=${output}`,...args,'--dir','--publish','never']);
run(process.env.LITHUB_BUILD_PYTHON||'python',[path.join(__dirname,'package-zip.py'),'--unpacked',path.join(output,'win-unpacked'),'--output',output]);
