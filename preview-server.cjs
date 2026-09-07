// Local-only preview with correct 404 responses. No external connections.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve('_site');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
  let pathname;
  try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch(e) { res.writeHead(400); res.end(); return; }
  let file=path.resolve(root,'.'+pathname);
  if (!file.startsWith(root+path.sep)&&file!==root) {res.writeHead(403);res.end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory()) {
    if(!pathname.endsWith('/')) {res.writeHead(301,{Location:pathname+'/'+new URL(req.url,'http://localhost').search});res.end();return;}
    file=path.join(file,'index.html');
  }
  let status=200;
  if(!fs.existsSync(file)) {file=path.join(root,'404.html');status=404;}
  res.writeHead(status,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Robots-Tag':'noindex'});
  fs.createReadStream(file).pipe(res);
}).listen(4173,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173'));
