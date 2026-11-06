'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawn} = require('node:child_process');
const {randomUUID} = require('node:crypto');

function distributionFor(executable, packaged, platform = process.platform) {
  if (!packaged || platform !== 'win32') return 'development';
  // Installed NSIS editions have an uninstaller; older ZIPs have no explicit marker.
  const directory = path.dirname(executable);
  return fs.readdirSync(directory).some(name => /^Uninstall .+\.exe$/i.test(name)) ? 'installer' : 'portable';
}

async function launchPortableAfterExit(archive, executable, asset, {beforeHandoff = async () => {}} = {}) {
  const target = path.dirname(executable);
  const staging = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lithub-update-handoff-'));
  let work, child;
  try {
    await fs.promises.writeFile(path.join(staging, '.lithub-update-handoff'), '1');
    const runtime = path.join(target, 'resources', 'python');
    // Copy the stdlib-only runtime so neither the helper nor Python locks files being replaced.
    for (const entry of await fs.promises.readdir(runtime, {withFileTypes:true})) {
      if (entry.isFile() && !entry.name.startsWith('.'))
        await fs.promises.copyFile(path.join(runtime,entry.name),path.join(staging,entry.name));
    }
    const helper = path.join(staging,'portable-update.py');
    await fs.promises.copyFile(path.join(__dirname,'portable-update.py'),helper);
    const python = path.join(staging,'python.exe');
    work = await fs.promises.mkdtemp(path.join(target,'.lithub-update-'));
    const planFile = path.join(work,'plan.json');
    const plan = {work,target,archive,version:asset.version,sha256:asset.sha256,token:randomUUID()};
    await fs.promises.writeFile(planFile,JSON.stringify(plan));
    const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
    await new Promise((resolve,reject) => {
      const prepare = spawn(python,['-B',helper,'prepare',planFile],{env,windowsHide:true,stdio:['ignore','ignore','pipe']});
      let diagnostic=''; prepare.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk).slice(-2000);});
      const timer=setTimeout(()=>{prepare.kill();},180000);
      prepare.once('error',error=>{clearTimeout(timer);reject(error);});
      prepare.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('ZIP 更新准备失败，请确认目录可写且磁盘空间充足。'+diagnostic));});
    });
    // Extraction can take time: recheck saved notes/tasks before arming the worker.
    await beforeHandoff();
    child = spawn(python,['-B',helper,'apply',planFile,String(process.pid)],{env,detached:true,windowsHide:true,stdio:['ignore','pipe','ignore']});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('ZIP 更新助手启动超时。')),10000);
      const finish=error=>{clearTimeout(timer);error?reject(error):resolve();};
      let output=''; child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('ready'))finish();});
      child.once('error',finish);child.once('exit',()=>finish(Error('ZIP 更新助手未能启动。')));
    });
    child.stdout.destroy(); child.unref();
    return {staging,work};
  } catch(error) {
    child?.kill();
    if(work) await fs.promises.rm(work,{recursive:true,force:true}).catch(()=>{});
    await fs.promises.rm(staging,{recursive:true,force:true}).catch(()=>{});
    throw error;
  }
}

function readPortableResult(executable) {
  try {
    const file=path.join(path.dirname(executable),'.lithub-update-result.json');
    if(fs.statSync(file).size>4096) return null;
    const r=JSON.parse(fs.readFileSync(file,'utf8'));
    return typeof r.ok==='boolean' ? {ok:r.ok,version:String(r.version||''),error:String(r.error||'').slice(0,500)} : null;
  } catch { return null; }
}

function confirmPortableStartup(executable) {
  const ack = process.env.LITHUB_UPDATE_ACK, token = process.env.LITHUB_UPDATE_TOKEN;
  delete process.env.LITHUB_UPDATE_ACK; delete process.env.LITHUB_UPDATE_TOKEN;
  if (!ack || !token) return;
  const target=path.dirname(path.resolve(executable)), work=path.dirname(path.resolve(ack));
  if(path.dirname(work)!==target || !path.basename(work).startsWith('.lithub-update-') || path.basename(ack)!=='started.json') return;
  const plan=JSON.parse(fs.readFileSync(path.join(work,'plan.json'),'utf8'));
  if(plan.token!==token || path.resolve(plan.target)!==target) return;
  fs.writeFileSync(ack,JSON.stringify({token}));
}
module.exports={distributionFor,launchPortableAfterExit,confirmPortableStartup,readPortableResult};
