import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const contentType=file=>file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'application/javascript; charset=utf-8':'application/octet-stream';
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html';
    const file=path.resolve(root,pathname);if(!file.startsWith(root+path.sep))throw new Error('bad path');
    const data=await fs.readFile(file);res.writeHead(200,{'content-type':contentType(file),'cache-control':'public,max-age=31536000,immutable'});res.end(data);
  }catch(_){res.writeHead(404);res.end('not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const targets=['store-desktop.html','store-mobile.html','dist/alin-core.v3.js','dist/alin-app-desktop.v3.js','dist/alin-app-mobile.v3.js'];
const jobs=Array.from({length:300},(_,i)=>targets[i%targets.length]);
const times=[];let bytes=0;let errors=0;let cursor=0;
async function worker(){while(cursor<jobs.length){const item=jobs[cursor++],start=performance.now();try{const r=await fetch(`http://127.0.0.1:${port}/${item}?load=${cursor}`);const b=await r.arrayBuffer();if(!r.ok||!b.byteLength)errors++;else bytes+=b.byteLength}catch(_){errors++}times.push(performance.now()-start)}}
await Promise.all(Array.from({length:50},worker));
server.close();
times.sort((a,b)=>a-b);const pct=p=>Number(times[Math.min(times.length-1,Math.floor(times.length*p))].toFixed(2));
const report={ok:errors===0,requests:jobs.length,concurrency:50,errors,bytes,p50_ms:pct(.5),p95_ms:pct(.95),scope:'local-static-assets-only'};
if(errors){console.error(JSON.stringify(report,null,2));process.exit(1)}
console.log(JSON.stringify(report,null,2));
