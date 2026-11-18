import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let xhr;
class Request {
 constructor(){xhr=this;this.upload={};}
 open(method,url){this.method=method;this.url=url;}
 send(body){this.body=body;}
}
const context={window:{},location:{protocol:'http:',origin:'http://127.0.0.1:1234'},XMLHttpRequest:Request,FormData};
vm.runInNewContext(fs.readFileSync('frontend/js/api.js','utf8'),context);
const api=context.window.LithubAPI,events=[];
const file=new Blob(['pdf'],{type:'application/pdf'});file.name='test.pdf';
const pending=api.importFile(file,'local',true,e=>events.push(e));
assert.equal(xhr.method,'POST');assert.equal(xhr.url,'http://127.0.0.1:1234/api/import');
assert.equal(xhr.body.get('auto_title'),'true');
xhr.upload.onprogress({loaded:50,total:100,lengthComputable:true});
assert.equal(events[0].loaded,50);assert.equal(events[0].total,100);
xhr.upload.onload();assert.equal(events[1].processing,true);
xhr.status=200;xhr.response={id:'p1'};xhr.onload();assert.equal((await pending).id,'p1');
const duplicate=api.importFile(file);xhr.status=409;xhr.response={detail:'已导入过'};xhr.onload();await assert.rejects(duplicate,/已导入过/);
const offline=api.importFile(file);xhr.onerror();await assert.rejects(offline,/上传失败/);
console.log('PASS real upload byte events, processing phase, form fields, successful response and error propagation');
