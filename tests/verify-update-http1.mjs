// Real TLS + CONNECT proxy tests in a child whose only additional trust root is
// a generated test certificate. Production TLS verification is never disabled.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {requestHTTP1}=require('../electron/update-http1');
if(!process.env.LITHUB_HTTP1_TEST_CERTS){
  const root=mkdtempSync(path.join(tmpdir(),'lithub-http1-'));
  try{
    execFileSync('python',['-c',`
import sys,datetime,ipaddress
from pathlib import Path
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import rsa
p=Path(sys.argv[1]);key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'localhost')]);now=datetime.datetime.now(datetime.timezone.utc)
cert=(x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number())
 .not_valid_before(now-datetime.timedelta(minutes=1)).not_valid_after(now+datetime.timedelta(days=1))
 .add_extension(x509.BasicConstraints(ca=True,path_length=None),True)
 .add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'),x509.IPAddress(ipaddress.ip_address('127.0.0.1'))]),False).sign(key,hashes.SHA256()))
(p/'cert.pem').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
(p/'key.pem').write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
`,root],{windowsHide:true});
    const child=spawn(process.execPath,[fileURLToPath(import.meta.url)],{windowsHide:true,stdio:'inherit',
      env:{...process.env,LITHUB_HTTP1_TEST_CERTS:root,NODE_EXTRA_CA_CERTS:path.join(root,'cert.pem')}});
    const timer=setTimeout(()=>child.kill(),25000);
    const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
    clearTimeout(timer);assert.equal(code,0);
  }finally{rmSync(root,{recursive:true,force:true});}
}else{
  const root=process.env.LITHUB_HTTP1_TEST_CERTS,sockets=new Set();let connects=0;
  const track=socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));};
  const payload=Buffer.from('real TLS HTTP/1.1 update transfer');
  const server=https.createServer({key:readFileSync(path.join(root,'key.pem')),cert:readFileSync(path.join(root,'cert.pem')),ALPNProtocols:['http/1.1']},(req,res)=>{
    assert.equal(req.httpVersion,'1.1');
    if(req.url==='/no-headers')return;
    if(req.url==='/slow'){res.write('first bytes');return;}
    if(req.url==='/redirect'){res.writeHead(302,{location:'/asset'});res.end();return;}
    res.end(payload);
  });
  server.on('connection',track);
  const proxy=http.createServer();proxy.on('connection',track);
  proxy.on('connect',(req,client,head)=>{
    connects++;
    const upstream=net.connect(server.address().port,'127.0.0.1',()=>{
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client);
    });
    track(upstream);client.on('error',()=>upstream.destroy());upstream.on('error',()=>client.destroy());
    client.on('close',()=>upstream.destroy());upstream.on('close',()=>client.destroy());
  });
  const stalledProxy=http.createServer();stalledProxy.on('connection',track);
  stalledProxy.on('connect',(_req,socket)=>{socket.on('end',()=>socket.destroy());socket.resume();});
  try{
    for(const s of [server,proxy,stalledProxy])await new Promise(r=>s.listen(0,'127.0.0.1',r));
    const url=`https://127.0.0.1:${server.address().port}`;
    for(const resolved of ['DIRECT',`PROXY 127.0.0.1:${proxy.address().port}`]){
      const response=await requestHTTP1(url+'/asset',{signal:AbortSignal.timeout(3000)},async()=>resolved);
      const chunks=[];for await(const chunk of response.body)chunks.push(chunk);
      assert.deepEqual(Buffer.concat(chunks),payload);
      const redirect=await requestHTTP1(url+'/redirect',{},async()=>resolved);
      assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'/asset');redirect.body.destroy();
      for(const endpoint of ['/slow','/no-headers']){
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),150);
        try{await assert.rejects((async()=>{
          const r=await requestHTTP1(url+endpoint,{signal:controller.signal},async()=>resolved);
          for await(const chunk of r.body)void chunk;
        })());}finally{clearTimeout(timer);}
      }
    }
    assert.ok(connects>=4,'explicit proxy is used for every request including cancellation');
    await assert.rejects(requestHTTP1(url.replace('127.0.0.1','127.0.0.2'),{},async()=>`PROXY 127.0.0.1:${proxy.address().port}`),/certificate|Hostname|IP/i);
    await assert.rejects(requestHTTP1(url,{signal:AbortSignal.timeout(150)},async()=>`PROXY 127.0.0.1:${stalledProxy.address().port}`));
    await assert.rejects(requestHTTP1('http://127.0.0.1/',{},async()=>{throw Error('should not resolve');}),/地址/);
    await new Promise(r=>setTimeout(r,100));assert.equal(sockets.size,0,'cancelling CONNECT, headers and body closes owned sockets');
    console.log('PASS real HTTP/1.1 TLS, CONNECT proxy, manual redirects, cancellation at CONNECT/headers/body and certificate hostname rejection');
  }finally{for(const s of sockets)s.destroy();await Promise.all([server,proxy,stalledProxy].map(s=>new Promise(r=>s.close(r))));}
}
